'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame, InventoryBlocked } from '@/components/admin/frame';
import { safeAuditChanges } from '@/lib/admin/audit';
import { staffTime } from '@/lib/admin/format';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { validSlug } from '@/lib/inventory/model';
import { validUuid } from '@/lib/auth/policy';
import { StockHistory } from '@/components/admin/history';
import type { StockEvent } from '@/lib/admin/types';

interface AuditRow { id: number; at: string; actor_id: string | null; action: string; entity: string; entity_id: string; summary: string; changes: unknown }

function Logs() {
  const params = useSearchParams();
  const client = useSupabaseClient();
  const id = typeof params.get('vehicle') === 'string' && validSlug(params.get('vehicle')!) ? params.get('vehicle')! : '';
  const actor = typeof params.get('actor') === 'string' && validUuid(params.get('actor')!) ? params.get('actor')! : '';
  const day = (key: string) => typeof params.get(key) === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.get(key)!) && Number.isFinite(Date.parse(params.get(key)!)) ? params.get(key)! : '';
  const from = day('from'), to = day('to');
  const action = typeof params.get('action') === 'string' && /^[a-z_.]{1,60}$/.test(params.get('action')!) ? params.get('action')! : '';

  const [stock, setStock] = useState<StockEvent[]>([]);
  const [activity, setActivity] = useState<AuditRow[]>([]);
  const [stockError, setStockError] = useState(false);
  const [activityError, setActivityError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client) return;
    (async () => {
      let events = client.from('vehicle_stock_events').select('id,vehicle_id,actor_id,event_type,from_status,to_status,reason,at').order('at', { ascending: false }).limit(50);
      let audit = client.from('activity_log').select('id,at,actor_id,action,entity,entity_id,summary,changes').in('entity', ['cars', 'vehicle_stock_events']).order('at', { ascending: false }).limit(50);
      if (id) { events = events.eq('vehicle_id', id); audit = audit.eq('entity_id', id); }
      if (actor) { events = events.eq('actor_id', actor); audit = audit.eq('actor_id', actor); }
      if (from) { events = events.gte('at', from + 'T00:00:00+05:30'); audit = audit.gte('at', from + 'T00:00:00+05:30'); }
      if (to) { const end = new Date(to + 'T00:00:00+05:30'); end.setUTCDate(end.getUTCDate() + 1); events = events.lt('at', end.toISOString()); audit = audit.lt('at', end.toISOString()); }
      if (action) audit = audit.eq('action', action);
      const [s, a] = await Promise.all([events.returns<StockEvent[]>(), audit]);
      if (!active) return;
      if (s.error) setStockError(true); else setStock(s.data ?? []);
      if (a.error) setActivityError(true); else setActivity(a.data as AuditRow[]);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [client, id, actor, from, to, action]);

  return (
    <AdminFrame title="Stock and audit history">
      <form method="get" className="form" action="/admin/logs">
        <div className="field"><label htmlFor="log-car">Vehicle reference (optional)</label><input type="text" name="vehicle" id="log-car" maxLength={120} defaultValue={id} /></div>
        <div className="field"><label htmlFor="log-actor">Actor UUID (optional)</label><input type="text" id="log-actor" name="actor" maxLength={36} defaultValue={actor} /></div>
        <div className="field"><label htmlFor="log-from">From date (Kolkata)</label><input type="date" id="log-from" name="from" defaultValue={from} /></div>
        <div className="field"><label htmlFor="log-to">Through date (Kolkata)</label><input type="date" id="log-to" name="to" defaultValue={to} /></div>
        <div className="field"><label htmlFor="log-action">Audit action (optional, e.g. cars.photos)</label><input type="text" id="log-action" name="action" maxLength={60} defaultValue={action} /></div>
        <button className="btn btn--line" type="submit">Filter history</button>
      </form>
      <p>Append-only for application roles. Actor IDs come from server/token identity. This is not a complete authentication log or an immutable external ledger.</p>
      {stockError ? <p role="alert">Could not read stock events.</p> : !loaded ? <p>Loading history…</p> : (
        <>
          {!id && <p>Recent events across inventory; filter by vehicle for a specific history.</p>}
          {!id && stock.map((e) => <p key={e.id}><Link href={`/admin/inventory/${e.vehicle_id}`}>{e.vehicle_id}</Link> · {e.to_status} · {staffTime(e.at)}</p>)}
          <StockHistory events={stock} />
        </>
      )}
      <section>
        <h2>Permitted inventory audit entries</h2>
        <p>Most recent 50 entries permitted by your database role; staff see their own car changes. The old raw audit fields (email, IP and user-agent) are never selected here.</p>
        {activityError ? <p role="alert">Could not read audit entries.</p> : <ol className="admin-history">{activity.map((log) => <li key={log.id}><time dateTime={log.at}>{staffTime(log.at)}</time> · {log.entity_id} · {log.summary}<p>Actor: {log.actor_id ?? 'Trusted maintenance / unavailable'}</p><pre>{JSON.stringify(safeAuditChanges(log.changes), null, 2)}</pre></li>)}</ol>}
      </section>
    </AdminFrame>
  );
}

export default function LogsPage() {
  return (
    <StaffGate title="Stock and audit history" blocked={() => <InventoryBlocked />}>
      {() => <Suspense fallback={<p>Loading…</p>}><Logs /></Suspense>}
    </StaffGate>
  );
}
