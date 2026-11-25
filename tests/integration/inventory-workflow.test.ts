import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const staff='20000000-0000-4000-8000-000000000001',manager='20000000-0000-4000-8000-000000000002',owner='20000000-0000-4000-8000-000000000003',pending='20000000-0000-4000-8000-000000000004';
const fields={year:2020,make:'Test',model:'Car',variant:'Base',km:12000,fuel:'Petrol',transmission:null,body:'SUV',price_lakh:'1.23456',price_note:null,reg:'Test region',location:'Test location',highlights:['Dealer note'],overview:'Plain <script>not markup</script>',listing_url:null,featured:false,sort_order:100};
test('Phase 4 RPC-only inventory, photo lifecycle and workflow permissions (isolated PostgreSQL)',async t=>{
 const db=new PGlite();
 try{
  await db.exec(readFileSync('supabase/tests/legacy-fixture.sql','utf8'));
  await db.exec("insert into cars(id,year,make,model,variant,km,fuel,body,price_lakh,reg,photo_stock) values('legacy',2020,'Legacy','Car','Base',100,'Petrol','SUV',8.55,'Test','/assets/img/stock/creta-2018.jpg')");
  await db.exec("insert into cars select 'legacy-two',sort_order,featured,status,year,make,model,variant,km,fuel,transmission,body,price_lakh,price_note,reg,location,highlights,listing_url,overview,photo_stock,photos_gallery,created_at,updated_at from cars where id='legacy'");
  await db.exec(readFileSync('supabase/migrations/20261124180000_harden_existing_admin_security.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261124210000_staff_inventory_workflow.sql','utf8'));
  for(const [id,role] of [[staff,'staff'],[manager,'manager'],[owner,'owner'],[pending,'pending']]){await db.query('insert into auth.users(id,email) values($1,$2)',[id,role+'@example.test']);await db.query('update admin_profiles set role=$2 where user_id=$1',[id,role]);}
  async function as<T>(id:string|null,aal:string,work:()=>Promise<T>){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,aal})]);await db.exec(`set role ${id?'authenticated':'anon'}`);try{return await work();}finally{await db.exec('reset role');}}
  async function service<T>(work:()=>Promise<T>){await db.exec('set role service_role');try{return await work();}finally{await db.exec('reset role');}}
  const currentVersion=async()=> (await db.query<{version:number}>("select version from cars where id='test-car'")).rows[0].version;
  const save=async(id:string,v:number,override={})=>db.query('select save_vehicle($1,$2,$3::jsonb)',[id,v,JSON.stringify({...fields,...override})]);
  let asset='';
  await t.test('legacy price/status/media are preserved and anonymous/pending access stays denied',async()=>{
   const row=(await db.query<{price_lakh:string;status:string;version:number;photo_stock:string}>("select price_lakh::text,status,version,photo_stock from cars where id='legacy'")).rows[0];
   assert.equal(row.price_lakh,'8.55');assert.equal(row.status,'available');assert.equal(row.version,1);assert.match(row.photo_stock,/creta-2018/);
   for(const id of [null,pending])await as(id,'aal2',async()=>{await assert.rejects(save('forged',0));if(id)assert.equal((await db.query('select * from vehicle_media')).rows.length,0);else await assert.rejects(db.exec('select * from vehicle_media'));await assert.rejects(db.exec('select inventory_overview()'));});
  });
  await t.test('staff create exact-price drafts; whitelist, version and direct-write boundaries hold',async()=>{
   await as(staff,'aal1',async()=>{
    await save('test-car',0);await assert.rejects(save('test-car',0));
    await assert.rejects(save('forged',0,{status:'available'}));await assert.rejects(save('forged',0,{photo_stock:'https://evil.test/a.jpg'}));
    await assert.rejects(save('forged',0,{price_lakh:'1.234567'}));await assert.rejects(save('forged',0,{year:3000}));
    await assert.rejects(db.exec("update cars set price_lakh=1 where id='test-car'"));await assert.rejects(db.exec("insert into cars(id) values('forged')"));await assert.rejects(db.exec('truncate cars'));
    await save('test-car',1,{km:12001});await assert.rejects(save('test-car',1,{km:12002}));await assert.rejects(save('test-car',2,{featured:true}));
   });
   assert.equal(await currentVersion(),2);assert.equal((await db.query<{price:string}>("select price_lakh::text price from cars where id='test-car'")).rows[0].price,'1.23456');
   assert.equal((await db.query("select * from vehicle_stock_events where vehicle_id='test-car'")).rows.length,1);
  });
  await t.test('staff cannot publish; elevated AAL1 sessions cannot edit or change status',async()=>{
   await as(staff,'aal1',async()=>{await assert.rejects(db.query('select set_car_status($1,$2,$3,$4)',['test-car','available','Reviewed draft',2]));});
   await as(manager,'aal1',async()=>{await assert.rejects(save('test-car',2));await assert.rejects(db.exec("select prepare_vehicle_media('test-car',2)"));});
   await as(manager,'aal2',async()=>{await assert.rejects(db.exec("select set_car_status('test-car','available','Complete review',2)"));});
  });
  await t.test('private uploads use owned unpredictable paths; browser writes and fake completion are denied',async()=>{
   await as(staff,'aal1',async()=>{
    const result=await db.query<{m:{id:string;object_path:string}}>("select to_jsonb(prepare_vehicle_media('test-car',2)) m");asset=result.rows[0].m.id;assert.match(result.rows[0].m.object_path,new RegExp('^'+staff+'/[0-9a-f-]+\\.webp$'));
    await assert.rejects(db.query('select finish_vehicle_media($1,1000,800,600)',[asset]));
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('car-drafts',$1)",[staff+'/bypass.jpg']));
    await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('car-photos',$1)",['bypass.jpg']));
   });
   await service(()=>db.query('select finish_vehicle_media($1,1000,800,600)',[asset]));
   await as(staff,'aal1',async()=>{await db.query('select set_vehicle_photos($1,$2,$3::uuid[])',['test-car',2,[asset]]);});
   assert.equal(await currentVersion(),3);assert.equal((await db.query<{photo_stock:null}>("select photo_stock from cars where id='test-car'")).rows[0].photo_stock,null);
   await as(null,'aal1',async()=>{assert.equal((await db.query("select id from cars where id='test-car'")).rows.length,0);});
  });
  await t.test('manager approves photo publication, selected cover is versioned and publish creates public availability',async()=>{
   await as(staff,'aal1',async()=>{await assert.rejects(db.query('select request_media_publication($1,3)',[asset]));});
   await as(manager,'aal2',async()=>{await db.query('select request_media_publication($1,3)',[asset]);await assert.rejects(db.query('select finish_media_publication($1)',[asset]));});
   await service(()=>db.query('select finish_media_publication($1)',[asset]));
   await as(manager,'aal2',async()=>{await db.query('select set_vehicle_photos($1,3,$2::uuid[])',['test-car',[asset]]);await db.exec("select set_car_status('test-car','available','Reviewed vehicle and approved photos',4)");});
   assert.equal(await currentVersion(),5);
   await as(null,'aal1',async()=>{const row=(await db.query<{photo_stock:string}>("select photo_stock from cars where id='test-car'")).rows[0];assert.match(row.photo_stock,/^processed\/[a-f0-9-]+\.webp$/);await assert.rejects(db.exec('select * from vehicle_media'));});
  });
  await t.test('live edits are manager-only; reserve/sale/reversal/archive/restore preserve history and stale changes fail',async()=>{
   await as(staff,'aal1',async()=>{await assert.rejects(save('test-car',5));});
   await as(manager,'aal2',async()=>{
    await save('test-car',5,{featured:true});
    await db.exec("select set_car_status('test-car','reserved','Customer hold confirmed',6)");
    assert.equal((await db.query<{featured:boolean}>("select featured from cars where id='test-car'")).rows[0].featured,false);
    await assert.rejects(db.exec("select set_car_status('test-car','sold','Confirmed sale',6)"));
    await db.exec("select set_car_status('test-car','sold','Confirmed sale',7)");
    await db.exec("select set_car_status('test-car','available','Sale reversal approved',8)");
    await db.exec("select set_car_status('test-car','archived','Withdraw from stock',9)");
    await db.exec("select set_car_status('test-car','draft','Restore for fresh review',10)");
    await assert.rejects(db.exec("select set_car_status('test-car','sold','Skip publication',11)"));
   });
   assert.equal(await currentVersion(),11);
   const events=await db.query<{actor_id:string;reason:string;to_status:string}>("select actor_id,reason,to_status from vehicle_stock_events where vehicle_id='test-car' and event_type='status' order by id");
   assert.deepEqual(events.rows.map(e=>e.to_status),['available','reserved','sold','available','archived','draft']);assert.ok(events.rows.every(e=>e.actor_id===manager&&e.reason.length>3));
  });
  await t.test('photo removal respects selection and cross-vehicle identities',async()=>{
   await as(manager,'aal2',async()=>{
    await assert.rejects(db.query('select remove_vehicle_media($1,11)',[asset]));await save('other-car',0);
    await assert.rejects(db.query('select set_vehicle_photos($1,1,$2::uuid[])',['other-car',[asset]]));
    await db.query('select set_vehicle_photos($1,11,$2::uuid[])',['test-car',[]]);await db.query('select remove_vehicle_media($1,12)',[asset]);
   });
   assert.equal((await db.query<{state:string}>('select state from vehicle_media where id=$1',[asset])).rows[0].state,'removed');
  });
  await t.test('private notes stay separate/redacted; featuring a new choice clears the previous one',async()=>{
   await as(staff,'aal1',async()=>{await db.query('select save_vehicle_note($1,1,$2)',['other-car','PRIVATE_NOTE_CANARY']);await assert.rejects(db.exec("update vehicle_internal_notes set note='forged'"));});
   await as(null,'aal1',async()=>{await assert.rejects(db.exec('select note from vehicle_internal_notes'));assert.ok(!(await db.query('select * from cars')).rows.some(row=>JSON.stringify(row).includes('PRIVATE_NOTE_CANARY')));});
   await as(manager,'aal2',async()=>{assert.equal((await db.query<{note:string}>("select note from vehicle_internal_notes where vehicle_id='other-car'")).rows[0].note,'PRIVATE_NOTE_CANARY');await save('legacy',1,{featured:true});await save('legacy-two',1,{featured:true});});
   assert.equal((await db.query('select id from cars where featured')).rows.length,1);
   const logs=await db.query('select changes from activity_log');assert.ok(logs.rows.every(row=>!JSON.stringify(row).includes('PRIVATE_NOTE_CANARY')));
  });
  await t.test('upload reservation limits are enforced and completion rejects a deactivated uploader',async()=>{
   let pendingAsset='';
   await as(manager,'aal2',async()=>{for(let i=0;i<10;i++){const row=await db.query<{m:{id:string}}>("select to_jsonb(prepare_vehicle_media('other-car',2)) m");pendingAsset=row.rows[0].m.id;}await assert.rejects(db.exec("select prepare_vehicle_media('other-car',2)"));});
   await db.query('update admin_profiles set is_active=false where user_id=$1',[manager]);
   await service(async()=>{await assert.rejects(db.query('select finish_vehicle_media($1,1000,800,600)',[pendingAsset]));});
   await db.query('update admin_profiles set is_active=true where user_id=$1',[manager]);
  });
  await t.test('audit failure rolls back edits and deactivation blocks old tokens',async()=>{
   await db.exec("create function private.break_audit() returns trigger language plpgsql as $$begin raise exception 'audit unavailable'; end$$;create trigger break_audit before insert on activity_log for each row execute function private.break_audit()");
   await as(staff,'aal1',async()=>{await assert.rejects(save('test-car',12,{km:12345}));});assert.equal(await currentVersion(),12);
   await db.exec('drop trigger break_audit on activity_log');await db.query('update admin_profiles set is_active=false where user_id=$1',[staff]);
   await as(staff,'aal1',async()=>{await assert.rejects(save('test-car',12));await assert.rejects(db.exec("select prepare_vehicle_media('test-car',12)"));assert.equal((await db.query('select id from vehicle_media')).rows.length,0);});
  });
 }finally{await db.close();}
});
