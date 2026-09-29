-- Diet Copilot P14 follow-up: advisor-clean RLS and FK indexing.
-- Applied to canonical project hycegznamzjhwinegaai as migration 20260929190758.

do $$
declare
  t text;
  diet_tables text[] := array[
    'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
    'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
    'target_recommendations','activity_daily','training_distribution_settings',
    'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
  ];
begin
  foreach t in array diet_tables loop
    execute format('drop policy if exists diet_p14_owner_guard on public.%I',t);
    execute format(
      'create policy diet_p14_owner_guard on public.%I as restrictive for all to authenticated using (((select auth.uid()) is not null) and coalesce(((select auth.jwt())->>''is_anonymous''),''false'') <> ''true'' and ((select auth.uid()) = user_id)) with check (((select auth.uid()) is not null) and coalesce(((select auth.jwt())->>''is_anonymous''),''false'') <> ''true'' and ((select auth.uid()) = user_id))',
      t
    );
  end loop;
end
$$;

create index if not exists meals_daily_log_owner_idx_p14
  on public.meals(daily_log_id,user_id);

create index if not exists meal_items_meal_owner_idx_p14
  on public.meal_items(meal_id,user_id);

create index if not exists meal_items_saved_food_owner_idx_p14
  on public.meal_items(saved_food_id,user_id)
  where saved_food_id is not null;

create index if not exists saved_food_portions_food_owner_idx_p14
  on public.saved_food_portions(saved_food_id,user_id);

create index if not exists saved_meal_items_meal_owner_idx_p14
  on public.saved_meal_items(saved_meal_id,user_id);

create index if not exists saved_meal_items_saved_food_owner_idx_p14
  on public.saved_meal_items(saved_food_id,user_id)
  where saved_food_id is not null;

create index if not exists target_recommendations_phase_owner_idx_p14
  on public.target_recommendations(applied_phase_id,user_id)
  where applied_phase_id is not null;

drop policy if exists diet_p14_operator_owner_deny on private.diet_operator_owner;
create policy diet_p14_operator_owner_deny
on private.diet_operator_owner
as restrictive
for all
to public
using (false)
with check (false);
