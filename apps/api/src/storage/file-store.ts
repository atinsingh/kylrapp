import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Global, Module } from '@nestjs/common';
import { config } from '../config.js';

/**
 * Two buckets, as in AWS: `docs` (signed agreements, versioned) and `records` (FINTRAC records,
 * S3 Object Lock in compliance mode, 5 years). Locally both are folders under .data/.
 */
export type Bucket = 'docs' | 'records';
export interface Stored { key: string; sha256: string }
export interface FileStore {
  put(bucket: Bucket, key: string, body: Buffer, opts?: { retainUntil?: Date }): Promise<Stored>;
  get(bucket: Bucket, key: string): Promise<Buffer>;
}
export const FILE_STORE = Symbol('FILE_STORE');

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

/** Development only: no retention lock, so it is refused in production. */
export class LocalFileStore implements FileStore {
  constructor(private readonly root: string) {}
  private path(bucket: Bucket, key: string) {
    const p = normalize(join(this.root, bucket, key));
    if (!p.startsWith(join(this.root, bucket))) throw new Error('invalid key');
    return p;
  }
  async put(bucket: Bucket, key: string, body: Buffer): Promise<Stored> {
    const p = this.path(bucket, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body, { flag: 'wx' }); // never overwrite, like Object Lock
    return { key, sha256: sha256(body) };
  }
  get(bucket: Bucket, key: string) {
    return readFile(this.path(bucket, key));
  }
}

export function createFileStore(): FileStore {
  if (config.production) throw new Error('Set up the S3 file store (docs and Object Lock records buckets) before running in production');
  return new LocalFileStore(process.env.STORAGE_DIR ?? fileURLToPath(new URL('../../.data', import.meta.url)));
}

@Global()
@Module({ providers: [{ provide: FILE_STORE, useFactory: createFileStore }], exports: [FILE_STORE] })
export class StorageModule {}
