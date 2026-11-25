import Link from 'next/link';
import {BusinessOverview} from '@/components/business/overview';
import {InventoryOverview} from '@/components/admin/overview';
import { redirect } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AccessForm } from '@/components/auth/access-form';
import { InviteForm } from '@/components/auth/invite-form';
import { staffSession } from '@/lib/auth/session';
import { signOutAction } from '@/lib/auth/actions';

export default async function AdminPage() {
  const session = await staffSession();
  if (session.state === 'signed-out') redirect('/admin/login');
  if (session.state !== 'staff') return <AuthFrame title={session.state === 'unconfigured' ? 'Admin setup pending' : 'Staff access unavailable'}>
    <p>{session.state === 'unconfigured' ? 'Authentication code is ready for configuration, but database activation and environment configuration are pending. No credentials or business data are accepted in this preview.' : session.state === 'schema-pending' ? 'The required security migration is not active. Access is blocked until an administrator completes activation.' : session.state === 'blocked' ? 'This account has no active staff assignment. Contact the dealership owner.' : 'Could not verify staff access. Try again later.'}</p>
    {session.state !== 'unconfigured' && <form action={signOutAction}><button className="btn btn--line" type="submit">Sign out</button></form>}
  </AuthFrame>;
  if (session.mfaRequired) redirect('/admin/mfa');
  const profiles = session.profile.role === 'owner' ? await session.client.from('admin_profiles').select('user_id,display_name,role,is_active').order('created_at') : null;
  return <AuthFrame title="Staff workspace">
    <p>Signed in as {session.profile.display_name || 'dealership staff'} · {session.profile.role}. Your current permissions are checked against the database on every protected request.</p>
    <p>Inventory tools and stock counts require the separate workflow migration. Business totals require the separate business workflow migration and follow your assigned-record permissions.</p>
    <InventoryOverview client={session.client}/><BusinessOverview client={session.client}/>
    <Link className="btn btn--solid" href="/admin/inventory">Manage inventory & stock counts</Link><Link href="/admin/logs">Stock / audit history</Link>
    <Link href="/admin/mfa">Verify authenticator / security</Link><Link href="/admin/password">Change password</Link>
    {profiles && <section><h2>Staff access</h2>{profiles.error ? <p>Could not load staff profiles.</p> : <AccessForm profiles={profiles.data} />}</section>}
    {session.profile.role === 'owner' && <section><h2>Invite staff</h2><InviteForm /></section>}
    <form action={signOutAction}><button className="btn btn--line" type="submit">Sign out</button></form>
  </AuthFrame>;
}
