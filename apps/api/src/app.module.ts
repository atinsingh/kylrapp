import { Module } from '@nestjs/common';
import { ComplianceModule } from './compliance/compliance.module.js';
import { DbModule } from './db/db.module.js';
import { DealsModule } from './deals/deals.module.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { StorageModule } from './storage/file-store.js';

/**
 * Modular monolith. Planned modules (docs/ARCHITECTURE.md §4):
 * money, marketplace, messaging, notifications, ai, audit.
 */
@Module({ imports: [DbModule, StorageModule, IdentityModule, HealthModule, ListingsModule, EstimatesModule, DealsModule, ComplianceModule] })
export class AppModule {}
