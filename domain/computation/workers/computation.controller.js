
// computation/controllers/computation.controller.js
import mongoose from "mongoose";
import buildResponse from "../../../utils/responseBuilder.js";
import { processPreviewDepartmentJob } from "./previewComputation.controller.js";
import { processFinalDepartmentJob } from "./finalComputation.controller.js";
import {
  getDepartmentsToProcess,
  updateMasterComputationStats
} from "../utils/computation.utils.js";
import MasterComputation from "../models/masterComputation.model.js";
import { addDepartmentJob, queueNotification } from "../../../workers/department.queue.js";
import { randomUUID } from "crypto";
import SemesterService from "../../semester/semester.service.js";
import GPACalculator from "../services/GPACalculator.js";
import Result from "../../result/result.model.js";
import departmentService from "../../department/department.service.js";
import studentModel from "../../student/student.model.js";
import studentService from "../../student/student.service.js";
import CarryoverCourse from "../../carryover/carryover.model.js";
import departmentModel from "../../department/department.model.js";
import programmeModel from "../../programme/programme.model.js";
import AppError from "../../errors/AppError.js";
import { logger } from "../../../utils/logger.js";
import { validateObjectId } from "../../../utils/validator.js";

/**
 * Unified department job processor - routes to appropriate handler
 */
export const processDepartmentJob = async (job) => {
  const {
    departmentId,
    masterComputationId,
    computedBy,
    jobId,
    purpose = 'preview',
  } = job.data;

  const isPreview = purpose === 'preview'
  const isFinal = purpose === 'final';
  if (!isPreview && !isFinal) {
    throw new AppError("Unexpected error, Quitting to avoid further problems")
  }
  console.log(`Processing department job: ${jobId}`);
  console.log(`Job type: ${isPreview ? 'PREVIEW' : 'FINAL'}, Purpose: ${purpose}, isFinal: ${isFinal}`);

  const isPreviewJob = isPreview || purpose === 'preview' || purpose === 'simulation' || !isFinal;

  if (isPreviewJob) {
    return await processPreviewDepartmentJob(job);
  } else {
    return await processFinalDepartmentJob(job);
  }
};

/**
 * Compute all results (final computation)
 */
export const computeAllResults = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {

    await session.startTransaction();

    const computedBy = req.user._id;
    const {
      isRetry = false,
      purpose = "preview",
      academicBoardDate,
      semesterId,
    } = req.body;

    // 1️⃣ Get departments to process
    const departmentsToProcess = await getDepartmentsToProcess(null, session);
    // const studentsToProcess = await studentModel.count()
    const studentsToProcess = await studentModel.estimatedDocumentCount();

    if (!academicBoardDate) {
      // Set audit context for missing academic board date
      // throw new AppError("Academic Board Date is Required");
    }

    if (departmentsToProcess.length === 0) {
      await session.abortTransaction();
      throw new AppError("No departments have results in their active semesters", 404);
    }

    // 2️⃣ Get active academic semester
    const activeSemester = await SemesterService.getActiveAcademicSemester();

    // 3️⃣ Expand departments → programmes
    const programmeJobs = [];

    for (const dept of departmentsToProcess) {
      // Fetch all programmes for this department
      const programmes = await programmeModel.find({ department: dept.departmentId })
        .select("_id")
        .lean();

      if (!programmes?.length) continue;

      for (const programme of programmes) {
        programmeJobs.push({
          departmentId: dept.departmentId,
          programmeId: programme._id
        });
      }
    }

    if (programmeJobs.length === 0) {
      await session.abortTransaction();
      throw new AppError("No programmes found for computation");
    }

    // 4️⃣ Create master computation
    let masterComputation = await MasterComputation.findOne({
      semester: activeSemester._id,
      purpose
    }).session(session);

    if (masterComputation) {
      // Reuse existing master computation
      masterComputation.status = "processing";
      masterComputation.startedAt = new Date();
      masterComputation.computedBy = computedBy;
      masterComputation.totalJobs = programmeJobs.length;

      if (isRetry) {
        masterComputation.retryCount = (masterComputation.retryCount || 0) + 1;
        masterComputation.lastRetryAt = new Date();
      }

      await masterComputation.save({ session });
    } else {
      // Create new master computation
      masterComputation = new MasterComputation({
        semester: activeSemester._id,
        purpose,
        totalJobs: programmeJobs.length,
        status: "processing",
        computedBy,
        academicBoardDate,
        startedAt: new Date(),
        metadata: {
          scope: "programme",
          initiatedBy: {
            userId: computedBy,
            timestamp: new Date().toISOString()
          }
        }
      });

      await masterComputation.save({ session });
    }

    await session.commitTransaction();

    // 5️⃣ Queue programme-level jobs
    for (const job of programmeJobs) {
      const uniqueJobId = `prog-${job.programmeId}-${masterComputation._id}-${Date.now()}-${randomUUID()}`;

      await addDepartmentJob({
        scope: "programme",
        departmentId: job.departmentId,
        programmeId: job.programmeId,
        masterComputationId: masterComputation._id,
        computedBy,
        semesterId,
        jobId: uniqueJobId,
        priority: 1,
        isRetry,
        purpose,
      });
    }

    logger.info("Master computation started", {
      scopeId: masterComputation._id.toString(),
      data: {
        totalDepartments: departmentsToProcess.length,
        totalStudents: studentsToProcess, // sum across all departments
        totalOperations: programmeJobs.length,
        phase: "initializing"
      }
    });


    // 6️⃣ Monitor master computation
    setTimeout(
      () => monitorMasterCompletion(masterComputation._id, computedBy),
      10000
    );

    // Set audit context for successful computation start
    req.auditContext = {
      action: "COMPUTE_ALL_RESULTS",
      resource: "MasterComputation",
      severity: "CRITICAL",
      entityId: masterComputation._id,
      status: "SUCCESS",
      reason: `Results computation started for ${programmeJobs.length} programmes`,
      changes: {
        before: null,
        after: {
          masterComputationId: masterComputation._id,
          totalJobs: programmeJobs.length,
          status: "processing",
          academicBoardDate,
          semester: activeSemester.name,
          departmentsCount: departmentsToProcess.length
        },
        changedFields: ["masterComputation", "programmeJobs"]
      },
      metadata: {
        masterComputationId: masterComputation._id?.toString(),
        computedBy: computedBy?.toString(),
        initiatorRole: req.user.role,
        initiatorName: req.user.name,
        initiatorEmail: req.user.email,
        academicBoardDate,
        totalJobs: programmeJobs.length,
        departmentsCount: departmentsToProcess.length,
        programmesCount: programmeJobs.length,
        activeSemester: {
          id: activeSemester._id?.toString(),
          name: activeSemester.name,
          session: activeSemester.session,
          isRegistrationOpen: activeSemester.isRegistrationOpen
        },
        departmentsProcessed: departmentsToProcess.map(d => ({
          departmentId: d.departmentId?.toString(),
          departmentName: d.departmentName
        })),
        computationConfig: {
          isRetry,
          purpose,
          scope: "programme"
        },
        statusEndpoint: `/api/computation/status/${masterComputation._id}`,
        monitoring: {
          timeoutSet: true,
          timeoutDuration: 10000
        },
        timestamp: new Date().toISOString()
      }
    };

    return buildResponse(res, 202, "Results computation started", {
      masterComputationId: masterComputation._id,
      totalJobs: programmeJobs.length,
      scope: "programme",
      statusEndpoint: `/api/computation/status/${masterComputation._id}`
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    // Set audit context for computation error
    req.auditContext = {
      action: "COMPUTE_ALL_RESULTS",
      resource: "MasterComputation",
      severity: "CRITICAL",
      status: "ERROR",
      reason: "Failed to start results computation",
      metadata: {
        computedBy: req.user?._id?.toString(),
        initiatorRole: req.user?.role,
        initiatorName: req.user?.name,
        academicBoardDate: req.body?.academicBoardDate,
        error: {
          message: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          name: error.name
        },
        requestBody: req.body,
        timestamp: new Date().toISOString()
      }
    };

    throw error;

  } finally {
    session.endSession();
  }
};

/**
 * Monitor master computation completion
 */
export const monitorMasterCompletion = async (masterComputationId, computedBy) => {
  try {
    validateObjectId(masterComputationId)
    const masterComp = await MasterComputation.findById(masterComputationId);
    if (!masterComp) return;

    const checkInterval = setInterval(async () => {
      const updatedMaster = await MasterComputation.findById(masterComputationId);

      if (updatedMaster?.status !== 'processing') {
        clearInterval(checkInterval);

        // Send notification if needed
        if (updatedMaster?.status === 'completed_with_errors') {
          await queueNotification(
            "admin",
            computedBy,
            "computation_completed_with_errors",
            `Computation completed with errors for ${updatedMaster._id}`,
            { masterComputationId: updatedMaster._id }
          );
        }
      }
    }, 30000); // Check every 30 seconds
  } catch (error) {
    console.error("Error monitoring master computation:", error);
  }
};
// GPA Calculation functions
export const calculateSemesterGPA = async (req, res) => {
  try {
    const { studentId, semesterId } = req.params;

    // Get student results
    const results = await Result.find({
      studentId,
      semester: semesterId,
      deletedAt: null
    })
      .populate("courseId", "credits unit")
      .lean();

    const gpaData = GPACalculator.calculateSemesterGPA(results);

    return buildResponse(res, 200, "Semester GPA calculated", {
      studentId,
      semesterId,
      ...gpaData
    });
  } catch (error) {
    return buildResponse(res, 500, "Failed to calculate GPA", null, true, error);
  }

};
export const cancelComputation = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    const { masterComputationId } = req.params;
    const computedBy = req.user._id;

    // Check if queue is available
    if (!departmentQueue) {
      await session.abortTransaction();
      return buildResponse(res, 500, "Job queue not available");
    }

    // Remove queued jobs (if queue methods exist)
    try {
      const waitingJobs = await departmentQueue.getWaiting();
      const activeJobs = await departmentQueue.getActive();

      const jobsToRemove = [...waitingJobs, ...activeJobs].filter(job =>
        job.data.masterComputationId === masterComputationId
      );

      for (const job of jobsToRemove) {
        await job.remove();
      }
    } catch (queueError) {
      console.warn("Could not remove jobs from queue:", queueError);
    }

    // Update master computation
    const masterComputation = await MasterComputation.findById(masterComputationId).session(session);
    if (!masterComputation) {
      await session.abortTransaction();
      return buildResponse(res, 404, "Master computation not found");
    }

    masterComputation.status = "cancelled";
    masterComputation.completedAt = new Date();
    masterComputation.duration = Date.now() - masterComputation.startedAt.getTime();

    await masterComputation.save({ session });
    await session.commitTransaction();

    await queueNotification(
      "admin",
      computedBy,
      "computation_cancelled",
      `Results computation cancelled. ID: ${masterComputationId}`,
      { masterComputationId }
    );

    return buildResponse(res, 200, "Computation cancelled successfully", {
      masterComputationId
    });

  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    return buildResponse(res, 500, "Failed to cancel computation", null, true, error);
  } finally {
    session.endSession();
  }
};
export const clearCarryover = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    const { carryoverId } = req.params;
    const { resultId, remark } = req.body;
    const clearedBy = req.user._id;

    const carryover = await CarryoverCourse.findById(carryoverId).session(session);

    if (!carryover) {
      await session.abortTransaction();
      return buildResponse(res, 404, "Carryover not found");
    }

    if (carryover.cleared) {
      await session.abortTransaction();
      return buildResponse(res, 400, "Carryover is already cleared");
    }

    carryover.cleared = true;
    carryover.clearedAt = new Date();
    carryover.clearedBy = clearedBy;
    carryover.remark = remark;
    if (resultId) carryover.result = resultId;

    await carryover.save({ session });

    // Remove from student's carryover list
    await studentModel.findByIdAndUpdate(
      carryover.student,
      {
        $pull: { carryoverCourses: carryover.course },
        $inc: { totalCarryovers: -1 }
      },
      { session }
    );

    await session.commitTransaction();

    // Notify student
    await queueNotification(
      "student",
      carryover.student,
      "carryover_cleared",
      `Your carryover for ${carryover.course?.courseCode || "course"} has been cleared.`,
      {
        courseId: carryover.course,
        clearedAt: new Date().toISOString()
      }
    );

    return buildResponse(res, 200, "Carryover cleared successfully", carryover);
  } catch (error) {
    await session.abortTransaction();
    return buildResponse(res, 500, "Failed to clear carryover", null, true, error);
  } finally {
    session.endSession();
  }
};
export const getComputationHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [computations, total] = await Promise.all([
      MasterComputation.find(query)
        .populate("computedBy", "name email")
        .populate("semester", "name session")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MasterComputation.countDocuments(query)
    ]);

    return buildResponse(res, 200, "Computation history retrieved", {
      computations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    return buildResponse(res, 500, "Failed to get computation history", null, true, error);
  }
};

export const getComputationStatus = async (req, res) => {
  try {
    const { masterComputationId } = req.params;

    const masterComputation = await MasterComputation.findById(masterComputationId)
      .populate("computedBy", "name email")
      .lean();

    if (!masterComputation) {
      return buildResponse(res, 404, "Computation record not found");
    }

    // Get computation summaries for this master
    const summaries = await ComputationSummary.find({
      masterComputationId: masterComputationId
    })
      .populate("department", "name code")
      .populate("semester", "name session isActive isLocked")
      .lean();

    return buildResponse(res, 200, "Computation status retrieved", {
      masterComputation,
      summaries,
      progress: {
        percentage: masterComputation.totalDepartments > 0
          ? (masterComputation.departmentsProcessed / masterComputation.totalDepartments * 100).toFixed(1)
          : 0,
        processed: masterComputation.departmentsProcessed,
        total: masterComputation.totalDepartments
      }
    });
  } catch (error) {
    console.log(error)
    return buildResponse(res, 500, "Failed to get computation status", null, true, error);
  }
};

export const getDepartmentCarryoverStats = async (req, res) => {
  try {
    const { departmentId, semesterId } = req.params;

    const pipeline = [
      {
        $match: {
          department: new mongoose.Types.ObjectId(departmentId),
          semester: new mongoose.Types.ObjectId(semesterId),
          cleared: false
        }
      },
      {
        $group: {
          _id: "$course",
          totalStudents: { $sum: 1 },
          students: { $push: "$student" }
        }
      },
      {
        $lookup: {
          from: "courses",
          localField: "_id",
          foreignField: "_id",
          as: "courseInfo"
        }
      },
      {
        $unwind: "$courseInfo"
      },
      {
        $project: {
          courseCode: "$courseInfo.courseCode",
          courseTitle: "$courseInfo.title",
          courseUnit: "$courseInfo.unit",
          totalStudents: 1,
          students: "$students"
        }
      },
      {
        $sort: { totalStudents: -1 }
      }
    ];

    const carryoverStats = await CarryoverCourse.aggregate(pipeline);

    // Get department info
    const department = await departmentService.findById(departmentId);
    const semester = await SemesterService.getSemesterById(semesterId);

    return buildResponse(res, 200, "Carryover statistics retrieved", {
      department,
      semester,
      totalCarryoverCourses: carryoverStats.length,
      totalStudentsWithCarryovers: carryoverStats.reduce((sum, stat) => sum + stat.totalStudents, 0),
      courseBreakdown: carryoverStats
    });
  } catch (error) {
    return buildResponse(res, 500, "Failed to get carryover statistics", null, true, error);
  }
};
export const getStudentCarryovers = async (req, res) => {
  try {
    const { studentId } = req.params;

    const carryovers = await CarryoverCourse.find({
      student: studentId,
      cleared: false
    })
      .populate("course", "courseCode title unit")
      .populate("semester", "name session")
      .populate("result", "score grade")
      .sort({ semester: -1, "course.courseCode": 1 });


    const student = await studentService.getStudentById(studentId, {
      populate: {
        path: "departmentId",
        select: "name"
      },
      select: "matricNumber name level departmentId totalCarryovers"
    });

    // Group by semester
    const bySemester = {};
    carryovers.forEach(carryover => {
      const semesterName = carryover.semester?.name || "Unknown";
      if (!bySemester[semesterName]) {
        bySemester[semesterName] = [];
      }
      bySemester[semesterName].push(carryover);
    });

    return buildResponse(res, 200, "Student carryovers retrieved", {
      student,
      totalCarryovers: carryovers.length,
      bySemester,
      allCarryovers: carryovers
    });
  } catch (error) {
    return buildResponse(res, 500, "Failed to get student carryovers", null, true, error);
  }
};

export const retryFailedDepartments = async (req, res) => {
  try {
    const { masterComputationId } = req.params;
    const { departmentIds } = req.body;
    const computedBy = req.user._id;

    const masterComputation = await MasterComputation.findById(masterComputationId);
    if (!masterComputation) {
      return buildResponse(res, 404, "Master computation not found");
    }

    // Get failed department summaries
    const failedSummaries = await ComputationSummary.find({
      masterComputationId: masterComputationId,
      status: { $in: ["failed", "completed_with_errors"] }
    });

    const departmentsToRetry = departmentIds
      ? failedSummaries.filter(s => departmentIds.includes(s.department.toString()))
      : failedSummaries;

    if (departmentsToRetry.length === 0) {
      return buildResponse(res, 400, "No failed departments to retry");
    }

    // Add retry jobs
    const retryJobs = [];
    for (const summary of departmentsToRetry) {
      const uniqueJobId = `retry-${summary.department}-${masterComputationId}-${Date.now()}`;

      const jobData = {
        departmentId: summary.department,
        masterComputationId,
        computedBy,
        jobId: uniqueJobId,
        isRetry: true
      };

      await addDepartmentJob(jobData);
      retryJobs.push(uniqueJobId);
    }

    return buildResponse(res, 200, "Failed departments queued for retry", {
      queued: departmentsToRetry.length,
      retryJobs,
      departments: departmentsToRetry.map(s => s.department)
    });
  } catch (error) {
    return buildResponse(res, 500, "Failed to retry departments", null, true, error);
  }
};

// Export helper functions
export async function handleJobFailure(computationSummary, department, activeSemester, error) {
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
// Re-export preview functions
export { computePreviewResults } from './previewComputation.controller.js';