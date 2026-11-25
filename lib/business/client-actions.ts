'use client';

// Client-side replacements for the server actions in ./actions.ts.
// The Supabase RPCs enforce staff role, MFA and optimistic versioning.

import type { SupabaseClient } from '@supabase/supabase-js';
import { uuid, integer, value, kolkataInstant, leadStatuses, type BusinessState } from './validation';
import { validUuid } from '@/lib/auth/policy';

async function workflowActive(client: SupabaseClient): Promise<boolean> {
  const result = await client.rpc('business_workflow_version');
  return !result.error && result.data === 5;
}

function failure(error: { code?: string }): string {
  return error.code === '40001'
    ? 'Record changed. Reload and compare before retrying. Your unsaved input remains.'
    : error.code === '23P01'
      ? 'That staff member or vehicle already has a conflicting confirmed schedule.'
      : 'The database rejected this request. Check permissions, assignment, status, availability and time. No success is claimed.';
}

export async function manageRequestClient(client: SupabaseClient, _state: BusinessState, form: FormData): Promise<BusinessState> {
  if (!(await workflowActive(client))) return { error: 'Business workflows are not activated for this session.' };
  try {
    const id = uuid(form, 'request_id'), ver = integer(form, 'version'), status = value(form, 'status', 20), assignee = value(form, 'assigned_to', 36), follow = kolkataInstant(value(form, 'follow_up', 16));
    if (!leadStatuses.includes(status as typeof leadStatuses[number]) || (assignee && !validUuid(assignee))) throw new Error('Invalid lead state or assignee');
    const result = await client.rpc('update_business_request', { request_key: id, expected_version: ver, next_status: status, assignee: assignee || null, follow_up: follow });
    if (result.error) return { error: failure(result.error) };
    return { message: 'Request updated. Reload before another change.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid request' };
  }
}

export async function addNoteClient(client: SupabaseClient, _state: BusinessState, form: FormData): Promise<BusinessState> {
  if (!(await workflowActive(client))) return { error: 'Authorised business access required.' };
  try {
    const id = uuid(form, 'request_id'), ver = integer(form, 'version'), note = value(form, 'note', 3000);
    if (!note) throw new Error('Add a note');
    const result = await client.rpc('add_request_note', { request_key: id, expected_version: ver, note_text: note });
    if (result.error) return { error: failure(result.error) };
    return { message: 'Private note stored. Reload before another change.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid note' };
  }
}

export async function saveViewingClient(client: SupabaseClient, _state: BusinessState, form: FormData): Promise<BusinessState> {
  if (!(await workflowActive(client))) return { error: 'Authorised business access required.' };
  try {
    const id = uuid(form, 'request_id');
    const result = await client.rpc('save_viewing', {
      appointment_id: uuid(form, 'appointment_id'), request_key: id, request_version: integer(form, 'request_version'),
      expected_version: integer(form, 'version', 0), next_status: value(form, 'status', 20),
      start_time: kolkataInstant(value(form, 'starts_at', 16)), end_time: kolkataInstant(value(form, 'ends_at', 16)),
    });
    if (result.error) return { error: failure(result.error) };
    return { message: 'Viewing record saved. Only the confirmed state represents a staff-confirmed appointment. Reload.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid viewing' };
  }
}

export async function saveJobClient(client: SupabaseClient, _state: BusinessState, form: FormData): Promise<BusinessState> {
  if (!(await workflowActive(client))) return { error: 'Authorised business access required.' };
  try {
    const result = await client.rpc('update_service_job', {
      job_key: uuid(form, 'job_id'), request_version: integer(form, 'request_version'), expected_version: integer(form, 'version'),
      next_status: value(form, 'status', 20), start_time: kolkataInstant(value(form, 'starts_at', 16)), end_time: kolkataInstant(value(form, 'ends_at', 16)),
    });
    if (result.error) return { error: failure(result.error) };
    return { message: 'Service job updated. Reload before another change.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid service job' };
  }
}

export async function saveServiceClient(client: SupabaseClient, _state: BusinessState, form: FormData): Promise<BusinessState> {
  if (!(await workflowActive(client))) return { error: 'Manager/owner with MFA required.' };
  try {
    const result = await client.rpc('save_service', {
      service_key: uuid(form, 'service_id'), expected_version: integer(form, 'version', 0),
      service_name: value(form, 'name', 100), service_description: value(form, 'description', 2000),
      is_active: form.get('active') === 'on', display_order: integer(form, 'sort_order', 0, 999999),
    });
    if (result.error) return { error: failure(result.error) };
    return { message: 'Service saved. Reload the catalogue.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid service' };
  }
}

export async function saveSettingsClient(client: SupabaseClient, _state: BusinessState, form: FormData): Promise<BusinessState> {
  if (!(await workflowActive(client))) return { error: 'Manager/owner with MFA required.' };
  try {
    const fields: Record<string, unknown> = {};
    for (const key of ['name', 'tagline', 'phone_display', 'phone_href', 'email', 'address_short', 'address_city', 'area', 'map_url', 'hours']) fields[key] = value(form, key, 500);
    fields.services = value(form, 'services', 2000).split('\n').map((v) => v.trim()).filter(Boolean);
    const result = await client.rpc('save_business_settings', { expected_version: integer(form, 'version'), fields });
    if (result.error) return { error: failure(result.error) };
    return { message: 'Business settings saved. Reload to review.' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid settings' };
  }
}
