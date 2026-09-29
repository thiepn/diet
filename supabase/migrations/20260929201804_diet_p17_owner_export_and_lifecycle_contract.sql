-- P17: authoritative owner export and lifecycle/privacy contract.

create or replace function public.diet_app_export_owner_data()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  is_anonymous boolean := coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  t text;
  rows_json jsonb;
  n bigint;
  tables_json jsonb := '{}'::jsonb;
  counts_json jsonb := '{}'::jsonb;
  total_rows bigint := 0;
  target_tables text[] := array[
    'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
    'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
    'target_recommendations','activity_daily','training_distribution_settings',
    'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
  ];
begin
  if uid is null or is_anonymous then
    raise exception 'Authenticated Diet account required' using errcode='42501';
  end if;

  foreach t in array target_tables loop
    if t='diet_native_devices' then
      execute format(
        'select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb),count(*) from (select to_jsonb(x)-''credential_digest'' as row_data from public.%I x where x.user_id=$1) q',
        t
      ) into rows_json,n using uid;
    else
      execute format(
        'select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb),count(*) from (select to_jsonb(x) as row_data from public.%I x where x.user_id=$1) q',
        t
      ) into rows_json,n using uid;
    end if;
    tables_json:=tables_json||jsonb_build_object(t,rows_json);
    counts_json:=counts_json||jsonb_build_object(t,n);
    total_rows:=total_rows+n;
  end loop;

  return jsonb_build_object(
    'format','diet-copilot-owner-export',
    'version',2,
    'schemaVersion','diet-p17-v1',
    'exportedAt',clock_timestamp(),
    'userId',uid,
    'tableCount',cardinality(target_tables),
    'totalRows',total_rows,
    'rowCounts',counts_json,
    'data',tables_json,
    'privacy',jsonb_build_object(
      'authTokensIncluded',false,
      'oauthCredentialsIncluded',false,
      'nativeCredentialDigestIncluded',false,
      'recoverySnapshotsIncluded',false,
      'operationalTelemetryIncluded',false,
      'localUiPreferencesIncluded',false
    ),
    'lifecycle',jsonb_build_object(
      'accountDeletionAuthority','delete_thiepn_account',
      'liveDataDeleteBehavior','auth_user_cascade',
      'inDatabaseRecoveryDeleteBehavior','auth_user_cascade',
      'encryptedOffsiteBackupRetentionDays',90,
      'note','Encrypted disaster-recovery artifacts may retain historical data until their configured retention expires; they are not an active account data source.'
    )
  );
end
$$;

revoke all on function public.diet_app_export_owner_data() from public,anon;
grant execute on function public.diet_app_export_owner_data() to authenticated,service_role;

comment on function public.diet_app_export_owner_data() is
'Diet P17 authoritative full owner export. SECURITY INVOKER; P14 RLS remains authoritative. Excludes auth/OAuth secrets, native credential digests, private recovery snapshots and local-only telemetry/preferences.';

create or replace function private.diet_p17_lifecycle_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with targets(table_name) as (
  values
    ('profiles'),('daily_logs'),('meals'),('meal_items'),('weight_entries'),('goal_phases'),
    ('saved_foods'),('saved_food_portions'),('saved_meals'),('saved_meal_items'),
    ('target_recommendations'),('activity_daily'),('training_distribution_settings'),
    ('training_days'),('ai_actions'),('change_log'),('weekly_reviews'),('diet_native_devices')
),
cascade_tables as (
  select distinct c.relname as table_name
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid=con.conrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join pg_catalog.pg_class rc on rc.oid=con.confrelid
  join pg_catalog.pg_namespace rn on rn.oid=rc.relnamespace
  where con.contype='f'
    and n.nspname='public'
    and rn.nspname='auth'
    and rc.relname='users'
    and con.confdeltype='c'
),
snapshot_cascade as (
  select exists(
    select 1
    from pg_catalog.pg_constraint con
    join pg_catalog.pg_class c on c.oid=con.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    join pg_catalog.pg_class rc on rc.oid=con.confrelid
    join pg_catalog.pg_namespace rn on rn.oid=rc.relnamespace
    where con.contype='f'
      and n.nspname='private'
      and c.relname='diet_recovery_snapshots'
      and rn.nspname='auth'
      and rc.relname='users'
      and con.confdeltype='c'
  ) as ok
)
select jsonb_build_object(
  'release','P17',
  'dietTableCount',(select count(*) from targets),
  'authCascadeTableCount',(select count(*) from targets t join cascade_tables c using(table_name)),
  'allDietTablesCascade',(select count(*) from targets t join cascade_tables c using(table_name))=(select count(*) from targets),
  'recoverySnapshotsCascade',(select ok from snapshot_cascade),
  'accountDeletionRpcPresent',to_regprocedure('public.delete_thiepn_account(text)') is not null,
  'platformExportRpcPresent',to_regprocedure('public.export_thiepn_platform_snapshot()') is not null,
  'dietOwnerExportRpcPresent',to_regprocedure('public.diet_app_export_owner_data()') is not null,
  'encryptedOffsiteBackupRetentionDays',90
)
$$;

revoke all on function private.diet_p17_lifecycle_status() from public,anon,authenticated;
grant execute on function private.diet_p17_lifecycle_status() to service_role;
