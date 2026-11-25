'use client';

import { useActionState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/lib/auth/client-session';

/**
 * Binds a client-side action (client, prev, form) => state to useActionState,
 * supplying the session client from context. When no client is configured it
 * resolves to a generic error state instead of throwing.
 *
 * React 19 types useActionState state as Awaited<S>, so the reducer's prev and
 * the initial state are expressed against Awaited<S> while the action still
 * returns Promise<S>.
 */
export function useClientAction<S, F extends FormData = FormData>(
  fn: (client: SupabaseClient, prev: Awaited<S>, form: F) => Promise<S>,
  initial: Awaited<S>,
) {
  const client = useSupabaseClient();
  const action = (prev: Awaited<S>, form: F): Promise<S> => (client ? fn(client, prev, form) : Promise.resolve({ error: 'Not configured.' } as unknown as S));
  return useActionState<S, F>(action, initial);
}
