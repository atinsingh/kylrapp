import type { NextConfig } from 'next';

/** Every page: no framing, no sniffing, no stray device permissions; HSTS in production. */
const security = (extra: { key: string; value: string }[] = []) => async () => [{
  source: '/:path*',
  headers: [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
    ...extra,
  ],
}];

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@klyr/web-kit'],
  // Its own cookie: on one host, cookies are shared across ports and apps.
  env: { SESSION_COOKIE: 'klyr_admin' },
  // Staff tools stay out of search engines.
  headers: security([{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]),
};
export default config;
