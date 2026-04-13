import { logger } from "./logger.js";

export function captureConsoleLogs( scopeId) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    const message = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");

    logger.info(message, {
      scopeId,
      data: { level: "log" }
    });

    originalLog.apply(console, args);
  };

  console.warn = (...args) => {
    const message = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");

    logger.warn(message, {
      scopeId,
      data: { level: "warn" }
    });

    originalWarn.apply(console, args);
  };

  console.error = (...args) => {
    const message = args.map(a => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ");

    logger.error(message, {
      scopeId,
      data: { level: "error" }
    });

    originalError.apply(console, args);
  };

  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  };
}