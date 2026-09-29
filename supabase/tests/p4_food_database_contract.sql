-- Diet Copilot 2.0 P4 secure mutation contract.

do $$
declare bad text;
begin
  select string_agg(distinct table_name||':'||privilege_type, ', ' order by table_name||':'||privilege_type)
  into bad
  from information_schema.role_table_grants
  where table_schema='public'
    and table_name=any(array[
      'profiles','daily_logs','saved_foods','saved_meals','meals','meal_items',
      'saved_meal_items','weight_entries','ai_actions','goal_phases'
    ])
    and grantee='authenticated' and privilege_type<>'SELECT';
  if bad is not null then raise exception 'P4 contract failed: direct authenticated Diet writes: %',bad; end if;
end $$;

do $$
declare
  expected text[]:=array[
    'diet_app_log_meal','diet_app_log_saved_food','diet_app_log_saved_meal',
    'diet_app_repeat_meal','diet_app_delete_meal',
    'diet_app_update_meal','diet_app_save_meal_from_history','diet_app_save_food',
    'diet_app_set_saved_food_favorite','diet_app_delete_saved_food',
    'diet_app_set_saved_meal_favorite','diet_app_delete_saved_meal'
  ];
  actual text[];
  name text;
  fn oid;
begin
  foreach name in array expected loop
    select p.oid into fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname=name limit 1;
    if fn is null then raise exception 'P4 contract failed: missing RPC %',name; end if;
    if not (select prosecdef from pg_proc where oid=fn) then raise exception 'P4 contract failed: % is not SECURITY DEFINER',name; end if;
    if position('auth.uid()' in pg_get_functiondef(fn))=0 then raise exception 'P4 contract failed: % is not owner-bound',name; end if;
    if has_function_privilege('anon',fn,'EXECUTE') then raise exception 'P4 contract failed: anon can execute %',name; end if;
    if exists(select 1 from information_schema.role_routine_grants
      where routine_schema='public' and routine_name=name and grantee='PUBLIC' and privilege_type='EXECUTE')
    then raise exception 'P4 contract failed: PUBLIC can execute %',name; end if;
  end loop;
end $$;

select 'diet_p4_food_database_contract_ok' as result;
