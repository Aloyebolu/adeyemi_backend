import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema({
  session_id: {
    type: String,
    unique: true,
    required: true
  },
  
  // User can be either registered or guest
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true // Allows null for guest users
  },
  
  // Guest user information (when not registered)
  guest_info: {
    email: {
      type: String,
      sparse: true,
      lowercase: true
    },
    name: String,
    phone: String,
    ip_address: String,
    user_agent: String
  },
  
  status: {
    type: String,
    enum: ["active", "waiting", "closed", "resolved"],
    default: "waiting"
  },
  
  assigned_to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true
  },
  
  department: {
    type: String,
    default: "general"
  },
  
  last_message_at: {
    type: Date,
    default: Date.now
  },
  
  created_at: {
    type: Date,
    default: Date.now
  },
  
  closed_at: Date,
  
  metadata: {
    page_url: String,
    browser: String,
    os: String,
    device: String
  }
}, {
  timestamps: true
});

// Indexes for performance
chatSessionSchema.index({ status: 1, created_at: -1 });
chatSessionSchema.index({ assigned_to: 1, status: 1 });
chatSessionSchema.index({ "guest_info.email": 1 });

const ChatSession = mongoose.model("ChatSession", chatSessionSchema);
export default ChatSession;