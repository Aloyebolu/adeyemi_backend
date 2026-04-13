// attendanceRecordModel.js (updated)
import mongoose from "mongoose";

const attendanceRecordSchema = new mongoose.Schema({
  session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "attendanceSession",
    required: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "student",
    required: true,
  },
  status: {
    type: String,
    enum: ["present", "absent", "late"],
    default: "absent",
  },
  check_in_time: { type: Date },
  check_in_method: {
    type: String,
    enum: ["manual", "qr_code", "biometric"],
  },
  marked_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  marked_by_role: {
    type: String,
    enum: ["lecturer", "course_rep", "admin", "system"]
  },
  remarks: { type: String }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound index for uniqueness
attendanceRecordSchema.index({ session: 1, student: 1 }, { unique: true });

// Index for analytics queries
attendanceRecordSchema.index({ student: 1, status: 1 });
attendanceRecordSchema.index({ session: 1, status: 1 });
attendanceRecordSchema.index({ check_in_time: 1 });

export default mongoose.model("attendanceRecord", attendanceRecordSchema);