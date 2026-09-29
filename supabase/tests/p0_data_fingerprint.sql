-- Diet Copilot 2.0 migration fingerprint
-- Read-only. Capture immediately before a migration and again immediately after.
-- Hashes include all columns and rows. Normal app usage between captures will legitimately change them.

select * from (
  select 'activity_daily' table_name, count(*) row_count, md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) fingerprint from public.activity_daily t
  union all select 'ai_actions',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.ai_actions t
  union all select 'change_log',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.change_log t
  union all select 'daily_logs',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.daily_logs t
  union all select 'diet_native_devices',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.diet_native_devices t
  union all select 'goal_phases',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.goal_phases t
  union all select 'meal_items',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.meal_items t
  union all select 'meals',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.meals t
  union all select 'profiles',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.profiles t
  union all select 'saved_food_portions',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.saved_food_portions t
  union all select 'saved_foods',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.saved_foods t
  union all select 'saved_meal_items',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.saved_meal_items t
  union all select 'saved_meals',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.saved_meals t
  union all select 'target_recommendations',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.target_recommendations t
  union all select 'weekly_reviews',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.weekly_reviews t
  union all select 'weight_entries',count(*),md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.weight_entries t
) s
order by table_name;

select
  count(*) as auth_user_count,
  md5(coalesce(string_agg(id::text, ',' order by id::text),'')) as auth_user_id_fingerprint
from auth.users;

select
  (select count(*) from public.account_profiles) as account_profile_count,
  (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.account_profiles t) as account_profiles_fingerprint,
  (select count(*) from public.account_user_apps) as account_user_apps_count,
  (select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.account_user_apps t) as account_user_apps_fingerprint;
