import XLSX from "xlsx";
// import fs from "fs";
import mongoose from "mongoose";
import Result from "./result.model.js";
import buildResponse from "../../utils/responseBuilder.js";
import { fetchDataHelper } from "../../utils/fetchDataHelper.js";
import Student from "../student/student.model.js";
import AppError from "../errors/AppError.js";
import ResultService from "./result.service.js"
import courseModel from "../course/course.model.js";
import SemesterService from "../semester/semester.service.js";
import CourseRegistration from "../course/courseRegistration.model.js";
import { normalizeCourse } from "../course/course.normallizer.js";
import studentService from "../student/student.service.js";
import catchAsync from "../../utils/catchAsync.js";
import { mapResults } from "../course/course.dto.js";

const REQUIRE_REGISTRATION_FOR_UPLOAD = false;

function validateCourseData(data) {
  if (!data.score && data.score !== 0) {
    return { ok: false, reason: "Score not uploaded" }

  }
  if (typeof data.score !== "number") {
    return { ok: false, reason: "Result Score is'nt a number" }
  }

  if (data.score > 100 || data.score < 0) {
    return { ok: false, reason: "Score must be within range 0 to 100" }
  }

  else {
    return { ok: true }
  }
}
/**
 * Helper: upsert a single result object
 * - data: { studentId?, matricNumber?, courseId, ca?, exam?, score?, session, semester, lecturerId? }
 * - options: { actor: req.user, allowOverrideRoles: ['admin','hod'] }
 *
 * Returns { ok: true, created: true/false, doc, reason? } or { ok: false, reason }
 */
const processBulkResults = async (rows, { actor, courseId }) => {
  const results = [];
  const errors = [];
  
  // Configuration flag
  const AUTO_CREATE_REGISTRATIONS = process.env.AUTO_CREATE_REGISTRATIONS === 'true' || true;
  
  // 🔥 Normalize matric numbers consistently
  const normalizeMatric = (m) => m?.trim().toUpperCase();
  
  // 🔥 Safer deduplication with error tracking
  const uniqueMap = new Map();
  
  for (const row of rows) {
    const rawMatric = row.matricNumber || row.matric || row.matric_no;
    if (!rawMatric) {
      errors.push({ matricNumber: 'unknown', reason: 'Missing matric number' });
      continue;
    }
    
    const normalizedMatric = normalizeMatric(rawMatric);
    const key = `${normalizedMatric}-${courseId}`;
    
    if (uniqueMap.has(key)) {
      errors.push({ 
        matricNumber: normalizedMatric, 
        reason: "Duplicate entry in upload - only last occurrence kept" 
      });
    }
    uniqueMap.set(key, { ...row, normalizedMatric });
  }
  
  rows = Array.from(uniqueMap.values());
  
  // 🔥 Cache course + semester ONCE
  const [dbCourse, semesterDoc] = await Promise.all([
    courseModel.findById(courseId)
      .populate("borrowedId")
      .lean(),
    SemesterService.getActiveAcademicSemester()
  ]);
  
  const course = normalizeCourse(dbCourse);
  
  if (!course) throw new AppError("Course not found", 404, `Course with ID ${courseId} not found`);
  if (!semesterDoc) throw new AppError("Active semester not found", 404, "Active semester not found");
  
  const semester = semesterDoc._id;
  const currentSession = semesterDoc.session;
  
  // 🔥 Extract all normalized matric numbers
  const matricNumbers = rows.map(r => r.normalizedMatric).filter(Boolean);
  
  // 🔥 Fetch ALL students in ONE query
  const students = await Student.find({
    matricNumber: { $in: matricNumbers }
  })
  .select("_id matricNumber departmentId level")
  .lean();
  
  const studentMap = new Map(
    students.map(s => [normalizeMatric(s.matricNumber), s])
  );
  
  // 🔥 FIRST: Validate all rows and collect data
  const validRows = [];
  const allProcessedStudents = []; // Track all students we're processing
  
  for (const row of rows) {
    const matricNumber = row.normalizedMatric;
    const student = studentMap.get(matricNumber);
    
    if (!student) {
      errors.push({ matricNumber, reason: "Student not found" });
      continue;
    }
    
    allProcessedStudents.push({
      studentId: student._id,
      matricNumber,
      level: student.level,
      departmentId: student.departmentId
    });
    
    if (student.level !== course.level) {
      errors.push({
        matricNumber,
        reason: `${course.courseCode} is a ${course.level} level course, but student is at level ${student.level}`
      });
      continue;
    }
    
    if (semesterDoc.name !== course.semester) {
      errors.push({
        matricNumber: matricNumber,
        reason: `${course.courseCode} is a ${course.semester} semester course, and cannot be uploaded during ${semesterDoc.name} semester`
      });
      continue;
    }
    
    if (String(student.departmentId) !== String(course.department)) {
      errors.push({ matricNumber, reason: `${course.courseCode}'s department does not match with student's department` });
      continue;
    }
    
    const ca = Number(row.ca ?? 0);
    const exam = Number(row.exam ?? 0);
    let score = row.score !== undefined && row.score !== null ? Number(row.score) : (ca + exam);
    
    if (isNaN(ca) || isNaN(exam) || isNaN(score)) {
      errors.push({ matricNumber, reason: "Invalid numeric values for CA, exam, or score" });
      continue;
    }
    
    const validation = validateCourseData({ score });
    
    if (!validation.ok) {
      errors.push({ matricNumber, reason: validation.reason });
      continue;
    }
    
    // Row passed all validations
    validRows.push({
      row,
      student,
      matricNumber,
      ca,
      exam,
      score
    });
  }
  
  // 🔥 If no valid rows, return early
  if (validRows.length === 0) {
    return { results: [], errors };
  }
  
  let session = null;
  const createdRegistrations = []; // Track registrations we create
  const registrationStudentIds = new Set(); // Track which students got registrations
  
  try {
    // Start transaction for atomicity
    if (mongoose.connection.readyState === 1) {
      session = await mongoose.startSession();
      session.startTransaction();
    }
    
    // 🔥 STEP 1: Find existing registrations for ALL processed students
    const existingRegistrations = await CourseRegistration.find({
      student: { $in: allProcessedStudents.map(s => s.studentId) },
      semester,
      session: currentSession,
      courses: courseId
    }).select("student").session(session);
    
    const existingStudentIds = new Set(
      existingRegistrations.map(r => r.student.toString())
    );
    
    // 🔥 STEP 2: Create registrations based on AUTO_CREATE_REGISTRATIONS flag
    if (AUTO_CREATE_REGISTRATIONS) {
      // Find students who need registration (in allProcessedStudents but not in existing)
      const studentsNeedingRegistration = allProcessedStudents.filter(
        s => !existingStudentIds.has(s.studentId.toString())
      );
      
      if (studentsNeedingRegistration.length > 0) {
        const registrationOps = studentsNeedingRegistration.map(student => ({
          updateOne: {
            filter: {
              student: student.studentId,
              semester,
              session: currentSession
            },
            update: {
              $set: {
                updatedAt: new Date()
              },
              $setOnInsert: {
                status: "Approved",
                level: student.level || 100,
                department: student.departmentId,
                notes: `Auto-created during result upload for course: ${course.code}`,
                totalUnits: course.units || 0
              },
              $addToSet: {
                courses: courseId
              }
            },
            upsert: true
          }
        }));
        
        if (registrationOps.length) {
          await CourseRegistration.bulkWrite(registrationOps, { 
            session, 
            ordered: false 
          });
          
          // Track created registrations for potential cleanup
          for (const student of studentsNeedingRegistration) {
            createdRegistrations.push({
              studentId: student.studentId,
              courseId,
              semester,
              session: currentSession
            });
            registrationStudentIds.add(student.studentId.toString());
          }
        }
      }
    }
    
    // 🔥 STEP 3: Now check registrations for valid rows (strict check)
    // Get ALL registrations (existing + newly created) for valid students
    const validStudentIds = validRows.map(r => r.student._id.toString());
    const finalRegistrationCheck = await CourseRegistration.find({
      student: { $in: validStudentIds },
      semester,
      session: currentSession,
      courses: courseId
    }).select("student").session(session);
    
    const finalRegisteredSet = new Set(
      finalRegistrationCheck.map(r => r.student.toString())
    );
    
    // 🔥 STEP 4: Filter valid rows to only those with registrations
    const rowsWithRegistration = [];
    const skippedDueToNoRegistration = [];
    
    for (const validRow of validRows) {
      if (finalRegisteredSet.has(validRow.student._id.toString())) {
        rowsWithRegistration.push(validRow);
      } else {
        skippedDueToNoRegistration.push(validRow);
        errors.push({
          matricNumber: validRow.matricNumber,
          reason: "Student not registered for this course (auto-creation was disabled or failed)"
        });
      }
    }
    
    // 🔥 STEP 5: Prepare result bulk operations ONLY for rows with registrations
    const bulkOps = rowsWithRegistration.map(({ student, ca, exam, score }) => ({
      updateOne: {
        filter: {
          studentId: student._id,
          courseId,
          semester
        },
        update: {
          $set: {
            ca,
            exam,
            score,
            session: currentSession,
            lecturerId: actor?._id,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdBy: actor?._id
          }
        },
        upsert: true
      }
    }));
    
    // 🔥 STEP 6: Execute result bulk write
    if (bulkOps.length) {
      const bulkResult = await Result.bulkWrite(bulkOps, { 
        session, 
        ordered: false 
      });
      
      if (bulkResult.writeErrors?.length) {
        console.error(`Bulk write had ${bulkResult.writeErrors.length} errors:`, bulkResult.writeErrors);
        for (const writeError of bulkResult.writeErrors) {
          errors.push({
            reason: `Database write error: ${writeError.errmsg}`,
            index: writeError.index
          });
        }
        
        // If ANY result write failed, rollback everything
        if (bulkResult.writeErrors.length > 0) {
          throw new Error("Result bulk write failed - rolling back all changes");
        }
      }
    }
    
    // 🔥 STEP 7: Clean up registrations for failed students
    // Find students who:
    // 1. Had registrations created in this transaction (auto-created)
    // 2. But did NOT end up with a successful result (either failed validation or no registration check)
    const failedStudents = new Set();
    
    // Add students who failed validation
    const failedMatricNumbers = errors
      .filter(e => e.matricNumber && e.matricNumber !== 'unknown')
      .map(e => e.matricNumber);
    
    const failedStudentIds = allProcessedStudents
      .filter(s => failedMatricNumbers.includes(s.matricNumber))
      .map(s => s.studentId.toString());
    
    failedStudents.add(...failedStudentIds);
    
    // Add students who passed validation but had no registration
    for (const skipped of skippedDueToNoRegistration) {
      failedStudents.add(skipped.student._id.toString());
    }
    
    // Remove registrations that were auto-created for failed students
    const registrationsToRemove = createdRegistrations.filter(
      reg => failedStudents.has(reg.studentId.toString())
    );
    
    if (registrationsToRemove.length > 0) {
      const removeOps = registrationsToRemove.map(reg => ({
        updateOne: {
          filter: {
            student: reg.studentId,
            semester: reg.semester,
            session: reg.session
          },
          update: {
            $pull: {
              courses: courseId
            }
          }
        }
      }));
      
      // Also delete the registration document if it has no courses left
      const deleteOps = registrationsToRemove.map(reg => ({
        deleteOne: {
          filter: {
            student: reg.studentId,
            semester: reg.semester,
            session: reg.session,
            courses: { $size: 0 }
          }
        }
      }));
      
      if (removeOps.length) {
        await CourseRegistration.bulkWrite([...removeOps, ...deleteOps], { 
          session, 
          ordered: false 
        });
        
        console.log(`Cleaned up ${registrationsToRemove.length} auto-created registrations for failed students`);
      }
    }
    
    // Record successful results
    for (const { matricNumber, student } of rowsWithRegistration) {
      results.push({ matricNumber, studentId: student._id });
    }
    
    // Commit transaction if started
    if (session) {
      await session.commitTransaction();
    }
    
  } catch (error) {
    // Rollback ALL changes
    if (session) {
      await session.abortTransaction();
    }
    
    errors.push({
      reason: `Transaction failed: ${error.message}. All changes for this batch have been rolled back.`,
      affectedMatricNumbers: validRows.map(r => r.matricNumber)
    });
    
    results.length = 0;
    throw error;
  } finally {
    if (session) {
      await session.endSession();
    }
  }
  
  return { results, errors };
};

// Chunk processing helper for very large datasets (100k+ rows)
const processBulkResultsInChunks = async (rows, options, chunkSize = 1000) => {
  const allResults = [];
  const allErrors = [];
  
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { results, errors } = await processBulkResults(chunk, options);
    allResults.push(...results);
    allErrors.push(...errors);
  }
  
  return { results: allResults, errors: allErrors };
};



/**
 * 📤 Bulk Result Upload (Lecturer / HOD / Admin)
 * - Keeps Excel parsing for file uploads
 * - Also accepts JSON array in body.rows (so frontend can POST processed rows)
 */
export const bulkUploadResults = async (req, res, next) => {
  try {
    const { courseId } = req.body;

    if (!Array.isArray(req.body?.rows)) {
      throw new Error("Rows are required");
    }

    const { results, errors } = await processBulkResults(req.body.rows, {
      actor: req.user,
      courseId
    });

    return buildResponse(
      res,
      errors.length ? 207 : 201,
      "Bulk results processed",
      {
        processed: results.length,
        failed: errors.length,
        results,
        errors
      }
    );

  } catch (error) {
    next(error);
  }
};
/**
 * 🧾 Upload Single Result OR JSON Array (Lecturer)
 * - Accepts either:
 *    POST body: { studentId, courseId, score, session, semester, ca, exam }
 *    OR POST body: [ { ... }, { ... } ]
 */
export const uploadResult = async (req, res, next) => {
  try {
    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];
    const studentId = req.params.studentId;
    let student;
    if (studentId) {
      student = await studentService.getStudentById(studentId, { lean: true })
    }

    const courseIdFromParams = req.params.courseId; // renamed to avoid collision

    // normalize all items first
    const normalizedItems = items.map(({ semester, ...rest }) => ({
      ...rest,
      matricNumber: student?.matricNumber || rest?.matricNumber,
      courseId: rest?.courseId || courseIdFromParams
    }));

    //  Group rows by courseId
    const groupedByCourse = {};

    for (const item of normalizedItems) {
      if (!item.courseId) {
        // ✅ do not silently ignore
        groupedByCourse["__errors__"] = groupedByCourse["__errors__"] || [];
        groupedByCourse["__errors__"].push({
          matricNumber: item.matricNumber,
          reason: "Missing courseId"
        });
        continue;
      }

      if (!groupedByCourse[item.courseId]) {
        groupedByCourse[item.courseId] = [];
      }

      groupedByCourse[item.courseId].push(item);
    }

    let allResults = [];
    let allErrors = groupedByCourse["__errors__"] || [];

    //  Process each course group
    for (const [courseIdKey, courseRows] of Object.entries(groupedByCourse)) {
      if (courseIdKey === "__errors__") continue;

      const { results: rResults, errors: rErrors } = await processBulkResults(
        courseRows,
        { actor: req.user, courseId: courseIdKey }
      );

      allResults.push(...rResults);
      allErrors.push(...rErrors);
    }

    // Set audit context for result upload
    req.auditContext = {
      action: "UPLOAD_RESULT",
      resource: "Result",
      severity: allErrors.length ? "HIGH" : "MEDIUM",
      status: allErrors.length ? "PARTIAL_SUCCESS" : "SUCCESS",
      reason: allErrors.length
        ? `Result upload completed with ${allErrors.length} errors`
        : `Result uploaded successfully (${allResults.length} records)`,
      changes: {
        before: null,
        after: {
          totalItems: items.length,
          successful: allResults.length,
          failed: allErrors.length,
          courseId: courseIdFromParams
        },
        changedFields: ["results"]
      },
      metadata: {
        uploadedBy: req.user?._id?.toString(),
        uploaderRole: req.user?.role,
        uploaderName: req.user?.name,
        uploaderEmail: req.user?.email,
        courseId: courseIdFromParams?.toString(),
        totalItems: items.length,
        successfulCount: allResults.length,
        failedCount: allErrors.length,
        failureRate: allErrors.length
          ? (allErrors.length / items.length * 100).toFixed(2) + '%'
          : '0%',
        resultsSummary: allResults.map(r => ({
          studentId: r.studentId?.toString(),
          matricNumber: r.matricNumber
        })),
        errorsSummary: allErrors.map(e => ({
          matricNumber: e.matricNumber,
          reason: e.reason
        })),
        timestamp: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    };

    return buildResponse(
      res,
      allErrors.length ? 207 : 201,
      "Processed",
      { results: allResults, errors: allErrors }
    );

  } catch (error) {
    // Set audit context for error
    req.auditContext = {
      action: "UPLOAD_RESULT",
      resource: "Result",
      severity: "CRITICAL",
      status: "ERROR",
      reason: "Error uploading result",
      metadata: {
        uploadedBy: req.user?._id?.toString(),
        uploaderRole: req.user?.role,
        courseId: req.params.courseId,
        itemCount: Array.isArray(req.body) ? req.body.length : 1,
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          name: error.name
        },
        timestamp: new Date().toISOString(),
        ipAddress: req.ip
      }
    };
    next(error);
  }
};
function computeGrade(score) {
  if (score >= 70) return "A";
  if (score >= 60) return "B";
  if (score >= 50) return "C";
  if (score >= 45) return "D";
  if (score >= 40) return "E";
  return "F";
}


/**
 * Get results for a student (original controller)
 */
export const getResultsForStudent = catchAsync(
  async (req, res, next) => {
    const studentId = req.params.studentId;
    const semesterId = req.query.semesterId; // Optional query param
    
    const results = await ResultService.getResultsForStudent(studentId, semesterId);
    return buildResponse.success(res, "Success", results);
  }
);



/**
 * 📚 Get All Results (Admin / HOD)
 */
export const getAllResults = async (req, res) => {
  return fetchDataHelper(req, res, Result, {
    enablePagination: true,
    sort: { createdAt: -1 },
  });
};

/**
 * 🔍 Get Single Result
 */
export const getResultById = async (req, res, next) => {
  try {
    const result = await Result.findById(req.params.id)
      .populate("studentId", "matricNumber name")
      .populate("courseId", "title courseCode courseUnit")
      .populate("lecturerId", "name email");

    if (!result) return buildResponse(res, 404, "Result not found");

    return buildResponse(res, 200, "Result fetched successfully", result);
  } catch (error) {
    next(error)

  }
};

/* rest of your controller (updateResult, approveResult, lockResult, analytics, deleteResult)
   can remain unchanged — they will continue to work with the improved model and the helper.
*/


/**
 * ✏️ Update Existing Result (Lecturer / HOD)
 * PATCH /results/edit/:id
 */
export const updateResult = async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = req.body || {};

    if (!validateCourseData(body).ok) {
      // Set audit context for validation failure
      throw new AppError(validateCourseData(body).reason)
    }

    const existing = await Result.findById(id);
    if (!existing) {
      throw new AppError("Result not found");
    }

    // Store before state for audit
    const beforeState = {
      ca: existing.ca,
      exam: existing.exam,
      score: existing.score,
      locked: existing.locked,
      approved: existing.approved,
      lecturerId: existing.lecturerId
    };

    // Protect locked/approved
    if (existing.locked || existing.approved) {
      const allowed = ["admin", "hod"];
      const role = req.user?.role || req.user?.roles || [];

      const authorized = Array.isArray(role)
        ? role.some(r => allowed.includes(r))
        : allowed.includes(role);

      if (!authorized) {
        throw new AppError("This result is locked/approved. You cannot modify it.");
      }
    }

    // Track changed fields
    const changedFields = [];
    const afterState = {};

    // Apply updates and track changes
    if (body.ca !== undefined && body.ca !== existing.ca) {
      changedFields.push("ca");
      afterState.ca = body.ca;
      existing.ca = body.ca;
    }
    if (body.exam !== undefined && body.exam !== existing.exam) {
      changedFields.push("exam");
      afterState.exam = body.exam;
      existing.exam = body.exam;
    }
    if (body.score !== undefined && body.score !== existing.score) {
      changedFields.push("score");
      afterState.score = body.score;
      existing.score = body.score;
    }

    // If no changes, return early with audit context
    if (changedFields.length === 0) {
      req.auditContext = {
        action: "UPDATE_RESULT",
        resource: "Result",
        severity: "LOW",
        status: "NO_CHANGE",
        reason: "No changes detected in result update",
        metadata: {
          updatedBy: req.user?._id?.toString(),
          updaterRole: req.user?.role,
          resultId: id,
          timestamp: new Date().toISOString(),
          ipAddress: req.ip
        }
      };
      return buildResponse(res, 200, "No changes made", existing);
    }

    existing.lecturerId = req.user._id; // track who updated it
    afterState.lecturerId = req.user._id;

    await existing.save();

    // Set audit context for successful update
    req.auditContext = {
      action: "UPDATE_RESULT",
      resource: "Result",
      severity: "MEDIUM",
      entityId: id,
      status: "SUCCESS",
      reason: "Result updated successfully",
      changes: {
        before: beforeState,
        after: afterState,
        changedFields
      },
      metadata: {
        updatedBy: req.user?._id?.toString(),
        updaterRole: req.user?.role,
        updaterName: req.user?.name,
        updaterEmail: req.user?.email,
        resultId: id,
        studentId: existing.studentId?.toString(),
        courseId: existing.courseId?.toString(),
        session: existing.session,
        semester: existing.semester,
        changedFields,
        wasLocked: existing.locked,
        wasApproved: existing.approved,
        timestamp: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }
    };

    return buildResponse(res, 200, "Result updated successfully", existing);
  } catch (error) {
    // Set audit context for error (if not already set)
    if (!req.auditContext) {
      req.auditContext = {
        action: "UPDATE_RESULT",
        resource: "Result",
        severity: "CRITICAL",
        status: "ERROR",
        reason: "Error updating result",
        metadata: {
          updatedBy: req.user?._id?.toString(),
          updaterRole: req.user?.role,
          resultId: req.params.id,
          error: {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            name: error.name
          },
          timestamp: new Date().toISOString(),
          ipAddress: req.ip
        }
      };
    }
    next(error)
  }
};



/**
 * ✅ Approve Result (HOD)
 * PATCH /results/:id/approve
 */
export const approveResult = async (req, res, next) => {
  try {
    const id = req.params.id;

    const result = await Result.findById(id);
    if (!result) return buildResponse(res, 404, "Result not found");

    if (result.approved) {
      return buildResponse(res, 400, "Result is already approved");
    }

    result.approved = true;
    result.approvedBy = req.user._id;
    result.approvedAt = new Date();

    await result.save();
    return buildResponse(res, 200, "Result approved successfully", result);
  } catch (error) {
    next(error)
  }
};


/**
 * 🔒 Lock Result (HOD / Admin)
 * PATCH /results/:id/lock
 */
export const lockResult = async (req, res, next) => {
  try {
    const id = req.params.id;

    const result = await Result.findById(id);
    if (!result) return buildResponse(res, 404, "Result not found");

    if (result.locked) {
      return buildResponse(res, 400, "Result is already locked");
    }

    result.locked = true;
    result.lockedBy = req.user._id;
    result.lockedAt = new Date();

    await result.save();
    return buildResponse(res, 200, "Result locked successfully", result);
  } catch (error) {
    next(error)
  }
};


/**
 * 📊 Analytics Summary (Admin / HOD)
 * GET /results/analytics
 */
export const getResultAnalytics = async (req, res, next) => {
  try {
    const total = await Result.countDocuments();
    const approved = await Result.countDocuments({ approved: true });
    const locked = await Result.countDocuments({ locked: true });

    const gradeStats = await Result.aggregate([
      { $group: { _id: "$grade", count: { $sum: 1 } } },
    ]);

    return buildResponse(res, 200, "Analytics summary", {
      total,
      approved,
      locked,
      gradeStats,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * 🗑 Delete Result (Admin)
 * DELETE /results/:id
 */
export const deleteResult = async (req, res, next) => {
  try {
    const id = req.params.id;
    const result = await Result.findById(id);

    if (!result) return buildResponse(res, 404, "Result not found");

    await Result.findByIdAndDelete(id);

    return buildResponse(res, 200, "Result deleted successfully");
  } catch (error) {
    next(error)
  }
};



import fs from "fs/promises";
import { createReadStream } from "fs";

/**
 * Download student semester result as PDF
 */
export const downloadStudentResult = catchAsync(async (req, res, next) => {
  const { studentId, semesterId, level } = req.params;
  const { preview = "false" } = req.query;
  
  const isPreview = preview === "true";
  
  // Check permissions if not preview
  // if (!isPreview) {
  //   // Verify user has permission to download official results
  //   const hasPermission = await checkDownloadPermission(req.user, studentId);
  //   if (!hasPermission) {
  //     throw new AppError("You don't have permission to download official results", 403);
  //   }
  // }

  // Generate PDF
  const result = await ResultService.generateStudentResultPDF(
    studentId,
    semesterId,
    level,
    isPreview
  );

  // Send file
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${result.filename}"`
  );
  
  // ✅ CORRECTED: Use createReadStream and pipe to response
  const fileStream = createReadStream(result.filePath);
  
  // Pipe the stream to response
  fileStream.pipe(res);
  
  // Handle stream errors
  fileStream.on("error", (error) => {
    console.error("Stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream file" });
    }
  });
  
  // Clean up temp file after streaming completes
  fileStream.on("close", async () => {
    try {
      await fs.unlink(result.filePath);
      // console.log(`Cleaned up temp file: ${result.filePath}`);
    } catch (error) {
      console.error("Failed to delete temp file:", error);
    }
  });
});

/**
 * Download academic transcript as PDF
 */
export const downloadTranscript = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;
  const { preview = "false" } = req.query;
  
  const isPreview = preview === "true";
  
  // Check permissions
  if (!isPreview) {
    // const hasPermission = await checkTranscriptPermission(req.user, studentId);
    // if (!hasPermission) {
    //   throw new AppError("You don't have permission to download official transcripts", 403);
    // }
  }

  // Generate transcript PDF
  const transcript = await ResultService.generateTranscriptPDF(
    studentId,
    isPreview
  );

  // Send file
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${transcript.filename}"`
  );
  console.log(transcript);
  
  // ✅ CORRECTED: Use createReadStream and pipe to response
  const fileStream = createReadStream(transcript.filePath);
  
  // Pipe the stream to response
  fileStream.pipe(res);
  
  // Handle stream errors
  fileStream.on("error", (error) => {
    console.error("Stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream file" });
    }
  });
  
  // Clean up after streaming completes
  fileStream.on("close", async () => {
    try {
      await fs.unlink(transcript.filePath);
      // console.log(`Cleaned up temp file: ${transcript.filePath}`);
    } catch (error) {
      console.error("Failed to delete temp file:", error);
    }
  });
});

/**
 * Preview student result as HTML
 */
export const previewStudentResult = catchAsync(async (req, res, next) => {
  const { studentId, semesterId, level } = req.params;
  
  const html = await ResultService.getStudentResultHTML(
    studentId,
    semesterId,
    level,
    true
  );

  res.send(html);
});

/**
 * Preview transcript as HTML
 */
export const previewTranscript = catchAsync(async (req, res, next) => {
  const { studentId } = req.params;
  
  const html = await ResultService.getTranscriptHTML(studentId, true);

  res.send(html);
});

// Helper function for permission checking
async function checkDownloadPermission(user, studentId) {
  if (!user) return false;
  
  // Admin and HOD can download any result
  if (["admin", "hod"].includes(user.role)) {
    return true;
  }
  
  // Students can only download their own results
  if (user.role === "student" && user.studentId) {
    return user.studentId.toString() === studentId;
  }
  
  // Staff can download results for students in their department
  if (user.role === "staff" && user.departmentId) {
    const Student = (await import("../models/Student.js")).default;
    const student = await Student.findById(studentId).select("departmentId");
    return student && student.departmentId.toString() === user.departmentId.toString();
  }
  
  return false;
}