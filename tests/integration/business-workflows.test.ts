import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const staff='40000000-0000-4000-8000-000000000001',other='40000000-0000-4000-8000-000000000002',manager='40000000-0000-4000-8000-000000000003',pending='40000000-0000-4000-8000-000000000004',serviceId='40000000-0000-4000-8000-000000000005';
test('Phase 5 intake, assigned leads, appointments, services and settings (isolated PostgreSQL)',async t=>{
 const db=new PGlite();try{
 await db.exec(readFileSync('supabase/tests/legacy-fixture.sql','utf8'));await db.exec("insert into cars(id,year,make,model,variant,km,fuel,body,price_lakh,reg) values('legacy',2020,'Test','Car','Base',100,'Petrol','SUV',5,'Test')");
 for(const f of readdirSync('supabase/migrations').sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 for(const[id,role]of [[staff,'staff'],[other,'staff'],[manager,'manager'],[pending,'pending']]){await db.query('insert into auth.users(id,email) values($1,$2)',[id,id+'@fixture.test']);await db.query('update admin_profiles set role=$2 where user_id=$1',[id,role]);}
 await db.exec("insert into brand_settings(id,name,phone_display,phone_href,email) values(1,'Fixture','Test','+919999999999','test@example.test')");
 async function as<T>(id:string|null,work:()=>Promise<T>,aal='aal2',age=0){await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal,amr:[{method:'totp',timestamp:Math.floor(Date.now()/1000)-age}]})]);await db.exec(`set role ${id?'authenticated':'anon'}`);try{return await work();}finally{await db.exec('reset role');}}
 const payload=(extra={})=>({kind:'general',vehicle_id:null,service_id:null,contact_name:'PRIVATE_NAME',phone:'+919999999999',email:'private@example.test',message:'PRIVATE_MESSAGE',seller_details:{},customer_vehicle:'',source:'contact',consent_version:'2026-11-business-v1',...extra});
 let contact=0;
 async function intake(extra={},key=randomUUID(),fingerprint='a'.repeat(64),hash?:string){await db.exec('set role service_role');try{return(await db.query<{reference:string}>('select accept_business_request($1,$2,$3::jsonb,$4,null) reference',[key,fingerprint,JSON.stringify(payload(extra)),hash??(++contact).toString(16).padStart(64,'0')])).rows[0].reference;}finally{await db.exec('reset role');}}
 const record=async(ref:string)=>(await db.query<{id:string;version:number}>('select id,version from business_requests where reference=$1',[ref])).rows[0];
 const update=async(id:string,v:number,who:string|null,status='contacted')=>db.query('select update_business_request($1,$2,$3,$4,now()-interval \'1 day\')',[id,v,status,who]);
 const start=new Date(Date.now()+86400000).toISOString(),end=new Date(Date.now()+90000000).toISOString();
 let lead='',serviceRequest='',appointment='';
 await t.test('private intake RPC denies anonymous/staff writes and private reads; catalogue publication is privileged',async()=>{
  for(const id of [null,staff,pending])await as(id,async()=>{await assert.rejects(db.query('select accept_business_request($1,$2,$3::jsonb,$4,null)',[randomUUID(),'a'.repeat(64),JSON.stringify(payload()),'b'.repeat(64)]));await assert.rejects(db.exec("insert into business_requests(kind) values('general')"));await assert.rejects(db.exec('truncate business_requests cascade'));if(!id)await assert.rejects(db.exec('select * from business_requests'));else assert.equal((await db.exec('select * from business_requests'))[0].rows.length,0);await assert.rejects(db.query("select save_service($1,0,'Oil service','Basic care',true,10)",[serviceId]));});
  await as(manager,()=>db.query("select save_service($1,0,'Oil service','Basic care',true,10)",[serviceId]));
  await as(null,async()=>assert.equal((await db.query('select * from service_catalogue')).rows.length,1));
 });
 await t.test('transactional references are idempotent; changed retries and invalid consent/links are rejected',async()=>{
  const key=randomUUID(),ref=await intake({kind:'viewing',vehicle_id:'legacy'},key);assert.equal(await intake({kind:'viewing',vehicle_id:'legacy'},key),ref);await assert.rejects(intake({},key,'c'.repeat(64)));
  for(const extra of [{consent_version:'old'},{source:'unknown'},{kind:'car',vehicle_id:'missing'},{kind:'sell'},{kind:'service',service_id:serviceId},{extra_field:'forged'}])await assert.rejects(intake(extra));
  lead=(await record(ref)).id;
  assert.equal((await db.query('select * from business_requests')).rows.length,1);
 });
 await t.test('staff only see assigned requests; managers assign, stale versions and reassignment forgery fail',async()=>{
  await as(staff,async()=>assert.equal((await db.query('select * from business_requests')).rows.length,0));
  await as(manager,()=>update(lead,1,staff));
  await as(staff,async()=>{assert.equal((await db.query('select * from business_requests')).rows.length,1);await assert.rejects(update(lead,1,staff));await assert.rejects(update(lead,2,other));await db.query("select add_request_note($1,2,'PRIVATE_NOTE')",[lead]);await assert.rejects(db.exec("update business_requests set status='closed'"));});
  await as(other,async()=>{assert.equal((await db.query('select * from business_requests')).rows.length,0);assert.equal((await db.query('select * from request_notes')).rows.length,0);await assert.rejects(db.query("select add_request_note($1,3,'forged')",[lead]));});
  const audit=JSON.stringify((await db.query('select * from business_events')).rows);for(const text of ['PRIVATE_NOTE','PRIVATE_NAME','PRIVATE_MESSAGE','private@example.test','+919999999999'])assert(!audit.includes(text));
 });
 await t.test('AAL1, expired privileged MFA and deactivated users cannot use business RPCs',async()=>{
  for(const[aal,age]of [['aal1',0],['aal2',700]] as const)await as(manager,async()=>{await assert.rejects(update(lead,3,staff));await assert.rejects(db.query("select save_service($1,1,'Forged','',true,10)",[serviceId]));assert.equal((await db.query('select * from business_requests')).rows.length,0);},aal,age);
  await db.query('update admin_profiles set is_active=false where user_id=$1',[staff]);await as(staff,async()=>{await assert.rejects(update(lead,3,staff));assert.equal((await db.query('select * from request_notes')).rows.length,0);});await db.query('update admin_profiles set is_active=true where user_id=$1',[staff]);
 });
 await t.test('confirmed viewings check staff and vehicle conflicts, transitions, active assignment and stale versions',async()=>{
  appointment=randomUUID();await as(staff,()=>db.query("select save_viewing($1,$2,3,0,'confirmed',$3,$4)",[appointment,lead,start,end]));
  await as(manager,async()=>{await assert.rejects(update(lead,3,other));await assert.rejects(db.query("select save_viewing($1,$2,3,null,'confirmed',$3,$4)",[randomUUID(),lead,start,end]));});
  const second=(await record(await intake({kind:'car',vehicle_id:'legacy'}))).id;await as(manager,()=>update(second,1,other));await as(other,async()=>{await assert.rejects(db.query("select save_viewing($1,$2,2,0,'confirmed',$3,$4)",[randomUUID(),second,start,end]));await assert.rejects(db.query("select save_viewing($1,$2,2,0,'completed',$3,$4)",[randomUUID(),second,start,end]));});
 });
 await t.test('customer-owned service requests create atomic jobs; cross-workflow staff conflicts and lifecycle hold',async()=>{
  serviceRequest=(await record(await intake({kind:'service',source:'services',service_id:serviceId,customer_vehicle:'PRIVATE_OWNED_VEHICLE'}))).id;
  const j=(await db.query<{id:string}>('select id from service_jobs where request_id=$1',[serviceRequest])).rows[0].id;
  await as(manager,()=>update(serviceRequest,1,staff));
  await as(staff,async()=>{await assert.rejects(db.query("select update_service_job($1,2,1,'scheduled',$2,$3)",[j,start,end]));await db.query("select save_viewing($1,$2,3,1,'cancelled',$3,$4)",[appointment,lead,start,end]);await db.query("select update_service_job($1,2,1,'scheduled',$2,$3)",[j,start,end]);await assert.rejects(db.query("select update_service_job($1,2,1,'in_progress',$2,$3)",[j,start,end]));await db.query("select update_service_job($1,2,2,'in_progress',$2,$3)",[j,start,end]);await db.query("select update_service_job($1,2,3,'completed',$2,$3)",[j,start,end]);});
  assert.equal((await db.query<{status:string}>('select status from service_jobs where id=$1',[j])).rows[0].status,'completed');
 });
 await t.test('contact rate counters rollback invalid attempts; unchanged idempotent retries do not consume limits',async()=>{
  const h='f'.repeat(64),key=randomUUID(),ref=await intake({},key,'a'.repeat(64),h);await intake({},randomUUID(),'a'.repeat(64),h);await intake({},randomUUID(),'a'.repeat(64),h);await assert.rejects(intake({},randomUUID(),'a'.repeat(64),h));assert.equal(await intake({},key,'a'.repeat(64),h),ref);assert.equal((await db.query<{count:number}>('select count from private.intake_limits where key=$1',['contact:'+h])).rows[0].count,3);
 });
 await t.test('network/global rate buckets are enforced and sold/inactive service contexts fail closed',async()=>{
  const requestCount=(await db.query('select id from business_requests')).rows.length;
  await db.query("insert into private.intake_limits(key,window_start,count) values($1,now(),10)",['network:'+'e'.repeat(64)]);
  await db.exec('set role service_role');try{await assert.rejects(db.query('select accept_business_request($1,$2,$3::jsonb,$4,$5)',[randomUUID(),'a'.repeat(64),JSON.stringify(payload()),'e'.repeat(64),'e'.repeat(64)]));}finally{await db.exec('reset role');}
  await db.exec("update private.intake_limits set count=100 where key='global'");await assert.rejects(intake());await db.exec("update private.intake_limits set count=0 where key='global'");
  await as(manager,async()=>{await db.query("select save_service($1,1,'Oil service','Basic care',false,10)",[serviceId]);});await assert.rejects(intake({kind:'service',source:'services',service_id:serviceId,customer_vehicle:'Owned car'}));await as(manager,()=>db.query("select save_service($1,2,'Oil service','Basic care',true,10)",[serviceId]));
  await db.exec('alter table cars disable trigger guard_car_write');await db.exec("update cars set status='sold' where id='legacy'");await db.exec('alter table cars enable trigger guard_car_write');await assert.rejects(intake({kind:'viewing',vehicle_id:'legacy'}));await as(staff,()=>assert.rejects(db.query("select save_viewing($1,$2,3,0,'confirmed',$3,$4)",[randomUUID(),lead,start,end])));
  assert.equal((await db.query('select id from business_requests')).rows.length,requestCount);
 });
 await t.test('audit failure rolls back the request mutation; settings allowlist/version and role boundaries hold',async()=>{
  await db.exec("create function private.fail_event() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$; create trigger fail_event before insert on business_events for each row execute function private.fail_event()");
  const requestsBefore=(await db.query('select id from business_requests')).rows.length,receiptsBefore=(await db.query('select key from private.intake_receipts')).rows.length;await assert.rejects(intake({kind:'service',source:'services',service_id:serviceId,customer_vehicle:'Rollback owned car'}));assert.equal((await db.query('select id from business_requests')).rows.length,requestsBefore);assert.equal((await db.query('select key from private.intake_receipts')).rows.length,receiptsBefore);
  const before=(await db.query<{version:number}>('select version from business_requests where id=$1',[lead])).rows[0].version;await as(staff,()=>assert.rejects(update(lead,before,staff)));assert.equal((await db.query<{version:number}>('select version from business_requests where id=$1',[lead])).rows[0].version,before);await db.exec('drop trigger fail_event on business_events');
  const settings={name:'Confirmed name',tagline:'',phone_display:'Test phone',phone_href:'+919999999999',email:'hello@example.test',address_short:'Street',address_city:'Kolkata',area:'City',map_url:'https://maps.example.test/',hours:'',services:['Care']};
  await as(staff,()=>assert.rejects(db.query('select save_business_settings(1,$1::jsonb)',[JSON.stringify(settings)])));
  await as(manager,async()=>{await assert.rejects(db.exec("update brand_settings set name='Direct forgery'"));await assert.rejects(db.query('select save_business_settings(1,$1::jsonb)',[JSON.stringify({...settings,verified_on:'today'})]));await db.query('select save_business_settings(1,$1::jsonb)',[JSON.stringify(settings)]);await assert.rejects(db.query('select save_business_settings(1,$1::jsonb)',[JSON.stringify(settings)]));const overview=(await db.query<{v:Record<string,number>}>('select business_overview() v')).rows[0].v;assert(overview.new_requests>0);assert.equal(overview.open_services,0);});
  await as(null,async()=>{const b=(await db.query<{name:string;hours:null}>('select name,hours from brand_settings')).rows[0];assert.equal(b.name,'Confirmed name');assert.equal(b.hours,null);});
 });
 }finally{await db.close();}
});
