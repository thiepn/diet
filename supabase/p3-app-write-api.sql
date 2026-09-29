-- Diet Copilot 2.0 P3 — authenticated app write facade
-- Canonical tables remain SELECT-only for authenticated clients.
-- These intentional SECURITY DEFINER functions validate auth.uid(), bound inputs,
-- and delegate to the existing private owner-scoped/idempotent write core.

create or replace function public.diet_app_log_meal(
  p_log_date date,
  p_meal_type text,
  p_title text,
  p_items jsonb,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_type text := trim(coalesce(p_meal_type,''));
  v_title text := trim(coalesce(p_title,''));
  v_items jsonb := '[]'::jsonb;
  v_count integer := 0;
  v_total_cal numeric := 0;
  x jsonb;
  v_name text;
  v_qty text;
  v_cal numeric;
  v_pro numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fiber numeric;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;

  select coalesce(reminder_timezone,'Europe/Berlin') into v_tz
  from public.profiles where user_id=v_uid;
  v_today := (now() at time zone coalesce(v_tz,'Europe/Berlin'))::date;
  if p_log_date is null or p_log_date < v_today-31 or p_log_date > v_today+1 then raise exception 'Log date outside allowed range'; end if;

  if length(v_type)<1 or length(v_type)>32 then raise exception 'Meal type must be 1 to 32 characters'; end if;
  if length(v_title)<1 or length(v_title)>120 then raise exception 'Title must be 1 to 120 characters'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Items must be an array'; end if;
  v_count := jsonb_array_length(p_items);
  if v_count<1 or v_count>25 then raise exception 'Meal must contain 1 to 25 items'; end if;

  for x in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(x) <> 'object' then raise exception 'Each item must be an object'; end if;
    v_name := trim(coalesce(x->>'name',''));
    v_qty := nullif(trim(coalesce(x->>'quantity','')),'');
    if length(v_name)<1 or length(v_name)>160 then raise exception 'Food name must be 1 to 160 characters'; end if;
    if v_qty is not null and length(v_qty)>120 then raise exception 'Quantity is too long'; end if;
    if not (x ? 'calories') or jsonb_typeof(x->'calories') <> 'number' then raise exception 'Calories must be numeric'; end if;
    if (x ? 'protein') and jsonb_typeof(x->'protein') <> 'number' then raise exception 'Protein must be numeric'; end if;
    if (x ? 'carbs') and jsonb_typeof(x->'carbs') <> 'number' then raise exception 'Carbs must be numeric'; end if;
    if (x ? 'fat') and jsonb_typeof(x->'fat') <> 'number' then raise exception 'Fat must be numeric'; end if;
    if (x ? 'fiber') and jsonb_typeof(x->'fiber') <> 'number' then raise exception 'Fiber must be numeric'; end if;

    v_cal := (x->>'calories')::numeric;
    v_pro := coalesce((x->>'protein')::numeric,0);
    v_carbs := nullif(x->>'carbs','')::numeric;
    v_fat := nullif(x->>'fat','')::numeric;
    v_fiber := nullif(x->>'fiber','')::numeric;
    if v_cal<0 or v_cal>10000 then raise exception 'Calories outside allowed range'; end if;
    if v_pro<0 or v_pro>1000 then raise exception 'Protein outside allowed range'; end if;
    if v_carbs is not null and (v_carbs<0 or v_carbs>2000) then raise exception 'Carbs outside allowed range'; end if;
    if v_fat is not null and (v_fat<0 or v_fat>1000) then raise exception 'Fat outside allowed range'; end if;
    if v_fiber is not null and (v_fiber<0 or v_fiber>500) then raise exception 'Fiber outside allowed range'; end if;
    v_total_cal := v_total_cal + v_cal;

    v_items := v_items || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'name',v_name,'quantity',v_qty,'calories',v_cal,'protein',v_pro,
      'carbs',v_carbs,'fat',v_fat,'fiber',v_fiber,
      'confidence','high','source','manual_exact'
    )));
  end loop;
  if v_total_cal>20000 then raise exception 'Meal calories outside allowed range'; end if;

  return private.log_meal(
    p_log_date,v_type,v_title,v_items,'high','manual_exact',
    'Diet Copilot 2.0 manual entry','Logged from authenticated app write API',p_request_id
  );
end $$;

create or replace function public.diet_app_log_saved_food(
  p_saved_food_id uuid,
  p_log_date date,
  p_meal_type text,
  p_multiplier numeric,
  p_quantity_text text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_type text := trim(coalesce(p_meal_type,''));
  v_qty text := nullif(trim(coalesce(p_quantity_text,'')),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select coalesce(reminder_timezone,'Europe/Berlin') into v_tz from public.profiles where user_id=v_uid;
  v_today := (now() at time zone coalesce(v_tz,'Europe/Berlin'))::date;
  if p_log_date is null or p_log_date < v_today-31 or p_log_date > v_today+1 then raise exception 'Log date outside allowed range'; end if;
  if length(v_type)<1 or length(v_type)>32 then raise exception 'Meal type must be 1 to 32 characters'; end if;
  if coalesce(p_multiplier,0)<=0 or p_multiplier>20 then raise exception 'Multiplier must be > 0 and <= 20'; end if;
  if v_qty is not null and length(v_qty)>120 then raise exception 'Quantity is too long'; end if;
  if not exists(select 1 from public.saved_foods f where f.id=p_saved_food_id and f.user_id=v_uid) then raise exception 'Saved food not found'; end if;
  return private.log_saved_food_scaled(p_saved_food_id,p_log_date,v_type,p_multiplier,v_qty,p_request_id);
end $$;

create or replace function public.diet_app_log_saved_meal(
  p_saved_meal_id uuid,
  p_log_date date,
  p_meal_type text,
  p_multiplier numeric,
  p_quantity_text text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_type text := nullif(trim(coalesce(p_meal_type,'')),'');
  v_qty text := nullif(trim(coalesce(p_quantity_text,'')),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select coalesce(reminder_timezone,'Europe/Berlin') into v_tz from public.profiles where user_id=v_uid;
  v_today := (now() at time zone coalesce(v_tz,'Europe/Berlin'))::date;
  if p_log_date is null or p_log_date < v_today-31 or p_log_date > v_today+1 then raise exception 'Log date outside allowed range'; end if;
  if v_type is not null and length(v_type)>32 then raise exception 'Meal type is too long'; end if;
  if coalesce(p_multiplier,0)<=0 or p_multiplier>20 then raise exception 'Multiplier must be > 0 and <= 20'; end if;
  if v_qty is not null and length(v_qty)>120 then raise exception 'Quantity is too long'; end if;
  if not exists(select 1 from public.saved_meals m where m.id=p_saved_meal_id and m.user_id=v_uid) then raise exception 'Saved meal not found'; end if;
  return private.log_saved_meal_scaled(p_saved_meal_id,p_log_date,v_type,p_multiplier,v_qty,p_request_id);
end $$;

create or replace function public.diet_app_repeat_meal(
  p_meal_id uuid,
  p_log_date date,
  p_meal_type text,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_today date;
  v_old public.meals%rowtype;
  v_items jsonb;
  v_type text := nullif(trim(coalesce(p_meal_type,'')),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select coalesce(reminder_timezone,'Europe/Berlin') into v_tz from public.profiles where user_id=v_uid;
  v_today := (now() at time zone coalesce(v_tz,'Europe/Berlin'))::date;
  if p_log_date is null or p_log_date < v_today-31 or p_log_date > v_today+1 then raise exception 'Log date outside allowed range'; end if;
  if v_type is not null and length(v_type)>32 then raise exception 'Meal type is too long'; end if;

  select * into v_old from public.meals where id=p_meal_id and user_id=v_uid;
  if not found then raise exception 'Meal not found'; end if;

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'saved_food_id',i.saved_food_id,'name',i.name,'quantity',i.quantity_text,
    'calories',i.calories,'protein',i.protein,'carbs',i.carbs,'fat',i.fat,'fiber',i.fiber,
    'calories_low',i.calories_low,'calories_high',i.calories_high,
    'confidence',i.confidence,'source',case when i.saved_food_id is null then 'history_repeat' else 'saved_food' end
  )) order by i.sort_order),'[]'::jsonb)
  into v_items
  from public.meal_items i
  where i.meal_id=v_old.id and i.user_id=v_uid;

  if jsonb_array_length(v_items)=0 then raise exception 'Meal has no repeatable items'; end if;

  return private.log_meal(
    p_log_date,coalesce(v_type,v_old.meal_type),v_old.title,v_items,
    v_old.confidence,'history_repeat','Repeated from Diet Copilot history',
    'Repeated from authenticated app write API',p_request_id
  );
end $$;

create or replace function public.diet_app_delete_meal(
  p_meal_id uuid,
  p_expected_updated_at timestamptz,
  p_request_id text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  if not exists(select 1 from public.meals m where m.id=p_meal_id and m.user_id=v_uid) then raise exception 'Meal not found'; end if;
  return private.delete_meal(p_meal_id,p_expected_updated_at,p_request_id);
end $$;

revoke all on function public.diet_app_log_meal(date,text,text,jsonb,text) from public, anon, authenticated, service_role;
revoke all on function public.diet_app_log_saved_food(uuid,date,text,numeric,text,text) from public, anon, authenticated, service_role;
revoke all on function public.diet_app_log_saved_meal(uuid,date,text,numeric,text,text) from public, anon, authenticated, service_role;
revoke all on function public.diet_app_repeat_meal(uuid,date,text,text) from public, anon, authenticated, service_role;
revoke all on function public.diet_app_delete_meal(uuid,timestamptz,text) from public, anon, authenticated, service_role;

grant execute on function public.diet_app_log_meal(date,text,text,jsonb,text) to authenticated;
grant execute on function public.diet_app_log_saved_food(uuid,date,text,numeric,text,text) to authenticated;
grant execute on function public.diet_app_log_saved_meal(uuid,date,text,numeric,text,text) to authenticated;
grant execute on function public.diet_app_repeat_meal(uuid,date,text,text) to authenticated;
grant execute on function public.diet_app_delete_meal(uuid,timestamptz,text) to authenticated;

comment on function public.diet_app_log_meal(date,text,text,jsonb,text) is
  'Diet Copilot 2.0 authenticated app write facade. Intentional SECURITY DEFINER API; validates auth.uid and bounded manual meal input, then delegates to private.log_meal.';
comment on function public.diet_app_log_saved_food(uuid,date,text,numeric,text,text) is
  'Diet Copilot 2.0 authenticated app write facade for owner-scoped saved foods.';
comment on function public.diet_app_log_saved_meal(uuid,date,text,numeric,text,text) is
  'Diet Copilot 2.0 authenticated app write facade for owner-scoped saved meals/recipes.';
comment on function public.diet_app_repeat_meal(uuid,date,text,text) is
  'Diet Copilot 2.0 authenticated app write facade to repeat an owner-scoped historical meal.';
comment on function public.diet_app_delete_meal(uuid,timestamptz,text) is
  'Diet Copilot 2.0 authenticated app undo/delete facade with ownership and optimistic-concurrency enforcement.';
