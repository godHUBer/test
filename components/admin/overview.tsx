import type {SupabaseClient} from '@supabase/supabase-js';
import {statuses} from '@/lib/admin/validation';
export async function InventoryOverview({client}:{client:SupabaseClient}){
 const marker=await client.rpc('inventory_workflow_version');
 if(marker.error||marker.data!==4)return <p>Inventory workflow activation is pending. No stock counts are available yet.</p>;
 const totals=await client.rpc('inventory_overview');
 return <section><h2>Stock overview</h2>{totals.error?<p role="alert">Could not load stock counts. No totals are substituted.</p>:<dl className="admin-metrics">{statuses.map(s=><div key={s}><dt>{s}</dt><dd>{totals.data?.[s]??0}</dd></div>)}</dl>}<p>Record counts, not physical forecourt counts or sales revenue. Leads, viewings and service metrics are not implemented in this phase.</p></section>;
}
