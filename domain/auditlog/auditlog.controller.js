import AuditLogService from "./auditlog.service.js";
import AuditLog from "./auditlog.model.js";
import buildResponse from "#utils/responseBuilder.js";

export const getAuditLogs = async (req, res) => {
  try {
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
    } = req.query;

    const result = await AuditLogService.searchLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder,
      userId,
      role,
      entity,
      action,
      severity,
      status,
      startDate,
      endDate,
      search,
      // tags: tags ? tags.split(",") : null,
      // isSuspicious: isSuspicious === "true" ? true : isSuspicious === "false" ? false : null
    });


    return buildResponse(res, 200, "Audit logs retrieved successfully", result);
  } catch (error) {
    console.error("Get audit logs error:", error);
    return buildResponse(res, 500, "Failed to retrieve audit logs", null, true, error);
  }
};

export const getAuditStatistics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const statistics = await AuditLogService.getDashboardStats(parseInt(days));

    // await AuditLogService.logOperation({
    //   userId: req.user._id,
    //   action: "READ",
    //   entity: "AuditLog",
    //   context: {
    //     ipAddress: req.ip,
    //     endpoint: req.originalUrl,
    //     method: req.method,
    //     requestId: req.requestId
    //   },
    //   reason: "Admin viewed audit statistics"
    // });

    return buildResponse(res, 200, "Audit statistics retrieved successfully", statistics);
  } catch (error) {
    console.error("Get audit statistics error:", error);
    return buildResponse(res, 500, "Failed to retrieve audit statistics", null, true, error);
  }
};

export const getEntityHistory = async (req, res) => {
  try {
    const { entity, entityId } = req.params;
    const { limit = 50 } = req.query;

    // Validate entity (optional, but good practice)
    const validEntities = ["User", "Student", "Course", "Department", "Faculty",
      "Payment", "Result", "Grade", "Semester", "Announcement",
      "Notification", "Applicant", "Lecturer", "Settings"];

    if (!validEntities.includes(entity)) {
      return buildResponse(res, 400, `Invalid entity type: ${entity}`, null, true);
    }

    const history = await AuditLogService.getEntityAuditHistory(entity, entityId, parseInt(limit));

    await AuditLogService.logOperation({
      userId: req.user._id,
      action: "READ",
      entity: "AuditLog",
      context: {
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      },
      reason: `Viewed history for ${entity}:${entityId}`
    });

    return buildResponse(res, 200, "Entity history retrieved", {
      entity,
      entityId,
      history,
      count: history.length
    });
  } catch (error) {
    console.error("Get entity history error:", error);
    return buildResponse(res, 500, "Failed to retrieve entity history", null, true, error);
  }
};

export const getUserActivity = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30, limit = 100 } = req.query;

    // Authorization check
    if (req.user.role !== "admin" && req.user._id.toString() !== userId) {
      return buildResponse(res, 403, "You can only view your own activity", null, true);
    }

    const logs = await AuditLog.find({
      "actor.userId": userId,
      timestamp: {
        $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      }
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("actor.department", "name")
      .lean();

    await AuditLogService.logOperation({
      userId: req.user._id,
      action: "READ",
      entity: "User",
      entityId: userId,
      context: {
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      },
      reason: `Viewed activity for user ${userId}`,
      metadata: {
        targetUserId: userId,
        period: `${days} days`
      }
    });

    return buildResponse(res, 200, "User activity retrieved", {
      userId,
      activities: logs,
      count: logs.length,
      period: `${days} days`
    });
  } catch (error) {
    console.error("Get user activity error:", error);
    return buildResponse(res, 500, "Failed to retrieve user activity", null, true, error);
  }
};
export const getMyActivity = async (req, res) => {
  try {
    const { days = 30, limit = 50, showSensitive = false } = req.query;
    const userId = req.user._id;

    // Build query for user's own activities
    const query = {
      "actor.userId": userId,
      timestamp: {
        $gte: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000)
      }
    };

    // If user is not admin, filter out sensitive data
    if (!showSensitive && req.user.role !== "admin") {
      query.$or = [
        // Non-sensitive actions
        { action: { $in: ["LOGIN", "LOGOUT", "READ", "CREATE", "UPDATE"] } },
        { entity: { $nin: ["User", "Grade", "Result", "Payment"] } }
      ];
    }

    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select("-context.userAgent -context.queryParams -context.requestBody")
      .lean();

    // Sanitize data for non-admin users
    const sanitizedLogs = logs.map(log => {
      if (req.user.role !== "admin") {
        // Remove sensitive fields
        const sanitized = { ...log };

        // Remove IP address for non-admin
        if (sanitized.actor) {
          delete sanitized.actor.ipAddress;
        }

        // Remove detailed context
        if (sanitized.context) {
          sanitized.context = {
            endpoint: sanitized.context.endpoint,
            method: sanitized.context.method
          };
        }

        // Remove detailed changes for sensitive entities
        if (["User", "Grade", "Result", "Payment"].includes(log.entity)) {
          delete sanitized.changes;
          sanitized.metadata = {
            reason: sanitized.metadata?.reason || ""
          };
        }

        return sanitized;
      }
      return log;
    });

    return buildResponse(res, 200, "Your activity retrieved successfully", {
      userId,
      activities: sanitizedLogs,
      count: sanitizedLogs.length,
      period: `${days} days`,
      role: req.user.role
    });
  } catch (error) {
    console.error("Get my activity error:", error);
    return buildResponse(res, 500, "Failed to retrieve your activity", null, true, error);
  }
};
export const exportAuditLogs = async (req, res) => {
  try {
    const { format = "csv", ...filters } = req.query;

    const logs = await AuditLogService.searchLogs({
      ...filters,
      limit: 5000 // Export limit
    });

    await AuditLogService.logOperation({
      userId: req.user._id,
      action: "EXPORT",
      entity: "AuditLog",
      context: {
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      },
      reason: "Admin exported audit logs",
      metadata: {
        exportFormat: format,
        filters,
        recordCount: logs.data.length
      },
      severity: "MEDIUM"
    });

    if (format === "csv") {
      // Convert to CSV
      const csvData = logs.data.map(log => ({
        Timestamp: new Date(log.timestamp).toLocaleString(),
        User: log.actor.username || log.actor.email,
        Role: log.actor.role,
        Action: log.action,
        Entity: log.entity,
        "Entity ID": log.entityId || "",
        "Entity Name": log.entityName || "",
        Severity: log.severity,
        Status: log.status,
        "IP Address": log.actor.ipAddress || "",
        Endpoint: log.context?.endpoint,
        Reason: log.metadata?.reason || "",
        "Suspicious": log.isSuspicious ? "Yes" : "No",
        Tags: log.tags?.join(", ") || ""
      }));

      const headers = Object.keys(csvData[0] || {});
      const csvRows = [
        headers.join(","),
        ...csvData.map(row =>
          headers.map(header => {
            const cell = row[header] || "";
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(",") ? `"${escaped}"` : escaped;
          }).join(",")
        )
      ];

      const csvContent = csvRows.join("\n");
      const filename = `audit-logs-${Date.now()}.csv`;

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(csvContent);
    }

    // Default to JSON
    return buildResponse(res, 200, "Audit logs exported successfully", {
      exportedAt: new Date().toISOString(),
      count: logs.data.length,
      format,
      data: logs.data
    });
  } catch (error) {
    console.error("Export audit logs error:", error);
    return buildResponse(res, 500, "Failed to export audit logs", null, true, error);
  }
};

export const getSuspiciousActivities = async (req, res) => {
  try {
    const { hours = 24, limit = 50 } = req.query;
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - parseInt(hours));

    const activities = await AuditLog.find({
      timestamp: { $gte: cutoff },
      isSuspicious: true
    })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate("actor.userId", "name email role")
      .populate("actor.department", "name")
      .lean();

    await AuditLogService.logOperation({
      userId: req.user._id,
      action: "READ",
      entity: "AuditLog",
      context: {
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      },
      reason: "Admin viewed suspicious activities",
      metadata: {
        timeRange: `${hours} hours`
      }
    });

    return buildResponse(res, 200, "Suspicious activities retrieved", {
      activities,
      count: activities.length,
      timeRange: `${hours} hours`
    });
  } catch (error) {
    console.error("Get suspicious activities error:", error);
    return buildResponse(res, 500, "Failed to retrieve suspicious activities", null, true, error);
  }
};

export const markAsReviewed = async (req, res) => {
  try {
    const { logId } = req.params;

    const auditLog = await AuditLog.findByIdAndUpdate(
      logId,
      {
        requiresReview: false,
        isSuspicious: false
      },
      { new: true }
    );

    if (!auditLog) {
      return buildResponse(res, 404, "Audit log not found", null, true);
    }

    await AuditLogService.logOperation({
      userId: req.user._id,
      action: "UPDATE",
      entity: "AuditLog",
      entityId: logId,
      context: {
        ipAddress: req.ip,
        endpoint: req.originalUrl,
        method: req.method,
        requestId: req.requestId
      },
      reason: "Marked audit log as reviewed",
      metadata: {
        logId,
        previousStatus: "requires_review"
      }
    });

    return buildResponse(res, 200, "Audit log marked as reviewed", auditLog);
  } catch (error) {
    console.error("Mark as reviewed error:", error);
    return buildResponse(res, 500, "Failed to mark as reviewed", null, true, error);
  }
};