// auth/services/twofa/TwoFactorManager.js
import AppError from '#shared/errors/AppError.js';
import crypto from 'crypto';
import speakeasy from 'speakeasy'; // You'll need to install: npm install speakeasy
import QRCode from 'qrcode'; // You'll need to install: npm install qrcode

class TwoFactorManager {
  constructor() {
    this.backupCodeLength = 10;
    this.backupCodeCount = 10;
  }

  /**
   * Get user's MFA settings
   */
  async getUserMFASettings(userId) {
    // Mock implementation - replace with database queries
    return {
      enabled: false,
      method: null,
      phone_number: null,
      email: null,
      backup_codes: [],
      last_used: null,
      setup_date: null
    };
  }

  /**
   * Setup MFA for a user
   */
  async setupMFA(userId, method, options = {}) {
    // Validate method
    const validMethods = ['app', 'sms', 'email'];
    if (!validMethods.includes(method)) {
      throw new AppError('Invalid MFA method', 400);
    }

    // Generate secret for TOTP (Time-based One-Time Password)
    const secret = speakeasy.generateSecret({
      name: `University Platform (${userId})`,
      length: 20
    });

    // Generate backup codes
    const backupCodes = this._generateBackupCodes();

    // Generate QR code for authenticator app
    let qrCodeUrl = null;
    if (method === 'app') {
      qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);
    }

    // For SMS/Email, we would store the contact info
    if (method === 'sms' && !options.phone_number) {
      throw new AppError('Phone number is required for SMS verification', 400);
    }

    if (method === 'email' && !options.email) {
      throw new AppError('Email is required for email verification', 400);
    }

    // Store MFA setup in database (implementation depends on your schema)
    // For now, return the setup data
    return {
      qr_code_url: qrCodeUrl,
      secret: secret.base32,
      backup_codes: backupCodes,
      method,
      phone_number: options.phone_number || null,
      email: options.email || null,
      expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes to complete setup
    };
  }

  /**
   * Verify MFA setup
   */
  async verifyMFASetup(userId, code) {
    // Validate code format
    if (!code || !/^[0-9]{6}$/.test(code)) {
      throw new AppError('Invalid verification code format', 400);
    }

    // In real implementation, you would retrieve the secret from database
    // and verify it with speakeasy.totp.verify()
    
    // Mock verification
    const isValid = code === '123456'; // Replace with actual verification
    
    if (!isValid) {
      throw new AppError('Invalid verification code', 401);
    }

    // Enable MFA for user in database
    return {
      success: true,
      message: 'MFA enabled successfully',
      enabled_at: new Date().toISOString()
    };
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId, code) {
    // Verify the code first (if MFA is enabled, require verification)
    const isValid = await this._verifyCurrentCode(userId, code);
    
    if (!isValid) {
      throw new AppError('Invalid verification code', 401);
    }

    // Disable MFA in database
    return {
      success: true,
      message: 'MFA disabled successfully',
      disabled_at: new Date().toISOString()
    };
  }

  /**
   * Regenerate backup codes
   */
  async regenerateBackupCodes(userId) {
    // Verify user has MFA enabled
    const settings = await this.getUserMFASettings(userId);
    if (!settings.enabled) {
      throw new AppError('MFA is not enabled', 400);
    }

    // Generate new backup codes
    const backupCodes = this._generateBackupCodes();

    // Store new codes in database (invalidating old ones)
    return {
      backup_codes: backupCodes,
      generated_at: new Date().toISOString(),
      message: 'Backup codes regenerated. Old codes are now invalid.'
    };
  }

  /**
   * Verify MFA token for login
   */
  async verifyMFAToken(userId, token, method = 'app') {
    const settings = await this.getUserMFASettings(userId);
    
    if (!settings.enabled) {
      return { verified: true }; // No MFA required
    }

    // Verify based on method
    let isValid = false;
    
    switch (method) {
      case 'app':
        isValid = this._verifyTOTPToken(settings.secret, token);
        break;
      case 'backup':
        isValid = await this._verifyBackupCode(userId, token);
        break;
      // Add SMS and email verification here
      default:
        throw new AppError('Invalid MFA verification method', 400);
    }

    return {
      verified: isValid,
      method_used: method,
      timestamp: new Date().toISOString()
    };
  }

  // Private helper methods
  _generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < this.backupCodeCount; i++) {
      const code = crypto.randomBytes(this.backupCodeLength / 2).toString('hex').toUpperCase();
      codes.push({
        code,
        used: false,
        generated_at: new Date().toISOString()
      });
    }
    return codes;
  }

  _verifyTOTPToken(secret, token) {
    try {
      return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 1 // Allow 1 step (30 seconds) before/after
      });
    } catch (error) {
      return false;
    }
  }

  async _verifyBackupCode(userId, code) {
    // Retrieve backup codes from database
    const settings = await this.getUserMFASettings(userId);
    const backupCode = settings.backup_codes.find(bc => bc.code === code && !bc.used);
    
    if (!backupCode) {
      return false;
    }

    // Mark backup code as used
    // Update in database
    return true;
  }

  async _verifyCurrentCode(userId, code) {
    // Mock implementation - replace with actual verification
    // This would check if the code is valid for disabling MFA
    return true;
  }
}

export default new TwoFactorManager();