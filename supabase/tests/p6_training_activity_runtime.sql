-- Diet Copilot 2.0 P6 rollback-only runtime validation.
begin;

select set_config('request.jwt.claim.sub',(select user_id::text from private.diet_operator_owner where singleton=true),true);
select set_config('request.jwt.claim.role','authenticated',true);
set local role authenticated;

do $$
declare
  v_settings jsonb;
  v_settings_replay jsonb;
  v_day jsonb;
  v_day_id uuid;
  v_updated timestamptz;
  v_failed boolean:=false;
  v_activity_before bigint;
  v_settings_before timestamptz;
  v_settings_updated timestamptz;
begin
  select count(*) into v_activity_before from public.activity_daily;
  select updated_at into v_settings_before from public.training_distribution_settings limit 1;

  v_settings:=public.diet_app_save_training_distribution(
    true,
    '{"mon":"hard","tue":"rest","wed":"moderate","thu":"rest","fri":"hard","sat":"rest","sun":"rest"}'::jsonb,
    150,75,25,v_settings_before,'app:test:p6:distribution'
  );
  if coalesce((v_settings->>'enabled')::boolean,false) is not true then
    raise exception 'P6 runtime failed: distribution was not enabled';
  end if;
  if v_settings->'weekly_template'->>'mon'<>'hard' then
    raise exception 'P6 runtime failed: template not persisted';
  end if;
  v_settings_updated:=(v_settings->>'updated_at')::timestamptz;

  v_settings_replay:=public.diet_app_save_training_distribution(
    false,'{}'::jsonb,0,0,0,v_settings_before,'app:test:p6:distribution'
  );
  if coalesce((v_settings_replay->>'idempotent_replay')::boolean,false) is not true then
    raise exception 'P6 runtime failed: settings idempotency';
  end if;
  if coalesce((v_settings_replay->>'enabled')::boolean,false) is not true then
    raise exception 'P6 runtime failed: idempotent replay changed settings';
  end if;

  v_failed:=false;
  begin
    perform public.diet_app_save_training_distribution(
      true,'{"mon":"hard"}'::jsonb,150,75,25,v_settings_before,'app:test:p6:settings-stale'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'P6 runtime failed: stale training settings accepted'; end if;

  v_failed:=false;
  begin
    perform public.diet_app_save_training_distribution(
      true,'{"mon":"hard"}'::jsonb,50,100,25,v_settings_updated,'app:test:p6:invalid-shifts'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'P6 runtime failed: invalid shift ordering accepted'; end if;

  v_day:=public.diet_app_upsert_training_day(
    null,(now() at time zone 'Europe/Berlin')::date,'hard','planned','P6 rollback workout',90,null,null,'app:test:p6:day-create'
  );
  v_day_id:=(v_day->>'id')::uuid;
  v_updated:=(v_day->>'updated_at')::timestamptz;
  if v_day_id is null then raise exception 'P6 runtime failed: training day create'; end if;

  v_day:=public.diet_app_upsert_training_day(
    v_day_id,(now() at time zone 'Europe/Berlin')::date,'moderate','completed','P6 rollback workout',75,null,v_updated,'app:test:p6:day-update'
  );
  if v_day->>'day_type'<>'moderate' or v_day->>'status'<>'completed' then
    raise exception 'P6 runtime failed: training day update';
  end if;

  v_failed:=false;
  begin
    perform public.diet_app_upsert_training_day(
      v_day_id,(now() at time zone 'Europe/Berlin')::date,'hard','completed','stale',80,null,v_updated,'app:test:p6:day-stale'
    );
  exception when others then v_failed:=true;
  end;
  if not v_failed then raise exception 'P6 runtime failed: stale training update accepted'; end if;

  v_updated:=(v_day->>'updated_at')::timestamptz;
  v_day:=public.diet_app_delete_training_day(v_day_id,v_updated,'app:test:p6:day-delete');
  if coalesce((v_day->>'deleted')::boolean,false) is not true then
    raise exception 'P6 runtime failed: training day delete';
  end if;

  if (select count(*) from public.activity_daily)<>v_activity_before then
    raise exception 'P6 runtime failed: training actions modified activity rows';
  end if;
end $$;

rollback;
select 'diet_p6_training_activity_runtime_ok' as result;
