import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { authConfig } from '@/lib/supabase/config';
// GET never consumes invitation/recovery tokens: mail scanners must not use them up.
export async function GET() {
  return new Response('Open the invitation or recovery link in the staff website confirmation page. Automatic token verification is disabled.', { status: 400 });
}
export async function POST(request: Request) {
  const config = authConfig();
  if (!config) return new Response('Staff authentication is not configured.', { status: 503 });
  if (request.headers.get('origin') !== config.origin) return new Response('Forbidden', { status: 403 });
  const length = Number(request.headers.get('content-length'));
  if (!Number.isSafeInteger(length) || length <= 0 || length > 8192
      || !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    return new Response('Invalid confirmation request', { status: 400 });
  }
  const form = await request.formData();
  const hash = String(form.get('token_hash') ?? '');
  const type = String(form.get('type') ?? '');
  if (!/^[a-f0-9]{20,256}$/i.test(hash) || !['invite','recovery'].includes(type)) return new Response('Invalid confirmation link', { status: 400 });
  const client = await sessionClient();
  if (client) {
    const result = await client.auth.verifyOtp({ token_hash: hash, type: type as 'invite' | 'recovery' });
    if (!result.error) return NextResponse.redirect(`${config.origin}/admin/password`, 303);
  }
  return NextResponse.redirect(`${config.origin}/admin/login?link=expired`, 303);
}
