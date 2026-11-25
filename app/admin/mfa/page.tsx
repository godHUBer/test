import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { staffSession } from '@/lib/auth/session';
import { signOutAction } from '@/lib/auth/actions';
export default async function MfaPage() {
  const session = await staffSession();
  if (session.state === 'signed-out') redirect('/admin/login');
  if (session.state !== 'staff') return <AuthFrame title="Security setup pending"><p>Configured authentication, the security migration and an active staff assignment are required.</p></AuthFrame>;
  const factors = await session.client.auth.mfa.listFactors();
  return <AuthFrame title="Authenticator verification">
    <p>Owners and managers must verify an authenticator. Access changes require verification within 10 minutes. Never share your setup code.</p>
    {factors.error ? <p>Could not load authenticators. Try again later.</p> : <>
      {factors.data.totp.filter(f => f.status === 'verified').map(f => <section key={f.id}><h2>{f.friendly_name || 'Authenticator'}</h2><AuthForm mode="verify" factorId={f.id} /></section>)}
      {factors.data.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified').map(f => <section key={f.id}><p>Unfinished authenticator enrolment</p><AuthForm mode="discard-enrollment" factorId={f.id} /></section>)}
      {!factors.data.totp.some(f => f.status === 'verified') && <AuthForm mode="enroll" />}
    </>}
    <form action={signOutAction}><button className="btn btn--line" type="submit">Sign out</button></form>
  </AuthFrame>;
}
