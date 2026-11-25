'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/client';
import { canEnter, needsMfa, type StaffProfile, type StaffRole } from './policy';

export type StaffSession =
  | { state: 'loading' }
  | { state: 'unconfigured' }
  | { state: 'signed-out' }
  | { state: 'schema-pending' }
  | { state: 'blocked' }
  | { state: 'unavailable' }
  | { state: 'staff'; user: { id: string; email?: string }; client: SupabaseClient; profile: StaffProfile & { role: StaffRole }; mfaRequired: boolean };

interface SessionContextValue {
  session: StaffSession;
  client: SupabaseClient | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: { state: 'loading' },
  client: null,
  refresh: async () => {},
  signOut: async () => {},
});

/**
 * Client-side replacement for the server-only staffSession()/requireStaff().
 * Builds the browser Supabase client, reads the session from cookies, and
 * resolves the staff profile + MFA state exactly as the server session did.
 * All authorization is still enforced by the Supabase RPCs/RLS on each call.
 */
export function StaffSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StaffSession>({ state: 'loading' });
  const client = useMemo(() => browserClient(), []);

  const refresh = useCallback(async () => {
    if (!client) {
      setSession({ state: 'unconfigured' });
      return;
    }
    const { data: authData, error } = await client.auth.getUser();
    if (error || !authData?.user) {
      setSession({ state: 'signed-out' });
      return;
    }
    const user = authData.user;
    const version = await client.rpc('admin_security_version');
    if (version.error || version.data !== 2) {
      setSession({ state: 'schema-pending' });
      return;
    }
    const { data: profile, error: profileError } = await client
      .from('admin_profiles')
      .select('user_id, role, is_active, display_name')
      .eq('user_id', user.id)
      .maybeSingle<StaffProfile>();
    if (profileError) {
      setSession({ state: 'unavailable' });
      return;
    }
    if (!canEnter(profile)) {
      setSession({ state: 'blocked' });
      return;
    }
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) {
      setSession({ state: 'unavailable' });
      return;
    }
    const role = profile.role as StaffRole;
    const mfaRequired = needsMfa(role) && assurance.data?.currentLevel !== 'aal2';
    setSession({ state: 'staff', user: { id: user.id, email: user.email ?? undefined }, client, profile, mfaRequired });
  }, [client]);

  // Resolve the staff session client-side on mount/focus; initial data load.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refresh();
    // Refresh on focus so a returned tab re-checks MFA/access state.
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  /* eslint-enable react-hooks/set-state-in-effect */
  }, [refresh]);

  const signOut = useCallback(async () => {
    if (client) await client.auth.signOut({ scope: 'global' });
    setSession({ state: 'signed-out' });
  }, [client]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, client, refresh, signOut }),
    [session, client, refresh, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useStaffSession() {
  return useContext(SessionContext);
}

export function useSupabaseClient() {
  return useContext(SessionContext).client;
}
