import { Body, ConflictException, Controller, Delete, Get, HttpCode, Inject, NotFoundException, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { SaveSearchRequest, UpdateSearchRequest, type SearchFilters } from '@klyr/contracts';
import type { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe.js';
import { DB, type Db } from '../db/db.module.js';
import { savedSearches } from '../db/schema.js';
import { Auth, AuthGuard, type AuthContext } from '../identity/auth.guard.js';
import { matches, snapshot } from './alerts.js';

const MAX = 10;

/** Saved searches with alerts for new listings and price drops. */
@UseGuards(AuthGuard)
@Controller('me/searches')
export class SearchesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async list(@Auth() a: AuthContext) {
    const rows = await this.db.select().from(savedSearches).where(eq(savedSearches.userId, a.userId)).orderBy(desc(savedSearches.createdAt));
    return Promise.all(rows.map(async r => ({
      id: r.id, name: r.name, filters: r.filters as SearchFilters, alert: r.alert, createdAt: r.createdAt.toISOString(),
      lastAlertedAt: r.lastAlertedAt?.toISOString() ?? null, matches: (await matches(this.db, r.filters as SearchFilters)).length,
    })));
  }

  @Post() @HttpCode(201)
  async save(@Auth() a: AuthContext, @Body(new ZodPipe(SaveSearchRequest)) b: SaveSearchRequest) {
    const [{ n }] = await this.db.select({ n: count() }).from(savedSearches).where(eq(savedSearches.userId, a.userId)) as [{ n: number }];
    if (n >= MAX) throw new ConflictException({ code: 'too_many', message: `You can save up to ${MAX} searches. Delete one first.` });
    const [row] = await this.db.insert(savedSearches).values({ userId: a.userId, name: b.name, filters: b.filters, alert: b.alert }).returning();
    const now = await snapshot(this.db, row!.id, b.filters);
    return { id: row!.id, name: row!.name, alert: row!.alert, matches: now };
  }

  @Patch(':id')
  async update(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(UpdateSearchRequest)) b: z.infer<typeof UpdateSearchRequest>) {
    const r = await this.db.update(savedSearches).set({ alert: b.alert }).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, a.userId))).returning();
    if (!r.length) throw new NotFoundException();
    return { id, alert: b.alert };
  }

  @Delete(':id')
  async remove(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.db.delete(savedSearches).where(and(eq(savedSearches.id, id), eq(savedSearches.userId, a.userId))).returning();
    if (!r.length) throw new NotFoundException();
    return { ok: true };
  }
}
