import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  // Reference ID for tracking
  feedback_id: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  
  // User can be either registered or guest
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  // Guest information
  guest_info: {
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    name: String,
    phone: String,
    ip_address: String,
    user_agent: String
  },
  
  // Core feedback data
  type: {
    type: String,
    enum: ['bug_report', 'feature_request', 'complaint', 'praise', 'question', 'suggestion'],
    required: true,
    index: true
  },
  
  category: {
    type: String,
    // enum: [
    //   'user_interface',
    //   'user_experience',
    //   'performance',
    //   'functionality',
    //   'billing',
    //   'security',
    //   'documentation',
    //   'customer_service',
    //   'mobile_app',
    //   'api',
    //   'other'
    // ],
    default: 'other'
  },
  
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  
  // Rating (for satisfaction/rating type feedback)
  rating: {
    type: Number,
    min: 1,
    max: 5,
    sparse: true
  },
  
  // Severity (for bugs/issues)
  severity: {
    type: String,
    enum: ['critical', 'high', 'medium', 'low', 'cosmetic'],
    sparse: true
  },
  
  // Priority (set by admins)
  priority: {
    type: String,
    enum: ['urgent', 'high', 'medium', 'low', 'backlog'],
    default: 'medium'
  },
  
  // Status tracking
  status: {
    type: String,
    enum: [
      'pending',        // New feedback, not yet reviewed
      'reviewed',       // Reviewed by team
      'in_progress',    // Being worked on
      'resolved',       // Issue fixed/feature implemented
      'rejected',       // Not actionable/won't implement
      'duplicate',      // Already reported
      'archived'        // Old/closed
    ],
    default: 'pending',
    index: true
  },
  
  // Assignment
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  assigned_at: Date,
  
  // Resolution
  resolved_at: Date,
  resolved_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution_notes: String,
  
  // Related items
  related_chat_session: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    sparse: true
  },
  
  related_feedback: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback'
  }],
  
  // Attachments
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mime_type: String,
    uploaded_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  metadata: {
    page_url: String,
    browser: String,
    browser_version: String,
    os: String,
    os_version: String,
    device: String,
    screen_resolution: String,
    app_version: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  
  // Analytics
  analytics: {
    sentiment: {
      type: String,
      enum: ['positive', 'negative', 'neutral'],
      sparse: true
    },
    sentiment_score: Number,
    tags: [String],
    ai_processed: {
      type: Boolean,
      default: false
    },
    ai_processed_at: Date
  },
  
  // Timestamps
  submitted_at: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  last_updated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for performance
feedbackSchema.index({ status: 1, priority: 1, submitted_at: -1 });
feedbackSchema.index({ assigned_to: 1, status: 1 });
feedbackSchema.index({ type: 1, category: 1 });
feedbackSchema.index({ user_id: 1, submitted_at: -1 });
feedbackSchema.index({ "guest_info.email": 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ "metadata.browser": 1, "metadata.os": 1 });

// Virtual for response count
feedbackSchema.virtual('response_count', {
  ref: 'FeedbackResponse',
  localField: '_id',
  foreignField: 'feedback_id',
  count: true
});

// Virtual for average response time
feedbackSchema.virtual('response_time', {
  ref: 'FeedbackResponse',
  localField: '_id',
  foreignField: 'feedback_id'
});

// Pre-save middleware
feedbackSchema.pre('save', function(next) {
  this.last_updated = new Date();
  // Normalize type field to match enum values
  if (this.type === 'bugreport') {
    this.type = 'bug_report';
  } else if (this.type === 'featurerequest') {
    this.type = 'feature_request';
  }
  next();
});

// Pre-validate middleware to normalize type before validation
feedbackSchema.pre('validate', function(next) {
  if (this.type === 'bugreport') {
    this.type = 'bug_report';
  } else if (this.type === 'featurerequest') {
    this.type = 'feature_request';
  }
  next();
});


const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;