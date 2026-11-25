import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { authConfig } from '@/lib/supabase/config';
export default function RecoveryPage() {
  return <AuthFrame title="Reset your password">{authConfig() ? <AuthForm mode="recover" /> : <p>Password recovery is not configured in this preview.</p>}</AuthFrame>;
}
