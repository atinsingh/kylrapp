import { Body, Controller, Delete, Get, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { BookShowingRequest, SignAgreementRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, StepUp, type AuthContext } from '../identity/auth.guard.js';
import { DealsService } from './deals.service.js';

@UseGuards(AuthGuard)
@Controller()
class DealsController {
  constructor(@Inject(DealsService) private readonly deals: DealsService) {}

  /** What's needed before a first visit: agreement, ID check, agent. */
  @Get('buying')
  buying(@Auth() a: AuthContext) {
    return this.deals.buying(a.userId);
  }

  @Get('agreements/300')
  terms(@Auth() a: AuthContext) {
    return this.deals.agreementTerms(a.userId);
  }

  /** Signing needs a fresh passkey, authenticator or (for email-only accounts) email check. */
  @Post('agreements/300/sign') @HttpCode(201) @StepUp()
  sign(@Auth() a: AuthContext, @Body(new ZodPipe(SignAgreementRequest)) body: SignAgreementRequest, @Req() req: Request) {
    return this.deals.signAgreement(a.userId, body.typedName, { ip: req.ip, userAgent: req.headers['user-agent'] });
  }

  @Get('documents')
  documents(@Auth() a: AuthContext) {
    return this.deals.documents(a.userId);
  }

  @Get('documents/:id')
  document(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.document(a.userId, id);
  }

  @Get('showings')
  showings(@Auth() a: AuthContext) {
    return this.deals.showings(a.userId);
  }

  @Post('showings') @HttpCode(201)
  book(@Auth() a: AuthContext, @Body(new ZodPipe(BookShowingRequest)) body: BookShowingRequest) {
    return this.deals.bookShowing(a.userId, body);
  }

  @Delete('showings/:id')
  cancel(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.deals.cancelShowing(a.userId, id);
  }
}

@Module({ controllers: [DealsController], providers: [DealsService] })
export class DealsModule {}
