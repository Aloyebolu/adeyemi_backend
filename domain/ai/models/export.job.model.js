// src/modules/ai/models/export.job.model.js

import mongoose from 'mongoose';

const exportJobSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  conversation_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'expired'],
    default: 'pending',
    index: true,
  },
  format: {
    type: String,
    enum: ['excel', 'csv', 'json'],
    required: true,
  },
  query: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  file_info: {
    file_id: String,
    file_name: String,
    file_size: Number,
    file_url: String,
    mime_type: String,
  },
  record_count: {
    type: Number,
    default: 0,
  },
  error: {
    message: String,
    stack: String,
  },
  expires_at: {
    type: Date,
    required: true,
    index: true,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  completed_at: Date,
});

// TTL index to auto-delete old jobs
exportJobSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const ExportJob = mongoose.model('ExportJob', exportJobSchema);

export default ExportJob;