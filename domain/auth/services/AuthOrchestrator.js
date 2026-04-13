import AdminAuthenticator from './authenticators/AdminAuthenticator.js';
import LecturerAuthenticator from './authenticators/LecturerAuthenticator.js';
import StudentAuthenticator from './authenticators/StudentAuthenticator.js';
import PasswordManager from './password/PasswordManager.js';
import TokenBuilder from './token/TokenBuilder.js';
import AuthAuditor from './audit/AuthAuditor.js';
import AppError from '../../errors/AppError.js';
import { validRoles } from '../../user/user.constants.js';
import { resolveUserName } from '../../../utils/resolveUserName.js';

class AuthOrchestrator {
  // AUDIT: Internal security counters (in-memory, production would use Redis)
  // These are hooks for future rate limiting implementation
  static _failedAttempts = new Map(); // userId -> {count, lastAttempt, devices}
  static _legacyAuthCounters = new Map(); // userId -> count
  
  constructor() {
    this.adminAuthenticator = new AdminAuthenticator();
    this.lecturerAuthenticator = new LecturerAuthenticator();
    this.studentAuthenticator = new StudentAuthenticator();
    this.passwordManager = new PasswordManager();
    this.tokenBuilder = new TokenBuilder();
    this.authAuditor = new AuthAuditor();
  }

  /**
   * Generic authentication method for all user types
   * SECURITY: This is the main entry point - all inputs must be validated
   */
  async authenticateUser(role, credentials, deviceInfo) {
    // AUDIT: Track authentication attempts by role and device fingerprint
    const deviceFingerprint = this.authAuditor.generateDeviceFingerprint(deviceInfo);
    
    try {
      // SECURITY: Validate role before processing
      this.validateRole(role);
      
      // SECURITY: Sanitize all credential inputs before use
      const sanitizedCredentials = this.sanitizeCredentials(credentials, role);
      
      // AUDIT: Check for suspicious patterns before processing
      this.authAuditor.detectSuspiciousPattern(sanitizedCredentials, role, deviceFingerprint);
      
      let userDoc, userDetails, tokenData;
      let usedLegacyAuth = false; // AUDIT: Track if legacy path was used

      // SECURITY: Use consistent timing by calling the same validation path regardless of outcome
      switch (role) {
        case 'admin':
          ({ userDoc, userDetails, usedLegacyAuth } = await this.adminAuthenticator.authenticate(sanitizedCredentials, deviceFingerprint));
          tokenData = this.tokenBuilder.buildAdminTokenData(userDetails);
          break;

        case 'lecturer':
          ({ userDoc, userDetails, usedLegacyAuth } = await this.lecturerAuthenticator.authenticate(sanitizedCredentials, deviceFingerprint));
          tokenData = await this.tokenBuilder.buildLecturerTokenData(userDetails, userDoc);
          break;

        case 'student':
          ({ userDoc, userDetails, usedLegacyAuth } = await this.studentAuthenticator.authenticate(sanitizedCredentials, deviceFingerprint));
          tokenData = await this.tokenBuilder.buildStudentTokenData(userDetails);
          break;

        default:
          // SECURITY: This should never be reached due to validateRole above
          // but kept as defensive programming
          throw new AppError('Invalid authentication role', 400);
      }

      // Check if this is a shadow login
      if(credentials.shadowDepartmentId){
        throw("This is a test", 500)
        tokenData.view_context = {
          department_id: shadowDepartmentId
        }
      }

      // AUDIT: Check if account is locked or requires forced password change
      await this.authAuditor.checkAccountStatus(userDoc._id, role);
      
      // SECURITY: Verify role consistency between linked documents
      // this.validateRoleConsistency(userDoc, role, userDetails);
      
      // AUDIT: Verify password freshness - ensure forced resets are respected
      await this.authAuditor.checkPasswordFreshness(userDoc, role, usedLegacyAuth);

      // AUDIT: Increment legacy auth counter if used
      if (usedLegacyAuth) {
        this.authAuditor.incrementLegacyAuthCounter(userDoc._id);
        // AUDIT: Flag user for password change on legacy auth
        await this.authAuditor.flagForPasswordChange(userDoc._id);
      }

      // Create token BEFORE logging device to ensure authentication succeeded
      const token = await this.tokenBuilder.createToken(tokenData);
      
      // AUDIT: Verify token contains correct role before proceeding
      this.authAuditor.verifyTokenRole(tokenData, role, userDetails);

      // SECURITY: Log device AFTER successful authentication to prevent logging failed attempts
      await this.authAuditor.logDevice(userDoc._id, deviceInfo);
      
      // AUDIT: Reset failed attempts counter on successful auth
      this.authAuditor.resetFailedAttempts(userDoc._id);
      
      // AUDIT: Track successful authentication
      this.authAuditor.logSuccessfulAuth(userDoc._id, role, deviceFingerprint, usedLegacyAuth);

      // Return authentication result
      return this.buildAuthResponse(userDoc, userDetails, tokenData, token);
    } catch (error) {
      // AUDIT: Track failed authentication attempts
      if (credentials && credentials.email) {
        this.authAuditor.trackFailedAttempt(credentials.email, deviceFingerprint, role);
      }
      
      // SECURITY: Do not log full error details in production
      // Use generic logging to prevent information leakage
      
      if (error instanceof AppError) throw error;
      // SECURITY: Use generic error message to prevent account enumeration
      // throw new AppError('Authentication failed. Please check your credentials.', 401);
      throw error;
    }
  }

  /**
   * Change user password with validation and history tracking
   * SECURITY: This method handles sensitive password operations
   */
  async changeUserPassword(userId, currentPassword, newPassword) {
    const {result, auditContext} = await this.passwordManager.changeUserPassword(userId, currentPassword, newPassword);
    return {result, auditContext};
  }

  /**
   * Returns password security status for a user.
   * SECURITY: This is read-only and does NOT inspect password hashes.
   */
  async getPasswordStatus(userId) {
    return await this.passwordManager.getPasswordStatus(userId);
  }

  /**
   * Force password reset for a user (admin only)
   * SECURITY: This should be rate-limited at controller level
   */
  async forcePasswordReset(userId) {
    return await this.passwordManager.forcePasswordReset(userId);
  }

  /**
   * Helper function to get user details based on role
   * SECURITY: This should only be used internally
   */
  async getUserDetailsByRole(userId, role) {
    return await this.passwordManager.getUserDetailsByRole(userId, role);
  }

  /**
   * Build authentication response
   * SECURITY: This shapes the public API response - be careful with data exposure
   */
  buildAuthResponse(userDoc, userDetails, tokenData, token) {
    const baseResponse = {
      id: userDetails._id,
      email: userDoc.email,
      name: resolveUserName(userDoc),
      role: userDoc.role,
      access_token: token,
      avatar: userDoc.avatar
    };

    // Add role-specific fields
    switch (userDoc.role) {
      case 'admin':
        return {
          ...baseResponse,
          admin_id: userDetails.admin_id
        };
      case 'lecturer':
        return {
          ...baseResponse,
          staff_id: userDetails.staffId,
          department: tokenData.department
        };
      case 'student':
        return {
          ...baseResponse,
          matric_no: userDetails.matricNumber,
          department: tokenData.department,
          level: tokenData.level,
          faculty: tokenData.faculty
        };
      default:
        return baseResponse;
    }
  }

  /**
   * SECURITY HELPER METHODS
   * These are internal methods for security hardening
   */

  /**
   * Validate role parameter
   * @private
   */
  validateRole(role) {
    if (!validRoles.includes(role)) {
      throw new AppError('Invalid authentication role', 400);
    }
  }

  /**
   * Sanitize credential inputs
   * @private
   */
  sanitizeCredentials(credentials, role) {
    if (!credentials || typeof credentials !== 'object') {
      throw new AppError('Invalid credentials format', 400);
    }

    const sanitized = { ...credentials };
    
    // Trim and normalize string inputs
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = sanitized[key].trim();
        
        // SECURITY: Normalize case for identifiers (not passwords)
        if (key !== 'password') {
          if (key.includes('email')) {
            sanitized[key] = sanitized[key].toLowerCase();
          } else if (key.includes('id') || key.includes('no') || key.includes('_id') || key.includes('staff_id') || key.includes('matric_no')) {
            sanitized[key] = sanitized[key].toUpperCase();
          }
        }
      }
    });

    return sanitized;
  }


}

// SECURITY: Export as singleton to ensure consistent state
export default new AuthOrchestrator();