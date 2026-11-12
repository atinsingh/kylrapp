import { Body, Controller, Get, HttpCode, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PublishListingRequest, SellerOfferDecision, SellPlanRequest, SellStartRequest, SellTaskRequest, SignOfferRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { DealsModule } from '../deals/deals.module.js';
import { assertFreshMfa, Auth, AuthGuard, StepUp, type AuthContext } from '../identity/auth.guard.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { OffersModule } from '../offers/offers.module.js';
import { SellingService } from './selling.service.js';

@UseGuards(AuthGuard)
@Controller('selling')
class SellingController {
  constructor(@Inject(SellingService) private readonly selling: SellingService) {}

  @Get()
  async get(@Auth() a: AuthContext) {
    const v = await this.selling.view(a.userId);
    if (!v) throw new NotFoundException({ code: 'not_selling', message: 'Start by telling us about your home.' });
    return v;
  }

  @Post() @HttpCode(201)
  start(@Auth() a: AuthContext, @Body(new ZodPipe(SellStartRequest)) b: SellStartRequest) { return this.selling.start(a.userId, b); }

  @Put('plan')
  plan(@Auth() a: AuthContext, @Body(new ZodPipe(SellPlanRequest)) b: SellPlanRequest) { return this.selling.setPlan(a.userId, b); }

  /** Listing agreement (Form 200), signed after a fresh check. */
  @Post('agreement/sign') @HttpCode(200) @StepUp()
  sign(@Auth() a: AuthContext, @Body(new ZodPipe(SignOfferRequest)) b: SignOfferRequest, @Req() req: Request) {
    return this.selling.sign(a.userId, b.typedName, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  /** Form 326 for a Klyr buyer who wants to make an offer. */
  @Post('consents/:id/sign') @HttpCode(200) @StepUp()
  consent(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SignOfferRequest)) b: SignOfferRequest, @Req() req: Request) {
    return this.selling.signConsent(a.userId, id, b.typedName, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  /** Accept, sign back or decline an offer. Signatures need a fresh check. */
  @Post('offers/:id') @HttpCode(200)
  decide(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SellerOfferDecision)) b: SellerOfferDecision, @Req() req: Request) {
    if (b.result !== 'rejected') assertFreshMfa(a.session);
    return this.selling.decideOffer(a.userId, id, b, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Post('tasks') @HttpCode(200)
  task(@Auth() a: AuthContext, @Body(new ZodPipe(SellTaskRequest)) b: SellTaskRequest) { return this.selling.sellerTask(a.userId, b); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
@Controller('pro/listings')
class ProListingsController {
  constructor(@Inject(SellingService) private readonly selling: SellingService) {}

  @Get()
  list(@Auth() a: AuthContext) { return this.selling.forAgent(a.userId); }

  @Post(':id/tasks') @HttpCode(200)
  task(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SellTaskRequest)) b: SellTaskRequest) { return this.selling.agentTask(a.userId, id, b); }

  @Post(':id/publish') @HttpCode(200)
  publish(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(PublishListingRequest)) b: PublishListingRequest) {
    return this.selling.publish(a.userId, id, b);
  }
}

@Module({ imports: [DealsModule, OffersModule], controllers: [SellingController, ProListingsController], providers: [SellingService] })
export class SellingModule {}
