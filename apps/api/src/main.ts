import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.enableCors({ origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:8081').split(',') });
app.enableShutdownHooks();
await app.listen(Number(process.env.API_PORT ?? 4000));
console.log(`Klyr API on :${process.env.API_PORT ?? 4000}`);
