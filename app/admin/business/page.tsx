'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { AdminFrame } from '@/components/admin/frame';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { leadStatuses } from '@/lib/business/validation';
import { staffTime } from '@/lib/admin/format';

interface RequestRow { id: string; reference: string; kind: string; contact_name: string; status: string; assigned_to: string | null; created_at: string; follow_up_at: string | null }

function BusinessPage() {
  const params = useSearchParams();
  const client = useSupabaseClient();
  const status = typeof params.get('status') === 'string' && leadStatuses.includes(params.get('status') as typeof leadStatuses[number]) ? params.get('status')! : '';
  const kind = typeof params.get('kind') === 'string' && ['general', 'car', 'viewing', 'sell', 'exchange', 'service', 'finance', 'insurance'].includes(params.get('kind')!) ? params.get('kind')! : '';
  const page = typeof params.get('page') === 'string' && /^\d{1,4}$/.test(params.get('page')!) ? Math.max(1, +params.get('page')!) : 1;

  const [rows, setRows] = useState<RequestRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client) return;
    (async () => {
      let query = client.from('business_requests').select('id,reference,kind,contact_name,status,assigned_to,created_at,follow_up_at', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (kind) query = query.eq('kind', kind);
      const [r, s] = await Promise.all([
        query.order('created_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1),
        client.rpc('business_overview'),
      ]);
      if (!active) return;
      if (r.error) { setError(true); } else { setRows(r.data as RequestRow[]); setCount(r.count ?? null); }
      if (!s.error) setSummary(s.data as Record<string, unknown>);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [client, status, kind, page]);

  return (
    <StaffGate title="Requests, viewings and services" blocked={() => <AdminFrame title="Business workflows setup pending"><p>Authentication and the reviewed business migration must be active. No request data is accepted here.</p></AdminFrame>}>
      {(session) => (
        <AdminFrame title="Requests, viewings and services">
          <p>{session.profile!.role === 'staff' ? 'You see requests assigned to you only.' : 'Managers see the dealership request queue, including unassigned requests.'} Automatic email/SMS notifications are disabled; review this queue regularly.</p>
          {summary ? <dl className="admin-metrics">{Object.entries(summary).map(([key, n]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{String(n)}</dd></div>)}</dl> : <p>Loading summary…</p>}
          <form className="filters" method="get">
            <div className="field"><label htmlFor="b-status">Status</label><select name="status" id="b-status" defaultValue={status}><option value="">All statuses</option>{leadStatuses.map((v) => <option key={v}>{v}</option>)}</select></div>
            <div className="field"><label htmlFor="b-kind">Request kind</label><select name="kind" id="b-kind" defaultValue={kind}><option value="">All kinds</option>{['general', 'car', 'viewing', 'sell', 'exchange', 'service', 'finance', 'insurance'].map((v) => <option key={v}>{v}</option>)}</select></div>
            <button type="submit" className="btn btn--line">Filter queue</button>
          </form>
          {error ? <p role="alert">Could not load the queue. No zero total is substituted.</p> : !loaded ? <p>Loading queue…</p> : (
            <>
              <p>{count ?? 'Unknown'} matching permitted requests · page {page}</p>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Request</th><th>Contact</th><th>Status</th><th>Received</th><th>Follow-up</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><Link href={`/admin/business/request?id=${r.id}`}>{r.kind} · {r.reference.slice(0, 8)}</Link></td><td>{r.contact_name}</td><td>{r.status}{!r.assigned_to ? ' · unassigned' : ''}</td><td>{staffTime(r.created_at)}</td><td>{r.follow_up_at ? staffTime(r.follow_up_at) : 'Not set'}</td></tr>)}</tbody></table></div>
              <nav className="pagination" aria-label="Request queue pages">
                {page > 1 && <Link href={`/admin/business?${new URLSearchParams({ status, kind, page: String(page - 1) })}`}>Previous</Link>}
                {page * 20 < (count ?? 0) && <Link href={`/admin/business?${new URLSearchParams({ status, kind, page: String(page + 1) })}`}>Next</Link>}
              </nav>
            </>
          )}
        </AdminFrame>
      )}
    </StaffGate>
  );
}

export default function BusinessPageWrapper() {
  return <Suspense fallback={<div className="band"><div className="wrap"><p>Loading…</p></div></div>}><BusinessPage /></Suspense>;
}
