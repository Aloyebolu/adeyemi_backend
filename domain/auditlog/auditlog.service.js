import AuditLog from "./auditlog.model.js";
import AuditUtil from "./auditlog.util.js";
import User from "../user/user.model.js";

/**
 * Generic Audit Log Service that works with ANY model
 */
class AuditLogService {
  /**
   * Log ANY database operation (CRUD)
   */
  static async logOperation({
    req = null,                // optional request object for auto-populating actor/context
    userId = null,
    action,
    entity,
    isSuspicious = false,
    entityId = null,
    entityName = "",
    oldData = null,
    newData = null,
    changes = {},
    context = {},
    status = "SUCCESS",
    metadata = {},
    severity = null,
    reason = "",
    tags = [],
    relatedEntities = []
  }) {
    try {
      // If req is provided, auto-fill missing userId and context fields
      if (req) {
        userId = userId || req.user?._id;

        context = {
          endpoint: context.endpoint || req.originalUrl || "",
          method: context.method || req.method || "",
          requestId: context.requestId || req.requestId || AuditUtil.generateRequestId(),
          ipAddress: context.ipAddress || req.ip || "",
          userAgent: context.userAgent || req.get?.('user-agent') || "",
          queryParams: context.queryParams || req.query || {},
          requestBody: context.requestBody || req.body || {},
          responseTime: context.responseTime || 0,
          statusCode: context.statusCode || 200,
          errorMessage: context.errorMessage || ""
        };
      }

      // Fetch user details if userId is available
      const userDetails = userId ? await this.getUserDetails(userId) : {};

      // Resolve entity name if not provided
      if (!entityName && entityId) {
        entityName = await AuditUtil.getEntityName(entity, entityId);
      }

      // Auto-determine severity if not provided
      if (!severity) {
        severity = this.determineSeverity(action, entity, userDetails?.role);
      }

      // Sanitize data
      const sanitizedOldData = AuditUtil.sanitizeData(oldData);
      const sanitizedNewData = AuditUtil.sanitizeData(newData);

      // Compute changes if not explicitly provided
      let finalChanges = changes;
      if (!changes || Object.keys(changes).length === 0) {
        if (oldData && newData && action === "UPDATE") {
          const diff = AuditUtil.diffObjects(oldData, newData);
          finalChanges = {
            before: sanitizedOldData,
            after: sanitizedNewData,
            changedFields: diff.changedFields,
            delta: diff.delta
          };
        } else if (action === "CREATE" && newData) {
          finalChanges = { after: sanitizedNewData };
        } else if (action === "DELETE" && oldData) {
          finalChanges = { before: sanitizedOldData };
        }
      }

      // Build the actor object with safe defaults
      const actor = {
        userId: userId || null,
        username: userDetails?.username || "Unknown",
        email: userDetails?.email || "",
        role: userDetails?.role || "Unknown",
        department: userDetails?.department || undefined,
        matricNo: userDetails?.matricNo || "",
        staffId: userDetails?.staffId || "",
        ipAddress: context.ipAddress
      };

      // Prepare metadata safely, merging defaults
      const finalMetadata = {
        reason,
        academicYear: metadata.academicYear || "",
        semester: metadata.semester || "",
        level: metadata.level || "",
        session: metadata.session || "",
        departmentName: metadata.departmentName || "",
        facultyName: metadata.facultyName || "",
        additionalInfo: metadata.additionalInfo || {},
        ...metadata // allow extra metadata overrides
      };

      // Create audit log
      const auditLog = new AuditLog({
        actor,
        action,
        entity,
        entityId,
        entityName,
        changes: finalChanges,
        context,
        status,
        metadata: finalMetadata,
        severity,
        tags: [...new Set(tags)], // deduplicate tags
        relatedEntities,
        isSuspicious
      });

      await auditLog.save();
      return auditLog;

    } catch (error) {
      console.error("Audit log creation failed:", error);
      return null; // Never throw - audit failures shouldn't break main flow
    }
  }


  /**
   * Auto-log HTTP request (for middleware)
   */
  static async logHttpRequest({ req, res, responseTime, responseBody, error = null, isSuspicious = false }) {
    if (!req.user && !req?.auditContext?.userId) return null;
    if(!req.user){
      req.user = {
        _id: req.auditContext.userId,
        role: req.auditContext.role || "Anonymous"
      }
    }

    const ctx = req.auditContext || {};

    const { entity, entityId } =
      ctx.resource
        ? { entity: ctx.resource, entityId: ctx.entityId }
        : AuditUtil.extractEntityFromEndpoint(req.originalUrl);

    // Status resolution
    let status =
      ctx.status ??
      (res.statusCode >= 400
        ? res.statusCode === 401 || res.statusCode === 403
          ? "UNAUTHORIZED"
          : "FAILURE"
        : "SUCCESS");

    // Reason resolution
    let reason = ctx.reason || "";
    if (!reason) {
      try {
        const parsed = typeof responseBody === "string"
          ? JSON.parse(responseBody)
          : responseBody;
        reason = parsed?.message || parsed?.error || "";
      } catch { }
    }

    return this.logOperation({
      // Real actor in case a user is shadowing another users account
      userId: ctx.userId || req.context?.actor_id || req.user._id,

      entityName: ctx.entityName,
      isSuspicious: ctx.isSuspicious || isSuspicious,
      // Action
      action: ctx.action || AuditUtil.methodToAction(req.method),

      entity: ctx.entity || entity || "Unknown",
      entityId: ctx.entityId || entityId || null,
      resource: ctx.resource || entity || "Unknown",
      status,
      reason,
      severity: ctx.severity || AuditUtil.inferSeverity(req.method),

      changes: {
        ...ctx.changes,
        changedFields: ctx.changes?.changedFields || (() => {
          const before = ctx.changes?.before || {};
          const after = ctx.changes?.after || {};
          const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
          const changed = [];
          for (const key of allKeys) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
              changed.push(key);
            }
          }
          return changed;
        })()
      },

      metadata: {
        // Role/ID of actor
        userRole: req.user.role,
        attemptedBy: req.user?.role,
        attemptedUserId: req.user?._id,

        // ✅ Shadow info
        shadowedUserId: req.context?.acting_user_id || null,
        shadowedRole: req.context?.acting_role || null,
        readOnly: req.context?.read_only || false,

        // Intent
        intent: req._intent,
        ...ctx.metadata,
      },

      context: {
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId,
        userAgent: req.headers["user-agent"],
        responseTime,
        statusCode: res.statusCode
      }
    });
  }


  /**
   * Log authentication events
   */
  static async logAuthEvent({
    userId,
    action,
    ipAddress,
    userAgent,
    status = "SUCCESS",
    reason = ""
  }) {
    return this.logOperation({
      userId,
      action,
      entity: "User",
      entityId: userId,
      context: { ipAddress, userAgent },
      status,
      reason,
      tags: ["authentication", "security"]
    });
  }

  /**
   * Log bulk operation (multiple entities)
   */
  static async logBulkOperation({
    userId,
    action,
    entity,
    items = [],
    context = {},
    reason = "",
    metadata = {}
  }) {
    return this.logOperation({
      userId,
      action,
      entity,
      context,
      reason,
      metadata: {
        ...metadata,
        itemCount: items.length,
        operationType: "bulk"
      },
      severity: items.length > 10 ? "MEDIUM" : "LOW",
      tags: ["bulk_operation", entity.toLowerCase()]
    });
  }

  /**
   * Log related operations (cascade operations)
   */
  static async logCascadeOperation({
    userId,
    action,
    mainEntity,
    mainEntityId,
    relatedOperations = [], // Array of { entity, entityId, action }
    context = {},
    reason = "",
    metadata = {}
  }) {
    const relatedEntities = relatedOperations.map(op => ({
      entity: op.entity,
      entityId: op.entityId
    }));

    return this.logOperation({
      userId,
      action,
      entity: mainEntity,
      entityId: mainEntityId,
      context,
      reason,
      metadata: {
        ...metadata,
        cascade: true,
        relatedOperations
      },
      severity: "MEDIUM",
      relatedEntities,
      tags: ["cascade", mainEntity.toLowerCase()]
    });
  }

  /**
   * Log custom business operation
   */
  static async logBusinessOperation({
    userId,
    action,
    entity,
    entityId = null,
    businessData = {},
    context = {},
    reason = "",
    metadata = {}
  }) {
    return this.logOperation({
      userId,
      action,
      entity,
      entityId,
      changes: { businessData },
      context,
      reason,
      metadata,
      tags: ["business", entity.toLowerCase()]
    });
  }

  /**
   * Get audit history for ANY entity
   */
  static async getEntityAuditHistory(entity, entityId, limit = 50) {
    return AuditLog.findByEntity(entity, entityId, limit);
  }

  /**
   * Search audit logs across ALL entities
   */
  static async searchLogs(filters = {}) {
    const {
      page = 1,
      limit = 50,
      sortBy = "timestamp",
      sortOrder = "desc",
      userId,
      role,
      entity,
      action,
      severity,
      status,
      startDate,
      endDate,
      search,
      tags,
      isSuspicious
    } = filters;

    const query = {};

    if (userId) query["actor.userId"] = userId;
    if (role) query["actor.role"] = role;
    if (entity) query.entity = entity;
    if (action) query.action = action;
    if (severity) query.severity = severity;
    if (status) query.status = status;
    if (isSuspicious !== undefined) query.isSuspicious = isSuspicious;

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (tags) {
      query.tags = { $all: Array.isArray(tags) ? tags : [tags] };
    }

    if (search) {
      query.$or = [
        { "actor.username": { $regex: search, $options: "i" } },
        { "actor.email": { $regex: search, $options: "i" } },
        { entityName: { $regex: search, $options: "i" } },
        { "metadata.reason": { $regex: search, $options: "i" } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("actor.userId", "name email role department")
        .populate("actor.department", "name")
        .lean(),
      AuditLog.countDocuments(query)
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get statistics for dashboard
   */
  static async getDashboardStats(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const promises = [
      // Total activities
      AuditLog.countDocuments({ timestamp: { $gte: startDate } }),

      // Activities by entity
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: "$entity", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Activities by action
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: "$action", count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),

      // Activities by severity
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        { $group: { _id: "$severity", count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),

      // Daily trend
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            count: { $sum: 1 },
            suspicious: { $sum: { $cond: [{ $eq: ["$isSuspicious", true] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // Top users
      AuditLog.aggregate([
        { $match: { timestamp: { $gte: startDate } } },
        {
          $group: {
            _id: "$actor.userId",
            count: { $sum: 1 },
            lastActivity: { $max: "$timestamp" }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user"
          }
        },
        { $unwind: "$user" },
        {
          $project: {
            userId: "$_id",
            name: "$user.name",
            email: "$user.email",
            role: "$user.role",
            activityCount: "$count",
            lastActivity: 1
          }
        }
      ]),

      // Suspicious activities
      AuditLog.countDocuments({
        timestamp: { $gte: startDate },
        isSuspicious: true
      })
    ];

    const results = await Promise.all(promises);

    return {
      period: `${days} days`,
      summary: {
        totalActivities: results[0],
        byEntity: results[1],
        byAction: results[2],
        bySeverity: results[3],
        suspiciousCount: results[6]
      },
      trends: {
        dailyTrend: results[4],
        topUsers: results[5]
      }
    };
  }

  // Helper methods
  static async getUserDetails(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) {
        return {
          username: "Unknown",
          email: "unknown@system",
          role: "unknown",
          department: null,
          matricNo: null,
          staffId: null
        };
      }

      return {
        username: user.name || user.email,
        email: user.email,
        role: user.role,
        department: user.department,
        matricNo: user.matricNo,
        staffId: user.staffId
      };
    } catch (error) {
      return {
        username: "System",
        email: "system@system",
        role: "system",
        department: null,
        matricNo: null,
        staffId: null
      };
    }
  }

  static determineSeverity(action, entity, role) {
    // System/Admin actions are lower risk
    if (role === "admin" || role === "system") {
      if (["DELETE", "ROLE_CHANGE"].includes(action)) return "MEDIUM";
      return "LOW";
    }

    // High risk combinations
    const highRiskEntities = ["User", "Grade", "Result", "Payment", "Salary", "Exam"];
    const criticalActions = ["DELETE", "ROLE_CHANGE", "GRADE_UPDATE"];

    if (criticalActions.includes(action) && highRiskEntities.includes(entity)) {
      return "CRITICAL";
    }

    if (action === "DELETE" || action === "GRADE_UPDATE") {
      return "HIGH";
    }

    if (action === "UPDATE" && highRiskEntities.includes(entity)) {
      return "MEDIUM";
    }

    return "LOW";
  }
}

export default AuditLogService;