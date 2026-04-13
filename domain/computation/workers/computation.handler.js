// computation/controllers/computation.handler.js
import ComputationSummaryService from "../services/ComputationSummaryService.js";
import SummaryListBuilder from "../services/SummaryListBuilder.js";
import SemesterService from "../../semester/semester.service.js";
import { updateMasterComputationStats } from "../utils/computation.utils.js";
import ReportService from "../services/ReportService.js";

export class ComputationHandler {
  constructor(options = {}) {
    this.isPreview = options.isPreview || true;
    this.purpose = options.purpose || 'preview';
    this.summaryService = new ComputationSummaryService(this.isPreview, this.purpose);
    this.summaryListBuilder = SummaryListBuilder;
  }

  /**
   * Finalize computation (works for both preview and final)
   */
  async finalizeComputation(
    computationCore,
    computationSummary,
    department,
    programme,
    activeSemester,
    computedBy,
    masterComputationId = null,
    bulkWriter = null
  ) {
    const isFinal = !this.isPreview;
    
    console.log(`🏁 Finalizing ${this.isPreview ? 'PREVIEW' : 'FINAL'} computation for department: ${department.name}, programme: ${programme.name}`);
    
    // Build the unified summary
    const summaryData = await this.summaryService.buildComputationSummary(
      computationCore,
      computationSummary,
      department,
      activeSemester,
      null, // Nullify departmentDetails so that it would get built but the buildDepartmentDetails function
      programme
    );
    
    console.log('✅ Summary data generated:', {
      studentListsLevels: Object.keys(summaryData.studentListsByLevel || {}),
      hasMasterSheetData: !!summaryData.masterSheetData
    });

    // Update computation summary
    if (bulkWriter && isFinal) {
      await bulkWriter.updateComputationSummary(computationSummary._id, summaryData);
    } else {
      // For preview or when not using bulk writer
      // BYPASS
      await this.updateComputationSummaryDirectly(computationSummary, summaryData);
      const size = Buffer.byteLength(JSON.stringify(computationSummary));
      const size2 = Buffer.byteLength(JSON.stringify(summaryData));

console.log("SIZE (bytes):", size, size2);
    }

    // Additional finalization steps for final computation
    if (isFinal) {
      await this.finalizeFinalComputation(
        computationCore,
        computationSummary,
        department,
        activeSemester,
        computedBy,
        masterComputationId,
        bulkWriter
      );
    }

    return summaryData;
  }

  /**
   * Update computation summary directly (for preview)
   */
  async updateComputationSummaryDirectly(computationSummary, summaryData) {
    computationSummary.status = summaryData.failedStudents?.length > 0 
      ? "completed_with_errors" 
      : "completed";
    computationSummary.completedAt = new Date();
    
    if (computationSummary.startedAt) {
      computationSummary.duration = Date.now() - computationSummary.startedAt.getTime();
    }

    // Convert objects to Maps for MongoDB storage
    computationSummary.keyToCoursesByLevel = new Map(Object.entries(summaryData.keyToCoursesByLevel || {}));
    computationSummary.summaryOfResultsByLevel = new Map(Object.entries(summaryData.summaryOfResultsByLevel || {}));
    
    // Set other summary data
    computationSummary.totalStudents = summaryData.totalStudents || 0;
    computationSummary.studentsWithResults = summaryData.studentsWithResults || 0;
    computationSummary.studentsProcessed = summaryData.studentsProcessed || 0;
    computationSummary.averageGPA = summaryData.averageGPA || 0;
    computationSummary.highestGPA = summaryData.highestGPA || 0;
    computationSummary.lowestGPA = summaryData.lowestGPA || 0;
    computationSummary.gradeDistribution = summaryData.gradeDistribution || {};
    computationSummary.departmentDetails = summaryData.departmentDetails;
    

    
    await computationSummary.save();
    console.log(`✅ Updated computation summary ${computationSummary._id}`);
  }

  /**
   * Finalization steps specific to final computation
   */
  async finalizeFinalComputation(
    computationCore,
    computationSummary,
    department,
    activeSemester,
    computedBy,
    masterComputationId,
    bulkWriter
  ) {
    console.log('🔒 Finalizing final computation steps...');
    
    // Lock semester if successful
    if (computationCore.buffers.failedStudents.length === 0) {
      await SemesterService.lockSemester(activeSemester._id);
      console.log(`✅ Locked semester ${activeSemester.name} for ${department.name}`);
    } else {
      console.log(`⚠️ Semester NOT locked due to ${computationCore.buffers.failedStudents.length} failed student(s)`);
    }

    // Update master computation stats
    if (masterComputationId) {
      await updateMasterComputationStats(
        masterComputationId,
        department.name,
        computationCore.getMasterComputationStats(),
        false
      );
    }
  }
}