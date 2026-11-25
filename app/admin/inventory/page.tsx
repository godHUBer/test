'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StaffGate } from '@/components/admin/staff-gate';
import { useSupabaseClient } from '@/lib/auth/client-session';
import { statuses } from '@/lib/admin/validation';
import { formatPrice } from '@/lib/inventory/model';
import { lakhToRupees } from '@/lib/format';

interface CarRow { id: string; year: number; make: string; model: string; status: string; price_lakh: string | number; version: number }

function InventoryAdmin() {
  const params = useSearchParams();
  const client = useSupabaseClient();
  const status = typeof params.get('status') === 'string' && statuses.includes(params.get('status') as typeof statuses[number]) ? params.get('status')! : '';
  const q = typeof params.get('q') === 'string' ? params.get('q')!.trim().slice(0, 60) : '';
  const page = typeof params.get('page') === 'string' && /^\d{1,4}$/.test(params.get('page')!) ? Math.max(1, +params.get('page')!) : 1;

  const [rows, setRows] = useState<CarRow[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [overview, setOverview] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    if (!client) return;
    (async () => {
      let query = client.from('cars').select('id,year,make,model,status,price_lakh,version,updated_at', { count: 'exact' });
      if (status) query = query.eq('status', status);
      if (q) query = query.ilike('model', '%' + q.replace(/[\\%_]/g, '\\$&') + '%');
      const [result, ov] = await Promise.all([
        query.order('updated_at', { ascending: false }).order('id').range((page - 1) * 20, page * 20 - 1),
        client.rpc('inventory_overview'),
      ]);
      if (!active) return;
      if (result.error) { setError(true); } else { setRows(result.data as CarRow[]); setCount(result.count ?? null); }
      if (!ov.error) setOverview(ov.data as Record<string, number>);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [client, status, q, page]);

  return (
    <StaffGate title="Inventory">
      {(session) => (
        <>
          <p>Signed in as {session.profile!.role}. Staff prepare drafts; managers/owners publish and change availability. Asking prices are not revenue.</p>
          <Link className="btn btn--solid" href="/admin/inventory/new">Create a draft</Link>
          {overview ? <dl className="admin-metrics">{statuses.map((s) => <div key={s}><dt>{s}</dt><dd>{overview[s] ?? 0}</dd></div>)}</dl> : <p>Loading stock counts…</p>}
          <form className="filters" method="get" action="/admin/inventory">
            <div className="field"><label htmlFor="a-status">Status</label><select id="a-status" name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            <div className="field"><label htmlFor="a-q">Model search</label><input id="a-q" name="q" type="text" maxLength={60} defaultValue={q} /></div>
            <button type="submit" className="btn btn--line">Filter</button>
          </form>
          {error ? <p role="alert">Could not load inventory. This is not a zero-stock result.</p> : !loaded ? <p>Loading inventory…</p> : (
            <>
              <p>{count ?? 'Unknown'} matching records · page {page}</p>
              <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Vehicle</th><th>Status</th><th>Asking price</th><th>Version</th><th>Action</th></tr></thead><tbody>{rows.map((c) => <tr key={c.id}><td>{c.year} {c.make} {c.model}<small>{c.id}</small></td><td>{c.status}</td><td>{formatPrice(lakhToRupees(String(c.price_lakh)))}</td><td>{c.version}</td><td><Link href={`/admin/inventory/${c.id}`}>Open record</Link></td></tr>)}</tbody></table></div>
              {!rows.length && <p>No records on this page. Adjust filters or return to page one.</p>}
              <nav className="pagination" aria-label="Staff inventory pages">
                {page > 1 && <Link href={`/admin/inventory?${new URLSearchParams({ status, q, page: String(page - 1) })}`}>Previous</Link>}
                {page * 20 < (count ?? 0) && <Link href={`/admin/inventory?${new URLSearchParams({ status, q, page: String(page + 1) })}`}>Next</Link>}
              </nav>
            </>
          )}
        </>
      )}
    </StaffGate>
  );
}

export default function InventoryAdminPage() {
  return <Suspense fallback={<div className="band"><div className="wrap"><p>Loading…</p></div></div>}><InventoryAdmin /></Suspense>;
}
