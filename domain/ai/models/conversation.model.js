// src/modules/ai/models/conversation.model.js

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  tool_calls: [{
    tool_name: String,
    input: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    formatted: mongoose.Schema.Types.Mixed,
    timestamp: Date,
  }],
  actions: [{
    endpoint: String,
    method: String,
    payload: mongoose.Schema.Types.Mixed,
    label: String,
    executed: {
      type: Boolean,
      default: false,
    },
    executed_at: Date,
  }],
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const conversationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    default: 'New Conversation',
    trim: true,
  },
  messages: [messageSchema],
  
  // Context for the conversation
  context: {
    current_intent: {
      type: String,
      enum: ['read', 'write', 'analysis', 'export', null],
      default: null,
    },
    pending_action: mongoose.Schema.Types.Mixed,
    last_search_results: mongoose.Schema.Types.Mixed,
    temp_buffer: {
      type: String,
      default: '',
    },
  },
  
  // Metadata
  message_count: {
    type: Number,
    default: 0,
  },
  last_activity: {
    type: Date,
    default: Date.now,
  },
  
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance
conversationSchema.index({ user_id: 1, updated_at: -1 });
conversationSchema.index({ user_id: 1, created_at: -1 });

// Update timestamps on save
conversationSchema.pre('save', function(next) {
  this.updated_at = new Date();
  this.message_count = this.messages.length;
  next();
});

// Instance methods
conversationSchema.methods.addMessage = function(role, content, metadata = {}) {
  const message = {
    role,
    content,
    timestamp: new Date(),
    ...metadata,
  };
  
  this.messages.push(message);
  this.last_activity = new Date();
  
  return message;
};

conversationSchema.methods.getRecentMessages = function(limit = 20) {
  return this.messages.slice(-limit);
};

conversationSchema.methods.clearTempBuffer = function() {
  this.context.temp_buffer = '';
  return this;
};

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;