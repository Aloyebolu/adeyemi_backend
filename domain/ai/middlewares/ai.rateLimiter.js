// src/modules/ai/middlewares/ai.rateLimiter.js

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for AI chat endpoints
 * Prevents abuse and excessive usage
 */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again in a minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admins in development
    if (process.env.NODE_ENV === 'development' && req.user?.role === 'admin') {
      return true;
    }
    return false;
  },
  keyGenerator: (req) => {
    // Use user ID if authenticated, otherwise IP
    return req.user?._id?.toString() || req.ip;
  },
});

/**
 * Stricter rate limiter for heavy operations (exports, analysis)
 */
export const heavyOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    message: 'Too many heavy operations. Please wait before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Per-conversation rate limiter (optional)
 */
export class ConversationRateLimiter {
  constructor() {
    this.conversationLimits = new Map(); // conversationId -> { count, resetTime }
    this.windowMs = 60 * 1000;
    this.maxRequests = 50;
  }
  
  checkLimit(conversationId) {
    const now = Date.now();
    const limit = this.conversationLimits.get(conversationId);
    
    if (!limit) {
      this.conversationLimits.set(conversationId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }
    
    if (now > limit.resetTime) {
      // Reset window
      this.conversationLimits.set(conversationId, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }
    
    if (limit.count >= this.maxRequests) {
      return false;
    }
    
    limit.count++;
    return true;
  }
  
  cleanup() {
    const now = Date.now();
    for (const [id, limit] of this.conversationLimits.entries()) {
      if (now > limit.resetTime) {
        this.conversationLimits.delete(id);
      }
    }
  }
}

// Cleanup expired limits every minute
const conversationLimiter = new ConversationRateLimiter();
setInterval(() => conversationLimiter.cleanup(), 60 * 1000);

export const perConversationLimiter = (req, res, next) => {
  const conversationId = req.body.conversation_id || req.params.id;
  
  if (!conversationId) {
    return next();
  }
  
  if (!conversationLimiter.checkLimit(conversationId)) {
    return res.status(429).json({
      success: false,
      message: 'Too many requests for this conversation. Please wait a moment.',
    });
  }
  
  next();
};