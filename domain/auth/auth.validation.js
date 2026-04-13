// auth/auth.validation.js
import Joi from 'joi';

const signin = {
  body: Joi.object({
    email: Joi.string().email(),
    password: Joi.string().required(),
    admin_id: Joi.string(),
    matric_no: Joi.string(),
    staff_id: Joi.string()
  })
};

const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(4).required()
  })
};

const forcePasswordReset = {
  params: Joi.object({
    userId: Joi.string().required()
  })
};

const getPasswordStatus = {
  params: Joi.object({
    userId: Joi.string().required()
  })
};

// ==================== NEW VALIDATION SCHEMAS ====================

// Section 1: Password Management
const checkPasswordStrength = {
  body: Joi.object({
    password: Joi.string().min(1).max(1024).required()
  })
};

const initiatePasswordReset = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
};

// Section 2: MFA Management
const setupMFA = {
  body: Joi.object({
    method: Joi.string().valid('app', 'sms', 'email').required(),
    phone_number: Joi.string().when('method', {
      is: 'sms',
      then: Joi.string().required(),
      otherwise: Joi.string()
    }),
    email: Joi.string().when('method', {
      is: 'email',
      then: Joi.string().email().required(),
      otherwise: Joi.string().email()
    })
  })
};

const verifyMFA = {
  body: Joi.object({
    code: Joi.string().pattern(/^[0-9]{6}$/).required()
  })
};

const disableMFA = {
  body: Joi.object({
    code: Joi.string().pattern(/^[0-9]{6}$/).required()
  })
};

// Section 3: Session & Device Management
const revokeSession = {
  body: Joi.object({
    session_id: Joi.string().required()
  })
};

const addTrustedDevice = {
  body: Joi.object({
    device_name: Joi.string().min(1).max(100).required()
  })
};

const removeTrustedDevice = {
  body: Joi.object({
    device_id: Joi.string().required()
  })
};

// Section 4: Connected Apps Management
const revokeAppAccess = {
  body: Joi.object({
    app_id: Joi.string().required()
  })
};

// Section 5: Login History & Activity
const getLoginHistory = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0)
  })
};

const markAlertAsRead = {
  body: Joi.object({
    alert_id: Joi.string().required()
  })
};

// Section 6: Security Incident Reporting
const reportPhishing = {
  body: Joi.object({
    sender: Joi.string().email().required(),
    subject: Joi.string().max(500).required(),
    body: Joi.string().max(10000).required(),
    reported_at: Joi.date().required()
  })
};

const reportSecurityIncident = {
  body: Joi.object({
    type: Joi.string().valid('lost_device', 'data_breach', 'suspicious_activity', 'other').required(),
    description: Joi.string().max(5000).required(),
    occurred_at: Joi.date().required(),
    affected_data: Joi.array().items(Joi.string())
  })
};

// Section 7: Privacy Settings
const updatePrivacySettings = {
  body: Joi.object({
    directory_visibility: Joi.string().valid('all', 'students', 'staff', 'none'),
    show_email: Joi.boolean(),
    show_phone: Joi.boolean(),
    show_courses: Joi.boolean()
  }).min(1)
};

// Section 8: Account Recovery
const initiateAccountRecovery = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
};

const verifyRecoveryToken = {
  body: Joi.object({
    token: Joi.string().required()
  })
};

const completeAccountRecovery = {
  body: Joi.object({
    token: Joi.string().required(),
    new_password: Joi.string().min(8).required()
  })
};

export default {
  signin,
  changePassword,
  forcePasswordReset,
  getPasswordStatus,
  // Export all new validation schemas
  checkPasswordStrength,
  initiatePasswordReset,
  setupMFA,
  verifyMFA,
  disableMFA,
  revokeSession,
  addTrustedDevice,
  removeTrustedDevice,
  revokeAppAccess,
  getLoginHistory,
  markAlertAsRead,
  reportPhishing,
  reportSecurityIncident,
  updatePrivacySettings,
  initiateAccountRecovery,
  verifyRecoveryToken,
  completeAccountRecovery
};