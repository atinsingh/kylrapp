import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller.js';
import { AssumptionsController } from './assumptions.controller.js';
import { AssumptionsService } from './assumptions.service.js';
import { ListingsService } from './listings.service.js';

@Module({ controllers: [ListingsController, AssumptionsController], providers: [ListingsService, AssumptionsService], exports: [ListingsService, AssumptionsService] })
export class ListingsModule {}
