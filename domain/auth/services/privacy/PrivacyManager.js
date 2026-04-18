/**
 * This module manages user privacy settings and data handling.
 * It provides functionalities to get, update, and reset privacy settings,
 * as well as exporting privacy data and checking visibility.
 * It ensures compliance with privacy regulations and user preferences.
 * Date: 2026-01-04
 * Version: 1.0.0
 * Status: Stable
 */
import AppError from '#shared/errors/AppError.js';

class PrivacyManager {
  constructor() {
    this.defaultSettings = {
      directory_visibility: 'all',
      show_email: true,
      show_phone: true,
      show_courses: true,
      show_profile_picture: true,
      allow_search_by_email: true,
      allow_search_by_name: true,
      show_last_seen: false,
      show_online_status: false
    };
  }

  /**
   * Get user's privacy settings
   */
  async getUserPrivacySettings(userId) {
    // Mock data - replace with database queries
    // Check if user has custom settings
    const hasCustomSettings = false; // Would check database
    
    if (hasCustomSettings) {
      // Return user's custom settings
      return {
        directory_visibility: 'students',
        show_email: true,
        show_phone: false,
        show_courses: true,
        show_profile_picture: true,
        allow_search_by_email: true,
        allow_search_by_name: true,
        show_last_seen: false,
        show_online_status: false,
        configured: true,
        last_updated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week ago
      };
    } else {
      // Return default settings
      return {
        ...this.defaultSettings,
        configured: false,
        last_updated: null
      };
    }
  }

  /**
   * Update user's privacy settings
   */
  async updatePrivacySettings(userId, settings) {
    // Validate settings
    const validatedSettings = this._validatePrivacySettings(settings);
    
    if (Object.keys(validatedSettings).length === 0) {
      throw new AppError('No valid settings provided for update', 400);
    }

    // Check for conflicts
    this._checkSettingConflicts(validatedSettings);

    // In production, this would update the database
    // For now, return success with updated settings
    
    const currentSettings = await this.getUserPrivacySettings(userId);
    const updatedSettings = {
      ...currentSettings,
      ...validatedSettings,
      configured: true,
      last_updated: new Date().toISOString()
    };

    return {
      success: true,
      settings: updatedSettings,
      message: 'Privacy settings updated successfully',
      updated_at: updatedSettings.last_updated
    };
  }

  /**
   * Reset to default privacy settings
   */
  async resetToDefaultSettings(userId) {
    // In production, this would delete custom settings from database
    
    return {
      success: true,
      settings: {
        ...this.defaultSettings,
        configured: false,
        last_updated: new Date().toISOString()
      },
      message: 'Privacy settings reset to defaults'
    };
  }

  /**
   * Get privacy settings for directory visibility
   */
  async getDirectoryVisibility(userId) {
    const settings = await this.getUserPrivacySettings(userId);
    
    return {
      visibility: settings.directory_visibility,
      visible_fields: this._getVisibleFields(settings)
    };
  }

  /**
   * Check if user's information is visible to others
   */
  async isUserVisible(userId, viewerRole, field) {
    const settings = await this.getUserPrivacySettings(userId);
    
    // Check directory visibility
    const canView = this._canViewBasedOnRole(settings.directory_visibility, viewerRole);
    if (!canView) return false;

    // Check specific field visibility
    switch (field) {
      case 'email':
        return settings.show_email;
      case 'phone':
        return settings.show_phone;
      case 'courses':
        return settings.show_courses;
      case 'profile_picture':
        return settings.show_profile_picture;
      default:
        return true; // Other fields are always visible if directory allows
    }
  }

  /**
   * Export user's privacy data
   */
  async exportPrivacyData(userId) {
    const settings = await this.getUserPrivacySettings(userId);
    
    return {
      user_id: userId,
      privacy_settings: settings,
      data_categories: this._getDataCategories(),
      rights: this._getPrivacyRights(),
      export_date: new Date().toISOString()
    };
  }

  /**
   * Get privacy statistics
   */
  async getPrivacyStats() {
    // This would typically query aggregated statistics
    // For now, return mock data
    
    return {
      total_users_with_custom_settings: 1500,
      most_common_visibility: 'students',
      average_fields_hidden: 2.3,
      privacy_awareness_score: 68, // out of 100
      last_updated: new Date().toISOString()
    };
  }

  // Private helper methods
  _validatePrivacySettings(settings) {
    const validated = {};
    
    if (settings.directory_visibility !== undefined) {
      const validVisibilities = ['all', 'students', 'staff', 'none'];
      if (validVisibilities.includes(settings.directory_visibility)) {
        validated.directory_visibility = settings.directory_visibility;
      }
    }

    // Boolean fields
    const booleanFields = [
      'show_email', 'show_phone', 'show_courses', 'show_profile_picture',
      'allow_search_by_email', 'allow_search_by_name', 'show_last_seen', 'show_online_status'
    ];

    booleanFields.forEach(field => {
      if (settings[field] !== undefined) {
        validated[field] = Boolean(settings[field]);
      }
    });

    return validated;
  }

  _checkSettingConflicts(settings) {
    // Check for logical conflicts
    if (settings.directory_visibility === 'none') {
      // If directory is hidden, individual field settings might not matter
      // but we can warn the user
      console.log('[PrivacyManager] Directory hidden - some field settings may have no effect');
    }

    if (settings.show_email === false && settings.allow_search_by_email === true) {
      console.log('[PrivacyManager] Warning: Email hidden but searchable by email');
    }
  }

  _canViewBasedOnRole(visibility, viewerRole) {
    switch (visibility) {
      case 'all':
        return true;
      case 'students':
        return viewerRole === 'student';
      case 'staff':
        return ['admin', 'lecturer', 'hod', 'dean'].includes(viewerRole);
      case 'none':
        return false;
      default:
        return false;
    }
  }

  _getVisibleFields(settings) {
    const fields = [];
    
    if (settings.show_email) fields.push('email');
    if (settings.show_phone) fields.push('phone');
    if (settings.show_courses) fields.push('courses');
    if (settings.show_profile_picture) fields.push('profile_picture');
    
    return fields;
  }

  _getDataCategories() {
    return [
      {
        category: 'personal_info',
        description: 'Name, email, phone number, profile picture',
        retention_period: 'Until account deletion',
        purpose: 'Account identification and communication'
      },
      {
        category: 'academic_info',
        description: 'Courses, grades, department, faculty',
        retention_period: '7 years after graduation',
        purpose: 'Academic record keeping'
      },
      {
        category: 'activity_data',
        description: 'Login history, device information, usage patterns',
        retention_period: '1 year',
        purpose: 'Security monitoring and system improvement'
      }
    ];
  }

  _getPrivacyRights() {
    return [
      'Right to access your personal data',
      'Right to correct inaccurate data',
      'Right to delete your data',
      'Right to restrict processing',
      'Right to data portability',
      'Right to object to processing'
    ];
  }
}

export default new PrivacyManager();