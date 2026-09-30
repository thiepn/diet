
create table if not exists private.platform_upgrade_certifications (
  certification_id uuid primary key default gen_random_uuid(),
  certified_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('release','manual','pre_upgrade','post_upgrade')),
  target_postgres text not null,
  current_postgres text not null,
  status text not null check (status in ('pass','warning','fail','pending')),
  schema_sha256 text not null,
  report jsonb not null
);
alter table private.platform_upgrade_certifications enable row level security;
revoke all on table private.platform_upgrade_certifications from public,anon,authenticated;
drop policy if exists platform_p23_upgrade_certifications_deny on private.platform_upgrade_certifications;
create policy platform_p23_upgrade_certifications_deny on private.platform_upgrade_certifications
as restrictive for all to authenticated using (false) with check (false);

CREATE OR REPLACE FUNCTION private.platform_p23_certify_readiness(p_source text DEFAULT 'manual'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_source text:=case when p_source in ('release','manual','pre_upgrade','post_upgrade') then p_source else 'manual' end;
  v_report jsonb;
  v_sha text;
  v_status text;
begin
  v_report:=private.platform_p23_upgrade_preflight();
  v_sha:=private.platform_p23_shared_schema_fingerprint();
  v_status:=case when v_report->>'status'='pass' then 'pass' else 'fail' end;

  insert into private.platform_upgrade_certifications(
    source,target_postgres,current_postgres,status,schema_sha256,report
  ) values(
    v_source,'17.11',current_setting('server_version'),v_status,v_sha,
    v_report||jsonb_build_object('schemaSha256',v_sha)
  );

  delete from private.platform_upgrade_certifications
  where certified_at<clock_timestamp()-interval '730 days';

  return v_report||jsonb_build_object(
    'schemaSha256',v_sha,
    'certificationStatus',v_status
  );
end
$function$
;

CREATE OR REPLACE FUNCTION private.platform_p23_post_upgrade_validation()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_current_num integer:=current_setting('server_version_num')::integer;
  v_current_sha text:=private.platform_p23_shared_schema_fingerprint();
  v_baseline private.platform_upgrade_certifications%rowtype;
  v_preflight jsonb:=private.platform_p23_upgrade_preflight();
  v_match boolean;
  v_upgraded boolean:=v_current_num>=170011;
begin
  select * into v_baseline
  from private.platform_upgrade_certifications
  where status='pass'
  order by certified_at desc
  limit 1;

  v_match:=v_baseline.certification_id is not null and v_baseline.schema_sha256=v_current_sha;

  return jsonb_build_object(
    'release','P23',
    'status',case
      when not v_upgraded then 'pending'
      when v_match and v_preflight->>'status'='pass' then 'pass'
      else 'fail'
    end,
    'upgradedToTargetOrNewer',v_upgraded,
    'currentPostgres',current_setting('server_version'),
    'targetPostgres','17.11',
    'schemaFingerprintMatchesBaseline',v_match,
    'baselineSha256',v_baseline.schema_sha256,
    'currentSha256',v_current_sha,
    'baselineCertifiedAt',v_baseline.certified_at,
    'preflightStatus',v_preflight->>'status',
    'requiresBrowserAndEdgeFunctionSmokeTests',true
  );
end
$function$
;

CREATE OR REPLACE FUNCTION private.platform_p23_shared_schema_contract()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
  'format','platform-p23-shared-schema-v1',
  'schemas',array['public','private','notes_private','wttn_private','canvas_admin'],
  'relations',coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'schema',n.nspname,
        'name',c.relname,
        'kind',c.relkind,
        'rls',c.relrowsecurity,
        'columns',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'name',a.attname,
              'type',pg_catalog.format_type(a.atttypid,a.atttypmod),
              'notNull',a.attnotnull,
              'identity',a.attidentity,
              'generated',a.attgenerated
            ) order by a.attnum
          )
          from pg_attribute a
          where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped
        ),'[]'::jsonb),
        'constraints',coalesce((
          select jsonb_agg(pg_get_constraintdef(con.oid,true) order by con.conname)
          from pg_constraint con where con.conrelid=c.oid
        ),'[]'::jsonb),
        'indexes',coalesce((
          select jsonb_agg(pg_get_indexdef(i.indexrelid) order by ic.relname)
          from pg_index i join pg_class ic on ic.oid=i.indexrelid
          where i.indrelid=c.oid
        ),'[]'::jsonb),
        'policies',coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'name',pol.polname,
              'permissive',pol.polpermissive,
              'roles',pol.polroles::text,
              'cmd',pol.polcmd,
              'qual',pg_get_expr(pol.polqual,pol.polrelid),
              'check',pg_get_expr(pol.polwithcheck,pol.polrelid)
            ) order by pol.polname
          )
          from pg_policy pol where pol.polrelid=c.oid
        ),'[]'::jsonb),
        'triggers',coalesce((
          select jsonb_agg(pg_get_triggerdef(t.oid,true) order by t.tgname)
          from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal
        ),'[]'::jsonb)
      ) order by n.nspname,c.relname
    )
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')
      and c.relkind in ('r','p')
  ),'[]'::jsonb),
  'functions',coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'schema',n.nspname,
        'name',p.proname,
        'args',pg_get_function_identity_arguments(p.oid),
        'result',pg_get_function_result(p.oid),
        'securityDefiner',p.prosecdef,
        'config',coalesce(to_jsonb(p.proconfig),'[]'::jsonb),
        'definition',pg_get_functiondef(p.oid)
      )
      order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)
    )
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where p.prokind='f'
      and n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')
  ),'[]'::jsonb),
  'cron',coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'jobname',jobname,
        'schedule',schedule,
        'database',database,
        'username',username,
        'active',active,
        'command',command
      ) order by jobname
    )
    from cron.job
  ),'[]'::jsonb),
  'extensions',coalesce((
    select jsonb_agg(extname order by extname)
    from pg_extension
  ),'[]'::jsonb)
)
$function$
;

CREATE OR REPLACE FUNCTION private.platform_p23_shared_schema_fingerprint()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select encode(
  extensions.digest(
    convert_to(private.platform_p23_shared_schema_contract()::text,'UTF8'),
    'sha256'
  ),
  'hex'
)
$function$
;

CREATE OR REPLACE FUNCTION private.platform_p23_upgrade_preflight()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_server_num integer:=current_setting('server_version_num')::integer;
  v_server_version text:=current_setting('server_version');
  v_ltree integer;
  v_btree_gist integer;
  v_custom_ops integer;
  v_legacy_pgcrypto integer;
  v_reg_cols integer;
  v_deprecated_ext integer;
  v_extension_mismatch integer;
  v_md5_roles integer;
  v_slots integer;
  v_cron_rows bigint;
  v_cron_bytes bigint;
  v_cron_failures_7d bigint;
  v_cron_active integer;
  v_cron_total integer;
  v_scheduler integer;
  v_registered_apps integer;
  v_unclassified_tables integer;
  v_surfaces jsonb;
  v_p18 jsonb;
  v_p20 jsonb;
  v_p21 jsonb;
  v_p22 jsonb;
  v_safe boolean;
begin
  select count(*) into v_ltree
  from pg_index idx
  join lateral unnest(idx.indclass::oid[]) with ordinality as k(opclass,pos) on true
  join pg_opclass oc on oc.oid=k.opclass
  join pg_type ty on ty.oid=oc.opcintype
  where k.pos<=idx.indnkeyatts and ty.typname in ('ltree','_ltree');

  select count(distinct idx.indexrelid) into v_btree_gist
  from pg_index idx
  join lateral unnest(idx.indclass::oid[]) with ordinality as k(opclass,pos) on true
  join pg_opclass oc on oc.oid=k.opclass
  join pg_type ty on ty.oid=oc.opcintype
  where k.pos<=idx.indnkeyatts
    and exists(select 1 from pg_extension e where e.extname='btree_gist')
    and ty.typname in ('float4','float8');

  select count(*) into v_custom_ops
  from pg_operator o
  join pg_namespace n on n.oid=o.oprnamespace
  where n.nspname not in ('pg_catalog','information_schema')
    and ((o.oprrest<>0 and o.oprrest::oid>=10000) or (o.oprjoin<>0 and o.oprjoin::oid>=10000))
    and not exists(
      select 1 from pg_depend d
      where d.classid='pg_operator'::regclass and d.objid=o.oid and d.deptype='e'
    );

  select count(*) into v_legacy_pgcrypto
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prokind='f'
    and n.nspname not in ('pg_catalog','information_schema','extensions')
    and p.proname not in ('diet_p22_maintenance_report','platform_p23_upgrade_preflight')
    and lower(pg_get_functiondef(p.oid)) ~ '(pgp_sym|pgp_pub|cipher-algo|blowfish|cast5)';

  select count(*) into v_reg_cols
  from information_schema.columns
  where table_schema in ('public','private','notes_private','wttn_private','canvas_admin')
    and udt_name in (
      'regclass','regcollation','regconfig','regdictionary','regnamespace',
      'regoper','regoperator','regproc','regprocedure','regrole','regtype'
    );

  select count(*) into v_deprecated_ext
  from pg_extension where extname in ('plcoffee','plls','plv8','timescaledb','pgjwt');

  select count(*) into v_extension_mismatch
  from pg_available_extensions
  where installed_version is not null
    and default_version is not null
    and installed_version<>default_version;

  select count(*) into v_md5_roles
  from pg_authid where rolcanlogin and rolpassword like 'md5%';

  select count(*) into v_slots from pg_replication_slots;

  select count(*),
         pg_total_relation_size('cron.job_run_details'),
         count(*) filter(
           where start_time>clock_timestamp()-interval '7 days'
             and status not in ('succeeded','running')
         )
  into v_cron_rows,v_cron_bytes,v_cron_failures_7d
  from cron.job_run_details;

  select count(*),count(*) filter(where active)
  into v_cron_total,v_cron_active
  from cron.job;

  select count(*) into v_scheduler
  from pg_stat_activity
  where application_name ilike 'pg_cron scheduler';

  select count(*) into v_registered_apps
  from public.account_apps where active;

  with t as (
    select case
      when n.nspname='private' and c.relname like 'platform_%' then 'platform'
      when n.nspname='canvas_admin' or c.relname like 'canvas_%' then 'canvas'
      when n.nspname='notes_private' or c.relname like 'notes_%' then 'notes'
      when n.nspname='wttn_private' or c.relname like 'wttn_%' then 'wttn'
      when c.relname like 'account_%' then 'account'
      when c.relname like 'gomoku_%' then 'gomoku'
      when c.relname like 'micro_arcade_%' then 'micro_arcade'
      when c.relname like 'leaderboard_%' then 'leaderboard'
      when c.relname like 'tms60_%' then 'tms60'
      when c.relname like 'wordstrike_%' then 'wordstrike'
      when c.relname in (
        'activity_daily','ai_actions','change_log','daily_logs','diet_native_devices','goal_phases',
        'meal_items','meals','profiles','saved_food_portions','saved_foods','saved_meal_items',
        'saved_meals','target_recommendations','training_days','training_distribution_settings',
        'weekly_reviews','weight_entries'
      ) or (n.nspname='private' and c.relname like 'diet_%') then 'diet'
      else 'unclassified'
    end app
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')
      and c.relkind in ('r','p')
  )
  select count(*) filter(where app='unclassified') into v_unclassified_tables from t;

  with relation_counts as (
    select app,count(*)::int relations
    from (
      select case
        when n.nspname='private' and c.relname like 'platform_%' then 'platform'
      when n.nspname='canvas_admin' or c.relname like 'canvas_%' then 'canvas'
        when n.nspname='notes_private' or c.relname like 'notes_%' then 'notes'
        when n.nspname='wttn_private' or c.relname like 'wttn_%' then 'wttn'
        when c.relname like 'account_%' then 'account'
        when c.relname like 'gomoku_%' then 'gomoku'
        when c.relname like 'micro_arcade_%' then 'micro_arcade'
        when c.relname like 'leaderboard_%' then 'leaderboard'
        when c.relname like 'tms60_%' then 'tms60'
        when c.relname like 'wordstrike_%' then 'wordstrike'
        when c.relname in (
          'activity_daily','ai_actions','change_log','daily_logs','diet_native_devices','goal_phases',
          'meal_items','meals','profiles','saved_food_portions','saved_foods','saved_meal_items',
          'saved_meals','target_recommendations','training_days','training_distribution_settings',
          'weekly_reviews','weight_entries'
        ) or (n.nspname='private' and c.relname like 'diet_%') then 'diet'
        else 'unclassified'
      end app
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')
        and c.relkind in ('r','p')
    ) q group by app
  ),
  function_counts as (
    select app,count(*)::int functions
    from (
      select case
        when p.proname like 'platform_p23_%' then 'platform'
        when n.nspname='canvas_admin' or p.proname like 'canvas_%' or p.proname in ('capture_element_history','restore_transaction') then 'canvas'
        when n.nspname='notes_private' or p.proname like '%notes%' then 'notes'
        when n.nspname='wttn_private' or p.proname like 'wttn_%' then 'wttn'
        when p.proname like 'account_%' or p.proname like '%thiepn_account%' or p.proname like '%thiepn_app%' or p.proname in ('get_thiepn_ecosystem','export_thiepn_platform_snapshot') then 'account'
        when p.proname like '%gomoku%' then 'gomoku'
        when p.proname like 'micro_arcade_%' then 'micro_arcade'
        when p.proname like '%leaderboard%' or p.proname='submit_leaderboard_result' then 'leaderboard'
        when p.proname like 'tms60_%' or p.proname like '%tms60%' then 'tms60'
        when p.proname like 'wordstrike_%' then 'wordstrike'
        when n.nspname='private' or p.proname like 'diet_%' or p.proname like 'diet_p%' or p.proname like '%_from_ai' or p.proname in ('get_diet_context','search_diet_history','undo_ai_action') then 'diet'
        else 'unclassified'
      end app
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where p.prokind='f'
        and n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')

    ) q group by app
  )
  select coalesce(jsonb_object_agg(
    coalesce(r.app,f.app),
    jsonb_build_object(
      'relations',coalesce(r.relations,0),
      'functions',coalesce(f.functions,0)
    )
    order by coalesce(r.app,f.app)
  ),'{}'::jsonb)
  into v_surfaces
  from relation_counts r full join function_counts f using(app);

  v_p18:=private.diet_p18_integrity_report();
  v_p20:=public.diet_p20_release_status();
  v_p21:=public.diet_p21_incident_status();
  v_p22:=public.diet_p22_maintenance_status();

  v_safe:=
    v_ltree=0
    and v_btree_gist=0
    and v_custom_ops=0
    and v_legacy_pgcrypto=0
    and v_reg_cols=0
    and v_deprecated_ext=0
    and v_extension_mismatch=0
    and v_md5_roles=0
    and v_slots=0
    and v_cron_failures_7d=0
    and v_cron_bytes<52428800
    and v_cron_total=v_cron_active
    and v_scheduler>=1
    and v_registered_apps>=5
    and v_unclassified_tables=0
    and coalesce(v_p18->>'status','critical')='clean'
    and not coalesce((v_p20->>'drift')::boolean,true)
    and coalesce(v_p21->>'latestFailureCertificationStatus','fail')='pass'
    and coalesce(v_p21->>'latestReadinessStatus','fail')='pass'
    and coalesce(v_p22#>>'{current,status}','fail')='pass';

  return jsonb_build_object(
    'release','P23',
    'status',case when v_safe then 'pass' else 'fail' end,
    'safeToScheduleUpgrade',v_safe,
    'checkedAt',clock_timestamp(),
    'currentPostgres',v_server_version,
    'currentServerVersionNum',v_server_num,
    'targetPostgres','17.11',
    'targetServerVersionNum',170011,
    'upgradeAvailable',v_server_num<170011,
    'sharedProject',true,
    'registeredActiveApps',v_registered_apps,
    'certifiedSurfaces',v_surfaces,
    'edgeFunctionInventoryRequired',true,
    'hazards',jsonb_build_object(
      'ltreeIndexes',v_ltree,
      'btreeGistFloatIndexes',v_btree_gist,
      'customOperators',v_custom_ops,
      'legacyPgcryptoFunctionRefs',v_legacy_pgcrypto,
      'regTypeColumns',v_reg_cols,
      'deprecatedExtensions',v_deprecated_ext,
      'extensionVersionMismatches',v_extension_mismatch,
      'md5LoginRoles',v_md5_roles,
      'replicationSlots',v_slots
    ),
    'cron',jsonb_build_object(
      'jobs',v_cron_total,
      'activeJobs',v_cron_active,
      'historyRows',v_cron_rows,
      'historyBytes',v_cron_bytes,
      'failures7d',v_cron_failures_7d,
      'schedulerWorkers',v_scheduler
    ),
    'priorGates',jsonb_build_object(
      'dietIntegrity',v_p18->>'status',
      'dietSchemaDrift',coalesce((v_p20->>'drift')::boolean,true),
      'dietFailureCertification',v_p21->>'latestFailureCertificationStatus',
      'dietReadiness',v_p21->>'latestReadinessStatus',
      'dietMaintenance',v_p22#>>'{current,status}'
    ),
    'automaticUpgrade',false,
    'requiresMaintenanceWindow',true,
    'requiresCrossAppPostUpgradeValidation',true
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.platform_p23_upgrade_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_latest private.platform_upgrade_certifications%rowtype;
begin
  select * into v_latest
  from private.platform_upgrade_certifications
  order by certified_at desc
  limit 1;

  return jsonb_build_object(
    'release','P23',
    'serviceOnly',true,
    'latestCertificationAt',v_latest.certified_at,
    'latestCertificationStatus',v_latest.status,
    'targetPostgres',coalesce(v_latest.target_postgres,'17.11'),
    'certifiedSchemaSha256',v_latest.schema_sha256,
    'currentPreflight',private.platform_p23_upgrade_preflight(),
    'postUpgradeValidation',private.platform_p23_post_upgrade_validation(),
    'automaticUpgrade',false,
    'certificationRetentionDays',730
  );
end
$function$
;

revoke all on function private.platform_p23_shared_schema_contract() from public,anon,authenticated;
grant execute on function private.platform_p23_shared_schema_contract() to service_role;
revoke all on function private.platform_p23_shared_schema_fingerprint() from public,anon,authenticated;
grant execute on function private.platform_p23_shared_schema_fingerprint() to service_role;
revoke all on function private.platform_p23_upgrade_preflight() from public,anon,authenticated;
grant execute on function private.platform_p23_upgrade_preflight() to service_role;
revoke all on function private.platform_p23_certify_readiness(text) from public,anon,authenticated;
grant execute on function private.platform_p23_certify_readiness(text) to service_role;
revoke all on function private.platform_p23_post_upgrade_validation() from public,anon,authenticated;
grant execute on function private.platform_p23_post_upgrade_validation() to service_role;
revoke all on function public.platform_p23_upgrade_status() from public,anon,authenticated;
grant execute on function public.platform_p23_upgrade_status() to service_role;

do $cert$
declare r jsonb;
begin
  r:=private.platform_p23_certify_readiness('release');
  if r->>'certificationStatus'<>'pass' or coalesce((r->>'safeToScheduleUpgrade')::boolean,false)<>true then
    raise exception 'P23 shared-platform upgrade readiness did not pass: %',r;
  end if;
end
$cert$;
