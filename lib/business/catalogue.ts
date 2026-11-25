import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {inventoryConfig} from '@/lib/inventory/config';
import type {Service} from './types';
export async function publicServices():Promise<Service[]|null>{const config=inventoryConfig();if(config.mode!=='supabase')return null;try{const result=await createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(8000)})}}).from('service_catalogue').select('id,name,description,active,sort_order,version').eq('active',true).order('sort_order').order('id').limit(100);return result.error?null:result.data as Service[];}catch{return null;}}
