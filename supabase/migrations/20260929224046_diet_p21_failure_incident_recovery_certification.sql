
create table if not exists private.diet_incident_certifications (
  certification_id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default clock_timestamp(),
  kind text not null check (kind in ('failure_certification','readiness')),
  source text not null check (source in ('release','manual','cron')),
  status text not null check (status in ('pass','warning','fail')),
  scenario_count integer not null check (scenario_count>=0),
  passed_count integer not null check (passed_count>=0),
  failed_count integer not null check (failed_count>=0),
  report jsonb not null
);
create table if not exists private.diet_incident_control (
  singleton boolean primary key default true check (singleton),
  writes_paused boolean not null default false,
  reason text,
  updated_at timestamptz not null default clock_timestamp()
);
alter table private.diet_incident_certifications enable row level security;
alter table private.diet_incident_control enable row level security;
revoke all on table private.diet_incident_certifications from public,anon,authenticated;
revoke all on table private.diet_incident_control from public,anon,authenticated;
drop policy if exists diet_p21_incident_certifications_deny on private.diet_incident_certifications;
create policy diet_p21_incident_certifications_deny on private.diet_incident_certifications
as restrictive for all to authenticated using (false) with check (false);
drop policy if exists diet_p21_incident_control_deny on private.diet_incident_control;
create policy diet_p21_incident_control_deny on private.diet_incident_control
as restrictive for all to authenticated using (false) with check (false);
insert into private.diet_incident_control(singleton,writes_paused,reason)
values(true,false,null) on conflict(singleton) do nothing;

CREATE OR REPLACE FUNCTION private.diet_p19_begin_mutation(p_operation text, p_payload jsonb, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_anonymous boolean:=coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  v_hash text;
  v_row private.diet_mutation_requests%rowtype;
begin
  if v_uid is null or v_anonymous then
    raise exception 'Authenticated Diet account required' using errcode='42501';
  end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then
    raise exception 'Invalid request ID';
  end if;
  if p_operation is null or p_operation !~ '^diet_app_[a-z0-9_]{1,80}$' then
    raise exception 'Invalid mutation operation';
  end if;

  if coalesce((select writes_paused from private.diet_incident_control where singleton=true),false) then
    raise exception 'Diet writes are temporarily paused for incident recovery' using errcode='55000';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('diet-p19-owner:'||v_uid::text,0)
  );

  v_hash:=encode(
    extensions.digest(
      convert_to(coalesce(p_payload,'{}'::jsonb)::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into private.diet_mutation_requests(
    user_id,request_id,operation,payload_sha256,status
  ) values(
    v_uid,p_request_id,p_operation,v_hash,'started'
  )
  on conflict(user_id,request_id) do nothing;

  select * into v_row
  from private.diet_mutation_requests
  where user_id=v_uid and request_id=p_request_id
  for update;

  if not found then
    raise exception 'Mutation request claim failed';
  end if;

  if v_row.operation<>p_operation or v_row.payload_sha256<>v_hash then
    raise exception 'Request ID collision: this ID is already bound to a different Diet mutation';
  end if;

  if v_row.status='complete' then
    return jsonb_build_object(
      'replay',true,
      'result',coalesce(v_row.result,'{}'::jsonb),
      'operation',v_row.operation
    );
  end if;

  return jsonb_build_object('replay',false,'operation',v_row.operation);
end
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p20_schema_contract()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with
target_relations(schema_name,table_name) as (
  values
    ('public','profiles'),
    ('public','daily_logs'),
    ('public','meals'),
    ('public','meal_items'),
    ('public','weight_entries'),
    ('public','goal_phases'),
    ('public','saved_foods'),
    ('public','saved_food_portions'),
    ('public','saved_meals'),
    ('public','saved_meal_items'),
    ('public','target_recommendations'),
    ('public','activity_daily'),
    ('public','training_distribution_settings'),
    ('public','training_days'),
    ('public','ai_actions'),
    ('public','change_log'),
    ('public','weekly_reviews'),
    ('public','diet_native_devices'),
    ('private','diet_recovery_snapshots'),
    ('private','diet_integrity_audits'),
    ('private','diet_mutation_requests'),
    ('private','diet_release_checkpoints'),
    ('private','diet_schema_drift_audits'),
    ('private','diet_incident_certifications'),
    ('private','diet_incident_control')
),
relations as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relkind,
    c.relrowsecurity,
    c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
columns as (
  select
    c.table_schema as schema_name,
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_schema,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    c.is_identity,
    c.identity_generation,
    c.is_generated,
    c.generation_expression
  from information_schema.columns c
  join target_relations t
    on t.schema_name=c.table_schema and t.table_name=c.table_name
),
constraints as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    con.conname,
    con.contype,
    pg_catalog.pg_get_constraintdef(con.oid,true) as definition
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid=con.conrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
indexes as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    i.relname as index_name,
    pg_catalog.pg_get_indexdef(i.oid) as definition
  from pg_catalog.pg_index x
  join pg_catalog.pg_class c on c.oid=x.indrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join pg_catalog.pg_class i on i.oid=x.indexrelid
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
policies as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    p.polname as policy_name,
    p.polpermissive,
    p.polcmd,
    coalesce((
      select array_agg(r.rolname order by r.rolname)
      from pg_catalog.pg_roles r
      where r.oid=any(p.polroles)
    ),array[]::text[]) as roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) as using_expression,
    pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid=p.polrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
triggers as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    tg.tgname as trigger_name,
    pg_catalog.pg_get_triggerdef(tg.oid,true) as definition
  from pg_catalog.pg_trigger tg
  join pg_catalog.pg_class c on c.oid=tg.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
  where not tg.tgisinternal
),
functions as (
  select
    n.nspname as schema_name,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args,
    p.prokind,
    p.prosecdef,
    p.provolatile,
    p.proconfig,
    coalesce(p.proacl::text,'') as acl,
    pg_catalog.pg_get_functiondef(p.oid) as definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
    and p.proname like 'diet_%'
),
crons as (
  select jobname,schedule,command,database,username,active
  from cron.job
  where jobname like 'diet-%'
)
select jsonb_build_object(
  'format','diet-p20-schema-contract-v1',
  'relations',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name) from relations x),'[]'::jsonb),
  'columns',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,ordinal_position) from columns x),'[]'::jsonb),
  'constraints',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,conname) from constraints x),'[]'::jsonb),
  'indexes',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,index_name) from indexes x),'[]'::jsonb),
  'policies',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,policy_name) from policies x),'[]'::jsonb),
  'triggers',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,trigger_name) from triggers x),'[]'::jsonb),
  'functions',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,proname,identity_args) from functions x),'[]'::jsonb),
  'crons',coalesce((select jsonb_agg(to_jsonb(x) order by jobname) from crons x),'[]'::jsonb)
)
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p21_readiness_report()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_p15 jsonb;
  v_p18 jsonb;
  v_p19 jsonb;
  v_p20 jsonb;
  v_latest private.diet_incident_certifications%rowtype;
  v_recent_cron_failures integer;
  v_expected_jobs integer;
  v_status text;
begin
  v_p15:=private.diet_p15_status();
  v_p18:=private.diet_p18_integrity_report();
  v_p19:=public.diet_p19_concurrency_status();
  v_p20:=public.diet_p20_release_status();

  select * into v_latest
  from private.diet_incident_certifications
  where kind='failure_certification'
  order by ran_at desc
  limit 1;

  select count(*) into v_recent_cron_failures
  from cron.job_run_details d
  join cron.job j on j.jobid=d.jobid
  where j.jobname like 'diet-%'
    and d.start_time > clock_timestamp()-interval '24 hours'
    and d.status not in ('succeeded','running');

  select count(*) into v_expected_jobs
  from cron.job
  where jobname in (
    'diet-p15-daily-snapshot',
    'diet-p15-monthly-snapshot',
    'diet-p18-integrity-daily',
    'diet-p19-idempotency-prune',
    'diet-p20-schema-drift-daily',
    'diet-p21-readiness-daily'
  ) and active;

  v_status:=case
    when coalesce((select writes_paused from private.diet_incident_control where singleton=true),false) then 'fail'
    when coalesce(v_latest.status,'fail')<>'pass' then 'fail'
    when coalesce(v_p18->>'status','critical')<>'clean' then 'fail'
    when coalesce((v_p20->>'drift')::boolean,true) then 'fail'
    when coalesce((v_p19->>'startedRows')::int,1)<>0 then 'fail'
    when coalesce((v_p15->>'failed_snapshot_count')::int,1)<>0 then 'fail'
    when v_recent_cron_failures>0 then 'warning'
    when v_expected_jobs<>6 then 'warning'
    else 'pass'
  end;

  return jsonb_build_object(
    'release','P21',
    'status',v_status,
    'checkedAt',clock_timestamp(),
    'latestFailureCertificationStatus',v_latest.status,
    'latestFailureCertificationAt',v_latest.ran_at,
    'p15FailedSnapshots',coalesce((v_p15->>'failed_snapshot_count')::int,0),
    'p15LatestCapturedAt',v_p15->>'latest_captured_at',
    'p18IntegrityStatus',v_p18->>'status',
    'p19StartedRequests',coalesce((v_p19->>'startedRows')::int,0),
    'p20SchemaDrift',coalesce((v_p20->>'drift')::boolean,true),
    'recentDietCronFailures24h',v_recent_cron_failures,
    'activeExpectedDietJobs',v_expected_jobs,
    'expectedDietJobs',6,
    'writesPaused',coalesce((select writes_paused from private.diet_incident_control where singleton=true),false),
    'autoRepair',false
  );
end
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p21_run_failure_certification(p_source text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source text:=case when p_source in ('release','manual') then p_source else 'manual' end;
  v_scenarios jsonb:='[]'::jsonb;
  v_passed integer;
  v_failed integer;
  v_status text;
  v_uid uuid;
  v_food uuid;
  v_favorite boolean;
  v_food_updated timestamptz;
  v_old_claims text:=current_setting('request.jwt.claims',true);
  v_read jsonb;
  v_export jsonb;
  v_verify jsonb;
  v_plan jsonb;
  v_integrity jsonb;
  v_p19 jsonb;
  v_p20 jsonb;
  v_snapshot uuid;
  v_ok boolean;
  v_detail jsonb;
  v_replay jsonb;
  v_replay_ok boolean:=false;
  v_payload_collision boolean:=false;
  v_stale_conflict boolean:=false;
  v_constraint_rejected boolean:=false;
  v_write_freeze_rejected boolean:=false;
  v_before_hash text;
  v_drift_hash text;
  v_after_hash text;
  v_drift_ok boolean:=false;
  v_req text;
  v_anon_exec integer;
  v_service_boundary_ok boolean;
  v_cron_ok boolean;
begin
  select f.user_id,f.id,f.favorite,f.updated_at
    into v_uid,v_food,v_favorite,v_food_updated
  from public.saved_foods f
  order by f.created_at
  limit 1;

  if v_uid is null then
    raise exception 'P21 certification requires at least one Diet owner with a saved food';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_uid,'role','authenticated','is_anonymous',false)::text,
    true
  );

  select count(*) into v_anon_exec
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname like 'diet_app_%'
    and has_function_privilege('anon',p.oid,'EXECUTE');
  v_ok:=v_anon_exec=0;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p14_anon_diet_api_denied','passed',v_ok,'detail',jsonb_build_object('anonExecutableFunctions',v_anon_exec)
  ));

  select snapshot_id into v_snapshot
  from private.diet_recovery_snapshots
  order by captured_at desc
  limit 1;
  if v_snapshot is not null then
    v_verify:=private.diet_p15_verify_snapshot(v_snapshot);
    v_plan:=private.diet_p15_restore_plan(v_snapshot);
  end if;
  v_ok:=v_snapshot is not null
    and coalesce((v_verify->>'ok')::boolean,false)
    and coalesce((v_verify->>'hash_ok')::boolean,false)
    and coalesce((v_verify->>'schema_ok')::boolean,false)
    and coalesce((v_plan->>'safe_to_stage')::boolean,false)
    and not coalesce((v_plan->>'destructive_restore_is_automatic')::boolean,true);
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p15_verified_recovery_plan','passed',v_ok,
    'detail',jsonb_build_object(
      'snapshotPresent',v_snapshot is not null,
      'snapshotVerified',coalesce((v_verify->>'ok')::boolean,false),
      'safeToStage',coalesce((v_plan->>'safe_to_stage')::boolean,false),
      'automaticDestructiveRestore',coalesce((v_plan->>'destructive_restore_is_automatic')::boolean,true)
    )
  ));

  v_read:=public.diet_app_read_snapshot();
  v_ok:=jsonb_typeof(v_read)='object'
    and jsonb_typeof(v_read->'profile')='object'
    and jsonb_typeof(v_read->'dailyLogs')='array'
    and jsonb_array_length(v_read->'dailyLogs')>=1;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p16_authenticated_read_available','passed',v_ok,
    'detail',jsonb_build_object('profilePresent',jsonb_typeof(v_read->'profile')='object','dailyLogs',coalesce(jsonb_array_length(v_read->'dailyLogs'),0))
  ));

  v_export:=public.diet_app_export_owner_data();
  v_ok:=v_export->>'format'='diet-copilot-owner-export'
    and (v_export->>'userId')::uuid=v_uid
    and (v_export->>'tableCount')::int=18
    and coalesce((v_export->'privacy'->>'authTokensIncluded')::boolean,true)=false
    and coalesce((v_export->'privacy'->>'oauthCredentialsIncluded')::boolean,true)=false
    and coalesce((v_export->'privacy'->>'nativeCredentialDigestIncluded')::boolean,true)=false
    and coalesce((v_export->'privacy'->>'recoverySnapshotsIncluded')::boolean,true)=false;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p17_authoritative_export_safe','passed',v_ok,
    'detail',jsonb_build_object('tableCount',v_export->'tableCount','totalRows',v_export->'totalRows')
  ));

  v_integrity:=private.diet_p18_integrity_report();
  v_ok:=v_integrity->>'status'='clean'
    and coalesce((v_integrity->>'failedCheckCount')::int,1)=0
    and coalesce((v_integrity->>'failureCount')::bigint,1)=0;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p18_integrity_baseline_clean','passed',v_ok,
    'detail',jsonb_build_object('status',v_integrity->>'status','checkCount',v_integrity->'checkCount','failureCount',v_integrity->'failureCount')
  ));

  begin
    begin
      update public.saved_foods set calories=-1 where id=v_food;
    exception
      when check_violation then v_constraint_rejected:=true;
    end;
    raise exception using errcode='P0001',message='p21 rollback numeric probe';
  exception
    when sqlstate 'P0001' then null;
    when others then v_constraint_rejected:=false;
  end;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p18_invalid_numeric_write_rejected','passed',v_constraint_rejected
  ));

  v_req:='p21:cert:'||substr(replace(gen_random_uuid()::text,'-',''),1,24);
  begin
    begin
      perform public.diet_app_set_saved_food_favorite(v_food,v_favorite,v_req);
      v_replay:=public.diet_app_set_saved_food_favorite(v_food,v_favorite,v_req);
      v_replay_ok:=coalesce((v_replay->>'p19_replay')::boolean,false);
    exception when others then
      v_replay_ok:=false;
    end;

    begin
      perform public.diet_app_set_saved_food_favorite(v_food,not v_favorite,v_req);
    exception when others then
      if sqlerrm like 'Request ID collision:%' then
        v_payload_collision:=true;
      end if;
    end;

    begin
      perform public.diet_app_delete_saved_food(
        v_food,
        v_food_updated-interval '1 second',
        'p21:stale:'||substr(replace(gen_random_uuid()::text,'-',''),1,24)
      );
    exception when others then
      if sqlerrm like 'Conflict:%' then
        v_stale_conflict:=true;
      end if;
    end;

    raise exception using errcode='P0001',message='p21 rollback mutation probes';
  exception
    when sqlstate 'P0001' then null;
    when others then
      v_replay_ok:=false;
  end;

  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p19_exact_replay_after_lost_response','passed',v_replay_ok
  ));
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p19_same_id_changed_payload_rejected','passed',v_payload_collision
  ));
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p19_stale_content_write_rejected','passed',v_stale_conflict
  ));

  v_p19:=public.diet_p19_concurrency_status();
  v_ok:=coalesce((v_p19->>'startedRows')::int,1)=0
    and coalesce((v_p19->>'ownerMutationSerialization')::boolean,false)
    and coalesce((v_p19->>'payloadBoundIdempotency')::boolean,false);
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p19_no_stuck_mutation_requests','passed',v_ok,
    'detail',jsonb_build_object('startedRows',v_p19->'startedRows','ledgerRows',v_p19->'ledgerRows')
  ));

  begin
    perform private.diet_p21_set_write_freeze(true,'P21 controlled failure injection');
    begin
      perform public.diet_app_set_saved_food_favorite(
        v_food,v_favorite,
        'p21:freeze:'||substr(replace(gen_random_uuid()::text,'-',''),1,24)
      );
    exception when sqlstate '55000' then
      if sqlerrm like 'Diet writes are temporarily paused%' then
        v_write_freeze_rejected:=true;
      end if;
    end;
    raise exception using errcode='P0001',message='p21 rollback incident freeze';
  exception
    when sqlstate 'P0001' then null;
    when others then v_write_freeze_rejected:=false;
  end;

  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','incident_write_freeze_blocks_mutations','passed',
    v_write_freeze_rejected
      and not coalesce((select writes_paused from private.diet_incident_control where singleton=true),true)
  ));

  v_before_hash:=private.diet_p20_schema_fingerprint();
  begin
    execute 'alter table public.meals add constraint diet_p21_failure_probe check (true) not valid';
    v_drift_hash:=private.diet_p20_schema_fingerprint();
    raise exception using errcode='P0001',message='p21 rollback drift probe';
  exception
    when sqlstate 'P0001' then null;
    when others then null;
  end;
  v_after_hash:=private.diet_p20_schema_fingerprint();
  v_drift_ok:=v_drift_hash is not null
    and v_drift_hash<>v_before_hash
    and v_after_hash=v_before_hash
    and not exists(select 1 from pg_catalog.pg_constraint where conname='diet_p21_failure_probe');
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p20_schema_drift_detected_and_rolled_back','passed',v_drift_ok,
    'detail',jsonb_build_object('driftDetected',coalesce(v_drift_hash<>v_before_hash,false),'restored',v_after_hash=v_before_hash)
  ));

  v_p20:=public.diet_p20_release_status();
  v_ok:=coalesce((v_p20->>'drift')::boolean,true)=false
    and v_p20->>'lastAuditStatus'='clean';
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','p20_certified_schema_clean_after_probe','passed',v_ok,
    'detail',jsonb_build_object('drift',v_p20->'drift','lastAuditStatus',v_p20->>'lastAuditStatus')
  ));

  select count(*)=6 into v_cron_ok
  from cron.job
  where jobname in (
    'diet-p15-daily-snapshot',
    'diet-p15-monthly-snapshot',
    'diet-p18-integrity-daily',
    'diet-p19-idempotency-prune',
    'diet-p20-schema-drift-daily',
    'diet-p21-readiness-daily'
  ) and active;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','scheduled_recovery_watchdogs_present','passed',v_cron_ok
  ));

  select
    not has_function_privilege('anon','public.diet_p18_integrity_report()','EXECUTE')
    and not has_function_privilege('authenticated','public.diet_p18_integrity_report()','EXECUTE')
    and not has_function_privilege('anon','public.diet_p19_concurrency_status()','EXECUTE')
    and not has_function_privilege('authenticated','public.diet_p19_concurrency_status()','EXECUTE')
    and not has_function_privilege('anon','public.diet_p20_release_status()','EXECUTE')
    and not has_function_privilege('authenticated','public.diet_p20_release_status()','EXECUTE')
    into v_service_boundary_ok;
  v_scenarios:=v_scenarios||jsonb_build_array(jsonb_build_object(
    'name','operational_status_endpoints_service_only','passed',v_service_boundary_ok
  ));

  perform set_config('request.jwt.claims',coalesce(nullif(v_old_claims,''),'{}'),true);

  select count(*) filter(where coalesce((x->>'passed')::boolean,false)),
         count(*) filter(where not coalesce((x->>'passed')::boolean,false))
    into v_passed,v_failed
  from jsonb_array_elements(v_scenarios) x;

  v_status:=case when v_failed=0 then 'pass' else 'fail' end;
  v_detail:=jsonb_build_object(
    'release','P21',
    'kind','failure_certification',
    'status',v_status,
    'ranAt',clock_timestamp(),
    'scenarioCount',jsonb_array_length(v_scenarios),
    'passedCount',v_passed,
    'failedCount',v_failed,
    'autoRepair',false,
    'destructiveRestoreExecuted',false,
    'scenarios',v_scenarios
  );

  insert into private.diet_incident_certifications(
    kind,source,status,scenario_count,passed_count,failed_count,report
  ) values(
    'failure_certification',v_source,v_status,jsonb_array_length(v_scenarios),v_passed,v_failed,v_detail
  );

  return v_detail;
exception
  when others then
    perform set_config('request.jwt.claims',coalesce(nullif(v_old_claims,''),'{}'),true);
    raise;
end
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p21_run_readiness_audit(p_source text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source text:=case when p_source in ('release','manual','cron') then p_source else 'manual' end;
  v_report jsonb;
  v_status text;
begin
  v_report:=private.diet_p21_readiness_report();
  v_status:=case
    when v_report->>'status'='pass' then 'pass'
    when v_report->>'status'='warning' then 'warning'
    else 'fail'
  end;

  insert into private.diet_incident_certifications(
    kind,source,status,scenario_count,passed_count,failed_count,report
  ) values(
    'readiness',v_source,v_status,6,
    case when v_status='pass' then 6 else 0 end,
    case when v_status='fail' then 1 else 0 end,
    v_report
  );

  delete from private.diet_incident_certifications
  where ran_at < clock_timestamp()-interval '365 days';

  return v_report;
end
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p21_set_write_freeze(p_paused boolean, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
begin
  if p_paused and v_reason is null then
    raise exception 'Incident write freeze requires a reason';
  end if;

  update private.diet_incident_control
  set writes_paused=p_paused,
      reason=case when p_paused then v_reason else null end,
      updated_at=clock_timestamp()
  where singleton=true;

  return jsonb_build_object(
    'writesPaused',p_paused,
    'reasonSet',v_reason is not null,
    'updatedAt',(select updated_at from private.diet_incident_control where singleton=true)
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.diet_p21_incident_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_failure private.diet_incident_certifications%rowtype;
  v_readiness private.diet_incident_certifications%rowtype;
begin
  select * into v_failure
  from private.diet_incident_certifications
  where kind='failure_certification'
  order by ran_at desc limit 1;

  select * into v_readiness
  from private.diet_incident_certifications
  where kind='readiness'
  order by ran_at desc limit 1;

  return jsonb_build_object(
    'release','P21',
    'latestFailureCertificationStatus',v_failure.status,
    'latestFailureCertificationAt',v_failure.ran_at,
    'failureScenarioCount',v_failure.scenario_count,
    'failurePassedCount',v_failure.passed_count,
    'failureFailedCount',v_failure.failed_count,
    'latestReadinessStatus',v_readiness.status,
    'latestReadinessAt',v_readiness.ran_at,
    'retentionDays',365,
    'writesPaused',coalesce((select writes_paused from private.diet_incident_control where singleton=true),false),
    'autoRepair',false,
    'destructiveFailureInjection',false
  );
end
$function$
;

revoke all on function private.diet_p21_readiness_report() from public,anon,authenticated;
grant execute on function private.diet_p21_readiness_report() to service_role;
revoke all on function private.diet_p21_run_failure_certification(text) from public,anon,authenticated;
grant execute on function private.diet_p21_run_failure_certification(text) to service_role;
revoke all on function private.diet_p21_run_readiness_audit(text) from public,anon,authenticated;
grant execute on function private.diet_p21_run_readiness_audit(text) to service_role;
revoke all on function private.diet_p21_set_write_freeze(boolean,text) from public,anon,authenticated;
grant execute on function private.diet_p21_set_write_freeze(boolean,text) to service_role;
revoke all on function public.diet_p21_incident_status() from public,anon,authenticated;
grant execute on function public.diet_p21_incident_status() to service_role;

do $cron$
declare j record;
begin
  for j in select jobid from cron.job where jobname='diet-p21-readiness-daily' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$cron$;
select cron.schedule(
  'diet-p21-readiness-daily',
  '47 3 * * *',
  $cmd$select private.diet_p21_run_readiness_audit('cron');$cmd$
);

select private.diet_p20_certify_release(
  'P21','P21.0','release',
  'P21 full failure-injection, incident-response and recovery certification'
);
select private.diet_p20_run_drift_audit('release');

do $cert$
declare r jsonb;
begin
  r:=private.diet_p21_run_failure_certification('release');
  if r->>'status'<>'pass' or (r->>'failedCount')::int<>0 or (r->>'scenarioCount')::int<>15 then
    raise exception 'P21 failure certification did not pass: %',r;
  end if;
  r:=private.diet_p21_run_readiness_audit('release');
  if r->>'status'<>'pass' then
    raise exception 'P21 readiness certification did not pass: %',r;
  end if;
end
$cert$;
