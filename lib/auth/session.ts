import 'server-only';
import { redirect } from 'next/navigation';
import { sessionClient } from '@/lib/supabase/server';
import { canEnter, hasRecentTotp, needsMfa, type StaffProfile } from './policy';

export async function staffSession() {
  const client = await sessionClient();
  if (!client) return { state: 'unconfigured' } as const;
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { state: 'signed-out', client } as const;
  const version = await client.rpc('admin_security_version');
  if (version.error || version.data !== 2) return { state: 'schema-pending', client } as const;
  const { data: profile, error: profileError } = await client.from('admin_profiles')
    .select('user_id, role, is_active, display_name').eq('user_id', user.id).maybeSingle<StaffProfile>();
  if (profileError) return { state: 'unavailable', client } as const;
  if (!canEnter(profile)) return { state: 'blocked', client } as const;
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error) return { state: 'unavailable', client } as const;
  const mfaRequired = needsMfa(profile.role) && assurance.data.currentLevel !== 'aal2';
  return { state: 'staff', user, client, profile, mfaRequired } as const;
}
export async function requireStaff() {
  const session = await staffSession();
  if (session.state === 'signed-out') redirect('/admin/login');
  if (session.state !== 'staff') return null;
  if (session.mfaRequired) redirect('/admin/mfa');
  return session;
}
export async function requireRecentOwner() {
  const session = await staffSession();
  if (session.state !== 'staff' || session.profile.role !== 'owner' || session.mfaRequired) return null;
  const { data, error } = await session.client.auth.getClaims();
  if (error || !hasRecentTotp(data?.claims.amr)) return null;
  return session;
}
