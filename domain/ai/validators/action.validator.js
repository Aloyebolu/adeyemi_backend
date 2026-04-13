// src/modules/ai/validators/action.validator.js

class ActionValidator {
  /**
   * Validate action object
   */
  validate(action) {
    const errors = [];
    
    // Required fields
    if (!action.endpoint) {
      errors.push('Endpoint is required');
    }
    
    if (!action.method) {
      errors.push('Method is required');
    }
    
    if (!action.label) {
      errors.push('Label is required');
    }
    
    // Validate method
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(action.method.toUpperCase())) {
      errors.push(`Invalid method. Must be one of: ${validMethods.join(', ')}`);
    }
    
    // Validate payload (optional but must be object if present)
    if (action.payload && typeof action.payload !== 'object') {
      errors.push('Payload must be an object');
    }
    
    // Validate confirmation structure
    if (action.confirmation) {
      if (typeof action.confirmation !== 'object') {
        errors.push('Confirmation must be an object');
      } else {
        if (action.confirmation.required !== undefined && typeof action.confirmation.required !== 'boolean') {
          errors.push('Confirmation.required must be a boolean');
        }
        if (action.confirmation.message && typeof action.confirmation.message !== 'string') {
          errors.push('Confirmation.message must be a string');
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Sanitize action (remove dangerous fields)
   */
  sanitize(action) {
    const sanitized = {
      endpoint: action.endpoint,
      method: action.method.toUpperCase(),
      label: this.sanitizeLabel(action.label),
      description: action.description ? this.sanitizeDescription(action.description) : null,
      payload: this.sanitizePayload(action.payload || {}),
      confirmation: action.confirmation ? {
        required: action.confirmation.required !== false,
        message: action.confirmation.message || 'Please confirm this action.',
      } : null,
    };
    
    return sanitized;
  }
  
  /**
   * Sanitize label (remove HTML, limit length)
   */
  sanitizeLabel(label) {
    if (!label) return 'Execute Action';
    return label
      .replace(/<[^>]*>/g, '')
      .slice(0, 100);
  }
  
  /**
   * Sanitize description
   */
  sanitizeDescription(description) {
    if (!description) return null;
    return description
      .replace(/<[^>]*>/g, '')
      .slice(0, 500);
  }
  
  /**
   * Sanitize payload (remove sensitive fields)
   */
  sanitizePayload(payload) {
    const sensitive = ['password', 'token', 'secret', 'apiKey'];
    const sanitized = { ...payload };
    
    for (const field of sensitive) {
      if (sanitized[field]) {
        sanitized[field] = '********';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Check if action is safe to execute
   */
  isSafe(action, userRole = 'user') {
    // Destructive actions require admin
    const destructiveActions = [
      '/api/students/terminate',
      '/api/users/delete',
      '/api/students/suspend',
    ];
    
    if (destructiveActions.includes(action.endpoint)) {
      return userRole === 'admin';
    }
    
    return true;
  }
  
  /**
   * Get action risk level
   */
  getRiskLevel(action) {
    const highRisk = ['terminate', 'delete', 'suspend', 'remove'];
    const mediumRisk = ['update', 'change', 'modify'];
    
    const endpoint = action.endpoint.toLowerCase();
    
    if (highRisk.some(term => endpoint.includes(term))) {
      return 'high';
    }
    
    if (mediumRisk.some(term => endpoint.includes(term))) {
      return 'medium';
    }
    
    return 'low';
  }
  
  /**
   * Build action preview for user
   */
  buildPreview(action) {
    return {
      endpoint: action.endpoint,
      method: action.method,
      payload: this.sanitizePayload(action.payload),
      description: action.description,
    };
  }
  
  /**
   * Estimate action execution time
   */
  estimateTime(action, payloadSize = 0) {
    // Base time in ms
    let estimated = 500;
    
    // Add time based on payload size
    estimated += payloadSize * 10;
    
    // Add time for complex actions
    if (action.endpoint.includes('export')) {
      estimated += 2000;
    }
    
    if (action.endpoint.includes('batch')) {
      estimated += 5000;
    }
    
    return Math.min(estimated, 30000); // Cap at 30 seconds
  }
}

export default new ActionValidator();