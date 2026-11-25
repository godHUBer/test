'use client';

// Client-side replacements for the server media actions in ./media.ts.
// Sanitisation happens in the browser (see ./client-images.ts); the privileged
// draft→public copy runs in a Supabase Edge Function (media-publish) so the
// service key never reaches the browser.

import type { SupabaseClient } from '@supabase/supabase-js';
import { identity, version, assetId, type MutationState } from './validation';
import type { MediaAsset } from './types';
import { sanitiseImageClient, MAX_IMAGE_BYTES } from './client-images';

export async function uploadPhotoActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  let pending: MediaAsset | null = null;
  let stage = 'validation';
  try {
    const id = identity(form), expected = version(form);
    const file = form.get('photo');
    if (!(file instanceof File) || !file.size || file.size > MAX_IMAGE_BYTES) {
      return { error: 'Choose a still JPEG, PNG or WebP of at most 5 MiB.' };
    }
    stage = 'image decoding';
    const processed = await sanitiseImageClient(file);
    stage = 'upload reservation';
    const reserved = await client.rpc('prepare_vehicle_media', { car_id: id, expected_version: expected }).single<MediaAsset>();
    if (reserved.error || !reserved.data) return { error: 'Upload reservation denied. Reload the vehicle and verify your permissions.' };
    pending = reserved.data as MediaAsset;
    stage = 'private storage upload';
    // RLS lets authenticated staff insert into the private car-drafts bucket.
    const result = await client.storage.from('car-drafts').upload(pending.object_path, new Blob([processed.data], { type: 'image/webp' }), { contentType: 'image/webp', upsert: false, cacheControl: '0' });
    if (result.error) throw new Error('Private upload failed');
    stage = 'metadata confirmation';
    const completed = await client.rpc('finish_vehicle_media', { asset_id: pending.id, byte_count: processed.data.byteLength, pixel_width: processed.width, pixel_height: processed.height });
    if (completed.error) throw new Error('Upload metadata did not commit');
    return { message: 'Sanitised photo saved privately. Reload to select or review it. It is not public.', id };
  } catch (error) {
    if (pending) {
      const check = await client.from('vehicle_media').select('state').eq('id', pending.id).maybeSingle();
      if (!check.error && check.data?.state === 'pending' && pending.object_path) {
        await client.storage.from('car-drafts').remove([pending.object_path]);
      }
    }
    return { error: error instanceof Error ? `${error.message} (${stage})` : 'Upload failed' };
  }
}

export async function publishPhotoActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  let pending: MediaAsset | null = null;
  let stage = 'preparation';
  try {
    const id = identity(form), expected = version(form), asset = assetId(form);
    stage = 'publication reservation';
    const reserved = await client.rpc('request_media_publication', { asset_id: asset, expected_version: expected }).single<MediaAsset>();
    if (reserved.error || !reserved.data) return { error: 'Publication reservation denied. Reload and verify your permissions.' };
    pending = reserved.data as MediaAsset;
    stage = 'edge publication';
    // The privileged draft→public copy + commit runs in a Supabase Edge Function.
    const { data, error } = await client.functions.invoke('media-publish', { body: { asset_id: pending.id } });
    if (error) throw new Error(typeof error === 'string' ? error : (error.message ?? 'Publication failed'));
    if (!data?.ok) throw new Error(typeof data?.error === 'string' ? data.error : 'Publication was not confirmed');
    return { message: 'Photograph is public. Select it in the photo order and save before publishing the vehicle.', id };
  } catch (error) {
    // Never remove a known committed publication on an ambiguous response.
    if (pending) {
      const check = await client.from('vehicle_media').select('state').eq('id', pending.id).maybeSingle();
      if (!check.error && check.data?.state === 'publishing' && pending.public_path) {
        await client.storage.from('car-photos').remove([pending.public_path]);
      }
    }
    return { error: error instanceof Error ? `Publication was not confirmed (${stage}). The object may briefly be public. Do not retry blindly: ask an owner to reconcile the pending publication.` : 'Publication failed' };
  }
}
