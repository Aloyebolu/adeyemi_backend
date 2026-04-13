import { emitRoom } from "./socketGateway.js";

class LogGateway {

  broadcastBatch(logs) {

    for (const log of logs) {

      // Global log stream
      emitRoom("channel_logs", "log_event", log);

      // Domain stream
      emitRoom(`channel_${log.domain}`, "log_event", log);

      // Scoped computation stream
      if (log.scopeId) {
        emitRoom(`scope_${log.scopeId}`, "log_event", log);
      }

    }

  }

}

export const logGateway = new LogGateway();