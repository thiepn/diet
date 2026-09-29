-- Diet Copilot 2.0 P10 release-candidate security contract.
-- P10 hardens clients/PWA/read behavior without expanding database authority.

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
begin
  select array_agg(routine_name order by routine_name) into actual
  from information_schema.role_routine_grants
  where routine_schema='public'
    and grantee='authenticated'
    and privilege_type='EXECUTE'
    and routine_name like 'diet_app_%';

  if actual is distinct from (select array_agg(x order by x) from unnest(expected) x) then
    raise exception 'P10 contract failed: browser RPC surface changed: %',actual;
  end if;
end $$;

do $$
begin
  if exists(
    select 1
    from information_schema.role_routine_grants
    where routine_schema='public'
      and grantee='anon'
      and privilege_type='EXECUTE'
      and routine_name like 'diet_app_%'
  ) then raise exception 'P10 contract failed: anonymous Diet app RPC execute access exists'; end if;
end $$;

do $$
declare bad text;
begin
  select string_agg(distinct table_name||':'||privilege_type, ', ' order by table_name||':'||privilege_type)
  into bad
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name=any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','goal_phases','target_recommendations',
      'activity_daily','training_distribution_settings','training_days','ai_actions'
    ])
    and grantee='authenticated'
    and privilege_type<>'SELECT';

  if bad is not null then
    raise exception 'P10 contract failed: direct authenticated writes: %',bad;
  end if;
end $$;

do $$
begin
  if exists(
    select 1
    from information_schema.role_routine_grants
    where routine_schema='public'
      and grantee='authenticated'
      and privilege_type='EXECUTE'
      and routine_name in (
        'log_meal_from_ai','update_meal_from_ai','delete_meal_from_ai',
        'log_weight_from_ai','undo_ai_action'
      )
  ) then raise exception 'P10 contract failed: legacy privileged AI mutation became browser executable'; end if;
end $$;

do $$
begin
  if exists(
    select 1 from information_schema.tables
    where table_schema='public'
      and table_name in (
        'diet_release_state','diet_client_cache','diet_offline_cache',
        'diet_write_guard','diet_pending_writes','diet_rc_audit'
      )
  ) then raise exception 'P10 contract failed: client release hardening created an unexpected persistence table'; end if;
end $$;

select 'diet_p10_release_candidate_contract_ok' as result;
