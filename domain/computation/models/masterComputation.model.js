import mongoose from "mongoose";

const masterComputationSchema = new mongoose.Schema({
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AcademicSemester"
  },

  // 🔥 Programme-level tracking
  totalJobs: {
    type: Number,
    default: 0
  },
  jobsProcessed: {
    type: Number,
    default: 0
  },
  jobsFailed: {
    type: Number,
    default: 0
  },

  // 🧠 Lifecycle state
  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "completed",
      "completed_with_errors",
      "failed",
      "cancelled",
      "locked"
    ],
    default: "pending"
  },

  // ⏱ Timing
  startedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date
  },
  duration: {
    type: Number
  },

  // 👤 Actor
  computedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  // 🔒 Locking
  semesterLocked: {
    type: Boolean,
    default: false
  },
  semesterLockedAt: {
    type: Date
  },

  // 📦 Extra flexible metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // 🎯 Context
  purpose: {
    type: String,
    enum: ["preview", "final"],
    default: "preview"
  },

  academicBoardDate: {
    type: Date,
    required: true
  },

  // 🧨 Safety guard (VERY IMPORTANT for distributed jobs)
  completionFinalized: {
    type: Boolean,
    default: false
  }

}, { timestamps: true });

/**
 * Indexes
 */
masterComputationSchema.index({ semester: 1, status: 1 });
masterComputationSchema.index({ computedBy: 1 });
masterComputationSchema.index({ purpose: 1, status: 1 });

const MasterComputation = mongoose.model(
  "MasterComputation",
  masterComputationSchema
);

export default MasterComputation;