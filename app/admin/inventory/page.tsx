import Link from 'next/link';
import {inventorySession} from '@/lib/admin/session';
import {statuses} from '@/lib/admin/validation';
import {AdminFrame,InventoryBlocked} from '@/components/admin/frame';
import {formatPrice} from '@/lib/inventory/model';
import {lakhToRupees} from '@/lib/format';
export default async function InventoryAdmin({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const session=await inventorySession();if(!session)return <InventoryBlocked/>;
  const params=await searchParams;const status=typeof params.status==='string'&&statuses.includes(params.status as typeof statuses[number])?params.status:'';
  const q=typeof params.q==='string'?params.q.trim().slice(0,60):'';const page=typeof params.page==='string'&&/^\d{1,4}$/.test(params.page)?Math.max(1,+params.page):1;
  let query=session.client.from('cars').select('id,year,make,model,status,price_lakh,version,updated_at',{count:'exact'});
  if(status)query=query.eq('status',status);if(q)query=query.ilike('model','%'+q.replace(/[\\%_]/g,'\\$&')+'%');
  const [result,overview]=await Promise.all([query.order('updated_at',{ascending:false}).order('id').range((page-1)*20,page*20-1),session.client.rpc('inventory_overview')]);
  return <AdminFrame title="Inventory"><p>Signed in as {session.profile.role}. Staff prepare drafts; managers/owners publish and change availability. Asking prices are not revenue.</p>
    <Link className="btn btn--solid" href="/admin/inventory/new">Create a draft</Link>
    {overview.error?<p role="alert">Could not load stock counts; no totals are shown.</p>:<dl className="admin-metrics">{statuses.map(s=><div key={s}><dt>{s}</dt><dd>{overview.data?.[s]??0}</dd></div>)}</dl>}
    <form className="filters" method="get" action="/admin/inventory"><div className="field"><label htmlFor="a-status">Status</label><select id="a-status" name="status" defaultValue={status}><option value="">All statuses</option>{statuses.map(s=><option key={s}>{s}</option>)}</select></div><div className="field"><label htmlFor="a-q">Model search</label><input id="a-q" name="q" type="text" maxLength={60} defaultValue={q}/></div><button type="submit" className="btn btn--line">Filter</button></form>
    {result.error?<p role="alert">Could not load inventory. This is not a zero-stock result.</p>:<><p>{result.count??'Unknown'} matching records · page {page}</p><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Vehicle</th><th>Status</th><th>Asking price</th><th>Version</th><th>Action</th></tr></thead><tbody>{result.data.map(c=><tr key={c.id}><td>{c.year} {c.make} {c.model}<small>{c.id}</small></td><td>{c.status}</td><td>{formatPrice(lakhToRupees(String(c.price_lakh)))}</td><td>{c.version}</td><td><Link href={`/admin/inventory/${c.id}`}>Open record</Link></td></tr>)}</tbody></table></div>{!result.data.length&&<p>No records on this page. Adjust filters or return to page one.</p>}
    <nav className="pagination" aria-label="Staff inventory pages">{page>1&&<Link href={`/admin/inventory?${new URLSearchParams({status,q,page:String(page-1)})}`}>Previous</Link>}{page*20<(result.count??0)&&<Link href={`/admin/inventory?${new URLSearchParams({status,q,page:String(page+1)})}`}>Next</Link>}</nav></>}
  </AdminFrame>;
}
