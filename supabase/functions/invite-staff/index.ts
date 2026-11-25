// Supabase Edge Function: invite-staff
//
// Creates a GoTrue auth invitation for a staff email. GoTrue's
// admin.inviteUserByEmail needs the service key, which must never reach the
// browser, so this privileged operation runs here. The caller's owner JWT +
// recent TOTP (amr) are verified server-side before the service-key call.
//
// Env (set in the Supabase project secrets, not the client):
//   SUPABASE_URL, SUPABASE_SECRET_KEY (service key)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

// Mirror lib/auth/policy.hasRecentTotp: a TOTP entry within the last 600s.
function hasRecentTotp(amr: unknown, nowSeconds = Date.now() / 1000): boolean {
  return Array.isArray(amr) && amr.some((item) => item && item.method === 'totp'
    && typeof item.timestamp === 'number' && item.timestamp <= nowSeconds + 30 && item.timestamp >= nowSeconds - 600)
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
  if (!supabaseUrl || !supabaseSecret) return json(500, { ok: false, error: 'Invitations are not configured. No invitation was sent.' })

  // The Edge Function runtime injects the caller's Authorization header.
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
  if (!bearer) return json(401, { ok: false, error: 'An active owner must sign in before inviting staff.' })

  // Verify the caller is a real, active owner with a recent TOTP claim.
  const caller = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsData, error: claimsError } = await caller.auth.getClaims()
  if (claimsError || !claimsData?.claims) return json(401, { ok: false, error: 'Could not verify the caller.' })
  const role = claimsData.claims.role
  if (role !== 'owner') return json(403, { ok: false, error: 'Only the dealership owner can invite staff.' })
  if (!hasRecentTotp(claimsData.claims.amr)) return json(403, { ok: false, error: 'An active owner must verify MFA within the last 10 minutes.' })

  let email = ''
  try {
    const body = await req.json().catch(() => ({}))
    email = String(body?.email ?? '').trim().toLowerCase()
  } catch {
    return json(400, { ok: false, error: 'Invalid request.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json(400, { ok: false, error: 'Enter a valid staff email.' })
  }

  // Service-key client: the privileged GoTrue admin call happens only here.
  const privileged = createClient(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } })
  const redirectTo = `${new URL(supabaseUrl).origin}/admin/confirm`
  const result = await privileged.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (result.error) return json(502, { ok: false, error: 'Invitation could not be sent. Check the account, sender configuration and provider limits.' })

  return json(200, { ok: true })
}

Deno.serve(handler)
