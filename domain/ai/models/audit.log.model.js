// src/modules/ai/models/audit.log.model.js

import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['query', 'action', 'conversation', 'error', 'export'],
    required: true,
    index: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    index: true,
  },
  action: {
    type: String,
    required: true,
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    ip: String,
    user_agent: String,
    duration_ms: Number,
    status_code: Number,
    timestamp: Date,
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound indexes for common queries
auditLogSchema.index({ user_id: 1, created_at: -1 });
auditLogSchema.index({ type: 1, created_at: -1 });
auditLogSchema.index({ action: 1, created_at: -1 });

// TTL index to auto-delete old logs (after 90 days)
auditLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AiAuditLog', auditLogSchema);

export default AuditLog;