-- LOCAL REVIEW ONLY. Apply transactionally after Phase 2 and verified backup/approval.
-- No record/media import, default owner, row deletion or legacy-image rewrite.
do $$ begin
  if public.admin_security_version()<>2 then raise exception 'Phase 2 security contract required'; end if;
end $$;
create table private.featured_guard(id boolean primary key default true check(id),revision bigint not null default 0);
insert into private.featured_guard(id) values(true);
revoke all on private.featured_guard from public,anon,authenticated;
-- Once enabled, all browser car writes use bounded, versioned RPCs.
revoke insert,update,delete on public.cars from anon,authenticated;
alter table public.cars add column media_order uuid[] not null default '{}';

create table public.vehicle_media (
 id uuid primary key default gen_random_uuid(), vehicle_id text not null references public.cars(id),
 uploaded_by uuid not null, object_path text not null unique,
 state text not null default 'pending' check(state in ('pending','ready','publishing','published','removed')),
 public_path text unique, bytes integer, width integer, height integer,
 publication_requested_by uuid, publication_requested_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(bytes is null or bytes between 1 and 5242880),
 check(width is null or width between 320 and 4096),check(height is null or height between 240 and 4096)
);
create index vehicle_media_vehicle on public.vehicle_media(vehicle_id,created_at);
alter table public.vehicle_media enable row level security;
revoke all on public.vehicle_media from public,anon,authenticated;
grant select on public.vehicle_media to authenticated;
create policy vehicle_media_read on public.vehicle_media for select to authenticated
 using(private.staff_role() in ('owner','manager') or (private.staff_role()='staff' and uploaded_by=auth.uid()));
-- Processed bytes are uploaded only by the isolated server media broker; a browser cannot bypass decoding.
drop policy draft_media_insert on storage.objects;
drop policy draft_media_delete on storage.objects;

create function private.editable_vehicle(car_id text, expected_version integer)
returns public.cars language plpgsql security definer set search_path='' as $$
declare c public.cars; r text:=private.staff_role();
begin
 if r is null then raise exception 'Active staff/MFA required' using errcode='42501'; end if;
 select * into c from public.cars where id=car_id for update;
 if not found then raise exception 'Vehicle not found' using errcode='P0002'; end if;
 if r='staff' and c.status<>'draft' then raise exception 'Staff edit drafts only' using errcode='42501'; end if;
 if expected_version is null or c.version<>expected_version then raise exception 'Vehicle changed; reload before retrying' using errcode='40001'; end if;
 return c;
end $$;
revoke all on function private.editable_vehicle(text,integer) from public,anon,authenticated;

create function public.save_vehicle(car_id text, expected_version integer, fields jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.cars; r text:=private.staff_role(); n integer; k text;
begin
 if r is null then raise exception 'Active staff/MFA required' using errcode='42501'; end if;
 if car_id is null or length(car_id)>120 or car_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Invalid immutable vehicle ID'; end if;
 if fields is null or jsonb_typeof(fields)<>'object' then raise exception 'Invalid fields'; end if;
 for k in select jsonb_object_keys(fields) loop
  if k not in ('year','make','model','variant','km','fuel','transmission','body','price_lakh','price_note','reg','location','highlights','overview','listing_url','featured','sort_order') then raise exception 'Unsupported field'; end if;
 end loop;
 -- Full replacement of editable values is deliberate; missing required fields are rejected, not guessed.
 if coalesce(fields->>'year','') !~ '^[0-9]{4}$' or (fields->>'year')::int not between 1980 and extract(year from now())::int+1
 or coalesce(fields->>'km','') !~ '^[0-9]{1,8}$' or coalesce(fields->>'price_lakh','') !~ '^[0-9]{1,5}(\.[0-9]{1,5})?$'
 or (fields->>'price_lakh')::numeric<=0 then raise exception 'Invalid year, odometer or exact asking price'; end if;
 foreach k in array array['make','model','variant','fuel','body','reg','location'] loop
  if nullif(btrim(fields->>k),'') is null or length(fields->>k)>160 then raise exception 'Complete bounded specification fields'; end if;
 end loop;
 if coalesce(length(fields->>'overview'),0)>6000 or coalesce(length(fields->>'price_note'),0)>500
 or coalesce(length(fields->>'transmission'),0)>100 or coalesce(length(fields->>'listing_url'),0)>2000
 or (nullif(fields->>'listing_url','') is not null and fields->>'listing_url' !~ '^https://[^[:space:]]+$') then raise exception 'Invalid description or source URL'; end if;
 if jsonb_typeof(fields->'highlights') is distinct from 'array' then raise exception 'Highlights must be an array'; end if;
 if jsonb_array_length(fields->'highlights')>12 or exists(select 1 from jsonb_array_elements(fields->'highlights') h where jsonb_typeof(h)<>'string' or length(h#>>'{}')>200) then raise exception 'Invalid highlights'; end if;
 if jsonb_typeof(fields->'featured') is distinct from 'boolean' or coalesce(fields->>'sort_order','') !~ '^[0-9]{1,6}$' then raise exception 'Invalid display controls'; end if;
 if expected_version<>0 and (fields->>'featured')::boolean then
  update private.featured_guard set revision=revision+1 where id;
 end if;
 if expected_version=0 then
  if fields->>'featured'='true' then raise exception 'Create an unfeatured draft first'; end if;
  insert into public.cars(id,year,make,model,variant,km,fuel,body,price_lakh,reg,transmission,price_note,location,highlights,overview,listing_url,sort_order)
   values(car_id,(fields->>'year')::int,btrim(fields->>'make'),btrim(fields->>'model'),btrim(fields->>'variant'),(fields->>'km')::int,btrim(fields->>'fuel'),btrim(fields->>'body'),(fields->>'price_lakh')::numeric,btrim(fields->>'reg'),
   nullif(btrim(fields->>'transmission'),''),nullif(fields->>'price_note',''),btrim(fields->>'location'),array(select jsonb_array_elements_text(fields->'highlights')),coalesce(fields->>'overview',''),nullif(fields->>'listing_url',''),(fields->>'sort_order')::int) returning version into n;
  return n;
 else
  c:=private.editable_vehicle(car_id,expected_version);
 end if;
 if (fields->>'featured')::boolean and (r='staff' or c.status<>'available') then raise exception 'Only managers feature available vehicles' using errcode='42501'; end if;
 if (fields->>'featured')::boolean then
  update public.cars set featured=false,updated_at=now() where id<>car_id and featured;
 end if;
 update public.cars set year=(fields->>'year')::int,make=btrim(fields->>'make'),model=btrim(fields->>'model'),variant=btrim(fields->>'variant'),km=(fields->>'km')::int,
 fuel=btrim(fields->>'fuel'),transmission=nullif(btrim(fields->>'transmission'),''),body=btrim(fields->>'body'),price_lakh=(fields->>'price_lakh')::numeric,
 price_note=nullif(fields->>'price_note',''),reg=btrim(fields->>'reg'),location=btrim(fields->>'location'),
 highlights=array(select jsonb_array_elements_text(fields->'highlights')),overview=coalesce(fields->>'overview',''),listing_url=nullif(fields->>'listing_url',''),
 featured=(fields->>'featured')::boolean,sort_order=(fields->>'sort_order')::int,updated_at=now() where id=car_id returning version into n;
 return n;
end $$;
revoke all on function public.save_vehicle(text,integer,jsonb) from public,anon;
grant execute on function public.save_vehicle(text,integer,jsonb) to authenticated;

create or replace function public.set_car_status(car_id text,next_status text,reason text,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare c public.cars;
begin
 if private.staff_role() is null or private.staff_role() not in ('owner','manager') then raise exception 'Manager with MFA required' using errcode='42501'; end if;
 c:=private.editable_vehicle(car_id,expected_version);
 if reason is null or length(btrim(reason))<3 or length(reason)>500 or next_status is null or next_status=c.status then raise exception 'Select a different status and supply a reason'; end if;
 if next_status='available' and (nullif(btrim(c.variant),'') is null or nullif(btrim(c.fuel),'') is null or nullif(btrim(c.reg),'') is null) then raise exception 'Complete vehicle specifications'; end if;
 perform set_config('app.stock_reason',btrim(reason),true);
 -- Clear featured before reserving: a reserved unit cannot remain a featured available car.
 update public.cars set status=next_status,featured=case when next_status<>'available' then false else featured end,updated_at=now() where id=car_id;
 perform set_config('app.stock_reason','',true);
end $$;

create function public.prepare_vehicle_media(car_id text,expected_version integer)
returns public.vehicle_media language plpgsql security definer set search_path='' as $$
declare c public.cars; m public.vehicle_media; asset uuid:=gen_random_uuid();
begin
 c:=private.editable_vehicle(car_id,expected_version);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if (select count(*) from public.vehicle_media where uploaded_by=auth.uid() and created_at>now()-interval '5 minutes')>=10 then raise exception 'Upload reservation rate limit; wait before retrying'; end if;
 if (select count(*) from public.vehicle_media where vehicle_id=car_id and state<>'removed')>=20 then raise exception 'Maximum 20 assets including pending uploads; review failed uploads'; end if;
 insert into public.vehicle_media(id,vehicle_id,uploaded_by,object_path)
 values(asset,car_id,auth.uid(),auth.uid()::text||'/'||asset::text||'.webp') returning * into m;
 return m;
end $$;
create function public.finish_vehicle_media(asset_id uuid,byte_count integer,pixel_width integer,pixel_height integer)
returns void language plpgsql security definer set search_path='' as $$
begin
 if byte_count is null or byte_count not between 1 and 5242880 or pixel_width is null or pixel_width not between 320 and 4096 or pixel_height is null or pixel_height not between 240 and 4096 then raise exception 'Invalid processed image metadata'; end if;
 update public.vehicle_media set state='ready',bytes=byte_count,width=pixel_width,height=pixel_height,updated_at=now()
 where id=asset_id and state='pending' and created_at>now()-interval '1 hour'
 and exists(select 1 from public.admin_profiles p where p.user_id=uploaded_by and p.is_active and p.role in ('staff','manager','owner'));
 if not found then raise exception 'Upload reservation expired or unavailable'; end if;
end $$;
create function public.request_media_publication(asset_id uuid,expected_version integer)
returns public.vehicle_media language plpgsql security definer set search_path='' as $$
declare m public.vehicle_media; c public.cars;
begin
 if private.staff_role() is null or private.staff_role() not in ('owner','manager') then raise exception 'Manager with MFA required' using errcode='42501'; end if;
 select * into m from public.vehicle_media where id=asset_id;
 if not found then raise exception 'Asset not found'; end if;
 c:=private.editable_vehicle(m.vehicle_id,expected_version);
 update public.vehicle_media set state='publishing',public_path='processed/'||id::text||'.webp',publication_requested_by=auth.uid(),publication_requested_at=now(),updated_at=now()
 where id=asset_id and state='ready' returning * into m;
 if not found then raise exception 'Asset is not ready for publication'; end if;
 return m;
end $$;
create function public.finish_media_publication(asset_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 update public.vehicle_media m set state='published',updated_at=now() where m.id=asset_id and m.state='publishing'
 and m.publication_requested_at>now()-interval '5 minutes' and exists(select 1 from public.admin_profiles p where p.user_id=m.publication_requested_by and p.is_active and p.role in ('owner','manager'));
 if not found then raise exception 'Publication authorisation expired or changed'; end if;
end $$;
create function public.remove_vehicle_media(asset_id uuid,expected_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare m public.vehicle_media; c public.cars;
begin
 select * into m from public.vehicle_media where id=asset_id;
 if not found or (private.staff_role()='staff' and m.uploaded_by<>auth.uid()) then raise exception 'Asset not available' using errcode='42501'; end if;
 c:=private.editable_vehicle(m.vehicle_id,expected_version);
 if m.state='publishing' then raise exception 'Publication is in flight; use reviewed reconciliation'; end if;
 if m.id=any(c.media_order) then raise exception 'Remove asset from photo selection first'; end if;
 update public.vehicle_media set state='removed',updated_at=now() where id=asset_id;
end $$;
create function public.set_vehicle_photos(car_id text,expected_version integer,asset_ids uuid[])
returns integer language plpgsql security definer set search_path='' as $$
declare c public.cars; m public.vehicle_media; paths text[]:='{}'; a uuid; n integer;
begin
 c:=private.editable_vehicle(car_id,expected_version);
 if asset_ids is null or cardinality(asset_ids)>20 or cardinality(asset_ids)<>(select count(distinct x) from unnest(asset_ids) x) then raise exception 'Invalid photo selection'; end if;
 foreach a in array asset_ids loop
  select * into m from public.vehicle_media where id=a for update;
  if not found or m.vehicle_id<>car_id or m.state not in ('ready','published')
   or (private.staff_role()='staff' and m.uploaded_by<>auth.uid()) then raise exception 'Photo unavailable' using errcode='42501'; end if;
  if c.status in ('available','reserved','sold') and m.state<>'published' then raise exception 'Publish approved photos before attaching to public stock'; end if;
  if m.state='published' then paths:=array_append(paths,m.public_path); end if;
 end loop;
 if c.status in ('available','reserved','sold') and cardinality(paths)=0 then raise exception 'Public stock requires a cover photo'; end if;
 update public.cars set media_order=asset_ids,photo_stock=paths[1],photos_gallery=paths,updated_at=now() where id=car_id returning version into n;
 return n;
end $$;
-- Metadata lifecycle events avoid signed URLs, original names and image bytes in the audit.
create function private.audit_vehicle_media() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.activity_log(actor_id,action,entity,entity_id,summary,changes)
 values(coalesce(auth.uid(),case when new.state='published' then new.publication_requested_by else new.uploaded_by end),
 'vehicle_media.'||lower(tg_op),'cars',new.vehicle_id,'Photo workflow changed',jsonb_build_object('asset',new.id,'state',new.state));
 return new;
end $$;
create trigger media_audit after insert or update on public.vehicle_media for each row execute function private.audit_vehicle_media();
create function private.audit_photo_selection() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.media_order is distinct from new.media_order or old.photo_stock is distinct from new.photo_stock or old.photos_gallery is distinct from new.photos_gallery then
  insert into public.activity_log(actor_id,action,entity,entity_id,summary,changes)
  values(auth.uid(),'cars.photos','cars',new.id,'Photo selection changed',jsonb_build_object('cover_changed',old.photo_stock is distinct from new.photo_stock,'previous_count',cardinality(old.photos_gallery),'selected_count',cardinality(new.media_order)));
 end if;
 return new;
end $$;
create trigger photo_selection_audit after update on public.cars for each row execute function private.audit_photo_selection();
revoke all on function private.audit_photo_selection() from public,anon,authenticated;
revoke all on function private.audit_vehicle_media() from public,anon,authenticated;

revoke all on function public.prepare_vehicle_media(text,integer),public.request_media_publication(uuid,integer),public.remove_vehicle_media(uuid,integer),public.set_vehicle_photos(text,integer,uuid[]) from public,anon;
grant execute on function public.prepare_vehicle_media(text,integer),public.request_media_publication(uuid,integer),public.remove_vehicle_media(uuid,integer),public.set_vehicle_photos(text,integer,uuid[]) to authenticated;
revoke all on function public.finish_vehicle_media(uuid,integer,integer,integer),public.finish_media_publication(uuid) from public,anon,authenticated;
grant execute on function public.finish_vehicle_media(uuid,integer,integer,integer),public.finish_media_publication(uuid) to service_role;

-- Private operational notes never join the public cars projection; no financial/customer fields are invented.
create table public.vehicle_internal_notes (
 vehicle_id text primary key references public.cars(id), note text not null check(length(note)<=6000),
 updated_by uuid not null,updated_at timestamptz not null default now()
);
alter table public.vehicle_internal_notes enable row level security;
revoke all on public.vehicle_internal_notes from public,anon,authenticated;
grant select on public.vehicle_internal_notes to authenticated;
create policy vehicle_notes_read on public.vehicle_internal_notes for select to authenticated using(
 private.staff_role() in ('owner','manager') or (private.staff_role()='staff' and exists(select 1 from public.cars c where c.id=vehicle_id and c.status='draft'))
);
create function public.save_vehicle_note(car_id text,expected_version integer,note_text text)
returns integer language plpgsql security definer set search_path='' as $$
declare c public.cars; n integer;
begin
 c:=private.editable_vehicle(car_id,expected_version);
 if note_text is null or length(note_text)>6000 then raise exception 'Invalid private note'; end if;
 insert into public.vehicle_internal_notes(vehicle_id,note,updated_by) values(car_id,note_text,auth.uid())
 on conflict(vehicle_id) do update set note=excluded.note,updated_by=auth.uid(),updated_at=now();
 update public.cars set updated_at=now() where id=car_id returning version into n;
 insert into public.activity_log(actor_id,action,entity,entity_id,summary,changes)
 values(auth.uid(),'cars.private_note','cars',car_id,'Private operational note changed','{}');
 return n;
end $$;
revoke all on function public.save_vehicle_note(text,integer,text) from public,anon;
grant execute on function public.save_vehicle_note(text,integer,text) to authenticated;

create function public.inventory_overview()
returns jsonb language plpgsql security definer set search_path='' as $$
declare totals jsonb;
begin
 if private.staff_role() is null then raise exception 'Active staff required' using errcode='42501'; end if;
 select jsonb_object_agg(s,n) into totals from (select status s,count(*) n from public.cars group by status) v;
 return coalesce(totals,'{}'::jsonb);
end $$;
revoke all on function public.inventory_overview() from public,anon;
grant execute on function public.inventory_overview() to authenticated;
create function public.inventory_workflow_version() returns integer language sql stable set search_path='' as $$select 4$$;
revoke all on function public.inventory_workflow_version() from public,anon;
grant execute on function public.inventory_workflow_version() to authenticated;
