// computation/core/computation.core.js
import mongoose from "mongoose";
import { BATCH_SIZE, STUDENT_STATUS, SUSPENSION_REASONS } from "#domain/computation/utils/computationConstants.js";
import StudentService from "#domain/user/student/student.service.js";
import ResultService from "#domain/computation/services/ResultService.js";
import GPACalculator from "#domain/computation/services/GPACalculator.js";
import AcademicStandingEngine from "#domain/computation/services/AcademicStandingEngine.js";
import SummaryListBuilder from "#domain/computation/services/SummaryListBuilder.js";
import { getDepartmentLeadershipDetails } from "#domain/computation/services/helpers.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import AppError from "#shared/errors/AppError.js";
import courseService from "#domain/course/course.service.js";
import CarryoverService from "#domain/computation/services/CarryoverService.js";
import courseRegistrationService from "#domain/course/courseRegistration.service.js";
import { Perf } from "#utils/performanceMonitor.js";
import { logger } from "#utils/logger.js";
import SemesterService from "#domain/semester/semester.service.js";

/**
 * Core computation engine - shared logic between preview and final
 */
export class ComputationCore {
  constructor(options = {}) {
    this.isPreview = options.isPreview || false;
    this.purpose = options.purpose || 'final';
    this.computedBy = options.computedBy;
    this.computationSummary = options.computationSummary;
    this.department = options.department;
    this.programme = options.programme;
    this.activeSemester = options.activeSemester;
    this.masterComputationId = options.masterComputationId;

    // Initialize state
    this.counters = this.initializeCounters();
    this.buffers = this.initializeBuffers();
    this.gradeDistribution = this.initializeGradeDistribution();
    this.levelStats = {};
    this.processedStudentIds = new Set();
  }

  // Shared initialization functions
  initializeCounters() {
    return {
      totalStudents: 0,
      studentsWithResults: 0,
      totalGPA: 0,
      highestGPA: 0,
      lowestGPA: 5.0,
      totalCarryovers: 0,
      affectedStudentsCount: 0
    };
  }

  initializeBuffers() {
    return {
      // Student data
      studentSummaries: [],  // ✅ Array of student summary objects
      studentSummariesByLevel: {}, // ✅ Grouped by level

      // List data
      listEntries: [], // Raw list entries
      listEntriesByLevel: {}, // Grouped by level
      flatLists: {
        passList: [],
        probationList: [],
        withdrawalList: [],
        terminationList: [],
        // FEB18
        notRegisteredList: [],
        leaveOfAbsenceList: [],
        carryoverStudents: [],
      },

      // Course data
      // allResults: [], // All results processed
      keyToCourses: {}, // Course mapping
      keyToCoursesByLevel: {}, // Course mapping by level
      coursesByLevel: {},

      // Other
      failedStudents: [],
      notificationQueue: [],
    };
  }

  initializeGradeDistribution() {
    return {
      firstClass: 0,
      secondClassUpper: 0,
      secondClassLower: 0,
      thirdClass: 0,
      fail: 0
    };
  }

  initializeLevelStats() {
    return {
      totalStudents: 0,
      totalGPA: 0,
      totalCarryovers: 0,
      highestGPA: 0,
      lowestGPA: 5.0,
      gradeDistribution: this.initializeGradeDistribution()
    };
  }

  /**
   * Process a batch of students - shared logic
   */
  async processStudentBatch(studentIds, computationId) {

    // -----BATCH MONITORING STARTS HERE
    const batchTimer = Perf.start(`Batch Processing (${studentIds.length} students)`, {
      domain: "computation",
      scopeId: this.scopeId
    });

    // Fetch student details and results in parallel, wrapped by performace monitoring
    // const fetchTimer = Perf.start("Fetch Students + Registrations + Results + Carryovers", {
    //   domain: "computation",
    //   scopeId: this.scopeId
    // });

    const previousSemesters = await SemesterService.getPreviousAcademicSemesters(this.activeSemester._id);
    console.log(`🔍 Previous semesters for ${this.activeSemester.name}:`, previousSemesters);
    const [
      students,
      registrationsByStudent,
      resultsByStudent,
      previousCarryoversByStudents,
      previousSemesterResultsByStudents,
    ] = await Promise.all([
      StudentService.getStudentsWithDetails(studentIds),
      courseRegistrationService.getRegistrationsByStudents(
        studentIds,
        this.activeSemester._id
      ),
      ResultService.getResultsByStudents(
        studentIds,
        this.activeSemester._id
      ),
      CarryoverService.getCarryoversByStudents(studentIds, previousSemesters),
      ResultService.getPreviousResultsByStudents(studentIds, previousSemesters)
    ]);

    // Perf.end(fetchTimer);

    // Determine levels present in this batch
    const levels = [...new Set(students.map(s => s.level))];

    const coursesByLevel = {};

    for (const level of levels) {
      coursesByLevel[level] = await courseService.getCurriculumCourses(
        this.department._id,
        this.activeSemester.name,
        level,
        this.programme._id
      );
    }

    // ✅ Restore global curriculum buffer
    if (!this.buffers.coursesByLevel) {
      this.buffers.coursesByLevel = {};
    }

    Object.assign(this.buffers.coursesByLevel, coursesByLevel);

    // Ensure results buffer exists
    if (!this.buffers.allResults) {
      this.buffers.allResults = [];
    }

    const batchResults = [];

    for (const student of students) {
      this.counters.totalStudents++;

      try {
        const studentId = student._id.toString();

        const studentResults =
          resultsByStudent[studentId] || [];

        const courses =
          coursesByLevel[student.level] || [];

        const previousCarryovers =
          previousCarryoversByStudents[studentId] || [];

        const registrations =
          registrationsByStudent[studentId] || [];

        const previousSemesterResults =
          previousSemesterResultsByStudents[studentId] || [];

        if (!studentResults || studentResults.length === 0) {
          // this.handleMissingResults(student);
        }

        // ✅ Track results globally for later computations
        this.buffers.allResults.push(...studentResults);

        const result = await this.processSingleStudent(
          student,
          studentResults,
          courses,
          previousCarryovers,
          { registrations, previousSemesterResults, computationId }
        );

        // ✅ Restore expected fields used by final processors
        result.student = student;
        result.results = studentResults;

        batchResults.push(result);

        //  --------BATCH MONITORING ENDS HERE---------//

        // Perf.end(batchTimer)

      } catch (error) {
        logger.info("[processStudentBatch] Error:", error, {
          scopeId: this.masterComputationId
        });

        const errorResult = this.handleStudentProcessingError(
          student,
          error
        );

        batchResults.push(errorResult);
      }
    }

    return batchResults;
  }

  /**
   * Process single student - shared logic
   */
  async processSingleStudent(student, results, allCourses, previousCarryovers = [], { registrations, previousSemesterResults, computationId } = {}) {

    let totalUnits = 0;
    for (const course of registrations) {
      if (course.unit == null || course.unit === undefined) {
        throw new AppError(`Course ${course.courseCode} has no unit value. This is required for a correct GPA.`);
      }
      totalUnits += course.unit || 0;
    }
    if (!student || !student.level === undefined) {
      throw new AppError(`Invalid student or results data. ${student._id}`);
    }
    const studentLevel = student.level;

    // Initialize level stats
    if (!this.levelStats[studentLevel]) {
      this.levelStats[studentLevel] = this.initializeLevelStats();
    }
    this.levelStats[studentLevel].totalStudents++;

    // FIRST: Check if student has results
    const registered = results && results.length > 0;





    // FOR STUDENTS WITH RESULTS - your existing code continues...
    // Calculate GPA and CGPA

    // Calculate GPA and CGPA
    const gpaData = GPACalculator.calculateSemesterGPA(results, totalUnits);
    const cgpaData = await GPACalculator.calculateStudentCGPAWithTCP(
      student._id,
      this.activeSemester._id,
      gpaData.totalCreditPoints,
      gpaData.totalUnits,
      previousSemesterResults
    );
    if (!registered) {
    }


    // If the student registered and is suspended due to no registration in the previous semester make sure to lift them from the suspension,
    // Do that by updating the academic standing before passing it further into other functions

    const hasNoRegistrationSuspension = student?.suspension?.some(
      s => s.reason === SUSPENSION_REASONS.NO_REGISTRATION && s.is_active === registered
    );
    if (hasNoRegistrationSuspension && registered) {
      // handle lift
      academicStanding.suspension = {
        stats: false,
        reason: SUSPENSION_REASONS.NO_REGISTRATION_LIFTED
      }
    }

    // Determine academic standing
    const academicStanding = await AcademicStandingEngine.determineAcademicStanding(
      student,
      gpaData.semesterGPA,
      cgpaData.cgpa,
      student.totalCarryovers + gpaData.failedCount,
      this.activeSemester._id,
      !this.isPreview,
      registered,
      this.activeSemester
    );



    // Check termination/withdrawal status
    const isTerminatedOrWithdrawn = this.checkTerminatedOrWithdrawn(academicStanding);

    // Calculate outstanding courses only for active students
    let outstandingCourses = [];
    outstandingCourses = await CarryoverService.calculateOutstandingCourses(
      student._id,
      this.activeSemester._id,
      null,
      results,
      allCourses,
      previousCarryovers,
      { registrations, cumulative: true, computationId }
    );



    return {
      notRegistered: !registered,
      studentId: student._id,
      student,
      success: true,
      standing: academicStanding.remark,
      level: studentLevel,
      isPreview: this.isPreview,
      isTerminatedOrWithdrawn,
      outstandingCoursesCount: outstandingCourses.length,
      gpaData,
      cgpaData,
      academicStanding,
      outstandingCourses,
      previousOutstandingCourses: previousCarryovers
    };
  }

  /**
   * Check if student is terminated or withdrawn
   */
  checkTerminatedOrWithdrawn(academicStanding) {
    const academicRemark = (academicStanding.remark || '').toUpperCase();
    const academicStatus = (academicStanding.status || '').toLowerCase();

    return (
      academicRemark.includes('TERMINATED') ||
      academicRemark.includes('WITHDRAW') ||
      academicStatus.includes('terminated') ||
      academicStatus.includes('withdraw') ||
      academicStatus.includes('withdrawal')
    );
  }

  /**
   * Add student data to buffers
   */


  /**
   * Handle student processing error
   */
  handleStudentProcessingError(student, error) {
    console.error(`Error processing student ${student.matricNumber}:`, error);

    const failedStudent = {
      studentId: student._id,
      matricNumber: student.matricNumber,
      name: resolveUserName(student, "ComputationCore.handleStudentProcessingError") || 'Undefined',
      error: error.message,
      notified: false
    };

    this.buffers.failedStudents.push(failedStudent);

    return {
      studentId: student._id,
      success: false,
      error: error.message,
      isPreview: this.isPreview
    };
  }

  /**
   * Build keyToCourses from all results
   */
  // async buildKeyToCourses() {
  //   if (this.buffers.allResults && this.buffers.allResults.length > 0) {
  //     this.buffers.keyToCoursesByLevel = await SummaryListBuilder.buildKeyToCoursesByLevel(this.buffers.allResults);
  //   }
  //   return this.buffers.keyToCoursesByLevel;
  // }
  async buildKeyToCourses() {
    // Use curriculum from buffer instead of allResults
    if (this.buffers.coursesByLevel && Object.keys(this.buffers.coursesByLevel).length > 0) {
      this.buffers.keyToCoursesByLevel = {};

      for (const [level, courses] of Object.entries(this.buffers.coursesByLevel)) {
        this.buffers.keyToCoursesByLevel[level] = courses.map(course => ({
          courseCode: course.courseCode,
          courseTitle: course.title,
          unitLoad: course.unit ?? course.credits ?? 1,
          isCoreCourse: course.isCoreCourse || course.type === "core",
          level: course.level || parseInt(level),
          semester: course.semester,
          _id: course._id
        }));

        // Sort for consistent display
        this.buffers.keyToCoursesByLevel[level].sort((a, b) =>
          a.courseCode.localeCompare(b.courseCode)
        );
      }
      logger.info(`📊 Built keyToCourses from curriculum for levels: ${Object.keys(this.buffers.keyToCoursesByLevel).join(', ')}`, null, {
        scopeId: this.masterComputationId
      });
      return this.buffers.keyToCoursesByLevel;

    } else {
      console.warn('No curriculum data in buffers to build keyToCourses');
    }

    return this.buffers.keyToCoursesByLevel;
  }

  // async buildKeyToCourses() {
  //   // coursesByLevel is already fetched and organized by level
  //   // Example structure:
  //   // {
  //   //   "100": [Course1, Course2, ...],
  //   //   "200": [Course3, Course4, ...],
  //   //   ...
  //   // }

  //   const coursesByLevel = this.buffers.keyToCoursesByLevel;

  //   for (const [level, courses] of Object.entries(coursesByLevel)) {
  //     this.buffers.keyToCoursesByLevel[level] = courses.map(course => ({
  //       courseCode: course.courseCode,
  //       courseTitle: course.title,
  //       unitLoad: course.unit ?? course.credits ?? 1,
  //       isCoreCourse: course.isCoreCourse || course.type === "core",
  //       level: course.level || parseInt(level),
  //       semester: course.semester,
  //       _id: course._id
  //     }));

  //     // Sort for consistent display
  //     this.buffers.keyToCoursesByLevel[level].sort((a, b) =>
  //       a.courseCode.localeCompare(b.courseCode)
  //     );
  //   }

  //   return this.buffers.keyToCoursesByLevel;
  // }

  /**
   * Get summary data for master computation stats
   */
  getMasterComputationStats() {
    return {
      studentsProcessed: this.counters.studentsWithResults,
      passListCount: this.buffers.flatLists.passList.length,
      probationListCount: this.buffers.flatLists.probationList.length,
      withdrawalListCount: this.buffers.flatLists.withdrawalList.length,
      terminationListCount: this.buffers.flatLists.terminationList.length,

      // FEB18
      notRegisteredList: this.buffers.flatLists.notRegisteredList.length,
      leaveOfAbsenceList: this.buffers.flatLists.leaveOfAbsenceList.length,

      carryoverCount: this.counters.totalCarryovers,
      averageGPA: this.counters.studentsWithResults > 0
        ? this.counters.totalGPA / this.counters.studentsWithResults
        : 0,
      failedStudentsCount: this.buffers.failedStudents.length,
      status: this.buffers.failedStudents.length > 0
        ? "completed_with_errors"
        : "completed"
    };
  }
}