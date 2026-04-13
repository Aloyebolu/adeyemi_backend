import mongoose from "mongoose";

const academicSemesterSchema = new mongoose.Schema({
  name: {
    type: String,
    enum: ["first", "second", "summer"],
    required: true,
  },
  session: {
    type: String,
    required: true,
    match: /^\d{4}\/\d{4}$/,
  },
  order: {
    type: Number,
    required: true,
  },
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date 
  },
  isRegistrationOpen: { 
    type: Boolean, 
    default: false 
  },
  isResultsPublished: { 
    type: Boolean, 
    default: false 
  },
  isActive: { 
    type: Boolean, 
    default: false 
  },
}, { 
  timestamps: true 
});


// ============================================
// PRE-SAVE: SAFE AUTO ORDERING + IMMUTABILITY
// ============================================

academicSemesterSchema.pre('save', async function(next) {
  try {
    // ✅ Auto-assign order ONLY if not provided
    if (this.isNew && !this.order) {
      const lastSemester = await this.constructor
        .findOne({})
        .sort({ order: -1 })
        .select("order");

      this.order = lastSemester ? lastSemester.order + 1 : 1;
    }

    // ✅ Prevent order modification after creation
    if (!this.isNew && this.isModified('order')) {
      return next(new Error('Order cannot be modified after creation'));
    }

    next();
  } catch (error) {
    next(error);
  }
});


// ============================================
// INDEXES (CRITICAL FOR SAFETY)
// ============================================

// ✅ Global timeline uniqueness (VERY IMPORTANT)
academicSemesterSchema.index(
  { order: 1 },
  { unique: true }
);

// ✅ Only one active semester
academicSemesterSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// ✅ Fast ordering queries
academicSemesterSchema.index({ order: 1 });


export const AcademicSemester = mongoose.model(
  "AcademicSemester",
  academicSemesterSchema
);