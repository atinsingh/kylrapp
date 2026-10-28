import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ListingSearch } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { ListingsService } from './listings.service.js';

@Controller('listings')
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly listings: ListingsService) {}

  @Get()
  search(@Query(new ZodPipe(ListingSearch)) q: ListingSearch) {
    return this.listings.search(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.listings.get(id);
  }
}
