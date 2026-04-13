import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    matricNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },
    programmeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme",
      required: true,
    },

    level: {
      type: Number,
      enum: [100, 200, 300, 400, 500, 600],
      required: true,
    },
    session: {
      type: String,
      // required: true, // e.g. "2024/2025"
    },
    courses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
      },
    ],
    gpa: {
      type: Number,
      default: 0.0,
    },
    cgpa: {
      type: Number,
      default: 0.0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    totalCarryovers: { type: Number, default: 0 },
    lastGPAUpdate: { type: Date },
    probationStatus: {
      type: String,
      enum: ["none", "probation", "probation_lifted"],
      default: "none"
    },
    terminationStatus: {
      type: String,
      enum: ["none", "withdrawn", "terminated", "expelled"],
      default: "none"
    },
    suspension: {
      type: [
        {
          _id: false, //  stop auto _id
          type: {
            type: String,
            enum: ["punishment", "administrative"]
          },
          reason: String,
          start_date: Date,
          end_date: Date,
          is_active: Boolean,
          created_by: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
          }
        }
      ],
      default: [] //  stop null from ever happening again

    },

    // BYPASS : Temporarily here to support query of bypassed students in sutdent.service.js.getstudentIdsForProgramme()
    payment_completed: {
      type: Boolean
    }

  },
  // { timestamps: true }
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

studentSchema.index({ matricNumber: 1 }, { unique: true })
studentSchema.index({ departmentId: 1, facultyId: 1, programmeId: 1 })
studentSchema.index({ level: 1, session: 1 })
studentSchema.index({ deletedAt: 1, isActive: 1 })
studentSchema.index({ probationStatus: 1, terminationStatus: 1 })
studentSchema.index({ "suspension.is_active": 1 })

// 🧹 Auto-exclude deleted students from default queries
studentSchema.pre(/^find/, function () {
  const archiveMode = this.getOptions()?.archiveMode;

  if (archiveMode === "only") {
    this.where({ deletedAt: { $ne: null } });
    return;
  }

  if (archiveMode === "all") {
    // no filter
    return;
  }

  // default
  this.where({ deletedAt: null });
});

studentSchema.virtual("user", {
  ref: "User",          // model to populate
  localField: "_id",    // Student._id
  foreignField: "_id",  // User._id
  justOne: true         // one-to-one
});

export default mongoose.model("Student", studentSchema);
