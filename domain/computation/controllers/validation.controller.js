// controllers/validation.controller.js

import validationService from "../services/validation.service.js";

/**
 * Validate a single programme before computation
 * @route GET /api/validation/programme/:programmeId
 */
export const validateProgramme = async (req, res) => {
    try {
        const { programmeId } = req.params;
        const { 
            maxIssuesPerType = 20,
            includeFullStats = true,
            includeProgrammeDetails = true
        } = req.query;

        // Validate programmeId
        if (!programmeId) {
            return res.status(400).json({
                status: 'error',
                message: 'Programme ID is required',
                timestamp: new Date()
            });
        }

        const options = {
            maxIssuesPerType: parseInt(maxIssuesPerType),
            includeFullStats: includeFullStats === 'true',
            includeProgrammeDetails: includeProgrammeDetails === 'true'
        };

        const result = await validationService.validateProgrammeBeforeComputation(
            programmeId,
            options
        );

        // Check if there was an error in the result
        if (result.error) {
            return res.status(500).json({
                status: 'error',
                message: result.error,
                timestamp: new Date()
            });
        }

        res.status(200).json({
            status: 'success',
            message: 'Validation completed successfully',
            data: result,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error in validateProgramme:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to validate programme',
            timestamp: new Date()
        });
    }
};

/**
 * Validate all programmes
 * @route GET /api/validation/all
 */
export const validateAllProgrammes = async (req, res) => {
    try {
        const {
            maxIssuesPerType = 20,
            programmeIds,
            includeProgrammeDetails = true
        } = req.query;

        const options = {
            maxIssuesPerType: parseInt(maxIssuesPerType),
            includeProgrammeDetails: includeProgrammeDetails === 'true'
        };

        // Parse programmeIds if provided
        if (programmeIds) {
            options.programmeIds = programmeIds.split(',').filter(id => id.trim());
        }

        const result = await validationService.validateAllProgrammes(options);

        res.status(200).json({
            status: 'success',
            message: 'Validation completed successfully',
            data: result,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error in validateAllProgrammes:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to validate programmes',
            timestamp: new Date()
        });
    }
};

/**
 * Quick validation for a programme
 * @route GET /api/validation/quick/:programmeId
 */
export const quickValidate = async (req, res) => {
    try {
        const { programmeId } = req.params;

        if (!programmeId) {
            return res.status(400).json({
                status: 'error',
                message: 'Programme ID is required',
                timestamp: new Date()
            });
        }

        const result = await validationService.quickValidate(programmeId);

        res.status(200).json({
            status: 'success',
            message: result.canCompute ? 'Programme is ready for computation' : 'Validation issues found',
            data: result,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error in quickValidate:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to perform quick validation',
            timestamp: new Date()
        });
    }
};

/**
 * Auto-fix common issues for a programme
 * @route POST /api/validation/auto-fix/:programmeId
 */
export const autoFixIssues = async (req, res) => {
    try {
        const { programmeId } = req.params;
        const { fixDuplicates = true, fixMissingResults = false } = req.body;

        if (!programmeId) {
            return res.status(400).json({
                status: 'error',
                message: 'Programme ID is required',
                timestamp: new Date()
            });
        }

        const options = {
            fixDuplicates: fixDuplicates === true || fixDuplicates === 'true',
            fixMissingResults: fixMissingResults === true || fixMissingResults === 'true'
        };

        const result = await validationService.autoFixIssues(programmeId, options);

        res.status(200).json({
            status: 'success',
            message: result.fixesApplied > 0 
                ? `Successfully applied ${result.fixesApplied} fixes` 
                : 'No fixes were applied',
            data: result,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error in autoFixIssues:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to auto-fix issues',
            timestamp: new Date()
        });
    }
};

/**
 * Get paginated issues for a specific programme and issue type
 * @route GET /api/validation/issues/:programmeId/:issueType
 */
export const getPaginatedIssues = async (req, res) => {
    try {
        const { programmeId, issueType } = req.params;
        const { page = 1, limit = 50 } = req.query;

        // Validate programmeId
        if (!programmeId) {
            return res.status(400).json({
                status: 'error',
                message: 'Programme ID is required',
                timestamp: new Date()
            });
        }

        // Validate issue type
        const validIssueTypes = [
            'unregisteredCourses',
            'borrowedCourseMismatches',
            'semesterMismatches',
            'levelMismatches',
            'duplicateResults',
            'missingCourseInfo',
            'invalidGradeEntries',
            'missingResults'
        ];

        if (!validIssueTypes.includes(issueType)) {
            return res.status(400).json({
                status: 'error',
                message: `Invalid issue type. Must be one of: ${validIssueTypes.join(', ')}`,
                timestamp: new Date()
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                status: 'error',
                message: 'Page must be a positive integer',
                timestamp: new Date()
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 200) {
            return res.status(400).json({
                status: 'error',
                message: 'Limit must be between 1 and 200',
                timestamp: new Date()
            });
        }

        const result = await validationService.getPaginatedIssues(
            programmeId,
            issueType,
            pageNum,
            limitNum
        );

        res.status(200).json({
            status: 'success',
            message: 'Issues retrieved successfully',
            data: result,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error in getPaginatedIssues:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to retrieve paginated issues',
            timestamp: new Date()
        });
    }
};

/**
 * Get validation summary for dashboard
 * @route GET /api/validation/summary
 */
export const getValidationSummary = async (req, res) => {
    try {
        const result = await validationService.validateAllProgrammes({
            maxIssuesPerType: 0, // Only get counts, not actual issues
            includeProgrammeDetails: true
        });

        // Create a simplified summary for dashboard
        const summary = {
            totalProgrammes: result.totalProgrammes,
            programmesWithIssues: result.programmesWithIssues,
            programmesReady: result.totalProgrammes - result.programmesWithIssues,
            totalIssuesAcrossAllProgrammes: result.metadata.totalIssuesAcrossAllProgrammes,
            programmes: result.reports.map(report => ({
                programmeId: report.programmeId,
                programme: report.programme,
                canCompute: report.canCompute,
                totalIssues: report.summary.totalIssues,
                affectedStudents: report.summary.affectedStudentsCount,
                issuesBySeverity: report.summary.issuesBySeverity,
                hasTruncatedIssues: Object.values(report.issueStats).some(stat => stat.truncated)
            }))
        };

        res.status(200).json({
            status: 'success',
            message: 'Validation summary retrieved successfully',
            data: summary,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Error in getValidationSummary:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Failed to retrieve validation summary',
            timestamp: new Date()
        });
    }
};