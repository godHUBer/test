import Link from 'next/link';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { sessionClient } from '@/lib/supabase/server';
export default async function PasswordPage() {
  const client = await sessionClient();
  const user = client ? await client.auth.getUser() : null;
  return <AuthFrame title="Set your password">{user?.data.user ? <>
    <p>Use a unique password. Verified authenticator users must complete MFA first. Successful reset signs out other sessions.</p>
    <AuthForm mode="password" /><Link href="/admin/mfa">Verify your authenticator</Link>
  </> : <p>A valid invitation or recovery session is required. <Link href="/admin/recovery">Request a new link</Link>.</p>}</AuthFrame>;
}
