-- Local mirror of Supabase migration 20261124110740 (sohan-automobile, ref vxlxoiycolfojcnhnzfr)
-- Applied via the Supabase connector on 2026-11-24. Do not re-run manually against the live project.
-- 003 · brand_settings — the editable showroom-info singleton (id = 1)

create table public.brand_settings (
  id            integer primary key default 1 check (id = 1),
  name          text,
  tagline       text,
  phone_display text,
  phone_href    text,
  email         text,
  address_short text,
  address_city  text,
  area          text,
  map_url       text,
  services      text[] not null default '{}',   -- the services overview the admin edits
  hours         text,                           -- retires the honest-gap placeholder once real
  verified_on   date,
  updated_at    timestamptz not null default now()
);

create trigger brand_touch before update on public.brand_settings
  for each row execute function public.touch_updated_at();

alter table public.brand_settings enable row level security;

create policy "public read brand" on public.brand_settings for select to anon, authenticated
  using (true);
create policy "admins manage brand" on public.brand_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
