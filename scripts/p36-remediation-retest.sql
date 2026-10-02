-- P36 read-only remediation retest.
-- This file MUST remain SELECT-only. It is evidence collection, not remediation DDL/DML.

-- 1. RLS-enabled/no-policy relations must remain unreachable to anon/authenticated
--    unless they are deliberately moved into a user-facing access model.
with r as (
  select c.oid,c.relname
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relkind in ('r','p')
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid=c.oid)
)
select
  count(*) as rls_no_policy_tables,
  count(*) filter (
    where has_table_privilege('anon',oid,'select')
       or has_table_privilege('anon',oid,'insert')
       or has_table_privilege('anon',oid,'update')
       or has_table_privilege('anon',oid,'delete')
  ) as anon_any_dml,
  count(*) filter (
    where has_table_privilege('authenticated',oid,'select')
       or has_table_privilege('authenticated',oid,'insert')
       or has_table_privilege('authenticated',oid,'update')
       or has_table_privilege('authenticated',oid,'delete')
  ) as authenticated_any_dml
from r;

-- 2. Authenticated-callable public SECURITY DEFINER functions must stay
--    authenticated-only, subject-bound and search-path controlled.
with f as (
  select p.oid,p.prosrc,p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.prosecdef
    and has_function_privilege('authenticated',p.oid,'execute')
)
select
  count(*) as authenticated_security_definers,
  count(*) filter (where has_function_privilege('anon',oid,'execute')) as anon_executable,
  count(*) filter (where prosrc ~* 'auth\.uid\s*\(') as references_auth_uid,
  count(*) filter (
    where exists (
      select 1
      from unnest(coalesce(proconfig,array[]::text[])) x
      where x='search_path=""' or x='search_path='
    )
  ) as empty_search_path,
  count(*) filter (where prosrc ~* 'raise exception|raise sqlstate') as explicit_reject
from f;

-- 3. Ownership origin evidence for the two P34-D005 relations.
select version,name
from supabase_migrations.schema_migrations
where version='20260912192748'
  and name='thiepn_account_diet_core';

-- 4. Frozen release epoch.
select
  private.platform_p23_shared_schema_fingerprint() as semantic_schema_sha256,
  (select version from supabase_migrations.schema_migrations order by version desc limit 1) as migration_version,
  (select name from supabase_migrations.schema_migrations order by version desc limit 1) as migration_name,
  (select count(*) from cron.job) as cron_jobs,
  clock_timestamp() as observed_at;
