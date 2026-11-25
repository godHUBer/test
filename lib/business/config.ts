import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {absoluteOrigin} from '@/lib/inventory/model';
export function intakeConfig(){
 if(process.env.BUSINESS_INTAKE_ENABLED!=='true'||process.env.PUBLIC_INVENTORY_MODE!=='supabase')return null;
 const url=absoluteOrigin(process.env.PUBLIC_SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL),origin=absoluteOrigin(process.env.SITE_URL),key=process.env.INTAKE_SECRET_KEY,secret=process.env.INTAKE_HASH_SECRET;
 return url&&origin&&key&&secret&&secret.length>=32?{url,origin,key,secret}:null;
}
export function intakeClient(config:NonNullable<ReturnType<typeof intakeConfig>>){return createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(url,init)=>fetch(url,{...init,cache:'no-store',signal:AbortSignal.timeout(12000)})}});}
