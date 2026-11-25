import Link from 'next/link';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { authConfig } from '@/lib/supabase/config';
export default function LoginPage() {
  return <AuthFrame title="Staff sign in">
    {!authConfig() ? <p>Staff sign-in is not configured. Database activation and environment configuration are still pending; no credentials are accepted in this preview.</p> : <>
      <p>Invitation-only dealership access. A valid account alone does not grant staff permissions.</p>
      <AuthForm mode="login" /><Link href="/admin/recovery">Forgot your password?</Link>
    </>}
  </AuthFrame>;
}
