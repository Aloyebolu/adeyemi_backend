// auth/services/audit/AuthAuditor.js
import AppError from '../../../errors/AppError.js';

class AuthAuditor {
  constructor() {
    this.auditLogs = [];
    this.securityAlerts = [];
  }

  /**
   * Get user login history
   */
  async getUserLoginHistory(userId, limit = 20) {
    // Mock data - replace with database queries
    const mockHistory = [
      {
        id: 'login_1',
        user_id: userId,
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        ip_address: '192.168.1.100',
        location: 'Lagos, Nigeria',
        device: 'Chrome on Windows',
        status: 'success',
        method: 'password',
        session_id: 'session_1'
      },
      {
        id: 'login_2',
        user_id: userId,
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        ip_address: '10.0.0.50',
        location: 'Abuja, Nigeria',
        device: 'Firefox on Android',
        status: 'failed',
        method: 'password',
        failure_reason: 'Invalid password',
        session_id: null
      },
      {
        id: 'login_3',
        user_id: userId,
        timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        ip_address: '172.16.0.25',
        location: 'Ibadan, Nigeria',
        device: 'Safari on Mac',
        status: 'success',
        method: 'password',
        session_id: 'session_2'
      },
      {
        id: 'login_4',
        user_id: userId,
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        ip_address: '203.0.113.10',
        location: 'Unknown',
        device: 'Unknown',
        status: 'failed',
        method: 'password',
        failure_reason: 'Account locked',
        session_id: null
      },
      {
        id: 'login_5',
        user_id: userId,
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        ip_address: '198.51.100.25',
        location: 'Port Harcourt, Nigeria',
        device: 'Edge on Windows',
        status: 'success',
        method: 'password',
        session_id: null
      }
    ];

    return mockHistory.slice(0, limit);
  }

  /**
   * Get security alerts for user
   */
  async getSecurityAlerts(userId) {
    // Mock data - replace with database queries
    return [
      {
        id: 'alert_1',
        user_id: userId,
        title: 'Unusual Login Attempt',
        message: 'A login attempt was detected from a new location (Abuja, Nigeria)',
        type: 'warning',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        read: false,
        action_required: false
      },
      {
        id: 'alert_2',
        user_id: userId,
        title: 'Password Change Required',
        message: 'Your password is 85 days old. Consider changing it soon.',
        type: 'info',
        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        read: true,
        action_required: false
      },
      {
        id: 'alert_3',
        user_id: userId,
        title: 'New Device Detected',
        message: 'A new device (Firefox on Android) was added to your account',
        type: 'info',
        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        read: true,
        action_required: false
      },
      {
        id: 'alert_4',
        user_id: userId,
        title: 'Security Update',
        message: 'Enable Multi-Factor Authentication for enhanced security',
        type: 'info',
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        read: true,
        action_required: true
      }
    ];
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(userId, alertId) {
    if (!alertId) {
      throw new AppError('Alert ID is required', 400);
    }

    // Find and update alert
    const alerts = await this.getSecurityAlerts(userId);
    const alert = alerts.find(a => a.id === alertId);
    
    if (!alert) {
      throw new AppError('Alert not found', 404);
    }

    // In production, update in database
    alert.read = true;
    alert.read_at = new Date().toISOString();

    return {
      success: true,
      alert_id: alertId,
      read_at: alert.read_at,
      message: 'Alert marked as read'
    };
  }

  /**
   * Report phishing email
   */
  async reportPhishing(userId, reportData) {
    const { sender, subject, body, reported_at } = reportData;

    // Validate required fields
    if (!sender || !subject || !body) {
      throw new AppError('Missing required fields', 400);
    }

    // Create phishing report
    const reportId = `phish_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const report = {
      id: reportId,
      user_id: userId,
      sender,
      subject,
      body_preview: body.substring(0, 500), // Store preview only
      reported_at: reported_at || new Date().toISOString(),
      status: 'pending',
      analyzed: false,
      created_at: new Date().toISOString()
    };

    // Store report (in production, this would go to database)
    this._storePhishingReport(report);

    // Log security event
    await this.logSecurityEvent(userId, 'phishing_reported', {
      report_id: reportId,
      sender,
      subject_preview: subject.substring(0, 100)
    });

    return {
      report_id: reportId,
      reported_at: report.reported_at,
      message: 'Phishing email reported successfully. Security team will investigate.'
    };
  }

  /**
   * Report security incident
   */
  async reportSecurityIncident(userId, incidentData) {
    const { type, description, occurred_at, affected_data } = incidentData;

    // Validate required fields
    if (!type || !description) {
      throw new AppError('Type and description are required', 400);
    }

    const validTypes = ['lost_device', 'data_breach', 'suspicious_activity', 'other'];
    if (!validTypes.includes(type)) {
      throw new AppError('Invalid incident type', 400);
    }

    // Create incident report
    const incidentId = `inc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const incident = {
      id: incidentId,
      user_id: userId,
      type,
      description,
      occurred_at: occurred_at || new Date().toISOString(),
      affected_data: affected_data || [],
      status: 'open',
      priority: this._determinePriority(type, description),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store incident (in production, this would go to database)
    this._storeSecurityIncident(incident);

    // Log high-priority security event
    if (incident.priority === 'high' || incident.priority === 'critical') {
      await this.logSecurityEvent(userId, 'security_incident_reported', {
        incident_id: incidentId,
        type,
        priority: incident.priority
      });
    }

    return {
      incident_id: incidentId,
      reported_at: incident.created_at,
      priority: incident.priority,
      message: 'Security incident reported successfully. Our team will contact you if needed.'
    };
  }

  /**
   * Log security event
   */
  async logSecurityEvent(userId, eventType, metadata = {}) {
    const event = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      event_type: eventType,
      metadata,
      timestamp: new Date().toISOString(),
      ip_address: metadata.ip || 'unknown'
    };

    // Store event (in production, this would go to audit log database)
    this.auditLogs.push(event);
    
    // Generate alerts for certain event types
    if (this._shouldGenerateAlert(eventType)) {
      await this._generateSecurityAlert(userId, eventType, metadata);
    }

    return event;
  }

  /**
   * Get audit trail for user
   */
  async getAuditTrail(userId, startDate, endDate, eventTypes = []) {
    // Filter logs by user and criteria
    let filteredLogs = this.auditLogs.filter(log => log.user_id === userId);

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(startDate));
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= new Date(endDate));
    }

    if (eventTypes.length > 0) {
      filteredLogs = filteredLogs.filter(log => eventTypes.includes(log.event_type));
    }

    return filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  // Private helper methods
  _determinePriority(type, description) {
    // Determine incident priority
    if (type === 'data_breach') return 'critical';
    if (type === 'lost_device') return 'high';
    if (description.toLowerCase().includes('urgent') || description.toLowerCase().includes('critical')) {
      return 'high';
    }
    return 'medium';
  }

  _shouldGenerateAlert(eventType) {
    const alertEvents = [
      'failed_login',
      'suspicious_activity',
      'password_changed',
      'mfa_disabled',
      'new_device'
    ];
    return alertEvents.includes(eventType);
  }

  async _generateSecurityAlert(userId, eventType, metadata) {
    const alertTemplates = {
      'failed_login': {
        title: 'Failed Login Attempt',
        message: 'A login attempt failed. If this was not you, please change your password.',
        type: 'warning'
      },
      'suspicious_activity': {
        title: 'Suspicious Activity Detected',
        message: 'Unusual activity detected on your account.',
        type: 'warning'
      },
      'password_changed': {
        title: 'Password Changed',
        message: 'Your password was successfully changed.',
        type: 'info'
      },
      'new_device': {
        title: 'New Device Detected',
        message: 'A new device was used to access your account.',
        type: 'info'
      }
    };

    const template = alertTemplates[eventType];
    if (!template) return;

    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert = {
      id: alertId,
      user_id: userId,
      title: template.title,
      message: template.message,
      type: template.type,
      date: new Date().toISOString(),
      read: false,
      metadata,
      created_at: new Date().toISOString()
    };

    this.securityAlerts.push(alert);
  }

  _storePhishingReport(report) {
    // In production, store in database
    // For now, just log it
    console.log('[Phishing Report]', report);
  }

  _storeSecurityIncident(incident) {
    // In production, store in database
    // For now, just log it
    console.log('[Security Incident]', incident);
  }
}

export default new AuthAuditor();