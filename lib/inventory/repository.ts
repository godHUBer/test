import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_CAR_COLUMNS, PUBLIC_BRAND_COLUMNS, parseVehicle, parseBrand, type Vehicle } from './model';
import { budgets, PAGE_SIZE, type Filters } from './query';

export async function readAvailable(client: SupabaseClient, origin: string): Promise<Vehicle[]> {
  const vehicles: Vehicle[] = [];const seen=new Set<string>();let expected:number|null=null;
  // Count-aware paging also handles a project row cap smaller than our batch size.
  for (let offset=0; offset<5000;) {
    const response = await client.from('cars').select(PUBLIC_CAR_COLUMNS,{count:'exact'}).eq('status','available').order('id').range(offset,offset+199);
    if (response.error || !Array.isArray(response.data) || typeof response.count!=='number' || response.count>5000) throw new Error('Public inventory read failed');
    if(expected!==null&&expected!==response.count)throw new Error('Inventory changed during catalogue read');
    expected=response.count;
    const batch = response.data.map(row => parseVehicle(row,origin));
    if (batch.some(c=>c.status!=='available'||seen.has(c.id))) throw new Error('Unexpected inventory visibility or duplicate row');
    for(const car of batch)seen.add(car.id);
    vehicles.push(...batch);offset+=batch.length;
    if(vehicles.length===expected)return vehicles;
    if(!batch.length||vehicles.length>expected)throw new Error('Incomplete public catalogue');
  }
  throw new Error('Inventory exceeds the supported catalogue size');
}
export async function readBrand(client: SupabaseClient) {
  const result = await client.from('brand_settings').select(PUBLIC_BRAND_COLUMNS).eq('id',1).maybeSingle();
  if (result.error) throw new Error('Public settings read failed');
  return parseBrand(result.data);
}
export async function readVehicle(client: SupabaseClient, origin: string, id: string) {
  const result = await client.from('cars').select(PUBLIC_CAR_COLUMNS).eq('id',id).in('status',['available','reserved','sold']).maybeSingle();
  if (result.error) throw new Error('Vehicle read failed');
  return result.data ? parseVehicle(result.data,origin) : null;
}
export async function readListing(client: SupabaseClient, origin: string, f: Filters) {
  let query = client.from('cars').select(PUBLIC_CAR_COLUMNS,{ count:'exact' }).eq('status','available');
  for (const key of ['make','body','fuel'] as const) if (f[key]) query=query.eq(key,f[key]);
  if (f.year) query=query.gte('year',+f.year);
  if (f.trans==='unlisted') query=query.is('transmission',null);
  else if (f.trans) query=query.like('transmission',f.trans+'%');
  if (f.q) query=query.ilike('model','%'+f.q.replace(/[\\%_]/g,'\\$&')+'%');
  const budget = budgets[f.budget as keyof typeof budgets];
  if (budget) { query=query.gte('price_lakh',budget.min/100000); if (Number.isFinite(budget.max)) query=query.lt('price_lakh',budget.max/100000); }
  if (f.sort==='featured') query=query.order('featured',{ascending:false}).order('sort_order');
  else query=query.order(f.sort==='price'?'price_lakh':f.sort,{ascending:f.sort!=='year'});
  const result = await query.order('id').range((f.page-1)*PAGE_SIZE,f.page*PAGE_SIZE-1);
  if (result.error || !Array.isArray(result.data) || typeof result.count!=='number') throw new Error('Inventory query failed');
  const pages = Math.max(1,Math.ceil(result.count/PAGE_SIZE));
  if (f.page>pages) return readListing(client,origin,{...f,page:pages});
  const expected=Math.min(PAGE_SIZE,Math.max(0,result.count-(f.page-1)*PAGE_SIZE));
  if(result.data.length!==expected)throw new Error('Incomplete inventory page');
  const vehicles = result.data.map(row=>parseVehicle(row,origin));
  if (vehicles.some(c=>c.status!=='available')) throw new Error('Unexpected listing visibility');
  return { vehicles, total:result.count, page:f.page, pages };
}
