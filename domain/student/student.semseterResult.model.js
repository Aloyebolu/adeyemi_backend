import mongoose from "mongoose";

const studentSemesterResultSchema = new mongoose.Schema({
  academicStanding: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  academicStatus: {
    type: String,
    // enum: ["good", "probation", "withdrawal", "terminated", "leave_of_absence", "not_registered"],
    default: "good"
  },
  matricNumber: {type: String, required: true},
  name: {type: String, required: true},
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true
  },
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true
  },
  semesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AcademicSemester",
    required: true
  },

  // Academic year and level context
  session: {
    type: String,
    required: true
  },
  level: {
    type: String,
    required: true,
    enum: ["100", "200", "300", "400", "500", "600", "700"]
  },

  // Course results
  courses: [{
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    courseCode: String,
    courseTitle: String,
    courseUnit: Number,
    score: Number,
    grade: String,
    gradePoint: Number,
    creditPoint: Number,
    isCoreCourse: { type: Boolean, default: false },
    isCarryover: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["passed", "failed", "outstanding"],
      default: "passed"
    }
  }],

  // Semester performance
  gpa: {
    type: Number,
    default: 0
  },
  cgpa: {
    type: Number,
    default: 0
  },
  totalUnits: {
    type: Number,
    default: 0
  },
  totalPoints: {
    type: Number,
    default: 0
  },

  // Previous semester cumulative data
  previousCumulativeTCP: { type: Number, default: 0 },
  previousCumulativeTNU: { type: Number, default: 0 },
  previousCumulativeGPA: { type: Number, default: 0 , required: true},

  // Current semester data (TCP = Total Credit Points, TNU = Total Number of Units)
  currentTCP: { type: Number, default: 0 },
  currentTNU: { type: Number, default: 0 },

  // Cumulative data (including current)
  cumulativeTCP: { type: Number, default: 0 },
  cumulativeTNU: { type: Number, default: 0 },

  // Academic standing
  carryoverCount: {
    type: Number,
    default: 0
  },
  remark: {
    type: String,
    enum: ["excellent", "good", "probation", "withdrawn", "terminated", "NO_REGISTRATION"],
    default: "good"
  },
  status: {
    type: String,
    enum: ["draft", "processed", "approved", "published", "archived"],
    default: "processed"
  },

  // Audit trail
  computedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  computationSummaryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ComputationSummary"
  },

  // For MMS2 tracking
  academicHistory: [{
    session: String,
    semester: String,
    level: String,
    tcp: Number,
    tnu: Number,
    gpa: Number,
    cgpa: Number
  }],

  isPreview: {
    type: Boolean,
    default: false
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Indexes for efficient querying
studentSemesterResultSchema.index({ studentId: 1, semesterId: 1, level: 1 }, { unique: true });
studentSemesterResultSchema.index({ departmentId: 1, semesterId: 1 });
studentSemesterResultSchema.index({ session: 1, level: 1 });
studentSemesterResultSchema.index({ computationSummaryId: 1 });

const studentSemesterResultModel = mongoose.model("StudentSemesterResult", studentSemesterResultSchema);
export default studentSemesterResultModel;