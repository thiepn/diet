-- Diet Copilot 2.0 P0 legacy contract
-- Read-only assertions. Run against the canonical shared Supabase project before and after migration work.

do $$
declare
  expected text[] := array[
    'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
    'saved_meal_items','weight_entries','ai_actions','change_log','goal_phases',
    'target_recommendations','weekly_reviews','activity_daily',
    'saved_food_portions','diet_native_devices'
  ];
  missing text;
begin
  select string_agg(x, ', ' order by x)
    into missing
  from unnest(expected) x
  where to_regclass('public.' || quote_ident(x)) is null;

  if missing is not null then
    raise exception 'P0 contract failed: missing Diet tables: %', missing;
  end if;
end $$;

do $$
declare
  bad text;
begin
  select string_agg(c.relname, ', ' order by c.relname)
    into bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','ai_actions','change_log','goal_phases',
      'target_recommendations','weekly_reviews','activity_daily',
      'saved_food_portions','diet_native_devices'
    ])
    and not c.relrowsecurity;

  if bad is not null then
    raise exception 'P0 contract failed: RLS disabled on: %', bad;
  end if;
end $$;

do $$
declare
  bad text;
begin
  select string_agg(distinct table_name, ', ' order by table_name)
    into bad
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','ai_actions','change_log','goal_phases',
      'target_recommendations','weekly_reviews','activity_daily',
      'saved_food_portions','diet_native_devices'
    ])
    and grantee = 'anon';

  if bad is not null then
    raise exception 'P0 contract failed: anon has direct Diet table grants: %', bad;
  end if;

  select string_agg(distinct table_name || ':' || privilege_type, ', ' order by table_name || ':' || privilege_type)
    into bad
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','ai_actions','change_log','goal_phases',
      'target_recommendations','weekly_reviews','activity_daily',
      'saved_food_portions','diet_native_devices'
    ])
    and grantee = 'authenticated'
    and privilege_type <> 'SELECT';

  if bad is not null then
    raise exception 'P0 contract failed: authenticated gained direct Diet write grants: %', bad;
  end if;
end $$;

do $$
declare
  missing text;
begin
  with expected(table_name) as (
    values
      ('profiles'),('daily_logs'),('saved_foods'),('saved_meals'),('meals'),
      ('meal_items'),('saved_meal_items'),('weight_entries'),('ai_actions'),
      ('change_log'),('goal_phases'),('target_recommendations'),('weekly_reviews'),
      ('activity_daily'),('saved_food_portions'),('diet_native_devices')
  )
  select string_agg(e.table_name, ', ' order by e.table_name)
    into missing
  from expected e
  where not exists (
    select 1
    from pg_policies p
    where p.schemaname = 'public'
      and p.tablename = e.table_name
      and upper(p.cmd) = 'SELECT'
      and array_to_string(p.roles, ',') like '%authenticated%'
      and p.qual like '%auth.uid()%'
      and p.qual like '%user_id%'
  );

  if missing is not null then
    raise exception 'P0 contract failed: owner-select RLS policy missing/changed on: %', missing;
  end if;
end $$;

do $$
declare
  exposed text;
begin
  select string_agg(n.nspname || '.' || p.proname, ', ' order by n.nspname || '.' || p.proname)
    into exposed
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private')
    and p.proname in (
      'log_meal','log_saved_meal','log_saved_meal_scaled','log_weight',
      'delete_meal','update_meal','remember_meal','remember_meal_from_history',
      'accept_target_recommendation','dismiss_target_recommendation',
      'generate_target_recommendation','generate_weekly_review',
      'log_meal_from_ai','log_weight_from_ai','delete_meal_from_ai','update_meal_from_ai'
    )
    and (
      has_function_privilege('anon', p.oid, 'EXECUTE')
      or has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if exposed is not null then
    raise exception 'P0 contract failed: Diet mutation RPC exposed to client role(s): %', exposed;
  end if;
end $$;

select 'diet_p0_legacy_contract_ok' as result;
