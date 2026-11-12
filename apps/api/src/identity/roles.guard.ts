import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { and, eq, inArray } from 'drizzle-orm';
import type { ProviderRole, StaffRole } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import { userRoles } from '../db/schema.js';
import type { AuthContext } from './auth.guard.js';

const ROLES = 'klyr:roles';
/** Staff-only route. Use after AuthGuard. */
export const Roles = (...roles: (StaffRole | ProviderRole)[]) => SetMetadata(ROLES, roles);

/**
 * Staff see client personal information, so they must hold the role and have passed a second
 * factor (passkey or authenticator) in this session.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db, @Inject(Reflector) private readonly reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<(StaffRole | ProviderRole)[]>(ROLES, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const auth = ctx.switchToHttp().getRequest<{ auth?: AuthContext }>().auth;
    if (!auth) throw new ForbiddenException();
    const [held] = await this.db.select({ role: userRoles.role }).from(userRoles)
      .where(and(eq(userRoles.userId, auth.userId), inArray(userRoles.role, roles))).limit(1);
    if (!held) throw new ForbiddenException({ code: 'not_staff', message: 'This account doesn’t have access here.' });
    if (!auth.session.mfaAt) throw new ForbiddenException({ code: 'staff_mfa_required', message: 'Staff accounts confirm with a passkey or authenticator app.' });
    return true;
  }
}
