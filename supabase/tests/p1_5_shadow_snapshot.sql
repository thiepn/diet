-- Diet Copilot 2.0 P1.5
-- READ ONLY: exports the legacy Diet inputs needed for local V1 vs P1 shadow validation.
-- Do not commit the query result; it contains private nutrition/weight data.
-- This query performs no INSERT/UPDATE/DELETE and does not change RLS, auth, or schema.

with owner as (
  select private.resolve_owner() uid
),
daily as (
  select
    d.log_date::text as date,
    d.status,
    d.calorie_target,
    d.protein_target,
    count(m.id)::int as meals,
    round(sum(m.calories),2) as calories,
    round(sum(m.protein),2) as protein,
    round(sum(coalesce(m.calories_high,m.calories)-coalesce(m.calories_low,m.calories)),2) as uncertainty_kcal
  from public.daily_logs d
  join owner o on o.uid=d.user_id
  left join public.meals m on m.daily_log_id=d.id and m.user_id=d.user_id
  group by d.id,d.log_date,d.status,d.calorie_target,d.protein_target
),
weights as (
  select w.entry_date::text as date,w.weight
  from public.weight_entries w
  join owner o on o.uid=w.user_id
  order by w.entry_date
),
profile as (
  select
    p.calorie_target,p.protein_target,p.fiber_target,p.goal_weight,
    p.desired_weekly_weight_change,p.adaptive_target_enabled,
    p.adaptive_min_complete_days
  from public.profiles p
  join owner o on o.uid=p.user_id
),
phase as (
  select
    g.phase_type,g.start_date::text,g.end_date::text,
    g.calorie_target,g.protein_target,g.goal_weight,
    g.desired_weekly_weight_change
  from public.goal_phases g
  join owner o on o.uid=g.user_id
  where g.active
  order by g.start_date desc
  limit 1
)
select jsonb_build_object(
  'asOfDate',current_date::text,
  'profile',(select to_jsonb(profile) from profile),
  'phase',(select to_jsonb(phase) from phase),
  'daily',(select coalesce(jsonb_agg(to_jsonb(daily) order by date),'[]'::jsonb) from daily),
  'weights',(select coalesce(jsonb_agg(to_jsonb(weights) order by date),'[]'::jsonb) from weights),
  'v1_decision',private.get_adaptive_plan_decision(current_date,28),
  'v1_confidence',private.get_trend_confidence(current_date,28)
) as shadow_input;
