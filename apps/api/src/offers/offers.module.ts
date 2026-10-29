import { Body, Controller, Delete, Get, HttpCode, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AmendmentRequest, AmendmentResultRequest, ConditionNoticeRequest, OfferResultRequest, OfferTerms, ReviewOfferRequest, SignBackResponse, SignOfferRequest, TrustVerifiedRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { DealsModule } from '../deals/deals.module.js';
import { assertFreshMfa, Auth, AuthGuard, StepUp, type AuthContext } from '../identity/auth.guard.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { ListingsModule } from '../listings/listings.module.js';
import { OffersService } from './offers.service.js';
import { DealProgressService } from './progress.service.js';

const client = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

/** The buyer's offers. Signing and accepting a sign-back need a fresh check. */
@UseGuards(AuthGuard)
@Controller()
class OffersController {
  constructor(@Inject(OffersService) private readonly offers: OffersService, @Inject(DealProgressService) private readonly progress: DealProgressService) {}

  @Get('offers')
  list(@Auth() a: AuthContext) { return this.offers.list(a.userId); }

  /** The builder: this home's draft, or sensible defaults. */
  @Get('offers/start')
  start(@Auth() a: AuthContext, @Query('listingId', ParseUUIDPipe) listingId: string) { return this.offers.start(a.userId, listingId); }

  @Get('offers/:id')
  get(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.offers.get(a.userId, id); }

  @Put('offers/draft')
  save(@Auth() a: AuthContext, @Body(new ZodPipe(OfferTerms)) body: OfferTerms) { return this.offers.saveDraft(a.userId, body); }

  @Post('offers/:id/sign') @HttpCode(200) @StepUp()
  sign(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SignOfferRequest)) body: SignOfferRequest, @Req() req: Request) {
    return this.offers.sign(a.userId, id, body.typedName, client(req));
  }

  @Delete('offers/:id')
  withdraw(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.offers.withdraw(a.userId, id); }

  /** Accept or decline a sign-back. Accepting is a signature, so it needs a fresh check too. */
  @Post('offers/:id/respond') @HttpCode(200)
  respond(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SignBackResponse)) body: SignBackResponse, @Req() req: Request) {
    if (body.decision === 'accept') assertFreshMfa(a.session);
    return this.offers.respond(a.userId, id, body, client(req));
  }

  @Get('deal')
  async deal(@Auth() a: AuthContext) {
    const d = await this.progress.forBuyer(a.userId);
    if (!d) throw new NotFoundException({ code: 'no_deal', message: 'No accepted offer yet.' });
    return d;
  }

  /** Waive a condition or confirm it's fulfilled (Form 123). */
  @Post('deal/conditions/:id') @HttpCode(200) @StepUp()
  notice(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(ConditionNoticeRequest)) body: ConditionNoticeRequest, @Req() req: Request) {
    return this.progress.notice(a.userId, id, body.action, body.typedName, client(req));
  }

  /** Amendment (Form 120): move closing and/or extend conditions. */
  @Post('deal/amendments') @HttpCode(200) @StepUp()
  amend(@Auth() a: AuthContext, @Body(new ZodPipe(AmendmentRequest)) body: AmendmentRequest, @Req() req: Request) {
    return this.progress.proposeAmendment(a.userId, body, client(req));
  }

  @Delete('deal/amendments/:id')
  withdrawAmendment(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.progress.withdrawAmendment(a.userId, id); }

  /** Mutual release (Form 122) after the agreement went void. */
  @Post('deal/release') @HttpCode(200) @StepUp()
  release(@Auth() a: AuthContext, @Body(new ZodPipe(SignOfferRequest)) body: SignOfferRequest, @Req() req: Request) {
    return this.progress.release(a.userId, body.typedName, client(req));
  }
}

/** The agent's side: review, register, record the seller's answer, confirm the deposit. */
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
@Controller('pro')
class ProOffersController {
  constructor(@Inject(OffersService) private readonly offers: OffersService, @Inject(DealProgressService) private readonly progress: DealProgressService) {}

  @Get('offers')
  list(@Auth() a: AuthContext) { return this.offers.forAgent(a.userId); }

  @Post('offers/:id/review') @HttpCode(200)
  review(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(ReviewOfferRequest)) body: ReviewOfferRequest) {
    return this.offers.review(a.userId, id, body);
  }

  @Post('offers/:id/result') @HttpCode(200)
  result(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(OfferResultRequest)) body: OfferResultRequest) {
    return this.offers.result(a.userId, id, body);
  }

  @Post('deals/:id/deposit-received') @HttpCode(200)
  deposit(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.offers.depositReceived(a.userId, id); }

  @Get('deals')
  deals(@Auth() a: AuthContext) { return this.progress.forAgent(a.userId); }

  /** The signed Form 123 reached the listing brokerage. */
  @Post('conditions/:id/delivered') @HttpCode(200)
  delivered(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.progress.deliver(a.userId, id); }

  @Post('deals/:id/trust-verified') @HttpCode(200)
  trust(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(TrustVerifiedRequest)) body: TrustVerifiedRequest) {
    return this.progress.trustVerified(a.userId, id, body.note);
  }

  @Post('amendments/:id/result') @HttpCode(200)
  amendmentResult(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(AmendmentResultRequest)) body: AmendmentResultRequest) {
    return this.progress.amendmentResult(a.userId, id, body.result, body.note);
  }

  @Post('deals/:id/deposit-returned') @HttpCode(200)
  returned(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.progress.depositReturned(a.userId, id); }
}

@Module({ imports: [DealsModule, ListingsModule], controllers: [OffersController, ProOffersController], providers: [OffersService, DealProgressService] })
export class OffersModule {}
