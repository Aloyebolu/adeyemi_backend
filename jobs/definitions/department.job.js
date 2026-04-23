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
        // 1. Run computation
        const result = await processDepartmentJob(job.attrs);

        // 2. Atomically update master computation
        const update = await MasterComputation.findOneAndUpdate(
          {
            _id: masterComputationId,
            // optional guard to avoid double-processing same job
            "metadata.completedDepartments.jobId": { $ne: jobId }
          },
          {
            $push: {
              "metadata.completedDepartments": {
                department: departmentId,
                jobId,
                completedAt: new Date(),
                resultSummary: result.summary || {}
              }
            },
            $inc: {
              jobsProcessed: 1
            }
          },
          { new: true }
        );

        // If update didn't happen, job was probably already processed (idempotency guard)
        if (!update) {
          console.warn(`[Department Job] Skipped duplicate completion: ${jobId}`);
          return result;
        }

        // 3. Compute progress safely (derived, not stored)
        const total = update.totalJobs || 1;
        const processed = update.jobsProcessed || 0;
        const failed = update.jobsFailed || 0;

        const progress = Math.round(((processed + failed) / total) * 100);

        // 4. Check for completion (only once)
        if (
          processed + failed >= total &&
          !update.completionFinalized
        ) {
          const finalStatus =
            failed > 0 ? "completed_with_errors" : "completed";

          await MasterComputation.updateOne(
            {
              _id: masterComputationId,
              completionFinalized: false
            },
            {
              $set: {
                status: finalStatus,
                completedAt: new Date(),
                duration: Date.now() - new Date(update.startedAt).getTime(),
                completionFinalized: true
              }
            }
          );

          console.log(`[Master Computation] Finalized: ${masterComputationId}`);
        }

        console.log(
          `[Department Job] Completed: ${job.attrs._id} (${processed + failed}/${total})`
        );

        // 5. Send notification
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

        // 6. Atomic failure update
        await MasterComputation.findOneAndUpdate(
          {
            _id: masterComputationId,
            "metadata.failedDepartments.jobId": { $ne: jobId }
          },
          {
            $push: {
              "metadata.failedDepartments": {
                department: departmentId,
                jobId,
                error: error.message,
                failedAt: new Date()
              }
            },
            $inc: {
              jobsFailed: 1
            }
          }
        );

        // Optional: same completion check logic can be repeated here if needed

        // 7. Notify failure
        await queueNotification({
          target: "specific",
          recipientId: computedBy,
          templateId: "department-computation-failed",
          message: `Computation failed`,
          metadata: {
            jobId,
            departmentId,
            masterComputationId,
            status: "failed",
            error: error.message
          }
        });

        throw error;
      }
    }
  );

  console.log("[Job Definition] Department computation job defined");
}