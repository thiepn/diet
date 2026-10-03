-- P26 read-only steady-state baseline capture.
-- Run only after P25 is certified complete.
-- This script intentionally contains no DDL/DML and does not reset statistics.

select jsonb_build_object(
  'checkedAt',clock_timestamp(),
  'serverVersion',current_setting('server_version'),
  'postmasterStartedAt',pg_postmaster_start_time(),
  'database',(
    select jsonb_build_object(
      'numBackends',numbackends,
      'xactCommit',xact_commit,
      'xactRollback',xact_rollback,
      'blksRead',blks_read,
      'blksHit',blks_hit,
      'cacheHitRatio',round((blks_hit::numeric/nullif(blks_hit+blks_read,0))*100,4),
      'tempFiles',temp_files,
      'tempBytes',temp_bytes,
      'deadlocks',deadlocks,
      'conflicts',conflicts,
      'statsReset',stats_reset
    )
    from pg_stat_database where datname=current_database()
  ),
  'ioCache',(
    select jsonb_object_agg(name,ratio)
    from (
      select 'indexHitRate' name,
        round((sum(idx_blks_hit)::numeric/nullif(sum(idx_blks_hit+idx_blks_read),0))*100,4) ratio
      from pg_statio_user_indexes
      union all
      select 'tableHitRate',
        round((sum(heap_blks_hit)::numeric/nullif(sum(heap_blks_hit)+sum(heap_blks_read),0))*100,4)
      from pg_statio_user_tables
    ) s
  ),
  'connections',(
    select jsonb_object_agg(state,cnt)
    from (
      select coalesce(state,'null') state,count(*) cnt
      from pg_stat_activity
      where datname=current_database()
      group by state
    ) s
  ),
  'locks',(
    select jsonb_build_object(
      'waiting',count(*) filter(where not granted),
      'granted',count(*) filter(where granted)
    ) from pg_locks
  ),
  'statements',(
    select jsonb_build_object(
      'statsReset',(select stats_reset from pg_stat_statements_info),
      'trackedStatements',(select count(*) from pg_stat_statements),
      'totalCalls',(select coalesce(sum(calls),0) from pg_stat_statements),
      'weightedMeanExecMs',(select round((coalesce(sum(total_exec_time),0)/nullif(sum(calls),0))::numeric,3) from pg_stat_statements),
      'repeatedSlowStatements',(select count(*) from pg_stat_statements where calls>=10 and mean_exec_time>100)
    )
  )
) as baseline;

select r.rolname as role,
       count(*) as statement_count,
       sum(s.calls)::bigint as calls,
       round(sum(s.total_exec_time)::numeric,3) as total_exec_ms,
       round((sum(s.total_exec_time)/nullif(sum(s.calls),0))::numeric,3) as weighted_mean_ms,
       count(*) filter(where s.mean_exec_time>100 and s.calls>=10) as repeated_slow_statements
from pg_stat_statements s
join pg_roles r on r.oid=s.userid
group by r.rolname
order by sum(s.total_exec_time) desc;

select schemaname,relname,n_live_tup,n_dead_tup,seq_scan,idx_scan,
       case when seq_scan+idx_scan>0
         then round((idx_scan::numeric/(seq_scan+idx_scan))*100,2)
       end as index_scan_pct,
       last_autovacuum,last_autoanalyze,
       pg_total_relation_size(relid) as total_bytes
from pg_stat_user_tables
where schemaname in ('public','private','notes_private','wttn_private','canvas_admin')
order by pg_total_relation_size(relid) desc;
