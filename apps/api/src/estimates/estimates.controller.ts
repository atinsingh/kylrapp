import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { buyerEstimate, DEFAULT_ASSUMPTIONS } from '@klyr/core';
import { EstimateRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { AuthGuard } from '../identity/auth.guard.js';
import { ListingsService, toEstimateInput } from '../listings/listings.service.js';

/** VOW data: registered, signed-in users only. */
@UseGuards(AuthGuard)
@Controller('estimates')
export class EstimatesController {
  constructor(@Inject(ListingsService) private readonly listings: ListingsService) {}

  /** Same engine the clients run offline; the server copy is the one recorded on the deal. */
  @Post()
  async create(@Body(new ZodPipe(EstimateRequest)) body: EstimateRequest) {
    const { listingId, ...assumptions } = body;
    const listing = await this.listings.get(listingId);
    return { asOf: DEFAULT_ASSUMPTIONS.asOf, estimate: buyerEstimate(toEstimateInput(listing), assumptions) };
  }
}
