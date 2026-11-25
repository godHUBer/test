export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const origin = process.env.SITE_URL;
  if (!url || !key || !origin) return null;
  try {
    const parsed = new URL(url);
    const site = new URL(origin);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname!=='/' || parsed.search || parsed.hash || site.protocol !== 'https:' || site.pathname !== '/' || site.search || site.hash || site.username || site.password) return null;
    // No secret/service-role key may be used as the application's publishable key.
    if (key.startsWith('sb_secret_')) return null;
    if (key.startsWith('eyJ')) {
      const claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString());
      if (claims.role !== 'anon') return null;
    } else if (!key.startsWith('sb_publishable_')) return null;
    return { url: parsed.origin, key, origin: site.origin };
  } catch { return null; }
}

/**
 * Browser-safe config for the client-rendered app. Unlike authConfig() this
 * does not require SITE_URL (a server-only value): the browser only needs the
 * project origin and the anon/publishable key. Same key validation as authConfig.
 */
export function browserAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname!=='/' || parsed.search || parsed.hash) return null;
    if (key.startsWith('sb_secret_')) return null;
    if (key.startsWith('eyJ')) {
      const claims = JSON.parse(Buffer.from(key.split('.')[1] ?? '', 'base64url').toString());
      if (claims.role !== 'anon') return null;
    } else if (!key.startsWith('sb_publishable_')) return null;
    return { url: parsed.origin, key };
  } catch { return null; }
}
