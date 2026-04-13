import { Schema, model } from "mongoose";

const fileSchema = new Schema({
  // Core file information
  name: { type: String, required: true },
  originalName: { type: String, required: true },
  url: { type: String, required: true },
  type: { type: String, required: true }, // MIME type
  extension: { type: String, required: true },
  size: { type: Number, required: true }, // in bytes
  
  // Flexible domain reference
  domain: { 
    type: String, 
    required: true,
    enum: ['course', 'user', 'product', 'blog', 'message', 'custom', 'feedback'] // Add as needed
  },
  domainId: { 
    type: Schema.Types.ObjectId, 
    required: false, // Optional for files not tied to specific domain
    refPath: 'domain' // Dynamic reference based on domain field
  },
  
  // Uploader info
  uploadedBy: { 
    type: Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  
  // Security and access control
  isPublic: { type: Boolean, default: true },
  accessRoles: [{ type: String }], // e.g., ['admin', 'teacher', 'student']
  accessUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
  
  // Custom metadata for flexible usage
  metadata: {
    type: Map,
    of: Schema.Types.Mixed,
    default: {}
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date }, // Optional expiration date
  
  // File categorization
  category: { type: String }, // e.g., 'profile', 'assignment', 'product_image'
  tags: [{ type: String }],
  
  // Firebase storage info
  storagePath: { type: String, required: true },
  bucketName: { type: String, required: true },
});

// Indexes for efficient queries
fileSchema.index({ domain: 1, domainId: 1 });
fileSchema.index({ uploadedBy: 1 });
fileSchema.index({ createdAt: -1 });
fileSchema.index({ isPublic: 1 });
fileSchema.index({ category: 1 });
fileSchema.index({ tags: 1 });

// Update updatedAt on save
fileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default model("File", fileSchema);