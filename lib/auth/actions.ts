'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { sessionClient } from '@/lib/supabase/server';
import { authConfig } from '@/lib/supabase/config';
import { staffSession, requireRecentOwner } from './session';
import { validEmail, validPassword, validUuid } from './policy';

export interface AuthState { error?: string; message?: string; qr?: string; factorId?: string }
const text = (form: FormData, field: string) => String(form.get(field) ?? '').trim();

export async function authAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const client = await sessionClient();
  const config = authConfig();
  if (!client || !config) return { error: 'Staff sign-in is not configured. No request was sent.' };
  const mode = text(form, 'mode');
  if (mode === 'login') {
    const email = text(form, 'email');
    const password = String(form.get('password') ?? '');
    if (!validEmail(email) || !password || password.length > 128) return { error: 'Enter a valid email and password.' };
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) return { error: 'Sign-in failed. Check your credentials or try again later.' };
    revalidatePath('/admin', 'layout');
    redirect('/admin');
  }
  if (mode === 'recover') {
    const email = text(form, 'email');
    if (!validEmail(email)) return { error: 'Enter a valid email address.' };
    const result = await client.auth.resetPasswordForEmail(email, { redirectTo: `${config.origin}/auth/callback` });
    // Same message for unknown accounts, upstream throttling and accepted requests.
    void result.error;
    return { message: 'If the account is eligible and the request can be processed, a reset link will arrive. Check your inbox or try again later.' };
  }
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: 'Your session expired. Sign in or request a new invitation/reset link.' };
  if (mode === 'password') {
    const password = String(form.get('password') ?? '');
    if (!validPassword(password) || password !== String(form.get('confirmPassword') ?? '')) {
      return { error: 'Use 12–128 characters and enter the same password twice.' };
    }
    const factors = await client.auth.mfa.listFactors();
    const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (factors.error || assurance.error) return { error: 'Could not verify your security settings. Try again.' };
    if (factors.data.totp.some(f => f.status === 'verified') && assurance.data.currentLevel !== 'aal2') {
      return { error: 'Verify your authenticator on the security page before changing your password.' };
    }
    const result = await client.auth.updateUser({ password });
    if (result.error) return { error: 'Password could not be updated. Verify MFA or request a fresh reset link.' };
    const signOut = await client.auth.signOut({ scope: 'global' });
    if (signOut.error) return { error: 'Password changed, but session revocation could not be confirmed. Sign out and contact the owner if needed.' };
    redirect('/admin/login?password=updated');
  }
  const session = await staffSession();
  if (session.state !== 'staff') return { error: 'An active staff assignment and the security migration are required.' };
  if (mode === 'enroll') {
    const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString()}` });
    if (result.error) return { error: 'Could not start enrolment. Remove an unfinished authenticator below or try again later.' };
    return { qr: result.data.totp.qr_code, factorId: result.data.id, message: 'Scan this code with your authenticator, then enter its six-digit code.' };
  }
  if (mode === 'discard-enrollment') {
    const id = text(form, 'factorId');
    const factors = await client.auth.mfa.listFactors();
    if (factors.error || !factors.data.all.some(f => f.factor_type === 'totp' && f.id === id && f.status === 'unverified')) return { error: 'Unfinished authenticator not found.' };
    const result = await client.auth.mfa.unenroll({ factorId: id });
    if (result.error) return { error: 'Could not remove unfinished enrolment.' };
    revalidatePath('/admin/mfa');
    return { message: 'Unfinished enrolment removed. You can start again.' };
  }
  if (mode === 'verify') {
    const factorId = text(form, 'factorId');
    const code = text(form, 'code');
    if (!validUuid(factorId)) return { error: 'Invalid authenticator. Reload the security page.' };
    if (!/^[0-9]{6}$/.test(code)) return { error: 'Enter the six-digit authenticator code.', factorId };
    const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) return { error: 'Verification failed or expired. Try a fresh code.', factorId };
    revalidatePath('/admin', 'layout');
    redirect('/admin');
  }
  return { error: 'Unsupported action.' };
}

export async function signOutAction() {
  const client = await sessionClient();
  if (client) await client.auth.signOut({ scope: 'local' });
  // Also clear this browser's SDK cookies if the provider is unreachable.
  const config = authConfig();
  if (config) {
    const store = await cookies();
    const prefix = `sb-${new URL(config.url).hostname.split('.')[0]}-auth-token`;
    for (const cookie of store.getAll()) {
      if (cookie.name === prefix || cookie.name.startsWith(prefix + '.') || cookie.name.startsWith(prefix + '-')) {
        store.set(cookie.name, '', { path: '/', maxAge: 0, secure: true, httpOnly: true, sameSite: 'lax' });
      }
    }
  }
  revalidatePath('/admin', 'layout');
  redirect('/admin/login');
}

export async function accessAction(_previous: AuthState, form: FormData): Promise<AuthState> {
  const session = await requireRecentOwner();
  if (!session) return { error: 'An active owner must verify MFA within the last 10 minutes.' };
  const target = text(form, 'targetUser');
  const role = text(form, 'role');
  if (!validUuid(target) || !['owner','manager','staff','pending'].includes(role)) return { error: 'Select a valid staff profile and role.' };
  const result = await session.client.rpc('set_staff_access', { target_user: target, new_role: role, active: form.get('active') === 'on' });
  if (result.error) return { error: 'Access change rejected. The last owner cannot be removed; refresh and verify MFA if needed.' };
  revalidatePath('/admin');
  return { message: 'Staff access updated. Permissions are rechecked on each request.' };
}
