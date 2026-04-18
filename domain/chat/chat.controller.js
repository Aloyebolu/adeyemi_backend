// import chatService from "../services/chatService.js";
// import ChatSession from "../models/ChatSession.js";
// import Message from "../models/Message.js";

import buildResponse from "#utils/responseBuilder.js";
import User from "#domain/user/user.model.js";
import ChatSession from "./chat.model.js";
import chatService from "./chat.service.js";
import path from "path";

export const chatController = {
  
  // Get user's active chats
  getMyChats: async (req, res) => {
    try {
      const userId = req.user._id;
      
      const chats = await ChatSession.find({
        $or: [
          { user_id: userId },
          { assigned_to: userId }
        ],
        status: { $ne: "closed" }
      })
      .sort({ last_message_at: -1 })
      .populate('user_id', 'name email')
      .populate('assigned_to', 'name email');
      
      buildResponse.success(res, "Fetch Success", chats, 200);
    } catch (error) {
      buildResponse.error(res, error.message, 500, error);
    }
  },
  
  // Get chat history
  getChatHistory: async (req, res) => {
    try {
      const { session_id } = req.params;
      const messages = await chatService.getChatHistory(session_id);
      
      buildResponse.success(res, "Chat history retrieved successfully", messages, 200);
    } catch (error) {
      buildResponse.error(res, error.message, 500, error);
    }
  },
  
  // Admin: Get all active chats
  getAllActiveChats: async (req, res) => {
    try {
      const chats = await ChatSession.find({
        status: { $in: ["active", "waiting"] }
      })
      .populate('user_id', 'name email')
      .populate('assigned_to', 'name email')
      .sort({ created_at: -1 });
      
      const waitingCount = await chatService.getWaitingChatsCount();
      
      buildResponse.success(res, "Active chats retrieved successfully", {
        chats,
        stats: {
          active: chats.filter(c => c.status === "active").length,
          waiting: waitingCount,
          total: chats.length
        }
      }, 200);
    } catch (error) {
      buildResponse.error(res, error.message, 500, error);
    }
  },
  
  // Admin: Assign chat to attendant
  assignChat: async (req, res) => {
    try {
      const { session_id, attendant_id } = req.body;
      
      const session = await ChatSession.findByIdAndUpdate(
        session_id,
        {
          assigned_to: attendant_id,
          status: "active"
        },
        { new: true }
      );
      
      // Send system message
      await chatService.sendSystemMessage(
        session_id,
        "Your chat has been assigned to a support agent."
      );
      
      buildResponse.success(res, "Chat assigned successfully", session, 200);
    } catch (error) {
      buildResponse.error(res, error.message, 500, error);
    }
  },
  
  // Get available attendants
  getAvailableAttendants: async (req, res) => {
    try {
      const attendants = await User.find({
        "extra_roles": "customer_service",
        "chat_availability": true,
        "last_seen": { $gte: new Date(Date.now() - 5 * 60 * 1000) }
      })
      .select('name email role extra_roles last_seen')
      .sort({ last_seen: -1 });
      
      buildResponse.success(res, "Available attendants retrieved successfully", attendants, 200);
    } catch (error) {
      buildResponse.error(res, error.message, 500, error);
    }
  },
  
  // Upload chat file
  uploadFile: async (req, res) => {
    try {
      if (!req.files || !req.files.file) {
        return buildResponse.error(res, "No file uploaded", 400);
      }
      
      const file = req.files.file;
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (file.size > maxSize) {
        return buildResponse.error(res, "File size too large (max 10MB)", 400);
      }
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `chat_${Date.now()}_${Math.random().toString(36).substr(2)}.${fileExt}`;
      
      // In production, upload to cloud storage (AWS S3, Cloudinary, etc.)
      // For now, save to uploads directory
      const uploadPath = path.join(process.cwd(), 'uploads', 'chat', fileName);
      
      await file.mv(uploadPath);
      
      const fileUrl = `/uploads/chat/${fileName}`;
      
      buildResponse.success(res, "File uploaded successfully", {
        filename: file.name,
        url: fileUrl,
        size: file.size,
        mime_type: file.mimetype
      }, 200);
    } catch (error) {
      buildResponse.error(res, error.message, 500, error);
    }
  }
};