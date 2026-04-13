import mongoose from "mongoose";

/**
 * Generic utility functions for audit logging
 */
class AuditUtil {
  /**
   * Get mongoose model by name
   */
  static getModel(modelName) {
    try {
      return mongoose.model(modelName);
    } catch (error) {
      // Model not registered yet
      console.warn(`Model ${modelName} not found. It might not be imported yet.`);
      return null;
    }
  }

  /**
   * Get entity name (human-readable) for any model
   */
  static async getEntityName(modelName, entityId) {
    if (!entityId) return "";

    try {
      const model = this.getModel(modelName);
      if (!model) return "";

      const doc = await model.findById(entityId).lean();
      if (!doc) return "";

      // Try common field names for display
      return (
        doc.first_name ||
        doc.last_name ||
        doc.title ||
        doc.courseCode ||
        doc.matricNumber ||
        doc.email ||
        doc.username ||
        `${modelName}-${entityId}`
      );
    } catch (error) {
      return "";
    }
  }

  /**
   * Extract entity info from endpoint URL
   */
  static extractEntityFromEndpoint(endpoint) {
    if (!endpoint) return { entity: "System", entityId: null };

    const parts = endpoint.split("/").filter(p => p);


    if (parts.length >= 2) {
      let entity = parts[3];

      // Convert plural to singular
      if (entity.endsWith("s")) {
        entity = entity.slice(0, -1);
      } else if (entity.endsWith("ies")) {
        entity = entity.slice(0, -3) + "y";
      }

      // Capitalize first letter
      entity = entity.charAt(0).toUpperCase() + entity.slice(1);

      // Try to extract ID
      let entityId = null;
      if (parts.length >= 3 && mongoose.Types.ObjectId.isValid(parts[2])) {
        entityId = parts[2];
      }

      return { entity, entityId };
    }
    return { entity: "System", entityId: null };
  }

  /**
   * Extract ID from request (params, body, or query)
   */
  static extractEntityId(req) {
    // Check params
    if (req.params.id) return req.params.id;

    // Check body
    if (req.body?._id) return req.body._id;
    if (req.body?.id) return req.body.id;

    // Check specific param patterns
    const idParams = ["userId", "courseId", "studentId", "departmentId", "facultyId", "paymentId", "resultId"];
    for (const param of idParams) {
      if (req.params[param]) return req.params[param];
      if (req.body?.[param]) return req.body[param];
    }

    return null;
  }

  /**
   * Compare two objects and find changes
   */
  static diffObjects(oldObj, newObj) {
    if (!oldObj || !newObj) return { changedFields: [], delta: {} };

    const changedFields = [];
    const delta = {};

    // Check all keys in new object
    for (const key in newObj) {
      if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        changedFields.push(key);
        delta[key] = {
          old: oldObj[key],
          new: newObj[key]
        };
      }
    }

    // Check for deleted keys
    for (const key in oldObj) {
      if (!(key in newObj)) {
        changedFields.push(key);
        delta[key] = {
          old: oldObj[key],
          new: undefined
        };
      }
    }

    return { changedFields, delta };
  }

  /**
   * Sanitize sensitive data from objects
   */
  static sanitizeData(data, sensitiveFields = ["password", "token", "secret"]) {
    if (!data || typeof data !== "object") return data;

    const sanitized = JSON.parse(JSON.stringify(data));

    const sanitizeRecursive = (obj) => {
      for (const key in obj) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          obj[key] = "***REDACTED***";
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeRecursive(obj[key]);
        }
      }
    };

    sanitizeRecursive(sanitized);
    return sanitized;
  }

  /**
   * Map HTTP method to audit action
   */
  static methodToAction(method) {
    const map = {
      GET: "READ",
      POST: "CREATE",
      PUT: "UPDATE",
      PATCH: "UPDATE",
      DELETE: "DELETE"
    };
    return map[method] || method;
  }

  /**
   * Determine if endpoint should be audited
   */
  static shouldAuditEndpoint(endpoint, skipPaths = []) {
    if (!endpoint) return false;

    // Skip health checks, static files, etc.
    const skipPatterns = [
      "/health",
      "/favicon.ico",
      "/public/",
      "/static/",
      ".css",
      ".js",
      ".png",
      ".jpg",
      ".ico"
    ];

    // Add custom skip paths
    skipPatterns.push(...skipPaths);

    return !skipPatterns.some(pattern => endpoint.includes(pattern));
  }

  /**
 * Infer severity level based on HTTP method and optionally entity type
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} [entity] - Optional entity name for further context
 * @returns {"INFO" | "MEDIUM" | "HIGH"} - Severity level
 */
  static inferSeverity(method, entity) {
    const upperMethod = method?.toUpperCase();

    switch (upperMethod) {
      case "POST": // creating data
        return "MEDIUM";
      case "PUT":
      case "PATCH": // updating data
        return "MEDIUM";
      case "DELETE": // deleting data
        return "HIGH";
      case "GET": // reading data
        return "INFO";
      default:
        return "INFO";
    }
  }

  /**
   * Get all registered mongoose model names
   */
  static getAllModelNames() {
    return mongoose.modelNames();
  }

  /**
   * Generate a unique request ID
   */
  static generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default AuditUtil;