import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Inject, Module, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ChooseQuoteRequest, EnterQuoteRequest, ImportQuotesRequest, PartnerKeyRequest, PartnerQuoteRequest, PartnerUserRequest, QUOTE_KINDS, type QuoteKind, QuoteRequestRequest } from '@klyr/contracts';
import { RateLimit } from '../common/rate-limit.js';
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

  @Post('import') @HttpCode(200) @RateLimit('import')
  import(@Auth() a: AuthContext, @Body(new ZodPipe(ImportQuotesRequest)) b: ImportQuotesRequest) { return this.quotes.partnerImport(a.userId, b.quotes as ({ requestId: string } & Record<string, unknown>)[]); }

  @Get('keys')
  keys(@Auth() a: AuthContext) { return this.quotes.keys(a.userId); }

  @Post('keys') @HttpCode(201)
  createKey(@Auth() a: AuthContext, @Body(new ZodPipe(PartnerKeyRequest)) b: PartnerKeyRequest) { return this.quotes.createKey(a.userId, b.name); }

  @Delete('keys/:id')
  revokeKey(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.quotes.revokeKey(a.userId, id); }

  @Post('requests/:id/quote') @HttpCode(200)
  quote(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(PartnerQuoteRequest)) b: PartnerQuoteRequest) { return this.quotes.partnerQuote(a.userId, id, b); }
}

/** For a provider's own system: authenticated with a partner API key, not a person's sign-in. */
@RateLimit('partnerApi')
@Controller('partner/api')
class PartnerApiController {
  constructor(@Inject(QuotesService) private readonly quotes: QuotesService) {}

  @Get('requests')
  async requests(@Headers('authorization') auth?: string) { return this.quotes.openForOrg((await this.quotes.byKey(auth)).orgId); }

  @Post('quotes') @HttpCode(200)
  async quotes_(@Headers('authorization') auth: string | undefined, @Body(new ZodPipe(ImportQuotesRequest)) b: ImportQuotesRequest) {
    const k = await this.quotes.byKey(auth);
    return this.quotes.importQuotes(k.orgId, k.actorId, b.quotes as ({ requestId: string } & Record<string, unknown>)[]);
  }
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

@Module({ controllers: [QuotesController, ProQuotesController, PartnerController, PartnerApiController, PartnerAdminController], providers: [QuotesService] })
export class QuotesModule {}
