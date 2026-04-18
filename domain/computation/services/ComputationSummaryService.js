// computation/services/ComputationSummaryService.js
import { logger } from "#utils/logger.js";
import ComputationSummary from "#domain/computation/models/computation.model.js";
import SummaryListBuilder from "./SummaryListBuilder.js";

class ComputationSummaryService {
    constructor(isPreview = true, purpose = 'preview') {
        this.isPreview = isPreview;
        this.purpose = purpose;
        this.summaryListBuilder = SummaryListBuilder;
    }

    /**
     * Build comprehensive computation summary
     */
    async buildComputationSummary(
        computationCore,
        computationSummary,
        department,
        activeSemester,
        departmentDetails = null,
        programme
    ) {
        const { counters, buffers, gradeDistribution, levelStats } = computationCore;

        // ✅ FIX: Handle missing buffers
        if (!buffers || !buffers.studentSummaries) {
            console.warn('⚠️ Buffers are missing or empty, trying to rebuild...');

            // Try to get data from computationCore if it has the methods
            if (computationCore.prepareSummaryData) {
                const coreData = await computationCore.prepareSummaryData();
                Object.assign(buffers, coreData.buffers || {});
            }
        }

        // Get department details if not provided
        if (!departmentDetails) {
            departmentDetails = await this.getDepartmentLeadershipDetails(
                department,
                activeSemester,
                programme
            );
        }
        // Build key to courses by level
        const keyToCoursesByLevel = await this.buildKeyToCoursesByLevel(
            buffers.allResults || []
        );

        // Group lists by level - try multiple sources
        


        // Build base summary data
        const summaryData = this.summaryListBuilder.buildSummaryStatsByLevel(
            counters,
            gradeDistribution,
            levelStats
        );
        console.log('✅ Base summary data built:', {
            levels: Object.keys(summaryData.summaryOfResultsByLevel || {}),
            gradeDistribution: summaryData.gradeDistribution,
            gradeDistribution2: gradeDistribution
        });

        // Build carryover stats by level


        return {
            // Core summary data
            ...summaryData,
            departmentDetails,

            // Level-based organization
            // studentSummariesByLevel,
            keyToCoursesByLevel,
            failedStudents: buffers.failedStudents || []
        };
    }



    /**
     * Shared method for building key to courses
     */
    async buildKeyToCoursesByLevel(results) {
        return await this.summaryListBuilder.buildKeyToCoursesByLevel(results);
    }

    /**
     * Build carryover stats by level
     */
    buildCarryoverStatsByLevel(groupedLists) {
        const carryoverStatsByLevel = {};

        if (groupedLists.carryoverStudents) {
            for (const [level, students] of Object.entries(groupedLists.carryoverStudents)) {
                carryoverStatsByLevel[level] = {
                    totalCarryovers: students.reduce((sum, student) => sum + (student.courses?.length || 0), 0),
                    affectedStudentsCount: students.length,
                    affectedStudents: students.slice(0, 100)
                };
            }
        }

        return carryoverStatsByLevel;
    }

    /**
     * Get department leadership details (shared for both preview and final)
     */
    async getDepartmentLeadershipDetails(department, semester, programme) {
        // This should be moved from helpers.js to here
        const { getDepartmentLeadershipDetails } = await import("./helpers.js");
        return await getDepartmentLeadershipDetails(department, semester, programme);
    }

    /**
     * Initialize computation summary
     */
    async  initializeComputationSummary(
        departmentId,
        programmeId,
        semesterId,
        masterComputationId,
        computedBy,
        isRetry,
        purpose = "preview",
    ) {
    
        const isPreview = purpose === "preview"
        let computationSummary;
    
        if (isRetry) {
            // Retry should reuse the same master computation
            computationSummary = await ComputationSummary.findOne({
                department: departmentId,
                programme: programmeId,
                semester: semesterId,
                masterComputationId
            });
    
            if (computationSummary) {
                computationSummary.status = "processing";
                computationSummary.retryCount = (computationSummary.retryCount || 0) + 1;
                computationSummary.lastRetryAt = new Date();
    
                await computationSummary.save();
                return computationSummary;
            }
        }
    
        // Normal run: enforce single doc per department+programme+semester+purpose
        computationSummary = await ComputationSummary.findOne({
            department: departmentId,
            programme: programmeId,
            semester: semesterId,
            purpose
        });
    
        if (computationSummary) {
            // Reset existing computation
            computationSummary.masterComputationId = masterComputationId;
            computationSummary.status = "processing";
            computationSummary.computedBy = computedBy;
            computationSummary.startedAt = new Date();
            computationSummary.isPreview = isPreview;
    
            await computationSummary.save();
            return computationSummary;
        }
    
        // Create new one only if none exists
        computationSummary = new ComputationSummary({
            department: departmentId,
            programme: programmeId,
            semester: semesterId,
            masterComputationId,
            purpose,
            isPreview,
            status: "processing",
            computedBy,
            startedAt: new Date()
        });
    
        await computationSummary.save();
        return computationSummary;
    }
}

export default ComputationSummaryService;