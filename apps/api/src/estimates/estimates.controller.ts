import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { buyerEstimate } from '@klyr/core';
import { EstimateRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { AssumptionsService, engineOptions } from '../listings/assumptions.service.js';
import { ListingsService, toEstimateInput } from '../listings/listings.service.js';

/** VOW data: registered, signed-in users only. */
@UseGuards(AuthGuard)
@Controller('estimates')
export class EstimatesController {
  constructor(
    @Inject(ListingsService) private readonly listings: ListingsService,
    @Inject(AssumptionsService) private readonly assumptions: AssumptionsService,
  ) {}

  /**
   * Same engine the clients run offline; the server copy is the one recorded on the deal.
   * Starts from the buyer's own assumptions; anything in the body overrides them for this estimate only.
   */
  @Post()
  async create(@Auth() a: AuthContext, @Body(new ZodPipe(EstimateRequest)) body: EstimateRequest) {
    const { listingId, ...overrides } = body;
    const [listing, mine] = await Promise.all([this.listings.get(listingId), this.assumptions.get(a.userId)]);
    const defined = Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined));
    return { asOf: mine.asOf, estimate: buyerEstimate(toEstimateInput(listing), { ...engineOptions(mine), ...defined }) };
  }
}
