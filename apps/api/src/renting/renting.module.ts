import { Body, Controller, Delete, Get, HttpCode, Inject, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { LeaseDecision, LeasePlanRequest, LeaseStartRequest, PublishListingRequest, RentalApplyRequest, SignOfferRequest, TenantProfileRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { DealsModule } from '../deals/deals.module.js';
import { assertFreshMfa, Auth, AuthGuard, StepUp, type AuthContext } from '../identity/auth.guard.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { RentingService } from './renting.service.js';

const client = (req: Request) => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

/** Tenants: Form 346, one profile, rentals, Form 326 when needed, then Form 410 + 400. */
@UseGuards(AuthGuard)
@Controller()
class RentingController {
  constructor(@Inject(RentingService) private readonly renting: RentingService) {}

  @Get('renting')
  view(@Auth() a: AuthContext) { return this.renting.tenant(a.userId); }

  @Post('renting/agreement/sign') @HttpCode(200) @StepUp()
  sign(@Auth() a: AuthContext, @Body(new ZodPipe(SignOfferRequest)) b: SignOfferRequest, @Req() req: Request) { return this.renting.signTenantAgreement(a.userId, b.typedName, client(req)); }

  @Put('renting/profile')
  profile(@Auth() a: AuthContext, @Body(new ZodPipe(TenantProfileRequest)) b: TenantProfileRequest) { return this.renting.saveProfile(a.userId, b); }

  @Delete('renting/applications/:id')
  withdraw(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.renting.withdraw(a.userId, id); }

  @Get('rentals')
  rentals(@Query('city') city?: string, @Query('maxRent') maxRent?: string) { return this.renting.rentals({ city: city || undefined, maxRent: Number(maxRent) || undefined }); }

  @Get('rentals/:id')
  rental(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.renting.rental(a.userId, id); }

  @Post('rentals/:id/consent') @HttpCode(200) @StepUp()
  consent(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SignOfferRequest)) b: SignOfferRequest, @Req() req: Request) {
    return this.renting.consent(a.userId, id, b.typedName, client(req));
  }

  @Post('rentals/:id/apply') @HttpCode(200) @StepUp()
  apply(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(RentalApplyRequest)) b: RentalApplyRequest, @Req() req: Request) {
    return this.renting.apply(a.userId, id, b, client(req));
  }
}

/** Landlords: first-year rent after fees, Form 210, consents and applicants. */
@UseGuards(AuthGuard)
@Controller('leasing')
class LeasingController {
  constructor(@Inject(RentingService) private readonly renting: RentingService) {}

  @Get()
  async view(@Auth() a: AuthContext) {
    const v = await this.renting.landlord(a.userId);
    if (!v) throw new NotFoundException({ code: 'not_leasing', message: 'Start by telling us about your rental.' });
    return v;
  }

  @Post() @HttpCode(201)
  start(@Auth() a: AuthContext, @Body(new ZodPipe(LeaseStartRequest)) b: LeaseStartRequest) { return this.renting.startLease(a.userId, b); }

  @Put('plan')
  plan(@Auth() a: AuthContext, @Body(new ZodPipe(LeasePlanRequest)) b: LeasePlanRequest) { return this.renting.leasePlan(a.userId, b); }

  @Post('agreement/sign') @HttpCode(200) @StepUp()
  sign(@Auth() a: AuthContext, @Body(new ZodPipe(SignOfferRequest)) b: SignOfferRequest, @Req() req: Request) { return this.renting.signLeaseAgreement(a.userId, b.typedName, client(req)); }

  @Post('consents/:id/sign') @HttpCode(200) @StepUp()
  consent(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SignOfferRequest)) b: SignOfferRequest, @Req() req: Request) {
    return this.renting.signLandlordConsent(a.userId, id, b.typedName, client(req));
  }

  @Post('applications/:id') @HttpCode(200)
  decide(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(LeaseDecision)) b: LeaseDecision, @Req() req: Request) {
    if (b.result === 'accepted') assertFreshMfa(a.session);
    return this.renting.decide(a.userId, id, b, client(req));
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
@Controller('pro/rentals')
class ProRentalsController {
  constructor(@Inject(RentingService) private readonly renting: RentingService) {}

  @Get()
  list(@Auth() a: AuthContext) { return this.renting.forAgent(a.userId); }

  @Post(':id/publish') @HttpCode(200)
  publish(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(PublishListingRequest)) b: PublishListingRequest) { return this.renting.publish(a.userId, id, b); }
}

@Module({ imports: [DealsModule], controllers: [RentingController, LeasingController, ProRentalsController], providers: [RentingService] })
export class RentingModule {}
