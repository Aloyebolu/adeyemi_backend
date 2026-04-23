// Re-export everything from worker
export {
  initWorkers,
  stopWorkers,
  getWorkerStatus,
  queueDepartmentJob,
  cancelDepartmentJob,
  getDepartmentJob,
  queueNotification,
  scheduleNotification,
  getNotificationStatus,
  jobMonitor,
  getWhatsAppWorker
} from "./worker.js";

// Also export agenda config for advanced use cases
export { 
  getAgenda, 
  startAgenda, 
  stopAgenda,
  initWhatsAppWorker,
  startWhatsAppWorker,
  stopWhatsAppWorker 
} from "./agenda.config.js";

// Export WhatsApp service wrapper