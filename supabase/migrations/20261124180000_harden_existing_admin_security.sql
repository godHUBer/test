-- REVIEWED LOCALLY ONLY. Requires the six existing migrations; not a fresh-project baseline.
-- Apply transactionally after backup, drift review and explicit remote approval.
-- Preserve existing IDs, prices, statuses, photographs and historical log entries.
do $$ begin
  if exists(select 1 from pg_policies where
    (schemaname='public' and tablename in ('admin_profiles','cars','brand_settings','activity_log')
      and (tablename,policyname) not in (
        ('admin_profiles','admins read all profiles'),('admin_profiles','owner manages admins'),
        ('cars','admins manage cars'),('cars','public read listed cars'),
        ('brand_settings','admins manage brand'),('brand_settings','public read brand'),
        ('activity_log','admins read activity log')))
    or (schemaname='storage' and tablename='objects' and policyname not in
      ('car photos public read','car photos admin insert','car photos admin update','car photos admin delete'))) then
    raise exception 'Unexpected policies: stop for drift review';
  end if;
  if exists(select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid
    join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname in ('admin_profiles','cars','brand_settings','activity_log')
    and a.attnum>0 and a.attacl is not null) then
    raise exception 'Unexpected column grants: stop for drift review';
  end if;
end $$;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

alter table public.admin_profiles add column is_active boolean not null default true;
alter table public.admin_profiles drop constraint admin_profiles_role_check;
alter table public.admin_profiles add constraint admin_profiles_role_check
  check (role in ('owner','manager','staff','editor','pending'));
-- editor is intentionally retained but grants no new application capability.
alter table public.cars drop constraint cars_status_check;
alter table public.cars add constraint cars_status_check
  check (status in ('available','reserved','sold','hidden','draft','archived'));
alter table public.cars alter column status set default 'draft';
alter table public.cars add column version integer not null default 1 check (version > 0);

create table private.owner_guard (id boolean primary key default true check (id), revision bigint not null default 0);
insert into private.owner_guard(id) values (true);
revoke all on private.owner_guard from public, anon, authenticated;

create or replace function private.staff_role()
returns text language sql stable security definer set search_path = '' as $$
  select p.role from public.admin_profiles p
  where p.user_id = auth.uid() and p.is_active
    and p.role in ('owner','manager','staff')
    and (p.role = 'staff' or coalesce(auth.jwt()->>'aal', '') = 'aal2')
$$;
revoke all on function private.staff_role() from public, anon;
grant execute on function private.staff_role() to authenticated;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.staff_role() is not null
$$;
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.staff_role() = 'owner', false)
$$;
revoke all on function public.is_admin(), public.is_owner() from public, anon;
grant execute on function public.is_admin(), public.is_owner() to authenticated;

-- Remove broad browser grants. RLS does not protect TRUNCATE.
revoke create on schema public from public, anon, authenticated;
revoke all on public.admin_profiles, public.cars, public.brand_settings, public.activity_log from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges in schema public revoke all on functions from public;
grant select on public.cars, public.brand_settings to anon, authenticated;
grant select on public.admin_profiles, public.activity_log to authenticated;
grant insert, update on public.cars to authenticated;
grant update on public.brand_settings to authenticated;
revoke all on function public.record_auth_event(text, text) from public, anon, authenticated;
-- Existing auth-event routine retained only for trusted maintenance, not used by this app.

-- Replace known legacy policies. Unexpected drift must be reviewed before applying.
drop policy "admins read all profiles" on public.admin_profiles;
drop policy "owner manages admins" on public.admin_profiles;
create policy profiles_read on public.admin_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_owner());

drop policy "admins manage cars" on public.cars;
drop policy "public read listed cars" on public.cars;
create policy cars_public_read on public.cars for select to anon, authenticated
  using (status in ('available','reserved','sold'));
create policy cars_staff_read on public.cars for select to authenticated
  using (private.staff_role() is not null);
create policy cars_insert_draft on public.cars for insert to authenticated
  with check (private.staff_role() is not null and status='draft' and not featured);
create policy cars_update on public.cars for update to authenticated
  using (private.staff_role() in ('owner','manager') or (private.staff_role()='staff' and status='draft'))
  with check (private.staff_role() in ('owner','manager') or (private.staff_role()='staff' and status='draft' and not featured));

drop policy "admins manage brand" on public.brand_settings;
create policy brand_update on public.brand_settings for update to authenticated
  using (private.staff_role() in ('owner','manager'))
  with check (private.staff_role() in ('owner','manager'));
-- Existing public brand SELECT policy remains: this table contains public fields only.
drop policy "admins read activity log" on public.activity_log;
create policy activity_read on public.activity_log for select to authenticated
  using (public.is_owner() or (private.staff_role()='manager' and entity in ('cars','brand_settings','vehicle_stock_events'))
         or (private.staff_role()='staff' and actor_id=auth.uid() and entity='cars'));

create table public.vehicle_stock_events (
  id bigint generated always as identity primary key,
  vehicle_id text not null references public.cars(id),
  actor_id uuid,
  event_type text not null check (event_type in ('entry','status')),
  from_status text,
  to_status text not null,
  reason text,
  at timestamptz not null default now()
);
alter table public.vehicle_stock_events enable row level security;
revoke all on public.vehicle_stock_events from public, anon, authenticated;
grant select on public.vehicle_stock_events to authenticated;
create policy stock_events_read on public.vehicle_stock_events for select to authenticated
  using (private.staff_role() is not null);
create index stock_events_vehicle_at on public.vehicle_stock_events(vehicle_id, at desc);

-- Audit only explicitly safe fields; never duplicate email, messages, passwords or free text.
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  before_row jsonb := '{}'::jsonb; after_row jsonb := '{}'::jsonb;
  differences jsonb; allowed text[]; entity_key text;
begin
  if tg_op <> 'INSERT' then before_row := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then after_row := to_jsonb(new); end if;
  if tg_table_name = 'admin_profiles' then
    allowed := array['role','is_active'];
    entity_key := coalesce(after_row->>'user_id', before_row->>'user_id');
  elsif tg_table_name = 'cars' then
    allowed := array['status','price_lakh','km','year','make','model','variant','fuel','transmission','body','featured','sort_order'];
    entity_key := coalesce(after_row->>'id', before_row->>'id');
  else
    allowed := array[]::text[];
    entity_key := coalesce(after_row->>'id', before_row->>'id');
  end if;
  select coalesce(jsonb_object_agg(k, jsonb_build_object('from',before_row->k,'to',after_row->k)), '{}'::jsonb)
  into differences from unnest(allowed) k where (before_row->k) is distinct from (after_row->k);
  insert into public.activity_log(actor_id,action,entity,entity_id,summary,changes)
  values(auth.uid(), lower(tg_table_name || '.' || tg_op),tg_table_name,entity_key,
         tg_table_name || ' ' || lower(tg_op),differences);
  return coalesce(new,old);
end $$;
revoke all on function public.log_activity() from public, anon, authenticated;

create function private.protect_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- An actual tuple update serialises owner changes; stale higher-isolation snapshots abort/retry.
  update private.owner_guard set revision=revision+1 where id;
  if old.role='owner' and old.is_active and
     (tg_op='DELETE' or new.role <> 'owner' or not new.is_active) then
    if (select count(*) from public.admin_profiles where role='owner' and is_active) <= 1 then
      raise exception 'Cannot remove the last active owner' using errcode='23514';
    end if;
  end if;
  return coalesce(new,old);
end $$;
revoke all on function private.protect_last_owner() from public, anon, authenticated;
create trigger protect_last_owner before update or delete on public.admin_profiles
  for each row execute function private.protect_last_owner();

create function public.set_staff_access(target_user uuid, new_role text, active boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_owner() then raise exception 'Owner with MFA required' using errcode='42501'; end if;
  if new_role not in ('owner','manager','staff','pending') or new_role is null or active is null then
    raise exception 'Invalid access assignment' using errcode='22023';
  end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) a
      where a->>'method'='totp' and (a->>'timestamp')::numeric between extract(epoch from now())-600 and extract(epoch from now())+30) then
    raise exception 'Recent authenticator verification required' using errcode='42501';
  end if;
  update private.owner_guard set revision=revision+1 where id;
  -- Recheck after the lock: another owner may have revoked this actor while waiting.
  if not public.is_owner() then raise exception 'Owner access changed' using errcode='42501'; end if;
  update public.admin_profiles set role=new_role, is_active=active where user_id=target_user;
  if not found then raise exception 'Profile not found' using errcode='P0002'; end if;
end $$;
revoke all on function public.set_staff_access(uuid,text,boolean) from public, anon;
grant execute on function public.set_staff_access(uuid,text,boolean) to authenticated;

create function private.guard_car_write()
returns trigger language plpgsql security definer set search_path = '' as $$
declare reason text; staff text := private.staff_role();
begin
  if tg_op='INSERT' then
    if new.status <> 'draft' or new.featured then raise exception 'Create a draft first'; end if;
    new.version := 1;
  else
    if new.id <> old.id then raise exception 'Vehicle identity is immutable'; end if;
    new.version := old.version + 1;
    if staff='staff' and (old.status <> 'draft' or new.status <> 'draft' or new.featured) then
      raise exception 'Staff may only edit drafts' using errcode='42501';
    end if;
    if new.status is distinct from old.status then
      reason := nullif(current_setting('app.stock_reason',true),'');
      if staff not in ('owner','manager') or staff is null or reason is null then
        raise exception 'Use set_car_status with an authorised actor and reason' using errcode='42501';
      end if;
      if not ((old.status='draft' and new.status in ('available','archived'))
        or (old.status='available' and new.status in ('reserved','sold','archived'))
        or (old.status='reserved' and new.status in ('available','sold','archived'))
        or (old.status='sold' and new.status in ('available','archived'))
        or (old.status in ('archived','hidden') and new.status='draft')) then
        raise exception 'Invalid vehicle status transition' using errcode='23514';
      end if;
      if new.status='available' and (nullif(btrim(new.photo_stock),'') is null
          or nullif(btrim(new.make),'') is null or nullif(btrim(new.model),'') is null
          or new.price_lakh <= 0) then raise exception 'Complete vehicle and cover photo before publishing'; end if;
      if new.status in ('sold','archived','draft') then new.featured:=false; end if;
    end if;
  end if;
  if new.featured and new.status <> 'available' then raise exception 'Only available cars can be featured'; end if;
  return new;
end $$;
revoke all on function private.guard_car_write() from public, anon, authenticated;
create trigger guard_car_write before insert or update on public.cars
  for each row execute function private.guard_car_write();

create function private.record_stock_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='INSERT' then
    insert into public.vehicle_stock_events(vehicle_id,actor_id,event_type,to_status)
      values(new.id,auth.uid(),'entry',new.status);
  elsif new.status is distinct from old.status then
    insert into public.vehicle_stock_events(vehicle_id,actor_id,event_type,from_status,to_status,reason)
      values(new.id,auth.uid(),'status',old.status,new.status,left(current_setting('app.stock_reason',true),500));
  end if;
  return new;
end $$;
revoke all on function private.record_stock_event() from public, anon, authenticated;
create trigger record_stock_event after insert or update on public.cars
  for each row execute function private.record_stock_event();

create function public.set_car_status(car_id text, next_status text, reason text, expected_version integer)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if private.staff_role() not in ('owner','manager') or private.staff_role() is null then
    raise exception 'Manager with MFA required' using errcode='42501';
  end if;
  if reason is null or length(btrim(reason)) < 3 or length(reason)>500 then
    raise exception 'Supply a reason between 3 and 500 characters';
  end if;
  perform set_config('app.stock_reason',reason,true);
  update public.cars set status=next_status where id=car_id and version=expected_version;
  if not found then raise exception 'Vehicle changed or is unavailable' using errcode='40001'; end if;
  perform set_config('app.stock_reason','',true);
end $$;
revoke all on function public.set_car_status(text,text,text,integer) from public, anon;
grant execute on function public.set_car_status(text,text,text,integer) to authenticated;

-- Keep existing public photos readable; prevent uploads until the reviewed publishing workflow.
drop policy "car photos admin insert" on storage.objects;
drop policy "car photos admin update" on storage.objects;
drop policy "car photos admin delete" on storage.objects;
update storage.buckets set file_size_limit=5242880,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'] where id='car-photos';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('car-drafts','car-drafts',false,5242880,array['image/jpeg','image/png','image/webp']);
create policy draft_media_read on storage.objects for select to authenticated
  using(bucket_id='car-drafts' and private.staff_role() is not null
    and (private.staff_role() in ('owner','manager') or (storage.foldername(name))[1]=auth.uid()::text));
create policy draft_media_insert on storage.objects for insert to authenticated
  with check(bucket_id='car-drafts' and private.staff_role() is not null
    and (storage.foldername(name))[1]=auth.uid()::text);
create policy draft_media_delete on storage.objects for delete to authenticated
  using(bucket_id='car-drafts' and private.staff_role() is not null
    and (private.staff_role() in ('owner','manager') or (storage.foldername(name))[1]=auth.uid()::text));
-- No UPDATE/upsert: a new object name is required. Byte validation/EXIF stripping arrives with uploader.

-- Contract marker: application gates fail closed if this migration is absent.
create function public.admin_security_version()
returns integer language sql stable set search_path = '' as $$ select 2 $$;
revoke all on function public.admin_security_version() from public, anon;
grant execute on function public.admin_security_version() to authenticated;
