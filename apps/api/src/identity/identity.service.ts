import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { and, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { LEGAL_VERSIONS, type Me, type SessionResponse, type SignupRequest } from '@klyr/contracts';
import { config } from '../config.js';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, consents, emailCodes, moveProfiles, passkeys, passwordCredentials, totpCredentials, userRoles, users } from '../db/schema.js';
import { decrypt, encrypt, hashCode, hashPassword, newTotpSecret, otpauthUrl, safeEqualHex, sixDigitCode, verifyPassword, verifyTotp } from './crypto.js';
import { MAILER, type Mailer } from './mailer.js';
import { SessionsService, type ClientInfo } from './sessions.service.js';

type User = typeof users.$inferSelect;

/** A single error for every failed sign-in, so responses don't reveal which accounts exist. */
const badCode = () => new UnauthorizedException({ code: 'invalid_code', message: 'That code is wrong or has expired' });

@Injectable()
export class IdentityService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(MAILER) private readonly mail: Mailer,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  // ── Sign-up ────────────────────────────────────────────────────────────────
  /**
   * Creates (or refreshes) an unverified account and emails a 6-digit code.
   * The response is the same whether or not the email already has an account.
   */
  async signup(req: SignupRequest, client: ClientInfo): Promise<{ sent: true }> {
    const existing = await this.findByEmail(req.email);
    if (existing?.emailVerifiedAt) {
      await this.sendCode(req.email, 'signin', 'You already have a Klyr account. Use this code to sign in.');
      return { sent: true };
    }

    await this.db.transaction(async tx => {
      const [user] = existing
        ? await tx.update(users).set({ legalName: req.legalName, phone: req.phone ?? null, prefs: { dealUpdates: req.dealUpdates } })
          .where(eq(users.id, existing.id)).returning()
        : await tx.insert(users).values({ email: req.email, legalName: req.legalName, phone: req.phone ?? null, prefs: { dealUpdates: req.dealUpdates } }).returning();
      const userId = user!.id;

      await tx.insert(userRoles).values({ userId, role: req.plan }).onConflictDoNothing();
      await tx.insert(moveProfiles).values({ userId, plan: req.plan, data: req.setup })
        .onConflictDoUpdate({ target: [moveProfiles.userId, moveProfiles.plan], set: { data: req.setup, updatedAt: new Date() } });

      // Every acceptance is a new row; the history is the record.
      await tx.insert(consents).values([
        { userId, kind: 'vow_terms', documentVersion: `terms:${LEGAL_VERSIONS.terms};vow:${LEGAL_VERSIONS.vowTerms}` },
        { userId, kind: 'privacy_notice', documentVersion: LEGAL_VERSIONS.privacyNotice },
        { userId, kind: 'reco_guide', documentVersion: LEGAL_VERSIONS.recoGuide },
        ...(req.marketing ? [{ userId, kind: 'marketing' as const, documentVersion: 'casl-express' }] : []),
      ]);
      await tx.insert(auditLog).values({ actorId: userId, action: 'signup', entity: 'user', entityId: userId, data: { plan: req.plan, ip: client.ip } });
    });

    await this.sendCode(req.email, 'signup', 'Enter this code in Klyr to confirm your email.');
    return { sent: true };
  }

  /** "I already have an account": email a sign-in code. Silent if the email is unknown. */
  async startEmailSignIn(email: string): Promise<{ sent: true }> {
    const user = await this.findByEmail(email);
    if (user) await this.sendCode(email, user.emailVerifiedAt ? 'signin' : 'signup', 'Use this code to sign in to Klyr.');
    return { sent: true };
  }

  async verifyEmailCode(email: string, code: string, client: ClientInfo): Promise<SessionResponse> {
    const [row] = await this.db.select().from(emailCodes)
      .where(and(eq(emailCodes.email, email), isNull(emailCodes.consumedAt), gt(emailCodes.expiresAt, new Date())))
      .orderBy(desc(emailCodes.createdAt)).limit(1);
    if (!row || row.attempts >= config.emailCode.maxAttempts) throw badCode();

    if (!safeEqualHex(row.codeHash, hashCode(config.codeKey, email, code))) {
      await this.db.update(emailCodes).set({ attempts: sql`${emailCodes.attempts} + 1` }).where(eq(emailCodes.id, row.id));
      throw badCode();
    }
    // Consume atomically so a code can't be used twice.
    const consumed = await this.db.update(emailCodes).set({ consumedAt: new Date() })
      .where(and(eq(emailCodes.id, row.id), isNull(emailCodes.consumedAt))).returning({ id: emailCodes.id });
    if (!consumed.length) throw badCode();

    const user = await this.findByEmail(email);
    if (!user) throw badCode();
    if (!user.emailVerifiedAt) {
      await this.db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    }
    return this.signIn(user.id, 'email_code', client);
  }

  // ── Passwords ──────────────────────────────────────────────────────────────
  async setPassword(userId: string, password: string) {
    const hash = await hashPassword(password);
    await this.db.insert(passwordCredentials).values({ userId, hash })
      .onConflictDoUpdate({ target: passwordCredentials.userId, set: { hash, failedCount: 0, lockedUntil: null, updatedAt: new Date() } });
    await this.audit(userId, 'password_set');
    return { ok: true };
  }

  async passwordLogin(email: string, password: string, client: ClientInfo): Promise<SessionResponse> {
    const invalid = () => new UnauthorizedException({ code: 'invalid_credentials', message: 'Email or password is wrong' });
    const user = await this.findByEmail(email);
    const [cred] = user ? await this.db.select().from(passwordCredentials).where(eq(passwordCredentials.userId, user.id)) : [];
    if (!user || !cred || !user.emailVerifiedAt) {
      await hashPassword(password); // keep timing similar for unknown accounts
      throw invalid();
    }
    if (cred.lockedUntil && cred.lockedUntil > new Date()) {
      throw new HttpException({ code: 'locked', message: 'Too many tries. Sign in with an email code, or wait 15 minutes.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    if (!(await verifyPassword(password, cred.hash))) {
      const failed = cred.failedCount + 1, lock = failed >= config.password.maxFailures;
      await this.db.update(passwordCredentials).set({
        failedCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(Date.now() + config.password.lockMinutes * 60_000) : cred.lockedUntil,
      }).where(eq(passwordCredentials.userId, user.id));
      throw invalid();
    }
    await this.db.update(passwordCredentials).set({ failedCount: 0, lockedUntil: null }).where(eq(passwordCredentials.userId, user.id));
    return this.signIn(user.id, 'password', client);
  }

  // ── TOTP ───────────────────────────────────────────────────────────────────
  /** Starting over replaces a working authenticator, so the caller must check step-up first when one is on. */
  async totpEnabled(userId: string) {
    const [cred] = await this.db.select({ enabledAt: totpCredentials.enabledAt }).from(totpCredentials).where(eq(totpCredentials.userId, userId));
    return !!cred?.enabledAt;
  }

  async totpDisable(userId: string) {
    await this.db.delete(totpCredentials).where(eq(totpCredentials.userId, userId));
    await this.db.update(users).set({ mfaEnrolledAt: null }).where(eq(users.id, userId));
    await this.audit(userId, 'totp_disabled');
    return { ok: true };
  }

  async totpSetup(userId: string) {
    const user = await this.getUser(userId);
    const secret = newTotpSecret();
    await this.db.insert(totpCredentials).values({ userId, secretEnc: encrypt(config.encryptionKey, secret) })
      .onConflictDoUpdate({ target: totpCredentials.userId, set: { secretEnc: encrypt(config.encryptionKey, secret), enabledAt: null, lastStep: null } });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  async totpEnable(userId: string, code: string) {
    await this.checkTotp(userId, code, { requireEnabled: false });
    await this.db.update(totpCredentials).set({ enabledAt: new Date() }).where(eq(totpCredentials.userId, userId));
    await this.db.update(users).set({ mfaEnrolledAt: new Date() }).where(eq(users.id, userId));
    await this.audit(userId, 'totp_enabled');
    return { ok: true };
  }

  /** Completes a pending sign-in, or refreshes the step-up window on an active session. */
  async totpVerify(userId: string, sessionId: string, code: string) {
    await this.checkTotp(userId, code, { requireEnabled: true });
    await this.sessions.completeMfa(sessionId);
    return { ok: true };
  }

  private async checkTotp(userId: string, code: string, o: { requireEnabled: boolean }) {
    const [cred] = await this.db.select().from(totpCredentials).where(eq(totpCredentials.userId, userId));
    if (!cred || (o.requireEnabled && !cred.enabledAt)) throw new BadRequestException({ code: 'totp_not_set_up' });
    const step = verifyTotp(decrypt(config.encryptionKey, cred.secretEnc), code);
    if (step == null || (cred.lastStep != null && step <= cred.lastStep)) throw badCode();
    await this.db.update(totpCredentials).set({ lastStep: step }).where(eq(totpCredentials.userId, userId));
  }

  // ── Shared ─────────────────────────────────────────────────────────────────
  /** Issues a session. Accounts with TOTP get a pending session until the second factor. */
  async signIn(userId: string, method: 'email_code' | 'password' | 'passkey', client: ClientInfo): Promise<SessionResponse> {
    const [totp] = await this.db.select({ enabledAt: totpCredentials.enabledAt }).from(totpCredentials).where(eq(totpCredentials.userId, userId));
    const passkey = method === 'passkey';
    const pending = !passkey && !!totp?.enabledAt;
    const { token, session } = await this.sessions.create(userId, method, { mfa: passkey, pending }, client);
    await this.audit(userId, 'signin', { method, ip: client.ip });
    return {
      session: { token, expiresAt: session.expiresAt.toISOString(), mfaRequired: pending },
      user: await this.me(userId),
    };
  }

  async me(userId: string): Promise<Me> {
    const user = await this.getUser(userId);
    const [roles, [pw], [pk], [totp]] = await Promise.all([
      this.db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId)),
      this.db.select({ userId: passwordCredentials.userId }).from(passwordCredentials).where(eq(passwordCredentials.userId, userId)),
      this.db.select({ n: count() }).from(passkeys).where(eq(passkeys.userId, userId)),
      this.db.select({ enabledAt: totpCredentials.enabledAt }).from(totpCredentials).where(eq(totpCredentials.userId, userId)),
    ]);
    return {
      id: user.id, email: user.email, legalName: user.legalName, emailVerified: !!user.emailVerifiedAt,
      roles: roles.map(r => r.role), hasPassword: !!pw, passkeys: pk?.n ?? 0, totpEnabled: !!totp?.enabledAt,
    };
  }

  async findByEmail(email: string): Promise<User | undefined> {
    const [u] = await this.db.select().from(users).where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, isNull(users.deletedAt)));
    return u;
  }

  async getUser(userId: string): Promise<User> {
    const [u] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!u) throw new NotFoundException();
    return u;
  }

  audit(actorId: string, action: string, data?: Record<string, unknown>) {
    return this.db.insert(auditLog).values({ actorId, action, entity: 'user', entityId: actorId, data: data ?? null });
  }

  private async sendCode(email: string, purpose: 'signup' | 'signin', intro: string) {
    const { cooldownSeconds, maxPerHour, ttlMinutes } = config.emailCode;
    const recent = await this.db.select({ createdAt: emailCodes.createdAt }).from(emailCodes)
      .where(and(eq(emailCodes.email, email), gt(emailCodes.createdAt, new Date(Date.now() - 3_600_000))))
      .orderBy(desc(emailCodes.createdAt));
    if (recent.length >= maxPerHour || (recent[0] && Date.now() - recent[0].createdAt.getTime() < cooldownSeconds * 1000)) {
      throw new HttpException({ code: 'slow_down', message: 'A code was just sent. Check your email or try again shortly.' }, HttpStatus.TOO_MANY_REQUESTS);
    }
    const code = sixDigitCode();
    await this.db.insert(emailCodes).values({
      email, purpose, codeHash: hashCode(config.codeKey, email, code),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    });
    await this.mail.send({
      to: email,
      subject: `${code} is your Klyr code`,
      text: `${intro}\n\n${code}\n\nIt expires in ${ttlMinutes} minutes. If you didn't ask for it, you can ignore this email.\n\nKlyr Realty Inc., Brokerage`,
    });
  }
}
