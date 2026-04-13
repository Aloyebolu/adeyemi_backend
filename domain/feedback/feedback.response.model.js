import mongoose from "mongoose";

const feedbackResponseSchema = new mongoose.Schema({
  response_id: {
    type: String,
    unique: true,
    required: true
  },
  
  feedback_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Feedback',
    required: true,
    index: true
  },
  
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  
  is_internal: {
    type: Boolean,
    default: false  // Internal notes (only visible to staff)
  },
  
  is_system_generated: {
    type: Boolean,
    default: false
  },
  
  attachments: [{
    filename: String,
    url: String,
    size: Number,
    mime_type: String
  }],
  
  // Email notification tracking
  email_sent: {
    type: Boolean,
    default: false
  },
  
  email_sent_at: Date,
  
  // Read status
  read_by: [{
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    read_at: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  metadata: {
    ip_address: String,
    user_agent: String
  }
}, {
  timestamps: true
});

// Indexes
feedbackResponseSchema.index({ feedback_id: 1, created_at: 1 });

const FeedbackResponse = mongoose.model("FeedbackResponse", feedbackResponseSchema);
export default FeedbackResponse;