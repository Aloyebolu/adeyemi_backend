// attendance.model.js (updated)
import mongoose from "mongoose";

const attendanceSessionSchema = new mongoose.Schema({
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "courseAssignment",
    required: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "course",
    required: true,
  },
  lecturer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "lecturer",
    required: true,
  },
  co_lecturers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "lecturer"
  }],
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "semester",
    required: true,
  },
  session_date: { type: Date, required: true },
  start_time: { type: String, required: true },
  end_time: { type: String, required: true },
  topic: { type: String },
  attendance_method: {
    type: String,
    enum: ["manual", "qr_code", "biometric"],
    default: "manual",
  },
  qr_code_token: { type: String },
  is_active: { type: Boolean, default: true },
  total_students: { type: Number, default: 0 },
  present_count: { type: Number, default: 0 },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  created_by_role: {
    type: String,
    enum: ["lecturer", "course_rep", "admin"]
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for attendance rate
attendanceSessionSchema.virtual('attendance_rate').get(function() {
  return this.total_students > 0 
    ? (this.present_count / this.total_students) * 100 
    : 0;
});

// Virtual for absent count
attendanceSessionSchema.virtual('absent_count').get(function() {
  return this.total_students - this.present_count;
});

export default mongoose.model("attendanceSession", attendanceSessionSchema);