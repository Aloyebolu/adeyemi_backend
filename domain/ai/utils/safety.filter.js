// src/modules/ai/utils/safety.filter.js

class SafetyFilter {
  constructor() {
    this.sensitiveFields = [
      'password',
      'passwordHistory',
      'recentDevices',
      'created_by',
      'created_by_source',
      'deleted_by',
      'resetToken',
      'verificationToken',
      'apiKey',
      'secret',
      'token',
      'privateKey',
    ];
    
    this.piiFields = [
      'email',
      'phone',
      'address',
      'dateOfBirth',
      'nationalId',
      'passportNumber',
    ];
    
    this.dangerousOperators = [
      '$where',
      '$eval',
      '$function',
      '$regex', // Can cause DoS if not careful
    ];
  }
  
  /**
   * Filter sensitive data from results
   */
  filterSensitiveData(data, userRole = 'user') {
    if (!data) return data;
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.filterSensitiveData(item, userRole));
    }
    
    // Handle objects
    if (typeof data === 'object') {
      const filtered = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields
        if (this.sensitiveFields.includes(key)) {
          continue;
        }
        
        // Mask PII for non-admins
        if (!this.isAdmin(userRole) && this.piiFields.includes(key)) {
          filtered[key] = this.maskValue(value);
          continue;
        }
        
        // Recursively filter nested objects
        if (typeof value === 'object' && value !== null) {
          filtered[key] = this.filterSensitiveData(value, userRole);
        } else {
          filtered[key] = value;
        }
      }
      
      return filtered;
    }
    
    return data;
  }
  
  /**
   * Validate query for safety
   */
  validateQuery(query) {
    const issues = [];
    const stringified = JSON.stringify(query);
    
    // Check for dangerous operators
    for (const operator of this.dangerousOperators) {
      if (stringified.includes(operator)) {
        // issues.push(`Dangerous operator detected: ${operator}`);
      }
    }
    
    // Check for regex that could cause DoS
    if (query.query && query.query.$regex) {
      const regex = query.query.$regex;
      if (typeof regex === 'string' && regex.length > 100) {
        // issues.push('Regex pattern too long, possible DoS attack');
      }
    }
    
    // Check for large limits
    if (query.limit && query.limit > 10000) {
    //   issues.push('Limit exceeds maximum allowed (10000)');
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
  
  /**
   * Sanitize user input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    
    // Remove potential injection patterns
    let sanitized = input;
    
    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove SQL-like injection patterns
    sanitized = sanitized.replace(/(?:DROP|DELETE|INSERT|UPDATE|SELECT)\s+/gi, '');
    
    // Limit length
    sanitized = sanitized.slice(0, 5000);
    
    return sanitized;
  }
  
  /**
   * Mask sensitive value
   */
  maskValue(value) {
    if (!value) return '***';
    
    const str = String(value);
    if (str.length <= 3) return '***';
    
    const visible = Math.min(3, Math.floor(str.length / 3));
    return str.slice(0, visible) + '***' + str.slice(-visible);
  }
  
  /**
   * Check if user is admin
   */
  isAdmin(userRole) {
    const adminRoles = ['admin', 'super_admin', 'system'];
    return adminRoles.includes(userRole);
  }
  
  /**
   * Rate limit check (simple token bucket)
   */
  checkRateLimit(userId, action, limits = {}) {
    // In production, implement with Redis
    // For now, return true
    return true;
  }
  
  /**
   * Validate data size
   */
  validateDataSize(data, maxSize = 10 * 1024 * 1024) { // 10MB default
    const size = JSON.stringify(data).length;
    
    if (size > maxSize) {
      return {
        valid: false,
        message: `Data size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds limit (${(maxSize / 1024 / 1024).toFixed(0)}MB)`,
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Detect potential prompt injection
   */
  detectPromptInjection(input) {
    const injectionPatterns = [
      /ignore previous instructions/i,
      /forget everything/i,
      /you are now/i,
      /act as/i,
      /system prompt/i,
      /override/i,
      /bypass/i,
    ];
    
    for (const pattern of injectionPatterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          pattern: pattern.source,
        };
      }
    }
    
    return { detected: false };
  }
  
  /**
   * Validate export request
   */
  validateExportRequest(data, format) {
    const errors = [];
    
    // Check data size
    if (data.length > 50000) {
      errors.push('Too many records for export (max 50,000)');
    }
    
    // Check format
    const validFormats = ['excel', 'csv', 'json'];
    if (!validFormats.includes(format)) {
      errors.push(`Invalid export format. Must be one of: ${validFormats.join(', ')}`);
    }
    
    // Check for sensitive data in export
    const hasSensitive = this.checkForSensitiveData(data);
    if (hasSensitive && !this.isAdmin('user')) {
      errors.push('Export contains sensitive data that you cannot access');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Check for sensitive data in dataset
   */
  checkForSensitiveData(data) {
    if (!data || data.length === 0) return false;
    
    const sample = data[0];
    for (const field of this.sensitiveFields) {
      if (sample[field] !== undefined) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Generate safe filename
   */
  safeFilename(original) {
    return original
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 100);
  }
  
  /**
   * Validate MongoDB ObjectId
   */
  isValidObjectId(id) {
    if (!id || typeof id !== 'string') return false;
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
  
  /**
   * Sanitize aggregation pipeline
   */
  sanitizePipeline(pipeline) {
    if (!Array.isArray(pipeline)) return [];
    
    const allowedStages = [
      '$match',
      '$group',
      '$sort',
      '$limit',
      '$skip',
      '$project',
      '$lookup',
      '$unwind',
      '$addFields',
      '$facet',
      '$bucket',
    ];
    
    return pipeline.filter(stage => {
      const stageName = Object.keys(stage)[0];
      return allowedStages.includes(stageName);
    });
  }
}

export default new SafetyFilter();
