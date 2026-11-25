'use client';

// Client-side replacement for the server submitIntake in ./intake.ts.
// The HMAC envelope is validated and the request stored by the `intake` Edge
// Function, which holds the hash secret server-side. Intake is disabled unless
// BUSINESS_INTAKE_ENABLED=true at build (WhatsApp-first launch default: off).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { BusinessState } from './validation';

export async function submitIntakeClient(client: SupabaseClient, _previous: BusinessState, form: FormData): Promise<BusinessState> {
  const body: Record<string, string> = {};
  for (const [key, value] of form.entries()) if (typeof value === 'string') body[key] = value;
  const { data, error } = await client.functions.invoke('intake', { body });
  if (error) {
    const message = typeof error === 'string' ? error : (error.message ?? 'Could not confirm storage.');
    if (/P0001|too many/i.test(message)) return { error: 'Too many recent requests. Wait before retrying or call the showroom.' };
    return { error: 'Submission was not confirmed. Keep this form and retry unchanged, or contact the showroom. Availability may have changed. No booking or notification is confirmed.' };
  }
  if (!data?.ok || typeof data?.reference !== 'string') {
    return { error: typeof data?.error === 'string' ? data.error : 'Submission was not confirmed. Keep this form and retry unchanged, or contact the showroom.' };
  }
  return { reference: data.reference, message: 'Your request was stored for the dealership to review. This is not a confirmed appointment. Automatic email/SMS notifications are not enabled.' };
}
