import mongoose from "mongoose";
//  IMPORTANT: Clear cached model to force schema refresh
// delete mongoose.connection.models['ComputationSummary'];
// delete mongoose.models['ComputationSummary'];
// Define a subdocument schema
const courseKeySchema = new mongoose.Schema({

  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course"
  },
  courseCode: String,
  title: String,
  unit: Number,
  level: Number,
  type: String,
  isCoreCourse: Boolean,
  isBorrowed: Boolean
}, { _id: false });  // No _id for subdocuments
const computationSummarySchema = new mongoose.Schema({
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true
  },

  programme: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Programme",
    required: true
  },

  departmentDetails: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  // Then use it in your main schema
  keyToCoursesByLevel: {
    type: Map,
    of: [courseKeySchema],  // Use the subdocument schema
    default: new Map()
  },
  failedStudents: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  semester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AcademicSemester",
    required: true
  },

  // Master computation reference
  masterComputationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MasterComputation"
  },


  // Overall department statistics
  totalStudents: { type: Number, default: 0 },
  studentsWithResults: { type: Number, default: 0 },
  studentsProcessed: { type: Number, default: 0 },

  averageGPA: { type: Number, default: 0 },
  highestGPA: { type: Number, default: 0 },
  lowestGPA: { type: Number, default: 0 },

  // Overall grade distribution
  gradeDistribution: {
    firstClass: { type: Number, default: 0 },
    secondClassUpper: { type: Number, default: 0 },
    secondClassLower: { type: Number, default: 0 },
    thirdClass: { type: Number, default: 0 },
    fail: { type: Number, default: 0 }
  },

  // Summary of results by level
  summaryOfResultsByLevel: {
    type: Map,
    of: {
      totalStudents: { type: Number, default: 0 },
      studentsWithResults: { type: Number, default: 0 },

      gpaStatistics: {
        average: { type: Number, default: 0 },
        highest: { type: Number, default: 0 },
        lowest: { type: Number, default: 0 }
      },

      classDistribution: {
        firstClass: { type: Number, default: 0 },
        secondClassUpper: { type: Number, default: 0 },
        secondClassLower: { type: Number, default: 0 },
        thirdClass: { type: Number, default: 0 },
        pass: { type: Number, default: 0 },
        fail: { type: Number, default: 0 }
      }
    },
    default: new Map()
  },

  // Status tracking
  status: {
    type: String,
    enum: [
      "pending",
      "processing",
      "completed",
      "completed_with_errors",
      "failed",
      "cancelled"
    ],
    default: "pending"
  },

  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  duration: { type: Number },

  error: { type: String },
  retryCount: { type: Number, default: 0 },
  lastRetryAt: Date,

  computedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  purpose: {
    type: String,
    enum: ["final", "preview", "simulation"],
    default: "final"
  },


  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },

  approval_dates: {
    departmental_board: {
      type: Date
    },
    faculty_board: {
      type: Date
    },
    senate_committee: {
      type: Date
    },
    senate: {
      type: Date
    }
  },

  masterSheetGeneratedAt: Date
}, { timestamps: true });

// Indexes for performance
computationSummarySchema.index(
  {
    department: 1,
    programme: 1,
    semester: 1,
    purpose: 1
  },
  { unique: true }
);
computationSummarySchema.index({ masterComputationId: 1 });
computationSummarySchema.index({ isPreview: 1, purpose: 1 });
computationSummarySchema.index({ status: 1 });


const ComputationSummary = mongoose.model("ComputationSummary", computationSummarySchema);
export default ComputationSummary;