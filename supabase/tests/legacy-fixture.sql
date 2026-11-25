-- LOCAL TEST FIXTURE ONLY. Catalog-derived shape, not a production backup or old migration replay.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
 select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)
$$;
grant usage on schema auth, storage to anon, authenticated, service_role;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
create table auth.users(id uuid primary key, email text, phone text);
create table public.admin_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null, role text not null default 'pending'
 constraint admin_profiles_role_check check(role in ('owner','editor','pending')),
 display_name text, created_at timestamptz not null default now()
);
create table public.cars(
 id text primary key, sort_order integer not null default 100, featured boolean not null default false,
 status text not null default 'available' constraint cars_status_check check(status in ('available','reserved','sold','hidden')),
 year integer not null check(year between 1980 and 2100), make text not null, model text not null, variant text not null,
 km integer not null check(km>=0), fuel text not null, transmission text, body text not null,
 price_lakh numeric not null check(price_lakh>0), price_note text, reg text not null,
 location text not null default 'Beleghata / Garden Lane, Kolkata', highlights text[] not null default '{}',
 listing_url text, overview text not null default '', photo_stock text, photos_gallery text[] not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.brand_settings(
 id integer primary key default 1 check(id=1), name text, tagline text, phone_display text, phone_href text,
 email text, address_short text, address_city text, area text, map_url text, services text[] not null default '{}',
 hours text, verified_on date, updated_at timestamptz not null default now()
);
create table public.activity_log(
 id bigint generated always as identity primary key, at timestamptz not null default now(), actor_id uuid,
 actor_email text, action text not null, entity text, entity_id text, summary text not null,
 changes jsonb, ip text, user_agent text
);
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_profiles where user_id=auth.uid() and role in ('owner','editor'))
$$;
create function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_profiles where user_id=auth.uid() and role='owner')
$$;
create function public.record_auth_event(text,text default null) returns void language sql as $$ select $$;
create function public.log_activity() returns trigger language plpgsql as $$ begin return coalesce(new,old); end $$;
create trigger admin_audit after insert or update or delete on public.admin_profiles for each row execute function public.log_activity();
create trigger cars_audit after insert or update or delete on public.cars for each row execute function public.log_activity();
create trigger brand_audit after insert or update or delete on public.brand_settings for each row execute function public.log_activity();
alter table public.admin_profiles enable row level security;
alter table public.cars enable row level security;
alter table public.brand_settings enable row level security;
alter table public.activity_log enable row level security;
create policy "admins read all profiles" on public.admin_profiles for select to authenticated using(user_id=auth.uid() or is_admin());
create policy "owner manages admins" on public.admin_profiles for all to authenticated using(is_owner()) with check(is_owner());
create policy "admins manage cars" on public.cars for all to authenticated using(is_admin()) with check(is_admin());
create policy "public read listed cars" on public.cars for select to anon,authenticated using(status in ('available','reserved','sold'));
create policy "admins manage brand" on public.brand_settings for all to authenticated using(is_admin()) with check(is_admin());
create policy "public read brand" on public.brand_settings for select to anon,authenticated using(true);
create policy "admins read activity log" on public.activity_log for select to authenticated using(is_admin());
grant all on all tables in schema public to anon,authenticated,service_role;
grant all on all sequences in schema public to anon,authenticated,service_role;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
alter table storage.objects enable row level security;
grant select,insert,update,delete on storage.objects to anon,authenticated;
create policy "car photos public read" on storage.objects for select to anon,authenticated using(bucket_id='car-photos');
create policy "car photos admin insert" on storage.objects for insert to authenticated with check(bucket_id='car-photos' and is_admin());
create policy "car photos admin update" on storage.objects for update to authenticated using(bucket_id='car-photos' and is_admin());
create policy "car photos admin delete" on storage.objects for delete to authenticated using(bucket_id='car-photos' and is_admin());
insert into storage.buckets values('car-photos','car-photos',true,null,null);

create function public.handle_new_admin() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.admin_profiles(user_id,email,role) values(new.id,coalesce(new.email,new.phone),'pending') on conflict(user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_admin();
