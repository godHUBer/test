'use server';
import {revalidatePath} from 'next/cache';
import {inventorySession} from './session';
import {parseFields,identity,version,statusChange,mediaIds,assetId,text,type MutationState} from './validation';
function invalidate(id:string){for(const path of ['/','/inventory','/contact','/showroom','/about',`/cars/${id}`,'/admin','/admin/inventory',`/admin/inventory/${id}`,`/admin/inventory/${id}/preview`,'/admin/logs','/sitemap.xml'])revalidatePath(path);}
function databaseError(error:{code?:string}){return error.code==='40001'?'This vehicle changed. Reload and compare before retrying; your unsaved form values remain here.':error.code==='23505'?'That vehicle ID already exists. Open it or choose a different ID.':'The database rejected the change. Check role/MFA, status, required fields and current version. No success is claimed.';}
export async function saveVehicleAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session)return {error:'Inventory is unavailable until authorised configuration and migrations are active.'};
  try{const id=identity(form),expected=version(form,true),fields=parseFields(form);const result=await session.client.rpc('save_vehicle',{car_id:id,expected_version:expected,fields});if(result.error)return{error:databaseError(result.error)};invalidate(id);return{message:`Saved ${id}. Reload the editor before another change.`,id};}catch(error){return{error:error instanceof Error?error.message:'Invalid input'};}
}
export async function changeStatusAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session||session.profile.role==='staff')return{error:'An active manager/owner with MFA is required.'};
  if(form.get('confirm_change')!=='on')return{error:'Confirm the availability change explicitly.'};
  try{const id=identity(form),expected=version(form),{next,reason}=statusChange(form);const result=await session.client.rpc('set_car_status',{car_id:id,next_status:next,reason,expected_version:expected});if(result.error)return{error:databaseError(result.error)};invalidate(id);return{message:`Status changed to ${next}. Reload the editor.`,id};}catch(error){return{error:error instanceof Error?error.message:'Invalid status request'};}
}
export async function selectPhotosAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session)return{error:'Authorised inventory access required.'};
  try{const id=identity(form),expected=version(form),ids=mediaIds(form);const result=await session.client.rpc('set_vehicle_photos',{car_id:id,expected_version:expected,asset_ids:ids});if(result.error)return{error:databaseError(result.error)};invalidate(id);return{message:'Photo selection saved. First selected photo is the cover. Reload the editor.',id};}catch(error){return{error:error instanceof Error?error.message:'Invalid photo selection'};}
}
export async function removePhotoAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session)return{error:'Authorised inventory access required.'};
  if(form.get('confirm_remove')!=='on')return{error:'Confirm removal explicitly.'};
  try{const id=identity(form),asset=assetId(form),expected=version(form);const check=await session.client.from('vehicle_media').select('vehicle_id').eq('id',asset).maybeSingle();if(check.error||check.data?.vehicle_id!==id)return{error:'Asset does not belong to the selected vehicle or is unavailable.'};const result=await session.client.rpc('remove_vehicle_media',{asset_id:asset,expected_version:expected});if(result.error)return{error:'Could not remove the asset. It may still be selected, in flight or outside your permissions. Reload and review.'};invalidate(id);return{message:'Asset removed from the library. Published bytes are retained for existing links/history.',id};}catch(error){return{error:error instanceof Error?error.message:'Invalid asset'};}
}

export async function saveNoteAction(_state:MutationState,form:FormData):Promise<MutationState>{
  const session=await inventorySession();if(!session)return{error:'Authorised inventory access required.'};
  try{const id=identity(form),expected=version(form),note=text(form,'note',6000);const result=await session.client.rpc('save_vehicle_note',{car_id:id,expected_version:expected,note_text:note});if(result.error)return{error:databaseError(result.error)};invalidate(id);return{message:'Private operational note saved. Reload the record.',id};}catch(error){return{error:error instanceof Error?error.message:'Invalid note'};}
}
