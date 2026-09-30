CREATE OR REPLACE FUNCTION private.platform_p24_execution_gate()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_preflight jsonb:=private.platform_p23_upgrade_preflight();
  v_current_sha text:=private.platform_p23_shared_schema_fingerprint();
  v_latest private.platform_upgrade_certifications%rowtype;
  v_latest_migration_version text;
  v_latest_migration_name text;
  v_latest_migration_at timestamptz;
  v_quiet_minutes numeric;
  v_writes_paused boolean;
  v_ready boolean;
begin
  select * into v_latest
  from private.platform_upgrade_certifications
  where status='pass'
  order by certified_at desc
  limit 1;

  select version,name into v_latest_migration_version,v_latest_migration_name
  from supabase_migrations.schema_migrations
  order by version desc
  limit 1;

  begin
    v_latest_migration_at:=to_timestamp(v_latest_migration_version,'YYYYMMDDHH24MISS');
  exception when others then
    v_latest_migration_at:=null;
  end;

  v_quiet_minutes:=case
    when v_latest_migration_at is null then 0
    else round(extract(epoch from (clock_timestamp()-v_latest_migration_at))/60.0,2)
  end;

  select writes_paused into v_writes_paused
  from private.diet_incident_control
  where singleton=true;

  v_ready:=
    coalesce((v_preflight->>'safeToScheduleUpgrade')::boolean,false)
    and v_latest.certification_id is not null
    and v_latest.schema_sha256=v_current_sha
    and current_setting('server_version_num')::integer<170011
    and coalesce(v_quiet_minutes,0)>=10
    and coalesce(v_writes_paused,false)=false;

  return jsonb_build_object(
    'release','P24',
    'status',case when v_ready then 'ready_for_manual_upgrade' else 'blocked' end,
    'readyForManualUpgrade',v_ready,
    'currentPostgres',current_setting('server_version'),
    'targetPostgres','17.11',
    'currentSchemaSha256',v_current_sha,
    'certifiedSchemaSha256',v_latest.schema_sha256,
    'schemaMatchesCertification',coalesce(v_latest.schema_sha256=v_current_sha,false),
    'latestCertificationAt',v_latest.certified_at,
    'latestMigrationVersion',v_latest_migration_version,
    'latestMigrationName',v_latest_migration_name,
    'latestMigrationAt',v_latest_migration_at,
    'quietMinutes',v_quiet_minutes,
    'minimumQuietMinutes',10,
    'writesPaused',coalesce(v_writes_paused,false),
    'preflightStatus',v_preflight->>'status',
    'safeToScheduleUpgrade',coalesce((v_preflight->>'safeToScheduleUpgrade')::boolean,false),
    'managedUpgradeMustUseSupabaseInfrastructure',true,
    'automaticUpgrade',false
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.platform_p24_execution_status()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select private.platform_p24_execution_gate()
$function$
;

revoke all on function private.platform_p24_execution_gate() from public,anon,authenticated;
grant execute on function private.platform_p24_execution_gate() to service_role;
revoke all on function public.platform_p24_execution_status() from public,anon,authenticated;
grant execute on function public.platform_p24_execution_status() to service_role;
