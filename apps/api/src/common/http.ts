import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';

/**
 * HTTP hardening for the API, in the server and the tests alike:
 * - the real client address from the load balancer (one proxy hop), for limits and the audit log;
 * - no framework banner, and headers that stop sniffing, framing and caching of personal data.
 */
export function secure(app: INestApplication) {
  const http = app.getHttpAdapter().getInstance() as { set(k: string, v: unknown): void; disable(k: string): void };
  http.set('trust proxy', 1);
  http.disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', req.path.startsWith('/media/') ? 'cross-origin' : 'same-site');
    // JSON only: nothing here should ever render as a page.
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (!req.path.startsWith('/media/')) res.setHeader('Cache-Control', 'no-store');
    if (config.production) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    next();
  });
}
