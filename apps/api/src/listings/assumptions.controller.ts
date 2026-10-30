import { Body, Controller, Delete, Get, Inject, Put, UseGuards } from '@nestjs/common';
import { Assumptions } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { AssumptionsService } from './assumptions.service.js';

/** "How we estimate": the inputs behind every all-in this buyer sees. */
@UseGuards(AuthGuard)
@Controller('me/assumptions')
export class AssumptionsController {
  constructor(@Inject(AssumptionsService) private readonly assumptions: AssumptionsService) {}

  @Get()
  get(@Auth() a: AuthContext) {
    return this.assumptions.get(a.userId);
  }

  @Put()
  put(@Auth() a: AuthContext, @Body(new ZodPipe(Assumptions)) body: Assumptions) {
    return this.assumptions.put(a.userId, body);
  }

  /** Back to the published defaults. */
  @Delete()
  reset(@Auth() a: AuthContext) {
    return this.assumptions.reset(a.userId);
  }
}
