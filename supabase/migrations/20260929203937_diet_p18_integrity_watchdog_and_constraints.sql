
-- P18: production data integrity, consistency and corruption-detection hardening.

do $ddl$
begin
  if not exists (select 1 from pg_constraint where conname='meals_nutrition_integrity_p18') then
    alter table public.meals add constraint meals_nutrition_integrity_p18 check (
      calories>=0 and protein>=0
      and (carbs is null or carbs>=0) and (fat is null or fat>=0) and (fiber is null or fiber>=0)
      and (calories_low is null or calories_low>=0) and (calories_high is null or calories_high>=0)
      and (calories_low is null or calories>=calories_low)
      and (calories_high is null or calories<=calories_high)
      and (calories_low is null or calories_high is null or calories_low<=calories_high)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='meal_items_nutrition_integrity_p18') then
    alter table public.meal_items add constraint meal_items_nutrition_integrity_p18 check (
      calories>=0 and protein>=0
      and (carbs is null or carbs>=0) and (fat is null or fat>=0) and (fiber is null or fiber>=0)
      and (calories_low is null or calories_low>=0) and (calories_high is null or calories_high>=0)
      and (calories_low is null or calories>=calories_low)
      and (calories_high is null or calories<=calories_high)
      and (calories_low is null or calories_high is null or calories_low<=calories_high)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='saved_foods_nutrition_integrity_p18') then
    alter table public.saved_foods add constraint saved_foods_nutrition_integrity_p18 check (
      calories>=0 and protein>=0
      and (carbs is null or carbs>=0) and (fat is null or fat>=0) and (fiber is null or fiber>=0)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='saved_meals_nutrition_integrity_p18') then
    alter table public.saved_meals add constraint saved_meals_nutrition_integrity_p18 check (
      (calories is null or calories>=0) and (protein is null or protein>=0)
      and (carbs is null or carbs>=0) and (fat is null or fat>=0) and (fiber is null or fiber>=0)
      and (servings is null or servings>0)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='saved_meal_items_nutrition_integrity_p18') then
    alter table public.saved_meal_items add constraint saved_meal_items_nutrition_integrity_p18 check (
      calories>=0 and protein>=0
      and (carbs is null or carbs>=0) and (fat is null or fat>=0) and (fiber is null or fiber>=0)
      and (calories_low is null or calories_low>=0) and (calories_high is null or calories_high>=0)
      and (calories_low is null or calories>=calories_low)
      and (calories_high is null or calories<=calories_high)
      and (calories_low is null or calories_high is null or calories_low<=calories_high)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='profiles_targets_integrity_p18') then
    alter table public.profiles add constraint profiles_targets_integrity_p18 check (
      calorie_target>0 and protein_target>0 and fiber_target>=0 and (goal_weight is null or goal_weight>0)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='daily_logs_targets_integrity_p18') then
    alter table public.daily_logs add constraint daily_logs_targets_integrity_p18 check (
      calorie_target>0 and protein_target>0
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='goal_phases_targets_integrity_p18') then
    alter table public.goal_phases add constraint goal_phases_targets_integrity_p18 check (
      calorie_target>0 and protein_target>0 and fiber_target>=0 and (goal_weight is null or goal_weight>0)
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='target_recommendations_integrity_p18') then
    alter table public.target_recommendations add constraint target_recommendations_integrity_p18 check (
      lookback_days>0 and complete_days>=0 and logged_days>=0 and weigh_in_count>=0
      and (confidence_score is null or (confidence_score>=0 and confidence_score<=1))
      and (recommended_protein is null or recommended_protein>=0)
      and (recommended_fat is null or recommended_fat>=0)
      and (recommended_carbs is null or recommended_carbs>=0)
    ) not valid;
  end if;
end
$ddl$;

alter table public.meals validate constraint meals_nutrition_integrity_p18;
alter table public.meal_items validate constraint meal_items_nutrition_integrity_p18;
alter table public.saved_foods validate constraint saved_foods_nutrition_integrity_p18;
alter table public.saved_meals validate constraint saved_meals_nutrition_integrity_p18;
alter table public.saved_meal_items validate constraint saved_meal_items_nutrition_integrity_p18;
alter table public.profiles validate constraint profiles_targets_integrity_p18;
alter table public.daily_logs validate constraint daily_logs_targets_integrity_p18;
alter table public.goal_phases validate constraint goal_phases_targets_integrity_p18;
alter table public.target_recommendations validate constraint target_recommendations_integrity_p18;

create table if not exists private.diet_integrity_audits (
  audit_id uuid primary key default gen_random_uuid(),
  audited_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('manual','cron','release')),
  status text not null check (status in ('clean','warning','critical')),
  check_count integer not null check (check_count>=0),
  failed_check_count integer not null check (failed_check_count>=0),
  failure_count bigint not null check (failure_count>=0),
  report jsonb not null
);

alter table private.diet_integrity_audits enable row level security;
revoke all on table private.diet_integrity_audits from public,anon,authenticated;
drop policy if exists diet_p18_integrity_audits_deny on private.diet_integrity_audits;
create policy diet_p18_integrity_audits_deny
on private.diet_integrity_audits
as restrictive
for all
to authenticated
using (false)
with check (false);

create or replace function private.diet_p18_integrity_report()
returns jsonb
language sql
stable
security definer
set search_path=''
as $fn$
with checks(check_name,severity,failures) as (
  select 'owner_meals_daily_logs','critical',count(*)::bigint
  from public.meals m join public.daily_logs d on d.id=m.daily_log_id
  where m.user_id<>d.user_id
  union all
  select 'owner_meal_items_meals','critical',count(*) from public.meal_items i join public.meals m on m.id=i.meal_id where i.user_id<>m.user_id
  union all
  select 'owner_meal_items_saved_foods','critical',count(*) from public.meal_items i join public.saved_foods f on f.id=i.saved_food_id where i.saved_food_id is not null and i.user_id<>f.user_id
  union all
  select 'owner_saved_meal_items_meals','critical',count(*) from public.saved_meal_items i join public.saved_meals m on m.id=i.saved_meal_id where i.user_id<>m.user_id
  union all
  select 'owner_saved_meal_items_foods','critical',count(*) from public.saved_meal_items i join public.saved_foods f on f.id=i.saved_food_id where i.saved_food_id is not null and i.user_id<>f.user_id
  union all
  select 'owner_recommendations_phases','critical',count(*) from public.target_recommendations r join public.goal_phases g on g.id=r.applied_phase_id where r.applied_phase_id is not null and r.user_id<>g.user_id
  union all
  select 'meal_calorie_aggregate','critical',count(*) from (
    select m.id from public.meals m join public.meal_items i on i.meal_id=m.id
    group by m.id,m.calories having abs(m.calories-sum(i.calories))>0.01
  ) x
  union all
  select 'meal_protein_aggregate','critical',count(*) from (
    select m.id from public.meals m join public.meal_items i on i.meal_id=m.id
    group by m.id,m.protein having abs(m.protein-sum(i.protein))>0.01
  ) x
  union all
  select 'saved_meal_calorie_aggregate','critical',count(*) from (
    select m.id from public.saved_meals m join public.saved_meal_items i on i.saved_meal_id=m.id
    where m.calories is not null group by m.id,m.calories having abs(m.calories-sum(i.calories))>0.01
  ) x
  union all
  select 'saved_meal_protein_aggregate','critical',count(*) from (
    select m.id from public.saved_meals m join public.saved_meal_items i on i.saved_meal_id=m.id
    where m.protein is not null group by m.id,m.protein having abs(m.protein-sum(i.protein))>0.01
  ) x
  union all
  select 'multiple_active_goal_phases','critical',count(*) from (
    select user_id from public.goal_phases where active group by user_id having count(*)>1
  ) x
  union all
  select 'blank_saved_food_names','warning',count(*) from public.saved_foods where btrim(name)=''
  union all
  select 'blank_saved_meal_names','warning',count(*) from public.saved_meals where btrim(name)=''
  union all
  select 'recommendation_resolution_state','warning',count(*) from public.target_recommendations
   where (status in ('accepted','dismissed','superseded','reverted') and resolved_at is null)
      or (status='pending' and (resolved_at is not null or resolution is not null or applied_phase_id is not null))
  union all
  select 'invalid_nutrition_numeric_state','critical',
    (select count(*) from public.meals where calories<0 or protein<0 or coalesce(carbs,0)<0 or coalesce(fat,0)<0 or coalesce(fiber,0)<0
      or (calories_low is not null and (calories_low<0 or calories<calories_low))
      or (calories_high is not null and (calories_high<0 or calories>calories_high))
      or (calories_low is not null and calories_high is not null and calories_low>calories_high))
    +(select count(*) from public.meal_items where calories<0 or protein<0 or coalesce(carbs,0)<0 or coalesce(fat,0)<0 or coalesce(fiber,0)<0
      or (calories_low is not null and (calories_low<0 or calories<calories_low))
      or (calories_high is not null and (calories_high<0 or calories>calories_high))
      or (calories_low is not null and calories_high is not null and calories_low>calories_high))
    +(select count(*) from public.saved_foods where calories<0 or protein<0 or coalesce(carbs,0)<0 or coalesce(fat,0)<0 or coalesce(fiber,0)<0)
    +(select count(*) from public.saved_meals where coalesce(calories,0)<0 or coalesce(protein,0)<0 or coalesce(carbs,0)<0 or coalesce(fat,0)<0 or coalesce(fiber,0)<0 or (servings is not null and servings<=0))
    +(select count(*) from public.saved_meal_items where calories<0 or protein<0 or coalesce(carbs,0)<0 or coalesce(fat,0)<0 or coalesce(fiber,0)<0
      or (calories_low is not null and (calories_low<0 or calories<calories_low))
      or (calories_high is not null and (calories_high<0 or calories>calories_high))
      or (calories_low is not null and calories_high is not null and calories_low>calories_high))
    +(select count(*) from public.profiles where calorie_target<=0 or protein_target<=0 or fiber_target<0 or (goal_weight is not null and goal_weight<=0))
    +(select count(*) from public.daily_logs where calorie_target<=0 or protein_target<=0)
    +(select count(*) from public.goal_phases where calorie_target<=0 or protein_target<=0 or fiber_target<0 or (goal_weight is not null and goal_weight<=0))
    +(select count(*) from public.target_recommendations where lookback_days<=0 or complete_days<0 or logged_days<0 or weigh_in_count<0
       or (confidence_score is not null and (confidence_score<0 or confidence_score>1))
       or coalesce(recommended_protein,0)<0 or coalesce(recommended_fat,0)<0 or coalesce(recommended_carbs,0)<0)
  union all
  select 'auth_user_cascade_contract','critical',
    greatest(0,18-(select count(*) from (
      select distinct c.relname
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class c on c.oid=con.conrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      join pg_catalog.pg_class rc on rc.oid=con.confrelid
      join pg_catalog.pg_namespace rn on rn.oid=rc.relnamespace
      where con.contype='f' and n.nspname='public'
        and c.relname=any(array[
          'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
          'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
          'target_recommendations','activity_daily','training_distribution_settings',
          'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
        ])
        and rn.nspname='auth' and rc.relname='users' and con.confdeltype='c'
    ) q))::bigint
  union all
  select 'recovery_snapshot_cascade_contract','critical',
    case when exists(
      select 1 from pg_catalog.pg_constraint con
      join pg_catalog.pg_class c on c.oid=con.conrelid
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      join pg_catalog.pg_class rc on rc.oid=con.confrelid
      join pg_catalog.pg_namespace rn on rn.oid=rc.relnamespace
      where con.contype='f' and n.nspname='private' and c.relname='diet_recovery_snapshots'
        and rn.nspname='auth' and rc.relname='users' and con.confdeltype='c'
    ) then 0 else 1 end::bigint
),
summary as (
  select
    count(*)::int check_count,
    count(*) filter(where failures>0)::int failed_check_count,
    coalesce(sum(failures),0)::bigint failure_count,
    count(*) filter(where severity='critical' and failures>0)::int critical_checks,
    count(*) filter(where severity='warning' and failures>0)::int warning_checks
  from checks
)
select jsonb_build_object(
  'release','P18',
  'auditedAt',clock_timestamp(),
  'status',case when s.critical_checks>0 then 'critical' when s.warning_checks>0 then 'warning' else 'clean' end,
  'checkCount',s.check_count,
  'failedCheckCount',s.failed_check_count,
  'failureCount',s.failure_count,
  'criticalCheckCount',s.critical_checks,
  'warningCheckCount',s.warning_checks,
  'autoRepair',false,
  'checks',coalesce((
    select jsonb_agg(jsonb_build_object('name',check_name,'severity',severity,'failures',failures) order by check_name)
    from checks
  ),'[]'::jsonb)
)
from summary s
$fn$;

revoke all on function private.diet_p18_integrity_report() from public,anon,authenticated;
grant execute on function private.diet_p18_integrity_report() to service_role;

create or replace function public.diet_p18_integrity_report()
returns jsonb
language sql
stable
security invoker
set search_path=''
as $fn$
  select private.diet_p18_integrity_report()
$fn$;

revoke all on function public.diet_p18_integrity_report() from public,anon,authenticated;
grant execute on function public.diet_p18_integrity_report() to service_role;

create or replace function private.diet_p18_run_integrity_audit(p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  r jsonb;
  aid uuid;
  src text := case when p_source in ('manual','cron','release') then p_source else 'manual' end;
begin
  r:=private.diet_p18_integrity_report();
  insert into private.diet_integrity_audits(source,status,check_count,failed_check_count,failure_count,report)
  values(src,r->>'status',(r->>'checkCount')::int,(r->>'failedCheckCount')::int,(r->>'failureCount')::bigint,r)
  returning audit_id into aid;

  delete from private.diet_integrity_audits where audited_at < clock_timestamp()-interval '180 days';
  return r||jsonb_build_object('auditId',aid,'source',src);
end
$fn$;

revoke all on function private.diet_p18_run_integrity_audit(text) from public,anon,authenticated;
grant execute on function private.diet_p18_run_integrity_audit(text) to service_role;

do $cron$
declare j record;
begin
  for j in select jobid from cron.job where jobname='diet-p18-integrity-daily' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$cron$;

select cron.schedule(
  'diet-p18-integrity-daily',
  '17 3 * * *',
  $cmd$select private.diet_p18_run_integrity_audit('cron');$cmd$
);
