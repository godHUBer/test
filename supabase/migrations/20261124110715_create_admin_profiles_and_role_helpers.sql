-- Local mirror of Supabase migration 20261124110715 (sohan-automobile, ref vxlxoiycolfojcnhnzfr)
-- Applied via the Supabase connector on 2026-11-24. Do not re-run manually against the live project.
-- 001 · admin profiles + role helpers
-- Must exist before any policy references public.is_admin().

create table public.admin_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  role         text not null default 'pending' check (role in ('owner','editor','pending')),
  display_name text,
  created_at   timestamptz not null default now()
);
alter table public.admin_profiles enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.role in ('owner','editor')
  )
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_profiles p
    where p.user_id = auth.uid() and p.role = 'owner'
  )
$$;

create policy "admins read all profiles" on public.admin_profiles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "owner manages admins" on public.admin_profiles for all to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- shared updated_at touch, used by cars and brand_settings
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- the role helpers must not be callable as unauthenticated RPCs
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.is_owner() from public, anon;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
