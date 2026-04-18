import { hashData, verifyHashedData } from '#utils/hashData.js';
import AppError from '#shared/errors/AppError.js';
import User from '#domain/user/user.model.js';
import lecturerModel from '#domain/user/lecturer/lecturer.model.js';
import PasswordValidator from '#domain/auth/services/password/PasswordValidator.js';

class LecturerAuthenticator {
  /**
   * Lecturer authentication
   */
  async authenticate(credentials, deviceFingerprint) {
    const { staff_id, email, password } = credentials;
    let usedLegacyAuth = false;

    // SECURITY: Explicit validation
    if (!staff_id && !email) {
      throw new AppError('Staff ID or Email is required', 400);
    }

    if (!password) {
      throw new AppError('Password is required', 400);
    }

    // Find lecturer by ID or email
    const query = staff_id
      ? { staffId: staff_id }
      : { email: email };

    const userDetails = await lecturerModel.findOne(query).select('+_id +staffId +email +isActive').lean();
    if (!userDetails) {
      // SECURITY: Consistent timing
      await PasswordValidator.simulatePasswordVerification();
      throw new AppError('Invalid credentials', 401);
    }

    // AUDIT: Check if lecturer account is active
    if (userDetails.isActive === false) {
      throw new AppError('Account is inactive', 403);
    }

    // Find linked user document
    const userDoc = await User.findById(userDetails._id).select('+password +role +forcePasswordChange');
    if (!userDoc) {
      console.error(`[AuthService] Lecturer record exists but User record missing: ${userDetails._id}`);
      throw new AppError('Data inconsistency detected', 500, {message: `[AuthService] Lecturer record exists but User record missing: ${userDetails._id}`});
    }

    // Validate password and track if legacy path was used
    usedLegacyAuth = await PasswordValidator.validatePassword(password, userDoc, userDetails, 'lecturer');

    return { userDoc, userDetails, usedLegacyAuth };
  }
}

export default LecturerAuthenticator;