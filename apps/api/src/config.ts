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
  /**
   * 'expo' sends through Expo's push service (which relays to APNs and FCM). Payloads carry only
   * an address and a time, never client names or contact details. Locally, pushes go to the log.
   */
  pushProvider: process.env.PUSH_PROVIDER as 'expo' | undefined,
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
  /**
   * Request limits. Counters live in Redis (REDIS_URL) so every API server shares them; without it they are kept
   * in memory, which is only good for one process, so production refuses to start without Redis.
   * `scale` multiplies every limit (end-to-end tests raise it).
   */
  rateLimit: {
    redisUrl: process.env.REDIS_URL,
    scale: Number(process.env.RATE_LIMIT_SCALE ?? 1),
  },
  mailFrom: process.env.MAIL_FROM ?? 'Klyr <no-reply@klyr.ca>',
  smtpUrl: process.env.SMTP_URL,
};
