import departmentService from "#domain/organization/department/department.service.js";
import AppError from "#shared/errors/AppError.js";

/**
 * Script to recalculate results for one or multiple departments
 * Uses the existing job queue system for reliable processing
 */
export default {
    name: "recompute-department-results",
    description: "Recalculate results for specific departments with job queue support",

    /**
     * Execute the department recalculation script
     * @param {Object} deps - Dependencies
     * @param {Object} deps.models - Database models
     * @param {Object} deps.services - Service layer (includes addDepartmentJob)
     * @param {Object} params - Script parameters
     * @param {string|string[]} params.departmentId - Single department ID or array of department IDs
     * @param {string} [params.programmeId] - Optional programme ID to filter
     * @param {string} params.purpose - Reason for recalculation
     * @param {boolean} params.isPreview - Whether this is a preview run
     * @param {boolean} params.isFinal - Whether this is final computation
     * @param {boolean} params.isRetry - Whether this is a retry attempt
     * @param {number} params.priority - Job priority (1-10, 1 being highest)
     * @returns {Promise<Object>} Execution result
     */
    run: async (deps, params) => {
        const { models, services } = deps;
        const {
            departmentId,
            programmeId,
            purpose = "Manual recalculation",
            isPreview = false,
            isFinal = true,
            isRetry = false,
            priority = 1
        } = params;

        // Validate required parameters
        if (!departmentId) {
            throw new AppError("departmentId is required (can be string or array)");
        }

        if (!services?.addDepartmentJob) {
            throw new AppError("addDepartmentJob service not available");
        }

        // Normalize department IDs to array
        const inputDepartments = Array.isArray(departmentId) ? departmentId : [departmentId];

        const departmentIds = [];

        for (const dep of inputDepartments) {
            // if it's a 3-letter code (string length 3 and not numeric)
            if (typeof dep === "string" && dep.length === 3 && isNaN(dep)) {
                const department = await departmentService.getDepartmentByCode(dep);

                if (!department) {
                    throw new Error(`Department with code ${dep} not found`);
                }

                departmentIds.push(department.id);
            } else {
                // assume it's already an ID
                departmentIds.push(dep);
            }
        }


        if (departmentIds.length === 0) {
            throw new AppError("At least one department ID is required");
        }

        // Validate departments exist
        const departments = await models.Department.find({
            _id: { $in: departmentIds }
        });

        if (departments.length !== departmentIds.length) {
            const foundIds = departments.map(d => d._id.toString());
            const missingIds = departmentIds.filter(
                id => !foundIds.includes(id.toString())
            );
            throw new AppError(`Departments not found: ${missingIds.join(', ')}`);
        }

        // Create master computation record
        const masterComputation = await models.MasterComputation.create({
            initiatedBy: "system-script",
            purpose,
            departments: departmentIds,
            programme: programmeId,
            isPreview,
            isFinal,
            createdAt: new Date()
        });

        const computedBy = "system-script";
        const results = {
            jobsCreated: [],
            failed: [],
            summary: {
                totalDepartments: departmentIds.length,
                successful: 0,
                failed: 0
            }
        };

        // Create jobs for each department
        for (const deptId of departmentIds) {
            try {
                const uniqueJobId = `dept-recalc-${deptId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                // Find all programmes for this department if programmeId not specified
                const programmeIds = programmeId
                    ? [programmeId]
                    : await getDepartmentProgrammes(models, deptId);

                for (const progId of programmeIds) {
                    try {
                        // Call the existing job creation function
                        await services.addDepartmentJob({
                            scope: "programme",
                            departmentId: deptId,
                            programmeId: progId,
                            masterComputationId: masterComputation._id,
                            computedBy,
                            jobId: uniqueJobId,
                            priority,
                            isRetry,
                            isPreview,
                            purpose,
                            isFinal
                        });

                        results.jobsCreated.push({
                            departmentId: deptId,
                            programmeId: progId,
                            jobId: uniqueJobId,
                            status: "queued"
                        });

                        results.summary.successful++;
                    } catch (error) {
                        const failure = {
                            departmentId: deptId,
                            programmeId: progId,
                            error: error.message
                        };
                        results.failed.push(failure);
                        results.summary.failed++;

                        console.error(`Failed to create job for dept ${deptId}, prog ${progId}:`, error);
                    }
                }
            } catch (error) {
                const failure = {
                    departmentId: deptId,
                    error: error.message
                };
                results.failed.push(failure);
                results.summary.failed++;
            }
        }

        // Update master computation with results
        await models.MasterComputation.findByIdAndUpdate(
            masterComputation._id,
            {
                jobsCreated: results.jobsCreated.length,
                jobsFailed: results.failed.length,
                completedAt: new Date()
            }
        );

        return {
            summary: {
                masterComputationId: masterComputation._id,
                totalJobsCreated: results.jobsCreated.length,
                totalJobsFailed: results.failed.length,
                departmentsProcessed: departmentIds.length,
                successfulDepartments: results.summary.successful,
                failedDepartments: results.summary.failed,
                isPreview,
                isFinal
            },
            details: {
                jobs: results.jobsCreated,
                failures: results.failed,
                departments: departments.map(d => ({
                    id: d._id,
                    name: d.name,
                    code: d.code
                }))
            },
            message: `Created ${results.jobsCreated.length} recalculation jobs across ${departmentIds.length} departments`
        };
    }
};

/**
 * Helper function to get all programmes for a department
 * @param {Object} models - Database models
 * @param {string} departmentId - Department ID
 * @returns {Promise<string[]>} Array of programme IDs
 */
async function getDepartmentProgrammes(models, departmentId) {
    try {
        const programmes = await models.Programme.find({
            department: departmentId,
            isActive: true
        }).select('_id');

        return programmes.map(p => p._id.toString());
    } catch (error) {
        console.error(`Error fetching programmes for department ${departmentId}:`, error);
        return []; // Return empty array if no programmes found
    }
}