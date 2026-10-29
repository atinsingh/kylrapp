import { Body, Controller, ConflictException, Get, HttpCode, Inject, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { ReviewIdRequest } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, idVerifications, users } from '../db/schema.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { MAILER, type Mailer } from '../identity/mailer.js';
import { Roles, RolesGuard } from '../identity/roles.guard.js';

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

@Module({ controllers: [ComplianceReviewController], providers: [ComplianceReviewService] })
export class AdminModule {}
