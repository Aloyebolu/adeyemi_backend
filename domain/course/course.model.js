import { DB } from "#config/db-contract.js";
import mongoose from "mongoose";

const courseSchema = new mongoose.Schema({
  // ---------------------
  // BASIC INFO (only allowed when NOT borrowed)
  // ---------------------
  courseCode: { type: String, uppercase: true},
  title: { type: String, trim: true },
  description: { type: String, default: "" },

  // ---------------------
  // ACADEMIC FIELDS (only allowed when NOT borrowed)
  // ---------------------
  unit: { type: Number, min: 0 },
  level: {
    type: Number,
    enum: [100, 200, 300, 400, 500, 600],
    required: function () {
      return this.borrowedId === null;
    },
  },
  semester: {
    type: String,
    enum: ["first", "second", null],
    required: function () {
      return this.borrowedId === null;
    },
  },

  // ---------------------
  // COURSE TYPE (always allowed)
  // ---------------------
  type: {
    type: String,
    enum: ["core", "elective"],
    required: function () {
      return this.borrowedId === null;
    },
  },
  elective_category: {
    type: String,
    enum: ["required", "optional"],
    default: function () {
      if (this.borrowedId !== null) return undefined;
      return this.type === "elective" ? "optional" : undefined;
    },
    validate: {
      validator: function (v) {
        if (this.borrowedId !== null) return true;
        if (this.type === "core") return v === undefined;
        return true;
      },
      message: "elective_category is only applicable to elective courses.",
    },
  },


  overrides: {
    allowed_levels: [{
      type: Number,
      enum: [100, 200, 300, 400, 500, 600]
    }],

    allowed_programmes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme"
    }],

    excluded_programmes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Programme"
    }],

    allowed_departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: DB.OrganizationalUnit.MODEL
    }],

    excluded_departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: DB.OrganizationalUnit.MODEL
    }]
  },


  // ---------------------
  // ROOT-LEVEL SCOPES
  // ---------------------
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: "Faculty", default: null },
  department: { type: mongoose.Schema.Types.ObjectId, ref: DB.OrganizationalUnit.MODEL, required: true },
  programme: { type: mongoose.Schema.Types.ObjectId, ref: "Programme", default: null },

  scope: {
    type: String,
    enum: ["department", "programme", "faculty", "general"],
    default: "department",
  },

  // ---------------------
  // BORROWED SYSTEM
  // ---------------------
  borrowedId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },

  // ---------------------
  // OTHER FIELDS
  // ---------------------
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  replacement_course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course", default: null },
  prerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  lecture_hours: { type: Number, default: 0 },
  practical_hours: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, validate: {
      validator: function (v) {
        // deletedBy should only be set if deletedAt is set
        if (v && !this.deletedAt) return false;
        return true;
      },
      message: "deletedBy can only be set if deletedAt is also set."
    }
  },

}, { timestamps: true });

// ---------------------
// PRE-VALIDATION FOR BORROWED COURSES
// ---------------------
courseSchema.pre("validate", function (next) {
  if (this.courseCode && typeof this.courseCode === "string") {
    this.courseCode = this.courseCode.replace(/\s+/g, "");
  }

  if (this.borrowedId !== null) {
    this.courseCode = null;
    this.title = null;
    this.description = null;
    this.unit = null;
    this.level = null;
    this.semester = null;
  }
  next();
});

// ---------------------
// PARTIAL INDEX
// ---------------------
courseSchema.index(
  { courseCode: 1 },
  { unique: true, partialFilterExpression: { courseCode: { $type: "string" } } }
);

// ---------------------
// TOJSON TRANSFORM: auto-resolve borrowed courses everywhere
// ---------------------
// courseSchema.set("toJSON", {
//   virtuals: true,
//   transform(doc, ret) {
//     if (ret.borrowedId) {
//       const base = ret.borrowedId;
//       ret.courseCode = base.courseCode;
//       ret.title = base.title;
//       ret.description = base.description;
//       ret.unit = base.unit;
//       ret.level = base.level;
//       ret.semester = base.semester;
//       ret.type = base.type;
//       ret.elective_category = base.elective_category;
//       ret.lecture_hours = base.lecture_hours;
//       ret.practical_hours = base.practical_hours;
//       ret.__resolvedBorrowed = true; // optional flag for debugging
//     }
//     return ret;
//   }
// });


// 🧹 Auto-exclude deleted courses from default queries
courseSchema.pre(/^find/, function () {
  // this.populate("borrowedId");
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
export default mongoose.model("Course", courseSchema);
