-- LOCAL ONLY. Requires Phase 2 + 4; apply transactionally after verified backup/drift/approval.
do $$begin if public.inventory_workflow_version()<>4 then raise exception 'Inventory workflow contract required'; end if; end$$;
create table public.service_catalogue(
 id uuid primary key default gen_random_uuid(),name text not null check(length(btrim(name)) between 2 and 100),
 description text not null default '' check(length(description)<=2000),active boolean not null default false,
 sort_order integer not null default 100 check(sort_order between 0 and 999999),version integer not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.service_catalogue enable row level security;
revoke all on public.service_catalogue from public,anon,authenticated;
grant select on public.service_catalogue to anon,authenticated;
create policy service_public on public.service_catalogue for select to anon,authenticated using(active);
create policy service_staff on public.service_catalogue for select to authenticated using(private.staff_role() is not null);
create table public.business_requests(
 id uuid primary key default gen_random_uuid(),reference uuid not null default gen_random_uuid() unique,
 kind text not null check(kind in ('general','car','sell','exchange','finance','insurance','viewing','service')),
 vehicle_id text references public.cars(id),service_id uuid references public.service_catalogue(id),
 contact_name text not null check(length(btrim(contact_name)) between 2 and 120),
 phone text not null check(length(phone) between 7 and 30),email text check(length(email)<=254),
 message text not null check(length(btrim(message)) between 3 and 3000),seller_details jsonb not null default '{}',
 customer_vehicle text check(length(customer_vehicle)<=300),source text not null,
 consent_version text not null,consented_at timestamptz not null default now(),
 status text not null default 'new' check(status in ('new','contacted','in_progress','converted','closed','spam')),
 assigned_to uuid references public.admin_profiles(user_id),follow_up_at timestamptz,version integer not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index business_requests_status_assigned on public.business_requests(status,assigned_to,created_at desc);
create table public.request_notes(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.business_requests(id),actor_id uuid not null,note text not null check(length(btrim(note)) between 1 and 3000),at timestamptz not null default now());
create index request_notes_request on public.request_notes(request_id,at desc);
create table public.viewing_appointments(
 id uuid primary key default gen_random_uuid(),request_id uuid not null references public.business_requests(id),
 vehicle_id text not null references public.cars(id),assigned_to uuid not null references public.admin_profiles(user_id),
 starts_at timestamptz not null,ends_at timestamptz not null,
 status text not null check(status in ('requested','confirmed','completed','cancelled')),version integer not null default 1,
 updated_at timestamptz not null default now(),check(ends_at>starts_at and ends_at<=starts_at+interval '3 hours')
);
create index viewing_slots on public.viewing_appointments(assigned_to,vehicle_id,starts_at,ends_at) where status='confirmed';
create index viewing_request on public.viewing_appointments(request_id,starts_at desc);
create index viewing_car_slots on public.viewing_appointments(vehicle_id,starts_at,ends_at) where status='confirmed';
create table public.service_jobs(
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique references public.business_requests(id),
 service_id uuid not null references public.service_catalogue(id),
 status text not null default 'requested' check(status in ('requested','scheduled','in_progress','completed','cancelled')),
 starts_at timestamptz,ends_at timestamptz,version integer not null default 1,updated_at timestamptz not null default now(),
 check((starts_at is null and ends_at is null) or (starts_at is not null and ends_at is not null and ends_at>starts_at and ends_at<=starts_at+interval '3 hours')),
 check(status not in ('scheduled','in_progress') or starts_at is not null)
);
create table public.business_events(id bigint generated always as identity primary key,request_id uuid not null references public.business_requests(id),actor_id uuid,event text not null,changes jsonb not null default '{}',at timestamptz not null default now());
create index business_events_request on public.business_events(request_id,at desc);
create table private.intake_receipts(key uuid primary key,fingerprint text not null,reference uuid not null,created_at timestamptz not null default now());
create table private.intake_limits(key text primary key,window_start timestamptz not null,count integer not null);
create table private.schedule_guard(id boolean primary key default true check(id),revision bigint not null default 0);
insert into private.schedule_guard(id) values(true);
revoke all on private.intake_receipts,private.intake_limits,private.schedule_guard from public,anon,authenticated;

-- Elevated business access requires a recent verified TOTP, independently of the Next.js UI.
create function private.business_role() returns text language plpgsql stable security definer set search_path='' as $$
declare role_name text:=private.staff_role();
begin
 if role_name in ('owner','manager') and not exists(
  select 1 from jsonb_array_elements(case when jsonb_typeof(auth.jwt()->'amr')='array' then auth.jwt()->'amr' else '[]'::jsonb end) a
  where a->>'method'='totp' and jsonb_typeof(a->'timestamp')='number'
  and (a->>'timestamp')::numeric between extract(epoch from now())-600 and extract(epoch from now())+30
 ) then return null;end if;
 return role_name;
end $$;
revoke all on function private.business_role() from public,anon;
grant execute on function private.business_role() to authenticated;

create function private.can_read_request(request_key uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(private.business_role() in ('owner','manager') or (private.business_role()='staff' and exists(select 1 from public.business_requests r where r.id=request_key and r.assigned_to=auth.uid())),false)
$$;
revoke all on function private.can_read_request(uuid) from public,anon;
grant execute on function private.can_read_request(uuid) to authenticated;
alter table public.business_requests enable row level security;
alter table public.request_notes enable row level security;
alter table public.viewing_appointments enable row level security;
alter table public.service_jobs enable row level security;
alter table public.business_events enable row level security;
revoke all on public.business_requests,public.request_notes,public.viewing_appointments,public.service_jobs,public.business_events from public,anon,authenticated;
grant select on public.business_requests,public.request_notes,public.viewing_appointments,public.service_jobs,public.business_events to authenticated;
create policy requests_read on public.business_requests for select to authenticated using(private.can_read_request(id));
create policy notes_read on public.request_notes for select to authenticated using(private.can_read_request(request_id));
create policy viewings_read on public.viewing_appointments for select to authenticated using(private.can_read_request(request_id));
create policy jobs_read on public.service_jobs for select to authenticated using(private.can_read_request(request_id));
create policy business_events_read on public.business_events for select to authenticated using(private.can_read_request(request_id));

create function private.business_audit() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb:='{}';a jsonb:=to_jsonb(new);d jsonb;rk uuid;
begin
 if tg_op='UPDATE' then b:=to_jsonb(old);end if;
 rk:=case when tg_table_name='business_requests' then new.id else (a->>'request_id')::uuid end;
 select coalesce(jsonb_object_agg(k,jsonb_build_object('from',b->k,'to',a->k)),'{}') into d
 from unnest(array['status','assigned_to','follow_up_at','starts_at','ends_at','service_id','vehicle_id']) k where b->k is distinct from a->k;
 insert into public.business_events(request_id,actor_id,event,changes) values(rk,auth.uid(),tg_table_name||'.'||lower(tg_op),d);
 return new;
end $$;
revoke all on function private.business_audit() from public,anon,authenticated;
create trigger request_audit after insert or update on public.business_requests for each row execute function private.business_audit();
create trigger note_audit after insert on public.request_notes for each row execute function private.business_audit();
create trigger viewing_audit after insert or update on public.viewing_appointments for each row execute function private.business_audit();
create trigger job_audit after insert or update on public.service_jobs for each row execute function private.business_audit();

create function private.consume_intake_limit(bucket text,maximum integer) returns void language plpgsql security definer set search_path='' as $$
declare hits integer;
begin
 insert into private.intake_limits(key,window_start,count) values(bucket,now(),1)
 on conflict(key) do update set count=case when intake_limits.window_start<now()-interval '15 minutes' then 1 else intake_limits.count+1 end,
 window_start=case when intake_limits.window_start<now()-interval '15 minutes' then now() else intake_limits.window_start end returning count into hits;
 if hits>maximum then raise exception 'Intake rate limit exceeded' using errcode='P0001';end if;
end $$;
revoke all on function private.consume_intake_limit(text,integer) from public,anon,authenticated;
create function public.accept_business_request(request_key uuid,fingerprint text,payload jsonb,contact_hash text,network_hash text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare receipt private.intake_receipts;r public.business_requests;v text;s uuid;k text;details jsonb;
begin
 -- RPC only for the isolated intake broker; no anonymous INSERT or reads.
 if request_key is null or fingerprint is null or contact_hash is null or fingerprint !~ '^[0-9a-f]{64}$' or contact_hash !~ '^[0-9a-f]{64}$' or (network_hash is not null and network_hash !~ '^[0-9a-f]{64}$') then raise exception 'Invalid intake envelope';end if;
 perform pg_advisory_xact_lock(5012345);
 select * into receipt from private.intake_receipts where key=request_key;
 if found then if receipt.fingerprint<>fingerprint then raise exception 'Retry key reused for different content' using errcode='22023';end if;return receipt.reference;end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid request';end if;
 for k in select jsonb_object_keys(payload) loop if k not in ('kind','vehicle_id','service_id','contact_name','phone','email','message','seller_details','customer_vehicle','source','consent_version') then raise exception 'Unsupported intake field';end if;end loop;
 if payload->>'kind' is null or payload->>'kind' not in ('general','car','sell','exchange','finance','insurance','viewing','service')
 or length(coalesce(payload->>'contact_name','')) not between 2 and 120 or length(coalesce(payload->>'phone','')) not between 7 and 30
 or coalesce(payload->>'phone','') !~ '^\+?[0-9 ()-]+$' or length(coalesce(payload->>'message','')) not between 3 and 3000
 or length(coalesce(payload->>'email',''))>254 or (nullif(payload->>'email','') is not null and payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
 or payload->>'consent_version' is distinct from '2026-11-business-v1' or payload->>'source' is null or payload->>'source' not in ('contact','vehicle','sell','services') then raise exception 'Invalid request fields';end if;
 details:=coalesce(payload->'seller_details','{}');
 if jsonb_typeof(details)<>'object' or length(details::text)>2000 or exists(select 1 from jsonb_object_keys(details) key where key not in ('make','model','year','km','ownership','insurance','location')) then raise exception 'Invalid seller details';end if;
 if payload->>'kind' in ('sell','exchange') and (nullif(btrim(details->>'make'),'') is null or nullif(btrim(details->>'model'),'') is null or nullif(btrim(details->>'location'),'') is null) then raise exception 'Seller vehicle identity/location required';end if;
 v:=nullif(payload->>'vehicle_id','');s:=nullif(payload->>'service_id','')::uuid;
 if payload->>'kind' in ('car','viewing') and v is null then raise exception 'Vehicle required';end if;
 if v is not null then perform 1 from public.cars where id=v and status='available' for share;if not found then raise exception 'Vehicle no longer available' using errcode='22023';end if;end if;
 if payload->>'kind'='service' then
  if s is null or length(coalesce(payload->>'customer_vehicle','')) not between 3 and 300 then raise exception 'Service and customer vehicle required';end if;
  perform 1 from public.service_catalogue where id=s and active for share;if not found then raise exception 'Service unavailable';end if;
 elsif s is not null then raise exception 'Unexpected service reference';end if;
 perform private.consume_intake_limit('global',100);
 perform private.consume_intake_limit('contact:'||contact_hash,3);
 if network_hash is not null then perform private.consume_intake_limit('network:'||network_hash,10);end if;
 insert into public.business_requests(kind,vehicle_id,service_id,contact_name,phone,email,message,seller_details,customer_vehicle,source,consent_version)
 values(payload->>'kind',v,s,btrim(payload->>'contact_name'),payload->>'phone',nullif(payload->>'email',''),payload->>'message',details,nullif(payload->>'customer_vehicle',''),payload->>'source',payload->>'consent_version') returning * into r;
 if r.kind='service' then insert into public.service_jobs(request_id,service_id) values(r.id,s);end if;
 insert into private.intake_receipts(key,fingerprint,reference) values(request_key,fingerprint,r.reference);
 return r.reference;
end $$;
revoke all on function public.accept_business_request(uuid,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.accept_business_request(uuid,text,jsonb,text,text) to service_role;

create function private.editable_request(request_key uuid,expected_version integer) returns public.business_requests language plpgsql security definer set search_path='' as $$
declare r public.business_requests;
begin
 if private.business_role() is null then raise exception 'Active staff/MFA required' using errcode='42501';end if;
 select * into r from public.business_requests where id=request_key for update;
 if not found or not private.can_read_request(request_key) then raise exception 'Request unavailable' using errcode='42501';end if;
 if expected_version is null or r.version<>expected_version then raise exception 'Request changed; reload' using errcode='40001';end if;
 return r;
end $$;
revoke all on function private.editable_request(uuid,integer) from public,anon,authenticated;
create function public.update_business_request(request_key uuid,expected_version integer,next_status text,assignee uuid,follow_up timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare r public.business_requests;
begin
 r:=private.editable_request(request_key,expected_version);
 if next_status is null or next_status not in ('new','contacted','in_progress','converted','closed','spam') then raise exception 'Invalid lead status';end if;
 if assignee is distinct from r.assigned_to then
  if private.business_role() not in ('owner','manager') then raise exception 'Only managers assign requests' using errcode='42501';end if;
  if exists(select 1 from public.viewing_appointments where request_id=r.id and status='confirmed') or exists(select 1 from public.service_jobs where request_id=r.id and status in ('scheduled','in_progress')) then raise exception 'Cancel active schedules before reassigning';end if;
 end if;
 if assignee is not null and not exists(select 1 from public.admin_profiles where user_id=assignee and is_active and role in ('staff','manager','owner')) then raise exception 'Assignee must be active staff';end if;
 update public.business_requests set status=next_status,assigned_to=assignee,follow_up_at=follow_up,version=version+1,updated_at=now() where id=request_key;
end $$;
create function public.add_request_note(request_key uuid,expected_version integer,note_text text) returns void language plpgsql security definer set search_path='' as $$
declare r public.business_requests;
begin
 r:=private.editable_request(request_key,expected_version);
 if note_text is null or length(btrim(note_text)) not between 1 and 3000 then raise exception 'Invalid note';end if;
 insert into public.request_notes(request_id,actor_id,note) values(request_key,auth.uid(),btrim(note_text));
 update public.business_requests set version=version+1,updated_at=now() where id=request_key;
end $$;

create function private.check_slot(worker uuid,car text,start_time timestamptz,end_time timestamptz,appointment_id uuid default null,job_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if worker is null or start_time is null or end_time is null or start_time<=now() or end_time<=start_time or end_time>start_time+interval '3 hours' then raise exception 'Choose a future slot of at most 3 hours';end if;
 if exists(select 1 from public.viewing_appointments a where a.status='confirmed' and (appointment_id is null or a.id<>appointment_id) and (a.assigned_to=worker or a.vehicle_id=car) and a.starts_at<end_time and a.ends_at>start_time)
 or exists(select 1 from public.service_jobs j join public.business_requests r on r.id=j.request_id where j.status in ('scheduled','in_progress') and (job_id is null or j.id<>job_id) and r.assigned_to=worker and j.starts_at<end_time and j.ends_at>start_time) then raise exception 'Staff or vehicle already scheduled' using errcode='23P01';end if;
end $$;
revoke all on function private.check_slot(uuid,text,timestamptz,timestamptz,uuid,uuid) from public,anon,authenticated;
create function public.save_viewing(appointment_id uuid,request_key uuid,request_version integer,expected_version integer,next_status text,start_time timestamptz,end_time timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare r public.business_requests;a public.viewing_appointments;
begin
 update private.schedule_guard set revision=revision+1 where id;
 r:=private.editable_request(request_key,request_version);
 if expected_version is null or expected_version<0 then raise exception 'Invalid appointment version';end if;
 if r.vehicle_id is null or r.assigned_to is null or next_status is null or next_status not in ('requested','confirmed','completed','cancelled') then raise exception 'Assigned vehicle request and valid status required';end if;
 if next_status in ('requested','confirmed') and not exists(select 1 from public.admin_profiles where user_id=r.assigned_to and is_active and role in ('staff','manager','owner')) then raise exception 'Assigned staff is inactive';end if;
 if expected_version<>0 then select * into a from public.viewing_appointments where id=appointment_id and request_id=request_key for update;if not found or a.version<>expected_version then raise exception 'Appointment changed' using errcode='40001';end if;
  if not ((a.status='requested' and next_status in ('requested','confirmed','cancelled')) or (a.status='confirmed' and next_status in ('confirmed','completed','cancelled')) or (a.status='cancelled' and next_status='requested')) then raise exception 'Invalid viewing transition';end if;
 elsif next_status not in ('requested','confirmed') then raise exception 'Create a requested/confirmed appointment first';end if;
 if expected_version<>0 and next_status in ('completed','cancelled') and (start_time is distinct from a.starts_at or end_time is distinct from a.ends_at) then raise exception 'Retain historical viewing times when completing/cancelling';end if;
 if next_status='confirmed' then
  perform 1 from public.cars where id=r.vehicle_id and status='available' for update;if not found then raise exception 'Vehicle no longer available';end if;
  perform private.check_slot(r.assigned_to,r.vehicle_id,start_time,end_time,appointment_id,null);
 end if;
 if start_time is null or end_time is null or end_time<=start_time or end_time>start_time+interval '3 hours' then raise exception 'Invalid viewing times';end if;
 if expected_version=0 then insert into public.viewing_appointments(id,request_id,vehicle_id,assigned_to,starts_at,ends_at,status) values(appointment_id,request_key,r.vehicle_id,r.assigned_to,start_time,end_time,next_status);
 else update public.viewing_appointments set status=next_status,starts_at=start_time,ends_at=end_time,assigned_to=r.assigned_to,version=version+1,updated_at=now() where id=appointment_id;end if;
end $$;
create function public.update_service_job(job_key uuid,request_version integer,expected_version integer,next_status text,start_time timestamptz,end_time timestamptz)
returns void language plpgsql security definer set search_path='' as $$
declare j public.service_jobs;r public.business_requests;
begin
 update private.schedule_guard set revision=revision+1 where id;
 select * into j from public.service_jobs where id=job_key;if not found then raise exception 'Job unavailable';end if;
 r:=private.editable_request(j.request_id,request_version);
 if expected_version is null or j.version<>expected_version then raise exception 'Job changed; reload' using errcode='40001';end if;
 if next_status is null or not ((j.status='requested' and next_status in ('scheduled','cancelled')) or (j.status='scheduled' and next_status in ('scheduled','in_progress','cancelled')) or (j.status='in_progress' and next_status in ('completed','cancelled')) or (j.status='cancelled' and next_status='requested')) then raise exception 'Invalid job transition';end if;
 if next_status in ('scheduled','in_progress') then
  if r.assigned_to is null or not exists(select 1 from public.admin_profiles where user_id=r.assigned_to and is_active and role in ('staff','manager','owner')) then raise exception 'Assign active staff first';end if;
  if next_status='scheduled' then perform private.check_slot(r.assigned_to,null,start_time,end_time,null,job_key);
  elsif start_time is distinct from j.starts_at or end_time is distinct from j.ends_at then raise exception 'Do not alter times when starting a job';end if;
 end if;
 if next_status in ('completed','cancelled') and (start_time is distinct from j.starts_at or end_time is distinct from j.ends_at) then raise exception 'Retain recorded job times when completing/cancelling';end if;
 update public.service_jobs set status=next_status,starts_at=case when next_status='requested' then null else start_time end,ends_at=case when next_status='requested' then null else end_time end,version=version+1,updated_at=now() where id=job_key;
end $$;
revoke all on function public.update_business_request(uuid,integer,text,uuid,timestamptz),public.add_request_note(uuid,integer,text),public.save_viewing(uuid,uuid,integer,integer,text,timestamptz,timestamptz),public.update_service_job(uuid,integer,integer,text,timestamptz,timestamptz) from public,anon;
grant execute on function public.update_business_request(uuid,integer,text,uuid,timestamptz),public.add_request_note(uuid,integer,text),public.save_viewing(uuid,uuid,integer,integer,text,timestamptz,timestamptz),public.update_service_job(uuid,integer,integer,text,timestamptz,timestamptz) to authenticated;

create function public.save_service(service_key uuid,expected_version integer,service_name text,service_description text,is_active boolean,display_order integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if private.business_role() is null or private.business_role() not in ('owner','manager') then raise exception 'Manager with MFA required' using errcode='42501';end if;
 if is_active is null then raise exception 'Invalid active flag';end if;
 if expected_version=0 then insert into public.service_catalogue(id,name,description,active,sort_order) values(service_key,btrim(service_name),service_description,is_active,display_order);
 else update public.service_catalogue set name=btrim(service_name),description=service_description,active=is_active,sort_order=display_order,version=version+1,updated_at=now() where id=service_key and version=expected_version;if not found then raise exception 'Service changed' using errcode='40001';end if;end if;
 insert into public.activity_log(actor_id,action,entity,entity_id,summary,changes) values(auth.uid(),'services.save','service_catalogue',service_key::text,'Service catalogue changed',jsonb_build_object('active',is_active));
end $$;
alter table public.brand_settings add column version integer not null default 1;
revoke update on public.brand_settings from authenticated;
create function public.save_business_settings(expected_version integer,fields jsonb) returns void language plpgsql security definer set search_path='' as $$
declare k text;
begin
 if private.business_role() is null or private.business_role() not in ('owner','manager') then raise exception 'Manager with MFA required' using errcode='42501';end if;
 if fields is null or jsonb_typeof(fields)<>'object' then raise exception 'Invalid settings';end if;
 for k in select jsonb_object_keys(fields) loop if k not in ('name','tagline','phone_display','phone_href','email','address_short','address_city','area','map_url','hours','services') then raise exception 'Unsupported setting';end if;if (k<>'services' and jsonb_typeof(fields->k)<>'string') or (k='services' and jsonb_typeof(fields->k)<>'array') then raise exception 'Invalid setting type';end if;if length(coalesce(fields->>k,''))>2000 then raise exception 'Setting too long';end if;end loop;
 foreach k in array array['name','phone_display','phone_href','email','address_short','address_city','area'] loop if nullif(btrim(fields->>k),'') is null then raise exception 'Complete business contact fields';end if;end loop;
 if fields->>'phone_href' !~ '^\+?[0-9]{7,15}$' or fields->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or fields->>'map_url' !~ '^https://[^[:space:]]+$'
 or jsonb_typeof(fields->'services') is distinct from 'array' then raise exception 'Invalid contact URL/services';end if;
 if exists(select 1 from jsonb_array_elements(fields->'services') entry where jsonb_typeof(entry)<>'string' or length(entry#>>'{}')>100) or jsonb_array_length(fields->'services')>20 then raise exception 'Invalid service labels';end if;
 update public.brand_settings set name=btrim(fields->>'name'),tagline=fields->>'tagline',phone_display=fields->>'phone_display',phone_href=fields->>'phone_href',email=fields->>'email',address_short=fields->>'address_short',address_city=fields->>'address_city',area=fields->>'area',map_url=fields->>'map_url',hours=nullif(fields->>'hours',''),services=array(select jsonb_array_elements_text(fields->'services')),version=version+1,updated_at=now() where id=1 and version=expected_version;
 if not found then raise exception 'Settings changed or singleton missing' using errcode='40001';end if;
end $$;
revoke all on function public.save_service(uuid,integer,text,text,boolean,integer),public.save_business_settings(integer,jsonb) from public,anon;
grant execute on function public.save_service(uuid,integer,text,text,boolean,integer),public.save_business_settings(integer,jsonb) to authenticated;
create function public.business_overview() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.business_role() is null then raise exception 'Staff required' using errcode='42501';end if;
 return jsonb_build_object('new_requests',(select count(*) from public.business_requests where private.can_read_request(id) and status='new'),'unassigned',(select count(*) from public.business_requests where private.can_read_request(id) and assigned_to is null and status not in ('closed','spam','converted')),'follow_up_overdue',(select count(*) from public.business_requests where private.can_read_request(id) and follow_up_at<now() and status not in ('closed','spam','converted')),'upcoming_viewings',(select count(*) from public.viewing_appointments where private.can_read_request(request_id) and status='confirmed' and starts_at>=now()),'open_services',(select count(*) from public.service_jobs where private.can_read_request(request_id) and status not in ('completed','cancelled')));
end $$;
revoke all on function public.business_overview() from public,anon;
grant execute on function public.business_overview() to authenticated;
create function public.business_workflow_version() returns integer language sql stable set search_path='' as $$select 5$$;
revoke all on function public.business_workflow_version() from public,anon;
grant execute on function public.business_workflow_version() to authenticated,service_role;
create function public.business_assignees() returns table(user_id uuid,display_name text,role text) language plpgsql security definer set search_path='' as $$
begin
 if private.business_role() is null or private.business_role() not in ('owner','manager') then raise exception 'Manager with MFA required' using errcode='42501';end if;
 return query select p.user_id,p.display_name,p.role from public.admin_profiles p where p.is_active and p.role in ('staff','manager','owner') order by p.created_at;
end $$;
revoke all on function public.business_assignees() from public,anon;
grant execute on function public.business_assignees() to authenticated;
create policy service_activity_read on public.activity_log for select to authenticated
 using(private.business_role() in ('owner','manager') and entity='service_catalogue');
