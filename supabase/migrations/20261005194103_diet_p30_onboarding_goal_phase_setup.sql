-- Diet Copilot P30: onboarding, initial goal phase and starting weight.
-- Applied to canonical project hycegznamzjhwinegaai as migration 20261005194103.

create or replace function public.diet_app_complete_onboarding(
  p_start_date date,
  p_current_weight numeric,
  p_goal_mode text,
  p_goal_weight numeric,
  p_desired_weekly_weight_change numeric,
  p_calorie_target numeric,
  p_protein_target numeric,
  p_fiber_target numeric,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  v_mode text := lower(trim(coalesce(p_goal_mode,'')));
  v_rate numeric := coalesce(p_desired_weekly_weight_change,0);
  v_goal_weight numeric;
  v_phase_type text;
  v_phase_name text;
  v_phase_id uuid;
  v_claim jsonb;
  v_payload jsonb;
  v_result jsonb;
begin
  if v_uid is null or v_anonymous then
    raise exception 'Authenticated Diet account required' using errcode='42501';
  end if;

  if p_start_date is null or p_start_date < current_date - 7 or p_start_date > current_date + 7 then
    raise exception 'Onboarding start date must be within 7 days of today';
  end if;
  if p_current_weight is null or p_current_weight < 25 or p_current_weight > 400 then
    raise exception 'Current weight must be between 25 and 400 kg';
  end if;
  if v_mode not in ('lose','maintain','gain') then
    raise exception 'Goal mode must be lose, maintain, or gain';
  end if;
  if p_calorie_target is null or p_calorie_target < 1200 or p_calorie_target > 6000 then
    raise exception 'Calorie target must be between 1200 and 6000 kcal';
  end if;
  if p_protein_target is null or p_protein_target < 20 or p_protein_target > 500 then
    raise exception 'Protein target must be between 20 and 500 g';
  end if;
  if p_fiber_target is null or p_fiber_target < 0 or p_fiber_target > 100 then
    raise exception 'Fiber target must be between 0 and 100 g';
  end if;
  if abs(v_rate) > 2 then
    raise exception 'Weekly weight change must be within -2 to 2 kg/week';
  end if;

  if v_mode='maintain' then
    v_goal_weight := p_current_weight;
    v_rate := 0;
    v_phase_type := 'maintain';
    v_phase_name := 'Maintenance';
  elsif v_mode='lose' then
    if p_goal_weight is null or p_goal_weight <= 0 or p_goal_weight >= p_current_weight then
      raise exception 'Loss goal weight must be below current weight';
    end if;
    if v_rate >= 0 then
      raise exception 'Loss rate must be negative';
    end if;
    v_goal_weight := p_goal_weight;
    v_phase_type := 'cut';
    v_phase_name := 'Initial cut';
  else
    if p_goal_weight is null or p_goal_weight <= p_current_weight then
      raise exception 'Gain goal weight must be above current weight';
    end if;
    if v_rate <= 0 then
      raise exception 'Gain rate must be positive';
    end if;
    v_goal_weight := p_goal_weight;
    v_phase_type := 'gain';
    v_phase_name := 'Initial gain';
  end if;

  v_payload := jsonb_build_object(
    'p_start_date',p_start_date,
    'p_current_weight',p_current_weight,
    'p_goal_mode',v_mode,
    'p_goal_weight',v_goal_weight,
    'p_desired_weekly_weight_change',v_rate,
    'p_calorie_target',p_calorie_target,
    'p_protein_target',p_protein_target,
    'p_fiber_target',p_fiber_target
  );
  v_claim := private.diet_p19_begin_mutation(
    'diet_app_complete_onboarding',
    v_payload,
    p_request_id
  );

  if coalesce((v_claim->>'replay')::boolean,false) then
    return coalesce(v_claim->'result','{}'::jsonb)
      || jsonb_build_object('idempotent_replay',true,'p19_replay',true);
  end if;

  insert into public.profiles(
    user_id,calorie_target,protein_target,fiber_target,goal_weight,
    desired_weekly_weight_change,adaptive_target_enabled,updated_at
  )
  values(
    v_uid,p_calorie_target,p_protein_target,p_fiber_target,v_goal_weight,
    v_rate,true,clock_timestamp()
  )
  on conflict(user_id) do update set
    calorie_target=excluded.calorie_target,
    protein_target=excluded.protein_target,
    fiber_target=excluded.fiber_target,
    goal_weight=excluded.goal_weight,
    desired_weekly_weight_change=excluded.desired_weekly_weight_change,
    adaptive_target_enabled=true,
    updated_at=clock_timestamp();

  insert into public.weight_entries(user_id,entry_date,weight,updated_at)
  values(v_uid,p_start_date,p_current_weight,clock_timestamp())
  on conflict(user_id,entry_date) do update set
    weight=excluded.weight,
    updated_at=clock_timestamp();

  update public.goal_phases
  set active=false,
      end_date=case
        when start_date < p_start_date then p_start_date - 1
        else start_date
      end,
      updated_at=clock_timestamp()
  where user_id=v_uid and active;

  insert into public.goal_phases(
    user_id,phase_type,name,start_date,end_date,calorie_target,protein_target,
    fiber_target,goal_weight,desired_weekly_weight_change,active,updated_at
  )
  values(
    v_uid,v_phase_type,v_phase_name,p_start_date,null,p_calorie_target,p_protein_target,
    p_fiber_target,v_goal_weight,v_rate,true,clock_timestamp()
  )
  returning id into v_phase_id;

  update public.daily_logs
  set calorie_target=p_calorie_target,
      protein_target=p_protein_target,
      updated_at=clock_timestamp()
  where user_id=v_uid and log_date=p_start_date;

  v_result := jsonb_build_object(
    'onboarding_complete',true,
    'phase_id',v_phase_id,
    'start_date',p_start_date,
    'current_weight',p_current_weight,
    'goal_mode',v_mode,
    'goal_weight',v_goal_weight,
    'desired_weekly_weight_change',v_rate,
    'calorie_target',p_calorie_target,
    'protein_target',p_protein_target,
    'fiber_target',p_fiber_target,
    'adaptive_target_enabled',true,
    'updated_at',clock_timestamp()
  );

  perform private.diet_p19_complete_mutation(
    'diet_app_complete_onboarding',
    p_request_id,
    v_result
  );

  return v_result;
end
$function$;

revoke all on function public.diet_app_complete_onboarding(
  date,numeric,text,numeric,numeric,numeric,numeric,numeric,text
) from public, anon;
grant execute on function public.diet_app_complete_onboarding(
  date,numeric,text,numeric,numeric,numeric,numeric,numeric,text
) to authenticated;

comment on function public.diet_app_complete_onboarding(
  date,numeric,text,numeric,numeric,numeric,numeric,numeric,text
) is
'Diet P30: authenticated owner-scoped onboarding transaction. Creates/updates the initial profile, weight, and active goal phase through the P19 idempotency ledger. PUBLIC/anon execution revoked.';
