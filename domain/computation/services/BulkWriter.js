// computation/services/BulkWriter.js
import mongoose from "mongoose";
import studentModel from "#domain/user/student/student.model.js";
import CarryoverCourse from "#domain/user/student/carryover/carryover.model.js";
import studentSemseterResultModel from "#domain/user/student/student.semseterResult.model.js";
import ComputationSummary from "#domain/computation/models/computation.model.js";
import SummaryListBuilder from "./SummaryListBuilder.js";
import AppError from "#shared/errors/AppError.js";
import { captureConsoleLogs } from "#utils/consoleCapture.js";
import AuditLog from "#domain/auditlog/auditlog.model.js";

class BulkWriter {
  constructor() {
    this.studentUpdates = [];
    this.carryoverBuffers = [];
    this.semesterResultUpdates = [];
    this.batchSize = 1000;
    this.auditLogs = [];
  }

  /**
 * Add audit log to buffer
 * @param {Object} logEntry
 */
  addAuditLog(logEntry) {
    this.auditLogs.push(logEntry);
  }

  /**
   * Flush audit logs
   * @param {Object} options
   */
  async flushAuditLogs(session) {
    if (this.auditLogs.length === 0) return;

    // Assuming you have auditModel imported
    const bulkOps = this.auditLogs.map((entry) => ({
      insertOne: { document: entry }
    }));

    const result = await AuditLog.bulkWrite(bulkOps, { session, ordered: true });
    console.log(`✅ Flushed ${this.auditLogs.length} audit logs`);
    this.auditLogs = []; // clear buffer
    return result;
  }


  /**
   * Add student update to buffer
   * @param {string} studentId - Student ID
   * @param {Object} updates - Update operations
   */
  addStudentUpdate(studentId, updates) {
    this.studentUpdates.push({
      updateOne: {
        filter: { _id: studentId },
        update: {
          $set: updates.set || {},
          $inc: updates.increment || {}
        }
      }
    });
  }

  /**
   * Add carryover to buffer
   * @param {Object} carryoverData - Carryover data
   */
  addCarryover(carryoverData) {
    this.carryoverBuffers.push(carryoverData);
  }

  /**
   * Add semester result update to buffer
   * @param {string} resultId - Result ID (for update) or null (for insert)
   * @param {Object} resultData - Result data
   */
  addSemesterResultUpdate(resultId, resultData) {
    const operation = resultId
      ? {
        updateOne: {
          filter: { _id: resultId },
          update: { $set: resultData },
          upsert: false
        }
      }
      : {
        insertOne: {
          document: resultData
        }
      };

    this.semesterResultUpdates.push(operation);
  }

  /**
   * Execute all buffered write operations
   * @param {Object} options - Write options
   * @returns {Promise<Object>} Write results
   */
  /**
   * Executes all queued bulk writes inside the provided session.
   * Assumes a transaction is already active on the session.
   * All writes are performed within that transaction; any failure throws and the caller must abort.
   * Prevents partial updates by clearing buffers only on success.
   */
  async executeBulkWrites(session, options = { ordered: true, runValidators: true }, masterComputationId) {
    const restoreConsole = captureConsoleLogs(masterComputationId.toString());

    if (!session) throw new Error("BulkWriter.executeBulkWrites requires an active MongoDB session");
    if (!session.inTransaction()) console.warn("BulkWriter: No active transaction – writes may not be atomic");

    const startTime = Date.now();
    const totalOps = this.studentUpdates.length + this.carryoverBuffers.length + this.semesterResultUpdates.length;

    console.log("\n================ BULK WRITE EXECUTION START ================");
    console.log(`Total operations queued: ${totalOps}`);
    console.log("Buffer snapshot:", this.getBufferSizes());
    console.log(`Students: ${this.studentUpdates.length}`);
    console.log(`Carryovers: ${this.carryoverBuffers.length}`);
    console.log(`Semester Results: ${this.semesterResultUpdates.length}`);
    if (totalOps > 50000) console.warn(`⚠️ Large bulk write detected: ${totalOps} operations`);

    const results = {
      students: { modified: 0, inserted: 0, total: 0 },
      carryovers: { modified: 0, inserted: 0, total: 0 },
      semesterResults: { modified: 0, inserted: 0, total: 0 },
      auditLogs: { modified: 0, inserted: 0, total: 0 }
    };

    const getAffected = (res) => (res.modifiedCount || 0) + (res.insertedCount || 0) ;

    // Helper to log sample data for debugging (only on error)
    const logSample = (arr, label, limit = 3) => {
      console.error(`Sample ${label} (first ${Math.min(limit, arr.length)}):`);
      arr.slice(0, limit).forEach((item, idx) => {
        console.error(`  ${idx + 1}:`, JSON.stringify(item, null, 2).substring(0, 300));
      });
    };

    try {
      // =========================
      // 1. Student updates (already in bulk format)
      // =========================
      if (this.studentUpdates.length) {
        const studentResult = await studentModel.bulkWrite(
          this.studentUpdates,
          { ...options, ordered: true, session }
        );

        const affected = getAffected(studentResult);
        if (affected !== this.studentUpdates.length) {
          throw new Error(
            `Student update mismatch: expected ${this.studentUpdates.length} modifications, got ${affected}. ` +
            `Modified: ${studentResult.modifiedCount}, Inserted: ${studentResult.insertedCount}`
          );
        }

        results.students = {
          modified: studentResult.modifiedCount || 0,
          inserted: studentResult.insertedCount || 0,
          total: this.studentUpdates.length
        };
        // console.log(`Students bulk completed:`, results.students);
      }

      // =========================
      // 2. Carryover operations (new array-based structure)
      // =========================
      if (this.carryoverBuffers.length) {
        const bulkOps = this.carryoverBuffers.map((carryover) => {
          const { _id, student, semester, courses, ...safeCarryover } = carryover;

          // Ensure courses is an array
          if (!courses || !Array.isArray(courses) || courses.length === 0) {
            throw new Error('Carryover missing courses array');
          }

          if (_id) {
            return {
              updateOne: {
                filter: { _id },
                update: {
                  $set: {
                    ...safeCarryover,
                    courses: courses, // Preserve the courses array
                    updatedAt: new Date()
                  }
                }
              }
            };
          }
          return {
            updateOne: {
              filter: { student, semester },
              update: {
                $set: {
                  ...safeCarryover,
                  courses: courses, // Preserve the courses array
                  updatedAt: new Date()
                }
              },
              upsert: true
            }
          };
        });

        const carryoverResult = await CarryoverCourse.bulkWrite(
          bulkOps,
          { ...options, ordered: true, session }
        );

        const affected = getAffected(carryoverResult);
        // if (affected !== this.carryoverBuffers.length) {
          
        //   console.error(`Bulk write mismatch: expected ${this.carryoverBuffers.length}, got ${affected}`);
        //   console.error(`MatchedCount: ${carryoverResult.matchedCount}, ModifiedCount: ${carryoverResult.modifiedCount}, InsertedCount: ${carryoverResult.insertedCount}`);
        //   if (carryoverResult.getWriteErrors && carryoverResult.getWriteErrors().length) {
        //     console.error('Write errors:', carryoverResult.getWriteErrors());
        //   }
        //   logSample(this.carryoverBuffers, 'carryoverBuffers', 3);
        //   logSample(bulkOps.map(op => op.updateOne.filter), 'filters', 3);
        //   throw new Error(
        //     `Carryover update mismatch: expected ${this.carryoverBuffers.length} affected documents, got ${affected}. ` +
        //     `Modified: ${carryoverResult.modifiedCount}, Inserted: ${carryoverResult.insertedCount}`
        //   );
        // }

        results.carryovers = {
          modified: carryoverResult.modifiedCount || 0,
          inserted: carryoverResult.insertedCount || 0,
          total: this.carryoverBuffers.length
        };
        console.log(`Carryover bulk completed:`, results.carryovers);
      }

      // =========================
      // 3. Semester result updates – handle both raw and pre‑formatted bulk ops
      // =========================
      if (this.semesterResultUpdates.length) {
        let bulkOps;

        const firstItem = this.semesterResultUpdates[0];
        if (firstItem.insertOne || firstItem.updateOne) {
          // Buffer already contains bulk operations (e.g., insertOne)
          bulkOps = this.semesterResultUpdates.map((op) => {
            let document;
            if (op.insertOne) {
              document = op.insertOne.document;
            } else if (op.updateOne) {
              // Already an updateOne – ensure upsert and add updatedAt
              if (!op.updateOne.upsert) op.updateOne.upsert = true;
              if (!op.updateOne.update.$set) op.updateOne.update.$set = {};
              op.updateOne.update.$set.updatedAt = new Date();
              return op;
            } else {
              throw new Error("Unknown bulk operation type in semesterResultUpdates");
            }

            const { studentId, semesterId, level, ...rest } = document;
            if (!studentId || !semesterId || !level) {
              throw new Error("Missing required fields (studentId, semesterId, level) in document");
            }

            return {
              updateOne: {
                filter: { studentId, semesterId, level },
                update: { $set: { ...rest, updatedAt: new Date() } },
                upsert: true
              }
            };
          });
        } else {
          // Raw objects – construct updateOne directly
          bulkOps = this.semesterResultUpdates.map((result) => {
            const { _id, studentId, semesterId, level, ...rest } = result;
            if (!studentId || !semesterId || !level) {
              throw new Error("Missing required fields (studentId, semesterId, level) in semester result");
            }
            return {
              updateOne: {
                filter: { studentId, semesterId, level },
                update: { $set: { ...rest, updatedAt: new Date() } },
                upsert: true
              }
            };
          });
        }

        const semesterResult = await studentSemseterResultModel.bulkWrite(
          bulkOps,
          { ...options, ordered: true, session }
        );

        const affected = (semesterResult.modifiedCount || 0) + (semesterResult.upsertedCount || 0);
        if (affected !== this.semesterResultUpdates.length) {
          console.error(`Bulk write mismatch: expected ${this.semesterResultUpdates.length}, got ${affected}`);
          console.error(`MatchedCount: ${semesterResult.matchedCount}, ModifiedCount: ${semesterResult.modifiedCount}, UpsertedCount: ${semesterResult.upsertedCount}`);
          if (semesterResult.getWriteErrors && semesterResult.getWriteErrors().length) {
            console.error('Write errors:', semesterResult.getWriteErrors());
          }
          logSample(this.semesterResultUpdates, 'semesterResultUpdates', 3);
          logSample(bulkOps.map(op => op.updateOne.filter), 'filters', 3);
          throw new Error(
            `Semester result mismatch: expected ${this.semesterResultUpdates.length} affected documents, got ${affected}. ` +
            `Modified: ${semesterResult.modifiedCount}, Upserted: ${semesterResult.upsertedCount}`
          );
        }

        results.semesterResults = {
          modified: semesterResult.modifiedCount || 0,
          inserted: semesterResult.upsertedCount || 0,
          total: this.semesterResultUpdates.length
        };
        // console.log(`Semester results bulk completed:`, results.semesterResults);
      }

      // =========================
      // 4. Audit logs – must be part of the same transaction
      // =========================
      const auditResult = await this.flushAuditLogs(session);
      if (auditResult && auditResult.affected !== auditResult.total) {
        throw new Error(`Audit log mismatch: expected ${auditResult.total} affected, got ${auditResult.affected}`);
      }
      if (auditResult) results.auditLogs = auditResult;

      // All writes succeeded → clear buffers (caller will commit the transaction)
      this.studentUpdates = [];
      this.carryoverBuffers = [];
      this.semesterResultUpdates = [];

      const totalTime = Date.now() - startTime;
      console.log("\n================ BULK WRITE SUMMARY ================");
      console.log(`Total execution time: ${totalTime}ms`);
      // console.log("Final results:", results);
      console.log("====================================================\n");

      return results;
    } catch (error) {
      console.error("\n❌ BULK WRITE FAILED – transaction will be aborted by caller");
      console.error("Error details:", error);
      console.error(`Failure occurred after ${Date.now() - startTime}ms`);
      this.clearBuffers();
      throw error;
    } finally {
      restoreConsole();
    }
  }
  /**
   * Clear all buffers
   */
  clearBuffers() {
    this.studentUpdates = [];
    this.carryoverBuffers = [];
    this.semesterResultUpdates = [];
  }

  /**
   * Get buffer sizes
   * @returns {Object} Buffer sizes
   */
  getBufferSizes() {
    return {
      studentUpdates: this.studentUpdates.length,
      carryoverBuffers: this.carryoverBuffers.length,
      semesterResultUpdates: this.semesterResultUpdates.length
    };
  }

  /**
   * Check if buffers need to be flushed
   * @param {number} threshold - Threshold for flushing
   * @returns {boolean} True if buffers need flushing
   */
  shouldFlush(threshold = this.batchSize) {
    return (
      this.studentUpdates.length >= threshold ||
      this.carryoverBuffers.length >= threshold ||
      this.semesterResultUpdates.length >= threshold
    );
  }

  /**
   * Check if any buffered writes exist
   * @returns {boolean}
   */
  hasPendingWrites() {
    return (
      this.studentUpdates.length > 0 ||
      this.carryoverBuffers.length > 0 ||
      this.semesterResultUpdates.length > 0
    );
  }

  /**
   * Update computation summary with level-based data
   * @param {string} summaryId - Summary ID
   * @param {Object} data - Update data including level-based organization
   * @returns {Promise<Object>} Updated summary
   */
  async updateComputationSummary(summaryId, data) {
    try {
      const summary = await ComputationSummary.findById(summaryId);
      if (!summary) {
        throw new AppError(`Computation summary ${summaryId} not found`);
      }

      // Add department details
      if (data.departmentDetails !== undefined) summary.departmentDetails = data.departmentDetails;

      // Update overall statistics
      if (data.totalStudents !== undefined) summary.totalStudents = data.totalStudents;
      if (data.studentsWithResults !== undefined) summary.studentsWithResults = data.studentsWithResults;
      if (data.studentsProcessed !== undefined) summary.studentsProcessed = data.studentsProcessed;
      if (data.averageGPA !== undefined) summary.averageGPA = data.averageGPA;
      if (data.highestGPA !== undefined) summary.highestGPA = data.highestGPA;
      if (data.lowestGPA !== undefined) summary.lowestGPA = data.lowestGPA;

      // Update grade distribution
      if (data.gradeDistribution) {
        summary.gradeDistribution = data.gradeDistribution;
      }

      // Update student summaries by level
      if (data.studentSummariesByLevel) {
        // Ensure Map is initialized
        if (!summary.studentSummariesByLevel || !(summary.studentSummariesByLevel instanceof Map)) {
          summary.studentSummariesByLevel = new Map();
        }

        for (const [level, summaries] of Object.entries(data.studentSummariesByLevel)) {
          summary.studentSummariesByLevel.set(level, summaries);
        }
      }

      // Update key to courses by level
      if (data.keyToCoursesByLevel) {
        if (!summary.keyToCoursesByLevel || !(summary.keyToCoursesByLevel instanceof Map)) {
          summary.keyToCoursesByLevel = new Map();
        }

        for (const [level, courses] of Object.entries(data.keyToCoursesByLevel)) {
          summary.keyToCoursesByLevel.set(level, courses);
        }
      }

      // Update student lists by level
      if (data.studentListsByLevel) {
        if (!summary.studentListsByLevel || !(summary.studentListsByLevel instanceof Map)) {
          summary.studentListsByLevel = new Map();
        }

        for (const [level, lists] of Object.entries(data.studentListsByLevel)) {
          // Merge with existing lists for this level
          const existingLists = summary.studentListsByLevel.get(level) || {
            passList: [],
            probationList: [],
            withdrawalList: [],
            terminationList: [],

            carryoverStudents: [],
            // FEB18
            notRegisteredList: [],
            leaveOfAbsenceList: []
          };

          if (lists.passList) existingLists.passList.push(...lists.passList);
          if (lists.probationList) existingLists.probationList.push(...lists.probationList);
          if (lists.withdrawalList) existingLists.withdrawalList.push(...lists.withdrawalList);
          if (lists.terminationList) existingLists.terminationList.push(...lists.terminationList);
          if (lists.carryoverStudents) existingLists.carryoverStudents.push(...lists.carryoverStudents);

          // FEB18
          if (lists.notRegisteredList) existingLists.notRegisteredList.push(...lists.notRegisteredList);
          if (lists.leaveOfAbsenceList) existingLists.leaveOfAbsenceList.push(...lists.leaveOfAbsenceList);



          summary.studentListsByLevel.set(level, existingLists);
        }
      }

      // Update carryover stats by level
      if (data.carryoverStatsByLevel) {
        if (!summary.carryoverStatsByLevel || !(summary.carryoverStatsByLevel instanceof Map)) {
          summary.carryoverStatsByLevel = new Map();
        }

        for (const [level, stats] of Object.entries(data.carryoverStatsByLevel)) {
          summary.carryoverStatsByLevel.set(level, stats);
        }
      }

      // Update summary of results by level
      if (data.summaryOfResultsByLevel) {
        if (!summary.summaryOfResultsByLevel || !(summary.summaryOfResultsByLevel instanceof Map)) {
          summary.summaryOfResultsByLevel = new Map();
        }

        for (const [level, results] of Object.entries(data.summaryOfResultsByLevel)) {
          summary.summaryOfResultsByLevel.set(level, results);
        }
      }

      // Update backward compatible lists (deprecated but kept for compatibility)
      if (data.passList) {
        summary.passList = data.passList.slice(0, 100);
      }
      if (data.probationList) {
        summary.probationList = data.probationList.slice(0, 100);
      }
      if (data.withdrawalList) {
        summary.withdrawalList = data.withdrawalList.slice(0, 100);
      }
      if (data.terminationList) {
        summary.terminationList = data.terminationList.slice(0, 100);
      }
      if (data.leaveOfAbsenceList) {
        summary.leaveOfAbsenceList = data.leaveOfAbsenceList.slice(0, 100);
      }
      if (data.notRegisteredList) {
        summary.notRegisteredList = data.notRegisteredList.slice(0, 100);
      }

      // Update overall carryover stats
      if (data.carryoverStats) {
        summary.carryoverStats = {
          totalCarryovers: data.carryoverStats.totalCarryovers || 0,
          affectedStudentsCount: data.carryoverStats.affectedStudentsCount || 0,
          affectedStudents: (data.carryoverStats.affectedStudents || []).slice(0, 100)
        };
      }

      // Update failed students
      if (data.failedStudents) {
        summary.failedStudents = data.failedStudents.slice(0, 100);
      }

      // Update additional metrics
      if (data.additionalMetrics) {
        summary.additionalMetrics = data.additionalMetrics;
      }

      // Update status and completion time
      summary.completedAt = new Date();
      if (summary.startedAt) {
        summary.duration = Date.now() - summary.startedAt.getTime();
      }

      // Update final status
      if (data.status) {
        summary.status = data.status;
      } else if (data.failedStudents && data.failedStudents.length > 0) {
        summary.status = "completed_with_errors";
      } else {
        summary.status = "completed";
      }

      await summary.save();
      console.log(`✅ Updated computation summary ${summaryId} with level-based data`);
      return summary;
    } catch (error) {
      console.error("Failed to update computation summary:", error);
      throw error;
    }
  }

}

export default BulkWriter;