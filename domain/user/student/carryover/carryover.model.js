'64'
import { SYSTEM_USER_ID } from "#config/system.js";
import mongoose from "mongoose";
const carryoverSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  courses: {
    type: [
      {
        course: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Course",
          required: true
        },
        result: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Result"
        },
        grade: {
          type: String,
          enum: ["F", "D", "E", null],
          default: null
        },
        score: {
          type: Number,
          min: 0,
          max: 100,
          default: null
        },
        isCoreCourse: {
          type: Boolean,
          default: true
        },
        attempts: {
          type: Number,
          default: 0
        },
        reason: {
          type: String,
          enum: ["carryover", "cleared", "exempted"],
          required: true
        },
        fromSemester: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AcademicSemester",
          required: true
        },
        remark: String
      },
    ],
    default: []
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AcademicSemester",
    required: true
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department"
  },
  reason: {
    type: String,
    required: true
  },
  cleared: {
    type: Boolean,
    default: false
  },
  clearedAt: Date,
  clearedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: SYSTEM_USER_ID
  },
  computationBatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ComputationSummary",
    required: true
  }
}, { timestamps: true });

// Updated indexes for array structure
carryoverSchema.index({ student: 1, semester: 1 }, { unique: true }); // One document per student per semester
carryoverSchema.index({ student: 1, cleared: 1 });
carryoverSchema.index({ department: 1, semester: 1 });
carryoverSchema.index({ computationBatch: 1 });
// Index for searching within courses array
carryoverSchema.index({ "courses.course": 1 });

const CarryoverCourse = mongoose.model("CarryoverCourse", carryoverSchema);
export default CarryoverCourse;