'use client';
import { useActionState } from 'react';
import { authAction } from '@/lib/auth/actions';

export function AuthForm({ mode, factorId }: { mode: 'login' | 'recover' | 'password' | 'verify' | 'enroll' | 'discard-enrollment'; factorId?: string }) {
  const [state, action, pending] = useActionState(authAction, {});
  const id = state.factorId || factorId;
  return <form className="form" action={action} style={{ maxWidth: 520 }}>
    <input type="hidden" name="mode" value={state.factorId && mode === 'enroll' ? 'verify' : mode} />
    {id && <input type="hidden" name="factorId" value={id} />}
    {['login','recover'].includes(mode) && <div className="field"><label htmlFor={`${mode}-email`}>Staff email</label>
      <input id={`${mode}-email`} name="email" type="email" autoComplete="username" required maxLength={254} /></div>}
    {['login','password'].includes(mode) && <div className="field"><label htmlFor={`${mode}-password`}>{mode === 'password' ? 'New password (12–128 characters)' : 'Password'}</label>
      <input id={`${mode}-password`} name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'password' ? 12 : 1} maxLength={128} /></div>}
    {mode === 'password' && <div className="field"><label htmlFor="confirm-password">Confirm new password</label>
      <input id="confirm-password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></div>}
    {state.qr && <div>
      {/* TOTP QR is sensitive: rendered only after authenticated enrolment; never persisted/logged. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.qr} alt="Scan this private authenticator setup code" width={240} height={240} />
      <p className="hint">Keep this code private. If you leave before verifying, remove the unfinished enrolment and start again.</p>
    </div>}
    {(mode === 'verify' || (mode === 'enroll' && !!state.factorId)) && <div className="field"><label htmlFor={`code-${id}`}>Six-digit authenticator code</label>
      <input id={`code-${id}`} name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required maxLength={6} /></div>}
    <div role="status" aria-live="polite">{state.error || state.message}</div>
    <button className="btn btn--solid" disabled={pending} type="submit">{pending ? 'Please wait…' : (state.factorId && mode === 'enroll') || mode === 'verify' ? 'Verify authenticator' : ({ login: 'Sign in', recover: 'Request reset link', password: 'Set password', enroll: 'Set up authenticator', 'discard-enrollment': 'Remove unfinished enrolment' }[mode])}</button>
  </form>;
}
