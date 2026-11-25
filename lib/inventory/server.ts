import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { snapshotBrand, snapshotVehicles, validSlug, type Brand, type Vehicle } from './model';
import { inventoryConfig } from './config';
import { readAvailable, readBrand, readListing, readVehicle } from './repository';
import { pageOf, type Filters } from './query';
export interface PublicSite { mode:'snapshot'|'supabase'|'error'; brand:Brand; available:Vehicle[] }
function publicClient(config: {url:string;key:string}) {
  return createClient(config.url,config.key,{ auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{ fetch:(input,init)=>fetch(input,{...init,cache:'no-store',signal:init?.signal ? AbortSignal.any([init.signal,AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000)}) },
  });
}
export const loadPublicSite=cache(async ():Promise<PublicSite>=>{
  const config=inventoryConfig();
  if (config.mode==='snapshot') return {mode:'snapshot',brand:snapshotBrand,available:snapshotVehicles};
  if (config.mode==='error') return {mode:'error',brand:snapshotBrand,available:[]};
  try {
    // A distinct anonymous client: staff-session cookies/privileged keys are never used here.
    const client=publicClient(config);
    const [brand,available]=await Promise.all([readBrand(client),readAvailable(client,config.url)]);
    return {mode:'supabase',brand,available};
  } catch { return {mode:'error',brand:snapshotBrand,available:[]}; }
});
const cachedListing=cache(async(site:PublicSite,key:string)=>{
  const filters=JSON.parse(key) as Filters;
  if (site.mode==='error') return null;
  if (site.mode==='snapshot') return pageOf(site.available,filters);
  const config=inventoryConfig();
  if(config.mode!=='supabase') return null;
  try { return await readListing(publicClient(config),config.url,filters); } catch { return null; }
});
export function loadListing(site:PublicSite,filters:Filters){return cachedListing(site,JSON.stringify(filters));}
/** All public vehicle IDs (any published status) for static prerendering. */
export const loadAllVehicleIds=cache(async ():Promise<string[]>=>{
  const config=inventoryConfig();
  if(config.mode==='error')return [];
  if(config.mode==='snapshot')return snapshotVehicles.map(c=>c.id);
  try{
    const client=publicClient(config);
    const result=await client.from('cars').select('id').in('status',['available','reserved','sold']);
    if(result.error||!Array.isArray(result.data))return [];
    return result.data.map((row)=>String(row.id)).filter((id)=>validSlug(id));
  }catch{return [];}
});
export const loadPublicVehicle=cache(async (id:string):Promise<{state:'found';vehicle:Vehicle}|{state:'missing'}|{state:'error'}>=>{
  if(!validSlug(id)) return {state:'missing'};
  const config=inventoryConfig();
  if(config.mode==='error') return {state:'error'};
  if(config.mode==='snapshot') {
    const vehicle=snapshotVehicles.find(c=>c.id===id);
    return vehicle?{state:'found',vehicle}:{state:'missing'};
  }
  try { const vehicle=await readVehicle(publicClient(config),config.url,id); return vehicle?{state:'found',vehicle}:{state:'missing'}; }
  catch { return {state:'error'}; }
});
