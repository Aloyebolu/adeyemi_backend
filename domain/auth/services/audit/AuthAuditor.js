import { logDevice } from '../../../../utils/deviceLogger.js';
import AppError from '../../../errors/AppError.js';
import User from '../../../user/user.model.js';

class AuthAuditor {
  // AUDIT: Internal security counters (in-memory, production would use Redis)
  // These are hooks for future rate limiting implementation
  static _failedAttempts = new Map(); // userId -> {count, lastAttempt, devices}
  static _legacyAuthCounters = new Map(); // userId -> count

  /**
   * Generate device fingerprint for tracking
   */
  generateDeviceFingerprint(deviceInfo) {
    if (!deviceInfo) return 'unknown';
    
    // Create a consistent fingerprint without exposing sensitive info
    const components = [
      deviceInfo.userAgent?.substring(0, 50) || '',
      deviceInfo.ip || '',
      deviceInfo.platform || ''
    ];
    
    return components.join('|').substring(0, 100);
  }

  /**
   * Detect suspicious authentication patterns
   */
  detectSuspiciousPattern(credentials, role, deviceFingerprint) {
    // AUDIT: Check for suspiciously short or long inputs
    if (credentials.password && credentials.password.length < 1) {
      console.warn(`[AuthService] Suspicious empty password attempt from ${deviceFingerprint}`);
    }
    
    if (credentials.email && credentials.email.length > 254) {
      console.warn(`[AuthService] Suspicious long email attempt from ${deviceFingerprint}`);
    }
    
    // AUDIT: Check for SQL injection patterns (defense in depth)
    const sqlPatterns = ["'", '"', ';', '--', '/*', '*/', 'union', 'select'];
    for (const [key, value] of Object.entries(credentials)) {
      if (typeof value === 'string') {
        if (sqlPatterns.some(pattern => value.toLowerCase().includes(pattern))) {
          console.warn(`[AuthService] Possible SQLi attempt in ${key} from ${deviceFingerprint}`);
        }
      }
    }
  }

  /**
   * Check account status before authentication
   */
  async checkAccountStatus(userId, role) {
    // AUDIT: This is a hook for future account lockout implementation
    // In production, this would check Redis or database for lockout status
    
    const failedAttempts = AuthAuditor._failedAttempts.get(userId);
    if (failedAttempts && failedAttempts.count > 10) {
      console.warn(`[AuthService] Account ${userId} has ${failedAttempts.count} failed attempts`);
      // AUDIT: Future enhancement: throw new AppError('Account temporarily locked', 423);
    }
  }

  /**
   * Check password freshness and forced reset requirements
   */
  async checkPasswordFreshness(userDoc, role, usedLegacyAuth) {
    // AUDIT: Ensure forced password changes are respected
    if (userDoc.forcePasswordChange) {
      throw new AppError('Password change required', 403);
    }
    
    // AUDIT: Check password expiry
    if (userDoc.passwordExpiryDays === 0) {
      throw new AppError('Password has expired', 403);
    }
    
    // AUDIT: If legacy auth was used, require password change after threshold
    if (usedLegacyAuth) {
      const legacyCount = userDoc.legacyAuthCount || 0;
      if (legacyCount > 5) {
        // KNOWN RISK – legacy auth allowed but flagged for change
        console.warn(`[AuthService] User ${userDoc._id} used legacy auth ${legacyCount} times`);
      }
    }
  }

  /**
   * Verify token contains correct role before issuance
   */
  verifyTokenRole(tokenData, expectedRole, userDetails) {
    // AUDIT: Final verification before token creation
    if (tokenData.role !== expectedRole) {
      console.error(`[AuthService] Token role mismatch: ${tokenData.role} vs ${expectedRole}`);
      // throw new AppError('Authentication system error', 500);
    }
    
    // AUDIT: Verify token ID matches user ID
    if (tokenData._id.toString() !== userDetails._id.toString()) {
      console.error('[AuthService] Token ID mismatch with user details');
      throw new AppError('Authentication system error', 500);
    }
  }

  /**
   * Track failed authentication attempts
   */
  trackFailedAttempt(identifier, deviceFingerprint, role) {
    // AUDIT: Hook for rate limiting implementation
    // In production, this would increment counters in Redis
    
    const key = `${role}:${identifier}`;
    const now = Date.now();
    
    if (!AuthAuditor._failedAttempts.has(key)) {
      AuthAuditor._failedAttempts.set(key, {
        count: 1,
        lastAttempt: now,
        devices: new Set([deviceFingerprint])
      });
    } else {
      const attempt = AuthAuditor._failedAttempts.get(key);
      attempt.count += 1;
      attempt.lastAttempt = now;
      attempt.devices.add(deviceFingerprint);
      
      // AUDIT: Log suspicious activity
      if (attempt.count > 5) {
        console.warn(`[AuthService] Multiple failed attempts for ${key} from ${attempt.devices.size} devices`);
      }
    }
    
    // Clean up old entries (memory management)
    if (AuthAuditor._failedAttempts.size > 1000) {
      for (const [k, v] of AuthAuditor._failedAttempts.entries()) {
        if (now - v.lastAttempt > 3600000) { // 1 hour
          AuthAuditor._failedAttempts.delete(k);
        }
      }
    }
  }

  /**
   * Reset failed attempts on successful auth
   */
  resetFailedAttempts(userId) {
    // AUDIT: Clear failed attempts on successful authentication
    for (const [key, value] of AuthAuditor._failedAttempts.entries()) {
      if (key.includes(userId.toString())) {
        AuthAuditor._failedAttempts.delete(key);
        break;
      }
    }
  }

  /**
   * Log successful authentication for audit trail
   */
  logSuccessfulAuth(userId, role, deviceFingerprint, usedLegacyAuth) {
    // AUDIT: Log successful auth without sensitive data
    console.info(`[AuthService] Successful ${role} auth for ${userId}, legacy: ${usedLegacyAuth}, device: ${deviceFingerprint.substring(0, 20)}...`);
  }

  /**
   * Increment legacy auth counter
   */
  incrementLegacyAuthCounter(userId) {
    const count = (AuthAuditor._legacyAuthCounters.get(userId) || 0) + 1;
    AuthAuditor._legacyAuthCounters.set(userId, count);
    
    // AUDIT: Auto-flag users after too many legacy auths
    if (count >= 3) {
      console.warn(`[AuthService] User ${userId} has used legacy auth ${count} times`);
    }
  }

  /**
   * Flag user for required password change
   */
  async flagForPasswordChange(userId) {
    try {
      // AUDIT: Set flag in database to require password change
      await User.findByIdAndUpdate(userId, {
        $set: { forcePasswordChange: true }
      });
    } catch (error) {
      // Non-critical - log but don't fail authentication
      console.error(`[AuthService] Failed to flag user ${userId} for password change:`, error);
    }
  }

  /**
   * Log device information
   */
  async logDevice(userId, deviceInfo) {
    return await logDevice(userId, deviceInfo);
  }
}

export default AuthAuditor;