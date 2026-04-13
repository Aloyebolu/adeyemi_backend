// permission.request.model.js
import mongoose from 'mongoose';

const PermissionRequestSchema = new mongoose.Schema({
  action: { type: String, required: true },
  requested_by: { id: String, role: String, required: true },
  scope: { type: mongoose.Schema.Types.Mixed, default: {} },
  constraints: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  issued_permission_id: { type: String },
  reviewed_by: { id: String, role: String },
  reviewed_at: { type: Date },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

PermissionRequestSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export default mongoose.model('PermissionRequest', PermissionRequestSchema);
