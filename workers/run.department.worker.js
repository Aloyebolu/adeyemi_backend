import mongoose from "mongoose";
import Agenda from "agenda";
import dotenv from "dotenv";
// import { processDepartmentJob } from "../domain/result/computation.controller.js";
import { sendNotificationCore } from "../domain/notification/notification.controller.js";
import departmentModel from "../domain/department/department.model.js";
import { processDepartmentJob } from "../domain/computation/workers/computation.controller.js";
import MasterComputation from "../domain/computation/models/masterComputation.model.js";
import { sendEmail } from "../utils/sendEmail.js";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI2;
console.log(MONGO_URI);

async function connectMongo() {
  console.log("[MongoDB] Connecting...");
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("[MongoDB] Connected.");
}

// Create a global agenda instance
let agenda;

async function startWorker() {
  agenda = new Agenda({
    mongo: mongoose.connection,
    db: { collection: "agendaJobs" },
    defaultLockLifetime: 60000,
    maxConcurrency: 5,
    processEvery: "3 seconds",
  });

  agenda.define("heartbeat", async () => {
    console.log("[Heartbeat] Worker alive at", new Date());
  });
  await agenda.every("1000 seconds", "heartbeat");

  console.log(23);

  // Define department computation job
  agenda.define(
    "department-computation",
    { priority: "high", concurrency: 1,lockLifetime: 600000, lockLimit: 1  },
    async job => {
      console.log("[Worker] >>> START job:", job.attrs._id);

      const {
        departmentId,
        masterComputationId,
        computedBy,
        jobId
      } = job.attrs.data;

      try {
        const result = await processDepartmentJob(job.attrs);
        console.log("[Worker] <<< FINISHED job:", job.attrs._id);
        return result;
      } catch (err) {
        console.error("[Worker] Job failed:", job.attrs._id, err);

        // 🔴 UPDATE MASTER COMPUTATION
        await MasterComputation.findByIdAndUpdate(
          masterComputationId,
          {
            $set: {
              status: "completed_with_errors"
            },
            $push: {
              "metadata.failedDepartments": {
                department: departmentId,
                jobId,
                error: err.message,
                failedAt: new Date()
              }
            }
          },
          { new: true }
        );

        // 📨 Notify user
        let depName = departmentId;
        try {
          const dep = await departmentModel.findById(departmentId).lean();
          if (dep?.name) depName = dep.name;
        } catch { }

        await sendNotificationCore({
          target: "specific",
          recipientId: computedBy,
          message: `Computation failed for ${depName} department. 
      Reason: ${err.message}. 
      JobId: (${jobId})`
        });

        throw err; // important: let Agenda mark job as failed
      }
    }
  );


  // Define notification job
  agenda.define(
    "send-notification",
    { priority: "normal", concurrency: 20 },
    async job => {
      const { target, recipientId, templateId, message, metadata } = job.attrs.data;

      console.log(`[Worker] Processing ${target} notification for user: ${recipientId}`);

      try {
        // EMAIL CHANNEL
        if (target === "email") {
          const { to, subject } = metadata;

          if (!to) {
            console.warn(`[Worker] Missing email for user ${recipientId}`);
            return;
          }

          await sendEmail({
            to,
            subject: subject || "Notification",
            html: message,
          });

          console.log(`[Worker] Email sent to ${to}`);
        }

        // WHATSAPP CHANNEL
        if (target === "whatsapp") {
          const { phone } = metadata;

          if (!phone) {
            console.warn(`[Worker] Missing phone for user ${recipientId}`);
            return;
          }

          //  Plug your WhatsApp service here
          // await sendWhatsAppMessage(phone, message);

          console.log(`[Worker] WhatsApp queued/sent to ${phone}`);
        }

        return true;
      } catch (err) {
        console.error(
          `[Worker] Notification failed for ${recipientId}:`,
          err.message
        );

        throw err; // important for retry
      }
    }
  );

  agenda.on("start", job => console.log(`[Agenda] Job started: ${job.attrs.name}`));
  agenda.on("complete", job => console.log(`[Agenda] Job completed: ${job.attrs.name}`));
  agenda.on("fail", (err, job) => console.error(`[Agenda] Job failed: ${job.attrs.name} ->`, err.message));

  await agenda.start();
  console.log("[Worker] Agenda started. Polling every 3s.");

  // Monitor
  setInterval(async () => {
    const pending = await agenda.jobs({ nextRunAt: { $ne: null }, lockedAt: null });
    console.log(`[Monitor] Pending jobs: ${pending.length}`);
  }, 10000);
}

(async () => {
  await connectMongo();
  await startWorker();
  console.log("[Worker] Department worker running standalone!");

})();
