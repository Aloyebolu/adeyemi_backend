import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true,
    index: true
  },
  
  sender_type: {
    type: String,
    enum: ["user", "attendant", "system"],
    required: true
  },
  
  sender_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true // Can be null for system messages
  },
  
  content: {
    type: String,
    required: true
  },
  
  message_type: {
    type: String,
    enum: ["text", "image", "file", "system_notification"],
    default: "text"
  },
  
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
  
  delivered: {
    type: Boolean,
    default: false
  },
  
  metadata: {
    quick_reply: Boolean,
    is_auto_response: Boolean,
    sentiment: String // positive, negative, neutral
  }
}, {
  timestamps: true
});

// Compound index for efficient chat history retrieval
messageSchema.index({ session_id: 1, created_at: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;