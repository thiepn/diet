-- P27 read-only capacity and saturation snapshot.
-- No DDL, DML, session termination, statistics reset, or configuration change.

select jsonb_build_object(
  'checkedAt',clock_timestamp(),
  'databaseBytes',pg_database_size(current_database()),
  'databasePretty',pg_size_pretty(pg_database_size(current_database())),
  'maxConnections',current_setting('max_connections')::int,
  'superuserReservedConnections',current_setting('superuser_reserved_connections')::int,
  'usableConnections',current_setting('max_connections')::int-current_setting('superuser_reserved_connections')::int,
  'currentConnections',(select count(*) from pg_stat_activity where datname=current_database()),
  'activeConnections',(select count(*) from pg_stat_activity where datname=current_database() and state='active'),
  'idleConnections',(select count(*) from pg_stat_activity where datname=current_database() and state='idle'),
  'idleInTransaction',(select count(*) from pg_stat_activity where datname=current_database() and state='idle in transaction'),
  'longRunningOver30s',(
    select count(*) from pg_stat_activity
    where datname=current_database()
      and pid<>pg_backend_pid()
      and state in ('active','idle in transaction')
      and now()-query_start>interval '30 seconds'
  ),
  'blockedSessions',(
    select count(*) from pg_stat_activity
    where datname=current_database()
      and cardinality(pg_blocking_pids(pid))>0
  ),
  'largestRelationBytes',(
    select coalesce(max(pg_total_relation_size(relid)),0)
    from pg_catalog.pg_statio_user_tables
  ),
  'userTableBytes',(
    select coalesce(sum(pg_table_size(relid)),0)
    from pg_catalog.pg_statio_user_tables
  ),
  'userIndexBytes',(
    select coalesce(sum(pg_indexes_size(relid)),0)
    from pg_catalog.pg_statio_user_tables
  ),
  'walBytesSinceReset',(
    select coalesce(sum(wal_bytes),0)::numeric from extensions.pg_stat_statements
  ),
  'statementStatsReset',(select stats_reset from extensions.pg_stat_statements_info)
) as capacity;

select usename as role,state,count(*) as connections
from pg_stat_activity
where datname=current_database()
group by usename,state
order by count(*) desc,usename,state;

select schemaname,relname,
       pg_total_relation_size(relid) as total_bytes,
       pg_size_pretty(pg_total_relation_size(relid)) as total_size
from pg_catalog.pg_statio_user_tables
order by total_bytes desc
limit 20;
