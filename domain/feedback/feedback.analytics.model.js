import mongoose from "mongoose";

const feedbackAnalyticsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  
  // Summary statistics
  summary: {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    reviewed: { type: Number, default: 0 },
    in_progress: { type: Number, default: 0 },
    resolved: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 }
  },
  
  // By type
  by_type: {
    bug_report: { type: Number, default: 0 },
    feature_request: { type: Number, default: 0 },
    complaint: { type: Number, default: 0 },
    praise: { type: Number, default: 0 },
    question: { type: Number, default: 0 },
    suggestion: { type: Number, default: 0 }
  },
  
  // By category
  by_category: {
    user_interface: { type: Number, default: 0 },
    user_experience: { type: Number, default: 0 },
    performance: { type: Number, default: 0 },
    functionality: { type: Number, default: 0 },
    billing: { type: Number, default: 0 },
    security: { type: Number, default: 0 },
    documentation: { type: Number, default: 0 },
    customer_service: { type: Number, default: 0 },
    mobile_app: { type: Number, default: 0 },
    api: { type: Number, default: 0 },
    other: { type: Number, default: 0 }
  },
  
  // By priority
  by_priority: {
    urgent: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low: { type: Number, default: 0 },
    backlog: { type: Number, default: 0 }
  },
  
  // By severity (for bugs)
  by_severity: {
    critical: { type: Number, default: 0 },
    high: { type: Number, default: 0 },
    medium: { type: Number, default: 0 },
    low: { type: Number, default: 0 },
    cosmetic: { type: Number, default: 0 }
  },
  
  // Rating distribution
  ratings: {
    '1': { type: Number, default: 0 },
    '2': { type: Number, default: 0 },
    '3': { type: Number, default: 0 },
    '4': { type: Number, default: 0 },
    '5': { type: Number, default: 0 }
  },
  
  // Performance metrics
  performance: {
    avg_response_time: Number,        // Average time to first response (ms)
    avg_resolution_time: Number,      // Average time to resolution (ms)
    max_response_time: Number,
    max_resolution_time: Number,
    resolved_same_day: { type: Number, default: 0 },
    resolved_next_day: { type: Number, default: 0 },
    resolved_within_week: { type: Number, default: 0 }
  },
  
  // Sentiment analysis
  sentiment: {
    positive: { type: Number, default: 0 },
    negative: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    avg_sentiment_score: Number
  },
  
  // User engagement
  user_engagement: {
    registered_users: { type: Number, default: 0 },
    guest_users: { type: Number, default: 0 },
    returning_users: { type: Number, default: 0 }
  },
  
  // Top tags
  top_tags: [{
    tag: String,
    count: Number
  }],
  
  // By platform
  by_platform: {
    web: { type: Number, default: 0 },
    mobile_ios: { type: Number, default: 0 },
    mobile_android: { type: Number, default: 0 },
    api: { type: Number, default: 0 }
  },
  
  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

const FeedbackAnalytics = mongoose.model("FeedbackAnalytics", feedbackAnalyticsSchema);
export default FeedbackAnalytics;