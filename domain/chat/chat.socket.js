// [file name]: chat.socket.js
// [file content begin]
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import chatService from "./chat.service.js";
import User from "../user/user.model.js";
import AppError from "../errors/AppError.js";
import { setSocketInstance } from "../computation/realtime/socketGateway.js";
import { cookie } from "express-validator";
import { allowedOrigins } from "../../app.js";
// import { cookie } from "cookie";

// Store active socket connections
const activeConnections = new Map(); // userId -> socket
const sessionConnections = new Map(); // sessionId -> [socketIds]
const userSessions = new Map(); // userId -> sessionId (for single session enforcement)

export const setupSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 30000,
    pingInterval: 10000
  });

  setSocketInstance(io);

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // 1️⃣ Parse cookies from handshake headers
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies["access_token"]; // match the cookie name

      if (!token) {
        // Guest fallback
        console.log("no token")
        socket.user = { guest: true };
        return next();
      }

      // 2️⃣ Verify JWT token
      const decoded = jwt.verify(token, process.env.TOKEN_KEY);
      socket.user = decoded;

      next();
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Authentication error"));
    }
  });


  io.on("connection", (socket) => {
    console.log(`New socket connection: ${socket.id}, User: ${socket.user?._id || 'guest'}`);

    // Store connection if authenticated user
    if (socket.user && socket.user._id) {
      activeConnections.set(socket.user._id, socket.id);

      // Update user last seen
      updateUserLastSeen(socket.user._id);

      // If user already has active session, notify them
      const existingSession = userSessions.get(socket.user._id);
      if (existingSession) {
        socket.emit("existing_session", { session_id: existingSession });
      }
    }

    // Join user to their room
    if (socket.user && socket.user._id) {
      socket.join(`user_${socket.user._id}`);
    }

    // ========== CHAT EVENTS ==========

    // Subscribe to system channels
    socket.on("subscribe", ({ channel, scopeId }) => {

      if (channel) {
        socket.join(`channel_${channel}`);
      }

      if (scopeId) {
        socket.join(`scope_${scopeId}`);
      }

    });
    socket.on("unsubscribe", ({ channel, scopeId }) => {

      if (channel) {
        socket.leave(`channel_${channel}`);
      }

      if (scopeId) {
        socket.leave(`scope_${scopeId}`);
      }

    });

    // Start new chat - with callback parameter check
    socket.on("start_chat", async (data, callback) => {
      try {
        // Handle missing callback
        if (!callback || typeof callback !== 'function') {
          // Use emit instead
          socket.emit("error", { event: "start_chat", error: "Callback function required" });
          return;
        }

        const sessionData = {
          department: data.department || "general",
          metadata: {
            page_url: data.page_url,
            browser: data.browser,
            os: data.os,
            device: data.device
          }
        };

        // Check if user already has active session
        if (socket.user && socket.user._id) {
          const existingSession = userSessions.get(socket.user._id);
          if (existingSession) {
            return callback({
              success: true,
              session_id: existingSession,
              existing: true,
              message: "Returning to existing session"
            });
          }
        }

        // Set user info based on authentication
        if (socket.user && socket.user._id) {
          sessionData.user_id = socket.user._id;
        } else {
          // Guest user must provide email
          if (!data.email) {
            return callback({ error: "Email is required for guest users" });
          }

          sessionData.email = data.email;
          sessionData.name = data.name;
          sessionData.phone = data.phone;
          sessionData.ip_address = socket.handshake.address;
          sessionData.user_agent = socket.handshake.headers['user-agent'];
        }

        const session = await chatService.createChatSession(sessionData);

        // Track user session
        if (socket.user && socket.user._id) {
          userSessions.set(socket.user._id, session._id);
        }

        // Join session room
        socket.join(`session_${session._id}`);
        sessionConnections.set(session._id, [
          ...(sessionConnections.get(session._id) || []),
          socket.id
        ]);

        callback({
          success: true,
          session_id: session._id,
          status: session.status,
          existing: false
        });

        // Notify attendants about new chat
        if (session.status === "waiting") {
          io.to("attendants_room").emit("new_chat_waiting", {
            session_id: session._id,
            waiting_count: await chatService.getWaitingChatsCount(),
            user_name: sessionData.name || "Guest User"
          });
        }
      } catch (error) {
        console.error("Error starting chat:", error);
        // Check if callback exists before calling
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        } else {
          socket.emit("error", { event: "start_chat", error: error.message });
        }
      }
    });

    // Send message - with callback parameter check
    socket.on("send_message", async (data, callback) => {
      try {
        // Handle missing callback
        if (!callback || typeof callback !== 'function') {
          socket.emit("error", { event: "send_message", error: "Callback function required" });
          return;
        }

        const { session_id, content, attachments } = data;

        if (!session_id || !content) {
          return callback({ error: "Session ID and content are required" });
        }

        const senderData = {
          sender_type: socket.user?.guest ? "user" :
            socket.user?.extra_roles?.includes("customer_service") ? "attendant" : "user",
          sender_id: socket.user?._id
        };

        const message = await chatService.sendMessage(
          session_id,
          senderData,
          content,
          attachments
        );

        // Broadcast to all in session room EXCEPT sender
        socket.to(`session_${session_id}`).emit("new_message", {
          message,
          sender: socket.user
        });

        // Also send to sender (but without typing indicator logic)
        socket.emit("new_message", {
          message,
          sender: socket.user,
          isOwn: true
        });

        // If attendant sent message, mark as delivered
        if (senderData.sender_type === "attendant") {
          socket.to(`session_${session_id}`).emit("message_delivered", {
            message_id: message._id
          });
        }

        callback({ success: true, message });
      } catch (error) {
        console.error("Error sending message:", error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        } else {
          socket.emit("error", { event: "send_message", error: error.message });
        }
      }
    });

    // Typing indicator - FIXED: Don't show to sender
    socket.on("typing", (data) => {
      const { session_id, is_typing } = data;
      // Broadcast to everyone in the session EXCEPT the sender
      socket.to(`session_${session_id}`).emit("user_typing", {
        user_id: socket.user?._id,
        user_name: socket.user?.name || "User",
        is_typing,
        session_id,
        sender_type: socket.user?.extra_roles?.includes("customer_service") ? "attendant" : "user"
      });
    });

    // Join session room
    socket.on("join_session", (data) => {
      const { session_id } = data;
      socket.join(`session_${session_id}`);

      // Track session connection
      const connections = sessionConnections.get(session_id) || [];
      if (!connections.includes(socket.id)) {
        sessionConnections.set(session_id, [...connections, socket.id]);
      }
    });

    // Leave session room
    socket.on("leave_session", (data) => {
      const { session_id } = data;
      socket.leave(`session_${session_id}`);

      // Remove from session connections
      const connections = sessionConnections.get(session_id) || [];
      const newConnections = connections.filter(id => id !== socket.id);
      if (newConnections.length === 0) {
        sessionConnections.delete(session_id);
      } else {
        sessionConnections.set(session_id, newConnections);
      }
    });

    // Join as attendant - with callback parameter check
    socket.on("join_as_attendant", async (callback) => {
      try {
        // Handle missing callback
        if (!callback || typeof callback !== 'function') {
          socket.emit("error", { event: "join_as_attendant", error: "Callback function required" });
          return;
        }

        if (!socket.user?.extra_roles?.includes("customer_service")) {
          //   return callback({ error: "Not authorized as attendant" });
        }

        // Join attendants room
        socket.join("attendants_room");

        // Update user availability
        await updateUserAvailability(socket.user._id, true);

        // Get active chats
        const activeChats = await chatService.getActiveChatsForAttendant(socket.user._id);

        // Join all active session rooms
        activeChats.forEach(chat => {
          socket.join(`session_${chat._id}`);
        });

        callback({
          success: true,
          active_chats: activeChats,
          waiting_count: await chatService.getWaitingChatsCount()
        });
      } catch (error) {
        console.error("Error joining as attendant:", error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        } else {
          socket.emit("error", { event: "join_as_attendant", error: error.message });
        }
      }
    });

    // Leave as attendant
    socket.on("leave_attendant", async (data, callback) => {
      try {
        if (socket.user?._id) {
          await updateUserAvailability(socket.user._id, false);

          // Leave attendants room
          socket.leave("attendants_room");

          if (callback && typeof callback === 'function') {
            callback({ success: true });
          }
        }
      } catch (error) {
        console.error("Error leaving attendant mode:", error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    // Mark messages as read - callback is optional here
    socket.on("mark_read", async (data, callback) => {
      try {
        const { session_id, message_ids } = data;

        if (!session_id || !message_ids || !Array.isArray(message_ids)) {
          if (callback && typeof callback === 'function') {
            return callback({ error: "Session ID and message IDs array are required" });
          }
          return;
        }

        if (socket.user?._id) {
          await chatService.markAsRead(session_id, socket.user._id, message_ids);

          // Notify other participants
          socket.to(`session_${session_id}`).emit("messages_read", {
            user_id: socket.user._id,
            user_name: socket.user.name,
            message_ids
          });

          if (callback && typeof callback === 'function') {
            callback({ success: true });
          }
        }
      } catch (error) {
        console.error("Error marking messages as read:", error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    // Close chat - with callback parameter check
    socket.on("close_chat", async (data, callback) => {
      try {
        // Handle missing callback
        if (!callback || typeof callback !== 'function') {
          socket.emit("error", { event: "close_chat", error: "Callback function required" });
          return;
        }

        const { session_id, resolved } = data;

        if (!session_id) {
          return callback({ error: "Session ID is required" });
        }

        const session = await chatService.closeChatSession(session_id, resolved, 'manual');

        // Clean up user session tracking
        if (session.user_id) {
          userSessions.delete(session.user_id.toString());
        }

        // Notify all in session
        io.to(`session_${session_id}`).emit("chat_closed", {
          session_id,
          status: session.status,
          reason: 'manual'
        });

        // Clear session connections
        sessionConnections.delete(session_id);

        callback({ success: true, session });
      } catch (error) {
        console.error("Error closing chat:", error);
        if (callback && typeof callback === 'function') {
          callback({ error: error.message });
        } else {
          socket.emit("error", { event: "close_chat", error: error.message });
        }
      }
    });

    // Disconnect handler
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      // Remove from active connections
      if (socket.user && socket.user._id) {
        activeConnections.delete(socket.user._id);

        // Update last seen
        await updateUserLastSeen(socket.user._id);

        // If attendant, set as unavailable
        if (socket.user.extra_roles?.includes("customer_service")) {
          await updateUserAvailability(socket.user._id, false);
        }

        // Check if user has any active socket connections left
        const hasOtherConnections = Array.from(activeConnections.entries())
          .some(([userId, socketId]) => userId === socket.user._id && socketId !== socket.id);

        if (!hasOtherConnections) {
          // User fully disconnected, clean up after delay
          setTimeout(async () => {
            const stillDisconnected = !Array.from(activeConnections.keys())
              .includes(socket.user._id);

            if (stillDisconnected) {
              await handleUserDisconnected(socket.user._id);
            }
          }, 30000); // 30 second grace period
        }
      }
    });

    // Heartbeat/ping
    socket.on("ping", () => {
      socket.emit("pong", { timestamp: Date.now() });

      if (socket.user && socket.user._id) {
        updateUserLastSeen(socket.user._id);
      }
    });
  });

  return io;
};

// Helper functions
async function updateUserLastSeen(userId) {
  try {
    await User.findByIdAndUpdate(userId, {
      last_seen: new Date()
    });
  } catch (error) {
    console.error("Error updating user last seen:", error);
  }
}

async function updateUserAvailability(userId, isAvailable) {
  try {
    await User.findByIdAndUpdate(userId, {
      chat_availability: isAvailable,
      last_seen: new Date()
    });
  } catch (error) {
    console.error("Error updating user availability:", error);
  }
}

async function handleUserDisconnected(userId) {
  try {
    console.log(`User ${userId} fully disconnected, checking for session cleanup`);

    // Find user's active session
    const activeSession = await ChatSession.findOne({
      user_id: userId,
      status: { $in: ['active', 'waiting'] }
    });

    if (activeSession) {
      // Check if session has been inactive
      const lastMessageTime = activeSession.last_message_at;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      if (lastMessageTime < fiveMinutesAgo) {
        // Close session due to user disconnect and inactivity
        const chatServiceInstance = new (require('./chat.service.js'))();
        await chatServiceInstance.closeChatSession(activeSession._id, false, 'user_disconnected');
      }
    }

    // Remove from user sessions tracking
    userSessions.delete(userId);
  } catch (error) {
    console.error("Error handling user disconnect:", error);
  }
}
// [file content end]