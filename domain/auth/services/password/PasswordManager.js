/**
 * PasswordManager handles password operations such as changing passwords,
 * validating password status, and forcing password resets.
 * 
 * SECURITY: This service deals with sensitive password data and must ensure
 * best practices in password handling, validation, and storage.
 * 
 * No other services or controllers should handle password logic directly except for this service.
 */
import { hashData, verifyHashedData } from '#utils/hashData.js';
import AppError from '#shared/errors/AppError.js';
import User from '#domain/user/user.model.js';
import Admin from '#domain/admin/admin.model.js';
import lecturerModel from '#domain/user/lecturer/lecturer.model.js';
import studentModel from '#domain/user/student/student.model.js';
import PasswordValidator from './PasswordValidator.js';

class PasswordManager {
  /**
   * Change user password with validation and history tracking
   * SECURITY: This method handles sensitive password operations
   */
  async changeUserPassword(userId, currentPassword, newPassword) {
    // SECURITY: Validate inputs before any database operations
    if (!userId || !currentPassword || !newPassword) {
      throw new AppError('Missing required fields', 400);
    }

    // SECURITY: Prevent extremely long passwords that could cause DoS during hashing
    if (newPassword.length > 1024) {
      throw new AppError('Password is too long', 400);
    }

    try {
      // 1. Find the user with password history
      const user = await User.findById(userId).select('+password +passwordHistory +role +forcePasswordChange +legacyAuthCount');
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // 2. Verify current password
      const isCurrentPasswordValid = await verifyHashedData(currentPassword, user.password);
      let usedLegacyCurrentPassword = false;

      if (!isCurrentPasswordValid) {
        // LEGACY: Check if user is using default password pattern
        // SECURITY: This supports migration but should be phased out
        const userDetails = await this.getUserDetailsByRole(userId, user.role);
        if (!userDetails) {
          throw new AppError("User details not found", 404);
        }

        // LEGACY: Support for default pattern and raw IDs
        const defaultPasswordPattern = `AFUED@${userDetails?.staffId || userDetails?.matricNumber || ''}`;
        const rawId = userDetails?.staffId || userDetails?.matricNumber;

        if (currentPassword === defaultPasswordPattern || currentPassword === rawId) {
          usedLegacyCurrentPassword = true;
          console.warn(`[AuthService] User ${userId} changing password from legacy authentication`);
        } else {
          throw new AppError('Current password is incorrect', 401);
        }
      }

      // 3. Check if new password is different from current
      // SECURITY: Prevent no-op password changes
      const isSameAsCurrent = await verifyHashedData(newPassword, user.password);
      if (isSameAsCurrent) {
        throw new AppError('New password cannot be the same as current password', 400);
      }

      // 4. Check password history (prevent reuse of last 5 passwords)
      // SECURITY: Strong history policy to prevent password recycling
      if (user.passwordHistory && user.passwordHistory.length > 0) {
        const recentPasswords = user.passwordHistory
          .slice(-5) // SECURITY: Check last 5 passwords (increased from 3)
          .map(item => item.password);

        // SECURITY: Use parallel verification with consistent timing
        if (recentPasswords && recentPasswords[0]) {
          const verificationPromises = recentPasswords.map(password =>
            verifyHashedData(newPassword, password)
          );

          const results = await Promise.all(verificationPromises);
          if (results.some(isMatch => isMatch)) {
            throw new AppError('Cannot reuse a previous password. Please choose a new one.', 400);
          }
        }

      }

      // 5. Validate password strength
      // SECURITY: Minimum requirements should be enforced
      if (newPassword.length < 4) {
        throw new AppError('Password must be at least 4 characters long', 400);
      }

      // SECURITY: Check for common weak patterns
      if (PasswordValidator.isWeakPassword(newPassword, user.role, userId)) {
        throw new AppError('Password is too weak or predictable. Please choose a stronger one.', 400);
      }

      // 6. Hash the new password with strong algorithm
      const hashedNewPassword = await hashData(newPassword);

      // 7. Update user with new password and track history
      user.password = hashedNewPassword;
      user.lastPasswordChange = Date.now();
      user.forcePasswordChange = false; // Clear force flag on successful change

      // AUDIT: Clear legacy auth counter when setting a proper password
      if (usedLegacyCurrentPassword || user.legacyAuthCount > 0) {
        user.legacyAuthCount = 0;
      }

      // SECURITY: Store password metadata for future analysis (not strength assessment)
      user.passwordMeta = {
        changedAt: Date.now(),
        length: newPassword.length,
        // Note: Not storing actual password or strength assessment for security
      };

      // Add to password history (keep last 5 passwords)
      user.passwordHistory.push({
        password: hashedNewPassword,
        changedAt: Date.now()
      });

      // Limit history to last 5 passwords
      if (user.passwordHistory.length > 5) {
        user.passwordHistory = user.passwordHistory.slice(-5);
      }

      // SECURITY: Save with validation disabled (password validation done above)
      await user.save({ validateBeforeSave: false });

      // Prepare audit context
      const auditContext = {
        entity: "Auth",
        action: "CHANGE_PASSWORD",
        resource: "User",
        severity: "HIGH",
        entityId: userId,
        status: "SUCCESS",
        reason: "User changed password successfully",
        changes: {
          before: {
            lastPasswordChange: user.lastPasswordChange,
            forcePasswordChange: user.forcePasswordChange,
            legacyAuthCount: usedLegacyCurrentPassword ? user.legacyAuthCount : undefined
          },
          after: {
            lastPasswordChange: Date.now(),
            forcePasswordChange: false,
            legacyAuthCount: 0
          },
          changedFields: [
            "password",
            "lastPasswordChange",
            "forcePasswordChange",
            ...(usedLegacyCurrentPassword ? ["legacyAuthCount"] : [])
          ]
        },
        metadata: {
          userId,
          userRole: user.role,
          passwordChangeTime: new Date().toISOString(),
          usedLegacyAuth: usedLegacyCurrentPassword,
          passwordHistoryCount: user.passwordHistory.length,
          passwordMeta: {
            changedAt: Date.now(),
            length: newPassword.length
          },
          // Additional security context
          security: {
            passwordHistoryCheckPerformed: true,
            passwordStrengthValidated: true,
            legacyAuthMigrated: usedLegacyCurrentPassword
          }
        }
      };

      // Return success response
      const result = {
        message: 'Password changed successfully',
        lastPasswordChange: user.lastPasswordChange,
        passwordAgeDays: 0
      };

      return {
        result,
        auditContext
      };
    } catch (error) {
      // Prepare error audit context
      const errorAuditContext = {
        entity: "Auth",
        action: "CHANGE_PASSWORD",
        resource: "User",
        severity: error.statusCode === 401 ? "HIGH" : "MEDIUM",
        entityId: userId,
        status: "FAILURE",
        reason: error.message || "Password change failed",
        metadata: {
          userId,
          errorCode: error.statusCode || 500,
          errorType: error.name,
          errorMessage: error.message,
          // Don't include sensitive data in audit logs
          timestamp: new Date().toISOString()
        }
      };
      throw error;
    }
  }

  /**
   * Returns password security status for a user.
   * SECURITY: This is read-only and does NOT inspect password hashes.
   */
  async getPasswordStatus(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Handle legacy or migrated users
      if (!user.lastPasswordChange) {
        return {
          needsChange: true,
          urgency: 'critical',
          message: 'Password must be updated',
        };
      }

      const now = Date.now();
      const passwordAgeDays = Math.floor(
        (now - new Date(user.lastPasswordChange).getTime()) / (1000 * 60 * 60 * 24)
      );

      const expiryDays = user.passwordExpiryDays ?? 90;
      const rawDaysRemaining = expiryDays - passwordAgeDays;
      const daysRemaining = Math.max(rawDaysRemaining, 0);

      const expiryDate = new Date(user.lastPasswordChange);
      expiryDate.setDate(expiryDate.getDate() + expiryDays);

      // SECURITY: Do NOT assess password strength dynamically
      // Use stored metadata only to avoid timing attacks
      const passwordStrength = user.passwordMeta?.strength ?? 'unknown';

      // AUDIT: Check if forced password change is required
      const forceChange = user.forcePasswordChange === true;

      // AUDIT: Check legacy auth usage
      const hasLegacyAuth = (user.legacyAuthCount || 0) > 0;

      let urgency = 'none';
      if (forceChange) urgency = 'critical';
      else if (daysRemaining === 0) urgency = 'critical';
      else if (daysRemaining <= 7) urgency = 'high';
      else if (daysRemaining <= 30) urgency = 'medium';
      else if (passwordStrength === 'weak') urgency = 'low';
      else if (hasLegacyAuth) urgency = 'medium'; // Legacy auth increases urgency

      return {
        passwordAgeDays,
        passwordExpiryDays: expiryDays,
        daysRemaining,
        expiryDate,
        lastPasswordChange: user.lastPasswordChange,
        passwordStrength,
        urgency,
        needsChange: urgency !== 'none' || passwordStrength === 'weak' || forceChange || hasLegacyAuth,
        forceChangeRequired: forceChange,
        hasLegacyAuth,
        message: PasswordValidator.getPasswordMessage(urgency, passwordStrength, daysRemaining, forceChange, hasLegacyAuth),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get password status', 500);
    }
  }

  /**
   * Force password reset for a user (admin only)
   * SECURITY: This should be rate-limited at controller level
   */
  async forcePasswordReset(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Set password expiry to force change on next login
      user.passwordExpiryDays = 0;
      user.forcePasswordChange = true; // SECURITY: Additional flag
      user.lastPasswordChange = new Date(0); // AUDIT: Set to epoch to force change
      await user.save();

      return {
        message: 'Password reset forced successfully. User will need to change password on next login.',
        userId
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to force password reset', 500);
    }
  }

  /**
   * Helper function to get user details based on role
   * SECURITY: This should only be used internally
   */
  async getUserDetailsByRole(userId, role) {
    if (!userId || !role) {
      throw new AppError('Internal server error', 500);
    }

    try {
      switch (role.toLowerCase()) {
        case 'admin':
          return await Admin.findById(userId).lean();

        case 'lecturer':
        case 'hod':
        case 'dean':
          // SECURITY: These roles share the lecturer model
          return await lecturerModel.findById(userId).lean();

        case 'student':
          return await studentModel.findById(userId).lean();

        default:
          return null;
      }
    } catch (error) {
      console.error(`[AuthService] Failed to get user details: ${userId}, ${role}`, error);
      throw new AppError('Failed to retrieve user details', 500);
    }
  }

}

export default PasswordManager;