import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { ListingsModule } from './listings/listings.module.js';

/**
 * Modular monolith. Planned modules (docs/ARCHITECTURE.md §4): deals,
 * documents, compliance, money, marketplace, messaging, notifications, ai, audit.
 */
@Module({ imports: [DbModule, IdentityModule, HealthModule, ListingsModule, EstimatesModule] })
export class AppModule {}
