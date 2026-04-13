import { updateProfile, getUpdateOptions } from '../services/userProfile.service.js';
import User from '../user.model.js';
import AppError from '../../errors/AppError.js';
import userService from '../user.service.js';

/**
 * AI Tool Executor
 * Maps tool names to actual service calls
 * Handles errors gracefully and returns clean JSON
 */
class ToolExecutor {
  constructor() {
    this.toolHandlers = {
      get_user_profile: this.handleGetUserProfile.bind(this),
      get_user_by_id: this.handleGetUserById.bind(this),
      update_user_profile: this.handleUpdateUserProfile.bind(this),
      upload_user_avatar: this.handleUploadUserAvatar.bind(this),
      list_users: this.handleListUsers.bind(this),
      delete_user: this.handleDeleteUser.bind(this),
      get_profile_update_options: this.handleGetProfileUpdateOptions.bind(this),
    };
  }

  /**
   * Execute a tool with validated inputs
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} validatedInput - Validated and sanitized input
   * @param {Object} context - Execution context (user, req, etc.)
   * @returns {Promise<Object>} - Clean JSON result
   */
  async execute(toolName, validatedInput, context = {}) {
    const handler = this.toolHandlers[toolName];
    
    if (!handler) {
      throw new AppError(`Unknown tool: ${toolName}`, 400);
    }

    try {
      const result = await handler(validatedInput, context);
      return {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      
      // Handle known AppErrors
      if (error instanceof AppError) {
        return {
          success: false,
          error: error.message,
          statusCode: error.statusCode,
          timestamp: new Date().toISOString(),
        };
      }
      
      // Handle unknown errors
      return {
        success: false,
        error: 'An unexpected error occurred while processing your request',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current user profile
   */
  async handleGetUserProfile(input, context) {
    if (!context.user || !context.user._id) {
      throw new AppError('Authentication required', 401);
    }
    
    const profileData = await userService.getUserProfile(context.user._id);
    return profileData;
  }

  /**
   * Get user by ID (admin only)
   */
  async handleGetUserById(input, context) {
    if (!context.user || context.user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }
    
    const user = await userService.findById(input.user_id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return user;
  }

  /**
   * Update user profile
   */
  async handleUpdateUserProfile(input, context) {
    if (!context.user || !context.user._id) {
      throw new AppError('Authentication required', 401);
    }
    
    // Determine which user to update
    const targetUserId = input.user_id || context.user._id;
    
    // Check permissions (only admin can update others)
    const isSelfUpdate = targetUserId === context.user._id.toString();
    const isAdmin = context.user.role === 'admin';
    
    if (!isSelfUpdate && !isAdmin) {
      throw new AppError('You can only update your own profile', 403);
    }
    
    // Check if trying to update system user
    const systemUserId = process.env.SYSTEM_USER_ID || '000000000000000000000000';
    if (targetUserId === systemUserId) {
      throw new AppError('System user cannot be modified', 403);
    }
    
    // Prepare request object for updateProfile controller
    const req = {
      params: { userId: targetUserId },
      user: context.user,
      body: input.updates,
    };
    
    const res = {
      status: (code) => ({
        json: (data) => data,
      }),
    };
    
    // Call updateProfile and capture result
    let result = null;
    const next = (error) => {
      if (error) throw error;
    };
    
    // Since updateProfile doesn't return data directly, we need to mock response
    let responseData = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          responseData = data;
          return data;
        },
      }),
    };
    
    await updateProfile(req, mockRes, next);
    
    if (responseData && responseData.data) {
      return responseData.data;
    }
    
    // Fallback: fetch updated user
    const updatedUser = await userService.findById(targetUserId);
    return { user: updatedUser, updatedFields: Object.keys(input.updates) };
  }

  /**
   * Upload/update user avatar
   */
  async handleUploadUserAvatar(input, context) {
    if (!context.user || !context.user._id) {
      throw new AppError('Authentication required', 401);
    }
    
    // Note: Actual file upload requires multipart form data
    // This tool expects the avatar URL after upload to storage
    // The actual file upload would be handled separately
    
    const user = await User.findByIdAndUpdate(
      context.user._id,
      { avatar: input.avatar_url },
      { new: true, runValidators: true }
    ).select('-password -passwordHistory -recentDevices');
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    return {
      message: 'Avatar updated successfully',
      avatar_url: user.avatar,
      user: user,
    };
  }

  /**
   * List users with filters and pagination
   */
  async handleListUsers(input, context) {
    if (!context.user || context.user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }
    
    const {
      filters = {},
      search_term = '',
      page = 1,
      limit = 20,
      sort_by = 'createdAt',
      sort_order = 'desc',
    } = input;
    
    // Build query
    const query = { ...filters };
    
    // Exclude system user from regular listings
    const systemUserId = process.env.SYSTEM_USER_ID || '000000000000000000000000';
    query._id = { $ne: systemUserId };
    
    // Include soft-deleted users if explicitly requested
    const includeDeleted = filters.is_deleted === true;
    
    // Search functionality
    if (search_term) {
      query.$or = [
        { first_name: { $regex: search_term, $options: 'i' } },
        { last_name: { $regex: search_term, $options: 'i' } },
        { email: { $regex: search_term, $options: 'i' } },
        { staffId: { $regex: search_term, $options: 'i' } },
        { matricNo: { $regex: search_term, $options: 'i' } },
      ];
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build sort object
    const sort = {};
    sort[sort_by] = sort_order === 'asc' ? 1 : -1;
    
    // Execute query with options
    let queryBuilder = User.find(query)
      .select('-password -passwordHistory -recentDevices')
      .sort(sort)
      .skip(skip)
      .limit(limit);
    
    if (!includeDeleted) {
      queryBuilder = queryBuilder.where('is_deleted').ne(true);
    }
    
    const [users, total] = await Promise.all([
      queryBuilder.lean(),
      User.countDocuments(query),
    ]);
    
    // Enrich with role-specific data
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        try {
          const enriched = await userService.getUserProfile(user._id);
          return enriched;
        } catch (error) {
          // If enrichment fails, return basic user data
          return user;
        }
      })
    );
    
    return {
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_prev: page > 1,
      },
      filters_applied: filters,
      search_term: search_term || null,
    };
  }

  /**
   * Soft delete a user (admin only)
   */
  async handleDeleteUser(input, context) {
    if (!context.user || context.user.role !== 'admin') {
      throw new AppError('Admin access required', 403);
    }
    
    const { user_id } = input;
    
    // Check if trying to delete system user
    const systemUserId = process.env.SYSTEM_USER_ID || '000000000000000000000000';
    if (user_id === systemUserId) {
      throw new AppError('System user cannot be deleted', 403);
    }
    
    const user = await User.findById(user_id);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    if (user.is_deleted) {
      throw new AppError('User is already deleted', 400);
    }
    
    // Soft delete the user
    user.is_deleted = true;
    user.deleted_at = new Date();
    user.deleted_by = context.user._id;
    await user.save();
    
    return {
      message: 'User deleted successfully',
      user_id: user._id,
      deleted_at: user.deleted_at,
      deleted_by: context.user._id,
    };
  }

  /**
   * Get profile update options for a user
   */
  async handleGetProfileUpdateOptions(input, context) {
    if (!context.user || !context.user._id) {
      throw new AppError('Authentication required', 401);
    }
    
    const targetUserId = input.user_id || context.user._id;
    
    // Check permissions (only admin can view options for others)
    const isSelfView = targetUserId === context.user._id.toString();
    const isAdmin = context.user.role === 'admin';
    
    if (!isSelfView && !isAdmin) {
      throw new AppError('You can only view your own profile update options', 403);
    }
    
    const user = await User.findById(targetUserId);
    
    if (!user) {
      throw new AppError('User not found', 404);
    }
    
    // Prepare request for getUpdateOptions
    const req = {
      params: { userId: targetUserId },
      user: context.user,
    };
    
    let responseData = null;
    const mockRes = {
      status: (code) => ({
        json: (data) => {
          responseData = data;
          return data;
        },
      }),
    };
    
    const next = (error) => {
      if (error) throw error;
    };
    
    await getUpdateOptions(req, mockRes, next);
    
    return responseData?.data || {
      role: user.role,
      updatableFields: [],
    };
  }
}

export default new ToolExecutor();