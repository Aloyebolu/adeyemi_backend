// auth/services/recovery/AccountRecoveryService.js
import AppError from '../../../errors/AppError.js';
import crypto from 'crypto';

class AccountRecoveryService {
  constructor() {
    this.recoveryTokens = new Map();
    this.tokenExpiryHours = 24;
    this.maxAttempts = 3;
  }

  /**
   * Initiate account recovery
   */
  async initiateAccountRecovery(email) {
    if (!email || typeof email !== 'string') {
      throw new AppError('Valid email is required', 400);
    }

    // In production, check if email exists in database
    // For now, simulate email check
    const userExists = true; // Would check database
    
    if (!userExists) {
      // Return generic message to prevent email enumeration
      return {
        message: 'If an account exists with this email, recovery instructions have been sent.',
        sent: true
      };
    }

    // Generate recovery token
    const token = this._generateRecoveryToken();
    const expiresAt = new Date(Date.now() + this.tokenExpiryHours * 60 * 60 * 1000);

    // Store token
    this.recoveryTokens.set(token, {
      email,
      expiresAt,
      attempts: 0,
      verified: false,
      created_at: new Date().toISOString()
    });

    // In production, send recovery email
    // For now, return token for testing
    console.log(`[Account Recovery] Token for ${email}: ${token}`);

    return {
      message: 'Account recovery instructions have been sent to your email.',
      token_expires_in_hours: this.tokenExpiryHours,
      // In production, don't return token - only for testing
      test_token: process.env.NODE_ENV === 'development' ? token : undefined
    };
  }

  /**
   * Initiate password reset
   */
  async initiatePasswordReset(email) {
    // This could be similar to account recovery or simpler
    // For now, use the same flow
    
    return this.initiateAccountRecovery(email);
  }

  /**
   * Verify recovery token
   */
  async verifyRecoveryToken(token) {
    if (!token) {
      throw new AppError('Recovery token is required', 400);
    }

    const recoveryData = this.recoveryTokens.get(token);
    
    if (!recoveryData) {
      throw new AppError('Invalid or expired recovery token', 401);
    }

    // Check if token is expired
    if (new Date() > recoveryData.expiresAt) {
      this.recoveryTokens.delete(token);
      throw new AppError('Recovery token has expired', 401);
    }

    // Check if too many attempts
    if (recoveryData.attempts >= this.maxAttempts) {
      this.recoveryTokens.delete(token);
      throw new AppError('Too many verification attempts. Please request a new recovery link.', 429);
    }

    // Mark as verified
    recoveryData.verified = true;
    recoveryData.verified_at = new Date().toISOString();
    recoveryData.attempts += 1;
    
    this.recoveryTokens.set(token, recoveryData);

    return {
      valid: true,
      email: recoveryData.email,
      expires_at: recoveryData.expiresAt.toISOString(),
      message: 'Recovery token verified successfully'
    };
  }

  /**
   * Complete account recovery with new password
   */
  async completeAccountRecovery(token, newPassword) {
    // Verify token first
    const verification = await this.verifyRecoveryToken(token);
    
    if (!verification.valid) {
      throw new AppError('Invalid recovery token', 401);
    }

    // Get recovery data
    const recoveryData = this.recoveryTokens.get(token);
    
    if (!recoveryData.verified) {
      throw new AppError('Token not verified. Please verify token first.', 400);
    }

    // Validate new password
    if (!newPassword || newPassword.length < 4) {
      throw new AppError('Password must be at least 4 characters long', 400);
    }

    // Check password strength
    if (this._isWeakPassword(newPassword)) {
      throw new AppError('Password is too weak. Please choose a stronger password.', 400);
    }

    // In production, this would:
    // 1. Find user by email
    // 2. Update password with proper hashing
    // 3. Invalidate all active sessions
    // 4. Log the recovery event
    
    console.log(`[Account Recovery] Password reset for: ${recoveryData.email}`);

    // Clean up token
    this.recoveryTokens.delete(token);

    return {
      success: true,
      email: recoveryData.email,
      recovered_at: new Date().toISOString(),
      message: 'Account recovered successfully. You can now login with your new password.',
      next_steps: [
        'Login with your new password',
        'Consider enabling Multi-Factor Authentication',
        'Review your security settings'
      ]
    };
  }

  /**
   * Check recovery status
   */
  async checkRecoveryStatus(token) {
    if (!token) {
      throw new AppError('Token is required', 400);
    }

    const recoveryData = this.recoveryTokens.get(token);
    
    if (!recoveryData) {
      return {
        exists: false,
        message: 'Token not found or expired'
      };
    }

    const now = new Date();
    const expiresAt = recoveryData.expiresAt;
    const hoursRemaining = Math.max(0, (expiresAt - now) / (1000 * 60 * 60));

    return {
      exists: true,
      email: recoveryData.email,
      verified: recoveryData.verified || false,
      attempts: recoveryData.attempts,
      created_at: recoveryData.created_at,
      expires_at: expiresAt.toISOString(),
      hours_remaining: Math.round(hoursRemaining * 10) / 10,
      is_expired: now > expiresAt,
      max_attempts: this.maxAttempts
    };
  }

  /**
   * Cancel recovery process
   */
  async cancelRecovery(token) {
    const exists = this.recoveryTokens.has(token);
    
    if (exists) {
      this.recoveryTokens.delete(token);
    }

    return {
      success: true,
      cancelled: exists,
      message: exists 
        ? 'Recovery process cancelled successfully' 
        : 'No active recovery process found'
    };
  }

  /**
   * Clean up expired tokens (run as background job)
   */
  async cleanupExpiredTokens() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [token, data] of this.recoveryTokens.entries()) {
      if (now > data.expiresAt) {
        this.recoveryTokens.delete(token);
        cleanedCount++;
      }
    }

    return {
      cleaned: cleanedCount,
      remaining: this.recoveryTokens.size,
      timestamp: now.toISOString()
    };
  }

  // Private helper methods
  _generateRecoveryToken() {
    return `rec_${Date.now()}_${crypto.randomBytes(16).toString('hex')}`;
  }

  _isWeakPassword(password) {
    // Basic weak password detection
    const weakPatterns = [
      'password', '123456', 'qwerty', 'admin', 'welcome',
      'password123', 'afued', 'university'
    ];

    const lowerPassword = password.toLowerCase();
    return weakPatterns.some(pattern => lowerPassword.includes(pattern));
  }

  /**
   * Generate secure verification code for email/SMS
   */
  _generateVerificationCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += Math.floor(Math.random() * 10);
    }
    return code;
  }

  /**
   * Validate email format
   */
  _validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default new AccountRecoveryService();