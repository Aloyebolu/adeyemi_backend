import authService from './auth.service.js';
import catchAsync from '#utils/catchAsync.js';
import buildResponse from '#utils/responseBuilder.js';
import { extractDeviceInfo } from '#utils/deviceLogger.js';
import jwt from "jsonwebtoken";

// ==================== NEW SECURITY SERVICE IMPORTS ====================
import AuditService from './services/audit/AuthAuditor2.js';
import SecurityService from './services/SecurityService.js';
import MFAService from './services/twofa/TwoFactorManager.js';
import SessionService from './services/session/SessionManager.js';
import DeviceService from './services/device/DeviceManager.js';
import PrivacyService from './services/privacy/PrivacyManager.js';
import RecoveryService from './services/recovery/AccountRecoveryService.js';
import AppError from '#shared/errors/AppError.js';
import departmentService from '#domain/organization/department/department.service.js';
import { generate_honeytoken } from '#utils/createToken.js';
// ======================================================================

/** 
 * @desc    Authenticate user (signin)
 * @route   POST /api/users/signin/:role
 * @access  Public
**/
const signin = catchAsync(async (req, res, next) => {
  try {
    const { role } = req.params;

    if (!['admin', 'lecturer', 'student'].includes(role)) {
      throw new AppError('Invalid signin role', 400);
    }

    let user =
      await authService.authenticateUser(role, req.body, extractDeviceInfo(req));

    const access_token = user.access_token;
    // 🍪 Set secure cookie
    res.cookie("access_token", access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24,
    });

    delete (user.access_token); // Remove token from response body for security
    user.access_token = generate_honeytoken(user._id || user.id); // Add honeytoken to response for monitoring
    return buildResponse.success(res, `${role} signin successful!`, { user });

  } catch (err) {

    const userId = err instanceof AppError ? err.data?.userId : null;

    req.auditContext = {
      userId,
      status: "FAILURE",
      action: "SIGNIN_ATTEMPT",
      resource: "Auth",
      details: {
        role: req.params.role,
        errorMessage: "Login Failed",
        stack: err.stack
      }
    };

    next(err);
  }
});


// POST /auth/shadow-login
const shadowLogin = catchAsync(async (req, res) => {
  const { departmentId } = req.body;

  // Must have a valid user token
  const token = req.user?.token;
  if (!token || !departmentId) {
    throw new AppError("Missing token or departmentId", 400);
  }

  // Decode existing token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.TOKEN_KEY);
  } catch (err) {
    throw new AppError("Invalid or expired token", 401);
  }

  // Only VC can perform shadow login
  if (decoded.role !== "vc") {
    throw new AppError("Unauthorized role for shadow login", 403);
  }

  // Get department details
  const department = await departmentService.getDepartmentById(departmentId);
  if (!department) {
    throw new AppError("Department not found", 404);
  }

  // Remove existing iat and exp to avoid JWT errors
  const { iat, exp, nbf, ...cleanPayload } = decoded;

  // Prepare new payload pretending to be HOD
  const shadowPayload = {
    ...cleanPayload,
    view_context: {
      role: "hod",                  // pretend role
      department_id: departmentId,  // department being viewed
      hod_id: department.hod._id    // actual HOD for audit/logging
    }
  };

  // Issue a new JWT for this shadow session
  const shadowToken = jwt.sign(shadowPayload, process.env.TOKEN_KEY, {
    expiresIn: "30m" // temporary session
  });


  // Audit metadata example for logs
  // Always store the real VC info in audit

  req.auditContext = {
    action: `VC ${decoded._id} performed shadow login for HOD of department ${departmentId}`,
    resource: "Auth"
  }
  // 🍪 Set secure cookie
  res.cookie("access_token", shadowToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 1000 * 60 * 60 * 24,
  });
  console.log(shadowToken)
  return buildResponse.success(res, "Shadow login successful", {
    token: shadowToken,
    shadowRole: shadowPayload.view_context.role,
    departmentId,
    hodId: shadowPayload.view_context.hod_id
  });
});
// @desc    Get password status for a user
// @route   GET /api/auth/:userId/password-status
// @access  Private (self or admin)
const getPasswordStatus = catchAsync(async (req, res) => {
  const { userId } = req.params;

  // Authorization check
  if (req.user._id !== userId && req.user.role !== 'admin') {
    throw new AppError('Unauthorized: You can only view your own password status', 403);
  }

  const passwordStatus = await authService.getPasswordStatus(userId);

  return buildResponse.success(res, 'Password status retrieved', passwordStatus);
});

// @desc    Change user password
// @route   PUT /api/auth/password
// @access  Private (self only)
const changeUserPassword = catchAsync(async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Validation moved to service
    const result = await authService.changeUserPassword(userId, currentPassword, newPassword);
    const { result: resultData, auditContext } = result;

    req.auditContext = auditContext;

    return buildResponse.success(res, resultData.message || 'Password changed successfully', resultData);
  } catch (error) {
    const errorAuditContext = {
      entity: "Auth",
      action: "CHANGE_PASSWORD",
      resource: "User",
      severity: error.statusCode === 401 ? "HIGH" : "MEDIUM",
      // entityId: req.user._id,
      status: "FAILURE",
      reason: error.message || "Password change failed",
      metadata: {
        // userId: req.user._id,
        errorCode: error.statusCode || 500,
        errorType: error.name,
        errorMessage: error.message,
        // Don't include sensitive data in audit logs
        timestamp: new Date().toISOString()
      }
    };
    req.auditContext = errorAuditContext;
    next(error);
  }

});

// @desc    Force password reset for a user (admin only)
// @route   POST /api/auth/:userId/force-password-reset
// @access  Private/Admin
const forcePasswordReset = catchAsync(async (req, res) => {
  const { userId } = req.params;

  // Authorization check (already handled by middleware but double-check)
  if (req.user.role !== 'admin') {
    throw new AppError('Unauthorized: Only admins can force password reset', 403);
  }

  const result = await authService.forcePasswordReset(userId);

  return buildResponse.success(res, result.message, result);
});

// ==================== SECTION 1: PASSWORD MANAGEMENT ====================
const checkPasswordStrength = catchAsync(async (req, res) => {
  const { password } = req.body;
  const userId = req.user._id;

  const result = await SecurityService.checkPasswordStrength(userId, password);
  return buildResponse.success(res, 'Password strength analyzed', result);
});

const getPasswordAge = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await SecurityService.getPasswordAge(userId);
  return buildResponse.success(res, 'Password age retrieved', result);
});

const initiatePasswordReset = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await RecoveryService.initiatePasswordReset(email);
  return buildResponse.success(res, result.message || 'Password reset initiated', result);
});

// ==================== SECTION 2: MFA MANAGEMENT ====================
const getMFASettings = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await MFAService.getUserMFASettings(userId);
  return buildResponse.success(res, 'MFA settings retrieved', result);
});

const setupMFA = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { method, phone_number, email } = req.body;

  const result = await MFAService.setupMFA(userId, method, { phone_number, email });
  return buildResponse.success(res, 'MFA setup initiated', result);
});

const verifyMFA = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { code } = req.body;

  const result = await MFAService.verifyMFASetup(userId, code);
  return buildResponse.success(res, result.message || 'MFA verified successfully', result);
});

const disableMFA = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { code } = req.body;

  const result = await MFAService.disableMFA(userId, code);
  return buildResponse.success(res, result.message || 'MFA disabled successfully', result);
});

const regenerateBackupCodes = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await MFAService.regenerateBackupCodes(userId);
  return buildResponse.success(res, 'Backup codes regenerated', result);
});

// ==================== SECTION 3: SESSION & DEVICE MANAGEMENT ====================
const getActiveSessions = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await SessionService.getActiveSessions(userId);
  return buildResponse.success(res, 'Active sessions retrieved', result);
});

const revokeSession = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { session_id } = req.body;

  const result = await SessionService.revokeSession(userId, session_id);
  return buildResponse.success(res, 'Session revoked successfully', result);
});

const revokeAllSessions = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { except_current = true } = req.body;

  const result = await SessionService.revokeAllSessions(userId, except_current);
  return buildResponse.success(res, 'All sessions revoked successfully', result);
});

const addTrustedDevice = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { device_name } = req.body;
  const deviceInfo = extractDeviceInfo(req);

  const result = await DeviceService.addTrustedDevice(userId, device_name, deviceInfo);
  return buildResponse.success(res, 'Device added to trusted list', result);
});

const removeTrustedDevice = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { device_id } = req.body;

  const result = await DeviceService.removeTrustedDevice(userId, device_id);
  return buildResponse.success(res, 'Device removed from trusted list', result);
});

// ==================== SECTION 4: CONNECTED APPS MANAGEMENT ====================
const getConnectedApps = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await SessionService.getConnectedApps(userId);
  return buildResponse.success(res, 'Connected apps retrieved', result);
});

const revokeAppAccess = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { app_id } = req.body;

  const result = await SessionService.revokeAppAccess(userId, app_id);
  return buildResponse.success(res, 'App access revoked successfully', result);
});

// ==================== SECTION 5: LOGIN HISTORY & ACTIVITY ====================
const getLoginHistory = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { limit = 20 } = req.query;

  const result = await AuditService.getUserLoginHistory(userId, parseInt(limit));
  return buildResponse.success(res, 'Login history retrieved', result);
});

const getSecurityAlerts = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await AuditService.getSecurityAlerts(userId);
  return buildResponse.success(res, 'Security alerts retrieved', result);
});

const markAlertAsRead = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { alert_id } = req.body;

  const result = await AuditService.markAlertAsRead(userId, alert_id);
  return buildResponse.success(res, 'Alert marked as read', result);
});

// ==================== SECTION 6: SECURITY INCIDENT REPORTING ====================
const reportPhishing = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { sender, subject, body, reported_at } = req.body;

  const result = await AuditService.reportPhishing(userId, { sender, subject, body, reported_at });
  return buildResponse.success(res, 'Phishing email reported successfully', result);
});

const reportSecurityIncident = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const { type, description, occurred_at, affected_data } = req.body;

  const result = await AuditService.reportSecurityIncident(userId, { type, description, occurred_at, affected_data });
  return buildResponse.success(res, 'Security incident reported successfully', result);
});

// ==================== SECTION 7: PRIVACY SETTINGS ====================
const getPrivacySettings = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await PrivacyService.getUserPrivacySettings(userId);
  return buildResponse.success(res, 'Privacy settings retrieved', result);
});

const updatePrivacySettings = catchAsync(async (req, res) => {
  const userId = req.user._id;
  const settings = req.body;

  const result = await PrivacyService.updatePrivacySettings(userId, settings);
  return buildResponse.success(res, 'Privacy settings updated successfully', result);
});

// ==================== SECTION 8: SECURITY HEALTH CHECK ====================
const getSecurityHealth = catchAsync(async (req, res) => {
  const userId = req.user._id;

  const result = await SecurityService.getSecurityHealth(userId);
  return buildResponse.success(res, 'Security health check completed', result);
});

// ==================== SECTION 9: ACCOUNT RECOVERY ====================
const initiateAccountRecovery = catchAsync(async (req, res) => {
  const { email } = req.body;

  const result = await RecoveryService.initiateAccountRecovery(email);
  return buildResponse.success(res, 'Account recovery initiated', result);
});

const verifyRecoveryToken = catchAsync(async (req, res) => {
  const { token } = req.body;

  const result = await RecoveryService.verifyRecoveryToken(token);
  return buildResponse.success(res, 'Recovery token verified', result);
});

const completeAccountRecovery = catchAsync(async (req, res) => {
  const { token, new_password } = req.body;

  const result = await RecoveryService.completeAccountRecovery(token, new_password);
  return buildResponse.success(res, result.message || 'Account recovered successfully', result);
});

export {
  shadowLogin,
  signin,
  getPasswordStatus,
  changeUserPassword,
  forcePasswordReset,
  // Export all new security functions
  checkPasswordStrength,
  getPasswordAge,
  initiatePasswordReset,
  getMFASettings,
  setupMFA,
  verifyMFA,
  disableMFA,
  regenerateBackupCodes,
  getActiveSessions,
  revokeSession,
  revokeAllSessions,
  addTrustedDevice,
  removeTrustedDevice,
  getConnectedApps,
  revokeAppAccess,
  getLoginHistory,
  getSecurityAlerts,
  markAlertAsRead,
  reportPhishing,
  reportSecurityIncident,
  getPrivacySettings,
  updatePrivacySettings,
  getSecurityHealth,
  initiateAccountRecovery,
  verifyRecoveryToken,
  completeAccountRecovery
};