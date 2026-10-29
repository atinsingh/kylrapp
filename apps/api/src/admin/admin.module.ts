import { Body, Controller, ConflictException, Get, HttpCode, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { CommissionReceivedRequest, PayoutSentRequest, ReviewIdRequest } from '@klyr/contracts';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, cashBackPayouts, dealParties, deals, idVerifications, listings, offers, users } from '../db/schema.js';
import { NotifyService } from '../notify/notify.service.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';
import { FieldActivityService } from '../pro/activity.service.js';
import { ProModule } from '../pro/pro.module.js';

/** Compliance officer's queue: ID checks that need a person to decide (third party, PEP, company). */
@Injectable()
export class ComplianceReviewService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(MAILER) private readonly mail: Mailer) {}

  async queue() {
    const rows = await this.db.select({
      id: idVerifications.id, verifiedAt: idVerifications.verifiedAt, name: users.legalName, email: users.email,
      occupation: idVerifications.occupation, sourceOfFunds: idVerifications.sourceOfFunds, actingForThirdParty: idVerifications.actingForThirdParty,
      politicallyExposed: idVerifications.politicallyExposed, buyingAs: idVerifications.buyingAs, vendor: idVerifications.vendor, method: idVerifications.method,
    }).from(idVerifications).innerJoin(users, eq(users.id, idVerifications.userId))
      .where(eq(idVerifications.status, 'needs_review')).orderBy(asc(idVerifications.verifiedAt));
    return rows.map(r => ({ ...r, sourceOfFunds: r.sourceOfFunds?.split(',') ?? [] }));
  }

  async decide(reviewerId: string, id: string, req: ReviewIdRequest) {
    const [row] = await this.db.select({ userId: idVerifications.userId, status: idVerifications.status, email: users.email })
      .from(idVerifications).innerJoin(users, eq(users.id, idVerifications.userId)).where(eq(idVerifications.id, id));
    if (!row) throw new NotFoundException();
    if (row.userId === reviewerId) throw new ConflictException({ code: 'own_file', message: 'Someone else must review your own file.' });
    const status = req.decision === 'approve' ? 'verified' as const : 'rejected' as const;
    const done = await this.db.update(idVerifications).set({ status, reviewedBy: reviewerId, reviewedAt: new Date(), reviewNote: req.note })
      .where(and(eq(idVerifications.id, id), eq(idVerifications.status, 'needs_review'))).returning({ id: idVerifications.id });
    if (!done.length) throw new ConflictException({ code: 'already_reviewed', message: 'This file was already reviewed.' });
    await this.db.insert(auditLog).values({ actorId: reviewerId, action: `id_review_${req.decision}`, entity: 'id_verification', entityId: id, data: { note: req.note } });
    await this.mail.send({
      to: row.email,
      subject: status === 'verified' ? 'Your ID check is complete' : 'About your ID check',
      text: status === 'verified'
        ? 'Your ID check is complete. You can now book visits in Klyr.\n\nKlyr Realty Inc., Brokerage'
        : 'We couldn’t complete your ID check. Your agent will contact you about next steps.\n\nKlyr Realty Inc., Brokerage',
    });
    return { id, status };
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('compliance_officer', 'broker_of_record')
@Controller('admin/id-reviews')
class ComplianceReviewController {
  constructor(@Inject(ComplianceReviewService) private readonly reviews: ComplianceReviewService) {}

  @Get()
  queue() { return this.reviews.queue(); }

  @Post(':id') @HttpCode(200)
  decide(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(ReviewIdRequest)) body: ReviewIdRequest) {
    return this.reviews.decide(a.userId, id, body);
  }
}

/** Broker of record: every agent's field day, to supervise showings (RECO requires the broker to supervise). */
@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record')
@Controller('admin/field-activity')
class FieldActivityController {
  constructor(@Inject(FieldActivityService) private readonly activity: FieldActivityService) {}

  @Get()
  day(@Query('day') day?: string) { return this.activity.days(day); }
}

/**
 * Trust and payouts: after closing, the brokerage records the commission the listing brokerage paid, then the
 * cash-back EFT sent from its own bank. Klyr doesn't move money; it keeps the record and tells the buyer.
 */
@Injectable()
export class PayoutsService {
  constructor(@Inject(DB) private readonly db: Db, @Inject(MAILER) private readonly mail: Mailer, @Inject(NotifyService) private readonly notify: NotifyService) {}

  list() {
    return this.db.select({
      id: cashBackPayouts.id, dealId: cashBackPayouts.dealId, status: cashBackPayouts.status, amount: cashBackPayouts.amount, pct: cashBackPayouts.pct,
      commissionReceived: cashBackPayouts.commissionReceived, reference: cashBackPayouts.reference, createdAt: cashBackPayouts.createdAt, paidAt: cashBackPayouts.paidAt,
      closedAt: deals.closedAt, client: users.legalName, email: users.email,
      address: sql<string>`case when ${listings.unit} is null then ${listings.address} else ${listings.address} || ' #' || ${listings.unit} end`,
      price: offers.price, coop: listings.coop, listingBrokerage: listings.listingBrokerage,
    }).from(cashBackPayouts)
      .innerJoin(deals, eq(deals.id, cashBackPayouts.dealId))
      .innerJoin(dealParties, and(eq(dealParties.dealId, deals.id), eq(dealParties.role, 'client')))
      .innerJoin(users, eq(users.id, dealParties.userId))
      .innerJoin(offers, and(eq(offers.dealId, deals.id), eq(offers.status, 'accepted')))
      .innerJoin(listings, eq(listings.id, offers.listingId))
      .orderBy(desc(cashBackPayouts.createdAt));
  }

  /** The commission arrived: the cash back is the plan's share of what was actually received. */
  async commission(actorId: string, id: string, amount: number) {
    const [p] = await this.db.select().from(cashBackPayouts).where(eq(cashBackPayouts.id, id));
    if (!p) throw new NotFoundException();
    if (p.status !== 'pending_commission') throw new ConflictException({ code: 'not_pending', message: 'The commission was already recorded.' });
    const payout = Math.round((amount * p.pct) / 100);
    await this.db.update(cashBackPayouts).set({ commissionReceived: amount, amount: payout, status: 'ready' }).where(eq(cashBackPayouts.id, id));
    await this.db.insert(auditLog).values({ actorId, action: 'commission_received', entity: 'payout', entityId: id, data: { commission: amount, payout } });
    return { id, status: 'ready', amount: payout };
  }

  async sent(actorId: string, id: string, reference: string) {
    const [p] = await this.db.select().from(cashBackPayouts).where(eq(cashBackPayouts.id, id));
    if (!p) throw new NotFoundException();
    if (p.status !== 'ready') throw new ConflictException({ code: 'not_ready', message: 'Record the commission first.' });
    await this.db.update(cashBackPayouts).set({ status: 'sent', paidAt: new Date(), reference }).where(eq(cashBackPayouts.id, id));
    await this.db.insert(auditLog).values({ actorId, action: 'payout_sent', entity: 'payout', entityId: id, data: { amount: p.amount, reference } });
    const [c] = await this.db.select({ id: users.id, email: users.email }).from(dealParties).innerJoin(users, eq(users.id, dealParties.userId))
      .where(and(eq(dealParties.dealId, p.dealId), eq(dealParties.role, 'client')));
    if (c) {
      await this.mail.send({ to: c.email, subject: 'Your cash back is on its way', text: `We sent your cash back of $${p.amount.toLocaleString('en-CA')} by EFT (reference ${reference}). It usually arrives within 2 business days.\n\nKlyr Realty Inc., Brokerage` });
      await this.notify.toUser(c.id, 'consumer', { title: 'Your cash back is on its way', body: 'Sent by EFT', data: { screen: 'deal' } });
    }
    return { id, status: 'sent' };
  }
}

@UseGuards(AuthGuard, RolesGuard)
@Roles('broker_of_record')
@Controller('admin/payouts')
class PayoutsController {
  constructor(@Inject(PayoutsService) private readonly payouts: PayoutsService) {}

  @Get()
  list() { return this.payouts.list(); }

  @Post(':id/commission') @HttpCode(200)
  commission(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(CommissionReceivedRequest)) body: z.infer<typeof CommissionReceivedRequest>) {
    return this.payouts.commission(a.userId, id, body.amount);
  }

  @Post(':id/sent') @HttpCode(200)
  sent(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(PayoutSentRequest)) body: z.infer<typeof PayoutSentRequest>) {
    return this.payouts.sent(a.userId, id, body.reference);
  }
}

@Module({ imports: [ProModule], controllers: [ComplianceReviewController, FieldActivityController, PayoutsController], providers: [ComplianceReviewService, PayoutsService] })
export class AdminModule {}
