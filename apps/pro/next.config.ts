import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  transpilePackages: ['@klyr/web-kit'],
  // Its own cookie: on one host, cookies are shared across ports and apps.
  env: { SESSION_COOKIE: 'klyr_pro' },
};
export default config;
