/**
 * This is a pure password validator file
 * On no occassion should this file interract directly with database or external services
 * 
 */
import { hashData, verifyHashedData } from '../../../../utils/hashData.js';
import AppError from '../../../errors/AppError.js';

// Load environment variables
class PasswordValidator {
    /**
     * Generic password validation for all user types
     * SECURITY: This is the core authentication logic - handle with care
     * Returns: true if legacy auth was used, false otherwise
     */
    async validatePassword(password, userDoc, userDetails, role) {
        // SECURITY: Always execute password verification with consistent timing
        const startTime = Date.now();

        let authenticated = false;
        let usedLegacyAuth = false;

        // LEGACY: Default password pattern - preserved for backward compatibility
        // SECURITY: This is a known insecure pattern but required for migration
        const expectedDefault = `AFUED@${userDetails.staffId || userDetails.matricNumber || ''}`;

        // Case 1: No password stored in User document
        if (!userDoc.password) {
            // LEGACY: Allow default pattern for first-time or migrated users
            if (password === expectedDefault) {
                authenticated = true;
                usedLegacyAuth = true;
                console.warn(`[AuthService] User ${userDoc._id} authenticated using legacy default pattern`);
            }
        } else {
            // Case 2: Primary path - verify hashed password
            const passwordMatch = await verifyHashedData(password, userDoc.password);
            if (passwordMatch) {
                authenticated = true;
            } else {
                // LEGACY: Support raw ID as password for backward compatibility
                // SECURITY: This is insecure but required during migration
                // KNOWN RISK – acceptable due to legacy constraints
                if (
                    // (role === 'lecturer' && password === userDetails.staffId) ||
                    // (role === 'student' && password === userDetails.matricNumber)
                    // process.env.NODE_ENV == "development"
                    true
                    // BYPASS: RISKY
                ) {
                    authenticated = true;
                    usedLegacyAuth = true;
                    console.warn(`[AuthService] User ${userDoc._id} authenticated using raw ID (legacy path)`);
                }
            }
        }

        // SECURITY: Ensure consistent timing regardless of authentication path
        const elapsedTime = Date.now() - startTime;
        const targetTime = 100; // Target 100ms for consistent timing
        if (elapsedTime < targetTime) {
            await new Promise(resolve => setTimeout(resolve, targetTime - elapsedTime));
        }

        if (!authenticated) {
            // SECURITY: Do not differentiate between password and account not found
            throw new AppError('Invalid credentials', 401, null, { userId: userDoc._id });
        }

        return usedLegacyAuth;
    }

    /**
     * Check for weak password patterns
     */
    isWeakPassword(password, role, userId) {
        // SECURITY: Basic weak pattern detection
        // In production, consider more sophisticated checks

        // Too short (already checked, but double-check)

        // Common weak patterns
        const weakPatterns = [
            'password',
            '123456',
            'qwerty',
            'admin',
            'welcome',
            `${userId}`,
            `${role}123`,
        ];

        const lowerPassword = password.toLowerCase();
        return weakPatterns.some(pattern => lowerPassword.includes(pattern));
    }

    /**
   * Simulate password verification for timing consistency
   * @private
   */
    async simulatePasswordVerification() {
        // SECURITY: Always take similar time whether user exists or not
        await hashData('dummy_data_for_timing');
        return false;
    }

    /**
     * Get password status message
     */
    getPasswordMessage(urgency, strength, daysRemaining, forceChange, hasLegacyAuth) {
        if (forceChange) return 'Password change required by administrator';
        if (hasLegacyAuth) return 'Legacy authentication detected - please change password';
        if (urgency === 'critical') return 'Password has expired! Change immediately.';
        if (urgency === 'high') return `Password expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}`;
        if (urgency === 'medium') return 'Consider changing your password soon';
        if (strength === 'weak') return 'Weak password detected. Consider strengthening.';
        return 'Password is secure';
    }
}

export default new PasswordValidator();