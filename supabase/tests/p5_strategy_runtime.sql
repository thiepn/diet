-- Diet Copilot 2.0 P5 rollback-only runtime validation.
begin;

select set_config('request.jwt.claim.sub',(select user_id::text from private.diet_operator_owner where singleton=true),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare
  v_before numeric;
  v_protein numeric;
  v_stage jsonb;
  v_stage_dup jsonb;
  v_id uuid;
  v_accept jsonb;
  v_revert jsonb;
  v_keep jsonb;
  v_keep_id uuid;
  v_failed boolean:=false;
  v_active_before uuid;
begin
  select calorie_target,protein_target into v_before,v_protein from public.profiles limit 1;
  select id into v_active_before from public.goal_phases where active order by start_date desc limit 1;

  begin
    perform public.diet_app_stage_strategy_review(
      '1.0.0-p1',(now() at time zone 'Europe/Berlin')::date,28,'increase',
      v_before+25,v_before+100,v_before+130,v_before+450,'high',0.91,
      'Invalid stale review.',v_protein,70,250,'{}'::jsonb,'app:test:p5:stale'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'P5 runtime failed: stale current target accepted'; end if;

  v_stage:=public.diet_app_stage_strategy_review(
    '1.0.0-p1',(now() at time zone 'Europe/Berlin')::date,28,'increase',
    v_before,v_before+100,v_before+130,v_before+450,'high',0.91,
    'Rollback fixture: gradual adjustment supported.',v_protein,70,250,
    jsonb_build_object(
      'confidence',jsonb_build_object('reliableIntakeDays',21,'weighIns',12),
      'evidence',jsonb_build_object('loggedDays',24,'weeklyWeightRate',-0.8,'averageCalories',v_before)
    ),
    'app:test:p5:stage'
  );
  v_id:=(v_stage->>'recommendation_id')::uuid;
  if v_id is null or v_stage->>'status'<>'pending' then raise exception 'P5 runtime failed: stage actionable review'; end if;

  v_stage_dup:=public.diet_app_stage_strategy_review(
    '1.0.0-p1',(now() at time zone 'Europe/Berlin')::date,28,'increase',
    v_before,v_before+100,v_before+130,v_before+450,'high',0.91,
    'Rollback fixture: gradual adjustment supported.',v_protein,70,250,
    jsonb_build_object(
      'confidence',jsonb_build_object('reliableIntakeDays',21,'weighIns',12),
      'evidence',jsonb_build_object('loggedDays',24,'weeklyWeightRate',-0.8,'averageCalories',v_before)
    ),
    'app:test:p5:stage-duplicate'
  );
  if (v_stage_dup->>'recommendation_id')::uuid<>v_id or coalesce((v_stage_dup->>'deduplicated')::boolean,false) is not true then
    raise exception 'P5 runtime failed: duplicate review not suppressed';
  end if;

  v_accept:=public.diet_app_resolve_strategy_review(
    v_id,'accept',(now() at time zone 'Europe/Berlin')::date,'app:test:p5:accept'
  );
  if (v_accept->>'calorie_target')::numeric<>v_before+100 then raise exception 'P5 runtime failed: accept target'; end if;
  if (select calorie_target from public.profiles limit 1)<>v_before+100 then raise exception 'P5 runtime failed: profile target not applied'; end if;
  if not exists(select 1 from public.goal_phases where active and calorie_target=v_before+100) then
    raise exception 'P5 runtime failed: new target period not active';
  end if;
  if v_active_before is not null and exists(select 1 from public.goal_phases where id=v_active_before and active) then
    raise exception 'P5 runtime failed: previous target period still active';
  end if;

  v_revert:=public.diet_app_revert_strategy_review(v_id,'app:test:p5:revert');
  if (v_revert->>'calorie_target')::numeric<>v_before then raise exception 'P5 runtime failed: revert response'; end if;
  if (select calorie_target from public.profiles limit 1)<>v_before then raise exception 'P5 runtime failed: target not restored'; end if;
  if (select status from public.target_recommendations where id=v_id)<>'reverted' then raise exception 'P5 runtime failed: review not marked reverted'; end if;

  v_keep:=public.diet_app_stage_strategy_review(
    '1.0.0-p1',(now() at time zone 'Europe/Berlin')::date,28,'keep_target',
    v_before,v_before,v_before+20,v_before+400,'medium',0.70,
    'Rollback fixture: keep the current target.',v_protein,70,250,
    jsonb_build_object(
      'confidence',jsonb_build_object('reliableIntakeDays',17,'weighIns',9),
      'evidence',jsonb_build_object('loggedDays',20,'weeklyWeightRate',-0.5,'averageCalories',v_before)
    ),
    'app:test:p5:keep-stage'
  );
  v_keep_id:=(v_keep->>'recommendation_id')::uuid;
  if v_keep->>'status'<>'advisory' then raise exception 'P5 runtime failed: keep review status'; end if;

  v_keep:=public.diet_app_resolve_strategy_review(
    v_keep_id,'keep_current',(now() at time zone 'Europe/Berlin')::date,'app:test:p5:keep'
  );
  if v_keep->>'resolution'<>'kept_current' then raise exception 'P5 runtime failed: keep-current resolution'; end if;
  if (select calorie_target from public.profiles limit 1)<>v_before then raise exception 'P5 runtime failed: keep-current changed target'; end if;
end $$;

rollback;
select 'diet_p5_strategy_runtime_ok' as result;
