import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Local synthetic identities only. Never create test users in the connected project.
const owner = '10000000-0000-4000-8000-000000000001';
const manager = '10000000-0000-4000-8000-000000000002';
const staff = '10000000-0000-4000-8000-000000000003';
const editor = '10000000-0000-4000-8000-000000000004';
const pending = '10000000-0000-4000-8000-000000000005';
const secondOwner = '10000000-0000-4000-8000-000000000006';
const legacyCar = `insert into public.cars(id,status,year,make,model,variant,km,fuel,body,price_lakh,reg,photo_stock) values('legacy','available',2020,'Test','Car','Base',100,'Petrol','SUV',8.55,'Test region','/assets/img/stock/test.jpg')`;

test('actual PostgreSQL migration, privileges, RLS and trigger invariants (local WASM engine)', async t => {
  const db = new PGlite();
  await db.exec(readFileSync('supabase/tests/legacy-fixture.sql', 'utf8'));
  await db.exec(legacyCar);
  await db.exec(readFileSync('supabase/migrations/20261124180000_harden_existing_admin_security.sql', 'utf8'));
  for (const [id, role] of [[owner,'owner'],[manager,'manager'],[staff,'staff'],[editor,'editor'],[pending,'pending'],[secondOwner,'pending']]) {
    await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${role}@example.test`]);
    await db.query('update public.admin_profiles set role=$2 where user_id=$1', [id, role]);
  }
  async function as<T>(id: string | null, aal: 'aal1' | 'aal2', work: () => Promise<T>, ageSeconds = 0) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: id, aal, amr: [{ method: 'totp', timestamp: Math.floor(Date.now()/1000)-ageSeconds }] })]);
    await db.exec(id ? 'set role authenticated' : 'set role anon');
    try { return await work(); } finally { await db.exec('reset role'); }
  }
  await t.test('migration preserves legacy numeric price/status and uses draft defaults only for new rows', async () => {
    const result = await db.query<{price: string; status: string}>('select price_lakh::text as price,status from cars where id=\'legacy\'');
    assert.equal(result.rows[0].price, '8.55'); assert.equal(result.rows[0].status, 'available');
  });
  await t.test('anonymous direct calls cannot mutate inventory, read profiles or forge/truncate audit history', async () => {
    await as(null,'aal1',async () => {
      assert.equal((await db.query('select id from cars')).rows.length,1);
      for (const sql of ["update cars set price_lakh=1", 'select * from admin_profiles', 'select * from activity_log', 'truncate activity_log', "select record_auth_event('auth.login_failed','spoof@example.test')", "select set_staff_access('10000000-0000-4000-8000-000000000003','owner',true)"]) await assert.rejects(db.exec(sql));
    });
  });
  await t.test('legacy editor and pending users have no operational permissions', async () => {
    for (const id of [editor,pending]) await as(id,'aal2',async () => {
      assert.equal((await db.query<{ok:boolean}>('select is_admin() as ok')).rows[0].ok,false);
      assert.equal((await db.query('select user_id from admin_profiles')).rows.length,1);
      assert.equal((await db.query("update cars set price_lakh=2 where id='legacy' returning id")).rows.length,0);
      await assert.rejects(db.exec('truncate cars'));
    });
  });
  await t.test('owner and manager aal1 sessions cannot exercise elevated capabilities', async () => {
    for (const id of [owner,manager]) await as(id,'aal1',async () => {
      assert.equal((await db.query<{ok:boolean}>('select is_admin() as ok')).rows[0].ok,false);
      await assert.rejects(db.query('select set_car_status($1,$2,$3,$4)', ['legacy','sold','Test sale',1]));
    });
  });
  await t.test('staff can create drafts, but cannot publish, edit live cars, escalate or delete', async () => {
    await as(staff,'aal1',async () => {
      await db.exec("insert into cars(id,year,make,model,variant,km,fuel,body,price_lakh,reg) values('draft-one',2020,'Test','Draft','Base',0,'Petrol','SUV',1,'Test')");
      assert.equal((await db.query("update cars set km=12 where id='draft-one' returning version")).rows.length,1);
      assert.equal((await db.query("update cars set km=12 where id='legacy' returning id")).rows.length,0);
      await assert.rejects(db.exec("update cars set status='available' where id='draft-one'"));
      await assert.rejects(db.exec("update admin_profiles set role='owner' where user_id=auth.uid()"));
      await assert.rejects(db.exec("delete from cars where id='draft-one'"));
      await assert.rejects(db.exec("insert into activity_log(action,summary) values('forged','fake')"));
      await assert.rejects(db.exec('truncate activity_log'));
    });
  });
  await t.test('manager status RPC validates reasons/version, records actor and hides sold from active query', async () => {
    await as(manager,'aal2',async () => {
      await assert.rejects(db.exec("update cars set status='sold' where id='legacy'"));
      await assert.rejects(db.query('select set_car_status($1,$2,$3,$4)', ['legacy','sold','',1]));
      await db.query('select set_car_status($1,$2,$3,$4)', ['legacy','sold','Confirmed test sale',1]);
      await assert.rejects(db.query('select set_car_status($1,$2,$3,$4)', ['legacy','available','Correction test',1]));
    });
    const events = await db.query<{actor_id:string}>('select actor_id from vehicle_stock_events where vehicle_id=\'legacy\'');
    assert.equal(events.rows[0].actor_id, manager);
    await as(null,'aal1',async () => {
      assert.equal((await db.query("select id from cars where status='available'")).rows.length,0);
      assert.equal((await db.query("select id from cars where status='sold'")).rows.length,1);
      assert.equal((await db.query("select id from cars where id='draft-one'")).rows.length,0);
      await assert.rejects(db.exec('select * from vehicle_stock_events'));
    });
  });
  await t.test('owner changes require fresh MFA; last owner protected; deactivation affects existing tokens', async () => {
    await as(owner,'aal2',async () => {
      await assert.rejects(db.query('select set_staff_access($1,$2,$3)',[owner,'staff',true]));
      await assert.rejects(db.query('select set_staff_access($1,$2,$3)',[owner,'owner',false]));
      await db.query('select set_staff_access($1,$2,$3)',[secondOwner,'owner',true]);
      await db.query('select set_staff_access($1,$2,$3)',[manager,'manager',false]);
    });
    await as(owner,'aal2',async () => {
      await assert.rejects(db.query('select set_staff_access($1,$2,$3)',[staff,'manager',true]));
    }, 1200);
    await as(manager,'aal2',async () => {
      assert.equal((await db.query<{ok:boolean}>('select is_admin() as ok')).rows[0].ok,false);
    });
  });
  await t.test('audit changes redact emails and text; audit failure rolls back business writes', async () => {
    const logs = await db.query<{changes:unknown}>('select changes from activity_log');
    assert.ok(logs.rows.every(r => !JSON.stringify(r.changes).includes('@')));
    await db.exec("create function private.fail_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$; create trigger fail_audit before insert on activity_log for each row execute function private.fail_audit()");
    await as(staff,'aal1',async () => { await assert.rejects(db.exec("update cars set km=99 where id='draft-one'")); });
    assert.equal((await db.query<{km:number}>("select km from cars where id='draft-one'")).rows[0].km,12);
    await db.exec('drop trigger fail_audit on activity_log');
  });
  await t.test('private media uses role and path ownership; legacy public bucket becomes read-only', async () => {
    await as(staff,'aal1',async () => {
      await db.query("insert into storage.objects(bucket_id,name) values('car-drafts',$1)",[`${staff}/photo.jpg`]);
      await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('car-drafts',$1)",[`${owner}/forged.jpg`]));
      await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('car-photos','bypass.jpg')"));
    });
    await as(pending,'aal1',async () => { assert.equal((await db.query("select * from storage.objects where bucket_id='car-drafts'")).rows.length,0); });
    await as(null,'aal1',async () => { assert.equal((await db.query("select * from storage.objects where bucket_id='car-drafts'")).rows.length,0); });
  });
  await db.close();
});


test('unknown policy drift aborts before schema changes', async () => {
  const db = new PGlite();
  try {
    await db.exec(readFileSync('supabase/tests/legacy-fixture.sql', 'utf8'));
    await db.exec('create policy "admins manage cars" on public.admin_profiles for select to authenticated using(true)');
    await assert.rejects(db.exec(readFileSync('supabase/migrations/20261124180000_harden_existing_admin_security.sql', 'utf8')), /Unexpected policies/);
    assert.equal((await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='admin_profiles' and column_name='is_active'")).rows.length,0);
  } finally { await db.close(); }
});
