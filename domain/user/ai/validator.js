import AppError from '../../errors/AppError.js';

/**
 * AI Tool Input Validator
 * Validates tool inputs against defined schemas
 * Returns validated and sanitized inputs
 */
class InputValidator {
  constructor() {
    this.validators = {
      get_user_profile: this.validateGetUserProfile.bind(this),
      get_user_by_id: this.validateGetUserById.bind(this),
      update_user_profile: this.validateUpdateUserProfile.bind(this),
      upload_user_avatar: this.validateUploadUserAvatar.bind(this),
      list_users: this.validateListUsers.bind(this),
      delete_user: this.validateDeleteUser.bind(this),
      get_profile_update_options: this.validateGetProfileUpdateOptions.bind(this),
    };
  }

  /**
   * Validate tool inputs
   * @param {string} toolName - Name of the tool
   * @param {Object} input - Raw input from AI
   * @returns {Object} - Validated and sanitized input
   * @throws {AppError} - If validation fails
   */
  validate(toolName, input) {
    const validator = this.validators[toolName];
    
    if (!validator) {
      throw new AppError(`Unknown tool: ${toolName}`, 400);
    }
    
    return validator(input);
  }

  /**
   * Validate get_user_profile tool
   * No inputs required
   */
  validateGetUserProfile(input) {
    if (input && Object.keys(input).length > 0) {
      throw new AppError('get_user_profile does not accept any input parameters', 400);
    }
    return {};
  }

  /**
   * Validate get_user_by_id tool
   */
  validateGetUserById(input) {
    const { user_id } = input;
    
    if (!user_id) {
      throw new AppError('user_id is required', 400);
    }
    
    if (typeof user_id !== 'string') {
      throw new AppError('user_id must be a string', 400);
    }
    
    // Basic ObjectId validation (24 hex chars)
    if (!/^[0-9a-fA-F]{24}$/.test(user_id)) {
      throw new AppError('Invalid user_id format. Must be a 24-character hex string', 400);
    }
    
    return {
      user_id: user_id.trim(),
    };
  }

  /**
   * Validate update_user_profile tool
   */
  validateUpdateUserProfile(input) {
    const { user_id, updates } = input;
    
    if (!updates || typeof updates !== 'object') {
      throw new AppError('updates object is required', 400);
    }
    
    if (Object.keys(updates).length === 0) {
      throw new AppError('At least one field to update is required', 400);
    }
    
    // Validate user_id if provided
    if (user_id) {
      if (typeof user_id !== 'string') {
        throw new AppError('user_id must be a string', 400);
      }
      if (!/^[0-9a-fA-F]{24}$/.test(user_id)) {
        throw new AppError('Invalid user_id format. Must be a 24-character hex string', 400);
      }
    }
    
    // Field-specific validation
    const allowedFields = [
      'first_name', 'middle_name', 'last_name', 'bio', 'chat_availability',
      'phone', 'title', 'department', 'matricNo', 'staffId', 'level', 'session',
      'extra_roles'
    ];
    
    for (const [field, value] of Object.entries(updates)) {
      // Check if field is allowed
      if (!allowedFields.includes(field)) {
        throw new AppError(`Field '${field}' cannot be updated`, 400);
      }
      
      // Validate based on field type
      switch (field) {
        case 'first_name':
        case 'middle_name':
        case 'last_name':
          if (typeof value !== 'string') {
            throw new AppError(`${field} must be a string`, 400);
          }
          if (value.length < 2) {
            throw new AppError(`${field} must be at least 2 characters`, 400);
          }
          if (value.length > 50) {
            throw new AppError(`${field} must be less than 50 characters`, 400);
          }
          if (!/^[a-zA-Z\s\-']+$/.test(value)) {
            throw new AppError(`${field} can only contain letters, spaces, hyphens, and apostrophes`, 400);
          }
          updates[field] = value.trim();
          break;
          
        case 'bio':
          if (typeof value !== 'string') {
            throw new AppError('bio must be a string', 400);
          }
          if (value.length > 500) {
            throw new AppError('bio must be less than 500 characters', 400);
          }
          updates[field] = value.trim();
          break;
          
        case 'chat_availability':
          if (typeof value !== 'boolean') {
            throw new AppError('chat_availability must be a boolean', 400);
          }
          break;
          
        case 'phone':
          if (typeof value !== 'string') {
            throw new AppError('phone must be a string', 400);
          }
          updates[field] = value.trim();
          break;
          
        case 'title':
          const validTitles = ['mr', 'mrs', 'miss', 'ms', 'dr', 'prof', 'engr', 'barr', 'pastor', 'chief', 'alhaji', 'alhaja', 'rev'];
          if (value && !validTitles.includes(value.toLowerCase())) {
            throw new AppError(`Invalid title. Must be one of: ${validTitles.join(', ')}`, 400);
          }
          if (value) {
            updates[field] = value.toLowerCase();
          }
          break;
          
        case 'matricNo':
        case 'staffId':
          if (typeof value !== 'string') {
            throw new AppError(`${field} must be a string`, 400);
          }
          if (value && !/^[A-Z0-9\/\-]+$/i.test(value)) {
            throw new AppError(`Invalid ${field} format`, 400);
          }
          updates[field] = value.trim().toUpperCase();
          break;
          
        case 'level':
          const validLevels = ['100', '200', '300', '400', '500', '600', 'Masters', 'PhD'];
          if (value && !validLevels.includes(value)) {
            // Warning only, not blocking
            console.warn(`Warning: Level '${value}' may not be valid`);
          }
          break;
          
        case 'session':
          if (value && !/^\d{4}\/\d{4}$/.test(value)) {
            throw new AppError('session must be in format YYYY/YYYY (e.g., 2023/2024)', 400);
          }
          break;
          
        case 'extra_roles':
          if (!Array.isArray(value)) {
            throw new AppError('extra_roles must be an array', 400);
          }
          const validExtraRoles = ['customer_service', 'moderator', 'support_agent'];
          for (const role of value) {
            if (!validExtraRoles.includes(role)) {
              throw new AppError(`Invalid extra role: ${role}. Must be one of: ${validExtraRoles.join(', ')}`, 400);
            }
          }
          break;
      }
    }
    
    return {
      user_id: user_id ? user_id.trim() : undefined,
      updates,
    };
  }

  /**
   * Validate upload_user_avatar tool
   */
  validateUploadUserAvatar(input) {
    const { avatar_url } = input;
    
    if (!avatar_url) {
      throw new AppError('avatar_url is required', 400);
    }
    
    if (typeof avatar_url !== 'string') {
      throw new AppError('avatar_url must be a string', 400);
    }
    
    // Basic URL validation
    try {
      new URL(avatar_url);
    } catch (error) {
      throw new AppError('avatar_url must be a valid URL', 400);
    }
    
    return {
      avatar_url: avatar_url.trim(),
    };
  }

  /**
   * Validate list_users tool
   */
  validateListUsers(input) {
    const validated = {};
    
    const {
      filters = {},
      search_term,
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc',
    } = input || {};
    
    // Validate filters
    if (filters && typeof filters === 'object') {
      const validFilters = ['role', 'department', 'is_deleted'];
      
      for (const [key, value] of Object.entries(filters)) {
        if (!validFilters.includes(key)) {
          throw new AppError(`Invalid filter: ${key}`, 400);
        }
        
        if (key === 'role') {
          const validRoles = ['admin', 'dean', 'hod', 'lecturer', 'student', 'applicant', 'vc'];
          if (!validRoles.includes(value)) {
            throw new AppError(`Invalid role. Must be one of: ${validRoles.join(', ')}`, 400);
          }
        }
        
        if (key === 'is_deleted' && typeof value !== 'boolean') {
          throw new AppError('is_deleted must be a boolean', 400);
        }
      }
      
      validated.filters = filters;
    }
    
    // Validate search_term
    if (search_term) {
      if (typeof search_term !== 'string') {
        throw new AppError('search_term must be a string', 400);
      }
      validated.search_term = search_term.trim();
    }
    
    // Validate pagination
    if (typeof page !== 'number' || page < 1) {
      throw new AppError('page must be a positive integer', 400);
    }
    validated.page = page;
    
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      throw new AppError('limit must be between 1 and 100', 400);
    }
    validated.limit = limit;
    
    // Validate sorting
    const validSortFields = ['name', 'email', 'role', 'createdAt'];
    if (!validSortFields.includes(sort_by)) {
      throw new AppError(`sort_by must be one of: ${validSortFields.join(', ')}`, 400);
    }
    validated.sort_by = sort_by;
    
    if (sort_order !== 'asc' && sort_order !== 'desc') {
      throw new AppError('sort_order must be "asc" or "desc"', 400);
    }
    validated.sort_order = sort_order;
    
    return validated;
  }

  /**
   * Validate delete_user tool
   */
  validateDeleteUser(input) {
    const { user_id } = input;
    
    if (!user_id) {
      throw new AppError('user_id is required', 400);
    }
    
    if (typeof user_id !== 'string') {
      throw new AppError('user_id must be a string', 400);
    }
    
    if (!/^[0-9a-fA-F]{24}$/.test(user_id)) {
      throw new AppError('Invalid user_id format. Must be a 24-character hex string', 400);
    }
    
    return {
      user_id: user_id.trim(),
    };
  }

  /**
   * Validate get_profile_update_options tool
   */
  validateGetProfileUpdateOptions(input) {
    const { user_id } = input || {};
    
    if (user_id) {
      if (typeof user_id !== 'string') {
        throw new AppError('user_id must be a string', 400);
      }
      if (!/^[0-9a-fA-F]{24}$/.test(user_id)) {
        throw new AppError('Invalid user_id format. Must be a 24-character hex string', 400);
      }
      return { user_id: user_id.trim() };
    }
    
    return {};
  }
}

export default new InputValidator();