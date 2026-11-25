'use client';

// Client-side replacement for loadVehicleEditor in ./queries.ts.
// Reads the editor record via the session client; signed preview URLs are
// created with the session JWT (RLS grants staff read on car-drafts), so no
// service key is needed in the browser.

import type { SupabaseClient } from '@supabase/supabase-js';
import { validSlug } from '@/lib/inventory/model';
import type { StaffVehicle, MediaAsset, StockEvent } from './types';

export const STAFF_CAR_COLUMNS = 'id,status,version,year,make,model,variant,km,fuel,transmission,body,price_lakh,price_note,reg,location,highlights,overview,listing_url,featured,sort_order,photo_stock,photos_gallery,media_order,created_at,updated_at';

export type VehicleEditorResult =
  | { state: 'blocked' }
  | { state: 'missing' }
  | { state: 'error' }
  | { state: 'ready'; car: StaffVehicle; media: MediaAsset[]; events: StockEvent[]; urls: Record<string, string>; mediaConfigured: boolean; note: string };

export async function loadVehicleEditorClient(client: SupabaseClient, id: string): Promise<VehicleEditorResult> {
  if (!validSlug(id)) return { state: 'missing' };
  const result = await client.from('cars').select(STAFF_CAR_COLUMNS).eq('id', id).maybeSingle<StaffVehicle>();
  if (result.error) return { state: 'error' };
  if (!result.data) return { state: 'missing' };
  const [mediaRes, eventsRes, noteRes] = await Promise.all([
    client.from('vehicle_media').select('id,vehicle_id,uploaded_by,object_path,public_path,state,bytes,width,height,created_at').eq('vehicle_id', id).neq('state', 'removed').order('created_at').limit(21).returns<MediaAsset[]>(),
    client.from('vehicle_stock_events').select('id,vehicle_id,actor_id,event_type,from_status,to_status,reason,at').eq('vehicle_id', id).order('at', { ascending: false }).limit(50).returns<StockEvent[]>(),
    client.from('vehicle_internal_notes').select('note').eq('vehicle_id', id).maybeSingle<{ note: string }>(),
  ]);
  if (mediaRes.error || eventsRes.error || noteRes.error) return { state: 'error' };
  const urls: Record<string, string> = {};
  // RLS lets staff read car-drafts objects; signed URLs expire in 60s.
  for (const asset of mediaRes.data ?? []) {
    if (!['ready', 'published'].includes(asset.state)) continue;
    const signed = await client.storage.from('car-drafts').createSignedUrl(asset.object_path, 60);
    if (!signed.error && signed.data) urls[asset.id] = signed.data.signedUrl;
  }
  return { state: 'ready', car: result.data, media: mediaRes.data ?? [], events: eventsRes.data ?? [], urls, mediaConfigured: true, note: noteRes.data?.note ?? '' };
}
