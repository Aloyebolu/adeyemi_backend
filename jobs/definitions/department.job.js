import { processDepartmentJob } from "../../domain/computation/controllers/computation.controller.js";
import MasterComputation from "../../domain/computation/models/masterComputation.model.js";
import { DepartmentService } from "../../domain/organization/department/department.service.js";
import { queueNotification } from "../queues/notification.queue.js";

/**
 * Define department computation job
 * @param {Agenda} agenda - Agenda instance
 */
export function defineDepartmentJob(agenda) {
  agenda.define(
    "department-computation",
    {
      priority: "high",
      concurrency: 3,
      lockLifetime: 600000 // 10 minutes
    },
    async (job) => {
      const { departmentId, masterComputationId, computedBy, jobId } = job.attrs.data;

      console.log(`[Department Job] Processing: ${job.attrs._id} for department ${departmentId}`);

      try {
        // Process the computation
        const result = await processDepartmentJob(job.attrs);
        
        // Update the mastercomputation with the result of this department
        await MasterComputation.findByIdAndUpdate(
          masterComputationId,
          {
            $push: {
              "metadata.completedDepartments": {
                department: departmentId,
                jobId,
                completedAt: new Date(),
                resultSummary: result.summary || {}
              }
            }
          }
        );
        console.log(`[Department Job] Completed: ${job.attrs._id}`);

        // Send success notification
        await queueNotification({
          target: "specific",
          recipientId: computedBy,
          templateId: "department-computation-success",
          message: `Computation for department completed successfully`,
          metadata: {
            jobId,
            departmentId,
            masterComputationId,
            status: "success",
            result
          }
        });

        return result;

      } catch (error) {
        console.error(`[Department Job] Failed: ${job.attrs._id}`, error);

        // Update master computation status
        await MasterComputation.findByIdAndUpdate(
          masterComputationId,
          {
            $set: { status: "completed_with_errors" },
            $push: {
              "metadata.failedDepartments": {
                department: departmentId,
                jobId,
                error: error.message,
                failedAt: new Date()
              }
            }
          }
        );

        // Get department name for notification
        let departmentName = departmentId;
        try {
          const department = await DepartmentService.getDepartmentById(departmentId);
          if (department?.name) departmentName = department.name;
        } catch (err) {
          console.warn(`[Department Job] Could not fetch department name: ${err.message}`);
        }

        // Send failure notification
        await queueNotification({
          target: "specific",
          recipientId: computedBy,
          templateId: "department-computation-failed",
          message: `Computation failed for ${departmentName}: ${error.message}`,
          metadata: {
            jobId,
            departmentId,
            departmentName,
            masterComputationId,
            status: "failed",
            error: error.message
          }
        });

        throw error; // Let Agenda handle retry logic
      }
    }
  );

  console.log("[Job Definition] Department computation job defined");
}