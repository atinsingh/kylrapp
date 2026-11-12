import { Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Put, Query, UseGuards } from '@nestjs/common';
import { ListingSearch } from '@klyr/contracts';
import { ZodPipe } from '../common/zod.pipe.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { ListingsService } from './listings.service.js';

/** VOW data: registered, signed-in users only. */
@UseGuards(AuthGuard)
@Controller('listings')
export class ListingsController {
  constructor(@Inject(ListingsService) private readonly listings: ListingsService) {}

  @Get()
  search(@Auth() a: AuthContext, @Query(new ZodPipe(ListingSearch)) q: ListingSearch) {
    return this.listings.search(a.userId, q);
  }

  @Get(':id')
  detail(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.detail(a.userId, id);
  }

  @Put(':id/save') @HttpCode(200)
  save(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.setSaved(a.userId, id, true);
  }

  @Delete(':id/save')
  unsave(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    return this.listings.setSaved(a.userId, id, false);
  }
}
