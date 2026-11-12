import { Body, Controller, Global, HttpCode, Inject, Module, Post, UseGuards } from '@nestjs/common';
import { RegisterDeviceRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { NotifyService } from './notify.service.js';
import { createPusher, PUSH } from './push.js';

/** The Klyr app on a buyer's phone registers for push; Klyr Pro phones use /pro/devices. */
@UseGuards(AuthGuard)
@Controller('me')
class DevicesController {
  constructor(@Inject(NotifyService) private readonly notify: NotifyService) {}

  @Post('devices') @HttpCode(200)
  async register(@Auth() a: AuthContext, @Body(new ZodPipe(RegisterDeviceRequest)) body: RegisterDeviceRequest) {
    await this.notify.register(a.userId, a.session.id, body.token, body.platform, 'consumer');
    return { ok: true };
  }
}

@Global()
@Module({ controllers: [DevicesController], providers: [NotifyService, { provide: PUSH, useFactory: createPusher }], exports: [NotifyService, PUSH] })
export class NotifyModule {}
