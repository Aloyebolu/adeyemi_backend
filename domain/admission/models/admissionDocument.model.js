import mongoose from "mongoose";
import { DOCUMENT_STATUS } from "../constants/admissionDocument.constants.js";
import { DOCUMENT_CATEGORIES } from "../constants/admission.constants.js";

const admissionDocumentSchema = new mongoose.Schema(
  {
    admissionApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdmissionApplication",
      required: true,
      index: true
    },

    category: {
      type: String,
      enum: Object.values(DOCUMENT_CATEGORIES),
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: Object.values(DOCUMENT_STATUS),
      default: DOCUMENT_STATUS.NOT_STARTED,
      index: true
    },

    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "File",
      index: true
    },

    uploadedAt: {
      type: Date
    },

    verifiedAt: {
      type: Date
    },

    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    rejectionReason: {
      type: String,
      enum: [
        'blurry',
        'incomplete',
        'expired',
        'fake',
        'wrongDocument',
        'other'
      ]
    },

    rejectionNotes: {
      type: String,
      maxlength: 500
    },

    verificationScore: {
      type: Number,
      min: 0,
      max: 1
    },

    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // For tracking re-uploads
    uploadAttempts: {
      type: Number,
      default: 0
    },

    lastUploadedAt: {
      type: Date
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for file URL
admissionDocumentSchema.virtual('fileUrl').get(function() {
  return this.fileId ? `/api/admission/documents/${this._id}/file` : null;
});

// Indexes
admissionDocumentSchema.index({ admissionApplicationId: 1, category: 1 }, { unique: true });
admissionDocumentSchema.index({ status: 1, updatedAt: -1 });

// Pre-save middleware
admissionDocumentSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    if (this.status === DOCUMENT_STATUS.UPLOADED) {
      this.uploadedAt = new Date();
      this.uploadAttempts += 1;
      this.lastUploadedAt = new Date();
    } else if (this.status === DOCUMENT_STATUS.VERIFIED) {
      this.verifiedAt = new Date();
    }
  }
  next();
});

export default mongoose.model("AdmissionDocument", admissionDocumentSchema);