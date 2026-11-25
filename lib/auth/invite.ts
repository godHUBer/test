'use server';
import { createClient } from '@supabase/supabase-js';
import { requireRecentOwner } from './session';
import { validEmail } from './policy';
import { authConfig } from '@/lib/supabase/config';
import type { AuthState } from './actions';

/** Isolated privileged operation. Never use this client for routine inventory/admin queries. */
export async function inviteAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const session = await requireRecentOwner();
  const config = authConfig();
  if (!session || !config) return { error: 'An active owner must verify MFA within the last 10 minutes.' };
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  if (!validEmail(email)) return { error: 'Enter a valid staff email.' };
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return { error: 'Invitations are not configured. No invitation was sent.' };
  const privileged = createClient(config.url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const result = await privileged.auth.admin.inviteUserByEmail(email, { redirectTo: `${config.origin}/admin/confirm` });
  if (result.error) return { error: 'Invitation could not be sent. Check the account, sender configuration and provider limits.' };
  return { message: 'Invitation accepted by the authentication provider. Delivery is not guaranteed. The account remains pending until an owner explicitly assigns a role.' };
}
