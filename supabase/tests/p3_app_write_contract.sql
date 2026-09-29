-- Diet Copilot 2.0 P3 secure browser-write contract.
-- Read-only assertions: canonical Diet tables stay SELECT-only while exactly
-- five audited app RPC façades are callable by authenticated users.

do $$
declare
  bad text;
begin
  select string_agg(distinct table_name || ':' || privilege_type, ', ' order by table_name || ':' || privilege_type)
    into bad
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name = any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','ai_actions','goal_phases'
    ])
    and grantee='authenticated'
    and privilege_type<>'SELECT';

  if bad is not null then
    raise exception 'P3 contract failed: authenticated gained direct Diet table writes: %', bad;
  end if;
end $$;

do $$
declare
  expected text[] := array[
    'diet_app_log_meal',
    'diet_app_log_saved_food',
    'diet_app_log_saved_meal',
    'diet_app_repeat_meal',
    'diet_app_delete_meal'
  ];
  name text;
  fn oid;
begin
  foreach name in array expected loop
    select p.oid into fn
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=name
    limit 1;

    if fn is null then raise exception 'P3 contract failed: missing RPC %', name; end if;
    if not (select p.prosecdef from pg_proc p where p.oid=fn) then
      raise exception 'P3 contract failed: % must be SECURITY DEFINER', name;
    end if;
    if not has_function_privilege('authenticated',fn,'EXECUTE') then
      raise exception 'P3 contract failed: authenticated cannot execute %', name;
    end if;
    if has_function_privilege('anon',fn,'EXECUTE') then
      raise exception 'P3 contract failed: anon can execute %', name;
    end if;
    if has_function_privilege('PUBLIC',fn,'EXECUTE') then
      raise exception 'P3 contract failed: PUBLIC can execute %', name;
    end if;
    if position('auth.uid()' in pg_get_functiondef(fn))=0 then
      raise exception 'P3 contract failed: % does not explicitly bind ownership to auth.uid()', name;
    end if;
    if position('SET search_path TO ''''' in pg_get_functiondef(fn))=0
       and position('SET search_path = ''''' in pg_get_functiondef(fn))=0 then
      raise exception 'P3 contract failed: % does not pin an empty search_path', name;
    end if;
  end loop;
end $$;

do $$
declare
  exposed text;
begin
  select string_agg(n.nspname||'.'||p.proname, ', ' order by n.nspname||'.'||p.proname)
    into exposed
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
    and p.proname in (
      'log_meal','log_saved_food','log_saved_food_scaled','log_saved_meal','log_saved_meal_scaled',
      'log_weight','delete_meal','update_meal','remember_meal','remember_meal_from_history',
      'log_meal_from_ai','log_weight_from_ai','delete_meal_from_ai','update_meal_from_ai'
    )
    and has_function_privilege('authenticated',p.oid,'EXECUTE');

  if exposed is not null then
    raise exception 'P3 contract failed: legacy/service mutation RPC exposed directly: %', exposed;
  end if;
end $$;

select 'diet_p3_app_write_contract_ok' as result;
