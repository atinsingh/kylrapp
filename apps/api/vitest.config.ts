import { defineConfig } from 'vitest/config';

// End-to-end tests share one database and each applies migrations first, so files run one at a time.
export default defineConfig({ test: { fileParallelism: false } });
