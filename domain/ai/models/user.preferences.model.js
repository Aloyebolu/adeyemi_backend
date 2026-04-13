// src/modules/ai/models/user.preferences.model.js

import mongoose from 'mongoose';

const userPreferencesSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true,
  },
  
  // Display preferences
  display: {
    default_format: {
      type: String,
      enum: ['table', 'summary', 'analysis', 'auto'],
      default: 'auto',
    },
    table_threshold: {
      type: Number,
      default: 20,
      min: 1,
      max: 100,
    },
    summary_threshold: {
      type: Number,
      default: 50,
      min: 10,
      max: 200,
    },
    auto_export_threshold: {
      type: Number,
      default: 100,
      min: 50,
      max: 1000,
    },
    show_previews: {
      type: Boolean,
      default: true,
    },
    compact_mode: {
      type: Boolean,
      default: false,
    },
  },
  
  // Export preferences
  export: {
    default_format: {
      type: String,
      enum: ['excel', 'csv', 'json'],
      default: 'excel',
    },
    include_headers: {
      type: Boolean,
      default: true,
    },
    date_format: {
      type: String,
      default: 'YYYY-MM-DD',
    },
  },
  
  // Analysis preferences
  analysis: {
    auto_analyze: {
      type: Boolean,
      default: false,
    },
    max_depth: {
      type: Number,
      enum: [1, 2, 3],
      default: 2,
    },
    include_recommendations: {
      type: Boolean,
      default: true,
    },
  },
  
  // Privacy & safety
  privacy: {
    hide_sensitive_fields: {
      type: Boolean,
      default: true,
    },
    require_confirmation_for: {
      type: [String],
      default: ['terminate', 'delete', 'update_role'],
    },
  },
  
  // Saved queries & templates
  saved_queries: [{
    name: {
      type: String,
      required: true,
    },
    description: String,
    query: mongoose.Schema.Types.Mixed,
    last_used: Date,
    usage_count: {
      type: Number,
      default: 0,
    },
  }],
  
  // User context
  context: {
    default_department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    default_role_filters: [String],
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

// Update timestamp on save
userPreferencesSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Instance method to get effective preferences with defaults
userPreferencesSchema.methods.getEffective = function() {
  const defaults = {
    display: {
      default_format: 'auto',
      table_threshold: 20,
      summary_threshold: 50,
      auto_export_threshold: 100,
      show_previews: true,
      compact_mode: false,
    },
    export: {
      default_format: 'excel',
      include_headers: true,
      date_format: 'YYYY-MM-DD',
    },
    analysis: {
      auto_analyze: false,
      max_depth: 2,
      include_recommendations: true,
    },
  };
  
  return {
    ...defaults,
    ...this.toObject(),
  };
};

const UserPreferences = mongoose.model('UserPreferences', userPreferencesSchema);

export default UserPreferences;