/**
 * Logs a user's login device information.
 *
 * This function is transport-aware but not transport-dependent.
 * It accepts either:
 *  - an Express request object (req), or
 *  - a pre-resolved deviceInfo object
 *
 * If device information has already been resolved upstream,
 * request parsing will be skipped.
 *
 * Notification triggering should match the notification service
 * contract and is intentionally delegated.
 */

import { UAParser } from 'ua-parser-js';
import User from '../domain/user/user.model.js';

export async function logDevice(userId, reqOrDevice) {
  if (!userId) throw new Error('UserId is required for device logging');

  // Fetch user document
  const userDoc = await User.findById(userId).lean().exec();
  if (!userDoc) throw new Error('User not found for device logging');

  /**
   * Resolve device info
   * Accepts either:
   *  - { deviceInfo }
   *  - req
   */
  const deviceInfo = reqOrDevice?.deviceInfo
    ? { ...reqOrDevice.deviceInfo, loginTime: new Date() }
    : extractDeviceInfo(reqOrDevice);

  const recentDevices = userDoc.recentDevices || [];

  const isKnownDevice = recentDevices.some(dev =>
    dev.ip === deviceInfo.ip &&
    dev.deviceType === deviceInfo.deviceType &&
    dev.browser === deviceInfo.browser &&
    dev.os === deviceInfo.os
  );

  if (isKnownDevice) return;

  // Add new device (keep last 5)
  const updatedDevices = [
    deviceInfo,
    ...recentDevices
  ].slice(0, 5);

  /**
   * Trigger notification only if device history already exists.
   * First-time logins or migrations should not notify.
   */
  if (recentDevices.length > 0) {
    // await notificationService.send({
    //   userId,
    //   event: 'auth.new_device_login',
    //   title: 'New device login detected',
    //   message: `New login from ${deviceInfo.deviceType} (${deviceInfo.browser})`,
    //   metadata: {
    //     ip: deviceInfo.ip,
    //     os: deviceInfo.os,
    //     deviceType: deviceInfo.deviceType,
    //     loginTime: deviceInfo.loginTime
    //   }
    // });
  }

  await User.findByIdAndUpdate(
    userId,
    { recentDevices: updatedDevices },
    { new: true }
  );
}


/**
 * Extracts device information from an Express request.
 *
 * This helper isolates HTTP and UA parsing concerns,
 * keeping domain logic clean and reusable.
 *
 * Should ONLY be used at the edge of the system
 * (auth, gateway, controller layers).
 */
export function extractDeviceInfo(reqOrDevice) {
  // If already a device object, return it
  if (reqOrDevice?.ip && !reqOrDevice.headers) {
    return reqOrDevice;
  }

  const req = reqOrDevice;
  if (!req?.headers) {
    throw new Error('Invalid request object for device extraction');
  }

  const ua = new UAParser(req.headers['user-agent']);

  return {
    ip: req.ip || req.connection?.remoteAddress || 'unknown',
    deviceType: ua.device?.type || 'desktop',
    browser: ua.browser?.name || 'unknown',
    os: ua.os?.name || 'unknown',
    sessionToken: req.token || null,
    loginTime: new Date()
  };
}
