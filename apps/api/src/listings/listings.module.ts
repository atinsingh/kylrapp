import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';
import { AssumptionsController } from './assumptions.controller.js';
import { AssumptionsService } from './assumptions.service.js';
import { SearchesController } from './searches.js';
import { ListingsService } from './listings.service.js';

@Module({ controllers: [ListingsController, AssumptionsController, SearchesController], providers: [ListingsService, AssumptionsService], exports: [ListingsService, AssumptionsService] })
export class ListingsModule {}
