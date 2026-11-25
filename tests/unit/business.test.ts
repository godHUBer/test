import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIntake,kolkataInstant,localTime} from '../../lib/business/validation';
import {hash,signForm,validForm} from '../../lib/business/token';
function form(extra:Record<string,string>={}){const f=new FormData();for(const[k,v]of Object.entries({request_key:'40000000-0000-4000-8000-000000000001',kind:'general',source:'contact',vehicle_id:'',service_id:'',contact_name:'Test Person',phone:'+91 (98311) 89375',email:'TEST@EXAMPLE.TEST',message:'Please call me',website:'',consent:'on',customer_vehicle:'',...extra}))f.set(k,v);return f;}
test('business intake validates consent and private vehicle context without inventing success',()=>{
 const payload=parseIntake(form());assert.equal(payload.phone,'+919831189375');assert.equal(payload.email,'test@example.test');assert.equal(payload.vehicle_id,null);assert.equal(payload.consent_version,'2026-11-business-v1');
 for(const extra of [{consent:''},{website:'bot'},{kind:'other'},{phone:'letters'},{email:'bad-email'},{message:''},{kind:'viewing'},{kind:'service'},{kind:'sell'},{vehicle_id:'../no'},{contact_name:'X'}] as Record<string,string>[])assert.throws(()=>parseIntake(form(extra)));
 const sell=parseIntake(form({kind:'sell',source:'sell',seller_make:'Test',seller_model:'Owned',seller_location:'Kolkata',seller_year:'2020',seller_km:'12000',seller_ownership:'Second',seller_insurance:'Unknown'}));assert.equal(sell.seller_details.model,'Owned');assert.equal(sell.vehicle_id,null);
 const service=parseIntake(form({kind:'service',source:'services',service_id:'40000000-0000-4000-8000-000000000002',customer_vehicle:'My own Test hatchback'}));assert.equal(service.vehicle_id,null);assert.match(service.customer_vehicle,/own/);
});
test('intake form signature binds key/time, has minimum age and expires; hashes do not expose raw contact',()=>{
 const secret='local-test-only-secret-32-characters',key='40000000-0000-4000-8000-000000000001',now=1800000000000,issued=now-3000,signature=signForm(secret,key,issued);
 assert(validForm(secret,key,String(issued),signature,now));assert(!validForm(secret,key,String(now),signForm(secret,key,now),now));assert(!validForm(secret,key+'x',String(issued),signature,now));assert(!validForm(secret,key,String(issued),signature,now+7200001));assert(!validForm(secret,key,'invalid',signature,now));assert(!validForm(secret,key,String(issued),'a',now));assert.match(hash(secret,'+919831189375'),/^[a-f0-9]{64}$/);
});
test('schedule form conversion is explicitly Asia/Kolkata and round trips',()=>{assert.equal(kolkataInstant('2026-12-01T10:30'),'2026-12-01T05:00:00.000Z');assert.equal(localTime('2026-12-01T05:00:00Z'),'2026-12-01T10:30');assert.equal(kolkataInstant(''),null);assert.throws(()=>kolkataInstant('2026-12-01T10:30Z'));assert.throws(()=>kolkataInstant('2026-02-30T10:30'));});
