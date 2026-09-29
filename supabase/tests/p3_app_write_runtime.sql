-- Diet Copilot 2.0 P3 rollback-only runtime validation.
-- This intentionally performs writes inside one transaction, asserts behavior,
-- and rolls everything back. It leaves no nutrition records behind.

begin;

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text from private.diet_operator_owner where singleton=true),
  true
);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare
  v_result jsonb;
  v_meal_id uuid;
  v_updated_at timestamptz;
  v_saved_food uuid;
  v_saved_meal uuid;
  v_existing_meal uuid;
  v_failed boolean := false;
begin
  v_result := public.diet_app_log_meal(
    (now() at time zone 'Europe/Berlin')::date,
    'Snack',
    'P3 rollback fixture',
    '[{"name":"P3 rollback food","quantity":"1 test portion","calories":123,"protein":12.3}]'::jsonb,
    'app:test:p3:manual'
  );
  v_meal_id := (v_result->>'meal_id')::uuid;
  v_updated_at := (v_result->>'updated_at')::timestamptz;
  if v_meal_id is null then raise exception 'P3 runtime failed: manual meal missing id'; end if;

  v_result := public.diet_app_log_meal(
    (now() at time zone 'Europe/Berlin')::date,
    'Snack',
    'P3 rollback fixture',
    '[{"name":"P3 rollback food","quantity":"1 test portion","calories":123,"protein":12.3}]'::jsonb,
    'app:test:p3:manual'
  );
  if coalesce((v_result->>'idempotent_replay')::boolean,false) is not true then
    raise exception 'P3 runtime failed: retry did not replay idempotently';
  end if;

  select id into v_saved_food from public.saved_foods order by favorite desc,use_count desc limit 1;
  if v_saved_food is not null then
    v_result := public.diet_app_log_saved_food(
      v_saved_food,(now() at time zone 'Europe/Berlin')::date,'Snack',1,null,'app:test:p3:savedfood'
    );
    if v_result->>'meal_id' is null then raise exception 'P3 runtime failed: saved food'; end if;
  end if;

  select id into v_saved_meal from public.saved_meals order by favorite desc,use_count desc limit 1;
  if v_saved_meal is not null then
    v_result := public.diet_app_log_saved_meal(
      v_saved_meal,(now() at time zone 'Europe/Berlin')::date,null,1,null,'app:test:p3:savedmeal'
    );
    if v_result->>'meal_id' is null then raise exception 'P3 runtime failed: saved meal'; end if;
  end if;

  select id into v_existing_meal from public.meals where id<>v_meal_id order by created_at desc limit 1;
  if v_existing_meal is not null then
    v_result := public.diet_app_repeat_meal(
      v_existing_meal,(now() at time zone 'Europe/Berlin')::date,null,'app:test:p3:repeat'
    );
    if v_result->>'meal_id' is null then raise exception 'P3 runtime failed: repeat meal'; end if;
  end if;

  begin
    perform public.diet_app_log_meal(
      (now() at time zone 'Europe/Berlin')::date,
      'Snack','Invalid fixture',null,'app:test:p3:invalid'
    );
  exception when others then
    v_failed := true;
  end;
  if not v_failed then raise exception 'P3 runtime failed: null items were accepted'; end if;

  v_result := public.diet_app_delete_meal(v_meal_id,v_updated_at,'app:test:p3:delete');
  if coalesce((v_result->>'deleted')::boolean,false) is not true then
    raise exception 'P3 runtime failed: undo/delete';
  end if;
end $$;

rollback;

select 'diet_p3_app_write_runtime_ok' as result;
