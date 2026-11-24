-- Local mirror of Supabase migration 20261124110731 (sohan-automobile, ref vxlxoiycolfojcnhnzfr)
-- Applied via the Supabase connector on 2026-11-24. Do not re-run manually against the live project.
-- 002 · cars — live inventory, mirrors assets/data/inventory.json

create table public.cars (
  id             text primary key,               -- slug, matches car-<id>.html
  sort_order     integer not null default 100,   -- mirrors the JSON array order
  featured       boolean not null default false, -- the "Newest on the floor" card
  status         text not null default 'available'
                 check (status in ('available','reserved','sold','hidden')),
  year           integer not null check (year between 1980 and 2100),
  make           text not null,
  model          text not null,
  variant        text not null,
  km             integer not null check (km >= 0),
  fuel           text not null,
  transmission   text,                           -- null ⇒ "Not stated" (gaps stay visible)
  body           text not null,                  -- SUV | Sedan | Hatchback | MUV
  price_lakh     numeric(6,2) not null check (price_lakh > 0),
  price_note     text,
  reg            text not null,
  location       text not null default 'Beleghata / Garden Lane, Kolkata',
  highlights     text[] not null default '{}',
  listing_url    text,
  overview       text not null default '',
  photo_stock    text,                           -- storage path; null ⇒ local asset for seeded cars
  photos_gallery text[] not null default '{}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index cars_status_idx on public.cars (status);
create index cars_sort_idx   on public.cars (sort_order);

create trigger cars_touch before update on public.cars
  for each row execute function public.touch_updated_at();

alter table public.cars enable row level security;

create policy "public read available cars" on public.cars for select to anon, authenticated
  using (status = 'available');
create policy "admins manage cars" on public.cars for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
