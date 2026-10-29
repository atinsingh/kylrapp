import { createHash } from 'node:crypto';

/** Runtime settings. In AWS these come from Secrets Manager / task env; locally the defaults work. */
function key(name: string, devSeed: string): Buffer {
  const v = process.env[name];
  if (v) {
    const b = Buffer.from(v, 'base64');
    if (b.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
    return b;
  }
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} is required in production`);
  return createHash('sha256').update(devSeed).digest();
}

export const config = {
  production: process.env.NODE_ENV === 'production',
  /** Encrypts TOTP secrets (AES-256-GCM). */
  encryptionKey: key('AUTH_ENCRYPTION_KEY', 'klyr-dev-encryption-key'),
  /** Keys the hash of pending email codes. */
  codeKey: key('AUTH_CODE_KEY', 'klyr-dev-code-key'),
  webauthn: {
    rpName: 'Klyr',
    rpID: process.env.WEBAUTHN_RP_ID ?? 'localhost',
    origins: (process.env.WEBAUTHN_ORIGINS ?? 'http://localhost:3000,http://localhost:3100').split(','),
  },
  session: {
    absoluteDays: 30,
    idleDays: 14,
    /** Step-up window for signing documents and payouts. */
    stepUpMinutes: 10,
  },
  /** Lets the phone app's web preview check in, for local testing only. */
  geofenceAllowWeb: process.env.NODE_ENV !== 'production' && process.env.GEOFENCE_ALLOW_WEB === '1',
  emailCode: { ttlMinutes: 10, maxAttempts: 5, cooldownSeconds: 30, maxPerHour: 5 },
  password: { maxFailures: 10, lockMinutes: 15 },
  /** Where listing photos are served from: CloudFront in AWS, the API's /media folder locally. */
  mediaBaseUrl: process.env.MEDIA_BASE_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`,
  mailFrom: process.env.MAIL_FROM ?? 'Klyr <no-reply@klyr.ca>',
  smtpUrl: process.env.SMTP_URL,
};
