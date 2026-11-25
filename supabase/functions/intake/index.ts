// Supabase Edge Function: intake
//
// Stores a public business enquiry (contact / sell / service request). The
// HMAC envelope (request_key + issued + signature) is validated here against
// the hash secret, which must never reach the browser, then the request is
// committed via the accept_business_request RPC (which enforces the workflow
// version, rate limits and contact hashing server-side).
//
// Intake is disabled unless BUSINESS_INTAKE_ENABLED=true (WhatsApp-first launch
// default: off). When disabled, every request is rejected without storage.
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY (service key), INTAKE_HASH_SECRET,
//      INTAKE_TRUSTED_IP_HEADER (optional)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  if (Deno.env.get('BUSINESS_INTAKE_ENABLED') !== 'true') {
    return json(503, { ok: false, error: 'Online intake is not configured. No request was stored. Please call or email the showroom.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
  const hashSecret = Deno.env.get('INTAKE_HASH_SECRET') ?? ''
  if (!supabaseUrl || !supabaseSecret || !hashSecret) {
    return json(500, { ok: false, error: 'Online intake is not configured. No request was stored.' })
  }

  let body: Record<string, string>
  try {
    body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'Invalid request.' })
  } catch {
    return json(400, { ok: false, error: 'Invalid request.' })
  }

  const requestKey = String(body.request_key ?? '')
  const issued = String(body.issued ?? '')
  const signature = String(body.signature ?? '')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey)
    || !/^\d{13}$/.test(issued)
    || !/^[0-9a-f]{64}$/.test(signature)) {
    return json(400, { ok: false, error: 'Please wait a moment before submitting, or reload if the form is over two hours old.' })
  }

  // Validate the HMAC envelope (timing-safe via subtle compare).
  const expected = await hmac(hashSecret, `intake:${requestKey}:${issued}`)
  const a = new Uint8Array([...expected].map((c) => parseInt(c, 16)))
  const b = new Uint8Array([...signature].map((c) => parseInt(c, 16)))
  const valid = a.length === b.length && a.every((v, i) => v === b[i])
  const age = Date.now() - Number(issued)
  if (!valid || age < 2000 || age > 7200000) {
    return json(400, { ok: false, error: 'Please wait a moment before submitting, or reload if the form is over two hours old.' })
  }

  // Build the payload from the submitted fields (mirrors parseIntake shape).
  const payload: Record<string, string> = {}
  for (const key of ['kind', 'source', 'contact_name', 'phone', 'email', 'message', 'vehicle_id', 'service_id', 'customer_vehicle']) {
    if (typeof body[key] === 'string') payload[key] = body[key]
  }
  for (const key of ['make', 'model', 'year', 'km', 'ownership', 'insurance', 'location']) {
    if (typeof body[`seller_${key}`] === 'string') payload[`seller_${key}`] = body[`seller_${key}`]
  }

  const storage = createClient(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } })
  const contract = await storage.rpc('business_workflow_version')
  if (contract.error || contract.data !== 5) {
    return json(503, { ok: false, error: 'Online intake is unavailable. No stored reference was confirmed; please call the showroom.' })
  }

  let networkHash: string | null = null
  const ipHeader = Deno.env.get('INTAKE_TRUSTED_IP_HEADER')
  if (ipHeader) {
    if (!['cf-connecting-ip', 'x-real-ip'].includes(ipHeader)) {
      return json(500, { ok: false, error: 'Intake network configuration needs attention. Please contact the showroom.' })
    }
    const ip = req.headers.get(ipHeader)
    if (!ip || !/^[0-9a-f:]+$/i.test(ip)) {
      return json(400, { ok: false, error: 'Could not verify the request network. Please contact the showroom.' })
    }
    networkHash = await hmac(hashSecret, `network:${ip}`)
  }

  const contactHash = await hmac(hashSecret, `phone:${payload.phone?.replace(/^\+/, '') ?? ''}`)
  const fingerprint = await hmac(hashSecret, JSON.stringify(payload))

  const result = await storage.rpc('accept_business_request', {
    request_key: requestKey,
    fingerprint,
    payload,
    contact_hash: contactHash,
    network_hash: networkHash,
  })
  if (result.error || typeof result.data !== 'string') {
    if (result.error?.code === 'P0001') {
      return json(429, { ok: false, error: 'Too many recent requests. Wait before retrying or call the showroom.' })
    }
    return json(500, { ok: false, error: 'Submission was not confirmed. Keep this form and retry unchanged, or contact the showroom. Availability may have changed. No booking or notification is confirmed.' })
  }

  return json(200, { ok: true, reference: result.data })
}

Deno.serve(handler)
