-- Diet Copilot 2.0 P6 training/activity security contract.

do $$
declare bad text;
begin
  select string_agg(distinct table_name||':'||privilege_type, ', ' order by table_name||':'||privilege_type)
  into bad
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name=any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','goal_phases','target_recommendations','ai_actions',
      'activity_daily','training_distribution_settings','training_days'
    ])
    and grantee='authenticated' and privilege_type<>'SELECT';
  if bad is not null then raise exception 'P6 contract failed: direct authenticated Diet writes: %',bad; end if;
end $$;

do $$
declare
  expected text[]:=array[
    'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
    'diet_app_repeat_meal','diet_app_delete_meal',
    'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
    'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
    'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal',
    'diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review',
    'diet_app_save_training_distribution','diet_app_upsert_training_day','diet_app_delete_training_day'
  ];
  actual text[];
  name text;
  fn oid;
begin
  select array_agg(routine_name order by routine_name) into actual
  from information_schema.role_routine_grants
  where routine_schema='public' and grantee='authenticated' and privilege_type='EXECUTE'
    and routine_name like 'diet_app_%';

  if actual is distinct from (select array_agg(x order by x) from unnest(expected) x) then
    raise exception 'P6 contract failed: unexpected authenticated app RPC set: %',actual;
  end if;

  foreach name in array expected loop
    select p.oid into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=name limit 1;
    if fn is null then raise exception 'P6 contract failed: missing RPC %',name; end if;
    if not (select prosecdef from pg_proc where oid=fn) then raise exception 'P6 contract failed: % is not SECURITY DEFINER',name; end if;
    if position('auth.uid()' in pg_get_functiondef(fn))=0 then raise exception 'P6 contract failed: % is not owner-bound',name; end if;
    if has_function_privilege('anon',fn,'EXECUTE') then raise exception 'P6 contract failed: anon can execute %',name; end if;
    if exists(select 1 from information_schema.role_routine_grants
      where routine_schema='public' and routine_name=name and grantee='PUBLIC' and privilege_type='EXECUTE')
    then raise exception 'P6 contract failed: PUBLIC can execute %',name; end if;
  end loop;
end $$;

do $$
declare t text; enabled boolean;
begin
  foreach t in array array['activity_daily','training_distribution_settings','training_days'] loop
    select c.relrowsecurity into enabled
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=t;
    if enabled is not true then raise exception 'P6 contract failed: RLS disabled on %',t; end if;
    if not exists(
      select 1 from pg_policies
      where schemaname='public' and tablename=t and cmd='SELECT'
        and 'authenticated'=any(roles) and qual like '%auth.uid()%user_id%'
    ) then raise exception 'P6 contract failed: owner SELECT policy missing on %',t; end if;
  end loop;
end $$;

do $$
begin
  if not exists(
    select 1 from pg_indexes
    where schemaname='public' and tablename='training_days'
      and indexdef ilike '%unique%user_id%training_date%'
  ) then raise exception 'P6 contract failed: one training classification per user/date is not enforced'; end if;

  if exists(
    select 1 from information_schema.routines
    where routine_schema='public' and routine_name like 'diet_app_%activity%'
  ) then raise exception 'P6 contract failed: browser activity write RPC unexpectedly exposed'; end if;
end $$;

select 'diet_p6_training_activity_contract_ok' as result;
