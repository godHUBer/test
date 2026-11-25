/** Validate a bare HTTPS origin (protocol https, no credentials, no path/query). */
export function absoluteOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null; } catch { return null; }
}

/**
 * GitHub Pages project sites serve the app under /<repo>/ (e.g. /test/).
 * NEXT_PUBLIC_BASE_PATH carries that prefix; it is empty for a domain root.
 * All browser-facing and SEO URLs must include this prefix.
 */
// Accept "test" or "/test"; normalise to a single leading slash so origin +
// basePath joins cleanly (https://host/test) and href/asset prefixes are correct.
export const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+/, '') ? '/' + (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/^\/+/, '') : '';

/** Origin + basePath, e.g. https://godhuber.github.io/test (no trailing slash). */
export function siteBase(): string | null {
  const origin = absoluteOrigin(process.env.SITE_URL);
  if (!origin) return null;
  return origin + (basePath ? basePath : '');
}

/** A browser-facing URL for a site route, e.g. siteUrl('/inventory'). */
export function siteUrl(route: string): string | null {
  const base = siteBase();
  if (!base) return null;
  return base + (route.startsWith('/') ? route : '/' + route);
}

/**
 * A path for use in an <a href> / <Link href> on the deployed site. Includes
 * the basePath prefix so internal links resolve under a GitHub Pages project
 * path (e.g. /test/inventory). External and protocol-relative URLs pass through.
 */
export function href(path: string): string {
  if (!path || path.startsWith('http') || path.startsWith('//') || path.startsWith('mailto:') || path.startsWith('tel:') || path.startsWith('#')) return path;
  return basePath + (path.startsWith('/') ? path : '/' + path);
}

/** A static-asset path under the basePath, e.g. asset('/assets/img/logo.png'). */
export function asset(path: string): string {
  if (!path || path.startsWith('http') || path.startsWith('//') || path.startsWith('data:')) return path;
  return basePath + (path.startsWith('/') ? path : '/' + path);
}
