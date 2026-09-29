-- P16: consolidated authenticated owner reads and hot-order indexes.

create or replace function public.diet_app_read_snapshot()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  result jsonb;
begin
  if uid is null or is_anonymous then
    raise exception 'Authenticated Diet account required' using errcode='42501';
  end if;

  select jsonb_build_object(
    'profile',(
      select to_jsonb(p)
      from (
        select calorie_target,protein_target,goal_weight,fiber_target,
               desired_weekly_weight_change,adaptive_target_enabled,
               adaptive_min_complete_days,updated_at
        from public.profiles
        where user_id=uid
        limit 1
      ) p
    ),
    'dailyLogs',coalesce((
      select jsonb_agg(to_jsonb(d) order by d.log_date)
      from (
        select id,log_date,calorie_target,protein_target,status,notes,updated_at
        from public.daily_logs
        where user_id=uid
        order by log_date
      ) d
    ),'[]'::jsonb),
    'meals',coalesce((
      select jsonb_agg(to_jsonb(m) order by m.eaten_at,m.id)
      from (
        select id,daily_log_id,meal_type,title,calories,protein,confidence,source,
               calories_low,calories_high,eaten_at,created_at,updated_at
        from public.meals
        where user_id=uid
        order by eaten_at,id
      ) m
    ),'[]'::jsonb),
    'mealItems',coalesce((
      select jsonb_agg(to_jsonb(i) order by i.meal_id,i.sort_order,i.id)
      from (
        select id,meal_id,saved_food_id,name,quantity_text,calories,protein,
               carbs,fat,fiber,calories_low,calories_high,confidence,source,
               sort_order,updated_at
        from public.meal_items
        where user_id=uid
        order by meal_id,sort_order,id
      ) i
    ),'[]'::jsonb),
    'weights',coalesce((
      select jsonb_agg(to_jsonb(w) order by w.entry_date,w.id)
      from (
        select id,entry_date,weight,created_at,updated_at
        from public.weight_entries
        where user_id=uid
        order by entry_date,id
      ) w
    ),'[]'::jsonb),
    'goalPhases',coalesce((
      select jsonb_agg(to_jsonb(g) order by g.start_date,g.created_at)
      from (
        select phase_type,start_date,end_date,calorie_target,protein_target,
               goal_weight,desired_weekly_weight_change,active,created_at,updated_at
        from public.goal_phases
        where user_id=uid
        order by start_date,created_at
      ) g
    ),'[]'::jsonb),
    'savedFoods',coalesce((
      select jsonb_agg(to_jsonb(f) order by f.favorite desc,f.use_count desc,f.last_used_at desc nulls last,f.id)
      from (
        select id,name,quantity_text,calories,protein,carbs,fat,fiber,brand,
               barcode,favorite,use_count,last_used_at,verified_at,source,
               photo_url,updated_at
        from public.saved_foods
        where user_id=uid
        order by favorite desc,use_count desc,last_used_at desc nulls last,id
      ) f
    ),'[]'::jsonb),
    'savedMeals',coalesce((
      select jsonb_agg(to_jsonb(s) order by s.favorite desc,s.use_count desc,s.last_used_at desc nulls last,s.id)
      from (
        select id,name,meal_type,calories,protein,carbs,fat,fiber,favorite,
               use_count,last_used_at,is_recipe,servings,serving_text,updated_at
        from public.saved_meals
        where user_id=uid
        order by favorite desc,use_count desc,last_used_at desc nulls last,id
      ) s
    ),'[]'::jsonb),
    'targetRecommendations',coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select id,generated_on,lookback_days,complete_days,logged_days,
               weigh_in_count,avg_calories,weekly_weight_change,
               estimated_maintenance,desired_weekly_weight_change,current_target,
               raw_recommended_target,recommended_target,rationale,status,
               created_at,resolved_at,decision_payload,engine_version,
               confidence_level,confidence_score,recommended_protein,
               recommended_fat,recommended_carbs,effective_date,resolution,
               resolved_target,applied_phase_id
        from public.target_recommendations
        where user_id=uid
        order by created_at desc
        limit 20
      ) r
    ),'[]'::jsonb),
    'activityDaily',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.activity_date desc)
      from (
        select activity_date,steps,active_calories,exercise_minutes,distance_km,
               resting_heart_rate,source,synced_at,updated_at
        from public.activity_daily
        where user_id=uid
        order by activity_date desc
        limit 120
      ) a
    ),'[]'::jsonb),
    'trainingDistribution',(
      select to_jsonb(td)
      from (
        select enabled,weekly_template,hard_extra_kcal,moderate_extra_kcal,
               light_extra_kcal,updated_at
        from public.training_distribution_settings
        where user_id=uid
        limit 1
      ) td
    ),
    'trainingDays',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.training_date desc)
      from (
        select id,training_date,day_type,status,title,duration_minutes,source,
               notes,created_at,updated_at
        from public.training_days
        where user_id=uid
        order by training_date desc
        limit 180
      ) t
    ),'[]'::jsonb)
  ) into result;

  return result;
end
$$;

revoke all on function public.diet_app_read_snapshot() from public,anon;
grant execute on function public.diet_app_read_snapshot() to authenticated,service_role;

comment on function public.diet_app_read_snapshot() is
'Diet P16 consolidated authenticated owner read. SECURITY INVOKER: P14 RLS remains authoritative; explicit owner predicates improve planning and reduce HTTP round trips.';

create index if not exists meal_items_owner_sort_p16
  on public.meal_items(user_id,meal_id,sort_order,id);

create index if not exists saved_foods_owner_rank_p16
  on public.saved_foods(user_id,favorite desc,use_count desc,last_used_at desc nulls last,id);

create index if not exists saved_meals_owner_rank_p16
  on public.saved_meals(user_id,favorite desc,use_count desc,last_used_at desc nulls last,id);

analyze public.meal_items;
analyze public.saved_foods;
analyze public.saved_meals;
analyze public.daily_logs;
analyze public.meals;
analyze public.weight_entries;
analyze public.goal_phases;
analyze public.target_recommendations;
analyze public.activity_daily;
analyze public.training_days;
