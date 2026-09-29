
create table if not exists private.diet_maintenance_audits (
  audit_id uuid primary key default gen_random_uuid(),
  audited_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('release','manual','cron')),
  status text not null check (status in ('pass','warning','fail')),
  pruned_cron_rows bigint not null default 0 check (pruned_cron_rows >= 0),
  report jsonb not null
);
alter table private.diet_maintenance_audits enable row level security;
revoke all on table private.diet_maintenance_audits from public,anon,authenticated;
drop policy if exists diet_p22_maintenance_audits_deny on private.diet_maintenance_audits;
create policy diet_p22_maintenance_audits_deny on private.diet_maintenance_audits
as restrictive for all to authenticated using (false) with check (false);

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
    ('private','diet_incident_control'),
    ('private','diet_maintenance_audits')
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
    'diet-p21-readiness-daily',
    'diet-p22-maintenance-weekly'
  ) and active;

  v_status:=case
    when coalesce((select writes_paused from private.diet_incident_control where singleton=true),false) then 'fail'
    when coalesce(v_latest.status,'fail')<>'pass' then 'fail'
    when coalesce(v_p18->>'status','critical')<>'clean' then 'fail'
    when coalesce((v_p20->>'drift')::boolean,true) then 'fail'
    when coalesce((v_p19->>'startedRows')::int,1)<>0 then 'fail'
    when coalesce((v_p15->>'failed_snapshot_count')::int,1)<>0 then 'fail'
    when v_recent_cron_failures>0 then 'warning'
    when v_expected_jobs<>7 then 'warning'
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
    'expectedDietJobs',7,
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

  select count(*)=7 into v_cron_ok
  from cron.job
  where jobname in (
    'diet-p15-daily-snapshot',
    'diet-p15-monthly-snapshot',
    'diet-p18-integrity-daily',
    'diet-p19-idempotency-prune',
    'diet-p20-schema-drift-daily',
    'diet-p21-readiness-daily',
    'diet-p22-maintenance-weekly'
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

CREATE OR REPLACE FUNCTION private.diet_p22_maintenance_report()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_server_num integer:=current_setting('server_version_num')::integer;
  v_server_version text:=current_setting('server_version');
  v_scheduler_workers integer;
  v_diet_jobs integer;
  v_extension_mismatch integer;
  v_deprecated_extensions integer;
  v_risk_extensions integer;
  v_custom_operators integer;
  v_diet_legacy_crypto integer;
  v_cron_rows bigint;
  v_cron_old_rows bigint;
  v_cron_bytes bigint;
  v_cron_failures_7d bigint;
  v_snapshot_age_hours numeric;
  v_p18 jsonb;
  v_p20 jsonb;
  v_p21 jsonb;
  v_status text;
begin
  select count(*) into v_scheduler_workers
  from pg_stat_activity
  where application_name ilike 'pg_cron scheduler';

  select count(*) into v_diet_jobs
  from cron.job
  where jobname in (
    'diet-p15-daily-snapshot',
    'diet-p15-monthly-snapshot',
    'diet-p18-integrity-daily',
    'diet-p19-idempotency-prune',
    'diet-p20-schema-drift-daily',
    'diet-p21-readiness-daily',
    'diet-p22-maintenance-weekly'
  ) and active;

  select count(*) into v_extension_mismatch
  from pg_available_extensions a
  where a.name in ('pg_cron','pgcrypto','uuid-ossp','pg_stat_statements')
    and a.installed_version is not null
    and a.default_version is not null
    and a.installed_version<>a.default_version;

  select count(*) into v_deprecated_extensions
  from pg_extension
  where extname in ('plcoffee','plls','plv8','timescaledb','pgjwt');

  select count(*) into v_risk_extensions
  from pg_extension
  where extname in ('ltree','btree_gist');

  select count(*) into v_custom_operators
  from pg_operator o
  join pg_namespace n on n.oid=o.oprnamespace
  where n.nspname not in ('pg_catalog','information_schema')
    and ((o.oprrest<>0 and o.oprrest::oid>=10000) or (o.oprjoin<>0 and o.oprjoin::oid>=10000))
    and not exists(
      select 1 from pg_depend d
      where d.classid='pg_operator'::regclass
        and d.objid=o.oid
        and d.deptype='e'
    );

  select count(*) into v_diet_legacy_crypto
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.proname <> 'diet_p22_maintenance_report'
    and (p.proname like 'diet_%' or p.proname like 'diet_p%')
    and lower(pg_get_functiondef(p.oid)) ~ '(pgp_sym|pgp_pub|encrypt\(|decrypt\()';

  select count(*),
         count(*) filter(where coalesce(d.end_time,d.start_time) < clock_timestamp()-interval '90 days'),
         pg_total_relation_size('cron.job_run_details'),
         count(*) filter(
           where d.start_time > clock_timestamp()-interval '7 days'
             and d.status not in ('succeeded','running')
         )
    into v_cron_rows,v_cron_old_rows,v_cron_bytes,v_cron_failures_7d
  from cron.job_run_details d
  where d.jobid in (select j.jobid from cron.job j where j.jobname like 'diet-%');

  select round(extract(epoch from (clock_timestamp()-max(captured_at)))/3600.0,2)
    into v_snapshot_age_hours
  from private.diet_recovery_snapshots;

  v_p18:=private.diet_p18_integrity_report();
  v_p20:=public.diet_p20_release_status();
  v_p21:=private.diet_p21_readiness_report();

  v_status:=case
    when v_scheduler_workers<1 then 'fail'
    when v_diet_jobs<>7 then 'fail'
    when coalesce(v_p18->>'status','critical')<>'clean' then 'fail'
    when coalesce((v_p20->>'drift')::boolean,true) then 'fail'
    when coalesce(v_p21->>'status','fail')='fail' then 'fail'
    when v_extension_mismatch>0 then 'warning'
    when v_deprecated_extensions>0 then 'warning'
    when v_cron_failures_7d>0 then 'warning'
    when coalesce(v_snapshot_age_hours,9999)>48 then 'warning'
    when v_cron_bytes>52428800 then 'warning'
    else 'pass'
  end;

  return jsonb_build_object(
    'release','P22',
    'status',v_status,
    'checkedAt',clock_timestamp(),
    'postgres',jsonb_build_object(
      'serverVersion',v_server_version,
      'serverVersionNum',v_server_num,
      'knownSecurityBaseline','17.11',
      'knownSecurityBaselineAnnounced','2026-09-25',
      'platformUpgradeAvailable',v_server_num<170011,
      'dietUpgradePreflightClean',v_risk_extensions=0 and v_custom_operators=0 and v_diet_legacy_crypto=0,
      'sharedProjectUpgradeRequiresCrossAppReview',true
    ),
    'extensions',jsonb_build_object(
      'versionMismatchCount',v_extension_mismatch,
      'deprecatedPg17ExtensionCount',v_deprecated_extensions,
      'ltreeOrBtreeGistInstalledCount',v_risk_extensions,
      'customOperatorRiskCount',v_custom_operators,
      'dietLegacyPgcryptoEncryptionFunctionCount',v_diet_legacy_crypto,
      'pgCronVersion',(select extversion from pg_extension where extname='pg_cron'),
      'pgCryptoVersion',(select extversion from pg_extension where extname='pgcrypto')
    ),
    'cron',jsonb_build_object(
      'schedulerWorkers',v_scheduler_workers,
      'activeExpectedDietJobs',v_diet_jobs,
      'expectedDietJobs',7,
      'historyRows',v_cron_rows,
      'historyRowsOlderThan90d',v_cron_old_rows,
      'historyBytes',v_cron_bytes,
      'failures7d',v_cron_failures_7d,
      'retentionDays',90
    ),
    'recovery',jsonb_build_object(
      'latestSnapshotAgeHours',v_snapshot_age_hours,
      'freshWithin48h',coalesce(v_snapshot_age_hours,9999)<=48
    ),
    'database',jsonb_build_object(
      'bytes',pg_database_size(current_database())
    ),
    'integrityStatus',v_p18->>'status',
    'schemaDrift',coalesce((v_p20->>'drift')::boolean,true),
    'incidentReadinessStatus',v_p21->>'status',
    'autoUpgrade',false,
    'autoDependencyUpdate',false
  );
end
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p22_prune_cron_history(p_retention_days integer DEFAULT 90)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_deleted bigint;
begin
  if p_retention_days < 35 or p_retention_days > 365 then
    raise exception 'Diet cron retention must be between 35 and 365 days';
  end if;

  delete from cron.job_run_details d
  where d.jobid in (
    select j.jobid
    from cron.job j
    where j.jobname like 'diet-%'
  )
    and coalesce(d.end_time,d.start_time) < clock_timestamp() - make_interval(days=>p_retention_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end
$function$
;

CREATE OR REPLACE FUNCTION private.diet_p22_run_maintenance(p_source text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source text:=case when p_source in ('release','manual','cron') then p_source else 'manual' end;
  v_pruned bigint;
  v_report jsonb;
begin
  v_pruned:=private.diet_p22_prune_cron_history(90);
  v_report:=private.diet_p22_maintenance_report();

  insert into private.diet_maintenance_audits(
    source,status,pruned_cron_rows,report
  ) values(
    v_source,
    case when v_report->>'status' in ('pass','warning','fail') then v_report->>'status' else 'fail' end,
    v_pruned,
    v_report||jsonb_build_object('prunedCronRows',v_pruned)
  );

  delete from private.diet_maintenance_audits
  where audited_at < clock_timestamp()-interval '730 days';

  return v_report||jsonb_build_object('prunedCronRows',v_pruned);
end
$function$
;

CREATE OR REPLACE FUNCTION public.diet_p22_maintenance_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_latest private.diet_maintenance_audits%rowtype;
  v_current jsonb;
begin
  select * into v_latest
  from private.diet_maintenance_audits
  order by audited_at desc
  limit 1;

  v_current:=private.diet_p22_maintenance_report();

  return jsonb_build_object(
    'release','P22',
    'current',v_current,
    'latestAuditAt',v_latest.audited_at,
    'latestAuditStatus',v_latest.status,
    'latestPrunedCronRows',coalesce(v_latest.pruned_cron_rows,0),
    'auditRetentionDays',730,
    'cronHistoryRetentionDays',90,
    'serviceOnly',true
  );
end
$function$
;

revoke all on function private.diet_p22_prune_cron_history(integer) from public,anon,authenticated;
grant execute on function private.diet_p22_prune_cron_history(integer) to service_role;
revoke all on function private.diet_p22_maintenance_report() from public,anon,authenticated;
grant execute on function private.diet_p22_maintenance_report() to service_role;
revoke all on function private.diet_p22_run_maintenance(text) from public,anon,authenticated;
grant execute on function private.diet_p22_run_maintenance(text) to service_role;
revoke all on function public.diet_p22_maintenance_status() from public,anon,authenticated;
grant execute on function public.diet_p22_maintenance_status() to service_role;

do $cron$
declare j record;
begin
  for j in select jobid from cron.job where jobname='diet-p22-maintenance-weekly' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$cron$;

select cron.schedule(
  'diet-p22-maintenance-weekly',
  '7 4 * * 0',
  $cmd$select private.diet_p22_run_maintenance('cron');$cmd$
);

select private.diet_p20_certify_release(
  'P22','P22.0','release',
  'P22 long-term operability, dependency, supply-chain and maintenance hardening'
);
select private.diet_p20_run_drift_audit('release');

do $cert$
declare r jsonb;
begin
  r:=private.diet_p21_run_failure_certification('release');
  if r->>'status'<>'pass' or (r->>'failedCount')::int<>0 or (r->>'scenarioCount')::int<>15 then
    raise exception 'P21 regression failed after P22: %',r;
  end if;
  r:=private.diet_p21_run_readiness_audit('release');
  if r->>'status'<>'pass' then
    raise exception 'P21 readiness failed after P22: %',r;
  end if;
  r:=private.diet_p22_run_maintenance('release');
  if r->>'status'<>'pass' then
    raise exception 'P22 maintenance certification did not pass: %',r;
  end if;
end
$cert$;
