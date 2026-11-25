'use client';
import {useActionState,useState} from 'react';
import {saveVehicleAction,changeStatusAction,selectPhotosAction,removePhotoAction,saveNoteAction} from '@/lib/admin/actions';
import {uploadPhotoAction,publishPhotoAction} from '@/lib/admin/media';
import {transitions,type MutationState} from '@/lib/admin/validation';
import type {StaffVehicle,MediaAsset} from '@/lib/admin/types';
function Feedback({state}:{state:MutationState}){return <div role="status" aria-live="polite" className={state.error?'admin-error':''}>{state.error||state.message}{state.message&&state.id&&<> <a href={`/admin/inventory/${state.id}`}>Reload saved record</a></>}</div>;}
function Hidden({car}:{car:StaffVehicle}){return <><input type="hidden" name="id" value={car.id}/><input type="hidden" name="version" value={car.version}/></>;}
export function VehicleForm({car,canEdit,manager}:{car?:StaffVehicle;canEdit:boolean;manager:boolean}){
  const [state,action,pending]=useActionState(saveVehicleAction,{});
  const [values,setValues]=useState<Record<string,string>>(()=>Object.fromEntries(Object.entries({...car,id:car?.id??'',sort_order:car?.sort_order??100,location:car?.location??'Beleghata / Garden Lane, Kolkata',highlights:car?.highlights.join('\n')??''}).map(([key,value])=>[key,value==null?'':String(value)])));
  const [featured,setFeatured]=useState(car?.featured??false);
  const field=(key:string,label:string,required=true,type='text',maxLength=160,value?:string|number)=> <div className="field"><label htmlFor={`v-${key}`}>{label}{required?' *':''}</label><input id={`v-${key}`} name={key} type={type} readOnly={key==='id'&&!!car} required={required} maxLength={maxLength} value={values[key]??value??''} onChange={e=>setValues(old=>({...old,[key]:e.target.value}))}/></div>;
  return <form action={action} className="form"><fieldset disabled={!canEdit||pending||!!state.message} className="admin-fieldset"><legend>{car?'Edit vehicle specifications':'Create a draft vehicle'}</legend><input type="hidden" name="version" value={car?.version??0}/>
    <div className="form form--2">{field('id','Permanent URL / vehicle ID',true,'text',120,car?.id)}
      {car&&<p>ID is immutable. Do not rename it or create a duplicate vehicle to change a URL.</p>}
      {field('make','Manufacturer')}{field('model','Model')}{field('variant','Variant')}{field('year','Year as recorded',true,'text',4)}
      {field('km','Odometer (whole kilometres)',true,'text',8)}{field('price_lakh','Asking price in lakh (exact, up to 5 decimals)',true,'text',12)}
      {field('fuel','Fuel')}{field('body','Body type')}{field('transmission','Transmission — blank means unknown',false,'text',100)}
      {field('reg','Registration region — no full plate required')}{field('location','Vehicle location',true,'text',160,car?.location??'Beleghata / Garden Lane, Kolkata')}
      {field('price_note','Price note',false,'text',500)}{field('listing_url','Original source URL (HTTPS)',false,'url',2000)}
      {field('sort_order','Display order (0–999999)',true,'text',6,car?.sort_order??100)}
      <div className="field form__full"><label htmlFor="v-overview">Dealer overview (plain text)</label><textarea id="v-overview" name="overview" maxLength={6000} value={values.overview??''} onChange={e=>setValues(old=>({...old,overview:e.target.value}))}/></div>
      <div className="field form__full"><label htmlFor="v-highlights">Highlights — one per line, at most 12</label><textarea id="v-highlights" name="highlights" maxLength={2500} value={values.highlights??''} onChange={e=>setValues(old=>({...old,highlights:e.target.value}))}/></div>
      <label><input type="checkbox" name="featured" checked={featured} onChange={e=>setFeatured(e.target.checked)} disabled={!manager||car?.status!=='available'}/> Featured available vehicle</label>
    </div><p>Do not guess unknown transmission or history. Creation always saves an unfeatured draft; publication is separate. No hard-delete action is available.</p><button className="btn btn--solid" type="submit">{pending?'Saving…':car?'Save specifications':'Create draft'}</button>
  </fieldset><Feedback state={state}/></form>;
}
export function StatusForm({car}:{car:StaffVehicle}){
  const [state,action,pending]=useActionState(changeStatusAction,{});
  const [next,setNext]=useState(''),[reason,setReason]=useState('');
  return <form action={action} className="form"><Hidden car={car}/><fieldset className="admin-fieldset" disabled={pending||!!state.message}><legend>Availability / archive control</legend><div className="field"><label htmlFor="next-status">Next status</label><select id="next-status" name="next_status" required value={next} onChange={e=>setNext(e.target.value)}><option value="" disabled>Select a transition</option>{transitions[car.status].map(next=><option key={next} value={next}>{next==='available'&&car.status==='sold'?'available — explicit sale reversal':next==='draft'?'draft — restore for review':next}</option>)}</select></div>
    <div className="field"><label htmlFor="status-reason">Reason (3–500 characters; no customer contact information)</label><textarea id="status-reason" name="reason" value={reason} onChange={e=>setReason(e.target.value)} required minLength={3} maxLength={500}/></div><p>Mark sold only after dealership confirmation. Reversing sold is an explicit, logged correction, not a delete. Sold pages remain public; archived vehicles do not.</p><label><input type="checkbox" name="confirm_change" required/> I reviewed the current status and intend this availability change.</label><button className="btn btn--solid" type="submit">{pending?'Changing…':'Apply status change'}</button></fieldset><Feedback state={state}/></form>;
}
export function UploadForm({car,enabled}:{car:StaffVehicle;enabled:boolean}){
  const [state,action,pending]=useActionState(uploadPhotoAction,{});
  return <form action={action} className="form" encType="multipart/form-data"><Hidden car={car}/><fieldset className="admin-fieldset" disabled={!enabled||pending||!!state.message}><legend>Upload private photograph</legend><div className="field"><label htmlFor="photo-file">Still JPEG, PNG or WebP — at most 5 MiB, at least 320 × 240 px</label><input id="photo-file" name="photo" type="file" accept="image/jpeg,image/png,image/webp" required/></div><p>Photos are decoded and re-encoded with metadata stripped. Filenames are not retained. Upload only dealership-authorised vehicle photos—never identity, ownership or customer documents.</p><button className="btn btn--solid" type="submit">{pending?'Processing…':'Upload privately'}</button></fieldset><Feedback state={state}/></form>;
}
export function PublishPhotoForm({car,asset}:{car:StaffVehicle;asset:MediaAsset}){
  const [state,action,pending]=useActionState(publishPhotoAction,{});
  return <form action={action} className="form"><Hidden car={car}/><input type="hidden" name="asset_id" value={asset.id}/><fieldset className="admin-fieldset" disabled={pending||!!state.message||asset.state!=='ready'}><label><input type="checkbox" name="public_consent" required/> I reviewed this photograph and approve making it permanently public, even if this vehicle is still a draft. Removing/archive does not revoke cached public copies.</label><button className="btn btn--line" type="submit">{pending?'Publishing photo…':'Approve photo for public use'}</button></fieldset><Feedback state={state}/></form>;
}
export function RemovePhotoForm({car,asset}:{car:StaffVehicle;asset:MediaAsset}){
  const [state,action,pending]=useActionState(removePhotoAction,{});
  return <form action={action}><Hidden car={car}/><input type="hidden" name="asset_id" value={asset.id}/><label><input type="checkbox" name="confirm_remove" required disabled={car.media_order.includes(asset.id)||asset.state==='publishing'}/> Remove this unused photo from the library (not a public-cache purge)</label><button className="btn btn--line btn--sm" type="submit" disabled={pending||car.media_order.includes(asset.id)||asset.state==='publishing'||!!state.message}>Remove from library</button><Feedback state={state}/></form>;
}
export function PhotoOrderForm({car,assets}:{car:StaffVehicle;assets:MediaAsset[]}){
  const [order,setOrder]=useState(car.media_order);
  const [state,action,pending]=useActionState(selectPhotosAction,{});
  const eligible=assets.filter(a=>a.state==='ready'||a.state==='published');
  const move=(index:number,delta:number)=>setOrder(current=>{const next=[...current];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});
  return <form action={action}><Hidden car={car}/><input type="hidden" name="asset_ids" value={order.join(',')}/><fieldset className="admin-fieldset" disabled={pending||!!state.message}><legend>Photo selection & cover order</legend>
    <p>The first selected photo is the cover. This replaces legacy photo references only when you explicitly save. Public stock requires all selected photos to be approved/published.</p>
    {eligible.map(a=><label className="admin-photo-choice" key={a.id}><input type="checkbox" checked={order.includes(a.id)} onChange={e=>setOrder(old=>e.target.checked?[...old,a.id]:old.filter(id=>id!==a.id))}/>{a.id.slice(0,8)} · {a.state}</label>)}
    <ol>{order.map((id,i)=><li key={id}>{id.slice(0,8)}{i===0?' · cover':''} <button type="button" disabled={i===0} onClick={()=>move(i,-1)} aria-label={`Move photo ${i+1} earlier`}>↑</button> <button type="button" disabled={i===order.length-1} onClick={()=>move(i,1)} aria-label={`Move photo ${i+1} later`}>↓</button></li>)}</ol>
    <button className="btn btn--solid" type="submit">Save photo selection</button></fieldset><Feedback state={state}/></form>;
}

export function PrivateNoteForm({car,note}:{car:StaffVehicle;note:string}){
  const [state,action,pending]=useActionState(saveNoteAction,{}),[value,setValue]=useState(note);
  return <form action={action}><Hidden car={car}/><fieldset className="admin-fieldset" disabled={pending||!!state.message}><legend>Private operational note</legend><div className="field"><label htmlFor="private-note">Staff-only note (not published; avoid customer contact, documents and financial details)</label><textarea id="private-note" name="note" maxLength={6000} value={value} onChange={e=>setValue(e.target.value)}/></div><button type="submit" className="btn btn--line">Save private note</button></fieldset><Feedback state={state}/></form>;
}
