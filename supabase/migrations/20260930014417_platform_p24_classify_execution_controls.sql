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
        when p.proname like 'platform_p23_%' or p.proname like 'platform_p24_%' then 'platform'
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
