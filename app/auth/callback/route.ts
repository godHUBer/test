import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { authConfig } from '@/lib/supabase/config';
export async function GET(request: Request) {
  const config = authConfig();
  if (!config) return new Response('Staff authentication is not configured.', { status: 503 });
  const code = new URL(request.url).searchParams.get('code');
  const client = await sessionClient();
  if (code && code.length <= 4096 && client) {
    const result = await client.auth.exchangeCodeForSession(code);
    if (!result.error) return NextResponse.redirect(`${config.origin}/admin/password`);
  }
  return NextResponse.redirect(`${config.origin}/admin/login?link=expired`);
}
