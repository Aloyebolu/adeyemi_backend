// permission.controller.js
import { issuePermission } from './permission.service.js';

/**
 * Controller to issue a new permission
 * Expects: req.body.action, req.body.granted_to, req.body.scope, req.body.constraints, req.body.expires_at
 */
export const issuePermissionController = async (req, res) => {
  try {
    // Only admins should be allowed to issue permissions
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { action, granted_to, scope = {}, constraints = {}, expires_at } = req.body;

    if (!action || !granted_to || !granted_to.id || !granted_to.role || !expires_at) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const { permissionDoc, token } = await issuePermission({
      action,
      granted_to,
      granted_by: { id: req.user.id, role: req.user.role },
      scope,
      constraints,
      expires_at: new Date(expires_at)
    });

    return res.status(201).json({ permission: permissionDoc, token });
  } catch (error) {
    console.error('Error issuing permission:', error);
    return res.status(500).json({ message: 'Server error while issuing permission' });
  }
};
