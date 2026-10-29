import { Global, Module } from '@nestjs/common';
import { NotifyService } from './notify.service.js';
import { createPusher, PUSH } from './push.js';

@Global()
@Module({ providers: [NotifyService, { provide: PUSH, useFactory: createPusher }], exports: [NotifyService, PUSH] })
export class NotifyModule {}
