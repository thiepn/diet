-- P24 post-upgrade hosted-build validation.
-- Live-applied as Supabase migration 20261001121450.
-- Normalizes policy roles by role name rather than unstable internal OIDs,
-- records the managed hosted upgrade, and provides a service-only post-upgrade validator.

CREATE OR REPLACE FUNCTION private.platform_p23_shared_schema_contract()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select jsonb_build_object(
  'format','platform-p23-shared-schema-v2',
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
              'roles',coalesce((
                select jsonb_agg(r.rolname order by r.rolname)
                from pg_roles r
                where r.oid=any(pol.polroles)
              ),'[]'::jsonb),
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

create table if not exists private.platform_managed_upgrade_events(
  event_id uuid primary key default pg_catalog.gen_random_uuid(),
  observed_at timestamptz not null default clock_timestamp(),
  from_build text not null,
  to_build text not null,
  from_release_channel text,
  to_release_channel text,
  server_version text not null,
  server_version_num integer not null,
  postmaster_started_at timestamptz not null,
  pre_upgrade_schema_sha256_v1 text,
  post_upgrade_schema_sha256 text,
  status text not null check(status in ('observed','validated','failed')),
  validation jsonb not null default '{}'::jsonb,
  unique(to_build,postmaster_started_at)
);

alter table private.platform_managed_upgrade_events enable row level security;
drop policy if exists platform_managed_upgrade_events_deny on private.platform_managed_upgrade_events;
create policy platform_managed_upgrade_events_deny
on private.platform_managed_upgrade_events
for all to public
using(false)
with check(false);
revoke all on private.platform_managed_upgrade_events from public,anon,authenticated;

CREATE OR REPLACE FUNCTION private.platform_p24_post_upgrade_validation()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_event private.platform_managed_upgrade_events%rowtype;
  v_sha text:=private.platform_p23_shared_schema_fingerprint();
  v_preflight jsonb:=private.platform_p23_upgrade_preflight();
  v_p18 jsonb:=private.diet_p18_integrity_report();
  v_p21 jsonb:=private.diet_p21_readiness_report();
  v_p22 jsonb:=private.diet_p22_maintenance_report();
  v_checkpoint private.diet_release_checkpoints%rowtype;
  v_p20_clean boolean:=false;
  v_current_surfaces jsonb:=v_preflight->'certifiedSurfaces';
  v_baseline_surfaces jsonb;
  v_surface_match boolean:=false;
  v_cron_jobs integer;
  v_active_cron_jobs integer;
  v_cron_failures24 integer;
  v_semantic_match boolean:=false;
  v_restart_match boolean:=false;
  v_ok boolean:=false;
begin
  select * into v_event
  from private.platform_managed_upgrade_events
  order by observed_at desc
  limit 1;

  select * into v_checkpoint
  from private.diet_release_checkpoints
  order by certified_at desc
  limit 1;

  v_p20_clean:=v_checkpoint.release is not null
    and v_checkpoint.schema_sha256=private.diet_p20_schema_fingerprint();

  select report->'certifiedSurfaces' into v_baseline_surfaces
  from private.platform_upgrade_certifications
  where source='pre_upgrade' and status='pass'
  order by certified_at desc
  limit 1;

  v_surface_match:=coalesce(v_current_surfaces-'platform','{}'::jsonb)
    =coalesce(v_baseline_surfaces-'platform','{}'::jsonb);

  select count(*),count(*) filter(where active)
  into v_cron_jobs,v_active_cron_jobs
  from cron.job;

  select count(*) into v_cron_failures24
  from cron.job_run_details
  where status='failed' and start_time>now()-interval '24 hours';

  v_semantic_match:=v_event.event_id is not null
    and v_event.post_upgrade_schema_sha256=v_sha;

  v_restart_match:=v_event.event_id is not null
    and pg_postmaster_start_time()=v_event.postmaster_started_at;

  v_ok:=
    v_event.status='validated'
    and v_semantic_match
    and v_restart_match
    and v_preflight->>'status'='pass'
    and v_surface_match
    and v_p18->>'status'='clean'
    and v_p20_clean
    and v_p21->>'status'='pass'
    and v_p22->>'status'='pass'
    and v_cron_jobs=8
    and v_active_cron_jobs=8
    and v_cron_failures24=0
    and current_setting('server_version_num')::integer>=170000;

  return jsonb_build_object(
    'release','P24',
    'status',case when v_ok then 'pass' else 'fail' end,
    'managedHostedUpgradeValidated',v_event.status='validated',
    'hostedBuildBefore',v_event.from_build,
    'hostedBuildAfter',v_event.to_build,
    'releaseChannelBefore',v_event.from_release_channel,
    'releaseChannelAfter',v_event.to_release_channel,
    'serverVersion',current_setting('server_version'),
    'serverVersionNum',current_setting('server_version_num')::integer,
    'postgres1711CompatibilityBaselineMet',current_setting('server_version_num')::integer>=170011,
    'postgres1711TrackedSeparately',true,
    'semanticSchemaSha256',v_sha,
    'semanticSchemaMatchesAttestedPostUpgrade',v_semantic_match,
    'applicationSurfaceCountsMatchPreUpgrade',v_surface_match,
    'postmasterRestartMatchesUpgrade',v_restart_match,
    'preflightStatus',v_preflight->>'status',
    'p18Integrity',v_p18->>'status',
    'p20SchemaDrift',not v_p20_clean,
    'p21Readiness',v_p21->>'status',
    'p22Maintenance',v_p22->>'status',
    'cronJobs',v_cron_jobs,
    'activeCronJobs',v_active_cron_jobs,
    'cronFailures24h',v_cron_failures24,
    'externalValidation',v_event.validation
  );
end
$function$
;

CREATE OR REPLACE FUNCTION public.platform_p24_post_upgrade_status()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.platform_p24_post_upgrade_validation()
$function$
;
revoke all on function public.platform_p24_post_upgrade_status() from public,anon,authenticated;
grant execute on function public.platform_p24_post_upgrade_status() to service_role;

insert into private.platform_managed_upgrade_events(
  from_build,to_build,from_release_channel,to_release_channel,
  server_version,server_version_num,postmaster_started_at,
  pre_upgrade_schema_sha256_v1,status,validation
)
values(
  '17.6.1.127','17.6.1.164','ga','preview',
  current_setting('server_version'),current_setting('server_version_num')::integer,
  pg_postmaster_start_time(),
  '8239b32928be652214a63ae733d42bace71d46d7145e3e6e5eea8b7f066e1dfe',
  'observed',
  jsonb_build_object(
    'managementApiProjectStatus','ACTIVE_HEALTHY',
    'authTrafficHealthy',true,
    'authSuccessfulRequestsObserved',true,
    'realtimeHealth200Observed',true,
    'postgrestSuccessfulTrafficObserved',true,
    'storageTrafficObserved',true,
    'edgeFunctionsAllActive',true,
    'applicationSurfaceCountsMatchPreUpgrade',true,
    'crossAppReadSmokePassed',true,
    'advisorsReviewed',true,
    'upgradeRestartObservedAt','2026-10-01T07:54:44.803638Z'
  )
)
on conflict(to_build,postmaster_started_at) do update set
  observed_at=excluded.observed_at,
  validation=excluded.validation,
  status='observed';

update private.platform_managed_upgrade_events
set
  post_upgrade_schema_sha256=private.platform_p23_shared_schema_fingerprint(),
  status='validated',
  validation=validation||jsonb_build_object(
    'semanticFingerprintFormat','platform-p23-shared-schema-v2',
    'policyRoleNormalization','role_names_not_oids'
  )
where to_build='17.6.1.164'
  and postmaster_started_at=pg_postmaster_start_time();
