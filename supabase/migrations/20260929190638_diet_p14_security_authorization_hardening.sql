-- Diet Copilot P14: Production Security, Authorization & Database Hardening
-- Applied to canonical project hycegznamzjhwinegaai as migration 20260929190638.
-- Scope is limited to Diet-owned tables and public diet_app_* RPCs.

create or replace function private.diet_p14_enforce_session_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_claims jsonb := auth.jwt();
  v_role text := coalesce(v_claims->>'role','');
  v_is_anonymous boolean := coalesce(v_claims->>'is_anonymous','false') = 'true';
  v_row_user uuid;
begin
  if v_is_anonymous then
    raise exception 'Anonymous Diet access is not permitted'
      using errcode = '42501';
  end if;

  if v_uid is null then
    if v_role = 'service_role' or session_user in ('postgres','supabase_admin') then
      if tg_op = 'DELETE' then return old; else return new; end if;
    end if;
    raise exception 'Authenticated Diet session required'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    v_row_user := old.user_id;
  else
    v_row_user := new.user_id;
  end if;

  if v_row_user is distinct from v_uid then
    raise exception 'Diet row ownership mismatch'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end
$$;

revoke all on function private.diet_p14_enforce_session_owner() from public, anon, authenticated;
grant execute on function private.diet_p14_enforce_session_owner() to service_role;

do $$
declare
  t text;
  diet_tables text[] := array[
    'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
    'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
    'target_recommendations','activity_daily','training_distribution_settings',
    'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
  ];
begin
  foreach t in array diet_tables loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all privileges on table public.%I from anon',t);
    execute format('revoke insert, update, delete, truncate, references, trigger on table public.%I from authenticated',t);
    execute format('grant select on table public.%I to authenticated',t);

    execute format('drop policy if exists diet_p14_owner_guard on public.%I',t);
    execute format(
      'create policy diet_p14_owner_guard on public.%I as restrictive for all to authenticated using (((select auth.uid()) is not null) and coalesce((select auth.jwt()->>''is_anonymous''),''false'') <> ''true'' and ((select auth.uid()) = user_id)) with check (((select auth.uid()) is not null) and coalesce((select auth.jwt()->>''is_anonymous''),''false'') <> ''true'' and ((select auth.uid()) = user_id))',
      t
    );

    execute format('drop trigger if exists diet_p14_session_owner_guard on public.%I',t);
    execute format(
      'create trigger diet_p14_session_owner_guard before insert or update or delete on public.%I for each row execute function private.diet_p14_enforce_session_owner()',
      t
    );
  end loop;
end
$$;

do $$
declare
  r record;
  sig text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'diet_app_%'
  loop
    sig := r.oid::regprocedure::text;
    execute format('revoke all on function %s from public, anon',sig);
    execute format('grant execute on function %s to authenticated',sig);
    execute format('alter function %s set search_path = ''''',sig);
    execute format(
      'comment on function %s is %L',
      sig,
      'Diet P14: intentional authenticated SECURITY DEFINER RPC. PUBLIC/anon execution revoked; wrapper binds operations to auth.uid(); table-level session-owner guard provides defense in depth.'
    );
  end loop;
end
$$;

alter table public.daily_logs
  add constraint daily_logs_id_user_id_key_p14 unique (id,user_id);
alter table public.meals
  add constraint meals_id_user_id_key_p14 unique (id,user_id);
alter table public.saved_foods
  add constraint saved_foods_id_user_id_key_p14 unique (id,user_id);
alter table public.saved_meals
  add constraint saved_meals_id_user_id_key_p14 unique (id,user_id);
alter table public.goal_phases
  add constraint goal_phases_id_user_id_key_p14 unique (id,user_id);

alter table public.meals
  add constraint meals_daily_log_owner_fkey_p14
  foreign key (daily_log_id,user_id)
  references public.daily_logs(id,user_id)
  on delete cascade
  not valid;

alter table public.meal_items
  add constraint meal_items_meal_owner_fkey_p14
  foreign key (meal_id,user_id)
  references public.meals(id,user_id)
  on delete cascade
  not valid;

alter table public.saved_food_portions
  add constraint saved_food_portions_food_owner_fkey_p14
  foreign key (saved_food_id,user_id)
  references public.saved_foods(id,user_id)
  on delete cascade
  not valid;

alter table public.saved_meal_items
  add constraint saved_meal_items_meal_owner_fkey_p14
  foreign key (saved_meal_id,user_id)
  references public.saved_meals(id,user_id)
  on delete cascade
  not valid;

alter table public.meal_items
  add constraint meal_items_saved_food_owner_fkey_p14
  foreign key (saved_food_id,user_id)
  references public.saved_foods(id,user_id)
  on delete set null (saved_food_id)
  not valid;

alter table public.saved_meal_items
  add constraint saved_meal_items_saved_food_owner_fkey_p14
  foreign key (saved_food_id,user_id)
  references public.saved_foods(id,user_id)
  on delete set null (saved_food_id)
  not valid;

alter table public.target_recommendations
  add constraint target_recommendations_phase_owner_fkey_p14
  foreign key (applied_phase_id,user_id)
  references public.goal_phases(id,user_id)
  on delete set null (applied_phase_id)
  not valid;

alter table public.meals validate constraint meals_daily_log_owner_fkey_p14;
alter table public.meal_items validate constraint meal_items_meal_owner_fkey_p14;
alter table public.saved_food_portions validate constraint saved_food_portions_food_owner_fkey_p14;
alter table public.saved_meal_items validate constraint saved_meal_items_meal_owner_fkey_p14;
alter table public.meal_items validate constraint meal_items_saved_food_owner_fkey_p14;
alter table public.saved_meal_items validate constraint saved_meal_items_saved_food_owner_fkey_p14;
alter table public.target_recommendations validate constraint target_recommendations_phase_owner_fkey_p14;
