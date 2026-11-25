import type { NextConfig } from 'next';
import { legacyRedirects } from './lib/routes';

// GitHub Pages project site: the app is served under /<repo>/ (e.g. /test/).
// Override with NEXT_PUBLIC_BASE_PATH in CI; leave empty for a domain root.
// Accept "test" or "/test"; next.config basePath requires a leading slash.
const configuredBasePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+/, '');
const basePath = configuredBasePath ? '/' + configuredBasePath : '';

const config: NextConfig = {
  // Static export: the app is a client-rendered SPA with prerendered public
  // pages, deployed to GitHub Pages. No Node runtime runs at request time.
  output: 'export',
  basePath,
  trailingSlash: true,
  // No Next image optimizer (it needs a Node server); use plain <img>.
  images: { unoptimized: true },
  allowedDevOrigins: ['*.e2b.app'],
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '7mb' } },
  async headers() {
    return [{ source: '/:path*', headers: [
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
      {key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'"},
    ] }];
  },
  // Emitted into the static _redirects file. GitHub Pages does not read it, so
  // legacy .html URLs are also handled by the client-side 404 fallback.
  async redirects() { return legacyRedirects; },
};
export default config;
