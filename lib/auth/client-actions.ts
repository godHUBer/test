'use client';

// Client-side replacements for the server actions in ./actions.ts.
// Same validation and Supabase calls, but run in the browser against the
// session-bearing client. Authorization is enforced by the Supabase RPCs/RLS.

import type { SupabaseClient } from '@supabase/supabase-js';
import { validEmail, validPassword, validUuid, hasRecentTotp } from './policy';

export interface AuthState { error?: string; message?: string; qr?: string; factorId?: string; redirectTo?: string }

const text = (form: FormData, field: string) => String(form.get(field) ?? '').trim();

export async function authActionClient(
  client: SupabaseClient,
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  const mode = text(form, 'mode');
  if (mode === 'login') {
    const email = text(form, 'email');
    const password = String(form.get('password') ?? '');
    if (!validEmail(email) || !password || password.length > 128) return { error: 'Enter a valid email and password.' };
    const result = await client.auth.signInWithPassword({ email, password });
    if (result.error) return { error: 'Sign-in failed. Check your credentials or try again later.' };
    return { redirectTo: '/admin' };
  }
  if (mode === 'recover') {
    const email = text(form, 'email');
    if (!validEmail(email)) return { error: 'Enter a valid email address.' };
    const { siteBase } = await import('@/lib/deploy');
    const redirectTo = siteBase() ? `${siteBase()}/auth/callback` : undefined;
    const result = await client.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : {});
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
    if (factors.data?.totp.some((f: { status: string }) => f.status === 'verified') && assurance.data?.currentLevel !== 'aal2') {
      return { error: 'Verify your authenticator on the security page before changing your password.' };
    }
    const result = await client.auth.updateUser({ password });
    if (result.error) return { error: 'Password could not be updated. Verify MFA or request a fresh reset link.' };
    const signOut = await client.auth.signOut({ scope: 'global' });
    if (signOut.error) return { error: 'Password changed, but session revocation could not be confirmed. Sign out and contact the owner if needed.' };
    return { redirectTo: '/admin/login?password=updated' };
  }
  // Enrolment/verify require an active staff session (checked server-side by RPCs).
  if (mode === 'enroll') {
    const result = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Authenticator ${new Date().toISOString()}` });
    if (result.error) return { error: 'Could not start enrolment. Remove an unfinished authenticator below or try again later.' };
    return { qr: result.data?.totp?.qr_code, factorId: result.data?.id, message: 'Scan this code with your authenticator, then enter its six-digit code.' };
  }
  if (mode === 'discard-enrollment') {
    const id = text(form, 'factorId');
    const factors = await client.auth.mfa.listFactors();
    if (factors.error || !factors.data?.all.some((f: { factor_type: string; id: string; status: string }) => f.factor_type === 'totp' && f.id === id && f.status === 'unverified')) {
      return { error: 'Unfinished authenticator not found.' };
    }
    const result = await client.auth.mfa.unenroll({ factorId: id });
    if (result.error) return { error: 'Could not remove unfinished enrolment.' };
    return { message: 'Unfinished enrolment removed. You can start again.' };
  }
  if (mode === 'verify') {
    const factorId = text(form, 'factorId');
    const code = text(form, 'code');
    if (!validUuid(factorId)) return { error: 'Invalid authenticator. Reload the security page.' };
    if (!/^[0-9]{6}$/.test(code)) return { error: 'Enter the six-digit authenticator code.', factorId };
    const result = await client.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) return { error: 'Verification failed or expired. Try a fresh code.', factorId };
    return { redirectTo: '/admin' };
  }
  return { error: 'Unsupported action.' };
}

export async function accessActionClient(
  client: SupabaseClient,
  _previous: AuthState,
  form: FormData,
): Promise<AuthState> {
  // Mirror the server-side owner+recent-TOTP gate for a clear client message;
  // set_staff_access re-checks both authoritatively in the database.
  const { data: claimsData, error: claimsError } = await client.auth.getClaims();
  if (claimsError || !hasRecentTotp(claimsData?.claims?.amr)) {
    return { error: 'An active owner must verify MFA within the last 10 minutes.' };
  }
  const target = text(form, 'targetUser');
  const role = text(form, 'role');
  if (!validUuid(target) || !['owner', 'manager', 'staff', 'pending'].includes(role)) {
    return { error: 'Select a valid staff profile and role.' };
  }
  const result = await client.rpc('set_staff_access', { target_user: target, new_role: role, active: form.get('active') === 'on' });
  if (result.error) return { error: 'Access change rejected. The last owner cannot be removed; refresh and verify MFA if needed.' };
  return { message: 'Staff access updated. Permissions are rechecked on each request.' };
}
