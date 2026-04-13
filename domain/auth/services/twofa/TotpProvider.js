// auth/services/twofa/TotpProvider.js
import speakeasy from 'speakeasy';

export default class TotpProvider {
  static generateSecret(user_id) {
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `UniversityAuth (${user_id})`,
    });

    return {
      base32: secret.base32,
      otpauth_url: secret.otpauth_url,
    };
  }

  static verify({ secret, token }) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1,
    });
  }
}
