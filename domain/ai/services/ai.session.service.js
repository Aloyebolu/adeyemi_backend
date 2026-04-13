// src/modules/ai/services/ai.session.service.js

import mongoose from 'mongoose';
import Conversation from '../models/conversation.model.js';

/**
 * Manages streaming sessions and message buffering
 */
class AISessionService {
  constructor() {
    this.activeSessions = new Map(); // sessionId -> session object
    this.sessionTimeouts = new Map(); // sessionId -> timeout
    this.sessionTimeoutMs = 30 * 60 * 1000; // 30 minutes
  }
  
  /**
   * Create or get a session for a conversation
   */
  async getOrCreateSession(conversationId, userId, sseStream) {
    // Check if session exists
    let session = this.activeSessions.get(conversationId);
    
    if (session) {
      // Reset timeout
      this.resetSessionTimeout(conversationId);
      return session;
    }
    
    // Get or create conversation from database
    let conversation = await Conversation.findById(mongoose.Types.ObjectId(conversationId));
    
    if (!conversation || !conversationId) {
      conversation = new Conversation({
        user_id: userId,
        title: 'New Conversation',
        messages: [],
        context: {},
      });
      await conversation.save();
    }
    
    // Create new session
    session = {
      id: conversationId,
      userId,
      conversation,
      stream: sseStream,
      buffer: [],
      isStreaming: false,
      isFinalized: false,
      lastActivity: Date.now(),
      status: 'idle', // idle, thinking, querying, analyzing, streaming
      
      // Buffering for streaming
      addToBuffer: (chunk) => {
        session.buffer.push(chunk);
      },
      
      // Flush buffer to database on completion
      flushToDatabase: async () => {
        if (session.isFinalized) return;
        
        const fullContent = session.buffer.map(c => c.text || c.content || '').join('');
        
        if (fullContent.trim()) {
          // Add assistant message to conversation
          conversation.addMessage('assistant', fullContent);
          
          // Save any actions from buffer
          const actions = session.buffer.filter(c => c.type === 'action');
          if (actions.length > 0) {
            const lastMessage = conversation.messages[conversation.messages.length - 1];
            if (lastMessage) {
              lastMessage.actions = actions.map(a => a.action);
            }
          }
          
          await conversation.save();
        }
        
        session.isFinalized = true;
        session.buffer = [];
      },
      
      // Send status update
      sendStatus: (text, type = 'status') => {
        const statusChunk = {
          type,
          text,
          timestamp: new Date().toISOString(),
        };
        session.sendToStream(statusChunk);
      },
      
      // Send content chunk
      sendContent: (text) => {
        const contentChunk = {
          type: 'content',
          text,
          timestamp: new Date().toISOString(),
        };
        session.sendToStream(contentChunk);
        session.addToBuffer(contentChunk);
      },
      
      // Send action
      sendAction: (action, description = null) => {
        const actionChunk = {
          type: 'action',
          action,
          text: description || action.description,
          timestamp: new Date().toISOString(),
        };
        session.sendToStream(actionChunk);
        session.addToBuffer(actionChunk);
      },
      
      // Send error
      sendError: (error) => {
        const errorChunk = {
          type: 'error',
          text: `❌ ${error}`,
          timestamp: new Date().toISOString(),
        };
        session.sendToStream(errorChunk);
        session.addToBuffer(errorChunk);
      },
      
      // Send to SSE stream
      sendToStream: (data) => {
        if (session.stream && !session.stream.destroyed) {
          session.stream.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      },
      
      // End stream
      endStream: () => {
        if (session.stream && !session.stream.destroyed) {
          session.stream.write('event: end\ndata: [DONE]\n\n');
          session.stream.end();
        }
      },
    };
    
    this.activeSessions.set(conversationId, session);
    this.setSessionTimeout(conversationId);
    
    return session;
  }
  
  /**
   * Set timeout to clean up inactive session
   */
  setSessionTimeout(sessionId) {
    const timeout = setTimeout(() => {
      this.cleanupSession(sessionId);
    }, this.sessionTimeoutMs);
    
    this.sessionTimeouts.set(sessionId, timeout);
  }
  
  /**
   * Reset session timeout
   */
  resetSessionTimeout(sessionId) {
    const existingTimeout = this.sessionTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    this.setSessionTimeout(sessionId);
  }
  
  /**
   * Clean up inactive session
   */
  async cleanupSession(sessionId) {
    const session = this.activeSessions.get(sessionId);
    
    if (session) {
      // Flush any pending buffer
      if (!session.isFinalized && session.buffer.length > 0) {
        await session.flushToDatabase();
      }
      
      // End stream if still open
      if (session.stream && !session.stream.destroyed) {
        session.endStream();
      }
      
      this.activeSessions.delete(sessionId);
      this.sessionTimeouts.delete(sessionId);
      
      console.log(`Session ${sessionId} cleaned up`);
    }
  }
  
  /**
   * Get active session
   */
  getSession(sessionId) {
    return this.activeSessions.get(sessionId);
  }
  
  /**
   * Update session status
   */
  updateStatus(sessionId, status) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = status;
      session.lastActivity = Date.now();
      this.resetSessionTimeout(sessionId);
    }
  }
  
  /**
   * Check if session is active
   */
  isActive(sessionId) {
    return this.activeSessions.has(sessionId);
  }
  
  /**
   * Get all active sessions for a user
   */
  getUserSessions(userId) {
    const sessions = [];
    for (const [id, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        sessions.push({ id, ...session });
      }
    }
    return sessions;
  }
}

export default new AISessionService();