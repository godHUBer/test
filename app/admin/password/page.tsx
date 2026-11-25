'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { useSupabaseClient } from '@/lib/auth/client-session';

export default function PasswordPage() {
  const client = useSupabaseClient();
  const [hasUser, setHasUser] = useState<boolean | null>(null);

  // Resolve the Supabase session client-side; this is the initial data load for a client-rendered page.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let active = true;
    if (!client) { setHasUser(false); return; }
    client.auth.getUser().then((res) => { if (active) setHasUser(!!res.data?.user); });
    return () => { active = false; };
  /* eslint-enable react-hooks/set-state-in-effect */
  }, [client]);

  return (
    <AuthFrame title="Set your password">
      {hasUser === null ? <p>Checking your session…</p> : hasUser ? (
        <>
          <p>Use a unique password. Verified authenticator users must complete MFA first. Successful reset signs out other sessions.</p>
          <AuthForm mode="password" />
          <Link href="/admin/mfa">Verify your authenticator</Link>
        </>
      ) : <p>A valid invitation or recovery session is required. <Link href="/admin/recovery">Request a new link</Link>.</p>}
    </AuthFrame>
  );
}
