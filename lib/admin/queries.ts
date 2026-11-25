import 'server-only';
import {createClient} from '@supabase/supabase-js';
import {authConfig} from '@/lib/supabase/config';
import {validSlug} from '@/lib/inventory/model';
import {inventorySession} from './session';
import type {StaffVehicle,MediaAsset,StockEvent} from './types';
export const STAFF_CAR_COLUMNS='id,status,version,year,make,model,variant,km,fuel,transmission,body,price_lakh,price_note,reg,location,highlights,overview,listing_url,featured,sort_order,photo_stock,photos_gallery,media_order,created_at,updated_at';
export async function loadVehicleEditor(id:string){
  const session=await inventorySession();if(!session)return {state:'blocked'} as const;
  if(!validSlug(id))return {state:'missing'} as const;
  const result=await session.client.from('cars').select(STAFF_CAR_COLUMNS).eq('id',id).maybeSingle<StaffVehicle>();
  if(result.error)return {state:'error'} as const;if(!result.data)return {state:'missing'} as const;
  const media=await session.client.from('vehicle_media').select('id,vehicle_id,uploaded_by,object_path,public_path,state,bytes,width,height,created_at').eq('vehicle_id',id).neq('state','removed').order('created_at').limit(21).returns<MediaAsset[]>();
  const events=await session.client.from('vehicle_stock_events').select('id,vehicle_id,actor_id,event_type,from_status,to_status,reason,at').eq('vehicle_id',id).order('at',{ascending:false}).limit(50).returns<StockEvent[]>();
  const note=await session.client.from('vehicle_internal_notes').select('note').eq('vehicle_id',id).maybeSingle<{note:string}>();
  if(media.error||events.error||note.error)return{state:'error'} as const;
  const config=authConfig(),secret=process.env.MEDIA_STORAGE_SECRET_KEY;
  const storage=config&&secret?createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false}}):null;
  const urls:Record<string,string>={};
  if(storage){
    // Row selection above independently authorises every signed URL; never accept a caller-supplied object path.
    for(const asset of media.data??[]){
      if(!['ready','published'].includes(asset.state))continue;
      const signed=await storage.storage.from('car-drafts').createSignedUrl(asset.object_path,60);
      if(!signed.error&&signed.data)urls[asset.id]=signed.data.signedUrl;
    }
  }
  return{state:'ready',session,car:result.data,media:media.data??[],events:events.data??[],urls,mediaConfigured:!!storage,note:note.data?.note??''} as const;
}
