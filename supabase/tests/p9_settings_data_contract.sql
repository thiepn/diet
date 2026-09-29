-- Diet Copilot 2.0 P9 settings/data-controls boundary contract.
-- P9 is intentionally client-side: no new Diet mutation RPCs, settings tables, or export tables.

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
    raise exception 'P9 contract failed: Diet browser RPC surface changed: %',actual;
  end if;
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
    raise exception 'P9 contract failed: direct authenticated Diet writes detected: %',bad;
  end if;
end $$;

do $$
declare bad text;
begin
  select string_agg(table_name, ', ' order by table_name)
  into bad
  from information_schema.tables
  where table_schema='public'
    and table_name in (
      'diet_settings','diet_preferences','diet_exports','diet_backups',
      'copilot_messages','copilot_threads','copilot_history','copilot_actions'
    );

  if bad is not null then
    raise exception 'P9 contract failed: unexpected persisted client settings/export table: %',bad;
  end if;
end $$;

do $$
declare bad text;
begin
  select string_agg(routine_name, ', ' order by routine_name)
  into bad
  from information_schema.routines
  where routine_schema='public'
    and (
      routine_name like 'diet_app_%setting%'
      or routine_name like 'diet_app_%export%'
      or routine_name like 'diet_app_%backup%'
    );

  if bad is not null then
    raise exception 'P9 contract failed: settings/export RPC added unexpectedly: %',bad;
  end if;
end $$;

select 'diet_p9_settings_data_contract_ok' as result;
