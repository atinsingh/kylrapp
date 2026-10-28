import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type pg from 'pg';
import { createDb, type Db } from './client.js';

export const DB = Symbol('DB');
const POOL = Symbol('POOL');

@Global()
@Module({
  providers: [
    { provide: 'DB_HANDLE', useFactory: () => createDb() },
    { provide: DB, useFactory: (h: ReturnType<typeof createDb>) => h.db, inject: ['DB_HANDLE'] },
    { provide: POOL, useFactory: (h: ReturnType<typeof createDb>) => h.pool, inject: ['DB_HANDLE'] },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}
  async onApplicationShutdown() { await this.pool.end(); }
}

export type { Db };
