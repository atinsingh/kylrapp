import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, decrypt, encrypt, hashPassword, totpAt, verifyPassword, verifyTotp } from './crypto.js';

describe('TOTP', () => {
  // RFC 6238 Appendix B, SHA-1 seed "12345678901234567890", truncated to 6 digits.
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it.each([
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
  ])('matches the RFC vector at t=%i', (t, code) => {
    expect(totpAt(secret, Math.floor(t / 30))).toBe(code);
  });
  it('accepts one step of clock drift and rejects more', () => {
    const now = 1_111_111_111_000;
    expect(verifyTotp(secret, totpAt(secret, Math.floor(now / 30_000) - 1), now)).not.toBeNull();
    expect(verifyTotp(secret, totpAt(secret, Math.floor(now / 30_000) - 3), now)).toBeNull();
  });
  it('round-trips base32', () => {
    const b = randomBytes(20);
    expect(base32Decode(base32Encode(b))).toEqual(b);
  });
});

describe('passwords', () => {
  it('verifies the right password only', async () => {
    const h = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true);
    expect(await verifyPassword('Correct horse battery staple', h)).toBe(false);
  });
});

describe('field encryption', () => {
  it('round-trips and detects tampering', () => {
    const key = randomBytes(32), sealed = encrypt(key, 'JBSWY3DPEHPK3PXP');
    expect(decrypt(key, sealed)).toBe('JBSWY3DPEHPK3PXP');
    const parts = sealed.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(key, parts.join('.'))).toThrow();
  });
});
