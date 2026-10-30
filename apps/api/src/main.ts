import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { secure } from './common/http.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);
secure(app);
// Local sample photos. In AWS, listing photos are served by CloudFront from S3 (MEDIA_BASE_URL).
const media = fileURLToPath(new URL('../media', import.meta.url));
if (existsSync(media)) app.useStaticAssets(media, { prefix: '/media', maxAge: '1d' });
app.enableCors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8081').split(',') });
app.enableShutdownHooks();
await app.listen(Number(process.env.API_PORT ?? 4000));
console.log(`Klyr API on :${process.env.API_PORT ?? 4000}`);
