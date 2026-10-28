import { type CanActivate, createParamDecorator, type ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { config } from '../config.js';
import { SessionsService, type Session } from './sessions.service.js';

export interface AuthContext { userId: string; session: Session }
type AuthedRequest = Request & { auth?: AuthContext };

const STEP_UP = 'klyr:step-up';
const ALLOW_PENDING = 'klyr:allow-mfa-pending';

/** Require a passkey or TOTP check in the last few minutes (signing, payouts, security changes). */
export const StepUp = () => SetMetadata(STEP_UP, true);
/** Route reachable by a session that still owes its second factor. */
export const AllowMfaPending = () => SetMetadata(ALLOW_PENDING, true);

export const Auth = createParamDecorator((_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().auth!);

export function bearer(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Throws unless the session passed a passkey or TOTP check within the step-up window. */
export function assertFreshMfa(session: Session) {
  const fresh = session.mfaAt && Date.now() - session.mfaAt.getTime() < config.session.stepUpMinutes * 60_000;
  if (!fresh) throw new ForbiddenException({ code: 'step_up_required' });
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(SessionsService) private readonly sessions: SessionsService,
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = bearer(req);
    const session = token ? await this.sessions.resolve(token) : null;
    if (!session) throw new UnauthorizedException({ code: 'signed_out' });

    const targets = [ctx.getHandler(), ctx.getClass()];
    if (session.state === 'mfa_pending' && !this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING, targets)) {
      throw new UnauthorizedException({ code: 'mfa_required' });
    }
    if (this.reflector.getAllAndOverride<boolean>(STEP_UP, targets)) assertFreshMfa(session);
    req.auth = { userId: session.userId, session };
    return true;
  }
}
