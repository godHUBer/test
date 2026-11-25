'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFrame } from '@/components/auth/auth-frame';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { browserAuthConfig } from '@/lib/supabase/config';

function ConfirmForm() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useSupabaseClient();
  const token = typeof params.get('token_hash') === 'string' ? params.get('token_hash')! : '';
  const type = typeof params.get('type') === 'string' ? params.get('type')! : '';
  const valid = /^[a-f0-9]{20,256}$/i.test(token) && ['invite', 'recovery'].includes(type);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  if (!browserAuthConfig()) return <p>Staff authentication is not configured in this preview.</p>;
  if (!valid) return <p>This link is invalid. Request a new invitation or password reset.</p>;

  return (
    <>
      <p>Continue only if you requested this password reset or expected an invitation from the dealership. This confirmation prevents automated email scanners from consuming your link.</p>
      <form onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError('');
        if (!client) { setError('Not configured.'); setPending(false); return; }
        const result = await client.auth.verifyOtp({ token_hash: token, type: type as 'invite' | 'recovery' });
        if (result.error) { setError('This link is invalid or has expired. Request a new invitation or reset link.'); setPending(false); return; }
        router.push('/admin/password');
      }}>
        <button className="btn btn--solid" type="submit" disabled={pending}>{pending ? 'Confirming…' : 'Confirm and set password'}</button>
      </form>
      {error && <p role="alert" className="admin-error">{error}</p>}
    </>
  );
}

export default function ConfirmPage() {
  return <AuthFrame title="Confirm staff access link"><Suspense fallback={<p>Loading…</p>}><ConfirmForm /></Suspense></AuthFrame>;
}
