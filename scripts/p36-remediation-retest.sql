-- P36 read-only remediation/freeze retest.
-- SELECT/CTE only. No DDL/DML.

-- Current Diet integrity/readiness/maintenance evidence.
select private.diet_p18_integrity_report() ->> 'status' as p18_status,
       (private.diet_p21_readiness_report() ->> 'p20SchemaDrift')::boolean as p20_schema_drift,
       private.diet_p21_readiness_report() ->> 'status' as p21_status,
       private.diet_p22_maintenance_report() ->> 'status' as p22_status,
       private.diet_p20_schema_fingerprint() as semantic_schema_sha256;

-- Current cron evidence.
select count(*) as cron_jobs,
       count(*) filter (where active) as active_cron_jobs
from cron.job;

select count(*) as cron_runs_24h,
       count(*) filter (where status <> 'succeeded') as cron_failures_24h
from cron.job_run_details
where start_time >= clock_timestamp() - interval '24 hours';

-- P34-D003: exact deny-by-default property for all current RLS/no-policy relations.
with no_policy as (
  select c.oid,n.nspname as schema_name,c.relname as table_name
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in ('r','p')
    and c.relrowsecurity
    and n.nspname not in ('pg_catalog','information_schema')
    and not exists (select 1 from pg_policy p where p.polrelid=c.oid)
)
select count(*) as tables,
       count(*) filter (where
         has_table_privilege('anon',oid,'SELECT') or has_table_privilege('anon',oid,'INSERT')
         or has_table_privilege('anon',oid,'UPDATE') or has_table_privilege('anon',oid,'DELETE')
       ) as anon_effective_dml,
       count(*) filter (where
         has_table_privilege('authenticated',oid,'SELECT') or has_table_privilege('authenticated',oid,'INSERT')
         or has_table_privilege('authenticated',oid,'UPDATE') or has_table_privilege('authenticated',oid,'DELETE')
       ) as authenticated_effective_dml
from no_policy;

-- P34-D002: static privileged-RPC invariants.
with sd as (
  select p.oid,pg_get_functiondef(p.oid) as defn,coalesce(array_to_string(p.proconfig,','),'') as config
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where p.prosecdef and n.nspname='public'
    and has_function_privilege('authenticated',p.oid,'EXECUTE')
)
select count(*) as functions,
       count(*) filter (where has_function_privilege('anon',oid,'EXECUTE')) as anon_executable,
       count(*) filter (where defn ~* 'auth[.]uid[[:space:]]*[(]') as references_auth_uid,
       count(*) filter (where config ~* 'search_path') as controlled_search_path,
       count(*) filter (where defn ~* 'raise[[:space:]]+(exception|sqlstate)' or defn ~* 'return[[:space:]]+null') as explicit_static_reject_signal
from sd;

-- Latest release epoch.
select version as migration_version,name as migration_name
from supabase_migrations.schema_migrations
order by version desc
limit 1;
