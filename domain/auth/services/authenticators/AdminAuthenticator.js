import { hashData, verifyHashedData } from '../../../../utils/hashData.js';
import AppError from '../../../errors/AppError.js';
import User from '../../../user/user.model.js';
import Admin from '../../../admin/admin.model.js';
import PasswordValidator from '../password/PasswordValidator.js';

class AdminAuthenticator {
  /**
   * Admin authentication
   * SECURITY: Admin accounts have highest privilege - extra validation
   */
  async authenticate(credentials, deviceFingerprint) {
    const { admin_id, email, password } = credentials;
    let usedLegacyAuth = false;

    // SECURITY: Explicit validation before query
    if (!password) {
      throw new AppError('Password is required', 400);
    }

    if (!admin_id && !email) {
      throw new AppError('Admin ID or Email is required', 400);
    }

    // Find admin by ID or email
    const query = admin_id
      ? { admin_id: admin_id } // Already sanitized
      : { email: email }; // Already sanitized

    // SECURITY: Use findOne with projection to avoid returning full document unintentionally
    const userDetails = await Admin.findOne(query).select('+_id +admin_id +email').lean();
    if (!userDetails) {
      // SECURITY: Consistent timing and generic error to prevent enumeration
      await PasswordValidator.simulatePasswordVerification(); // Add timing consistency
      throw new AppError('Invalid credentials', 401);
    }

    // AUDIT: Check if admin account is disabled or locked
    if (userDetails.isDisabled) {
      throw new AppError('Account is disabled', 403);
    }

    // Find linked user document
    const userDoc = await User.findById(userDetails._id).select('+password +role +forcePasswordChange');
    if (!userDoc) {
      // SECURITY: This indicates data inconsistency - log for investigation
      console.error(`[AuthService] Admin record exists but User record missing: ${userDetails._id}`);
      throw new AppError('Authentication system error', 500);
    }

    // AUDIT: Ensure admin role is not being impersonated
    if (userDoc.role !== 'admin') {
      console.error(`[AuthService] Role mismatch for admin ID: ${userDetails._id}, User role: ${userDoc.role}`);
      throw new AppError('Authentication system error', 500);
    }

    // Validate password with consistent timing
    await PasswordValidator.validatePassword(password, userDoc, userDetails, 'admin');
    

    return { userDoc, userDetails, usedLegacyAuth };
  }
}

export default AdminAuthenticator;