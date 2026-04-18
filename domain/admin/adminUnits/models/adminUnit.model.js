import mongoose from "mongoose";

const adminUnitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    code: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      sparse: true
    },

    type: {
      type: String,
      required: true,
      enum: [
        "registry",
        "bursary",
        "library",
        "hostel",
        "ict",
        "admissions",
        "security",
        "transport",
        "health",
        "student_affairs",
        "other"
      ],
      index: true
    },

    parent_unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUnit",
      default: null,
      index: true
    },

    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },

    description: {
      type: String,
      trim: true
    },

    is_active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast queries
adminUnitSchema.index({ type: 1, is_active: 1 });
adminUnitSchema.index({ parent_unit: 1, is_active: 1 });
adminUnitSchema.index({ name: 1, type: 1 });

export const AdminUnit = mongoose.model("AdminUnit", adminUnitSchema);