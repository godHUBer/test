'use server';
import {createClient} from '@supabase/supabase-js';
import {revalidatePath} from 'next/cache';
import {authConfig} from '@/lib/supabase/config';
import {inventorySession} from './session';
import {sanitiseImage,MAX_IMAGE_BYTES} from './images';
import {identity,version,assetId,type MutationState} from './validation';
import type {MediaAsset} from './types';
function broker(){const config=authConfig(),secret=process.env.MEDIA_STORAGE_SECRET_KEY;if(!config||!secret)return null;return createClient(config.url,secret,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
export async function uploadPhotoAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session)return{error:'Authorised inventory access required.'};
  const storage=broker();if(!storage)return{error:'The server-only media processor is not configured. No file uploaded.'};
  let pending:MediaAsset|null=null;let stage='validation';
  try{
    const id=identity(form),expected=version(form),file=form.get('photo');
    if(!(file instanceof File)||!file.size||file.size>MAX_IMAGE_BYTES)return{error:'Choose a still JPEG, PNG or WebP of at most 5 MiB.'};
    stage='image decoding';
    const processed=await sanitiseImage(Buffer.from(await file.arrayBuffer()));
    stage='upload reservation';
    const reserved=await session.client.rpc('prepare_vehicle_media',{car_id:id,expected_version:expected}).single<MediaAsset>();
    if(reserved.error||!reserved.data)return{error:'Upload reservation denied. Reload the vehicle and verify your permissions.'};
    pending=reserved.data as MediaAsset;
    stage='private storage upload';
    const result=await storage.storage.from('car-drafts').upload(pending.object_path,processed.data,{contentType:'image/webp',upsert:false,cacheControl:'0'});
    if(result.error)throw new Error('Private upload failed');
    stage='metadata confirmation';
    const completed=await storage.rpc('finish_vehicle_media',{asset_id:pending.id,byte_count:processed.data.length,pixel_width:processed.width,pixel_height:processed.height});
    if(completed.error)throw new Error('Upload metadata did not commit');
    revalidatePath(`/admin/inventory/${id}`);return{message:'Sanitised photo saved privately. Reload to select or review it. It is not public.',id};
  }catch{
    if(pending){const check=await session.client.from('vehicle_media').select('state').eq('id',pending.id).maybeSingle();if(!check.error&&check.data?.state==='pending')await storage.storage.from('car-drafts').remove([pending.object_path]);}
    return{error:`Photo upload did not complete (${stage}). Pending metadata may remain for reconciliation; reload before retrying. No publication was requested.`};
  }
}
export async function publishPhotoAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session||session.profile.role==='staff')return{error:'Manager/owner with MFA required.'};
  const storage=broker();if(!storage)return{error:'Media publication is not configured.'};
  if(form.get('public_consent')!=='on')return{error:'Confirm that this sanitised photograph may become permanently public.'};
  let pending:MediaAsset|null=null;let stage='publication reservation';
  try{
    const id=identity(form),expected=version(form),asset=assetId(form);
    const check=await session.client.from('vehicle_media').select('vehicle_id').eq('id',asset).maybeSingle();if(check.error||check.data?.vehicle_id!==id)return{error:'Asset does not belong to the selected vehicle or is unavailable.'};
    const result=await session.client.rpc('request_media_publication',{asset_id:asset,expected_version:expected}).single<MediaAsset>();
    if(result.error||!result.data)return{error:'Publication request denied. Reload, review state and verify MFA.'};
    pending=result.data as MediaAsset;
    if(pending.vehicle_id!==id)throw new Error('Vehicle mismatch');
    stage='private image download';
    const source=await storage.storage.from('car-drafts').download(pending.object_path);if(source.error||!source.data)throw new Error('Source unavailable');
    stage='publication image decoding';
    // Defence in depth: publishing re-decodes the private object, not just its metadata.
    const processed=await sanitiseImage(Buffer.from(await source.data.arrayBuffer()));
    stage='public image upload';
    const uploaded=await storage.storage.from('car-photos').upload(pending.public_path!,processed.data,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
    if(uploaded.error)throw new Error('Copy failed');
    stage='publication metadata confirmation';
    const complete=await storage.rpc('finish_media_publication',{asset_id:pending.id});if(complete.error)throw new Error('Publication commit failed');
    revalidatePath(`/admin/inventory/${id}`);return{message:'Photograph is public. Select it in the photo order and save before publishing the vehicle.',id};
  }catch{
    // Never remove a known committed publication on an ambiguous response. Operator reconciliation checks state first.
    if(pending){const check=await session.client.from('vehicle_media').select('state').eq('id',pending.id).maybeSingle();if(!check.error&&check.data?.state==='publishing'&&pending.public_path)await storage.storage.from('car-photos').remove([pending.public_path]);}
    return{error:`Publication was not confirmed (${stage}). The object may briefly be public. Do not retry blindly: ask an owner to reconcile the pending publication.`};
  }
}
