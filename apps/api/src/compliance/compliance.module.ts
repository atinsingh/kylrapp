import { Body, Controller, Get, Inject, Module, Post, UseGuards } from '@nestjs/common';
import { IdCheckRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { ComplianceService } from './compliance.service.js';
import { createIdVerifier, ID_VERIFIER } from './id-verifier.js';

@UseGuards(AuthGuard)
@Controller('id-check')
class ComplianceController {
  constructor(@Inject(ComplianceService) private readonly compliance: ComplianceService) {}

  @Get()
  status(@Auth() a: AuthContext) {
    return this.compliance.status(a.userId);
  }

  @Post()
  submit(@Auth() a: AuthContext, @Body(new ZodPipe(IdCheckRequest)) body: IdCheckRequest) {
    return this.compliance.submit(a.userId, body);
  }
}

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, { provide: ID_VERIFIER, useFactory: createIdVerifier }],
  exports: [ComplianceService],
})
export class ComplianceModule {}
