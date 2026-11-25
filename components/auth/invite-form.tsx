'use client';
import { useActionState } from 'react';
import { inviteAction } from '@/lib/auth/invite';
export function InviteForm() {
  const [state, action, pending] = useActionState(inviteAction, {});
  return <form className="form" action={action}>
    <div className="field"><label htmlFor="invite-email">Staff email to invite</label>
      <input name="email" id="invite-email" type="email" autoComplete="off" maxLength={254} required /></div>
    <p>Requires recent owner MFA. Invitations create pending accounts only, with no staff privileges. Assign a role separately after confirming the account.</p>
    <div role="status">{state.error || state.message}</div>
    <button className="btn btn--solid" type="submit" disabled={pending}>{pending ? 'Requesting…' : 'Send staff invitation'}</button>
  </form>;
}
