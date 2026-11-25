'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { statuses } from '@/lib/admin/validation';

export function InventoryOverview() {
  const client = useSupabaseClient();
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(true);
  // Resolve the workflow overview client-side; initial data load for a client-rendered page.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let active = true;
    if (!client) { setPending(false); return; }
    (async () => {
      const marker = await client.rpc('inventory_workflow_version');
      if (!active) return;
      if (marker.error || marker.data !== 4) { setPending(false); return; }
      const result = await client.rpc('inventory_overview');
      if (!active) return;
      if (result.error) { setError(true); } else { setTotals(result.data as Record<string, number>); }
      setPending(false);
    })();
    return () => { active = false; };
  /* eslint-enable react-hooks/set-state-in-effect */
  }, [client]);
  if (pending) return <p>Loading stock counts…</p>;
  return <section>
    <h2>Stock overview</h2>
    {error ? <p role="alert">Could not load stock counts. No totals are substituted.</p> : totals ? (
      <dl className="admin-metrics">{statuses.map((s) => <div key={s}><dt>{s}</dt><dd>{totals[s] ?? 0}</dd></div>)}</dl>
    ) : <p>Inventory workflow activation is pending. No stock counts are available yet.</p>}
    <p>Record counts, not physical forecourt counts or sales revenue. Leads, viewings and service metrics are not implemented in this phase.</p>
  </section>;
}

export function BusinessOverview() {
  const client = useSupabaseClient() as SupabaseClient | null;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(true);
  // Resolve the business overview client-side; initial data load for a client-rendered page.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let active = true;
    if (!client) { setPending(false); return; }
    (async () => {
      const marker = await client.rpc('business_workflow_version');
      if (!active) return;
      if (marker.error || marker.data !== 5) { setPending(false); return; }
      const result = await client.rpc('business_overview');
      if (!active) return;
      if (result.error) { setError(true); } else { setData(result.data as Record<string, unknown>); }
      setPending(false);
    })();
    return () => { active = false; };
  /* eslint-enable react-hooks/set-state-in-effect */
  }, [client]);
  if (pending) return <p>Loading business totals…</p>;
  return <section>
    <h2>Business overview</h2>
    {error ? <p role="alert">Could not read business totals.</p> : data ? (
      <dl className="admin-metrics">{Object.entries(data).map(([key, n]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(n)}</dd></div>)}</dl>
    ) : <p>Business workflow activation is pending; no lead/service totals are shown.</p>}
    <Link href="/admin/business">Open requests and schedules</Link>
    <p>Totals follow your current database permissions. They are not revenue or notification-delivery counts.</p>
  </section>;
}
