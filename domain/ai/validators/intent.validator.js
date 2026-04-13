// src/modules/ai/validators/intent.validator.js

class IntentValidator {
  /**
   * Validate intent classification result
   */
  validate(intent) {
    const errors = [];
    
    // Check required fields
    if (!intent.type) {
      errors.push('Intent type is required');
    }
    
    // Validate type
    const validTypes = ['read', 'write', 'analysis', 'export'];
    if (!validTypes.includes(intent.type)) {
      errors.push(`Invalid intent type. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Validate confidence
    if (intent.confidence !== undefined) {
      if (typeof intent.confidence !== 'number') {
        errors.push('Confidence must be a number');
      } else if (intent.confidence < 0 || intent.confidence > 1) {
        errors.push('Confidence must be between 0 and 1');
      }
    }
    
    // Validate entities (optional)
    if (intent.entities && typeof intent.entities !== 'object') {
      errors.push('Entities must be an object');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validate intent confidence threshold
   */
  isConfidentEnough(intent, threshold = 0.6) {
    return intent.confidence >= threshold;
  }
  
  /**
   * Get intent priority
   */
  getPriority(intent) {
    const priorities = {
      write: 1,      // Highest priority - user wants to do something
      analysis: 2,   // Analysis is important but not urgent
      export: 3,     // Export can wait
      read: 4,       // Read is lowest priority
    };
    
    return priorities[intent.type] || 5;
  }
  
  /**
   * Normalize intent (clean up and standardize)
   */
  normalize(intent) {
    return {
      type: intent.type,
      confidence: Math.min(Math.max(intent.confidence || 0.5, 0), 1),
      entities: intent.entities || {},
      action: intent.action || null,
      original: intent.original || null,
    };
  }
  
  /**
   * Check if intent requires confirmation
   */
  requiresConfirmation(intent, userRole = 'user') {
    // Always confirm write operations
    if (intent.type === 'write') {
      return true;
    }
    
    // Confirm low confidence intents
    if (intent.confidence < 0.7) {
      return true;
    }
    
    // Admins need less confirmation
    if (userRole === 'admin') {
      return false;
    }
    
    return false;
  }
  
  /**
   * Extract intent from message with fallback
   */
  getDefaultIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Simple keyword-based fallback
    if (lowerMsg.includes('terminate') || lowerMsg.includes('delete')) {
      return {
        type: 'write',
        action: 'terminate',
        confidence: 0.6,
        entities: {},
      };
    }
    
    if (lowerMsg.includes('analyze') || lowerMsg.includes('trend')) {
      return {
        type: 'analysis',
        confidence: 0.6,
        entities: {},
      };
    }
    
    if (lowerMsg.includes('export')) {
      return {
        type: 'export',
        confidence: 0.7,
        entities: {},
      };
    }
    
    return {
      type: 'read',
      confidence: 0.5,
      entities: {},
    };
  }
}

export default new IntentValidator();