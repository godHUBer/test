'use client';

// Client-side replacements for the server actions in ./actions.ts.
// The Supabase RPCs enforce staff role, MFA and optimistic versioning; these
// wrappers do form validation and surface the RPC result.

import type { SupabaseClient } from '@supabase/supabase-js';
import { parseFields, identity, version, statusChange, mediaIds, assetId, text, type MutationState } from './validation';

async function workflowActive(client: SupabaseClient): Promise<boolean> {
  const result = await client.rpc('inventory_workflow_version');
  return !result.error && result.data === 4;
}

function databaseError(error: { code?: string }): string {
  return error.code === '40001'
    ? 'This vehicle changed. Reload and compare before retrying; your unsaved form values remain here.'
    : error.code === '23505'
      ? 'That vehicle ID already exists. Open it or choose a different ID.'
      : 'The database rejected the change. Check role/MFA, status, required fields and current version. No success is claimed.';
}

export async function saveVehicleActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  if (!(await workflowActive(client))) return { error: 'Inventory is unavailable until authorised configuration and migrations are active.' };
  try {
    const id = identity(form), expected = version(form, true), fields = parseFields(form);
    const result = await client.rpc('save_vehicle', { car_id: id, expected_version: expected, fields });
    if (result.error) return { error: databaseError(result.error) };
    return { message: `Saved ${id}. Reload the editor before another change.`, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid input' };
  }
}

export async function changeStatusActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  if (!(await workflowActive(client))) return { error: 'Inventory is unavailable until authorised configuration and migrations are active.' };
  if (form.get('confirm_change') !== 'on') return { error: 'Confirm the availability change explicitly.' };
  // Manager/owner + MFA is enforced authoritatively by the set_car_status RPC.
  try {
    const id = identity(form), expected = version(form), { next, reason } = statusChange(form);
    const result = await client.rpc('set_car_status', { car_id: id, next_status: next, reason, expected_version: expected });
    if (result.error) return { error: databaseError(result.error) };
    return { message: `Status changed to ${next}. Reload the editor.`, id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid status request' };
  }
}

export async function selectPhotosActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  if (!(await workflowActive(client))) return { error: 'Authorised inventory access required.' };
  try {
    const id = identity(form), expected = version(form), ids = mediaIds(form);
    const result = await client.rpc('set_vehicle_photos', { car_id: id, expected_version: expected, asset_ids: ids });
    if (result.error) return { error: databaseError(result.error) };
    return { message: 'Photo selection saved. First selected photo is the cover. Reload the editor.', id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid photo selection' };
  }
}

export async function removePhotoActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  if (!(await workflowActive(client))) return { error: 'Authorised inventory access required.' };
  if (form.get('confirm_remove') !== 'on') return { error: 'Confirm removal explicitly.' };
  try {
    const id = identity(form), asset = assetId(form), expected = version(form);
    const check = await client.from('vehicle_media').select('vehicle_id').eq('id', asset).maybeSingle();
    if (check.error || check.data?.vehicle_id !== id) return { error: 'Asset does not belong to the selected vehicle or is unavailable.' };
    const result = await client.rpc('remove_vehicle_media', { asset_id: asset, expected_version: expected });
    if (result.error) return { error: 'Could not remove the asset. It may still be selected, in flight or outside your permissions. Reload and review.' };
    return { message: 'Asset removed from the library. Published bytes are retained for existing links/history.', id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid asset' };
  }
}

export async function saveNoteActionClient(client: SupabaseClient, _state: MutationState, form: FormData): Promise<MutationState> {
  if (!(await workflowActive(client))) return { error: 'Authorised inventory access required.' };
  try {
    const id = identity(form), expected = version(form), note = text(form, 'note', 6000);
    const result = await client.rpc('save_vehicle_note', { car_id: id, expected_version: expected, note_text: note });
    if (result.error) return { error: databaseError(result.error) };
    return { message: 'Private operational note saved. Reload the record.', id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Invalid note' };
  }
}
