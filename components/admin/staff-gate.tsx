'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useStaffSession, type StaffSession } from '@/lib/auth/client-session';
import { AdminFrame } from './frame';

/**
 * Handles the staff session lifecycle for admin pages: waits for the client
 * session to resolve, redirects signed-out users to login and MFA-pending
 * owners/managers to the MFA step, and renders a blocked state otherwise.
 * Children receive the resolved staff session (which carries the client).
 */
export function StaffGate({
  title,
  children,
  blocked,
}: {
  title: string;
  children: (session: Extract<StaffSession, { state: 'staff' }>) => ReactNode;
  blocked?: (state: Exclude<StaffSession, { state: 'staff' | 'loading' }>) => ReactNode;
}) {
  const { session } = useStaffSession();
  const router = useRouter();

  useEffect(() => {
    if (session.state === 'signed-out') router.replace('/admin/login');
    else if (session.state === 'staff' && session.mfaRequired) router.replace('/admin/mfa');
  }, [session, router]);

  if (session.state === 'loading') {
    return <AdminFrame title={title}><p>Checking your staff session…</p></AdminFrame>;
  }
  if (session.state === 'staff' && session.mfaRequired) {
    return <AdminFrame title={title}><p>Redirecting to authenticator verification…</p></AdminFrame>;
  }
  if (session.state !== 'staff') {
    return <AdminFrame title={title}>{blocked ? blocked(session) : <p>An active staff assignment and the security migration are required.</p>}</AdminFrame>;
  }
  return <>{children(session)}</>;
}
