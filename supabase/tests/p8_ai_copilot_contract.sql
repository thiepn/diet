-- Diet Copilot 2.0 P8 AI Copilot database boundary contract.

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
  where routine_schema='public' and grantee='authenticated' and privilege_type='EXECUTE'
    and routine_name like 'diet_app_%';

  if actual is distinct from (select array_agg(x order by x) from unnest(expected) x) then
    raise exception 'P8 contract failed: Copilot expanded or changed the browser database RPC surface: %',actual;
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
    and grantee='authenticated' and privilege_type<>'SELECT';
  if bad is not null then raise exception 'P8 contract failed: direct authenticated Diet writes: %',bad; end if;
end $$;

do $$
declare bad text;
begin
  select string_agg(routine_name, ', ' order by routine_name)
  into bad
  from information_schema.role_routine_grants
  where routine_schema='public'
    and grantee='authenticated'
    and privilege_type='EXECUTE'
    and routine_name in (
      'log_meal_from_ai','update_meal_from_ai','delete_meal_from_ai',
      'log_weight_from_ai','undo_ai_action'
    );
  if bad is not null then
    raise exception 'P8 contract failed: legacy privileged AI RPC became browser-executable: %',bad;
  end if;
end $$;

do $$
begin
  if exists(
    select 1 from information_schema.tables
    where table_schema='public'
      and table_name in ('copilot_messages','copilot_threads','copilot_history','copilot_actions')
  ) then raise exception 'P8 contract failed: Copilot conversation/action state must not become a new canonical public table'; end if;

  if exists(
    select 1 from information_schema.routines
    where routine_schema='public'
      and routine_name like 'diet_app_%copilot%'
  ) then raise exception 'P8 contract failed: Copilot must reuse the existing allowlisted application write API'; end if;
end $$;

select 'diet_p8_ai_copilot_contract_ok' as result;
