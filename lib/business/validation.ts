import {validUuid} from '@/lib/auth/policy';
import {validSlug} from '@/lib/inventory/model';
export const CONSENT_VERSION='2026-11-business-v1';
export const leadStatuses=['new','contacted','in_progress','converted','closed','spam'] as const;
export type IntakeKind='general'|'car'|'sell'|'exchange'|'finance'|'insurance'|'viewing'|'service';
export interface IntakePayload {kind:IntakeKind;vehicle_id:string|null;service_id:string|null;contact_name:string;phone:string;email:string;message:string;seller_details:Record<string,string>;customer_vehicle:string;source:string;consent_version:string}
export interface BusinessState {error?:string;message?:string;reference?:string}
export function value(form:FormData,key:string,max=160){const v=form.get(key);if(typeof v!=='string'||v.length>max)throw new Error(`Invalid ${key}`);return v.trim();}
export function uuid(form:FormData,key:string){const id=value(form,key,36);if(!validUuid(id))throw new Error(`Invalid ${key}`);return id;}
export function integer(form:FormData,key:string,min=1,max=2147483647){const s=value(form,key,10);if(!/^\d+$/.test(s)||+s<min||+s>max)throw new Error(`Invalid ${key}`);return +s;}
export function parseIntake(form:FormData):IntakePayload{
 if(value(form,'website',100))throw new Error('Could not accept this request. Contact the showroom.');
 if(form.get('consent')!=='on')throw new Error('Please accept the contact/privacy notice.');
 const kind=value(form,'kind',20) as IntakeKind;if(!['general','car','sell','exchange','finance','insurance','viewing','service'].includes(kind))throw new Error('Invalid request type');
 const source=value(form,'source',20);if(!['contact','vehicle','sell','services'].includes(source))throw new Error('Invalid request source');
 const name=value(form,'contact_name',120),phone=value(form,'phone',30).replace(/[ ()-]/g,''),email=value(form,'email',254).toLowerCase(),message=value(form,'message',3000);
 if(name.length<2||!/^\+?[0-9]{7,15}$/.test(phone)||message.length<3||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('Add a name, valid contact number, question and valid optional email.');
 const vehicle=value(form,'vehicle_id',120);if(vehicle&&!validSlug(vehicle))throw new Error('Invalid vehicle reference');
 if(['car','viewing'].includes(kind)&&!vehicle)throw new Error('Select an available vehicle');
 const service=value(form,'service_id',36);if(service&&!validUuid(service))throw new Error('Invalid service reference');
 const customer=value(form,'customer_vehicle',300);if(kind==='service'&&(!service||customer.length<3))throw new Error('Select a service and describe your own vehicle.');
 const details:Record<string,string>={};
 if(['sell','exchange'].includes(kind)){
  for(const key of ['make','model','year','km','ownership','insurance','location'])details[key]=value(form,`seller_${key}`,key==='model'?160:120);
  if(!details.make||!details.model||!details.location)throw new Error('Add seller vehicle make, model and location');
  if(details.year&&(!/^\d{4}$/.test(details.year)||+details.year<1975||+details.year>new Date().getFullYear()+1))throw new Error('Invalid seller vehicle year');
  if(details.km&&!/^\d{1,8}$/.test(details.km))throw new Error('Use whole kilometres for the seller vehicle');
 }
 return{kind,vehicle_id:vehicle||null,service_id:kind==='service'?service:null,contact_name:name,phone,email,message,seller_details:details,customer_vehicle:kind==='service'?customer:'',source,consent_version:CONSENT_VERSION};
}
/** UI datetime-local values are explicitly Kolkata-local, never the browser/sandbox timezone. */
export function kolkataInstant(text:string):string|null{if(!text)return null;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text))throw new Error('Use a valid Kolkata date and time');const date=new Date(text+':00+05:30');if(!Number.isFinite(date.getTime())||localTime(date.toISOString())!==text)throw new Error('Invalid time');return date.toISOString();}
export function localTime(value:string|null){if(!value)return'';return new Date(new Date(value).getTime()+19800000).toISOString().slice(0,16);}
