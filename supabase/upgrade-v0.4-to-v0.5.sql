-- Diet Copilot V0.4 -> V0.5 release-candidate hardening
-- Run as the project owner in Supabase SQL Editor.

alter table public.weight_entries
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.diet_copilot_touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.diet_copilot_touch_updated_at() from public, anon;
grant execute on function public.diet_copilot_touch_updated_at() to authenticated;

drop trigger if exists diet_copilot_touch_updated_at on public.weight_entries;
create trigger diet_copilot_touch_updated_at
before update on public.weight_entries
for each row execute function public.diet_copilot_touch_updated_at();

create or replace function public.diet_copilot_enforce_relation_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_table_name = 'meals' then
    if not exists (select 1 from public.daily_logs d where d.id = new.daily_log_id and d.user_id = new.user_id) then
      raise exception 'daily_log_id must belong to the same user';
    end if;
  elsif tg_table_name = 'meal_items' then
    if not exists (select 1 from public.meals m where m.id = new.meal_id and m.user_id = new.user_id) then
      raise exception 'meal_id must belong to the same user';
    end if;
    if new.saved_food_id is not null and not exists (select 1 from public.saved_foods f where f.id = new.saved_food_id and f.user_id = new.user_id) then
      raise exception 'saved_food_id must belong to the same user';
    end if;
  elsif tg_table_name = 'saved_meal_items' then
    if not exists (select 1 from public.saved_meals sm where sm.id = new.saved_meal_id and sm.user_id = new.user_id) then
      raise exception 'saved_meal_id must belong to the same user';
    end if;
    if new.saved_food_id is not null and not exists (select 1 from public.saved_foods f where f.id = new.saved_food_id and f.user_id = new.user_id) then
      raise exception 'saved_food_id must belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.diet_copilot_enforce_relation_owner() from public, anon;
grant execute on function public.diet_copilot_enforce_relation_owner() to authenticated;

drop trigger if exists diet_copilot_owner_guard on public.meals;
create trigger diet_copilot_owner_guard before insert or update of user_id, daily_log_id on public.meals for each row execute function public.diet_copilot_enforce_relation_owner();
drop trigger if exists diet_copilot_owner_guard on public.meal_items;
create trigger diet_copilot_owner_guard before insert or update of user_id, meal_id, saved_food_id on public.meal_items for each row execute function public.diet_copilot_enforce_relation_owner();
drop trigger if exists diet_copilot_owner_guard on public.saved_meal_items;
create trigger diet_copilot_owner_guard before insert or update of user_id, saved_meal_id, saved_food_id on public.saved_meal_items for each row execute function public.diet_copilot_enforce_relation_owner();

create or replace function public.diet_copilot_healthcheck()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_meal_parent_mismatch integer;
  v_item_parent_mismatch integer;
  v_saved_item_parent_mismatch integer;
  v_item_food_mismatch integer;
  v_saved_item_food_mismatch integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select count(*) into v_meal_parent_mismatch from public.meals m where m.user_id=v_uid and not exists (select 1 from public.daily_logs d where d.id=m.daily_log_id and d.user_id=v_uid);
  select count(*) into v_item_parent_mismatch from public.meal_items i where i.user_id=v_uid and not exists (select 1 from public.meals m where m.id=i.meal_id and m.user_id=v_uid);
  select count(*) into v_saved_item_parent_mismatch from public.saved_meal_items i where i.user_id=v_uid and not exists (select 1 from public.saved_meals sm where sm.id=i.saved_meal_id and sm.user_id=v_uid);
  select count(*) into v_item_food_mismatch from public.meal_items i where i.user_id=v_uid and i.saved_food_id is not null and not exists (select 1 from public.saved_foods f where f.id=i.saved_food_id and f.user_id=v_uid);
  select count(*) into v_saved_item_food_mismatch from public.saved_meal_items i where i.user_id=v_uid and i.saved_food_id is not null and not exists (select 1 from public.saved_foods f where f.id=i.saved_food_id and f.user_id=v_uid);
  return jsonb_build_object(
    'schema_version',5,
    'generated_at',now(),
    'counts',jsonb_build_object(
      'daily_logs',(select count(*) from public.daily_logs where user_id=v_uid),
      'meals',(select count(*) from public.meals where user_id=v_uid),
      'meal_items',(select count(*) from public.meal_items where user_id=v_uid),
      'saved_foods',(select count(*) from public.saved_foods where user_id=v_uid),
      'saved_meals',(select count(*) from public.saved_meals where user_id=v_uid),
      'weights',(select count(*) from public.weight_entries where user_id=v_uid),
      'ai_actions',(select count(*) from public.ai_actions where user_id=v_uid)
    ),
    'integrity',jsonb_build_object(
      'meal_parent_mismatch',v_meal_parent_mismatch,
      'meal_item_parent_mismatch',v_item_parent_mismatch,
      'saved_meal_item_parent_mismatch',v_saved_item_parent_mismatch,
      'meal_item_saved_food_mismatch',v_item_food_mismatch,
      'saved_meal_item_saved_food_mismatch',v_saved_item_food_mismatch
    ),
    'capabilities',jsonb_build_object(
      'get_diet_context',to_regprocedure('public.get_diet_context(date,integer)') is not null,
      'search_diet_history',to_regprocedure('public.search_diet_history(text,integer,integer)') is not null,
      'log_meal_from_ai',to_regprocedure('public.log_meal_from_ai(date,text,text,jsonb,text,text,text,text,text)') is not null,
      'update_meal_from_ai',to_regprocedure('public.update_meal_from_ai(uuid,jsonb,jsonb,timestamptz,text)') is not null,
      'delete_meal_from_ai',to_regprocedure('public.delete_meal_from_ai(uuid,timestamptz,text)') is not null,
      'log_weight_from_ai',to_regprocedure('public.log_weight_from_ai(date,numeric,text,text)') is not null,
      'undo_ai_action',to_regprocedure('public.undo_ai_action(uuid)') is not null
    )
  );
end;
$$;

revoke all on function public.diet_copilot_healthcheck() from public, anon;
grant execute on function public.diet_copilot_healthcheck() to authenticated;
