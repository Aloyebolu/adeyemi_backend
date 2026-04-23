import { WhatsAppWorkerService } from "#domain/notification/services/whatsapp/whatsapp.service.js";
import { 
  getAgenda, 
  startAgenda
} from "./agenda.config.js";
import { defineDepartmentJob } from "./definitions/department.job.js";
import { defineNotificationJob } from "./definitions/notification.job.js";
import { jobMonitor } from "./services/job-monitor.service.js";

let isWorkerStarted = false;
let whatsAppWorkerInstance = null;

// Start WhatsApp worker
function startWhatsAppWorker() {
  const workerId = `worker-${Date.now()}`;
  const worker = new WhatsAppWorkerService(workerId);
  worker.start();
  return worker;
}

// Stop WhatsApp worker
async function stopWhatsAppWorker() {
  if (whatsAppWorkerInstance) {
    await whatsAppWorkerInstance.cleanup();
    whatsAppWorkerInstance = null;
  }
}

// Get WhatsApp worker instance
export function getWhatsAppWorker() {
  return whatsAppWorkerInstance;
}

export async function initWorkers(options = {}) {
  if (isWorkerStarted) {
    console.log("[Worker] Workers already initialized");
    return {
      agenda: await getAgenda(),
      whatsapp: whatsAppWorkerInstance
    };
  }

  const {
    enableMonitoring = true,
    monitoringInterval = 30000,
    heartbeatInterval = "10 seconds",
    enableWhatsApp = true
  } = options;

  try {
    const agenda = await getAgenda();

    defineDepartmentJob(agenda);
    defineNotificationJob(agenda);

    await agenda.every(heartbeatInterval, "heartbeat");

    if (enableWhatsApp) {
      whatsAppWorkerInstance = startWhatsAppWorker();
    }

    await startAgenda();

    if (enableMonitoring) {
      jobMonitor.startMonitoring(monitoringInterval);
    }

    isWorkerStarted = true;
    console.log("[Worker] All workers initialized successfully");

    setupGracefulShutdown();

    return { agenda, whatsapp: whatsAppWorkerInstance };

  } catch (error) {
    console.error("[Worker] Failed to initialize workers:", error);
    throw error;
  }
}

function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\n[Worker] Received ${signal}, shutting down...`);
    
    try {
      jobMonitor.stopMonitoring();
      
      const agenda = await getAgenda();
      await agenda.stop();
      
      await stopWhatsAppWorker();
      
      setTimeout(() => {
        console.log("[Worker] Shutdown complete");
        process.exit(0);
      }, 1000);
      
    } catch (error) {
      console.error("[Worker] Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

export async function getWorkerStatus() {
  const agenda = await getAgenda();
  const stats = await jobMonitor.getStats();
  
  return {
    isRunning: isWorkerStarted,
    agendaReady: !!agenda,
    whatsappStatus: whatsAppWorkerInstance ? await whatsAppWorkerInstance.getStatus() : 'not initialized',
    stats,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  };
}

export async function stopWorkers() {
  jobMonitor.stopMonitoring();
  
  const agenda = await getAgenda();
  await agenda.stop();
  
  await stopWhatsAppWorker();
  
  isWorkerStarted = false;
  console.log("[Worker] All workers stopped");
}

export { queueDepartmentJob, cancelDepartmentJob, getDepartmentJob } from "./queues/department.queue.js";
export { queueNotification, scheduleNotification, getNotificationStatus } from "./queues/notification.queue.js";
export { jobMonitor };