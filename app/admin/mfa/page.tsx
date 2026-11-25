'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { useStaffSession, useSupabaseClient } from '@/lib/auth/client-session';

interface Factor { id: string; friendly_name?: string; status: string; factor_type: string }

export default function MfaPage() {
  const { session, signOut } = useStaffSession();
  const client = useSupabaseClient();
  const router = useRouter();
  const [factors, setFactors] = useState<{ totp: Factor[]; all: Factor[] } | null>(null);

  useEffect(() => {
    if (session.state === 'signed-out') router.replace('/admin/login');
  }, [session.state, router]);

  useEffect(() => {
    let active = true;
    if (!client || session.state !== 'staff') return;
    client.auth.mfa.listFactors().then((res) => { if (active && !res.error) setFactors(res.data); });
    return () => { active = false; };
  }, [client, session.state]);

  if (session.state === 'loading') return <AuthFrame title="Authenticator verification"><p>Checking your session…</p></AuthFrame>;
  if (session.state === 'signed-out') return <AuthFrame title="Authenticator verification"><p>Redirecting to sign in…</p></AuthFrame>;
  if (session.state !== 'staff') return <AuthFrame title="Security setup pending"><p>Configured authentication, the security migration and an active staff assignment are required.</p></AuthFrame>;

  return (
    <AuthFrame title="Authenticator verification">
      <p>Owners and managers must verify an authenticator. Access changes require verification within 10 minutes. Never share your setup code.</p>
      {!factors ? <p>Loading authenticators…</p> : (
        <>
          {factors.totp.filter((f) => f.status === 'verified').map((f) => <section key={f.id}><h2>{f.friendly_name || 'Authenticator'}</h2><AuthForm mode="verify" factorId={f.id} /></section>)}
          {factors.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified').map((f) => <section key={f.id}><p>Unfinished authenticator enrolment</p><AuthForm mode="discard-enrollment" factorId={f.id} /></section>)}
          {!factors.totp.some((f) => f.status === 'verified') && <AuthForm mode="enroll" />}
        </>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void signOut().then(() => router.push('/admin/login')); }}>
        <button className="btn btn--line" type="submit">Sign out</button>
      </form>
    </AuthFrame>
  );
}
