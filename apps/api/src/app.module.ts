import { Module } from '@nestjs/common';
import { DbModule } from './db/db.module.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { HealthModule } from './health/health.module.js';
import { ListingsModule } from './listings/listings.module.js';

/**
 * Modular monolith. Planned modules (docs/ARCHITECTURE.md §4): identity, deals,
 * documents, compliance, money, marketplace, messaging, notifications, ai, audit.
 */
@Module({ imports: [DbModule, HealthModule, ListingsModule, EstimatesModule] })
export class AppModule {}
