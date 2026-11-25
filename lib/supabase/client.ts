import { createClient } from '@supabase/supabase-js';
import { browserAuthConfig } from './config';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The browser Supabase client used by the static, client-rendered app.
 * Session is persisted in cookies by the SDK; the anon/publishable key is the
 * only credential that reaches the browser. All authorization is enforced
 * server-side by the Supabase RPCs and RLS policies.
 *
 * Returns null when the app is not configured, so callers can render a
 * "not configured" state instead of throwing.
 */
export function browserClient(): SupabaseClient | null {
  const config = browserAuthConfig();
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
}
