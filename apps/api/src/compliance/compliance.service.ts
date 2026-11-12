import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { IdCheckRequest } from '@klyr/contracts';
import { DB, type Db } from '../db/db.module.js';
import { auditLog, idVerifications, users } from '../db/schema.js';
import { FILE_STORE, type FileStore } from '../storage/file-store.js';
import { ID_VERIFIER, type IdVerifier } from './id-verifier.js';

/** FINTRAC keeps client identification records for at least five years. */
const RETAIN_YEARS = 5;

@Injectable()
export class ComplianceService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(FILE_STORE) private readonly files: FileStore,
    @Inject(ID_VERIFIER) private readonly verifier: IdVerifier,
  ) {}

  async status(userId: string) {
    const [row] = await this.db.select().from(idVerifications).where(eq(idVerifications.userId, userId)).orderBy(desc(idVerifications.verifiedAt)).limit(1);
    return row ? { status: row.status, verifiedAt: row.verifiedAt.toISOString(), vendor: row.vendor } : { status: 'not_started' as const };
  }

  /**
   * Records the client information and the vendor's ID result. Acting for someone else, being a
   * politically exposed person, or buying through a company sends the file to the compliance officer.
   */
  async submit(userId: string, req: IdCheckRequest) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user?.legalName) throw new BadRequestException({ code: 'no_legal_name' });
    let result;
    try { result = await this.verifier.verify(req.vendorRef); } catch { throw new BadRequestException({ code: 'id_not_verified', message: 'We couldn’t confirm your ID. Try the photo step again.' }); }

    const verifiedAt = new Date();
    const retainUntil = new Date(verifiedAt); retainUntil.setFullYear(retainUntil.getFullYear() + RETAIN_YEARS);
    const needsReview = req.actingForThirdParty || req.politicallyExposed || req.buyingAs === 'company';
    const record = {
      kind: 'fintrac_client_identification', userId, legalName: user.legalName, verifiedAt: verifiedAt.toISOString(),
      method: result.method, vendor: this.verifier.vendor, vendorRef: req.vendorRef, evidence: result.evidence,
      occupation: req.occupation, sourceOfFunds: req.sourceOfFunds, actingForThirdParty: req.actingForThirdParty,
      politicallyExposed: req.politicallyExposed, buyingAs: req.buyingAs, retainUntil: retainUntil.toISOString().slice(0, 10),
    };
    const stored = await this.files.put('records', `fintrac/${userId}/${verifiedAt.getTime()}.json`, Buffer.from(JSON.stringify(record, null, 2)), { retainUntil });
    await this.db.insert(idVerifications).values({
      userId, method: result.method, vendor: this.verifier.vendor, vendorRef: req.vendorRef, occupation: req.occupation,
      sourceOfFunds: req.sourceOfFunds.join(','), actingForThirdParty: req.actingForThirdParty, politicallyExposed: req.politicallyExposed,
      buyingAs: req.buyingAs, status: needsReview ? 'needs_review' : 'verified',
      recordS3Key: stored.key, verifiedAt, retainUntil: record.retainUntil,
    });
    await this.db.insert(auditLog).values({ actorId: userId, action: 'id_check', entity: 'user', entityId: userId, data: { status: needsReview ? 'needs_review' : 'verified', sha256: stored.sha256 } });
    return this.status(userId);
  }
}
