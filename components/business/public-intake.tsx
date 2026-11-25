'use client';

// Client-rendered intake wrapper. Intake is disabled by default (WhatsApp-first
// launch). When enabled, the signed envelope is produced by the `intake-envelope`
// Edge Function so the hash secret stays server-side.

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { browserClient } from '@/lib/supabase/client';
import { IntakeForm } from './intake-form';
import type { IntakeKind } from '@/lib/business/validation';

interface Envelope { requestKey: string; issued: string; signature: string }

export function PublicIntake({ kind, source, vehicleId, cars, services }: { kind: IntakeKind; source: string; vehicleId?: string; cars?: { id: string; label: string }[]; services?: { id: string; name: string }[] }) {
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_INTAKE_ENABLED !== 'true') return;
    let active = true;
    const client: SupabaseClient | null = browserClient();
    if (!client) return;
    client.functions.invoke<Envelope>('intake-envelope', { body: { kind, source } }).then((res) => {
      if (active && !res.error && res.data) setEnvelope(res.data);
    });
    return () => { active = false; };
  }, [kind, source]);
  if (process.env.NEXT_PUBLIC_INTAKE_ENABLED !== 'true') return null;
  if (!envelope) return <p>Loading the request form…</p>;
  return <IntakeForm requestKey={envelope.requestKey} issued={envelope.issued} signature={envelope.signature} kind={kind} source={source} vehicleId={vehicleId} cars={cars} services={services} />;
}
