import { Module } from '@nestjs/common';
import { ListingsModule } from '../listings/listings.module.js';
import { EstimatesController } from './estimates.controller.js';

@Module({ imports: [ListingsModule], controllers: [EstimatesController] })
export class EstimatesModule {}
