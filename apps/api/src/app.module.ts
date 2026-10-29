import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module.js';
import { ComplianceModule } from './compliance/compliance.module.js';
import { DbModule } from './db/db.module.js';
import { DealsModule } from './deals/deals.module.js';
import { EstimatesModule } from './estimates/estimates.module.js';
import { HealthModule } from './health/health.module.js';
import { IdentityModule } from './identity/identity.module.js';
import { NotifyModule } from './notify/notify.module.js';
import { OffersModule } from './offers/offers.module.js';
import { RentingModule } from './renting/renting.module.js';
import { SellingModule } from './selling/selling.module.js';
import { ListingsModule } from './listings/listings.module.js';
import { ProModule } from './pro/pro.module.js';
import { StorageModule } from './storage/file-store.js';

/**
 * Modular monolith. Planned modules (docs/ARCHITECTURE.md §4):
 * money, marketplace, messaging, notifications, ai, audit.
 */
@Module({ imports: [DbModule, StorageModule, IdentityModule, NotifyModule, HealthModule, ListingsModule, EstimatesModule, DealsModule, ComplianceModule, ProModule, AdminModule, OffersModule, SellingModule, RentingModule] })
export class AppModule {}
