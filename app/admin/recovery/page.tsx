'use client';
import { AuthFrame } from '@/components/auth/auth-frame';
import { AuthForm } from '@/components/auth/auth-form';
import { browserAuthConfig } from '@/lib/supabase/config';

export default function RecoveryPage() {
  const configured = !!browserAuthConfig();
  return <AuthFrame title="Reset your password">{configured ? <AuthForm mode="recover" /> : <p>Password recovery is not configured in this preview.</p>}</AuthFrame>;
}
