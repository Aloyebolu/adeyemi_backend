import { hashData, verifyHashedData } from '../../../../utils/hashData.js';
import AppError from '../../../errors/AppError.js';
import User from '../../../user/user.model.js';
import studentModel from '../../../student/student.model.js';
import PasswordValidator from '../password/PasswordValidator.js';

class StudentAuthenticator {
  /**
   * Student authentication
   */
  async authenticate(credentials, deviceFingerprint) {
    const { matric_no, email, password } = credentials;
    let usedLegacyAuth = false;

    // SECURITY: Explicit validation
    if (!matric_no && !email) {
      throw new AppError('Matric Number or Email is required', 400);
    }

    if (!password) {
      throw new AppError('Password is required', 400);
    }

    // Find student by matric number or email
    const query = matric_no
      ? { matricNumber: matric_no }
      : { email: email };

    const userDetails = await studentModel.findOne(query).select('+_id +matricNumber +email +isActive').lean();
    if (!userDetails) {
      // SECURITY: Consistent timing
      await PasswordValidator.simulatePasswordVerification();
      throw new AppError('Invalid credentials', 401);
    }

    // AUDIT: Check if student account is active
    if (userDetails.isActive === false) {
      throw new AppError('Account is inactive', 403);
    }

    // Find linked user document
    const userDoc = await User.findById(userDetails._id).select('+password +role +forcePasswordChange');
    if (!userDoc) {
      console.error(`[AuthService] Student record exists but User record missing: ${userDetails._id}`);
      throw new AppError('Authentication system error', 500);
    }

    // AUDIT: Ensure student role is correct
    if (userDoc.role !== 'student') {
      console.error(`[AuthService] Role mismatch for student ID: ${userDetails._id}, User role: ${userDoc.role}`);
      throw new AppError('Authentication system error', 500);
    }

    // Validate password and track if legacy path was used
    usedLegacyAuth = await PasswordValidator.validatePassword(password, userDoc, userDetails, 'student');

    return { userDoc, userDetails, usedLegacyAuth };
  }
}

export default StudentAuthenticator;