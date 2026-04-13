// auth/services/twofa/TwoFactorPolicy.js
export default class TwoFactorPolicy {
  static isRequired(user, context = {}) {
    if (user.role === 'admin') return true;
    if (context.is_new_device) return true;
    if (context.is_high_risk_login) return true;

    return Boolean(user.two_factor_enabled);
  }
}
