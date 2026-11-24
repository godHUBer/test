-- Local mirror of Supabase migration 20261124110941 (sohan-automobile, ref vxlxoiycolfojcnhnzfr)
-- Applied via the Supabase connector on 2026-11-24. Do not re-run manually against the live project.
-- 005 · fix operator precedence in log_activity summaries
-- || and ->> share one precedence level in PostgreSQL, so jsonb extractions
-- participating in string concatenation must be parenthesised.

create or replace function public.log_activity() returns trigger
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

revoke all on function public.log_activity() from public, anon, authenticated;
