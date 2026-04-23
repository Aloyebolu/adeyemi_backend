// computation/controllers/finalComputation.controller.js
import { ComputationCore } from "./computation.core.js";
import ComputationSummary from "#domain/computation/models/computation.model.js";
import SemesterService from "#domain/semester/semester.service.js";
import BulkWriter from "#domain/computation/services/BulkWriter.js";
import ReportService from "#domain/computation/services/ReportService.js";
import StudentService from "#domain/user/student/student.service.js";
import ResultService from "#domain/computation/services/ResultService.js";
import GPACalculator from "#domain/computation/services/GPACalculator.js";

export const processFinalDepartmentJob = async (job) => {
  const {
    departmentId,
    programmeId,
    masterComputationId,
    computedBy,
    semesterId,
    jobId,
    isRetry = false
  } = job.data;

  // Services and read-only data
  const department = await departmentService.getDepartmentById(departmentId);
  const programme = await programmeService.getProgrammeById(programmeId);
  const computationSummaryService = new ComputationSummaryService();

  if (!department) throw new AppError(`Department ${departmentId} not found`, 500);
  if (!programme) throw new AppError(`Programme ${programmeId} not found`, 500);

  logger.info(`Starting department ${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`, {
    scopeId: masterComputationId.toString(),
    data: {
      departmentId: departmentId.toString(),
      departmentName: `${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`,
      currentPhase: "processing_department",
      purpose: 'final'
    }
  });

  let activeSemester;
  if (semesterId) {
    activeSemester = await SemesterService.getAcademicSemesterById(semesterId);
    console.log(`🔍 Active semester for department ${department.name}:`, activeSemester);
    if (!activeSemester) throw new AppError(`Semester with ID ${semesterId} not found`, 404);
  } else {
    activeSemester = await SemesterService.getActiveAcademicSemester();
    if (!activeSemester) throw new AppError(`No active semester found for department: ${department.name}`, 500);
  }
  // Create computation summary (outside transactions)
  let computationSummary = await computationSummaryService.initializeComputationSummary(
    departmentId,
    programmeId,
    activeSemester._id,
    masterComputationId,
    computedBy,
    isRetry,
    'final'
  );
  const size = Buffer.byteLength(JSON.stringify(computationSummary));
  console.log("Buffer size: ", size)
  const studentIds = await StudentService.getStudentIdsForProgramme(programmeId);
  logger.info(`Processing ${studentIds.length} students for final computation`, {
    scopeId: masterComputationId.toString(),
    data: { studentIds }
  });

  // Initialize or get existing batch tracking from metadata
  let batchTracking = computationSummary.metadata?.batchTracking || {
    pendingBatches: [],
    processingBatches: [],
    successfulBatches: [],
    failedBatches: [],
    totalStudents: studentIds.length,
    totalBatches: 0
  };

  // First time setup - divide students into batches and store as pending
  if (batchTracking.pendingBatches.length === 0 && batchTracking.totalBatches === 0) {
    const batches = [];
    for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
      const studentBatch = studentIds.slice(i, i + BATCH_SIZE);
      const batchId = `${Date.now()}_${batches.length}_${masterComputationId}`;

      batches.push({
        batchId,
        batchIndex: batches.length,
        studentIds: studentBatch,
        status: 'pending',
        createdAt: new Date()
      });
    }

    batchTracking.pendingBatches = batches;
    batchTracking.totalBatches = batches.length;

    await ComputationSummary.updateOne(
      { _id: computationSummary._id },
      { $set: { 'metadata.batchTracking': batchTracking } }
    );
  }

  // Create a single ComputationCore that will accumulate all results (in-memory)
  const computationCore = new ComputationCore({
    isPreview: false,
    purpose: 'final',
    computedBy,
    computationSummary,
    department,
    programme,
    activeSemester,
    masterComputationId
  });

  // Process pending batches
  while (batchTracking.pendingBatches.length > 0) {
    // Get the next pending batch
    const currentBatch = batchTracking.pendingBatches[0];

    // Move batch from pending to processing
    batchTracking.pendingBatches = batchTracking.pendingBatches.filter(b => b.batchId !== currentBatch.batchId);
    batchTracking.processingBatches.push({
      ...currentBatch,
      processingStartedAt: new Date()
    });

    await ComputationSummary.updateOne(
      { _id: computationSummary._id },
      { $set: { 'metadata.batchTracking': batchTracking } }
    );

    // Create a fresh BulkWriter for this batch
    const batchBulkWriter = new BulkWriter();
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async (txnSession) => {
        const batchResults = await computationCore.processStudentBatch(currentBatch.studentIds, computationSummary._id);

        for (const result of batchResults) {
          await processFinalStudentActions(
            result,
            computationCore,
            batchBulkWriter,
            department,
            activeSemester,
            computedBy,
            computationSummary
          );
        }

        // Flush all writes for this batch inside the transaction
        if (batchBulkWriter.hasPendingWrites()) {
          await batchBulkWriter.executeBulkWrites(txnSession, null, masterComputationId);
        }
      });

      console.log(`✅ Batch ${currentBatch.batchIndex + 1} succeeded (${currentBatch.studentIds.length} students)`);

      // Move batch from processing to successful
      batchTracking.processingBatches = batchTracking.processingBatches.filter(b => b.batchId !== currentBatch.batchId);
      batchTracking.successfulBatches.push({
        ...currentBatch,
        completedAt: new Date(),
        status: 'successful'
      });

      await ComputationSummary.updateOne(
        { _id: computationSummary._id },
        { $set: { 'metadata.batchTracking': batchTracking } }
      );

    } catch (error) {
      console.error(`❌ Batch ${currentBatch.batchIndex + 1} failed:`, error);

      // Move batch from processing to failed
      batchTracking.processingBatches = batchTracking.processingBatches.filter(b => b.batchId !== currentBatch.batchId);
      batchTracking.failedBatches.push({
        ...currentBatch,
        completedAt: new Date(),
        status: 'failed',
        error: error.message
      });

      await ComputationSummary.updateOne(
        { _id: computationSummary._id },
        { $set: { 'metadata.batchTracking': batchTracking } }
      );

      // Continue to next batch – do not throw
    } finally {
      await session.endSession();
    }
  }

  // Verify all students are accounted for
  const totalProcessed = batchTracking.successfulBatches.length + batchTracking.failedBatches.length;
  const expectedTotal = batchTracking.totalBatches;

  if (totalProcessed !== expectedTotal) {
    logger.warn(`Batch count mismatch: ${totalProcessed} processed vs ${expectedTotal} expected`, {
      scopeId: masterComputationId.toString()
    });
  }

  // Build keyToCourses (in‑memory, uses computationCore buffers)
  logger.info(`📊 Building keyToCourses from ${computationCore.buffers.coursesByLevel.length} results`, {
    scopeId: masterComputationId.toString(),
  });
  await computationCore.buildKeyToCourses();

  // Finalize computation
  const finalSession = await mongoose.startSession();
  try {
    await finalSession.withTransaction(async (txnSession) => {
      await finalizeFinalComputation(
        computationCore,
        computationSummary,
        department,
        programme,
        activeSemester,
        computedBy,
        masterComputationId,
        null,
        { session: txnSession }
      );

      // Update final metadata
      await ComputationSummary.updateOne(
        { _id: computationSummary._id },
        {
          $set: {
            'metadata.batchTracking.completedAt': new Date(),
            'metadata.batchTracking.hasFailures': batchTracking.failedBatches.length > 0,
            'metadata.completedAt': new Date()
          }
        },
        { session: txnSession }
      );
    });
  } catch (finalError) {
    console.error(`Finalization failed:`, finalError);
    await handleJobFailure(computationSummary, department, activeSemester, finalError, programme);
    throw finalError;
  } finally {
    finalSession.endSession();
  }

  logger.info(`✅ Final computation completed for department ${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`, {
    scopeId: masterComputationId.toString(),
    data: {
      departmentId: departmentId.toString(),
      departmentName: `${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`,
      successfulBatches: batchTracking.successfulBatches.length,
      failedBatches: batchTracking.failedBatches.length,
      totalStudentsProcessed: computationCore.counters.studentsWithResults
    }
  });

  return {
    success: true,
    summaryId: computationSummary._id,
    department: department.name,
    programme: programme.name,
    studentsProcessed: computationCore.counters.studentsWithResults,
    batchTracking: {
      successful: batchTracking.successfulBatches.length,
      failed: batchTracking.failedBatches.length,
      total: batchTracking.totalBatches
    },
    keyToCoursesBuilt: !!computationCore.buffers.keyToCoursesByLevel,
    keyToCoursesLevels: Object.keys(computationCore.buffers.keyToCoursesByLevel || {}).length
  };
};
/**
 * Process final student actions (carryovers, updates, etc.)
 */
async function processFinalStudentActions(
  result,
  computationCore,
  bulkWriter,
  department,
  activeSemester,
  computedBy,
  computationSummary
) {
  const { student, gpaData, cgpaData, academicStanding, isTerminatedOrWithdrawn, outstandingCourses, previousOutstandingCourses } = result;

  // Process failed courses (carryovers) if not terminated/withdrawn
  if (outstandingCourses?.length > 0) {
    CarryoverService.addCarryoversToBulkWriter(outstandingCourses, bulkWriter)
  }

  // Update student record
  await updateStudentRecord(student, gpaData, cgpaData, academicStanding, gpaData.failedCount, bulkWriter, result);

  // Create semester result record
  const semesterResultData = await buildStudentSemesterResult(
    student,
    result.results,
    department,
    activeSemester,
    gpaData,
    cgpaData,
    academicStanding,
    computedBy,
    computationSummary,
  );

  bulkWriter.addSemesterResultUpdate(null, semesterResultData);

  // Queue notification
  if (!isTerminatedOrWithdrawn) {
    // bulkWriter.addNotification({
    //   studentId: student._id,
    //   studentName: student.name,
    //   studentEmail: student.email,
    //   semesterGPA: gpaData.semesterGPA,
    //   currentCGPA: cgpaData.cgpa,
    //   studentCarryovers: gpaData.failedCount,
    //   academicStanding,
    //   activeSemesterName: activeSemester.name,
    //   departmentName: department.name
    // });
  }
}


/**
 * Update student record in database
 */
async function updateStudentRecord(student, gpaData, cgpaData, academicStanding, failedCount, bulkWriter, result) {
  // Capture "before" snapshot
  const oldData = {
    gpa: student.gpa,
    cgpa: student.cgpa,
    lastGPAUpdate: student.lastGPAUpdate,
    probationStatus: student.probationStatus,
    terminationStatus: student.terminationStatus,
    suspension: student.suspension,
    totalCarryovers: result?.previousCarryovers?.length
  };

  // Compute "after" snapshot
  const newData = {
    gpa: gpaData.semesterGPA,
    cgpa: cgpaData.cgpa,
    lastGPAUpdate: new Date(),
    probationStatus: academicStanding.probationStatus,
    terminationStatus: academicStanding.terminationStatus,
    suspension: academicStanding.suspension || {},
    totalCarryovers: result?.outstandingCourses?.length
  };

  // Push to bulk writer
  bulkWriter.addStudentUpdate(student._id, {
    set: {
      gpa: newData.gpa,
      cgpa: newData.cgpa,
      lastGPAUpdate: newData.lastGPAUpdate,
      probationStatus: newData.probationStatus,
      terminationStatus: newData.terminationStatus,
      suspension: newData.suspension
    },
    increment: {
      totalCarryovers: failedCount
    }
  });

  // Log the student update
  bulkWriter.addAuditLog({
    entity: 'Student',
    action: "STUDENT_UPDATE_FROM_COMPUTATION",
    actor: {
      role: 'admin',
      userId: SYSTEM_USER_ID
    },
    studentId: student._id,
    oldData,
    newData,
    changes: {
      before: oldData,
      after: newData,
      delta: {
        gpa: { before: oldData.gpa, after: newData.gpa },
        cgpa: { before: oldData.cgpa, after: newData.cgpa },
        probationStatus: { before: oldData.probationStatus, after: newData.probationStatus },
        terminationStatus: { before: oldData.terminationStatus, after: newData.terminationStatus },
        suspension: { before: oldData.suspension, after: newData.suspension },
        totalCarryovers: { before: oldData.totalCarryovers, after: newData.totalCarryovers }
      },
      changedFields: Object.keys(newData).filter(key => JSON.stringify(oldData[key]) !== JSON.stringify(newData[key]))
    },
    context: { actorId: SYSTEM_USER_ID, semesterId: gpaData.semesterId },
    reason: "Student update during computation",
    createdAt: new Date()
  });
}

/**
 * Build student semester result record
 */
async function buildStudentSemesterResult(
  student,
  results,
  department,
  activeSemester,
  gpaData,
  cgpaData,
  academicStanding,
  computedBy,
  computationSummary
) {
  const courseDetails = [];

  // Process each course result
  for (const result of results) {
    const gradeInfo = GPACalculator.calculateGradeAndPoints(result.score);
    const courseUnit = result.courseUnit || result.courseId?.credits || result.courseId?.unit || 1;
    const isCoreCourse = result.courseId?.isCoreCourse || result.courseId?.courseType === "core" || false;

    courseDetails.push({
      courseId: result.courseId?._id || result.courseId,
      courseUnit: courseUnit,
      score: result.score,
      grade: gradeInfo.grade,
      gradePoint: gradeInfo.point,
      isCoreCourse: isCoreCourse,
      isCarryover: result.isCarryover || false
    });
  }

  return {
    // student details (locked)
    matricNumber: student.matricNumber,
    name: resolveUserName(student),
    academicStanding,
    studentId: student._id,
    departmentId: department._id,


    semesterId: activeSemester._id,
    session: activeSemester.session || new Date().getFullYear().toString(),
    level: student.level || "100",
    courses: courseDetails,
    gpa: gpaData.semesterGPA,
    cgpa: cgpaData.cgpa,
    totalUnits: gpaData.totalUnits,
    totalPoints: gpaData.totalPoints,
    carryoverCount: gpaData.failedCount,

    // TCP/TNU tracking for master sheet
    previousCumulativeTCP: cgpaData.previousCumulativeTCP,
    previousCumulativeTNU: cgpaData.previousCumulativeTNU,
    previousCumulativeGPA: cgpaData.previousCumulativeGPA,

    currentTCP: gpaData.totalCreditPoints,
    currentTNU: gpaData.totalUnits,
    cumulativeTCP: cgpaData.cumulativeTCP,
    cumulativeTNU: cgpaData.cumulativeTNU,

    remark: academicStanding.remark,
    status: "processed",
    computedBy,
    computationSummaryId: computationSummary._id,
    createdAt: new Date()
  };
}


/**
 * Finalize final computation
 */
async function finalizeFinalComputation(
  computationCore,
  computationSummary,
  department,
  programme,
  activeSemester,
  computedBy,
  masterComputationId,
  bulkWriter
) {
  logger.info('🏁 Starting finalizeFinalComputation...', {
    scopeId: masterComputationId.toString(),
  });
  // ✅ USE THE UNIFIED HANDLER
  const computationHandler = new ComputationHandler({
    isPreview: false,
    purpose: 'final'
  });

  const summaryData = await computationHandler.finalizeComputation(
    computationCore,
    computationSummary,
    department,
    programme,
    activeSemester,
    computedBy,
    masterComputationId,
    bulkWriter
  );

  // Send HOD notification
  await ReportService.sendHODNotification(
    department,
    activeSemester,
    summaryData,
    programme
  );

  logger.info(`✅ [FINALIZE] Computation completed for department: ${department.name}, programme: ${programme.name}`, {
    scopeId: masterComputationId.toString(),
  });
  return summaryData;
}

/**
 * Handle job failure
 */
export async function handleJobFailure(computationSummary, department, activeSemester, error, programme) {
  if (computationSummary) {
    computationSummary.status = "failed";
    computationSummary.errorMessage = error.message;
    computationSummary.completedAt = new Date();
    await computationSummary.save();
  }

  // Notify HOD about failure
  if (department.hod) {
    await queueNotification(
      "hod",
      department.hod,
      "computation_failed",
      `Results computation failed for ${department.name} - ${activeSemester.name}. Error: ${error.message}`,
      {
        department: department.name,
        semester: activeSemester.name,
        error: error.message
      }
    );
  }
}

/**
 * Handle preview job failure (exported for use in main controller)
 */
export async function handlePreviewJobFailure(computationSummary, department, activeSemester, error) {
  if (computationSummary) {
    computationSummary.status = "failed";
    computationSummary.errorMessage = error.message;
    computationSummary.completedAt = new Date();
    await computationSummary.save();
  }

  console.error(`Preview computation failed for ${department.name}: ${error.message}`);
}

// Import missing constant
import { BATCH_SIZE } from "#domain/computation/utils/computationConstants.js"; import { ComputationHandler } from "./computation.handler.js";
import AppError from "#shared/errors/AppError.js";
import programmeService from "#domain/programme/programme.service.js";
import departmentService from "#domain/organization/department/department.service.js";
import { logger } from "#utils/logger.js";
import { toProfessionalAbbreviation } from "#utils/helpers.js";
import ComputationSummaryService from "#domain/computation/services/ComputationSummaryService.js";
import mongoose from "mongoose";
import { SYSTEM_USER_ID } from "#config/system.js";
import { resolveUserName } from "#utils/resolveUserName.js";
import CarryoverService from "#domain/computation/services/CarryoverService.js";
import { queueNotification } from "#jobs/worker.js";

