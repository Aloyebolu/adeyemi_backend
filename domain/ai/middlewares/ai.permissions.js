// src/modules/ai/middlewares/ai.permissions.js

import catchAsync from '#utils/catchAsync.js';

class AIPermissionsMiddleware {
  /**
   * Check if user has permission to access AI features
   */
  hasAIAccess() {
    return catchAsync(async (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }
      
      // Check if user has AI access based on role
      const allowedRoles = ['admin', 'dean', 'hod', 'lecturer'];
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to use AI features',
        });
      }
      
      next();
    });
  }
  
  /**
   * Restrict data access based on user role
   */
  restrictDataAccess() {
    return catchAsync(async (req, res, next) => {
      const user = req.user;
      
      // Admin has full access
      if (user.role === 'admin') {
        req.permissions = { fullAccess: true };
        return next();
      }
      
      // HOD: only their department
      if (user.role === 'hod') {
        const userDetails = await this.getUserDetails(user._id);
        req.permissions = {
          departmentId: userDetails.department,
          allowedRoles: ['student', 'lecturer'],
        };
        return next();
      }
      
      // Dean: only their faculty
      if (user.role === 'dean') {
        const userDetails = await this.getUserDetails(user._id);
        req.permissions = {
          facultyId: userDetails.faculty,
          allowedRoles: ['student', 'lecturer', 'hod'],
        };
        return next();
      }
      
      // Lecturer: only their courses/students
      if (user.role === 'lecturer') {
        const userDetails = await this.getUserDetails(user._id);
        req.permissions = {
          lecturerId: user._id,
          departmentId: userDetails.department,
          allowedRoles: ['student'],
        };
        return next();
      }
      
      // Student: only their own data
      if (user.role === 'student') {
        req.permissions = {
          studentId: user._id,
          selfOnly: true,
        };
        return next();
      }
      
      next();
    });
  }
  
  /**
   * Validate query against user permissions
   */
  validateQueryPermissions() {
    return catchAsync(async (req, res, next) => {
      const { querySpec } = req.body;
      const permissions = req.permissions;
      
      if (!permissions || permissions.fullAccess) {
        return next();
      }
      
      // Add permission filters to query
      if (permissions.departmentId) {
        querySpec.query = querySpec.query || {};
        querySpec.query.department = permissions.departmentId;
      }
      
      if (permissions.facultyId) {
        // Add faculty filter (would need to join with department)
        // This is simplified
      }
      
      if (permissions.selfOnly) {
        querySpec.query = querySpec.query || {};
        querySpec.query._id = permissions.studentId;
      }
      
      if (permissions.allowedRoles) {
        querySpec.query = querySpec.query || {};
        querySpec.query.role = { $in: permissions.allowedRoles };
      }
      
      req.body.querySpec = querySpec;
      next();
    });
  }
  
  /**
   * Check write action permissions
   */
  canPerformWriteAction() {
    return catchAsync(async (req, res, next) => {
      const { action } = req.body;
      const user = req.user;
      
      // Only admins can perform write actions
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only administrators can perform write operations',
        });
      }
      
      next();
    });
  }
  
  /**
   * Rate limit per user role
   */
  rateLimitByRole() {
    const limits = {
      admin: 100,
      dean: 50,
      hod: 50,
      lecturer: 30,
      student: 10,
    };
    
    return catchAsync(async (req, res, next) => {
      const user = req.user;
      const limit = limits[user.role] || 10;
      
      // In production, implement actual rate limiting with Redis
      // For now, just pass through
      req.rateLimit = { limit, remaining: limit };
      next();
    });
  }
  
  /**
   * Log all AI interactions for audit
   */
  auditLog() {
    return catchAsync(async (req, res, next) => {
      const startTime = Date.now();
      
      // Store original end function
      const originalEnd = res.end;
      let responseBody = '';
      
      // Capture response
      res.end = function(chunk) {
        if (chunk) {
          responseBody += chunk;
        }
        
        const duration = Date.now() - startTime;
        
        // Log the interaction (async, don't wait)
        this.logInteraction({
          userId: req.user._id,
          method: req.method,
          path: req.path,
          query: req.query,
          body: this.sanitizeBody(req.body),
          response: this.sanitizeBody(responseBody),
          statusCode: res.statusCode,
          duration,
        }).catch(console.error);
        
        originalEnd.call(this, chunk);
      }.bind(res);
      
      next();
    });
  }
  
  /**
   * Get user details for permissions
   */
  async getUserDetails(userId) {
    // In production, fetch from database
    // For now, return mock data
    return {
      department: '507f1f77bcf86cd799439011',
      faculty: '507f1f77bcf86cd799439012',
    };
  }
  
  /**
   * Sanitize body for logging
   */
  sanitizeBody(body) {
    if (!body) return null;
    
    const sensitive = ['password', 'token', 'secret'];
    const sanitized = { ...body };
    
    for (const key of sensitive) {
      if (sanitized[key]) {
        sanitized[key] = '********';
      }
    }
    
    return sanitized;
  }
  
  /**
   * Log interaction (placeholder)
   */
  async logInteraction(data) {
    // In production, save to audit log
    console.log('AI Interaction:', {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new AIPermissionsMiddleware();