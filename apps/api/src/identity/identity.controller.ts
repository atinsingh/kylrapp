import { Body, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import {
  EmailStartRequest, EmailVerifyRequest, PasskeyLoginVerifyRequest, PasskeyRegisterVerifyRequest, PasswordLoginRequest,
  PasswordSetRequest, SignupRequest, TotpCodeRequest,
} from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { AllowMfaPending, assertFreshMfa, Auth, AuthGuard, StepUp, type AuthContext } from './auth.guard.js';
import { IdentityService } from './identity.service.js';
import { PasskeysService } from './passkeys.service.js';
import { SessionsService, type ClientInfo } from './sessions.service.js';

const client = (req: Request): ClientInfo => ({ userAgent: req.headers['user-agent'], ip: req.ip });

@Controller('auth')
export class IdentityController {
  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(PasskeysService) private readonly passkeys: PasskeysService,
    @Inject(SessionsService) private readonly sessions: SessionsService,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────
  @Post('signup') @HttpCode(202)
  signup(@Body(new ZodPipe(SignupRequest)) body: SignupRequest, @Req() req: Request) {
    return this.identity.signup(body, client(req));
  }

  @Post('email/start') @HttpCode(202)
  emailStart(@Body(new ZodPipe(EmailStartRequest)) body: EmailStartRequest) {
    return this.identity.startEmailSignIn(body.email);
  }

  @Post('email/verify') @HttpCode(200)
  emailVerify(@Body(new ZodPipe(EmailVerifyRequest)) body: EmailVerifyRequest, @Req() req: Request) {
    return this.identity.verifyEmailCode(body.email, body.code, client(req));
  }

  @Post('password/login') @HttpCode(200)
  passwordLogin(@Body(new ZodPipe(PasswordLoginRequest)) body: PasswordLoginRequest, @Req() req: Request) {
    return this.identity.passwordLogin(body.email, body.password, client(req));
  }

  @Post('passkey/login/options') @HttpCode(200)
  passkeyLoginOptions() {
    return this.passkeys.authenticationOptions();
  }

  @Post('passkey/login/verify') @HttpCode(200)
  passkeyLoginVerify(@Body(new ZodPipe(PasskeyLoginVerifyRequest)) body: PasskeyLoginVerifyRequest, @Req() req: Request) {
    return this.passkeys.authenticationVerify(body.challengeId, body.response, client(req));
  }

  // ── Second factor (reachable while the session is pending) ───────────────
  @Post('mfa/totp/verify') @HttpCode(200) @UseGuards(AuthGuard) @AllowMfaPending()
  totpVerify(@Auth() a: AuthContext, @Body(new ZodPipe(TotpCodeRequest)) body: TotpCodeRequest) {
    return this.identity.totpVerify(a.userId, a.session.id, body.code);
  }

  @Post('stepup/email/start') @HttpCode(202) @UseGuards(AuthGuard)
  stepUpEmailStart(@Auth() a: AuthContext) {
    return this.identity.startStepUpEmail(a.userId);
  }

  @Post('stepup/email/verify') @HttpCode(200) @UseGuards(AuthGuard)
  stepUpEmailVerify(@Auth() a: AuthContext, @Body(new ZodPipe(TotpCodeRequest)) body: TotpCodeRequest) {
    return this.identity.verifyStepUpEmail(a.userId, a.session.id, body.code);
  }

  @Post('logout') @HttpCode(200) @UseGuards(AuthGuard) @AllowMfaPending()
  async logout(@Auth() a: AuthContext) {
    await this.sessions.revoke(a.session.id);
    return { ok: true };
  }

  // ── Signed in ─────────────────────────────────────────────────────────────
  @Get('me') @UseGuards(AuthGuard)
  me(@Auth() a: AuthContext) {
    return this.identity.me(a.userId);
  }

  /** First password can be set right after sign-up; changing it later needs a fresh second factor. */
  @Post('password') @HttpCode(200) @UseGuards(AuthGuard)
  async setPassword(@Auth() a: AuthContext, @Body(new ZodPipe(PasswordSetRequest)) body: PasswordSetRequest) {
    const me = await this.identity.me(a.userId);
    if (me.hasPassword) assertFreshMfa(a.session);
    return this.identity.setPassword(a.userId, body.password);
  }

  @Post('password/change') @HttpCode(200) @UseGuards(AuthGuard) @StepUp()
  changePassword(@Auth() a: AuthContext, @Body(new ZodPipe(PasswordSetRequest)) body: PasswordSetRequest) {
    return this.identity.setPassword(a.userId, body.password);
  }

  @Post('passkey/register/options') @HttpCode(200) @UseGuards(AuthGuard)
  passkeyRegisterOptions(@Auth() a: AuthContext) {
    return this.passkeys.registrationOptions(a.userId);
  }

  @Post('passkey/register/verify') @HttpCode(200) @UseGuards(AuthGuard)
  passkeyRegisterVerify(@Auth() a: AuthContext, @Body(new ZodPipe(PasskeyRegisterVerifyRequest)) body: PasskeyRegisterVerifyRequest) {
    return this.passkeys.registrationVerify(a.userId, body.challengeId, body.response, body.name);
  }

  @Post('mfa/totp/setup') @HttpCode(200) @UseGuards(AuthGuard)
  async totpSetup(@Auth() a: AuthContext) {
    if (await this.identity.totpEnabled(a.userId)) assertFreshMfa(a.session);
    return this.identity.totpSetup(a.userId);
  }

  @Post('mfa/totp/disable') @HttpCode(200) @UseGuards(AuthGuard) @StepUp()
  totpDisable(@Auth() a: AuthContext) {
    return this.identity.totpDisable(a.userId);
  }

  @Get('passkeys') @UseGuards(AuthGuard)
  listPasskeys(@Auth() a: AuthContext) {
    return this.passkeys.list(a.userId);
  }

  @Delete('passkeys/:id') @UseGuards(AuthGuard) @StepUp()
  async removePasskey(@Auth() a: AuthContext, @Param('id') id: string) {
    if (!(await this.passkeys.remove(a.userId, id))) throw new NotFoundException();
    return { ok: true };
  }

  /** Step-up with a passkey: refreshes the window for password changes, signing and payouts. */
  @Post('passkey/stepup/options') @HttpCode(200) @UseGuards(AuthGuard)
  passkeyStepUpOptions(@Auth() a: AuthContext) {
    return this.passkeys.authenticationOptions(a.userId);
  }

  @Post('passkey/stepup/verify') @HttpCode(200) @UseGuards(AuthGuard)
  passkeyStepUpVerify(@Auth() a: AuthContext, @Body(new ZodPipe(PasskeyLoginVerifyRequest)) body: PasskeyLoginVerifyRequest) {
    return this.passkeys.stepUpVerify(a.userId, a.session.id, body.challengeId, body.response);
  }

  @Post('mfa/totp/enable') @HttpCode(200) @UseGuards(AuthGuard)
  totpEnable(@Auth() a: AuthContext, @Body(new ZodPipe(TotpCodeRequest)) body: TotpCodeRequest) {
    return this.identity.totpEnable(a.userId, a.session.id, body.code);
  }

  @Get('sessions') @UseGuards(AuthGuard)
  async listSessions(@Auth() a: AuthContext) {
    const rows = await this.sessions.list(a.userId);
    return rows.map(s => ({ ...s, current: s.id === a.session.id }));
  }

  @Post('sessions/revoke-others') @HttpCode(200) @UseGuards(AuthGuard)
  async revokeOthers(@Auth() a: AuthContext) {
    return { signedOut: await this.sessions.revokeOthers(a.userId, a.session.id) };
  }

  @Delete('sessions/:id') @UseGuards(AuthGuard)
  async revokeSession(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.sessions.revoke(id, a.userId))) throw new NotFoundException();
    return { ok: true };
  }
}
