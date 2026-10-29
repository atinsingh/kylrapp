import type { NextConfig } from 'next';

const config: NextConfig = { output: 'standalone', poweredByHeader: false, transpilePackages: ['@klyr/web-kit'] };
export default config;
