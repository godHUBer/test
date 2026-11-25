import type { NextConfig } from 'next';
import { legacyRedirects } from './lib/routes';

const config: NextConfig = {
  allowedDevOrigins: ['*.e2b.app'],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '7mb' } },
  async headers() {
    // Baseline directives do not block Arena's embedded preview or Next's hydration.
    // A deployment-specific nonce/script policy and framing allowlist remain an explicit launch gate.
    return [{ source: '/:path*', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
      {key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'"},
    ] }];
  },
  async redirects() { return legacyRedirects; },
};
export default config;
