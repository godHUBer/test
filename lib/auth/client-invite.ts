'use client';

// Client-side replacement for the server inviteAction in ./invite.ts.
// The GoTrue invite call needs the service key, so it runs in a Supabase Edge
// Function (invite-staff) that verifies the owner JWT + recent TOTP server-side.

import type { SupabaseClient } from '@supabase/supabase-js';
import { validEmail } from './policy';
import type { AuthState } from './client-actions';
export type { AuthState };

export async function inviteActionClient(client: SupabaseClient, _previous: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!validEmail(email)) return { error: 'Enter a valid staff email.' };
  const { data, error } = await client.functions.invoke('invite-staff', { body: { email } });
  if (error) {
    const message = typeof error === 'string' ? error : (error.message ?? 'Invitation could not be sent.');
    return { error: message };
  }
  if (!data?.ok) {
    return { error: typeof data?.error === 'string' ? data.error : 'Invitation could not be sent. Check the account, sender configuration and provider limits.' };
  }
  return { message: 'Invitation accepted by the authentication provider. Delivery is not guaranteed. The account remains pending until an owner explicitly assigns a role.' };
}
