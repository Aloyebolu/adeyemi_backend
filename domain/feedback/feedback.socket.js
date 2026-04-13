import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import feedbackService from "./feedback.service.js";
import Feedback from "./feedback.model.js";
import AppError from "../errors/AppError.js";

// Store active connections
const activeConnections = new Map(); // userId -> socketId
const staffConnections = new Set(); // staff socket IDs

export const setupFeedbackSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      credentials: true
    },
    path: '/socket/feedback',
    transports: ['websocket', 'polling']
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        // Allow limited guest connections for feedback status
        socket.user = { guest: true };
        return next();
      }
      
      const decoded = jwt.verify(token, process.env.TOKEN_KEY);
      socket.user = decoded;
      next();
    } catch (error) {
      console.error("Feedback socket auth error:", error);
      next(new AppError("Authentication error"));
    }
  });
  
  io.on("connection", (socket) => {
    console.log(`Feedback socket connected: ${socket.id}, User: ${socket.user?._id || 'guest'}`);
    
    // Store connection
    if (socket.user?._id) {
      activeConnections.set(socket.user._id, socket.id);
    }
    
    // Check if staff
    const isStaff = socket.user?.extra_roles?.includes('admin') || 
                    socket.user?.extra_roles?.includes('customer_service');
    
    if (isStaff) {
      staffConnections.add(socket.id);
      socket.join('staff_room');
    }
    
    // Join user to their personal room
    if (socket.user?._id) {
      socket.join(`user_${socket.user._id}`);
    }
    
    // ========== FEEDBACK EVENTS ==========
    
    // Submit feedback via socket
    socket.on("submit_feedback", async (data, callback) => {
      try {
        if (!callback || typeof callback !== 'function') {
          socket.emit("error", { event: "submit_feedback", error: "Callback required" });
          return;
        }
        
        const feedbackData = {
          ...data,
          user_id: socket.user?._id,
          ip_address: socket.handshake.address,
          user_agent: socket.handshake.headers['user-agent']
        };
        
        const feedback = await feedbackService.createFeedback(feedbackData);
        
        // Notify staff if it's urgent or high priority
        if (data.priority === 'urgent' || data.type === 'complaint') {
          io.to('staff_room').emit("new_urgent_feedback", {
            feedback_id: feedback._id,
            type: feedback.type,
            subject: feedback.subject,
            user: socket.user?.name || data.name || 'Guest',
            priority: data.priority || 'normal'
          });
        }
        
        // Notify user of submission
        socket.emit("feedback_submitted", {
          feedback_id: feedback._id,
          tracking_id: feedback.feedback_id,
          status: feedback.status
        });
        
        callback({ success: true, feedback });
      } catch (error) {
        console.error("Socket feedback error:", error);
        callback({ error: error.message });
      }
    });
    
    // Join feedback room (for real-time updates)
    socket.on("join_feedback", (data) => {
      const { feedback_id } = data;
      
      // Check permission
      Feedback.findById(feedback_id).then(feedback => {
        const canJoin = isStaff || 
                       (feedback.user_id && feedback.user_id.toString() === socket.user?._id) ||
                       (feedback.guest_info?.email === data.email);
        
        if (canJoin) {
          socket.join(`feedback_${feedback_id}`);
          socket.emit("joined_feedback", { feedback_id });
        } else {
          socket.emit("error", { message: "Not authorized to join this feedback" });
        }
      }).catch(err => {
        socket.emit("error", { message: "Feedback not found" });
      });
    });
    
    // Staff typing indicator on feedback response
    socket.on("staff_typing", (data) => {
      const { feedback_id, is_typing } = data;
      
      if (isStaff) {
        socket.to(`feedback_${feedback_id}`).emit("staff_typing", {
          staff_name: socket.user.name,
          is_typing
        });
      }
    });
    
    // Mark feedback as reviewed (staff only)
    socket.on("mark_reviewed", async (data, callback) => {
      try {
        if (!isStaff) {
          return callback({ error: "Unauthorized" });
        }
        
        const { feedback_id } = data;
        
        await Feedback.findByIdAndUpdate(feedback_id, {
          status: 'reviewed',
          last_updated: new Date()
        });
        
        io.to(`feedback_${feedback_id}`).emit("feedback_updated", {
          feedback_id,
          status: 'reviewed'
        });
        
        callback({ success: true });
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Get feedback count (staff only)
    socket.on("get_feedback_counts", async (callback) => {
      try {
        if (!isStaff) {
          return callback({ error: "Unauthorized" });
        }
        
        const counts = await Feedback.aggregate([
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);
        
        const result = {
          pending: 0,
          reviewed: 0,
          in_progress: 0,
          resolved: 0,
          rejected: 0
        };
        
        counts.forEach(item => {
          result[item._id] = item.count;
        });
        
        callback({ success: true, counts: result });
      } catch (error) {
        callback({ error: error.message });
      }
    });
    
    // Disconnect handler
    socket.on("disconnect", () => {
      console.log(`Feedback socket disconnected: ${socket.id}`);
      
      if (socket.user?._id) {
        activeConnections.delete(socket.user._id);
      }
      
      if (isStaff) {
        staffConnections.delete(socket.id);
      }
    });
  });
  
  return io;
};

// Helper to emit to specific user
export const emitToUser = (userId, event, data) => {
  const socketId = activeConnections.get(userId);
  if (socketId) {
    const io = getIO(); // You'll need to store the io instance
    io.to(socketId).emit(event, data);
  }
};

// Helper to emit to all staff
export const emitToStaff = (event, data) => {
  const io = getIO();
  io.to('staff_room').emit(event, data);
};

// Store io instance
let ioInstance;

export const setIO = (io) => {
  ioInstance = io;
};

export const getIO = () => {
  if (!ioInstance) {
    throw new Error("Socket.io not initialized");
  }
  return ioInstance;
};