import AuditLogService from "./auditlog.service.js";
import AuditUtil from "./auditlog.util.js";
import { AsyncLocalStorage } from "node:async_hooks";

// Constants
const READ_KEYS = ["fields", "search_term", "filters", "page", "pageSize", "limit", "sort", "sortOrder", "sortField", "populate", "select", "extras"];
const REQUEST_INTENT = {
  READ: "READ",
  WRITE: "WRITE",
  BLOCKED: "BLOCKED"
};

// Rate limiting constants
const RATE_LIMITS = {
  READ: {
    maxRequests: 100,
    windowMs: 10 * 60 * 1000, // 10 minutes
    softBlockThreshold: 80,
    hardBlockThreshold: 500
  },
  VIOLATION: {
    maxRequests: 5,
    windowMs: 10 * 60 * 1000 // 10 minutes
  }
};

// AsyncLocalStorage for thread-safe request context
export const auditStore = new AsyncLocalStorage();

// Helper function to detect mixed intent in request body
function detectMixedIntent(body = {}) {
  if (!body || typeof body !== 'object') return false;

  const keys = Object.keys(body);
  if (keys.length === 0) return false;

  const hasRead = keys.some(k => READ_KEYS.includes(k));
  const hasOther = keys.some(k => !READ_KEYS.includes(k));

  return hasRead && hasOther;
}

// Rate limiting helper with Redis
async function checkRateLimit(key, limitConfig) {
  if (!global.redis) {
    // console.warn("Redis not available for rate limiting");
    return { allowed: true, count: 0, remaining: limitConfig.maxRequests };
  }

  try {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / limitConfig.windowMs)}`;

    const count = await global.redis.incr(windowKey);
    if (count === 1) {
      await global.redis.expire(windowKey, Math.ceil(limitConfig.windowMs / 1000));
    }

    return {
      allowed: count <= limitConfig.maxRequests,
      count,
      remaining: Math.max(0, limitConfig.maxRequests - count)
    };
  } catch (error) {
    console.error("Rate limit check error:", error);
    return { allowed: true, count: 0, remaining: limitConfig.maxRequests };
  }
}

// Violation tracking helper
async function registerViolation({ userId, ip, intent }) {
  if (!global.redis) {
    console.warn("Redis not available for violation tracking");
    return 1;
  }

  try {
    const key = userId ? `audit:violations:user:${userId}` : `audit:violations:ip:${ip}`;
    const count = await global.redis.incr(key);

    if (count === 1) {
      await global.redis.expire(key, 600); // 10 minutes
    }

    // Log critical violation
    if (count >= RATE_LIMITS.VIOLATION.maxRequests) {
      await AuditLogService.logOperation({
        userId: userId || "anonymous",
        action: "RATE_LIMIT_EXCEEDED",
        severity: "CRITICAL",
        entity: "SYSTEM",
        reason: `${intent} rate limit exceeded`,
        context: {
          ip,
          violationCount: count,
          intent
        },
        metadata: {
          blocked: true,
          userId,
          ip
        }
      });
    }

    return count;
  } catch (error) {
    console.error("Violation tracking error:", error);
    return 1;
  }
}

/**
 * Main audit middleware that auto-captures ALL HTTP requests
 * with security-first intent detection
 */
const auditMiddleware = (options = {}) => {
  const config = {
    enabled: true,
    skipMethods: ["GET", "OPTIONS", "HEAD"], // For logging only, not security
    skipPaths: [
      "/health",
      "/favicon.ico",
      "/public/",
      "/static/",
      "/audit" // Don't audit audit endpoints themselves
    ],
    logRequestBody: false,
    logQueryParams: false,
    sensitiveFields: ["password", "token", "secret", "creditCard", "ssn"],
    ...options
  };

  return async (req, res, next) => {
    const startTime = Date.now();

    // Generate request ID if not exists
    if (!req.requestId) {
      req.requestId = AuditUtil.generateRequestId();
      res.setHeader("X-Request-ID", req.requestId);
    }

    // 🔐 STEP 1: ALWAYS DETECT INTENT (Security comes first)
    // Default intent based on HTTP method
    req._intent = req.method === "GET" ? REQUEST_INTENT.READ : REQUEST_INTENT.WRITE;

    // Enhanced intent detection for POST requests with body
    if (req.method === "POST" && req.body && Object.keys(req.body).length > 0) {
      // Check for mixed intent (security violation)
      if (detectMixedIntent(req.body)) {
        req._intent = REQUEST_INTENT.BLOCKED;

        const violationCount = await registerViolation({
          userId: req.user?._id,
          ip: req.ip,
          intent: "MIXED_INTENT"
        });

        // Log the violation
        await AuditLogService.logOperation({
          userId: req.user?._id || "anonymous",
          action: "SUSPICIOUS_REQUEST",
          severity: "CRITICAL",
          entity: "HTTP",
          reason: "Mixed read/write request payload detected",
          context: {
            endpoint: req.originalUrl,
            method: req.method,
            requestId: req.requestId,
            bodyKeys: Object.keys(req.body),
            ip: req.ip,
            violationCount
          },
          status: "BLOCKED"
        });

        return res.status(400).json({
          success: false,
          error: "INVALID_REQUEST_STRUCTURE",
          message: "Cannot mix read parameters (filters, fields) with write parameters in same request",
          requestId: req.requestId
        });
      }

      // Check for pure read intent in POST body
      const keys = Object.keys(req.body);
      const hasRead = keys.some(k => READ_KEYS.includes(k));
      const hasOther = keys.some(k => !READ_KEYS.includes(k));

      if (hasRead && !hasOther) {
        req._intent = REQUEST_INTENT.READ;
        req._skipAuditLog = true;
        // 🔐 Apply rate limiting for READ intents
        const rateLimitKey = req.user?._id ? `read:user:${req.user._id}` : `read:ip:${req.ip}`;
        const rateLimitResult = await checkRateLimit(rateLimitKey, RATE_LIMITS.READ);

        if (!rateLimitResult.allowed) {
          await AuditLogService.logOperation({
            userId: req.user?._id || "anonymous",
            action: "RATE_LIMIT_EXCEEDED",
            severity: "HIGH",
            entity: "HTTP",
            reason: `READ intent rate limit exceeded (${rateLimitResult.count} requests)`,
            context: {
              endpoint: req.originalUrl,
              method: req.method,
              requestId: req.requestId,
              ip: req.ip,
              count: rateLimitResult.count
            },
            status: "BLOCKED"
          });

          return res.status(429).json({
            success: false,
            error: "RATE_LIMIT_EXCEEDED",
            message: "Too many read requests",
            retryAfter: Math.ceil(RATE_LIMITS.READ.windowMs / 1000),
            requestId: req.requestId
          });
        }

        // Soft block warning
        if (rateLimitResult.count >= RATE_LIMITS.READ.softBlockThreshold) {
          await AuditLogService.logOperation({
            userId: req.user?._id || "anonymous",
            action: "RATE_LIMIT_WARNING",
            severity: "MEDIUM",
            entity: "HTTP",
            reason: `Approaching READ intent rate limit (${rateLimitResult.count}/${RATE_LIMITS.READ.maxRequests})`,
            context: {
              endpoint: req.originalUrl,
              method: req.method,
              requestId: req.requestId,
              ip: req.ip,
              count: rateLimitResult.count,
              remaining: rateLimitResult.remaining
            }
          });
        }
      }
    }

    // 🔐 Store intent in AsyncLocalStorage for DB hooks
    const storeContext = {
      userId: req.user?._id,
      requestId: req.requestId,
      ip: req.ip,
      intent: req._intent,
      originalUrl: req.originalUrl,
      method: req.method,
      userAgent: req.headers["user-agent"]
    };
    // Run all subsequent code in AsyncLocalStorage context
    return auditStore.run(storeContext, async () => {
      // 📊 STEP 2: SKIP LOGGING FOR CERTAIN METHODS/PATHS (Logging only)
      if (!config.enabled) return next();
      
      // Skip logging for specified HTTP methods
      if (config.skipMethods.includes(req.method)) {
        return next();
      }
      
      // Skip logging for specified paths
      if (config.skipPaths.some(path => req.originalUrl.includes(path))) {
        return next();
      }

      // Skip logging for non-auditable endpoints
      if (!AuditUtil.shouldAuditEndpoint(req.originalUrl, config.skipPaths)) {
        return next();
      }

      // Store original send function
      const originalSend = res.send;
      let responseBody;

      res.send = function (body) {
        responseBody = body;
        return originalSend.call(this, body);
      };

      // Capture response completion for logging
      res.on("finish", async () => {
        try {
           if (req._skipAuditLog) {
            // NOTE
            // console.log("Skipping audit log")
            return
          };
          // Don't audit audit endpoints themselves
          if (req.originalUrl.includes("audit")) return;

          await AuditLogService.logHttpRequest({
            req,
            res,
            responseTime: Date.now() - startTime,
            responseBody
          });

        } catch (error) {
          console.error("Audit middleware error:", error);
          // Don't break the application
        }
      });

      next();
    });
  };
};

/**
 * Special middleware for authentication routes
 */
export const authAuditMiddleware = (req, res, next) => {
  const startTime = Date.now();

  if (!req.requestId) {
    req.requestId = AuditUtil.generateRequestId();
    res.setHeader("X-Request-ID", req.requestId);
  }

  const originalSend = res.send;
  let responseBody;

  res.send = function (body) {
    responseBody = body;
    return originalSend.call(this, body);
  };

  res.on("finish", async () => {
    try {
      // Check if this is an auth endpoint
      const isAuthEndpoint = req.originalUrl.includes("/auth") ||
        req.originalUrl.includes("/signin") ||
        req.originalUrl.includes("/signup") ||
        req.originalUrl.includes("/login") ||
        req.originalUrl.includes("/register");

      if (!isAuthEndpoint) return;

      let userId = null;
      let action = "LOGIN";
      let status = "SUCCESS";
      let reason = "";
      let parsedResponse = null;

      // Parse response to determine success/failure
      try {
        parsedResponse = typeof responseBody === "string" ? JSON.parse(responseBody) : responseBody;

        console.debug("Parsed auth response:", parsedResponse);
        if (parsedResponse?.status === "fail" || parsedResponse?.error) {
          action = "LOGIN_FAILED";
          status = "FAILURE";
          reason = parsedResponse?.message || parsedResponse?.error || "Authentication failed";
        } else if (parsedResponse?.data?.user?.id) {
          userId = parsedResponse.data.user.id;
          action = req.originalUrl.includes("/signup") || req.originalUrl.includes("/register")
          ? "CREATE"
          : "LOGIN";
          reason = action === "CREATE" ? "User registered" : "Login successful";
        } else if (parsedResponse?.data?.user?.access_token || parsedResponse?.user?.access_token) {
          action = "LOGIN";
          reason = "Login successful";
          if (parsedResponse?.data?.user?.id) {
            userId = parsedResponse.data.user.id;
          } else if (parsedResponse?.user?.id) {
            userId = parsedResponse.user.id;
          }
        }
      } catch (e) {
        console.debug("Could not parse auth response:", e.message);
      }

      // For logout endpoints
      if (req.originalUrl.includes("/logout") || req.originalUrl.includes("/signout")) {
        action = "LOGOUT";
        reason = "User logged out";
        userId = req.user?._id || null;
        status = "SUCCESS";
      }

      // Log the auth event
      await AuditLogService.logAuthEvent({
        userId : userId || req.auditContext.userId,
        action,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        status,
        reason,
        context: {
          endpoint: req.originalUrl,
          method: req.method,
          requestId: req.requestId,
          responseTime: Date.now() - startTime,
          statusCode: res.statusCode
        }
      });

    } catch (error) {
      console.error("Auth audit middleware error:", error.message);
    }
  });

  next();
};

/**
 * Enhanced database hook middleware with intent validation
 */
export const dbAuditMiddleware = (schema, options = {}) => {
  const { modelName, sensitiveFields = [] } = options;

  // Helper to get audit context from AsyncLocalStorage
  const getAuditContext = () => {
    const store = auditStore.getStore();
    if (store) {
      return store;
    }

    // Fallback to global context (for background jobs, etc.)
    return {
      userId: "system",
      requestId: `db_${Date.now()}`,
      ipAddress: "0.0.0.0",
      intent: REQUEST_INTENT.WRITE,
      originalUrl: "database",
      method: "INTERNAL",
      userAgent: "mongoose"
    };
  };

  // Hook into document save (create/update)
  schema.post("save", async function (doc) {
    try {
      const context = getAuditContext();
      const isNew = doc.isNew;
      const action = isNew ? "CREATE" : "UPDATE";

      // 🔐 INTENT VALIDATION: Detect write operations during READ intent
      if (context.intent === REQUEST_INTENT.READ && !isNew) {
        console.error(`🚨 SECURITY: Write operation (${action}) attempted during READ intent`);

        await AuditLogService.logOperation({
          userId: context.userId,
          action: "SUSPICIOUS_DB_WRITE",
          severity: "CRITICAL",
          entity: modelName || doc.constructor.modelName,
          entityId: doc._id,
          reason: `Write operation attempted during READ intent: ${action}`,
          context: {
            endpoint: context.originalUrl,
            method: context.method,
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            detectedIntent: context.intent,
            attemptedAction: action
          },
          metadata: {
            operation: isNew ? "insert" : "update",
            collection: doc.collection.name,
            modifiedPaths: doc.modifiedPaths?.() || [],
            intentViolation: true
          }
        });
      }

      // Prepare data changes for updates
      let changes = {};
      if (!isNew && doc.modifiedPaths && doc.modifiedPaths().length > 0) {
        const modifiedPaths = doc.modifiedPaths();
        changes = {
          changedFields: modifiedPaths,
          before: {},
          after: {}
        };

        if (doc._originalDoc) {
          changes.before = AuditUtil.sanitizeData(doc._originalDoc, sensitiveFields);
        }

        changes.after = AuditUtil.sanitizeData(doc.toObject(), sensitiveFields);
      }

      // Determine severity based on intent
      const severity = context.intent === REQUEST_INTENT.READ ? "CRITICAL" :
        action === "DELETE" ? "HIGH" : "MEDIUM";

      await AuditLogService.logOperation({
        userId: context.userId,
        action,
        entity: modelName || doc.constructor.modelName,
        entityId: doc._id,
        newData: AuditUtil.sanitizeData(doc.toObject(), sensitiveFields),
        changes: Object.keys(changes).length > 0 ? changes : undefined,
        context: {
          endpoint: context.originalUrl,
          method: isNew ? "POST" : "PATCH",
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          intent: context.intent
        },
        reason: isNew ? `New ${modelName} created` : `${modelName} updated`,
        severity,
        metadata: {
          operation: isNew ? "insert" : "update",
          collection: doc.collection.name,
          intent: context.intent,
          intentViolation: context.intent === REQUEST_INTENT.READ
        }
      });

    } catch (error) {
      console.error("DB audit middleware error (save):", error.message);
    }
  });

  // Hook into document remove
  schema.post("remove", async function (doc) {
    try {
      const context = getAuditContext();

      // 🔐 INTENT VALIDATION
      if (context.intent === REQUEST_INTENT.READ) {
        console.error(`🚨 SECURITY: DELETE operation attempted during READ intent`);

        await AuditLogService.logOperation({
          userId: context.userId,
          action: "SUSPICIOUS_DB_DELETE",
          severity: "CRITICAL",
          entity: modelName || doc.constructor.modelName,
          entityId: doc._id,
          reason: "DELETE operation attempted during READ intent",
          context: {
            endpoint: context.originalUrl,
            method: context.method,
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            detectedIntent: context.intent,
            attemptedAction: "DELETE"
          },
          metadata: {
            operation: "delete",
            collection: doc.collection.name,
            intentViolation: true
          }
        });
      }

      await AuditLogService.logOperation({
        userId: context.userId,
        action: "DELETE",
        entity: modelName || doc.constructor.modelName,
        entityId: doc._id,
        oldData: AuditUtil.sanitizeData(doc.toObject(), sensitiveFields),
        context: {
          endpoint: context.originalUrl,
          method: "DELETE",
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          intent: context.intent
        },
        reason: `${modelName} deleted`,
        severity: "HIGH",
        metadata: {
          operation: "delete",
          collection: doc.collection.name,
          intent: context.intent,
          intentViolation: context.intent === REQUEST_INTENT.READ
        }
      });

    } catch (error) {
      console.error("DB audit middleware error (remove):", error.message);
    }
  });

  // Hook into findOneAndUpdate
  schema.post("findOneAndUpdate", async function (doc) {
    if (!doc) return;

    try {
      const context = getAuditContext();

      // 🔐 INTENT VALIDATION
      if (context.intent === REQUEST_INTENT.READ) {
        console.error(`🚨 SECURITY: findOneAndUpdate attempted during READ intent`);

        await AuditLogService.logOperation({
          userId: context.userId,
          action: "SUSPICIOUS_DB_UPDATE",
          severity: "CRITICAL",
          entity: modelName || doc.constructor.modelName,
          entityId: doc._id,
          reason: "findOneAndUpdate attempted during READ intent",
          context: {
            endpoint: context.originalUrl,
            method: context.method,
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            detectedIntent: context.intent,
            attemptedAction: "UPDATE"
          },
          metadata: {
            operation: "findOneAndUpdate",
            collection: doc.collection.name,
            intentViolation: true
          }
        });
      }

      await AuditLogService.logOperation({
        userId: context.userId,
        action: "UPDATE",
        entity: modelName || doc.constructor.modelName,
        entityId: doc._id,
        context: {
          endpoint: context.originalUrl,
          method: "PUT",
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          intent: context.intent
        },
        reason: `${modelName} updated via findOneAndUpdate`,
        severity: context.intent === REQUEST_INTENT.READ ? "CRITICAL" : "MEDIUM",
        metadata: {
          operation: "findOneAndUpdate",
          collection: doc.collection.name,
          intent: context.intent,
          intentViolation: context.intent === REQUEST_INTENT.READ
        }
      });
    } catch (error) {
      console.error("DB audit middleware error (findOneAndUpdate):", error.message);
    }
  });

  // Hook into findOneAndDelete
  schema.post("findOneAndDelete", async function (doc) {
    if (!doc) return;

    try {
      const context = getAuditContext();

      // 🔐 INTENT VALIDATION
      if (context.intent === REQUEST_INTENT.READ) {
        console.error(`🚨 SECURITY: findOneAndDelete attempted during READ intent`);

        await AuditLogService.logOperation({
          userId: context.userId,
          action: "SUSPICIOUS_DB_DELETE",
          severity: "CRITICAL",
          entity: modelName || doc.constructor.modelName,
          entityId: doc._id,
          reason: "findOneAndDelete attempted during READ intent",
          context: {
            endpoint: context.originalUrl,
            method: context.method,
            requestId: context.requestId,
            ipAddress: context.ipAddress,
            detectedIntent: context.intent,
            attemptedAction: "DELETE"
          },
          metadata: {
            operation: "findOneAndDelete",
            collection: doc.collection.name,
            intentViolation: true
          }
        });
      }

      await AuditLogService.logOperation({
        userId: context.userId,
        action: "DELETE",
        entity: modelName || doc.constructor.modelName,
        entityId: doc._id,
        oldData: AuditUtil.sanitizeData(doc.toObject(), sensitiveFields),
        context: {
          endpoint: context.originalUrl,
          method: "DELETE",
          requestId: context.requestId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          intent: context.intent
        },
        reason: `${modelName} deleted via findOneAndDelete`,
        severity: "HIGH",
        metadata: {
          operation: "findOneAndDelete",
          collection: doc.collection.name,
          intent: context.intent,
          intentViolation: context.intent === REQUEST_INTENT.READ
        }
      });
    } catch (error) {
      console.error("DB audit middleware error (findOneAndDelete):", error.message);
    }
  });

  return schema;
};

/**
 * Middleware to set up AsyncLocalStorage context
 * (Optional - auditMiddleware already does this)
 */
export const setupAuditContext = (req, res, next) => {
  // Context is already set in auditMiddleware via auditStore.run()
  // This is kept for backward compatibility
  next();
};

// Export constants for use in other modules
export { REQUEST_INTENT, READ_KEYS, RATE_LIMITS };

export default auditMiddleware;