import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    actor: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      },
      username: String,
      email: String,
      role: {
        type: String,
        // enum: ["admin", "dean", "hod", "lecturer", "student", "applicant", "staff"],
        required: true
      },
      department: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department",
        required: false
      },
      matricNo: String,
      staffId: String,
      ipAddress: String
    },
    action: {
      type: String,
      // enum: [
      //   // CRUD operations
      //   "CREATE", "READ", "UPDATE", "DELETE", "RESTORE",
      //   // Authentication
      //   "LOGIN", "LOGOUT", "LOGIN_FAILED", "PASSWORD_CHANGE", "TOKEN_REFRESH",
      //   // Academic operations
      //   "ENROLL", "WITHDRAW", "REGISTER", "DROP", "GRADE_UPDATE", "RESULT_UPLOAD",
      //   "APPROVE", "REJECT", "ASSIGN", "UNASSIGN", "PROMOTE", "SUSPEND",
      //   // Financial operations
      //   "PAYMENT_INITIATED", "PAYMENT_COMPLETED", "PAYMENT_FAILED", "REFUND",
      //   // System operations
      //   "EXPORT", "IMPORT", "DOWNLOAD", "UPLOAD", "BACKUP", "RESTORE",
      //   "CONFIG_CHANGE", "PERMISSION_CHANGE", "ROLE_CHANGE",
      //   // Custom actions (you can add more)
      //   "CUSTOM", "REMOVE_HOD", "ASSIGN_HOD"
      // ],
      required: true,
      index: true
    },
    entity: {
      type: String, // Model name: "User", "Course", "Student", "Payment", etc.
      required: true,
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    entityName: String, // Human-readable name
    changes: {
      before: mongoose.Schema.Types.Mixed,
      after: mongoose.Schema.Types.Mixed,
      changedFields: [String],
      delta: mongoose.Schema.Types.Mixed
    },
    context: {
      endpoint: String,
      method: String,
      requestId: String,
      userAgent: String,
      queryParams: mongoose.Schema.Types.Mixed,
      requestBody: mongoose.Schema.Types.Mixed,
      responseTime: Number,
      statusCode: Number,
      errorMessage: String
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "UNAUTHORIZED", "FORBIDDEN", "ERROR", "PENDING", "BLOCKED", "PARTIAL_SUCCESS"],
      default: "SUCCESS"
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    severity: {
      type: String,
      enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "INFO"
    },
    isSuspicious: {
      type: Boolean,
      default: false,
      index: true
    },
    requiresReview: {
      type: Boolean,
      default: false
    },
    tags: [String],
    // For cascading deletions or related operations
    relatedEntities: [{
      entity: String,
      entityId: mongoose.Schema.Types.ObjectId
    }]
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Compound indexes
auditLogSchema.index({ timestamp: -1, "actor.userId": 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ "actor.role": 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, isSuspicious: 1 });

// Virtuals for UI display
auditLogSchema.virtual("displayTime").get(function () {
  return this.timestamp.toLocaleString();
});

auditLogSchema.virtual("actionIcon").get(function () {
  const icons = {
    CREATE: "add",
    UPDATE: "edit",
    DELETE: "delete",
    READ: "visibility",
    LOGIN: "login",
    LOGOUT: "logout",
    GRADE_UPDATE: "grade",
    PAYMENT_COMPLETED: "payment"
  };
  return icons[this.action] || "info";
});

// Auto-tagging based on entity and action
auditLogSchema.pre("save", function (next) {
  // Auto-generate tags if not provided
  if (!this.tags || this.tags.length === 0) {
    this.tags = this.generateAutoTags();
  }

  // Auto-detect severity if not set
  if (this.severity === "INFO") {
    this.severity = this.determineAutoSeverity();
  }

  // Auto-detect suspicious activities
  this.detectSuspiciousActivity();

  next();
});

// Instance methods
auditLogSchema.methods.generateAutoTags = function () {
  const tags = [];

  // Entity-based tags
  tags.push(this.entity.toLowerCase());

  // Action-based tags
  if (this.action.includes("LOGIN")) tags.push("authentication");
  if (this.action.includes("PAYMENT")) tags.push("financial");
  if (["GRADE_UPDATE", "RESULT_UPLOAD"].includes(this.action)) tags.push("academic");
  if (["CREATE", "UPDATE", "DELETE"].includes(this.action)) tags.push("data-modification");

  // Status-based tags
  if (this.status === "UNAUTHORIZED" || this.status === "FORBIDDEN") tags.push("security");
  if (this.status === "ERROR") tags.push("error");

  return [...new Set(tags)];
};

auditLogSchema.methods.determineAutoSeverity = function () {
  // High severity entities
  const highSeverityEntities = ["User", "Grade", "Result", "Payment", "Salary", "Exam"];

  // Critical actions
  const criticalActions = ["DELETE", "ROLE_CHANGE", "PASSWORD_CHANGE", "GRADE_UPDATE"];

  if (criticalActions.includes(this.action) && highSeverityEntities.includes(this.entity)) {
    return "CRITICAL";
  }

  if (this.action === "DELETE" || this.status === "UNAUTHORIZED") {
    return "HIGH";
  }

  if (["UPDATE", "CREATE"].includes(this.action) && highSeverityEntities.includes(this.entity)) {
    return "MEDIUM";
  }

  return "LOW";
};

auditLogSchema.methods.detectSuspiciousActivity = function () {
  // Multiple failed logins from same IP (handled in service)
  if (this.action === "LOGIN_FAILED") {
    this.isSuspicious = true;
  }

  // Grade changes outside normal hours
  if (this.entity === "Grade" && this.action === "GRADE_UPDATE") {
    const hour = this.timestamp.getHours();
    if (hour < 8 || hour > 18) {
      this.isSuspicious = true;
    }
  }

  // Bulk deletions
  if (this.action === "DELETE" && this.metadata?.itemCount > 10) {
    this.isSuspicious = true;
    this.requiresReview = true;
  }

  // Unauthorized access attempts
  if (this.status === "UNAUTHORIZED" || this.status === "FORBIDDEN") {
    this.isSuspicious = true;
  }
};

// Static methods
auditLogSchema.statics.findByEntity = function (entity, entityId) {
  return this.find({ entity, entityId })
    .sort({ timestamp: -1 })
    .populate("actor.userId", "name email role")
    .lean();
};

auditLogSchema.statics.getEntityHistory = function (entity, entityId, limit = 50) {
  return this.find({
    $or: [
      { entity, entityId },
      { "relatedEntities.entity": entity, "relatedEntities.entityId": entityId }
    ]
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);
export default AuditLog;