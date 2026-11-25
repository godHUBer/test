'use client';
import { useActionState } from 'react';
import { accessAction } from '@/lib/auth/actions';
export function AccessForm({ profiles }: { profiles: { user_id: string; display_name: string | null; role: string; is_active: boolean }[] }) {
  const [state, action, pending] = useActionState(accessAction, {});
  return <form action={action} className="form">
    <div className="field"><label htmlFor="target-user">Staff account</label><select name="targetUser" id="target-user" required>
      <option value="">Select an existing account</option>
      {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.display_name || p.user_id} — {p.role}{p.is_active ? '' : ' (inactive)'}</option>)}
    </select></div>
    <div className="field"><label htmlFor="target-role">New role</label><select id="target-role" name="role" required defaultValue="pending">
      <option value="pending">Pending (no access)</option><option value="staff">Staff</option><option value="manager">Manager</option><option value="owner">Owner</option>
    </select></div>
    <label><input type="checkbox" name="active" /> Active account — check explicitly to enable access</label>
    <p>Review the selected account carefully. Owner/manager roles require MFA. Legacy editors have no new privileges until explicitly reassigned.</p>
    <div role="status">{state.error || state.message}</div>
    <button type="submit" className="btn btn--solid" disabled={pending}>{pending ? 'Updating…' : 'Apply access change'}</button>
  </form>;
}
