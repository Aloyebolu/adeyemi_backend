// auth/services/session/SessionManager.js
import AppError from '../../../errors/AppError.js';

class SessionManager {
  constructor() {
    // In production, this would use Redis or database
    this.sessions = new Map();
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId) {
    // Mock data - replace with database/Redis queries
    return [
      {
        id: 'session_1',
        device_name: 'Chrome on Windows',
        device_type: 'desktop',
        browser: 'Chrome 120.0',
        location: 'Lagos, Nigeria',
        ip_address: '192.168.1.100',
        last_activity: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        is_current: true,
        trusted: false
      },
      {
        id: 'session_2',
        device_name: 'Firefox on Android',
        device_type: 'mobile',
        browser: 'Firefox 121.0',
        location: 'Abuja, Nigeria',
        ip_address: '10.0.0.50',
        last_activity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        is_current: false,
        trusted: true
      },
      {
        id: 'session_3',
        device_name: 'Safari on Mac',
        device_type: 'desktop',
        browser: 'Safari 17.0',
        location: 'Ibadan, Nigeria',
        ip_address: '172.16.0.25',
        last_activity: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        is_current: false,
        trusted: false
      }
    ];
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(userId, sessionId) {
    // Validate input
    if (!sessionId) {
      throw new AppError('Session ID is required', 400);
    }

    // Check if session exists and belongs to user
    const sessions = await this.getActiveSessions(userId);
    const sessionExists = sessions.some(session => session.id === sessionId);
    
    if (!sessionExists) {
      throw new AppError('Session not found or does not belong to user', 404);
    }

    // In production, this would invalidate the session in Redis/database
    // For now, return success
    return {
      success: true,
      session_id: sessionId,
      revoked_at: new Date().toISOString(),
      message: 'Session revoked successfully'
    };
  }

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(userId, exceptCurrent = true) {
    const sessions = await this.getActiveSessions(userId);
    let revokedCount = 0;
    const currentSessionId = sessions.find(s => s.is_current)?.id;

    // Filter sessions to revoke
    const sessionsToRevoke = exceptCurrent 
      ? sessions.filter(session => !session.is_current)
      : sessions;

    // In production, this would batch invalidate sessions
    revokedCount = sessionsToRevoke.length;

    return {
      success: true,
      revoked: revokedCount,
      current_session_preserved: exceptCurrent && currentSessionId ? true : false,
      revoked_at: new Date().toISOString(),
      message: `${revokedCount} session(s) revoked successfully`
    };
  }

  /**
   * Get connected applications (OAuth apps)
   */
  async getConnectedApps(userId) {
    // Mock data - replace with database queries
    return [
      {
        id: 'app_1',
        name: 'Google Drive',
        logo: 'https://www.gstatic.com/images/branding/product/1x/drive_2020q4_48dp.png',
        permissions: ['Read files', 'Upload files'],
        last_used: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
      },
      {
        id: 'app_2',
        name: 'Zoom',
        logo: 'https://st1.zoom.us/zoom.ico',
        permissions: ['Schedule meetings', 'Join meetings'],
        last_used: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago
      },
      {
        id: 'app_3',
        name: 'Research Portal',
        logo: null,
        permissions: ['Read research papers', 'Submit papers'],
        last_used: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
        created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() // 90 days ago
      }
    ];
  }

  /**
   * Revoke access for a connected app
   */
  async revokeAppAccess(userId, appId) {
    if (!appId) {
      throw new AppError('App ID is required', 400);
    }

    // Check if app exists and is connected to user
    const apps = await this.getConnectedApps(userId);
    const appExists = apps.some(app => app.id === appId);
    
    if (!appExists) {
      throw new AppError('Connected app not found', 404);
    }

    // In production, this would remove OAuth tokens/grants from database
    return {
      success: true,
      app_id: appId,
      revoked_at: new Date().toISOString(),
      message: 'App access revoked successfully'
    };
  }

  /**
   * Create a new session (for login)
   */
  async createSession(userId, deviceInfo, token) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      id: sessionId,
      user_id: userId,
      device_info: deviceInfo,
      token_hash: await this._hashToken(token),
      created_at: new Date().toISOString(),
      last_activity: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      is_active: true
    };

    // Store session in Redis/database
    this.sessions.set(sessionId, session);
    
    return sessionId;
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.last_activity = new Date().toISOString();
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Clean up expired sessions (background job)
   */
  async cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (new Date(session.expires_at) < now) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    return { cleaned: cleanedCount };
  }

  // Private helper methods
  async _hashToken(token) {
    // In production, use proper hashing
    return token; // Replace with actual hashing
  }
}

export default new SessionManager();