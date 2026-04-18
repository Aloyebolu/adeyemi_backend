import express from 'express';
import { 
  signin,
  getPasswordStatus, 
  changeUserPassword, 
  forcePasswordReset,
  // ==================== NEW SECURITY ENDPOINTS ====================
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
  checkPasswordStrength,
  getPasswordAge,
  initiatePasswordReset,
  initiateAccountRecovery,
  verifyRecoveryToken,
  completeAccountRecovery,
  shadowLogin
  // ================================================================
} from './auth.controller.js';
import authenticate from '#middlewares/authenticate.js';
import validate from '#middlewares/validate.js'; 
import authValidation from './auth.validation.js'; 

const router = express.Router();


router.post('/shadow-login', 
  shadowLogin
)
// Existing routes
router.post(
  '/signin/:role',
  validate(authValidation.signin),
  signin
);

router.get(
  '/:userId/password-status',
  authenticate(),
  validate(authValidation.getPasswordStatus),
  getPasswordStatus
);

router.put(
  '/password',
  authenticate(),
  validate(authValidation.changePassword),
  changeUserPassword
);

router.post(
  '/:userId/force-password-reset',
  authenticate(['admin']),
  validate(authValidation.forcePasswordReset),
  forcePasswordReset
);

// ==================== NEW SECURITY CENTER ROUTES ====================

// Section 1: Password Management
router.post(
  '/security/password/strength',
  authenticate(),
  validate(authValidation.checkPasswordStrength),
  checkPasswordStrength
);

router.get(
  '/security/password/age',
  authenticate(),
  getPasswordAge
);

router.post(
  '/auth/password/reset',
  validate(authValidation.initiatePasswordReset),
  initiatePasswordReset
);

// Section 2: MFA Management
router.get(
  '/security/mfa',
  authenticate(),
  getMFASettings
);

router.post(
  '/security/mfa/setup',
  authenticate(),
  validate(authValidation.setupMFA),
  setupMFA
);

router.post(
  '/security/mfa/verify',
  authenticate(),
  validate(authValidation.verifyMFA),
  verifyMFA
);

router.post(
  '/security/mfa/disable',
  authenticate(),
  validate(authValidation.disableMFA),
  disableMFA
);

router.post(
  '/security/mfa/backup-codes',
  authenticate(),
  regenerateBackupCodes
);

// Section 3: Session & Device Management
router.get(
  '/security/sessions',
  authenticate(),
  getActiveSessions
);

router.post(
  '/security/sessions/revoke',
  authenticate(),
  validate(authValidation.revokeSession),
  revokeSession
);

router.post(
  '/security/sessions/revoke-all',
  authenticate(),
  revokeAllSessions
);

router.post(
  '/security/trusted-devices',
  authenticate(),
  validate(authValidation.addTrustedDevice),
  addTrustedDevice
);

router.post(
  '/security/trusted-devices/remove',
  authenticate(),
  validate(authValidation.removeTrustedDevice),
  removeTrustedDevice
);

// Section 4: Connected Apps Management
router.get(
  '/security/connected-apps',
  authenticate(),
  getConnectedApps
);

router.post(
  '/security/connected-apps/revoke',
  authenticate(),
  validate(authValidation.revokeAppAccess),
  revokeAppAccess
);

// Section 5: Login History & Activity
router.get(
  '/security/login-history',
  authenticate(),
  validate(authValidation.getLoginHistory),
  getLoginHistory
);

router.get(
  '/security/alerts',
  authenticate(),
  getSecurityAlerts
);

router.post(
  '/security/alerts/read',
  authenticate(),
  validate(authValidation.markAlertAsRead),
  markAlertAsRead
);

// Section 6: Security Incident Reporting
router.post(
  '/security/report/phishing',
  authenticate(),
  validate(authValidation.reportPhishing),
  reportPhishing
);

router.post(
  '/security/report/incident',
  authenticate(),
  validate(authValidation.reportSecurityIncident),
  reportSecurityIncident
);

// Section 7: Privacy Settings
router.get(
  '/security/privacy',
  authenticate(),
  getPrivacySettings
);

router.put(
  '/security/privacy',
  authenticate(),
  validate(authValidation.updatePrivacySettings),
  updatePrivacySettings
);

// Section 8: Security Health Check
router.get(
  '/security/health',
  authenticate(),
  getSecurityHealth
);

// Section 9: Account Recovery
router.post(
  '/security/account/recovery',
  validate(authValidation.initiateAccountRecovery),
  initiateAccountRecovery
);

router.post(
  '/security/account/recovery/verify',
  validate(authValidation.verifyRecoveryToken),
  verifyRecoveryToken
);

router.post(
  '/security/account/recovery/complete',
  validate(authValidation.completeAccountRecovery),
  completeAccountRecovery
);

// ================================================================

export default router;