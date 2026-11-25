'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AccessForm } from '@/components/auth/access-form';
import { InviteForm } from '@/components/auth/invite-form';
import { InventoryOverview, BusinessOverview } from '@/components/admin/overview';
import { useStaffSession, useSupabaseClient } from '@/lib/auth/client-session';

interface Profile { user_id: string; display_name: string | null; role: string; is_active: boolean }

export default function AdminPage() {
  return (
    <StaffGate
      title="Staff workspace"
      blocked={(session) => {
        if (session.state === 'unconfigured') return <p>Authentication code is ready for configuration, but database activation and environment configuration are pending. No credentials or business data are accepted in this preview.</p>;
        if (session.state === 'schema-pending') return <p>The required security migration is not active. Access is blocked until an administrator completes activation.</p>;
        if (session.state === 'blocked') return <p>This account has no active staff assignment. Contact the dealership owner.</p>;
        return <p>Could not verify staff access. Try again later.</p>;
      }}
    >
      {(session) => <AdminContent profile={session.profile!} />}
    </StaffGate>
  );
}

function AdminContent({ profile }: { profile: { role: string; display_name: string | null } }) {
  const { signOut } = useStaffSession();
  const client = useSupabaseClient();
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [profilesError, setProfilesError] = useState(false);

  useEffect(() => {
    if (profile.role !== 'owner' || !client) return;
    let active = true;
    client.from('admin_profiles').select('user_id,display_name,role,is_active').order('created_at').then((res) => {
      if (!active) return;
      if (res.error) setProfilesError(true); else setProfiles(res.data as Profile[]);
    });
    return () => { active = false; };
  }, [client, profile.role]);

  return (
    <AuthFrame title="Staff workspace">
      <p>Signed in as {profile.display_name || 'dealership staff'} · {profile.role}. Your current permissions are checked against the database on every protected request.</p>
      <p>Inventory tools and stock counts require the separate workflow migration. Business totals require the separate business workflow migration and follow your assigned-record permissions.</p>
      <InventoryOverview />
      <BusinessOverview />
      <Link className="btn btn--solid" href="/admin/inventory">Manage inventory & stock counts</Link>
      <Link href="/admin/logs">Stock / audit history</Link>
      <Link href="/admin/mfa">Verify authenticator / security</Link>
      <Link href="/admin/password">Change password</Link>
      {profile.role === 'owner' && (
        <section>
          <h2>Staff access</h2>
          {profilesError ? <p>Could not load staff profiles.</p> : profiles ? <AccessForm profiles={profiles} /> : <p>Loading staff profiles…</p>}
        </section>
      )}
      {profile.role === 'owner' && <section><h2>Invite staff</h2><InviteForm /></section>}
      <form onSubmit={(e) => { e.preventDefault(); void signOut().then(() => router.push('/admin/login')); }}>
        <button className="btn btn--line" type="submit">Sign out</button>
      </form>
    </AuthFrame>
  );
}
