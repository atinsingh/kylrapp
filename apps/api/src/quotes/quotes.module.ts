import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ChooseQuoteRequest, EnterQuoteRequest, PartnerQuoteRequest, PartnerUserRequest, QUOTE_KINDS, type QuoteKind, QuoteRequestRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { QuotesService } from './quotes.service.js';

@UseGuards(AuthGuard)
@Controller()
class QuotesController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Get('providers')
  providers(@Query('kind') kind: string) {
    if (!QUOTE_KINDS.includes(kind as QuoteKind)) throw new BadRequestException({ code: 'bad_kind', message: 'Choose lender, lawyer, inspector or insurer.' });
    return this.quotes.providers(kind as QuoteKind);
  }

  @Get('quotes')
  mine(@Auth() a: AuthContext) { return this.quotes.mine(a.userId); }

  @Post('quotes/requests') @HttpCode(201)
  request(@Auth() a: AuthContext, @Body(new ZodPipe(QuoteRequestRequest)) b: QuoteRequestRequest) { return this.quotes.request(a.userId, b); }

  @Delete('quotes/requests/:id')
  cancel(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.quotes.cancel(a.userId, id); }

  @Post('quotes/:id/choose') @HttpCode(200)
  choose(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(ChooseQuoteRequest)) b: ChooseQuoteRequest) { return this.quotes.choose(a.userId, id, b.referralAcknowledged); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
@Controller('pro/quotes')
class ProQuotesController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Get()
  list(@Auth() a: AuthContext) { return this.quotes.forAgent(a.userId); }

  @Post('requests/:id') @HttpCode(200)
  enter(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(EnterQuoteRequest)) b: EnterQuoteRequest) { return this.quotes.enter(a.userId, id, b); }
}

/** The partner portal: lenders, lawyers, inspectors and insurers answer the requests that named their firm. */
@UseGuards(AuthGuard, RolesGuard)
@Roles('lender', 'lawyer', 'inspector', 'insurer')
@Controller('partner')
class PartnerController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Get('me')
  me(@Auth() a: AuthContext) { return this.quotes.partner(a.userId); }

  @Get('requests')
  requests(@Auth() a: AuthContext) { return this.quotes.partnerRequests(a.userId); }

  @Post('requests/:id/quote') @HttpCode(200)
  quote(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(PartnerQuoteRequest)) b: PartnerQuoteRequest) { return this.quotes.partnerQuote(a.userId, id, b); }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record', 'compliance_officer')
@Controller('admin/partners')
class PartnerAdminController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Get()
  list() { return this.quotes.partnerUsers(); }

  @Post() @HttpCode(200)
  change(@Auth() a: AuthContext, @Body(new ZodPipe(PartnerUserRequest)) b: PartnerUserRequest) { return this.quotes.partnerUser(a.userId, b); }
}

@Module({ controllers: [QuotesController, ProQuotesController, PartnerController, PartnerAdminController], providers: [QuotesService] })
export class QuotesModule {}
