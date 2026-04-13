// courseMaterial.model.js
import { Schema, model } from "mongoose";

const courseMaterialSchema = new Schema(
  {
    courseAssignment: {
      type: Schema.Types.ObjectId,
      ref: "CourseAssignment",
      required: true
    },

    file: {
      type: Schema.Types.ObjectId,
      ref: "File",
      required: true
    },

    title: { type: String, required: true },
    description: String,

    // Academic context
    week: { type: Number }, // Week number in the syllabus
    lectureNumber: { type: Number }, // Lecture sequence
    topic: { type: String }, // e.g., "Introduction to Algorithms"

    // Display & ordering
    order: { type: Number, default: 0 },
    materialType: { 
      type: String, 
      enum: ['lecture_notes', 'slides', 'video', 'assignment', 'reading', 'quiz', 'resource'],
      default: 'resource'
    },

    // Access control - Pedagogy rules
    isPreview: { type: Boolean, default: false }, // Free preview for non-enrolled
    isPublished: { type: Boolean, default: true }, // Hidden from students
    availableFrom: { type: Date }, // Start date for availability
    availableTo: { type: Date }, // End date for availability

    // Tracking
    viewsCount: { type: Number, default: 0 },
    downloadCount: { type: Number, default: 0 },

    // Metadata
    tags: [{ type: String }],
    estimatedDuration: { type: Number }, // in minutes

    // Audit
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    lastUpdatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User"
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
courseMaterialSchema.index({ courseAssignment: 1, order: 1 });
courseMaterialSchema.index({ courseAssignment: 1, week: 1 });
courseMaterialSchema.index({ courseAssignment: 1, isPublished: 1 });
courseMaterialSchema.index({ courseAssignment: 1, materialType: 1 });
courseMaterialSchema.index({ availableFrom: 1, availableTo: 1 });
courseMaterialSchema.index({ tags: 1 });

// Virtual for checking availability
courseMaterialSchema.virtual('isAvailable').get(function() {
  const now = new Date();
  if (!this.isPublished) return false;
  if (this.availableFrom && now < this.availableFrom) return false;
  if (this.availableTo && now > this.availableTo) return false;
  return true;
});

// Pre-save to update order if needed
courseMaterialSchema.pre('save', async function(next) {
  if (this.isNew && this.order === 0) {
    const lastMaterial = await this.constructor.findOne(
      { courseAssignment: this.courseAssignment },
      { order: 1 },
      { sort: { order: -1 } }
    );
    this.order = lastMaterial ? lastMaterial.order + 1 : 0;
  }
  next();
});

export default model("CourseMaterial", courseMaterialSchema);