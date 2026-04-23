import mongoose from "mongoose";
import Agenda from "agenda";
import { v4 as uuidv4 } from 'uuid';

let agendaInstance = null;
let isInitialized = false;

/**
 * Get or create Agenda instance
 * @param {Object} options - Configuration overrides
 * @returns {Promise<Agenda>} Agenda instance
 */
export async function getAgenda(options = {}) {
  if (agendaInstance && isInitialized) {
    return agendaInstance;
  }

  const config = {
    defaultLockLifetime: 600000, // 10 minutes
    maxConcurrency: 5,
    processEvery: "3 seconds",
    defaultConcurrency: 3,
    ...options
  };

  // Ensure MongoDB connection is ready
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB must be connected before initializing Agenda");
  }

  agendaInstance = new Agenda({
    mongo: mongoose.connection,
    db: { collection: "agendaJobs" },
    ...config
  });

  // Set up event listeners
  agendaInstance.on("start", job => {
    // console.log(`[Agenda] Job started: ${job.attrs.name} (${job.attrs._id})`);
  });

  agendaInstance.on("complete", job => {
    // console.log(`[Agenda] Job completed: ${job.attrs.name} (${job.attrs._id})`);
  });

  agendaInstance.on("success", job => {
    // console.log(`[Agenda] Job succeeded: ${job.attrs.name} (${job.attrs._id})`);
  });

  agendaInstance.on("fail", (err, job) => {
    console.error(`[Agenda] Job failed: ${job.attrs.name} (${job.attrs._id}) ->`, err.message);
  });

  agendaInstance.on("error", err => {
    console.error("[Agenda] Agenda error:", err);
  });

  // Wait for Agenda to be ready
  await new Promise((resolve, reject) => {
    agendaInstance.once("ready", () => {
      console.log("[Agenda] Ready and polling database");
      isInitialized = true;
      resolve();
    });
    agendaInstance.once("error", reject);
  });

  return agendaInstance;
}

/**
 * Start Agenda processing
 */
export async function startAgenda() {
  const agenda = await getAgenda();
  await agenda.start();
  console.log("[Agenda] Started processing jobs");
  return agenda;
}

/**
 * Stop Agenda gracefully
 */
export async function stopAgenda() {
  if (agendaInstance) {
    await agendaInstance.stop();
    isInitialized = false;
    console.log("[Agenda] Stopped");
  }
}

export { agendaInstance};