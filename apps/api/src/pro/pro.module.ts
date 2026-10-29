import { Body, Controller, Get, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { DecideShowingRequest, GeoCheckRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { FieldActivityService } from './activity.service.js';
import { ProService } from './pro.service.js';

/** Klyr Pro (agents). Every route is scoped to the signed-in agent's own deals. */
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
@Controller('pro')
class ProController {
  constructor(@Inject(ProService) private readonly pro: ProService, @Inject(FieldActivityService) private readonly activity: FieldActivityService) {}

  @Get('me')
  me(@Auth() a: AuthContext) { return this.pro.me(a.userId); }

  @Get('showings')
  showings(@Auth() a: AuthContext) { return this.pro.showings(a.userId); }

  @Post('showings/:id/decide') @HttpCode(200)
  decide(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(DecideShowingRequest)) body: DecideShowingRequest) {
    return this.pro.decide(a.userId, id, body);
  }

  @Post('showings/:id/check-in') @HttpCode(200)
  checkIn(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(GeoCheckRequest)) body: GeoCheckRequest) {
    return this.pro.checkIn(a.userId, id, body);
  }

  @Post('showings/:id/complete') @HttpCode(200)
  complete(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(GeoCheckRequest)) body: GeoCheckRequest) {
    return this.pro.complete(a.userId, id, body);
  }

  /** The agent's own field day: decisions, check-ins, completions and refused attempts. */
  @Get('activity')
  async myActivity(@Auth() a: AuthContext, @Query('day') day?: string) {
    const r = await this.activity.days(day, a.userId);
    return { day: r.day, ...r.agents[0]! };
  }

  @Get('clients')
  clients(@Auth() a: AuthContext) { return this.pro.clients(a.userId); }

  @Get('clients/:id')
  client(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.pro.client(a.userId, id); }
}

@Module({ controllers: [ProController], providers: [ProService, FieldActivityService], exports: [FieldActivityService] })
export class ProModule {}
