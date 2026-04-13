import { logGateway } from "../domain/computation/realtime/logGateway.js";

class Logger {

  constructor() {
    this.queue = [];
    this.processing = false;
  }

  log(level, message, meta = {}) {

    const logEntry = {
      timestamp: Date.now(),
      level,
      message,
      domain: meta?.domain || "system",
      scopeId: meta?.scopeId || null,
      data: meta?.data || null
    };

    console.debug(logEntry.message)
    this.queue.push(logEntry);

    this.processQueue();

    return logEntry;
  }

  processQueue() {

    if (this.processing) return;

    this.processing = true;

    setImmediate(() => {

      const logs = this.queue.splice(0);

      if (logs.length > 0) {
        logGateway.broadcastBatch(logs);
      }

      this.processing = false;

      if (this.queue.length > 0) {
        this.processQueue();
      }

    });

  }

  info(msg, meta) { return this.log("info", msg, meta); }
  warn(msg, meta) { return this.log("warn", msg, meta); }
  error(msg, meta) { return this.log("error", msg, meta); }
  debug(msg, meta) { return this.log("debug", msg, meta); }

}

export const logger = new Logger();