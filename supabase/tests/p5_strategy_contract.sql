-- Diet Copilot 2.0 P5 adaptive coaching security/history contract.

do $$
declare bad text;
begin
  select string_agg(distinct table_name||':'||privilege_type, ', ' order by table_name||':'||privilege_type)
  into bad
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name=any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','goal_phases','target_recommendations','ai_actions'
    ])
    and grantee='authenticated' and privilege_type<>'SELECT';
  if bad is not null then raise exception 'P5 contract failed: direct authenticated Diet writes: %',bad; end if;
end $$;

do $$
declare
  expected text[]:=array[
    'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
    'diet_app_repeat_meal','diet_app_delete_meal',
    'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
    'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
    'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal',
    'diet_app_stage_strategy_review','diet_app_resolve_strategy_review','diet_app_revert_strategy_review'
  ];
  actual text[];
  name text;
  fn oid;
begin
  foreach name in array expected loop
    select p.oid into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=name limit 1;
    if fn is null then raise exception 'P5 contract failed: missing RPC %',name; end if;
    if not (select prosecdef from pg_proc where oid=fn) then raise exception 'P5 contract failed: % is not SECURITY DEFINER',name; end if;
    if position('auth.uid()' in pg_get_functiondef(fn))=0 then raise exception 'P5 contract failed: % is not owner-bound',name; end if;
    if has_function_privilege('anon',fn,'EXECUTE') then raise exception 'P5 contract failed: anon can execute %',name; end if;
    if exists(select 1 from information_schema.role_routine_grants
      where routine_schema='public' and routine_name=name and grantee='PUBLIC' and privilege_type='EXECUTE')
    then raise exception 'P5 contract failed: PUBLIC can execute %',name; end if;
  end loop;
end $$;

do $$
declare missing text;
begin
  select string_agg(col,', ') into missing
  from unnest(array[
    'engine_version','confidence_level','confidence_score','recommended_protein',
    'recommended_fat','recommended_carbs','effective_date','resolution',
    'resolved_target','applied_phase_id'
  ]) col
  where not exists(
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='target_recommendations' and c.column_name=col
  );
  if missing is not null then raise exception 'P5 contract failed: target recommendation columns missing: %',missing; end if;
end $$;

do $$
declare enabled boolean;
begin
  select c.relrowsecurity into enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='target_recommendations';
  if enabled is not true then raise exception 'P5 contract failed: target_recommendations RLS disabled'; end if;
  if not exists(
    select 1 from pg_policies
    where schemaname='public' and tablename='target_recommendations' and cmd='SELECT'
      and 'authenticated'=any(roles)
      and qual like '%auth.uid()%user_id%'
  ) then raise exception 'P5 contract failed: owner-scoped recommendation SELECT policy missing'; end if;
end $$;

do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='diet_app_resolve_strategy_review' limit 1;
  if position('v_profile.calorie_target-v_rec.current_target' in def)=0 then
    raise exception 'P5 contract failed: stale-review target conflict guard missing';
  end if;
  if position('insert into public.goal_phases' in def)=0 or position('active=false' in def)=0 then
    raise exception 'P5 contract failed: target-period history split missing';
  end if;
end $$;

select 'diet_p5_strategy_contract_ok' as result;
