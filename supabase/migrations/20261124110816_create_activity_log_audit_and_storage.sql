-- Local mirror of Supabase migration 20261124110816 (sohan-automobile, ref vxlxoiycolfojcnhnzfr)
-- Applied via the Supabase connector on 2026-11-24. Do not re-run manually against the live project.
-- 004 · append-only activity log + audit triggers + auth events + photo storage

create table public.activity_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_id    uuid,
  actor_email text,
  action      text not null,
  entity      text,
  entity_id   text,
  summary     text not null,
  changes     jsonb,
  ip          text,
  user_agent  text
);

create index activity_log_at_idx     on public.activity_log (at desc);
create index activity_log_entity_idx on public.activity_log (entity, entity_id);
create index activity_log_action_idx on public.activity_log (action);

alter table public.activity_log enable row level security;
create policy "admins read activity log" on public.activity_log for select to authenticated
  using (public.is_admin());
-- deliberately NO insert/update/delete policies: nobody but the definer-owned trigger may write.

create function public.log_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; v_changes jsonb := '{}'::jsonb;
  v_action text; v_entity_id text; v_summary text; v_label text;
  v_actor uuid; v_email text; v_ip text; v_ua text; v_headers jsonb;
begin
  v_headers := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_actor   := auth.uid();
  v_email   := coalesce(
                 nullif(current_setting('request.jwt.claim.email', true), ''),
                 nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
                 (select p.email from public.admin_profiles p where p.user_id = auth.uid()));
  v_ip := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1);
  v_ua := left(coalesce(v_headers ->> 'user-agent', ''), 300);

  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
  else
    v_new := to_jsonb(new);
    if tg_op = 'UPDATE' then v_old := to_jsonb(old); end if;
  end if;

  if v_old is not null and v_new is not null then
    v_changes := coalesce((
      select jsonb_object_agg(e.key, jsonb_build_object('from', e.value, 'to', v_new -> e.key))
      from jsonb_each(v_old) e
      where e.key not in ('created_at','updated_at')
        and (v_new -> e.key) is distinct from e.value
    ), '{}'::jsonb);
  end if;

  if tg_table_name = 'cars' then
    v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id');
    v_label := coalesce(v_new ->> 'year', v_old ->> 'year') || ' ' ||
               coalesce(v_new ->> 'make', v_old ->> 'make') || ' ' ||
               coalesce(v_new ->> 'model', v_old ->> 'model');
    if tg_op = 'INSERT' then
      v_action := 'car.create';
      v_summary := 'Added ' || v_label || ' ' || coalesce(v_new ->> 'variant', '') || ' (' || v_entity_id || ') at Rs ' || (v_new ->> 'price_lakh') || ' L';
    elsif tg_op = 'DELETE' then
      v_action := 'car.delete';
      v_summary := 'Removed ' || v_label || ' (' || v_entity_id || ')';
    elsif v_changes ? 'status' then
      v_action := 'car.status';
      v_summary := v_entity_id || ': status ' || ((v_changes -> 'status') ->> 'from') || ' -> ' || ((v_changes -> 'status') ->> 'to');
    else
      v_action := 'car.update';
      v_summary := 'Updated ' || v_label || ' (' || v_entity_id || '): ' ||
        coalesce((select string_agg(k, ', ') from jsonb_object_keys(v_changes) k), 'no field change');
    end if;
  elsif tg_table_name = 'brand_settings' then
    v_entity_id := 'brand';
    if tg_op = 'INSERT' then v_action := 'brand.init';    v_summary := 'Showroom info initialised';
    elsif tg_op = 'DELETE' then v_action := 'brand.delete'; v_summary := 'Showroom info row deleted';
    else
      v_action := 'brand.update';
      v_summary := 'Updated showroom info: ' || coalesce((select string_agg(k, ', ') from jsonb_object_keys(v_changes) k), 'no field change');
    end if;
  elsif tg_table_name = 'admin_profiles' then
    v_entity_id := coalesce(v_new ->> 'email', v_old ->> 'email');
    if tg_op = 'INSERT' then v_action := 'admin.enrolled'; v_summary := 'Admin enrolled: ' || v_entity_id || ' as ' || coalesce(v_new ->> 'role', '?');
    elsif tg_op = 'DELETE' then v_action := 'admin.removed'; v_summary := 'Admin removed: ' || v_entity_id;
    else
      v_action := 'admin.updated';
      v_summary := 'Admin updated: ' || v_entity_id || ' ' ||
        coalesce((select string_agg(k, ', ') from jsonb_object_keys(v_changes) k), '');
    end if;
  else
    v_entity_id := null; v_action := 'unknown.' || tg_op; v_summary := 'Unhandled table ' || tg_table_name;
  end if;

  insert into public.activity_log (actor_id, actor_email, action, entity, entity_id, summary, changes, ip, user_agent)
  values (v_actor, v_email, v_action, tg_table_name, v_entity_id, v_summary, v_changes, nullif(v_ip, ''), v_ua);
  return coalesce(new, old);
end $$;

create trigger cars_audit  after insert or update or delete on public.cars
  for each row execute function public.log_activity();
create trigger brand_audit after insert or update or delete on public.brand_settings
  for each row execute function public.log_activity();
create trigger admin_audit after insert or update or delete on public.admin_profiles
  for each row execute function public.log_activity();

-- every new auth user becomes a zero-privilege 'pending' profile; promotion to
-- owner/editor is a deliberate, logged act (and signup gets disabled after onboarding)
create function public.handle_new_admin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_profiles (user_id, email, role)
  values (new.id, coalesce(new.email, new.phone), 'pending')
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_admin();

-- auth event recorder: anonymous callers may only record failed attempts (flood-guarded);
-- authenticated callers record their own login/logout/password events
create function public.record_auth_event(p_action text, p_email text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text := split_part(coalesce(v_headers ->> 'x-forwarded-for', v_headers ->> 'x-real-ip', ''), ',', 1);
begin
  if p_action not in ('auth.login','auth.logout','auth.login_failed','auth.signup','auth.password_changed') then
    raise exception 'unknown auth event';
  end if;
  if p_action <> 'auth.login_failed' and auth.uid() is null then
    raise exception 'sign in to record this event';
  end if;
  if p_action = 'auth.login_failed' and (select count(*) from public.activity_log
      where action = 'auth.login_failed'
        and at > now() - interval '15 minutes'
        and ip = nullif(v_ip, '')) >= 20 then
    return;  -- flood guard: at most 20 failed-attempt rows per IP per 15 min
  end if;
  insert into public.activity_log (actor_id, actor_email, action, entity, entity_id, summary, ip, user_agent)
  values (auth.uid(),
          coalesce(p_email,
                   nullif(current_setting('request.jwt.claim.email', true), ''),
                   nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'),
          p_action, 'auth', coalesce(p_email, 'session'),
          case p_action
            when 'auth.login' then 'Signed in'
            when 'auth.logout' then 'Signed out'
            when 'auth.login_failed' then 'Failed sign-in attempt'
            when 'auth.signup' then 'Account registered'
            else 'Password changed'
          end,
          nullif(v_ip, ''), left(coalesce(v_headers ->> 'user-agent', ''), 300));
end $$;

-- photo storage: public-read bucket, admin-only writes, paths mirror assets/img naming
insert into storage.buckets (id, name, public)
values ('car-photos', 'car-photos', true)
on conflict (id) do nothing;

create policy "car photos public read" on storage.objects for select to anon, authenticated
  using (bucket_id = 'car-photos');
create policy "car photos admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'car-photos' and public.is_admin());
create policy "car photos admin update" on storage.objects for update to authenticated
  using (bucket_id = 'car-photos' and public.is_admin())
  with check (bucket_id = 'car-photos' and public.is_admin());
create policy "car photos admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'car-photos' and public.is_admin());

-- lock down the RPC surface
revoke all on function public.log_activity() from public, anon, authenticated;
revoke all on function public.handle_new_admin() from public, anon, authenticated;
revoke all on function public.record_auth_event(text, text) from public;
grant execute on function public.record_auth_event(text, text) to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
