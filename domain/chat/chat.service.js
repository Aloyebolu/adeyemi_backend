// [file name]: chat.service.js
// [file content begin]
import crypto from "crypto";
import ChatSession from "./chat.model.js";
import Message from "./chat.message.model.js";
import User from "#domain/user/user.model.js";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import AppError from "#shared/errors/AppError.js";

const MAX_CONCURRENT_CHATS = 50;
const MAX_WAITING_TIME = 5 * 60 * 1000; // 5 minutes
const MAX_CHATS_PER_ATTENDANT = 5; // Maximum active chats per attendant
const AUTO_ASSIGN_INTERVAL = 5000; // 5 seconds
const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const FILE_UPLOAD_PATH = process.env.FILE_UPLOAD_PATH || 'uploads/chat';

class ChatService {
  constructor() {
    this.loadBalancerInterval = null;
    this.cleanupInterval = null;
    this.startLoadBalancer();
    this.startCleanupInterval();
    
    // Ensure upload directory exists
    this.ensureUploadDirectory();
  }
  
  // Ensure upload directory exists
  ensureUploadDirectory() {
    const uploadDir = path.join(process.cwd(), FILE_UPLOAD_PATH);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  }
  
  // Start the load balancer
  startLoadBalancer() {
    if (this.loadBalancerInterval) {
      clearInterval(this.loadBalancerInterval);
    }
    
    this.loadBalancerInterval = setInterval(async () => {
      try {
        await this.autoAssignWaitingChats();
      } catch (error) {
        console.error("Load balancer error:", error);
      }
    }, AUTO_ASSIGN_INTERVAL);
    
    console.log("Chat load balancer started (5s interval)");
  }
  
  // Start cleanup interval
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupInactiveSessions();
        await this.reassignFromOfflineAttendants();
      } catch (error) {
        console.error("Cleanup interval error:", error);
      }
    }, 60000); // Run every minute
    
    console.log("Chat cleanup interval started (1 minute interval)");
  }
  
  // Stop all intervals
  stopAllIntervals() {
    if (this.loadBalancerInterval) {
      clearInterval(this.loadBalancerInterval);
      this.loadBalancerInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    console.log("Chat service intervals stopped");
  }
  
  // Generate unique session ID
  generateSessionId() {
    return `chat_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
  
  // Create new chat session - PREVENTS MULTIPLE SESSIONS
  async createChatSession(userData) {
    try {
      let existingSession = null;
      
      // Check for existing active session for registered users
      if (userData.user_id) {
        existingSession = await ChatSession.findOne({
          user_id: userData.user_id,
          status: { $in: ['active', 'waiting'] }
        });
      }
      // Check for existing session for guest users by email
      else if (userData.email) {
        existingSession = await ChatSession.findOne({
          'guest_info.email': userData.email,
          status: { $in: ['active', 'waiting'] },
          created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        });
      }
      
      if (existingSession) {
        // Update last seen and return existing session
        existingSession.last_message_at = new Date();
        await existingSession.save();
        
        console.log(`Returning existing session ${existingSession._id} for user`);
        return existingSession;
      }
      
      const sessionId = this.generateSessionId();
      
      const sessionData = {
        session_id: sessionId,
        status: "waiting",
        department: userData.department || "general",
        metadata: userData.metadata || {},
        created_at: new Date(),
        last_message_at: new Date()
      };
      
      // If user is registered
      if (userData.user_id) {
        sessionData.user_id = userData.user_id;
      } else {
        // Guest user
        sessionData.guest_info = {
          email: userData.email,
          name: userData.name || "Guest",
          phone: userData.phone,
          ip_address: userData.ip_address,
          user_agent: userData.user_agent
        };
      }
      
      const session = await ChatSession.create(sessionData);
      
      console.log(`Created new chat session ${session._id} for ${userData.name || 'guest'}`);
      
      // Try to assign immediately
      await this.assignChatToAvailableAttendant(session._id);
      
      return session;
    } catch (error) {
      throw new AppError(`Failed to create chat session: ${error.message}`);
    }
  }
  
  // Find available attendant using load balancing algorithm
  async findAvailableAttendant() {
    try {
      // Find users with customer_service role who are available and recently active
      const availableAttendants = await User.find({
        "extra_roles": "customer_service",
        "chat_availability": true,
        "last_seen": { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Online in last 5 mins
      });
      
      if (availableAttendants.length === 0) {
        return null;
      }
      
      // Get current chat counts for each attendant
      const attendantsWithCounts = await Promise.all(
        availableAttendants.map(async (attendant) => {
          const activeChatCount = await ChatSession.countDocuments({
            assigned_to: attendant._id,
            status: { $in: ["active", "waiting"] }
          });
          
          return {
            attendant,
            chatCount: activeChatCount,
            lastSeen: attendant.last_seen || new Date(0)
          };
        })
      );
      
      // Filter out attendants who have reached their limit
      const eligibleAttendants = attendantsWithCounts.filter(
        item => item.chatCount < MAX_CHATS_PER_ATTENDANT
      );
      
      if (eligibleAttendants.length === 0) {
        return null;
      }
      
      // Choose attendant using load balancing strategy
      // Strategy: Least loaded + most recently active
      return this.chooseAttendant(eligibleAttendants);
    } catch (error) {
      console.error("Error finding available attendant:", error);
      return null;
    }
  }
  
  // Choose attendant based on load balancing strategy
  chooseAttendant(attendantsWithCounts) {
    // Sort by chat count (ascending) and then by last seen (descending)
    attendantsWithCounts.sort((a, b) => {
      if (a.chatCount !== b.chatCount) {
        return a.chatCount - b.chatCount; // Least loaded first
      }
      return b.lastSeen - a.lastSeen; // Most recently active first
    });
    
    return attendantsWithCounts[0].attendant;
  }
  
  // Assign chat to attendant
  async assignChatToAvailableAttendant(sessionId) {
    try {
      const attendant = await this.findAvailableAttendant();
      
      if (!attendant) {
        // Check if chat has been waiting too long
        const session = await ChatSession.findById(sessionId);
        const waitTime = new Date() - session.created_at;
        
        if (waitTime > MAX_WAITING_TIME) {
          // Send apology message for long wait
          await this.sendSystemMessage(
            sessionId,
            "We apologize for the long wait. All our support agents are currently assisting other customers. Please try again later or leave a message and we'll get back to you soon."
          );
          
          // Optionally mark as waiting-too-long
          await ChatSession.findByIdAndUpdate(sessionId, {
            status: "waiting_too_long"
          });
        }
        return null;
      }
      
      // Assign chat
      const session = await ChatSession.findByIdAndUpdate(
        sessionId,
        {
          assigned_to: attendant._id,
          status: "active",
          assigned_at: new Date(),
          last_message_at: new Date()
        },
        { new: true }
      );
      
      // Send assignment notification
      await this.sendSystemMessage(
        sessionId,
        `You are now connected with ${attendant.name || 'a support agent'}. How can we help you today?`
      );
      
      console.log(`Chat ${sessionId} assigned to attendant ${attendant.name} (${attendant._id})`);
      
      return attendant;
    } catch (error) {
      console.error("Error assigning chat:", error);
      return null;
    }
  }
  
  // Auto-assign waiting chats (called every 5 seconds)
  async autoAssignWaitingChats() {
    try {
      // Find all waiting chats that haven't been assigned
      const waitingChats = await ChatSession.find({
        status: "waiting",
        assigned_to: { $exists: false },
        created_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes only
      })
      .sort({ created_at: 1 }) // Oldest first
      .limit(10); // Process up to 10 at a time
      
      if (waitingChats.length === 0) {
        return;
      }
      
      console.log(`[Load balancer] Found ${waitingChats.length} waiting chats`);
      
      // Process each waiting chat
      for (const chat of waitingChats) {
        // Check if chat has been waiting too long
        const waitTime = new Date() - chat.created_at;
        if (waitTime > MAX_WAITING_TIME) {
          continue; // Skip, already handled in assignChatToAvailableAttendant
        }
        
        // Try to assign
        await this.assignChatToAvailableAttendant(chat._id);
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error("Error in autoAssignWaitingChats:", error);
    }
  }
  
  // Send message
  async sendMessage(sessionId, senderData, content, attachments = []) {
    try {
      const messageData = {
        session_id: sessionId,
        content,
        sender_type: senderData.sender_type,
        attachments: [],
        created_at: new Date()
      };
      
      if (senderData.sender_id) {
        messageData.sender_id = senderData.sender_id;
      }
      
      // Process attachments if any
      if (attachments && attachments.length > 0) {
        messageData.attachments = attachments.map(att => ({
          filename: att.filename || att.name,
          url: att.url || att.path,
          size: att.size,
          mime_type: att.mime_type || att.type,
          uploaded_at: new Date()
        }));
      }
      
      const message = await Message.create(messageData);
      
      // Update session last message timestamp
      await ChatSession.findByIdAndUpdate(sessionId, {
        last_message_at: new Date()
      });
      
      return message;
    } catch (error) {
      throw new AppError(`Failed to send message: ${error.message}`);
    }
  }
  
  // Send system message
  async sendSystemMessage(sessionId, content) {
    return this.sendMessage(sessionId, {
      sender_type: "system"
    }, content);
  }
  
  // Get chat history
  async getChatHistory(sessionId, limit = 100) {
    try {
      const messages = await Message.find({ session_id: sessionId })
        .sort({ created_at: 1 })
        .limit(limit)
        .populate('sender_id', 'name email role');
      
      return messages;
    } catch (error) {
      throw new AppError(`Failed to get chat history: ${error.message}`);
    }
  }
  
  // Mark messages as read
  async markAsRead(sessionId, userId, messageIds) {
    try {
      await Message.updateMany(
        {
          _id: { $in: messageIds },
          session_id: sessionId,
          "read_by.user_id": { $ne: userId }
        },
        {
          $push: {
            read_by: {
              user_id: userId,
              read_at: new Date()
            }
          }
        }
      );
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  }
  
  // Close chat session with reason
  async closeChatSession(sessionId, resolved = false, reason = 'manual') {
    try {
      const updateData = {
        status: resolved ? "resolved" : "closed",
        closed_at: new Date(),
        close_reason: reason
      };
      
      const session = await ChatSession.findByIdAndUpdate(
        sessionId,
        updateData,
        { new: true }
      );
      
      const closeMessage = reason === 'inactive_timeout' 
        ? "This chat session has been closed due to inactivity. Thank you for contacting us."
        : reason === 'user_disconnected'
          ? "The user has disconnected. Chat session closed."
          : `This chat session has been ${resolved ? 'resolved' : 'closed'}. Thank you for contacting us.`;
      
      await this.sendSystemMessage(sessionId, closeMessage);
      
      console.log(`Chat ${sessionId} closed. Reason: ${reason}, Status: ${session.status}`);
      
      return session;
    } catch (error) {
      throw new AppError(`Failed to close chat session: ${error.message}`);
    }
  }
  
  // Clean up inactive sessions (5 minutes no messages)
  async cleanupInactiveSessions() {
    try {
      const inactiveTime = new Date(Date.now() - INACTIVITY_TIMEOUT);
      
      // Find active sessions with no recent messages
      const inactiveSessions = await ChatSession.find({
        status: { $in: ['active', 'waiting'] },
        last_message_at: { $lt: inactiveTime },
        created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours only
      });
      
      for (const session of inactiveSessions) {
        await this.closeChatSession(session._id, false, 'inactive_timeout');
      }
      
      if (inactiveSessions.length > 0) {
        console.log(`[Cleanup] Closed ${inactiveSessions.length} inactive sessions`);
      }
    } catch (error) {
      console.error('Error in cleanupInactiveSessions:', error);
    }
  }
  
  // Get waiting chats count
  async getWaitingChatsCount() {
    return ChatSession.countDocuments({ 
      status: "waiting",
      created_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes
    });
  }
  
  // Get active chats for attendant
  async getActiveChatsForAttendant(attendantId) {
    return ChatSession.find({
      assigned_to: attendantId,
      status: { $in: ["active", "waiting"] }
    })
    .populate('user_id', 'name email')
    .populate('guest_info')
    .sort({ last_message_at: -1 });
  }
  
  // Get load balancer statistics
  async getLoadBalancerStats() {
    const waitingChats = await this.getWaitingChatsCount();
    
    const attendants = await User.find({
      "extra_roles": "customer_service",
      "chat_availability": true
    });
    
    const attendantsWithStats = await Promise.all(
      attendants.map(async (attendant) => {
        const activeChatCount = await ChatSession.countDocuments({
          assigned_to: attendant._id,
          status: { $in: ["active", "waiting"] }
        });
        
        return {
          id: attendant._id,
          name: attendant.name,
          email: attendant.email,
          activeChats: activeChatCount,
          maxChats: MAX_CHATS_PER_ATTENDANT,
          lastSeen: attendant.last_seen,
          availability: attendant.chat_availability
        };
      })
    );
    
    return {
      waitingChats,
      attendants: attendantsWithStats,
      maxChatsPerAttendant: MAX_CHATS_PER_ATTENDANT,
      autoAssignInterval: AUTO_ASSIGN_INTERVAL,
      maxWaitingTime: MAX_WAITING_TIME,
      inactivityTimeout: INACTIVITY_TIMEOUT
    };
  }
  
  // Reassign chats from offline attendants
  async reassignFromOfflineAttendants() {
    try {
      // Find attendants who haven't been seen in 10 minutes
      const cutoffTime = new Date(Date.now() - 10 * 60 * 1000);
      
      const offlineAttendants = await User.find({
        "extra_roles": "customer_service",
        $or: [
          { "last_seen": { $lt: cutoffTime } },
          { "chat_availability": false }
        ]
      });
      
      if (offlineAttendants.length === 0) {
        return;
      }
      
      const offlineAttendantIds = offlineAttendants.map(a => a._id);
      
      // Find active chats assigned to offline attendants
      const chatsToReassign = await ChatSession.find({
        assigned_to: { $in: offlineAttendantIds },
        status: { $in: ["active", "waiting"] },
        last_message_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) } // Last 30 minutes
      });
      
      if (chatsToReassign.length === 0) {
        return;
      }
      
      console.log(`Found ${chatsToReassign.length} chats to reassign from offline attendants`);
      
      // Reassign each chat
      for (const chat of chatsToReassign) {
        await this.reassignChat(chat._id);
      }
    } catch (error) {
      console.error("Error reassigning from offline attendants:", error);
    }
  }
  
  // Reassign a specific chat
  async reassignChat(sessionId) {
    try {
      // Get current chat info
      const chat = await ChatSession.findById(sessionId);
      if (!chat) {
        throw new AppError(`Chat ${sessionId} not found`);
      }
      
      // Unassign from current attendant
      await ChatSession.findByIdAndUpdate(sessionId, {
        assigned_to: null,
        status: "waiting",
        last_message_at: new Date()
      });
      
      // Send system message
      await this.sendSystemMessage(
        sessionId,
        "Your previous support agent has gone offline. Reassigning you to a new agent..."
      );
      
      // Try to reassign
      const newAttendant = await this.assignChatToAvailableAttendant(sessionId);
      
      if (newAttendant) {
        await this.sendSystemMessage(
          sessionId,
          `You have been reassigned to ${newAttendant.name || 'a new support agent'}.`
        );
      }
      
      return true;
    } catch (error) {
      console.error(`Error reassigning chat ${sessionId}:`, error);
      return false;
    }
  }
  
  // Upload file handler
  async uploadFile(file, userId, sessionId = null) {
    try {
      if (!file) {
        throw new AppError("No file provided");
      }
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new AppError(`File size too large (max ${maxSize / 1024 / 1024}MB)`);
      }
      
      // Allowed file types
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (!allowedTypes.includes(file.mimetype)) {
        throw new AppError('File type not allowed');
      }
      
      // Generate unique filename
      const fileExt = path.extname(file.name) || '.bin';
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFileName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${safeFileName}`;
      const filePath = path.join(FILE_UPLOAD_PATH, uniqueFileName);
      const absolutePath = path.join(process.cwd(), filePath);
      
      // Ensure directory exists
      const dir = path.dirname(absolutePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Save file
      if (file.data) {
        // For buffer data
        fs.writeFileSync(absolutePath, file.data);
      } else if (file.tempFilePath) {
        // For temporary file path
        fs.copyFileSync(file.tempFilePath, absolutePath);
      } else {
        throw new AppError('Unsupported file format');
      }
      
      // Return file info
      return {
        filename: file.name,
        original_name: file.name,
        url: `/uploads/chat/${uniqueFileName}`,
        path: filePath,
        size: file.size,
        mime_type: file.mimetype,
        uploaded_at: new Date(),
        uploaded_by: userId
      };
    } catch (error) {
      console.error('File upload error:', error);
      throw new AppError(`File upload failed: ${error.message}`);
    }
  }
  
  // Delete uploaded file
  async deleteFile(filePath) {
    try {
      const absolutePath = path.join(process.cwd(), filePath);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error('File deletion error:', error);
      return false;
    }
  }
  
  // Get session statistics
  async getSessionStats(sessionId) {
    try {
      const session = await ChatSession.findById(sessionId)
        .populate('user_id', 'name email')
        .populate('assigned_to', 'name email')
        .populate('guest_info');
      
      if (!session) {
        throw new AppError('Session not found');
      }
      
      const messageCount = await Message.countDocuments({ session_id: sessionId });
      const lastMessage = await Message.findOne({ session_id: sessionId })
        .sort({ created_at: -1 });
      
      return {
        session,
        messageCount,
        lastMessage,
        waitTime: session.assigned_at ? session.assigned_at - session.created_at : null,
        duration: session.closed_at ? session.closed_at - session.created_at : null
      };
    } catch (error) {
      console.error('Error getting session stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
// const chatService = new ChatService();
const chatService = () =>{
  
};
export default chatService;
// [file content end]