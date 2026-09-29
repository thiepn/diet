-- Diet Copilot 2.0 P4 rollback-only runtime test.
begin;

select set_config('request.jwt.claim.sub',(select user_id::text from private.diet_operator_owner where singleton=true),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare
  v_meal jsonb;
  v_meal_id uuid;
  v_meal_updated timestamptz;
  v_saved_meal jsonb;
  v_saved_meal_id uuid;
  v_saved_food jsonb;
  v_saved_food_id uuid;
  v_food_updated timestamptz;
  v_result jsonb;
  v_failed boolean:=false;
begin
  v_meal:=public.diet_app_log_meal(
    (now() at time zone 'Europe/Berlin')::date,'Lunch','P4 rollback meal',
    '[{"name":"Rice","quantity":"200 g","calories":260,"protein":5,"carbs":56,"fat":1,"fiber":1},{"name":"Chicken","quantity":"150 g","calories":250,"protein":46,"carbs":0,"fat":5,"fiber":0}]'::jsonb,
    'app:test:p4:create'
  );
  v_meal_id:=(v_meal->>'meal_id')::uuid;
  v_meal_updated:=(v_meal->>'updated_at')::timestamptz;

  v_result:=public.diet_app_update_meal(
    v_meal_id,(now() at time zone 'Europe/Berlin')::date,'Dinner','P4 edited meal',
    '[{"name":"Rice","quantity":"180 g","calories":234,"protein":4.5,"carbs":50,"fat":1,"fiber":1},{"name":"Chicken","quantity":"170 g","calories":283,"protein":52,"carbs":0,"fat":6,"fiber":0}]'::jsonb,
    v_meal_updated,'app:test:p4:update'
  );
  if (v_result->>'calories')::numeric<>517 then raise exception 'P4 runtime failed: meal update totals'; end if;

  v_saved_meal:=public.diet_app_save_meal_from_history(v_meal_id,'P4 rollback reusable meal','app:test:p4:remember');
  v_saved_meal_id:=(v_saved_meal->>'id')::uuid;
  if v_saved_meal_id is null then raise exception 'P4 runtime failed: save meal'; end if;

  v_saved_food:=public.diet_app_save_food(
    null,null,'P4 rollback imported food','75 g',300,15,37.5,7.5,4.5,
    'Fixture Brand','1234567890123','open_food_facts','https://example.com/food.jpg','app:test:p4:food-create'
  );
  v_saved_food_id:=(v_saved_food->>'saved_food_id')::uuid;
  v_food_updated:=(v_saved_food->>'updated_at')::timestamptz;
  if v_saved_food_id is null then raise exception 'P4 runtime failed: save food'; end if;

  v_result:=public.diet_app_set_saved_food_favorite(v_saved_food_id,true,'app:test:p4:food-fav');
  if coalesce((v_result->>'favorite')::boolean,false) is not true then raise exception 'P4 runtime failed: food favorite'; end if;

  v_result:=public.diet_app_save_food(
    v_saved_food_id,v_food_updated,'P4 rollback imported food','80 g',320,16,40,8,4.8,
    'Fixture Brand','1234567890123','manual_exact','https://example.com/food.jpg','app:test:p4:food-edit'
  );
  if (v_result->>'calories')::numeric<>320 then raise exception 'P4 runtime failed: food edit'; end if;
  v_food_updated:=(v_result->>'updated_at')::timestamptz;

  v_result:=public.diet_app_set_saved_meal_favorite(v_saved_meal_id,true,'app:test:p4:meal-fav');
  if coalesce((v_result->>'favorite')::boolean,false) is not true then raise exception 'P4 runtime failed: saved meal favorite'; end if;

  begin
    perform public.diet_app_save_food(
      null,null,'P4 invalid barcode','100 g',100,10,null,null,null,null,'123','manual_exact',null,'app:test:p4:invalid'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'P4 runtime failed: invalid barcode accepted'; end if;

  v_result:=public.diet_app_delete_saved_food(v_saved_food_id,v_food_updated,'app:test:p4:food-delete');
  if coalesce((v_result->>'deleted')::boolean,false) is not true then raise exception 'P4 runtime failed: food delete'; end if;

  select updated_at into v_meal_updated from public.saved_meals where id=v_saved_meal_id;
  v_result:=public.diet_app_delete_saved_meal(v_saved_meal_id,v_meal_updated,'app:test:p4:saved-meal-delete');
  if coalesce((v_result->>'deleted')::boolean,false) is not true then raise exception 'P4 runtime failed: saved meal delete'; end if;

  select updated_at into v_meal_updated from public.meals where id=v_meal_id;
  v_result:=public.diet_app_delete_meal(v_meal_id,v_meal_updated,'app:test:p4:meal-delete');
  if coalesce((v_result->>'deleted')::boolean,false) is not true then raise exception 'P4 runtime failed: meal cleanup'; end if;
end $$;

rollback;
select 'diet_p4_food_database_runtime_ok' as result;
