// src/modules/ai/validators/query.validator.js

import AI_CONFIG from '../config/ai.config.js';

class QueryValidator {
  /**
   * Validate AI-generated query before execution
   */
  validate(querySpec) {
    const errors = [];
    
    // Check required fields
    if (!querySpec.collection) {
      errors.push('Collection name is required');
    }
    
    if (!querySpec.operation) {
      errors.push('Operation type is required');
    }
    
    // Validate operation
    const validOperations = ['find', 'aggregate', 'count', 'distinct'];
    if (!validOperations.includes(querySpec.operation)) {
      errors.push(`Invalid operation. Must be one of: ${validOperations.join(', ')}`);
    }
    
    // Validate limit
    if (querySpec.limit !== undefined) {
      if (typeof querySpec.limit !== 'number') {
        errors.push('Limit must be a number');
      } else if (querySpec.limit < 1) {
        errors.push('Limit must be at least 1');
      } else if (querySpec.limit > AI_CONFIG.limits.maxRows) {
        errors.push(`Limit exceeds maximum allowed (${AI_CONFIG.limits.maxRows})`);
      }
    }
    
    // Validate aggregation pipeline
    if (querySpec.operation === 'aggregate') {
      if (!Array.isArray(querySpec.pipeline)) {
        errors.push('Pipeline must be an array');
      } else {
        this.validatePipeline(querySpec.pipeline, errors);
      }
    }
    
    // Validate projection
    if (querySpec.projection) {
      this.validateProjection(querySpec.projection, errors);
    }
    
    // Validate sort
    if (querySpec.sort) {
      this.validateSort(querySpec.sort, errors);
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Validate aggregation pipeline
   */
  validatePipeline(pipeline, errors) {
    const allowedStages = [
      '$match', '$group', '$sort', '$limit', '$skip',
      '$project', '$lookup', '$unwind', '$addFields',
      '$facet', '$bucket', '$sortByCount'
    ];
    
    for (const stage of pipeline) {
      const stageName = Object.keys(stage)[0];
      
      if (!allowedStages.includes(stageName)) {
        errors.push(`Disallowed aggregation stage: ${stageName}`);
      }
      
      // Additional validation for specific stages
      if (stageName === '$lookup') {
        const lookup = stage.$lookup;
        if (!lookup.from || !lookup.localField || !lookup.foreignField) {
          errors.push('$lookup requires from, localField, and foreignField');
        }
      }
      
      if (stageName === '$group' && !stage.$group._id) {
        errors.push('$group requires an _id field');
      }
    }
  }
  
  /**
   * Validate projection
   */
  validateProjection(projection, errors) {
    if (typeof projection !== 'object') {
      errors.push('Projection must be an object');
      return;
    }
    
    // Check for excluded sensitive fields
    const sensitiveFields = ['password', 'passwordHistory', 'recentDevices', 'created_by'];
    for (const field of sensitiveFields) {
      if (projection[field] === 1) {
        errors.push(`Cannot include sensitive field: ${field}`);
      }
    }
  }
  
  /**
   * Validate sort
   */
  validateSort(sort, errors) {
    if (typeof sort !== 'object') {
      errors.push('Sort must be an object');
      return;
    }
    
    for (const [field, order] of Object.entries(sort)) {
      if (order !== 1 && order !== -1) {
        errors.push(`Sort order for ${field} must be 1 (asc) or -1 (desc)`);
      }
    }
  }
  
  /**
   * Sanitize query (remove dangerous parts)
   */
  sanitize(querySpec) {
    const sanitized = { ...querySpec };
    
    // Remove sensitive fields from projection
    if (sanitized.projection) {
      const sensitiveFields = ['password', 'passwordHistory', 'recentDevices', 'created_by', 'deleted_by'];
      for (const field of sensitiveFields) {
        delete sanitized.projection[field];
      }
    }
    
    // Remove dangerous operators from query
    if (sanitized.query) {
      sanitized.query = this.removeDangerousOperators(sanitized.query);
    }
    
    // Enforce limit
    if (!sanitized.limit || sanitized.limit > AI_CONFIG.limits.maxRows) {
      sanitized.limit = AI_CONFIG.limits.defaultRows;
    }
    
    return sanitized;
  }
  
  /**
   * Remove dangerous MongoDB operators
   */
  removeDangerousOperators(obj) {
    const dangerous = ['$where', '$eval', '$function', '$regex'];
    const safe = { ...obj };
    
    for (const key of Object.keys(safe)) {
      if (dangerous.includes(key)) {
        delete safe[key];
      } else if (typeof safe[key] === 'object' && safe[key] !== null) {
        safe[key] = this.removeDangerousOperators(safe[key]);
      }
    }
    
    return safe;
  }
  
  /**
   * Estimate query complexity
   */
  estimateComplexity(querySpec) {
    let score = 0;
    
    // Base score
    score += 10;
    
    // Add complexity for aggregation
    if (querySpec.operation === 'aggregate') {
      score += (querySpec.pipeline?.length || 0) * 5;
    }
    
    // Add complexity for multiple conditions
    if (querySpec.query) {
      const conditionCount = this.countConditions(querySpec.query);
      score += conditionCount * 2;
    }
    
    // Add complexity for lookups
    if (querySpec.pipeline) {
      const lookupCount = querySpec.pipeline.filter(s => s.$lookup).length;
      score += lookupCount * 10;
    }
    
    // Add complexity for sorting
    if (querySpec.sort && Object.keys(querySpec.sort).length > 0) {
      score += 5;
    }
    
    return {
      score,
      level: score < 20 ? 'simple' : score < 50 ? 'moderate' : 'complex',
    };
  }
  
  /**
   * Count nested conditions
   */
  countConditions(obj, count = 0) {
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        if (Object.keys(value).some(k => k.startsWith('$'))) {
          count++;
        }
        count = this.countConditions(value, count);
      }
    }
    return count;
  }
}

export default new QueryValidator();