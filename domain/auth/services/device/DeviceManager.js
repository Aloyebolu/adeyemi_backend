// auth/services/device/DeviceManager.js
import crypto from 'crypto';
import AppError from '../../../errors/AppError.js';

class DeviceManager {
  constructor() {
    this.devices = new Map();
  }

  /**
   * Add a device to trusted list
   */
  async addTrustedDevice(userId, deviceName, deviceInfo) {
    if (!deviceName || typeof deviceName !== 'string') {
      throw new AppError('Device name is required', 400);
    }

    if (deviceName.length > 100) {
      throw new AppError('Device name is too long', 400);
    }

    // Generate device ID
    const deviceId = `dev_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Extract device details
    const deviceDetails = {
      id: deviceId,
      user_id: userId,
      name: deviceName,
      type: this._detectDeviceType(deviceInfo),
      browser: this._extractBrowser(deviceInfo),
      os: this._extractOS(deviceInfo),
      ip_address: deviceInfo.ip || 'unknown',
      location: deviceInfo.location || 'unknown',
      added_at: new Date().toISOString(),
      last_used: new Date().toISOString(),
      trusted: true,
      fingerprint: this._generateDeviceFingerprint(deviceInfo)
    };

    // Store device in database/Redis
    this._storeDevice(deviceId, deviceDetails);

    // Get updated trusted devices list
    const trustedDevices = await this.getTrustedDevices(userId);

    return {
      device_id: deviceId,
      device_name: deviceName,
      added_at: deviceDetails.added_at,
      total_trusted_devices: trustedDevices.length,
      message: 'Device added to trusted list'
    };
  }

  /**
   * Remove a device from trusted list
   */
  async removeTrustedDevice(userId, deviceId) {
    if (!deviceId) {
      throw new AppError('Device ID is required', 400);
    }

    // Check if device exists and belongs to user
    const device = await this._getDevice(deviceId);
    
    if (!device) {
      throw new AppError('Device not found', 404);
    }

    if (device.user_id !== userId) {
      throw new AppError('Device does not belong to user', 403);
    }

    // Remove from trusted list (but keep in history)
    device.trusted = false;
    device.removed_at = new Date().toISOString();
    
    // Update in storage
    this._storeDevice(deviceId, device);

    return {
      success: true,
      device_id: deviceId,
      removed_at: device.removed_at,
      message: 'Device removed from trusted list'
    };
  }

  /**
   * Get user's trusted devices
   */
  async getTrustedDevices(userId) {
    // Mock data - replace with database queries
    return [
      {
        id: 'dev_1',
        name: 'My Laptop',
        type: 'desktop',
        browser: 'Chrome 120.0',
        os: 'Windows 11',
        ip_address: '192.168.1.100',
        location: 'Lagos, Nigeria',
        added_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        last_used: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        trusted: true
      },
      {
        id: 'dev_2',
        name: 'Phone',
        type: 'mobile',
        browser: 'Safari 17.0',
        os: 'iOS 17.2',
        ip_address: '10.0.0.50',
        location: 'Abuja, Nigeria',
        added_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days ago
        last_used: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        trusted: true
      }
    ];
  }

  /**
   * Check if device is trusted
   */
  async isDeviceTrusted(userId, deviceFingerprint) {
    const trustedDevices = await this.getTrustedDevices(userId);
    return trustedDevices.some(device => device.fingerprint === deviceFingerprint);
  }

  /**
   * Update device last used timestamp
   */
  async updateDeviceLastUsed(deviceId) {
    const device = await this._getDevice(deviceId);
    if (device) {
      device.last_used = new Date().toISOString();
      this._storeDevice(deviceId, device);
    }
  }

  /**
   * Get device usage statistics
   */
  async getDeviceStats(userId) {
    const trustedDevices = await this.getTrustedDevices(userId);
    
    const stats = {
      total_devices: trustedDevices.length,
      by_type: {},
      by_location: {},
      most_used: null,
      recently_added: null
    };

    trustedDevices.forEach(device => {
      // Count by type
      stats.by_type[device.type] = (stats.by_type[device.type] || 0) + 1;
      
      // Count by location
      stats.by_location[device.location] = (stats.by_location[device.location] || 0) + 1;
    });

    // Find most used device (by last_used recency)
    if (trustedDevices.length > 0) {
      stats.most_used = trustedDevices.reduce((prev, current) => 
        new Date(prev.last_used) > new Date(current.last_used) ? prev : current
      );
      
      stats.recently_added = trustedDevices.reduce((prev, current) => 
        new Date(prev.added_at) > new Date(current.added_at) ? prev : current
      );
    }

    return stats;
  }

  // Private helper methods
  _detectDeviceType(deviceInfo) {
    const userAgent = deviceInfo.userAgent || '';
    
    if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
      return 'mobile';
    } else if (/tablet/i.test(userAgent)) {
      return 'tablet';
    } else {
      return 'desktop';
    }
  }

  _extractBrowser(deviceInfo) {
    const userAgent = deviceInfo.userAgent || '';
    
    if (/chrome/i.test(userAgent)) return 'Chrome';
    if (/firefox/i.test(userAgent)) return 'Firefox';
    if (/safari/i.test(userAgent)) return 'Safari';
    if (/edge/i.test(userAgent)) return 'Edge';
    if (/opera/i.test(userAgent)) return 'Opera';
    
    return 'Unknown';
  }

  _extractOS(deviceInfo) {
    const userAgent = deviceInfo.userAgent || '';
    
    if (/windows/i.test(userAgent)) return 'Windows';
    if (/mac os/i.test(userAgent)) return 'macOS';
    if (/linux/i.test(userAgent)) return 'Linux';
    if (/android/i.test(userAgent)) return 'Android';
    if (/ios|iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
    
    return 'Unknown';
  }

  _generateDeviceFingerprint(deviceInfo) {
    const components = [
      deviceInfo.userAgent || '',
      deviceInfo.ip || '',
      deviceInfo.platform || '',
      deviceInfo.language || ''
    ];
    
    const fingerprint = components.join('|');
    return crypto.createHash('sha256').update(fingerprint).digest('hex');
  }

  _storeDevice(deviceId, device) {
    // In production, store in database/Redis
    this.devices.set(deviceId, device);
  }

  async _getDevice(deviceId) {
    // In production, retrieve from database/Redis
    return this.devices.get(deviceId);
  }
}

export default new DeviceManager();