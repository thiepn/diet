-- Diet Copilot 2.0 P5 — adaptive coaching and strategy actions
-- Snapshot from the verified canonical Supabase project.

alter table public.target_recommendations
  add column if not exists engine_version text,
  add column if not exists confidence_level text,
  add column if not exists confidence_score numeric,
  add column if not exists recommended_protein numeric,
  add column if not exists recommended_fat numeric,
  add column if not exists recommended_carbs numeric,
  add column if not exists effective_date date,
  add column if not exists resolution text,
  add column if not exists resolved_target numeric,
  add column if not exists applied_phase_id uuid references public.goal_phases(id) on delete set null;

alter table public.target_recommendations
  drop constraint if exists target_recommendations_status_check;
alter table public.target_recommendations
  add constraint target_recommendations_status_check
  check (status = any(array['pending'::text,'accepted'::text,'dismissed'::text,'insufficient'::text,'advisory'::text,'superseded'::text,'reverted'::text]));

create index if not exists idx_target_recommendations_user_resolved
  on public.target_recommendations(user_id,resolved_at desc)
  where resolved_at is not null;

create index if not exists idx_target_recommendations_applied_phase
  on public.target_recommendations(applied_phase_id)
  where applied_phase_id is not null;

CREATE OR REPLACE FUNCTION public.diet_app_resolve_strategy_review(p_recommendation_id uuid, p_resolution text, p_effective_date date, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_rec public.target_recommendations%rowtype;
  v_profile public.profiles%rowtype;
  v_phase public.goal_phases%rowtype;
  v_new_phase public.goal_phases%rowtype;
  v_existing jsonb;
  v_resolution text:=trim(coalesce(p_resolution,''));
  v_tz text;
  v_today date;
  v_effective date;
  v_protein numeric;
  v_new_phase_type text;
  v_new_phase_name text;
  v_new_rate numeric;
  v_before jsonb;
  v_after jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;
  if v_resolution not in ('accept','keep_current') then raise exception 'Invalid strategy resolution'; end if;

  select * into v_rec from public.target_recommendations
  where id=p_recommendation_id and user_id=v_uid and status in ('pending','advisory')
  for update;
  if not found then raise exception 'Open strategy review not found'; end if;

  select * into v_profile from public.profiles where user_id=v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  v_tz:=coalesce(v_profile.reminder_timezone,'Europe/Berlin');
  v_today:=(now() at time zone v_tz)::date;
  v_effective:=coalesce(p_effective_date,v_today);
  if v_effective<v_today or v_effective>v_today+1 then raise exception 'Effective date must be today or tomorrow'; end if;

  if v_resolution='keep_current' then
    update public.target_recommendations
    set status='dismissed',resolved_at=now(),effective_date=null,resolution='kept_current',resolved_target=v_profile.calorie_target
    where id=v_rec.id returning * into v_rec;

    v_after:=jsonb_build_object(
      'recommendation_id',v_rec.id,'resolution','kept_current','calorie_target',v_profile.calorie_target
    );
    insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,after_data)
    values(v_uid,p_request_id,'strategy_review_keep','target_recommendation',v_rec.id,v_after);
    return v_after;
  end if;

  if v_rec.status<>'pending' then raise exception 'This review has no target change to accept'; end if;
  if abs(v_profile.calorie_target-v_rec.current_target)>1 then raise exception 'Conflict: calorie target changed after this review'; end if;
  if v_rec.recommended_target is null or v_rec.recommended_target<1200 or v_rec.recommended_target>5000 then
    raise exception 'Recommendation has no valid target';
  end if;

  v_before:=jsonb_build_object(
    'profile',jsonb_build_object(
      'calorie_target',v_profile.calorie_target,'protein_target',v_profile.protein_target,
      'desired_weekly_weight_change',v_profile.desired_weekly_weight_change
    )
  );

  v_protein:=coalesce(v_rec.recommended_protein,v_profile.protein_target);
  select * into v_phase from public.goal_phases where user_id=v_uid and active order by start_date desc limit 1 for update;

  if coalesce(v_rec.decision_payload->>'decision','')='transition_maintenance' then
    v_new_phase_type:='maintain';
    v_new_phase_name:='Maintenance';
    v_new_rate:=0;
  else
    v_new_phase_type:=coalesce(v_phase.phase_type,'custom');
    v_new_phase_name:=coalesce(v_phase.name,'Adaptive plan');
    v_new_rate:=v_profile.desired_weekly_weight_change;
  end if;

  if v_phase.id is not null then
    if v_phase.start_date<v_effective then
      update public.goal_phases set active=false,end_date=v_effective-1,updated_at=now()
      where id=v_phase.id and user_id=v_uid;
      insert into public.goal_phases(
        user_id,phase_type,name,start_date,calorie_target,protein_target,fiber_target,
        goal_weight,desired_weekly_weight_change,active,notes
      ) values(
        v_uid,v_new_phase_type,v_new_phase_name,v_effective,v_rec.recommended_target,v_protein,
        v_phase.fiber_target,v_phase.goal_weight,v_new_rate,true,
        concat('Adaptive review ',v_rec.id::text,' accepted from ',v_rec.engine_version)
      ) returning * into v_new_phase;
    elsif v_phase.start_date=v_effective then
      update public.goal_phases set
        phase_type=v_new_phase_type,name=v_new_phase_name,calorie_target=v_rec.recommended_target,
        protein_target=v_protein,desired_weekly_weight_change=v_new_rate,
        notes=concat_ws(E'\n',nullif(notes,''),concat('Adaptive review ',v_rec.id::text,' accepted from ',v_rec.engine_version)),
        updated_at=now()
      where id=v_phase.id and user_id=v_uid returning * into v_new_phase;
    else
      raise exception 'Conflict: active phase begins after requested effective date';
    end if;
  else
    insert into public.goal_phases(
      user_id,phase_type,name,start_date,calorie_target,protein_target,fiber_target,
      goal_weight,desired_weekly_weight_change,active,notes
    ) values(
      v_uid,v_new_phase_type,v_new_phase_name,v_effective,v_rec.recommended_target,v_protein,
      v_profile.fiber_target,v_profile.goal_weight,v_new_rate,true,
      concat('Adaptive review ',v_rec.id::text,' accepted from ',v_rec.engine_version)
    ) returning * into v_new_phase;
  end if;

  update public.profiles set
    calorie_target=v_rec.recommended_target,
    protein_target=v_protein,
    desired_weekly_weight_change=v_new_rate,
    updated_at=now()
  where user_id=v_uid;

  update public.daily_logs set
    calorie_target=v_rec.recommended_target,
    protein_target=v_protein,
    updated_at=now()
  where user_id=v_uid and log_date>=v_effective and status<>'complete';

  update public.target_recommendations set
    status='accepted',resolved_at=now(),effective_date=v_effective,resolution='accepted',
    resolved_target=v_rec.recommended_target,applied_phase_id=v_new_phase.id
  where id=v_rec.id returning * into v_rec;

  v_after:=jsonb_build_object(
    'recommendation_id',v_rec.id,'resolution','accepted','effective_date',v_effective,
    'previous_target',v_rec.current_target,'calorie_target',v_rec.recommended_target,
    'protein_target',v_protein,'phase_id',v_new_phase.id,'phase_type',v_new_phase.phase_type
  );
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'strategy_review_accept','target_recommendation',v_rec.id,v_before,v_after);
  return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_revert_strategy_review(p_recommendation_id uuid, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_rec public.target_recommendations%rowtype;
  v_profile public.profiles%rowtype;
  v_phase public.goal_phases%rowtype;
  v_new_phase public.goal_phases%rowtype;
  v_existing jsonb;
  v_ctx jsonb;
  v_tz text;
  v_today date;
  v_previous_target numeric;
  v_previous_protein numeric;
  v_previous_rate numeric;
  v_previous_phase_type text;
  v_previous_phase_name text;
  v_previous_fiber numeric;
  v_previous_goal numeric;
  v_after jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  select * into v_rec from public.target_recommendations
  where id=p_recommendation_id and user_id=v_uid and status='accepted'
  for update;
  if not found then raise exception 'Accepted strategy review not found'; end if;

  if exists(
    select 1 from public.target_recommendations r
    where r.user_id=v_uid and r.status='accepted' and r.resolved_at>v_rec.resolved_at and r.id<>v_rec.id
  ) then raise exception 'A newer accepted strategy review exists'; end if;

  select * into v_profile from public.profiles where user_id=v_uid for update;
  if abs(v_profile.calorie_target-coalesce(v_rec.resolved_target,v_rec.recommended_target))>1 then
    raise exception 'Conflict: current plan no longer matches this accepted review';
  end if;

  v_ctx:=coalesce(v_rec.decision_payload->'server_context','{}'::jsonb);
  v_previous_target:=coalesce(nullif(v_ctx->>'current_calorie_target','')::numeric,v_rec.current_target);
  v_previous_protein:=coalesce(nullif(v_ctx->>'current_protein_target','')::numeric,v_profile.protein_target);
  v_previous_rate:=nullif(v_ctx->>'desired_weekly_weight_change','')::numeric;
  v_previous_phase_type:=coalesce(nullif(v_ctx->>'phase_type',''),'custom');
  v_previous_phase_name:=coalesce(nullif(v_ctx->>'phase_name',''),'Restored plan');
  v_previous_fiber:=coalesce(nullif(v_ctx->>'phase_fiber_target','')::numeric,v_profile.fiber_target);
  v_previous_goal:=coalesce(nullif(v_ctx->>'phase_goal_weight','')::numeric,v_profile.goal_weight);

  v_tz:=coalesce(v_profile.reminder_timezone,'Europe/Berlin');
  v_today:=(now() at time zone v_tz)::date;
  select * into v_phase from public.goal_phases where user_id=v_uid and active order by start_date desc limit 1 for update;

  if v_phase.id is not null and v_phase.start_date<v_today then
    update public.goal_phases set active=false,end_date=v_today-1,updated_at=now()
    where id=v_phase.id and user_id=v_uid;
    insert into public.goal_phases(
      user_id,phase_type,name,start_date,calorie_target,protein_target,fiber_target,
      goal_weight,desired_weekly_weight_change,active,notes
    ) values(
      v_uid,v_previous_phase_type,v_previous_phase_name,v_today,v_previous_target,v_previous_protein,
      v_previous_fiber,v_previous_goal,v_previous_rate,true,
      concat('Restored previous plan from adaptive review ',v_rec.id::text)
    ) returning * into v_new_phase;
  elsif v_phase.id is not null then
    update public.goal_phases set
      phase_type=v_previous_phase_type,name=v_previous_phase_name,calorie_target=v_previous_target,
      protein_target=v_previous_protein,fiber_target=v_previous_fiber,goal_weight=v_previous_goal,
      desired_weekly_weight_change=v_previous_rate,
      notes=concat_ws(E'\n',nullif(notes,''),concat('Restored previous plan from adaptive review ',v_rec.id::text)),
      updated_at=now()
    where id=v_phase.id and user_id=v_uid returning * into v_new_phase;
  else
    insert into public.goal_phases(
      user_id,phase_type,name,start_date,calorie_target,protein_target,fiber_target,
      goal_weight,desired_weekly_weight_change,active,notes
    ) values(
      v_uid,v_previous_phase_type,v_previous_phase_name,v_today,v_previous_target,v_previous_protein,
      v_previous_fiber,v_previous_goal,v_previous_rate,true,
      concat('Restored previous plan from adaptive review ',v_rec.id::text)
    ) returning * into v_new_phase;
  end if;

  update public.profiles set
    calorie_target=v_previous_target,protein_target=v_previous_protein,fiber_target=v_previous_fiber,
    goal_weight=v_previous_goal,desired_weekly_weight_change=v_previous_rate,updated_at=now()
  where user_id=v_uid;

  update public.daily_logs set
    calorie_target=v_previous_target,protein_target=v_previous_protein,updated_at=now()
  where user_id=v_uid and log_date>=v_today and status<>'complete';

  update public.target_recommendations set
    status='reverted',resolved_at=now(),resolution='reverted',resolved_target=v_previous_target,
    effective_date=v_today,applied_phase_id=v_new_phase.id
  where id=v_rec.id returning * into v_rec;

  v_after:=jsonb_build_object(
    'recommendation_id',v_rec.id,'resolution','reverted','calorie_target',v_previous_target,
    'protein_target',v_previous_protein,'phase_id',v_new_phase.id
  );
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,after_data)
  values(v_uid,p_request_id,'strategy_review_revert','target_recommendation',v_rec.id,v_after);
  return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_stage_strategy_review(p_engine_version text, p_generated_on date, p_lookback_days integer, p_decision text, p_current_target numeric, p_recommended_target numeric, p_raw_target numeric, p_estimated_expenditure numeric, p_confidence_level text, p_confidence_score numeric, p_reason text, p_recommended_protein numeric, p_recommended_fat numeric, p_recommended_carbs numeric, p_payload jsonb, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_profile public.profiles%rowtype;
  v_phase public.goal_phases%rowtype;
  v_tz text;
  v_today date;
  v_decision text:=trim(coalesce(p_decision,''));
  v_engine text:=trim(coalesce(p_engine_version,''));
  v_reason text:=trim(coalesce(p_reason,''));
  v_status text;
  v_existing jsonb;
  v_row public.target_recommendations%rowtype;
  v_same public.target_recommendations%rowtype;
  v_payload jsonb:=coalesce(p_payload,'{}'::jsonb);
  v_complete int:=0;
  v_logged int:=0;
  v_weigh int:=0;
  v_weekly numeric;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  select * into v_profile from public.profiles where user_id=v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  select * into v_phase from public.goal_phases where user_id=v_uid and active order by start_date desc limit 1;

  v_tz:=coalesce(v_profile.reminder_timezone,'Europe/Berlin');
  v_today:=(now() at time zone v_tz)::date;
  if p_generated_on is null or p_generated_on<v_today-1 or p_generated_on>v_today+1 then raise exception 'Review date outside allowed range'; end if;
  if length(v_engine)<1 or length(v_engine)>64 or v_engine !~ '^[A-Za-z0-9._-]+$' then raise exception 'Invalid engine version'; end if;
  if p_lookback_days is null or p_lookback_days<14 or p_lookback_days>60 then raise exception 'Lookback must be 14 to 60 days'; end if;
  if v_decision not in ('need_more_data','hold_for_confidence','keep_target','increase','decrease','set_initial_target','prepare_maintenance','transition_maintenance') then
    raise exception 'Unsupported strategy decision';
  end if;
  if length(v_reason)<1 or length(v_reason)>1000 then raise exception 'Reason must be 1 to 1000 characters'; end if;
  if p_current_target is null or abs(p_current_target-v_profile.calorie_target)>1 then raise exception 'Conflict: current calorie target changed'; end if;
  if p_recommended_target is not null and (p_recommended_target<1200 or p_recommended_target>6000) then raise exception 'Recommended calorie target outside allowed range'; end if;
  if p_raw_target is not null and (p_raw_target<800 or p_raw_target>6000) then raise exception 'Raw calorie target outside allowed range'; end if;
  if p_estimated_expenditure is not null and (p_estimated_expenditure<800 or p_estimated_expenditure>7000) then raise exception 'Estimated expenditure outside allowed range'; end if;
  if p_confidence_level not in ('building_baseline','low','medium','high') then raise exception 'Invalid confidence level'; end if;
  if p_confidence_score is null or p_confidence_score<0 or p_confidence_score>1 then raise exception 'Invalid confidence score'; end if;
  if p_recommended_protein is not null and (p_recommended_protein<0 or p_recommended_protein>400) then raise exception 'Protein target outside allowed range'; end if;
  if p_recommended_fat is not null and (p_recommended_fat<0 or p_recommended_fat>300) then raise exception 'Fat target outside allowed range'; end if;
  if p_recommended_carbs is not null and (p_recommended_carbs<0 or p_recommended_carbs>1000) then raise exception 'Carbohydrate target outside allowed range'; end if;
  if jsonb_typeof(v_payload)<>'object' then raise exception 'Strategy payload must be an object'; end if;
  if pg_column_size(v_payload)>65536 then raise exception 'Strategy payload is too large'; end if;

  if v_decision='increase' then
    if p_recommended_target is null or p_recommended_target<=p_current_target or p_recommended_target-p_current_target>150 then
      raise exception 'Increase recommendation violates adjustment bounds';
    end if;
  elsif v_decision='decrease' then
    if p_recommended_target is null or p_recommended_target>=p_current_target or p_current_target-p_recommended_target>150 then
      raise exception 'Decrease recommendation violates adjustment bounds';
    end if;
  elsif v_decision in ('hold_for_confidence','keep_target','prepare_maintenance','need_more_data') then
    if p_recommended_target is not null and abs(p_recommended_target-p_current_target)>1 then
      raise exception 'Non-actionable decision cannot change calorie target';
    end if;
  elsif v_decision='transition_maintenance' then
    if p_recommended_target is null or abs(p_recommended_target-p_current_target)>1200 then
      raise exception 'Maintenance transition target violates adjustment bounds';
    end if;
  elsif v_decision='set_initial_target' then
    if p_recommended_target is null or abs(p_recommended_target-p_current_target)>600 then
      raise exception 'Initial target recommendation violates adjustment bounds';
    end if;
  end if;

  if p_recommended_target is not null and mod(round(p_recommended_target),25)<>0 then
    raise exception 'Recommended calorie target must use 25 kcal increments';
  end if;

  v_complete:=greatest(0,coalesce(round(nullif(v_payload#>>'{confidence,reliableIntakeDays}','')::numeric)::int,0));
  v_logged:=greatest(v_complete,coalesce(nullif(v_payload#>>'{evidence,loggedDays}','')::int,0));
  v_weigh:=greatest(0,coalesce(nullif(v_payload#>>'{confidence,weighIns}','')::int,0));
  v_weekly:=nullif(v_payload#>>'{evidence,weeklyWeightRate}','')::numeric;

  if v_decision in ('increase','decrease','transition_maintenance','set_initial_target')
     and p_recommended_target is not null and abs(p_recommended_target-p_current_target)>1 then
    v_status:='pending';
  elsif v_decision='need_more_data' then
    v_status:='insufficient';
  else
    v_status:='advisory';
  end if;

  select * into v_same
  from public.target_recommendations r
  where r.user_id=v_uid
    and r.generated_on=p_generated_on
    and coalesce(r.engine_version,'')=v_engine
    and coalesce(r.decision_payload->>'decision','')=v_decision
    and abs(r.current_target-p_current_target)<=1
    and (
      (r.recommended_target is null and p_recommended_target is null)
      or abs(r.recommended_target-p_recommended_target)<=1
    )
    and r.created_at>=now()-interval '12 hours'
    and r.status in ('pending','advisory','insufficient')
  order by r.created_at desc
  limit 1;

  if v_same.id is not null then
    return jsonb_build_object(
      'recommendation_id',v_same.id,'status',v_same.status,'decision',v_decision,
      'current_target',v_same.current_target,'recommended_target',v_same.recommended_target,
      'engine_version',v_same.engine_version,'created_at',v_same.created_at,'deduplicated',true
    );
  end if;

  update public.target_recommendations
  set status='superseded',resolved_at=now(),resolution='superseded_by_new_review'
  where user_id=v_uid and status in ('pending','advisory');

  v_payload:=v_payload||jsonb_build_object(
    'decision',v_decision,
    'engine_version',v_engine,
    'generated_on',p_generated_on,
    'current_target',p_current_target,
    'recommended_target',p_recommended_target,
    'confidence_level',p_confidence_level,
    'confidence_score',p_confidence_score,
    'server_context',jsonb_strip_nulls(jsonb_build_object(
      'current_calorie_target',v_profile.calorie_target,
      'current_protein_target',v_profile.protein_target,
      'current_fiber_target',v_profile.fiber_target,
      'goal_weight',v_profile.goal_weight,
      'desired_weekly_weight_change',v_profile.desired_weekly_weight_change,
      'adaptive_target_enabled',v_profile.adaptive_target_enabled,
      'phase_id',v_phase.id,
      'phase_type',v_phase.phase_type,
      'phase_name',v_phase.name,
      'phase_start_date',v_phase.start_date,
      'phase_protein_target',v_phase.protein_target,
      'phase_fiber_target',v_phase.fiber_target,
      'phase_goal_weight',v_phase.goal_weight,
      'phase_desired_weekly_weight_change',v_phase.desired_weekly_weight_change,
      'staged_at',now()
    ))
  );

  insert into public.target_recommendations(
    user_id,generated_on,lookback_days,complete_days,logged_days,weigh_in_count,
    avg_calories,weekly_weight_change,estimated_maintenance,desired_weekly_weight_change,
    current_target,raw_recommended_target,recommended_target,rationale,status,decision_payload,
    engine_version,confidence_level,confidence_score,recommended_protein,recommended_fat,recommended_carbs
  ) values(
    v_uid,p_generated_on,p_lookback_days,v_complete,v_logged,v_weigh,
    nullif(v_payload#>>'{evidence,averageCalories}','')::numeric,v_weekly,p_estimated_expenditure,
    v_profile.desired_weekly_weight_change,p_current_target,p_raw_target,p_recommended_target,
    v_reason,v_status,v_payload,v_engine,p_confidence_level,p_confidence_score,
    p_recommended_protein,p_recommended_fat,p_recommended_carbs
  ) returning * into v_row;

  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,after_data)
  values(v_uid,p_request_id,'strategy_review_stage','target_recommendation',v_row.id,
    jsonb_build_object('recommendation_id',v_row.id,'status',v_row.status,'decision',v_decision,
      'current_target',v_row.current_target,'recommended_target',v_row.recommended_target,'engine_version',v_row.engine_version));

  return jsonb_build_object(
    'recommendation_id',v_row.id,'status',v_row.status,'decision',v_decision,
    'current_target',v_row.current_target,'recommended_target',v_row.recommended_target,
    'engine_version',v_row.engine_version,'created_at',v_row.created_at
  );
end $function$;

revoke all on function public.diet_app_resolve_strategy_review(uuid, text, date, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_resolve_strategy_review(uuid, text, date, text) to authenticated;

revoke all on function public.diet_app_revert_strategy_review(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_revert_strategy_review(uuid, text) to authenticated;

revoke all on function public.diet_app_stage_strategy_review(text, date, integer, text, numeric, numeric, numeric, numeric, text, numeric, text, numeric, numeric, numeric, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_stage_strategy_review(text, date, integer, text, numeric, numeric, numeric, numeric, text, numeric, text, numeric, numeric, numeric, jsonb, text) to authenticated;

