// Supabase Edge Function: media-publish
//
// Publishes a sanitised private vehicle photograph to the public bucket. The
// privileged draft→public copy and the commit (finish_media_publication) need
// the service key, which must never reach the browser, so they run here.
//
// The caller (manager/owner) has already reserved publication via the
// request_media_publication RPC (state='publishing'). This function verifies
// the caller JWT + recent TOTP, re-decodes the private object (defence in
// depth), re-encodes it as WebP, uploads to the public bucket, then commits.
//
// Env: SUPABASE_URL, SUPABASE_SECRET_KEY (service key), MEDIA_STORAGE_SECRET_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } })
}

function hasRecentTotp(amr: unknown, nowSeconds = Date.now() / 1000): boolean {
  return Array.isArray(amr) && amr.some((item) => item && item.method === 'totp'
    && typeof item.timestamp === 'number' && item.timestamp <= nowSeconds + 30 && item.timestamp >= nowSeconds - 600)
}

// Re-decode + re-encode a private object to WebP in the Edge runtime, stripping
// any embedded metadata. Mirrors the server-side sanitiseImage defence in depth.
async function reencodeWebP(bytes: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([bytes.slice()])
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const out = await canvas.convertToBlob({ type: 'image/webp', quality: 0.92 })
    return new Uint8Array(await out.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseSecret = Deno.env.get('SUPABASE_SECRET_KEY') ?? ''
  if (!supabaseUrl || !supabaseSecret) return json(500, { ok: false, error: 'Media publication is not configured.' })

  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
  if (!bearer) return json(401, { ok: false, error: 'Manager/owner with MFA required.' })

  let assetId = ''
  try {
    const body = await req.json().catch(() => ({}))
    assetId = String(body?.asset_id ?? '')
  } catch {
    return json(400, { ok: false, error: 'Invalid request.' })
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId)) {
    return json(400, { ok: false, error: 'Invalid asset reference.' })
  }

  // Verify the caller is an active manager/owner with recent TOTP.
  const caller = createClient(supabaseUrl, supabaseSecret, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: { headers: { Authorization: authHeader } },
  })
  const { data: claimsData, error: claimsError } = await caller.auth.getClaims()
  if (claimsError || !claimsData?.claims) return json(401, { ok: false, error: 'Could not verify the caller.' })
  if (claimsData.claims.role !== 'owner' && claimsData.claims.role !== 'manager') {
    return json(403, { ok: false, error: 'Manager/owner with MFA required.' })
  }
  if (!hasRecentTotp(claimsData.claims.amr)) return json(403, { ok: false, error: 'An active manager/owner must verify MFA within the last 10 minutes.' })

  // Read the asset row (service key bypasses RLS) to get the private/public paths.
  const storage = createClient(supabaseUrl, supabaseSecret, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: asset, error: assetError } = await storage.from('vehicle_media').select('id,object_path,public_path,state,vehicle_id').eq('id', assetId).maybeSingle()
  if (assetError || !asset || asset.state !== 'publishing' || !asset.object_path || !asset.public_path) {
    return json(409, { ok: false, error: 'Publication reservation is not active. Reload and verify state.' })
  }

  let stage = 'private image download'
  try {
    const source = await storage.storage.from('car-drafts').download(asset.object_path)
    if (source.error || !source.data) throw new Error('Source unavailable')

    stage = 'publication image decoding'
    const processed = await reencodeWebP(new Uint8Array(source.data))

    stage = 'public image upload'
    const uploaded = await storage.storage.from('car-photos').upload(asset.public_path, processed, {
      contentType: 'image/webp', upsert: false, cacheControl: '31536000',
    })
    if (uploaded.error) throw new Error('Copy failed')

    stage = 'publication metadata confirmation'
    const complete = await storage.rpc('finish_media_publication', { asset_id: assetId })
    if (complete.error) throw new Error('Publication commit failed')

    return json(200, { ok: true })
  } catch (error) {
    // Never remove a committed publication on an ambiguous response.
    return json(500, { ok: false, error: `Publication was not confirmed (${stage}). The object may briefly be public. Do not retry blindly: ask an owner to reconcile the pending publication.` })
  }
}

Deno.serve(handler)
