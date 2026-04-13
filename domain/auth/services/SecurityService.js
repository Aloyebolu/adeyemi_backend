// auth/services/SecurityService.js
import AppError from '../../errors/AppError.js';

class SecurityService {
  /**
   * Check password strength
   */
  async checkPasswordStrength(userId, password) {
    // Basic validation
    if (!password || typeof password !== 'string') {
      throw new AppError('Password is required', 400);
    }

    if (password.length < 4) {
      throw new AppError('Password must be at least 4 characters', 400);
    }

    // Calculate password score
    let score = 0;
    const feedback = [];
    const suggestions = [];

    // Length bonus
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;

    // Character variety
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add uppercase letters');
    }

    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add lowercase letters');
    }

    if (/\d/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add numbers');
    }

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      suggestions.push('Add special characters');
    }

    // Check for common weak patterns
    const weakPatterns = [
      'password', '123456', 'qwerty', 'admin', 'welcome',
      'password123', 'afued', 'university', 'school'
    ];

    const lowerPassword = password.toLowerCase();
    if (weakPatterns.some(pattern => lowerPassword.includes(pattern))) {
      score = Math.max(0, score - 2);
      feedback.push('Password contains common weak patterns');
    }

    // Check for sequential characters
    if (/(123|234|345|456|567|678|789|890|abc|bcd|cde|def)/i.test(password)) {
      score = Math.max(0, score - 1);
      feedback.push('Password contains sequential characters');
    }

    // Determine strength level
    let strength;
    if (score >= 6) strength = 'strong';
    else if (score >= 4) strength = 'medium';
    else strength = 'weak';

    // Additional feedback for weak passwords
    if (strength === 'weak') {
      feedback.push('Password is too weak. Consider using a passphrase or adding more character variety.');
    }

    return {
      score,
      strength,
      feedback,
      suggestions,
      meets_requirements: score >= 4
    };
  }

  /**
   * Get password age information
   */
  async getPasswordAge(userId) {
    // This would typically query the database for user's password change date
    // For now, return mock data - you'll need to implement database logic
    
    // Mock implementation - replace with actual DB query
    const mockLastChange = new Date('2024-01-15').getTime();
    const now = Date.now();
    const ageInDays = Math.floor((now - mockLastChange) / (1000 * 60 * 60 * 24));
    const expiryDays = 90;
    const daysRemaining = Math.max(0, expiryDays - ageInDays);

    return {
      age_in_days: ageInDays,
      last_changed: new Date(mockLastChange).toISOString(),
      days_remaining: daysRemaining,
      expires_in_days: expiryDays,
      is_expired: ageInDays > expiryDays,
      expires_on: new Date(mockLastChange + (expiryDays * 24 * 60 * 60 * 1000)).toISOString(),
      urgency: this._getPasswordUrgency(ageInDays, expiryDays)
    };
  }

  /**
   * Get comprehensive security health status
   */
  async getSecurityHealth(userId) {
    // This is a comprehensive health check that would integrate with other services
    // For now, return a structured response - you'll need to implement integration
    
    // Mock data - replace with actual service integration
    const score = 75; // Example score
    const status = score >= 80 ? 'excellent' : 
                  score >= 60 ? 'good' : 
                  score >= 40 ? 'fair' : 'poor';

    const checklist = {
      mfa_enabled: false, // Would come from MFAService
      strong_password: true, // Would come from password check
      password_recent: true, // Would come from password age
      trusted_devices: false, // Would come from DeviceService
      alerts_read: true, // Would come from AuditService
      privacy_configured: false // Would come from PrivacyService
    };

    const recommendations = [
      'Enable Multi-Factor Authentication',
      'Configure privacy settings',
      'Mark your frequently used devices as trusted'
    ];

    return {
      score,
      status,
      checklist,
      recommendations,
      metrics: {
        mfa_enabled: false,
        password_age_days: 45,
        active_sessions: 3,
        trusted_devices: 0,
        unread_alerts: 2,
        legacy_auth_count: 0,
        privacy_configured: false
      }
    };
  }

  // Private helper methods
  _getPasswordUrgency(ageInDays, expiryDays) {
    const daysRemaining = expiryDays - ageInDays;
    
    if (daysRemaining <= 0) return 'critical';
    if (daysRemaining <= 7) return 'high';
    if (daysRemaining <= 30) return 'medium';
    return 'none';
  }
}

export default new SecurityService();