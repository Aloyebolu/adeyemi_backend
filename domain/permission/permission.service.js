// permission.service.js
import Permission from './permission.model.js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import AppError from '../errors/AppError.js';

const PERMISSION_SECRET = process.env.PERMISSION_SECRET;

/**
 * Issue a new permission token
 * @param {Object} params - parameters for permission
 * @param {String} params.action - action permitted
 * @param {Object} params.granted_to - user id and role
 * @param {Object} params.granted_by - admin id and role
 * @param {Object} params.scope - scope object
 * @param {Object} params.constraints - constraints object
 * @param {Date} params.expires_at - expiration date
 * @returns {Object} - saved permission and token string
 */
export const issuePermission = async ({ action, granted_to, granted_by, scope = {}, constraints = {}, expires_at }) => {
  const permission_id = uuidv4();

  // Prepare token payload
  const payload = {
    permission_id,
    action,
    granted_to,
    granted_by,
    scope,
    constraints,
    issued_at: new Date(),
    expires_at
  };

  // Sign token
  const token = jwt.sign(payload, PERMISSION_SECRET, { expiresIn: Math.floor((expires_at - new Date()) / 1000) + 's' });

  // Save to MongoDB
  const permissionDoc = new Permission({ ...payload, signature: token });
  await permissionDoc.save();

  return { permissionDoc, token };
};

/**
 * Validate a permission token and return decoded info
 * @param {String} token
 * @returns {Object} decoded permission
 */
export const validatePermission = async (token) => {
  try {
    const decoded = jwt.verify(token, PERMISSION_SECRET);
    return decoded;
  } catch (err) {
    throw new AppError('Invalid or expired permission token');
  }
};

/**
 * Optional: check and update usage constraints (like max_students)
 * This can be used inside controllers before performing an action
 */
export const checkConstraints = (permissionContext, usageCount) => {
  if (permissionContext.constraints?.max_students !== undefined) {
    if (usageCount > permissionContext.constraints.max_students) {
      throw new AppError(`Permission exceeds max allowed: ${permissionContext.constraints.max_students}`);
    }
  }
};
