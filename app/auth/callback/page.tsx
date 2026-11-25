'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { browserAuthConfig } from '@/lib/supabase/config';

function Callback() {
  const params = useSearchParams();
  const router = useRouter();
  const client = useSupabaseClient();
  const code = typeof params.get('code') === 'string' ? params.get('code')! : '';

  useEffect(() => {
    if (!browserAuthConfig()) { router.replace('/admin/login?link=expired'); return; }
    if (!code || code.length > 4096 || !client) { router.replace('/admin/login?link=expired'); return; }
    let active = true;
    client.auth.exchangeCodeForSession(code).then((res) => {
      if (!active) return;
      if (res.error) router.replace('/admin/login?link=expired');
      else router.replace('/admin/password');
    });
    return () => { active = false; };
  }, [code, client, router]);

  return <main id="main" className="band"><div className="wrap"><p>Completing your sign-in…</p></div></main>;
}

export default function AuthCallbackPage() {
  return <Suspense fallback={<main id="main" className="band"><div className="wrap"><p>Loading…</p></div></main>}><Callback /></Suspense>;
}
