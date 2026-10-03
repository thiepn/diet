-- P28 read-only multi-app governance inventory.
-- No DDL, DML, configuration mutation, session termination, or statistics reset.

select slug,name,path,active,sort_order
from public.account_apps
order by sort_order,slug;

select n.nspname as schema_name,c.relname,c.relkind,
       pg_total_relation_size(c.oid) as total_bytes
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p','v','m')
  and n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')
order by n.nspname,c.relname;

select n.nspname as schema_name,p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private','notes_private','wttn_private','canvas_admin')
order by n.nspname,p.proname,args;

select jobid,jobname,schedule,active
from cron.job
order by jobid;

select bucket_id,count(*) as objects,
       coalesce(sum((metadata->>'size')::bigint),0) as bytes
from storage.objects
group by bucket_id
order by bucket_id;

select jsonb_build_object(
  'databaseBytes',pg_database_size(current_database()),
  'serverVersion',current_setting('server_version'),
  'currentConnections',(select count(*) from pg_stat_activity where datname=current_database()),
  'maxConnections',current_setting('max_connections')::int,
  'postmasterStartedAt',pg_postmaster_start_time()
) as platform_snapshot;
