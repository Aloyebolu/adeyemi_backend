/**
 * This function was introduced mainly to monitor performance during computations.
 */

import { logger } from "./logger.js";

export class Perf {

  static start(label, meta = {}) {
    return {
      label,
      meta,
      start: process.hrtime.bigint()
    };
  }

  static end(timer) {

    const end = process.hrtime.bigint();
    const duration = Number(end - timer.start) / 1e6;

    console.log(`⚡ ${timer.label}: ${duration}ms`)
    // logger.info(`⚡ ${timer.label}: ${duration}ms`, {
    //   ...timer.meta,
    //   data: {
    //     durationMs: duration
    //   }
    // });

    return duration;
  }

}