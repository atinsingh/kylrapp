import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard.js';
import { IdentityController } from './identity.controller.js';
import { IdentityService } from './identity.service.js';
import { createMailer, MAILER } from './mailer.js';
import { PasskeysService } from './passkeys.service.js';
import { SessionsService } from './sessions.service.js';

/** Global so every module can use AuthGuard without importing identity. */
@Global()
@Module({
  controllers: [IdentityController],
  providers: [IdentityService, PasskeysService, SessionsService, AuthGuard, { provide: MAILER, useFactory: createMailer }],
  exports: [SessionsService, AuthGuard],
})
export class IdentityModule {}
