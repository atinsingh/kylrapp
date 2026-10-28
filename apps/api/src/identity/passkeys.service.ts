import { BadRequestException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, eq, gt } from 'drizzle-orm';
import {
  generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import type { SessionResponse } from '@klyr/contracts';
import { config } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { passkeys, webauthnChallenges } from '../db/schema.js';
import { IdentityService } from './identity.service.js';
import type { ClientInfo } from './sessions.service.js';

const CHALLENGE_TTL_MS = 5 * 60_000;
const rejected = () => new UnauthorizedException({ code: 'passkey_rejected', message: 'That passkey didn’t work. Try again or use an email code.' });

@Injectable()
export class PasskeysService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  async registrationOptions(userId: string) {
    const user = await this.identity.getUser(userId);
    const existing = await this.db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, userId));
    const options = await generateRegistrationOptions({
      rpName: config.webauthn.rpName,
      rpID: config.webauthn.rpID,
      userName: user.email,
      userDisplayName: user.legalName ?? user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map(c => ({ id: c.id, transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
    });
    const challengeId = await this.saveChallenge('registration', options.challenge, userId);
    return { challengeId, options };
  }

  async registrationVerify(userId: string, challengeId: string, response: unknown, name?: string) {
    const challenge = await this.takeChallenge(challengeId, 'registration', userId);
    const v = await verifyRegistrationResponse({
      response: response as RegistrationResponseJSON,
      expectedChallenge: challenge,
      expectedOrigin: config.webauthn.origins,
      expectedRPID: config.webauthn.rpID,
      requireUserVerification: true,
    }).catch(() => ({ verified: false as const }));
    if (!v.verified) throw new BadRequestException({ code: 'passkey_rejected' });

    const { credential, credentialDeviceType, credentialBackedUp } = v.registrationInfo;
    await this.db.insert(passkeys).values({
      id: credential.id, userId, publicKey: credential.publicKey, counter: credential.counter,
      transports: credential.transports ?? null, deviceType: credentialDeviceType, backedUp: credentialBackedUp, name: name ?? null,
    });
    await this.identity.audit(userId, 'passkey_added', { credentialId: credential.id });
    return { ok: true };
  }

  /** Discoverable-credential sign-in: the browser offers the user's passkeys, no email needed. */
  async authenticationOptions() {
    const options = await generateAuthenticationOptions({ rpID: config.webauthn.rpID, userVerification: 'required' });
    const challengeId = await this.saveChallenge('authentication', options.challenge, null);
    return { challengeId, options };
  }

  async authenticationVerify(challengeId: string, response: unknown, client: ClientInfo): Promise<SessionResponse> {
    const challenge = await this.takeChallenge(challengeId, 'authentication', null);
    const r = response as AuthenticationResponseJSON;
    const [cred] = await this.db.select().from(passkeys).where(eq(passkeys.id, r.id));
    if (!cred) throw rejected();

    const v = await verifyAuthenticationResponse({
      response: r,
      expectedChallenge: challenge,
      expectedOrigin: config.webauthn.origins,
      expectedRPID: config.webauthn.rpID,
      credential: { id: cred.id, publicKey: cred.publicKey, counter: cred.counter, transports: cred.transports ?? undefined },
      requireUserVerification: true,
    }).catch(() => null);
    if (!v?.verified) throw rejected();

    await this.db.update(passkeys).set({ counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeys.id, cred.id));
    return this.identity.signIn(cred.userId, 'passkey', client);
  }

  private async saveChallenge(kind: 'registration' | 'authentication', challenge: string, userId: string | null) {
    const [row] = await this.db.insert(webauthnChallenges)
      .values({ kind, challenge, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) })
      .returning({ id: webauthnChallenges.id });
    return row!.id;
  }

  /** Single use: deleted as it is read. */
  private async takeChallenge(id: string, kind: 'registration' | 'authentication', userId: string | null) {
    const [row] = await this.db.delete(webauthnChallenges)
      .where(and(eq(webauthnChallenges.id, id), eq(webauthnChallenges.kind, kind), gt(webauthnChallenges.expiresAt, new Date())))
      .returning();
    if (!row || (userId && row.userId !== userId)) throw rejected();
    return row.challenge;
  }
}

type AuthenticatorTransportFuture = 'ble' | 'cable' | 'hybrid' | 'internal' | 'nfc' | 'smart-card' | 'usb';
