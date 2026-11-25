import {lakhToRupees} from '@/lib/format';
import {validSlug,safeUrl} from '@/lib/inventory/model';
import {validUuid} from '@/lib/auth/policy';
export const statuses=['draft','available','reserved','sold','archived','hidden'] as const;
export type StockStatus=typeof statuses[number];
export const transitions:Record<StockStatus,StockStatus[]>={draft:['available','archived'],available:['reserved','sold','archived'],reserved:['available','sold','archived'],sold:['available','archived'],archived:['draft'],hidden:['draft']};
export interface VehicleFields {year:number;make:string;model:string;variant:string;km:number;fuel:string;transmission:string|null;body:string;price_lakh:string;price_note:string|null;reg:string;location:string;highlights:string[];overview:string;listing_url:string|null;featured:boolean;sort_order:number}
export interface MutationState {error?:string;message?:string;id?:string}
export function text(form:FormData,key:string,max=160){const value=form.get(key);if(typeof value!=='string'||value.length>max)throw new Error(`Invalid ${key}`);return value.trim();}
export function identity(form:FormData){const id=text(form,'id',120);if(!validSlug(id))throw new Error('Use a lowercase, hyphen-separated vehicle ID');return id;}
export function version(form:FormData,allowCreate=false){const value=text(form,'version',10);if(!/^[0-9]+$/.test(value)||!Number.isSafeInteger(+value)||+value<(allowCreate?0:1)||+value>2147483647)throw new Error('Invalid version. Reload the record.');return +value;}
export function parseFields(form:FormData):VehicleFields{
  const required=(key:string)=>{const value=text(form,key);if(!value)throw new Error(`${key} is required; do not guess an unknown vehicle identity`);return value;};
  const number=(key:string,max:number,min=0)=>{const value=text(form,key,10);if(!/^\d+$/.test(value)||!Number.isSafeInteger(+value)||+value<min||+value>max)throw new Error(`Invalid ${key}`);return +value;};
  const price=text(form,'price_lakh',12);if(!/^\d{1,5}(\.\d{1,5})?$/.test(price)||!lakhToRupees(price))throw new Error('Use a positive exact lakh amount with at most 5 decimals');
  const listing=text(form,'listing_url',2000);if(listing&&!safeUrl(listing))throw new Error('Source URL must use HTTPS without embedded credentials');
  const highlights=text(form,'highlights',2500).split('\n').map(s=>s.trim()).filter(Boolean);if(highlights.length>12||highlights.some(h=>h.length>200))throw new Error('Use at most 12 short highlight lines');
  return {year:number('year',new Date().getFullYear()+1,1980),km:number('km',99999999),make:required('make'),model:required('model'),variant:required('variant'),fuel:required('fuel'),body:required('body'),reg:required('reg'),location:required('location'),transmission:text(form,'transmission',100)||null,price_lakh:price,price_note:text(form,'price_note',500)||null,overview:text(form,'overview',6000),listing_url:listing||null,highlights,featured:form.get('featured')==='on',sort_order:number('sort_order',999999)};
}
export function mediaIds(form:FormData){const value=text(form,'asset_ids',1000);const ids=value?value.split(',').map(s=>s.trim()):[];if(ids.length>20||new Set(ids).size!==ids.length||ids.some(id=>!validUuid(id)))throw new Error('Choose at most 20 distinct registered photos');return ids;}
export function assetId(form:FormData){const id=text(form,'asset_id',36);if(!validUuid(id))throw new Error('Invalid asset');return id;}
export function statusChange(form:FormData){const next=text(form,'next_status',20);if(!statuses.includes(next as StockStatus))throw new Error('Invalid status');const reason=text(form,'reason',500);if(reason.length<3)throw new Error('Supply a reason of 3–500 characters');return {next,reason};}
