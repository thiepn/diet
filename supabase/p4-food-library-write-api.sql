-- Diet Copilot 2.0 P4 — meal correction and food-library write façade
-- Snapshot from the canonical Supabase project after live verification.
-- Authenticated clients retain SELECT-only table grants.

CREATE OR REPLACE FUNCTION public.diet_app_delete_saved_food(p_saved_food_id uuid, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_old public.saved_foods%rowtype; v_existing jsonb; v_after jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;
  select * into v_old from public.saved_foods where id=p_saved_food_id and user_id=v_uid for update;
  if not found then raise exception 'Saved food not found'; end if;
  if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then raise exception 'Conflict: saved food changed since last read'; end if;
  delete from public.saved_foods where id=v_old.id and user_id=v_uid;
  v_after:=jsonb_build_object('deleted',true,'saved_food_id',v_old.id,'name',v_old.name);
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'food_delete','saved_food',v_old.id,to_jsonb(v_old),v_after);
  return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_delete_saved_meal(p_saved_meal_id uuid, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_old public.saved_meals%rowtype; v_existing jsonb; v_after jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;
  select * into v_old from public.saved_meals where id=p_saved_meal_id and user_id=v_uid for update;
  if not found then raise exception 'Saved meal not found'; end if;
  if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then raise exception 'Conflict: saved meal changed since last read'; end if;
  delete from public.saved_meals where id=v_old.id and user_id=v_uid;
  v_after:=jsonb_build_object('deleted',true,'saved_meal_id',v_old.id,'name',v_old.name);
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'saved_meal_delete','saved_meal',v_old.id,to_jsonb(v_old),v_after);
  return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_save_food(p_saved_food_id uuid, p_expected_updated_at timestamp with time zone, p_name text, p_quantity_text text, p_calories numeric, p_protein numeric, p_carbs numeric, p_fat numeric, p_fiber numeric, p_brand text, p_barcode text, p_source text, p_photo_url text, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_old public.saved_foods%rowtype;
  v_row public.saved_foods%rowtype;
  v_name text:=trim(coalesce(p_name,''));
  v_norm text;
  v_qty text:=nullif(trim(coalesce(p_quantity_text,'')),'');
  v_brand text:=nullif(trim(coalesce(p_brand,'')),'');
  v_barcode text:=nullif(regexp_replace(coalesce(p_barcode,''),'[^0-9]','','g'),'');
  v_source text:=lower(trim(coalesce(p_source,'manual_exact')));
  v_photo text:=nullif(trim(coalesce(p_photo_url,'')),'');
  v_confidence text;
  v_after jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  if length(v_name)<1 or length(v_name)>160 then raise exception 'Food name must be 1 to 160 characters'; end if;
  if v_qty is not null and length(v_qty)>120 then raise exception 'Quantity is too long'; end if;
  if v_brand is not null and length(v_brand)>120 then raise exception 'Brand is too long'; end if;
  if v_barcode is not null and (length(v_barcode)<8 or length(v_barcode)>14) then raise exception 'Barcode must contain 8 to 14 digits'; end if;
  if v_photo is not null and (length(v_photo)>800 or v_photo !~ '^https://') then raise exception 'Photo URL must be HTTPS'; end if;
  if v_source not in ('manual_exact','nutrition_label','open_food_facts') then raise exception 'Unsupported food source'; end if;
  if p_calories is null or p_calories<0 or p_calories>10000 then raise exception 'Calories outside allowed range'; end if;
  if coalesce(p_protein,0)<0 or coalesce(p_protein,0)>1000 then raise exception 'Protein outside allowed range'; end if;
  if p_carbs is not null and (p_carbs<0 or p_carbs>2000) then raise exception 'Carbs outside allowed range'; end if;
  if p_fat is not null and (p_fat<0 or p_fat>1000) then raise exception 'Fat outside allowed range'; end if;
  if p_fiber is not null and (p_fiber<0 or p_fiber>500) then raise exception 'Fiber outside allowed range'; end if;

  v_norm:=private.normalize_name(v_name);
  v_confidence:=case when v_source='open_food_facts' then 'medium' else 'high' end;

  if p_saved_food_id is not null then
    select * into v_old from public.saved_foods where id=p_saved_food_id and user_id=v_uid for update;
    if not found then raise exception 'Saved food not found'; end if;
  elsif v_barcode is not null then
    select * into v_old from public.saved_foods where user_id=v_uid and barcode=v_barcode order by updated_at desc limit 1 for update;
  end if;
  if not found then
    select * into v_old from public.saved_foods where user_id=v_uid and normalized_name=v_norm for update;
  end if;

  if v_old.id is not null then
    if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then
      raise exception 'Conflict: saved food changed since last read';
    end if;
    if exists(select 1 from public.saved_foods f where f.user_id=v_uid and f.normalized_name=v_norm and f.id<>v_old.id) then
      raise exception 'Another saved food already uses this name';
    end if;
    if v_barcode is not null and exists(select 1 from public.saved_foods f where f.user_id=v_uid and f.barcode=v_barcode and f.id<>v_old.id) then
      raise exception 'Barcode is already linked to another saved food';
    end if;
    update public.saved_foods set
      name=v_name,normalized_name=v_norm,quantity_text=v_qty,calories=p_calories,protein=coalesce(p_protein,0),
      carbs=p_carbs,fat=p_fat,fiber=p_fiber,brand=v_brand,barcode=v_barcode,source=v_source,
      confidence=v_confidence,photo_url=v_photo,
      verified_at=case when v_source in ('manual_exact','nutrition_label') then now() else verified_at end,
      updated_at=now()
    where id=v_old.id and user_id=v_uid returning * into v_row;
  else
    insert into public.saved_foods(
      user_id,name,normalized_name,quantity_text,calories,protein,carbs,fat,fiber,brand,barcode,
      source,confidence,photo_url,verified_at
    ) values(
      v_uid,v_name,v_norm,v_qty,p_calories,coalesce(p_protein,0),p_carbs,p_fat,p_fiber,v_brand,v_barcode,
      v_source,v_confidence,v_photo,case when v_source in ('manual_exact','nutrition_label') then now() end
    ) returning * into v_row;
  end if;

  v_after:=jsonb_strip_nulls(jsonb_build_object(
    'saved_food_id',v_row.id,'name',v_row.name,'quantity',v_row.quantity_text,
    'calories',v_row.calories,'protein',v_row.protein,'carbs',v_row.carbs,'fat',v_row.fat,'fiber',v_row.fiber,
    'brand',v_row.brand,'barcode',v_row.barcode,'source',v_row.source,'favorite',v_row.favorite,
    'photo_url',v_row.photo_url,'updated_at',v_row.updated_at
  ));
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'food_save','saved_food',v_row.id,case when v_old.id is null then null else to_jsonb(v_old) end,v_after);
  return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_save_meal_from_history(p_meal_id uuid, p_name text, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_name text:=nullif(trim(coalesce(p_name,'')),'');
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  if v_name is not null and length(v_name)>120 then raise exception 'Saved meal name is too long'; end if;
  if not exists(select 1 from public.meals m where m.id=p_meal_id and m.user_id=v_uid) then raise exception 'Meal not found'; end if;
  return private.remember_meal_from_history(p_meal_id,v_name,'{}'::text[],p_request_id);
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_set_saved_food_favorite(p_saved_food_id uuid, p_favorite boolean, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  if not exists(select 1 from public.saved_foods f where f.id=p_saved_food_id and f.user_id=v_uid) then raise exception 'Saved food not found'; end if;
  return private.set_saved_food_favorite(p_saved_food_id,coalesce(p_favorite,false),p_request_id);
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_set_saved_meal_favorite(p_saved_meal_id uuid, p_favorite boolean, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid:=auth.uid(); v_old public.saved_meals%rowtype; v_new public.saved_meals%rowtype; v_existing jsonb; v_after jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;
  select * into v_old from public.saved_meals where id=p_saved_meal_id and user_id=v_uid for update;
  if not found then raise exception 'Saved meal not found'; end if;
  update public.saved_meals set favorite=coalesce(p_favorite,false),updated_at=now()
  where id=v_old.id and user_id=v_uid returning * into v_new;
  v_after:=jsonb_build_object('saved_meal_id',v_new.id,'name',v_new.name,'favorite',v_new.favorite,'updated_at',v_new.updated_at);
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'meal_favorite_set','saved_meal',v_new.id,to_jsonb(v_old),v_after);
  return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_update_meal(p_meal_id uuid, p_log_date date, p_meal_type text, p_title text, p_items jsonb, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_tz text;
  v_today date;
  v_type text:=trim(coalesce(p_meal_type,''));
  v_title text:=trim(coalesce(p_title,''));
  v_items jsonb:='[]'::jsonb;
  v_count int;
  x jsonb;
  v_name text;
  v_qty text;
  v_cal numeric;
  v_pro numeric;
  v_carbs numeric;
  v_fat numeric;
  v_fiber numeric;
  v_saved uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  if not exists(select 1 from public.meals m where m.id=p_meal_id and m.user_id=v_uid) then raise exception 'Meal not found'; end if;

  select coalesce(reminder_timezone,'Europe/Berlin') into v_tz from public.profiles where user_id=v_uid;
  v_today:=(now() at time zone coalesce(v_tz,'Europe/Berlin'))::date;
  if p_log_date is null or p_log_date<v_today-31 or p_log_date>v_today+1 then raise exception 'Log date outside allowed range'; end if;
  if length(v_type)<1 or length(v_type)>32 then raise exception 'Meal type must be 1 to 32 characters'; end if;
  if length(v_title)<1 or length(v_title)>120 then raise exception 'Title must be 1 to 120 characters'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Items must be an array'; end if;
  v_count:=jsonb_array_length(p_items);
  if v_count<1 or v_count>25 then raise exception 'Meal must contain 1 to 25 items'; end if;

  for x in select * from jsonb_array_elements(p_items) loop
    if jsonb_typeof(x)<>'object' then raise exception 'Each item must be an object'; end if;
    v_name:=trim(coalesce(x->>'name',''));
    v_qty:=nullif(trim(coalesce(x->>'quantity','')),'');
    if length(v_name)<1 or length(v_name)>160 then raise exception 'Food name must be 1 to 160 characters'; end if;
    if v_qty is not null and length(v_qty)>120 then raise exception 'Quantity is too long'; end if;
    if not (x?'calories') or jsonb_typeof(x->'calories')<>'number' then raise exception 'Calories must be numeric'; end if;
    if (x?'protein') and jsonb_typeof(x->'protein')<>'number' then raise exception 'Protein must be numeric'; end if;
    if (x?'carbs') and jsonb_typeof(x->'carbs')<>'number' then raise exception 'Carbs must be numeric'; end if;
    if (x?'fat') and jsonb_typeof(x->'fat')<>'number' then raise exception 'Fat must be numeric'; end if;
    if (x?'fiber') and jsonb_typeof(x->'fiber')<>'number' then raise exception 'Fiber must be numeric'; end if;

    v_cal:=(x->>'calories')::numeric;
    v_pro:=coalesce((x->>'protein')::numeric,0);
    v_carbs:=nullif(x->>'carbs','')::numeric;
    v_fat:=nullif(x->>'fat','')::numeric;
    v_fiber:=nullif(x->>'fiber','')::numeric;
    if v_cal<0 or v_cal>10000 then raise exception 'Calories outside allowed range'; end if;
    if v_pro<0 or v_pro>1000 then raise exception 'Protein outside allowed range'; end if;
    if v_carbs is not null and (v_carbs<0 or v_carbs>2000) then raise exception 'Carbs outside allowed range'; end if;
    if v_fat is not null and (v_fat<0 or v_fat>1000) then raise exception 'Fat outside allowed range'; end if;
    if v_fiber is not null and (v_fiber<0 or v_fiber>500) then raise exception 'Fiber outside allowed range'; end if;

    v_saved:=nullif(x->>'saved_food_id','')::uuid;
    if v_saved is not null and not exists(select 1 from public.saved_foods f where f.id=v_saved and f.user_id=v_uid) then
      raise exception 'Saved food not found';
    end if;

    v_items:=v_items||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'saved_food_id',v_saved,'name',v_name,'quantity',v_qty,
      'calories',v_cal,'protein',v_pro,'carbs',v_carbs,'fat',v_fat,'fiber',v_fiber,
      'confidence','high','source',case when v_saved is null then 'manual_exact' else 'saved_food' end
    )));
  end loop;

  return private.update_meal(
    p_meal_id,
    jsonb_build_object(
      'log_date',p_log_date,'meal_type',v_type,'title',v_title,
      'confidence','high','source','manual_exact',
      'original_input','Edited in Diet Copilot 2.0'
    ),
    v_items,p_expected_updated_at,p_request_id
  );
end $function$;

revoke all on function public.diet_app_delete_saved_food(uuid, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_delete_saved_food(uuid, timestamp with time zone, text) to authenticated;

revoke all on function public.diet_app_delete_saved_meal(uuid, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_delete_saved_meal(uuid, timestamp with time zone, text) to authenticated;

revoke all on function public.diet_app_save_food(uuid, timestamp with time zone, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_save_food(uuid, timestamp with time zone, text, text, numeric, numeric, numeric, numeric, numeric, text, text, text, text, text) to authenticated;

revoke all on function public.diet_app_save_meal_from_history(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_save_meal_from_history(uuid, text, text) to authenticated;

revoke all on function public.diet_app_set_saved_food_favorite(uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_set_saved_food_favorite(uuid, boolean, text) to authenticated;

revoke all on function public.diet_app_set_saved_meal_favorite(uuid, boolean, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_set_saved_meal_favorite(uuid, boolean, text) to authenticated;

revoke all on function public.diet_app_update_meal(uuid, date, text, text, jsonb, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_update_meal(uuid, date, text, text, jsonb, timestamp with time zone, text) to authenticated;

