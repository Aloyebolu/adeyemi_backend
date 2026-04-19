// computation/utils/computation.utils.js
import ComputationSummary from "#domain/computation/models/computation.model.js";
import MasterComputation from "#domain/computation/models/masterComputation.model.js";
import departmentModel from "#domain/organization/department/department.model.js";
import departmentService from "#domain/organization/department/department.service.js";
import SemesterService from "#domain/semester/semester.service.js";
import mongoose from "mongoose";

/**
 * Get departments to process
 */
export async function getDepartmentsToProcess(departmentId, session) {
  let departments;

  if (departmentId) {
    const department = await departmentService.getDepartmentById(departmentId, {session})
    if (!department) return [];
    departments = [department];
  } else {
    departments = await departmentModel.find({}).session(session);
    // departments = await departmentService.get
  }

  const departmentsToProcess = [];

  const activeSemester = await SemesterService.getActiveAcademicSemester(); // Department semesters now rely on academic semester for registration control
  for (const dept of departments) {
    if (activeSemester && !activeSemester.isLocked) {
      const hasResults = await mongoose.model('Result').exists({
        courseDepartmentId: dept._id,
        semester: activeSemester._id,
        deletedAt: null,
      }).session(session);

      if (hasResults) {
        departmentsToProcess.push({
          departmentId: dept._id,
          departmentName: dept.name,
          semesterId: activeSemester._id,
          semesterName: activeSemester.name
        });
      }
    }
  }

  return departmentsToProcess;
}


/**
 * Update master computation stats
 */
export async function updateMasterComputationStats(masterComputationId, departmentName, stats, isPreview = false) {
  if (!masterComputationId) return;

  const masterComp = await MasterComputation.findById(masterComputationId);
  if (!masterComp) return;

  // Initialize departmentSummaries if needed
  if (!masterComp.departmentSummaries) {
    masterComp.departmentSummaries = {};
  }

  const wasAlreadyProcessed = masterComp.departmentSummaries[departmentName]?.processed;

  if (!wasAlreadyProcessed) {
    masterComp.departmentsProcessed = (masterComp.departmentsProcessed || 0) + 1;
  }

  masterComp.departmentSummaries[departmentName] = {
    ...stats,
    processed: true,
    updatedAt: new Date(),
    isPreview
  };

  // Check if all departments are processed
  if (masterComp.departmentsProcessed >= masterComp.totalDepartments) {
    const summaries = Object.values(masterComp.departmentSummaries || {});
    
    let totalStudents = 0;
    let totalGPA = 0;
    let totalCarryovers = 0;
    let totalFailedStudents = 0;
    let departmentsWithData = 0;

    for (const dept of summaries) {
      if (dept.studentsProcessed > 0) {
        totalStudents += dept.studentsProcessed;
        totalGPA += (dept.averageGPA || 0);
        totalCarryovers += (dept.carryoverCount || 0);
        totalFailedStudents += (dept.failedStudentsCount || 0);
        departmentsWithData++;
      }
    }

    masterComp.totalStudents = totalStudents;
    masterComp.totalCarryovers = totalCarryovers;
    masterComp.totalFailedStudents = totalFailedStudents;

    if (departmentsWithData > 0) {
      masterComp.overallAverageGPA = parseFloat((totalGPA / departmentsWithData).toFixed(2));
    }

    const hasErrors = summaries.some(dept => dept.failedStudentsCount > 0);
    masterComp.status = hasErrors ? "completed_with_errors" : "completed";
    masterComp.completedAt = new Date();
    masterComp.duration = Date.now() - masterComp.startedAt.getTime();
  }

  await masterComp.save();
}

// Alias for preview version
export const updatePreviewMasterComputationStats = (masterComputationId, departmentName, stats) => 
  updateMasterComputationStats(masterComputationId, departmentName, stats, true);