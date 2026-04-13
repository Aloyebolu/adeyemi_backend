// permission.middleware.js
import { validatePermission } from './permission.service.js';

/**
 * Middleware to check permission token
 * @param {String} requiredAction - action this route requires
 */
export const checkPermission = (requiredAction) => {
  return async (req, res, next) => {
    try {
      // Grab the permission token from header
      const token = req.headers['x-permission-token'];
      if (!token) {
        return res.status(403).json({ message: 'Permission token missing' });
      }

      // Validate token using permission service
      let decoded;
      try {
        decoded = await validatePermission(token);
      } catch (err) {
        return res.status(403).json({ message: err.message });
      }

      // Check action
      if (decoded.action !== requiredAction) {
        return res.status(403).json({ message: 'Permission not valid for this action' });
      }

      // Optional: check scope against request (e.g., department_id)
      if (decoded.scope.department_id && decoded.scope.department_id !== req.params.department_id) {
        return res.status(403).json({ message: 'Permission scope mismatch' });
      }

      // Attach permission context to request
      req.permission_context = {
        permission_id: decoded.permission_id,
        granted_by: decoded.granted_by,
        scope: decoded.scope,
        constraints: decoded.constraints
      };

      next();
    } catch (error) {
      console.error('Permission Middleware Error:', error);
      return res.status(500).json({ message: 'Server error while checking permission' });
    }
  };
};