// computation/controllers/previewComputation.controller.js
import mongoose from "mongoose";
import { ComputationCore } from "../core/computation.core.js";
import ComputationSummary from "../models/computation.model.js";
import SemesterService from "../../semester/semester.service.js";
import { addDepartmentJob } from "../../../workers/department.queue.js";
import { randomUUID } from "crypto";
import buildResponse from "../../../utils/responseBuilder.js";
import StudentService from "../../student/student.service.js";
import { BATCH_SIZE } from "../utils/computationConstants.js";
import { updatePreviewMasterComputationStats } from "../utils/computation.utils.js";
import { ComputationHandler } from "./computation.handler.js";
import AppError from "../../errors/AppError.js";
import programmeService from "../../programme/programme.service.js";
import { logger } from "../../../utils/logger.js";
import { toProfessionalAbbreviation } from "../../../utils/helpers.js";
import ComputationSummaryService from "../services/ComputationSummaryService.js";

/**
 * Preview computation - generates mastersheet without affecting students
 */
export const computePreviewResults = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    const computedBy = req.user._id;
    const { purpose = 'preview', semesterId, departmentId } = req.body;

    // Validate purpose
    const validPurposes = ['preview', 'simulation'];
    if (!validPurposes.includes(purpose)) {
      return buildResponse(res, 400, `Invalid purpose. Must be one of: ${validPurposes.join(', ')}`);
    }

    // Get departments to process
    const departmentsToProcess = await getDepartmentsToProcess(departmentId, session);

    if (departmentsToProcess.length === 0) {
      await session.abortTransaction();
      return buildResponse(res, 400, "No departments have results in their active semesters");
    }

    // Create master computation record for preview
    const masterComputation = await createPreviewMasterComputation(
      departmentsToProcess,
      computedBy,
      purpose,
      session
    );

    await session.commitTransaction();

    // Add each department to processing queue
    for (const dept of departmentsToProcess) {
      const uniqueJobId = `preview-dept-${dept.departmentId}-${masterComputation._id}-${Date.now()}-${randomUUID()}`;
      await addDepartmentJob({
        departmentId: dept.departmentId,
        masterComputationId: masterComputation._id,
        computedBy,
        jobId: uniqueJobId,
        priority: 1,
        isPreview: true,
        purpose: purpose
      });
    }

    return buildResponse(res, 202, "Preview computation started", {
      masterComputationId: masterComputation._id,
      totalDepartments: departmentsToProcess.length,
      purpose: purpose,
      isPreview: true,
      message: "Preview computation has been queued. No student data will be modified.",
      statusEndpoint: `/api/computation/preview/status/${masterComputation._id}`
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error("Error starting preview computation:", error);
    return buildResponse(res, 500, "Failed to start preview computation", null, true, error);
  } finally {
    session.endSession();
  }
};
/**
 * Process preview department job
 */
export const processPreviewDepartmentJob = async (job) => {
  const {
    departmentId,
    programmeId,
    masterComputationId,
    computedBy,
    jobId,
    isPreview = true,
    purpose = 'preview',
    departmentsProcessed
  } = job.data;

  console.log(`Processing preview department job: ${jobId} for department ${departmentId}`);

  // Get department and semester
  const department = await StudentService.getDepartmentDetails(departmentId);
  const programme = await programmeService.getProgrammeById(programmeId);
  const computationSummaryService = new ComputationSummaryService()

  if (!department) {
    throw new AppError(`Department ${departmentId} not found`);
  }

  const activeSemester = await SemesterService.getActiveAcademicSemester();
  if (!activeSemester) {
    throw new AppError(`No active semester found for department: ${department.name}`);
  }

  // When starting
  logger.info(`Starting department ${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`, {
    scopeId: masterComputationId.toString(),
    data: {
      departmentId: departmentId.toString(),
      departmentName: `${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`,
      currentPhase: "processing_department"
    }
  });


  // Initialize computation summary
  let computationSummary;

  try {
    computationSummary = await computationSummaryService.initializeComputationSummary(
      departmentId,
      programmeId,
      activeSemester._id,
      masterComputationId,
      computedBy,
      null,
      purpose
    );
  }
  catch (err) {
    throw err
  }

  try {
    // Create core computation engine for preview
    const computationCore = new ComputationCore({
      isPreview: true,
      purpose: purpose,
      computedBy,
      computationSummary,
      department,
      programme,
      activeSemester,
      masterComputationId
    });

    // Get student IDs for processing

    const studentIds = await StudentService.getStudentIdsForProgramme(programmeId);

    if (!studentIds || studentIds.length === 0) {
      console.log(`⚠️ No students found for programme ${programme.name} in department ${department.name}. Skipping computation.`);
      return; // exit early since nothing to process
    }

    console.log(`Processing ${studentIds.length} students for preview in department: ${department.name}, programme: ${programme.name}`);

    // Process students in batches
    for (let i = 0; i < studentIds.length; i += BATCH_SIZE) {
      const studentBatch = studentIds.slice(i, i + BATCH_SIZE);
      await computationCore.processStudentBatch(studentBatch, computationSummary._id);
    }

    // Finalize preview computation
    await finalizePreviewComputation(
      computationCore,
      computationSummary,
      department,
      programme,
      activeSemester,
      computedBy,
      masterComputationId
    );

    // When starting
    logger.info(`Completed department ${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`, {
      scopeId: masterComputationId.toString(),
      data: {
        departmentId: departmentId.toString(),
        departmentName: `${department.name}-${toProfessionalAbbreviation(programme.programmeType)}`,
        departmentProgress: { [departmentId.toString()]: 100 },
        // departmentsProcessed: departmentsProcessed + 1
      }
    });

    console.log(`✅ Preview completed for department ${department.name}, programme ${programme.name}`);

    return {
      success: true,
      summaryId: computationSummary._id,
      department: department.name,
      studentsProcessed: computationCore.counters.studentsWithResults,
      isPreview: true,
      purpose: purpose
    };

  } catch (error) {
    console.error(`Preview department job failed:`, error);
    await handlePreviewJobFailure(computationSummary, department, activeSemester, error);
    throw error;
  }
};

/**
 * Finalize preview computation
 */
async function finalizePreviewComputation(
  computationCore,
  computationSummary,
  department,
  programme,
  activeSemester,
  computedBy,
  masterComputationId
) {
  console.log('🏁 Starting finalizePreviewComputation...');

  const computationHandler = new ComputationHandler({
    isPreview: true,
    purpose: 'preview'
  });

  const summaryData = await computationHandler.finalizeComputation(
    computationCore,
    computationSummary,
    department,
    programme,
    activeSemester,
    computedBy,
    masterComputationId,
    null
  );

  // Update master computation stats
  await updatePreviewMasterComputationStats(
    masterComputationId,
    department.name,
    computationCore.getMasterComputationStats()
  );

  console.log(`✅ Preview finalized for ${department.name}`);
  return summaryData;
}

/**
 * Handle preview job failure
 */
async function handlePreviewJobFailure(computationSummary, department, activeSemester, error) {
  if (computationSummary) {
    computationSummary.status = "failed";
    computationSummary.errorMessage = error.message;
    computationSummary.completedAt = new Date();
    await computationSummary.save();
  }

  console.error(`Preview computation failed for ${department.name}: ${error.message}`);
}


