// src/modules/ai/services/ai.audit.service.js

import AuditLog from '../models/audit.log.model.js';

class AIAuditService {
  constructor() {
    this.buffer = [];
    this.bufferSize = 100;
    this.flushInterval = 60000; // 1 minute
    this.startPeriodicFlush();
  }
  
  /**
   * Log an AI interaction
   */
  async log(entry) {
    const logEntry = {
      ...entry,
      timestamp: new Date(),
    };
    
    // Buffer for batch writes
    this.buffer.push(logEntry);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }
  
  /**
   * Log query execution
   */
  async logQuery(userId, query, result, duration, success = true) {
    await this.log({
      type: 'query',
      user_id: userId,
      action: 'execute_query',
      details: {
        query: this.sanitizeQuery(query),
        result_count: Array.isArray(result) ? result.length : 1,
        duration_ms: duration,
        success,
      },
      metadata: {
        timestamp: new Date(),
        ip: this.getClientIP(),
      },
    });
  }
  
  /**
   * Log action execution
   */
  async logAction(userId, action, payload, result, success = true) {
    await this.log({
      type: 'action',
      user_id: userId,
      action: action.endpoint,
      details: {
        endpoint: action.endpoint,
        method: action.method,
        payload: this.sanitizePayload(payload),
        result: success ? result : null,
        error: !success ? result : null,
      },
      metadata: {
        timestamp: new Date(),
        ip: this.getClientIP(),
      },
    });
  }
  
  /**
   * Log AI conversation
   */
  async logConversation(userId, conversationId, message, response, intent) {
    await this.log({
      type: 'conversation',
      user_id: userId,
      conversation_id: conversationId,
      action: 'chat',
      details: {
        message_length: message.length,
        response_length: response?.length || 0,
        intent: intent,
      },
      metadata: {
        timestamp: new Date(),
      },
    });
  }
  
  /**
   * Log error
   */
  async logError(userId, error, context = {}) {
    await this.log({
      type: 'error',
      user_id: userId,
      action: 'error',
      details: {
        error: error.message,
        stack: error.stack,
        context,
      },
      metadata: {
        timestamp: new Date(),
        severity: 'error',
      },
    });
  }
  
  /**
   * Get audit logs for a user
   */
  async getUserLogs(userId, options = {}) {
    const {
      type = null,
      startDate = null,
      endDate = null,
      limit = 100,
      offset = 0,
    } = options;
    
    const query = { user_id: userId };
    
    if (type) query.type = type;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = startDate;
      if (endDate) query.timestamp.$lte = endDate;
    }
    
    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);
    
    return { logs, total, limit, offset };
  }
  
  /**
   * Get audit statistics
   */
  async getStatistics(userId, timeRange = '24h') {
    const startDate = this.getStartDate(timeRange);
    
    const stats = await AuditLog.aggregate([
      {
        $match: {
          user_id: userId,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);
    
    const result = {};
    for (const stat of stats) {
      result[stat._id] = stat.count;
    }
    
    return result;
  }
  
  /**
   * Flush buffer to database
   */
  async flush() {
    if (this.buffer.length === 0) return;
    
    const logs = [...this.buffer];
    this.buffer = [];
    
    try {
      await AuditLog.insertMany(logs);
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-add to buffer
      this.buffer.unshift(...logs);
    }
  }
  
  /**
   * Start periodic flush
   */
  startPeriodicFlush() {
    setInterval(async () => {
      await this.flush();
    }, this.flushInterval);
  }
  
  /**
   * Sanitize query for logging (remove sensitive data)
   */
  sanitizeQuery(query) {
    const sensitive = ['password', 'token', 'secret'];
    const sanitized = { ...query };
    
    const sanitizeObject = (obj) => {
      for (const key of Object.keys(obj)) {
        if (sensitive.includes(key)) {
          obj[key] = '********';
        } else if (typeof obj[key] === 'object') {
          sanitizeObject(obj[key]);
        }
      }
    };
    
    sanitizeObject(sanitized);
    return sanitized;
  }
  
  /**
   * Sanitize payload for logging
   */
  sanitizePayload(payload) {
    const sensitive = ['password', 'token', 'secret', 'currentPassword', 'newPassword'];
    const sanitized = { ...payload };
    
    for (const key of sensitive) {
      if (sanitized[key]) {
        sanitized[key] = '********';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Get client IP from request context
   */
  getClientIP() {
    // In production, get from request object
    return 'unknown';
  }
  
  /**
   * Get start date for time range
   */
  getStartDate(timeRange) {
    const now = new Date();
    switch (timeRange) {
      case '1h':
        return new Date(now - 60 * 60 * 1000);
      case '24h':
        return new Date(now - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now - 24 * 60 * 60 * 1000);
    }
  }
}

export default new AIAuditService();