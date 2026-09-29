-- P15: Diet recovery snapshots, verification, retention and scheduled capture.
create extension if not exists pg_cron;

create table if not exists private.diet_recovery_snapshots (
  snapshot_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  captured_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('scheduled','monthly','manual','drill','pre_restore','post_restore')),
  schema_version text not null default 'diet-p15-v1',
  migration_version text not null,
  schema_sha256 text not null check (schema_sha256 ~ '^[0-9a-f]{64}$'),
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  row_counts jsonb not null,
  payload jsonb not null,
  payload_bytes bigint not null check (payload_bytes >= 0),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed')),
  verification jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  unique(user_id,snapshot_date,source)
);

create index if not exists diet_recovery_snapshots_user_captured_idx
  on private.diet_recovery_snapshots(user_id,captured_at desc);

create index if not exists diet_recovery_snapshots_source_captured_idx
  on private.diet_recovery_snapshots(source,captured_at desc);

alter table private.diet_recovery_snapshots enable row level security;
revoke all on table private.diet_recovery_snapshots from public, anon, authenticated;
grant select on table private.diet_recovery_snapshots to service_role;

create or replace function private.diet_p15_schema_sha256()
returns text
language sql
stable
security definer
set search_path = ''
as $$
with target_tables(table_name) as (
  values
    ('profiles'),('daily_logs'),('meals'),('meal_items'),('weight_entries'),('goal_phases'),
    ('saved_foods'),('saved_food_portions'),('saved_meals'),('saved_meal_items'),
    ('target_recommendations'),('activity_daily'),('training_distribution_settings'),
    ('training_days'),('ai_actions'),('change_log'),('weekly_reviews'),('diet_native_devices')
),
cols as (
  select c.table_name,c.ordinal_position,c.column_name,c.data_type,c.udt_name,c.is_nullable,
         c.column_default,c.is_identity,c.is_generated
  from information_schema.columns c
  join target_tables t using(table_name)
  where c.table_schema='public'
),
cons as (
  select cl.relname as table_name, con.conname, con.contype,
         pg_get_constraintdef(con.oid,true) as definition
  from pg_constraint con
  join pg_class cl on cl.oid=con.conrelid
  join pg_namespace ns on ns.oid=cl.relnamespace
  join target_tables t on t.table_name=cl.relname
  where ns.nspname='public'
),
doc as (
  select jsonb_build_object(
    'columns',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'table',table_name,'position',ordinal_position,'column',column_name,
          'type',data_type,'udt',udt_name,'nullable',is_nullable,
          'default',column_default,'identity',is_identity,'generated',is_generated
        )
        order by table_name,ordinal_position
      ) from cols
    ),'[]'::jsonb),
    'constraints',coalesce((
      select jsonb_agg(
        jsonb_build_object('table',table_name,'name',conname,'type',contype,'definition',definition)
        order by table_name,conname
      ) from cons
    ),'[]'::jsonb)
  ) as payload
)
select encode(extensions.digest(payload::text,'sha256'),'hex') from doc
$$;

create or replace function private.diet_p15_verify_snapshot(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.diet_recovery_snapshots%rowtype;
  t text;
  rows_json jsonb;
  expected_count bigint;
  actual_count bigint;
  parsed_count bigint;
  bad_owner_count bigint;
  secret_field_count bigint := 0;
  count_errors jsonb := '[]'::jsonb;
  parse_errors jsonb := '[]'::jsonb;
  owner_errors jsonb := '[]'::jsonb;
  current_hash text;
  current_schema_hash text;
  hash_ok boolean;
  schema_ok boolean;
  ok boolean;
  result jsonb;
  target_tables text[] := array[
    'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
    'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
    'target_recommendations','activity_daily','training_distribution_settings',
    'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
  ];
begin
  select * into s
  from private.diet_recovery_snapshots
  where snapshot_id=p_snapshot_id
  for update;

  if not found then
    raise exception 'Diet recovery snapshot not found';
  end if;

  current_hash:=encode(extensions.digest(s.payload::text,'sha256'),'hex');
  current_schema_hash:=private.diet_p15_schema_sha256();
  hash_ok:=(current_hash=s.payload_sha256);
  schema_ok:=(current_schema_hash=s.schema_sha256);

  foreach t in array target_tables loop
    rows_json:=s.payload->t;
    if rows_json is null or jsonb_typeof(rows_json)<>'array' then
      parse_errors:=parse_errors||jsonb_build_array(jsonb_build_object('table',t,'reason','missing_or_not_array'));
      continue;
    end if;

    expected_count:=coalesce((s.row_counts->>t)::bigint,-1);
    actual_count:=jsonb_array_length(rows_json);
    if expected_count<>actual_count then
      count_errors:=count_errors||jsonb_build_array(jsonb_build_object(
        'table',t,'expected',expected_count,'actual',actual_count
      ));
    end if;

    select count(*) into bad_owner_count
    from jsonb_array_elements(rows_json) e
    where e->>'user_id' is distinct from s.user_id::text;
    if bad_owner_count>0 then
      owner_errors:=owner_errors||jsonb_build_array(jsonb_build_object('table',t,'rows',bad_owner_count));
    end if;

    if t='diet_native_devices' then
      select count(*) into secret_field_count
      from jsonb_array_elements(rows_json) e
      where e ? 'credential_digest';
      if secret_field_count>0 then
        parse_errors:=parse_errors||jsonb_build_array(jsonb_build_object(
          'table',t,'reason','credential_digest_present'
        ));
      end if;
    end if;

    begin
      execute format(
        'select count(*) from jsonb_populate_recordset(null::public.%I,$1)',
        t
      ) into parsed_count using rows_json;
      if parsed_count<>actual_count then
        parse_errors:=parse_errors||jsonb_build_array(jsonb_build_object(
          'table',t,'reason','parse_count_mismatch','parsed',parsed_count,'actual',actual_count
        ));
      end if;
    exception when others then
      parse_errors:=parse_errors||jsonb_build_array(jsonb_build_object(
        'table',t,'reason','schema_parse_failed','sqlstate',sqlstate
      ));
    end;
  end loop;

  ok:=hash_ok and schema_ok
      and jsonb_array_length(count_errors)=0
      and jsonb_array_length(parse_errors)=0
      and jsonb_array_length(owner_errors)=0;

  result:=jsonb_build_object(
    'ok',ok,
    'snapshot_id',s.snapshot_id,
    'user_id',s.user_id,
    'captured_at',s.captured_at,
    'source',s.source,
    'hash_ok',hash_ok,
    'schema_ok',schema_ok,
    'count_errors',count_errors,
    'parse_errors',parse_errors,
    'owner_errors',owner_errors,
    'payload_bytes',s.payload_bytes
  );

  update private.diet_recovery_snapshots
  set verification_status=case when ok then 'verified' else 'failed' end,
      verification=result,
      verified_at=clock_timestamp()
  where snapshot_id=s.snapshot_id;

  return result;
end
$$;

create or replace function private.diet_p15_capture_owner_snapshot(
  p_user_id uuid,
  p_source text default 'manual'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  rows_json jsonb;
  n bigint;
  payload jsonb := '{}'::jsonb;
  counts jsonb := '{}'::jsonb;
  payload_hash text;
  schema_hash text;
  migration_version text;
  sid uuid;
  verify_result jsonb;
  target_tables text[] := array[
    'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
    'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
    'target_recommendations','activity_daily','training_distribution_settings',
    'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
  ];
begin
  if p_user_id is null then raise exception 'Diet snapshot owner is required'; end if;
  if p_source not in ('scheduled','monthly','manual','drill','pre_restore','post_restore') then
    raise exception 'Invalid Diet snapshot source';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'Diet snapshot owner does not exist';
  end if;

  schema_hash:=private.diet_p15_schema_sha256();
  select max(version) into migration_version from supabase_migrations.schema_migrations;
  migration_version:=coalesce(migration_version,'unknown');

  foreach t in array target_tables loop
    if t='diet_native_devices' then
      execute format(
        'select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb),count(*) from (select to_jsonb(x)-''credential_digest'' as row_data from public.%I x where x.user_id=$1) q',
        t
      ) into rows_json,n using p_user_id;
    else
      execute format(
        'select coalesce(jsonb_agg(row_data order by row_data::text),''[]''::jsonb),count(*) from (select to_jsonb(x) as row_data from public.%I x where x.user_id=$1) q',
        t
      ) into rows_json,n using p_user_id;
    end if;

    payload:=payload||jsonb_build_object(t,rows_json);
    counts:=counts||jsonb_build_object(t,n);
  end loop;

  payload_hash:=encode(extensions.digest(payload::text,'sha256'),'hex');

  insert into private.diet_recovery_snapshots(
    user_id,snapshot_date,captured_at,source,schema_version,migration_version,
    schema_sha256,payload_sha256,row_counts,payload,payload_bytes,
    verification_status,verification,verified_at
  )
  values(
    p_user_id,(clock_timestamp() at time zone 'UTC')::date,clock_timestamp(),p_source,
    'diet-p15-v1',migration_version,schema_hash,payload_hash,counts,payload,
    pg_column_size(payload),'pending',null,null
  )
  on conflict(user_id,snapshot_date,source) do update set
    captured_at=excluded.captured_at,
    schema_version=excluded.schema_version,
    migration_version=excluded.migration_version,
    schema_sha256=excluded.schema_sha256,
    payload_sha256=excluded.payload_sha256,
    row_counts=excluded.row_counts,
    payload=excluded.payload,
    payload_bytes=excluded.payload_bytes,
    verification_status='pending',
    verification=null,
    verified_at=null
  returning snapshot_id into sid;

  verify_result:=private.diet_p15_verify_snapshot(sid);
  if coalesce((verify_result->>'ok')::boolean,false) is not true then
    raise exception 'Diet snapshot verification failed';
  end if;

  return sid;
end
$$;

create or replace function private.diet_p15_capture_all(p_source text default 'scheduled')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  captured integer := 0;
begin
  for uid in
    select distinct user_id
    from (
      select user_id from public.profiles
      union select user_id from public.daily_logs
      union select user_id from public.meals
      union select user_id from public.meal_items
      union select user_id from public.weight_entries
      union select user_id from public.goal_phases
      union select user_id from public.saved_foods
      union select user_id from public.saved_food_portions
      union select user_id from public.saved_meals
      union select user_id from public.saved_meal_items
      union select user_id from public.target_recommendations
      union select user_id from public.activity_daily
      union select user_id from public.training_distribution_settings
      union select user_id from public.training_days
      union select user_id from public.ai_actions
      union select user_id from public.change_log
      union select user_id from public.weekly_reviews
      union select user_id from public.diet_native_devices
    ) owners
  loop
    perform private.diet_p15_capture_owner_snapshot(uid,p_source);
    captured:=captured+1;
  end loop;
  return captured;
end
$$;

create or replace function private.diet_p15_prune()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from private.diet_recovery_snapshots
  where (source='scheduled' and captured_at < clock_timestamp()-interval '35 days')
     or (source='monthly' and captured_at < clock_timestamp()-interval '370 days')
     or (source='drill' and captured_at < clock_timestamp()-interval '14 days')
     or (source='post_restore' and captured_at < clock_timestamp()-interval '90 days');
  get diagnostics deleted_count = row_count;
  return deleted_count;
end
$$;

create or replace function private.diet_p15_daily_job()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.diet_p15_capture_all('scheduled');
  perform private.diet_p15_prune();
end
$$;

create or replace function private.diet_p15_monthly_job()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.diet_p15_capture_all('monthly');
  perform private.diet_p15_prune();
end
$$;

create or replace function private.diet_p15_restore_plan(p_snapshot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s private.diet_recovery_snapshots%rowtype;
  verification jsonb;
  current_counts jsonb := '{}'::jsonb;
  t text;
  n bigint;
  target_tables text[] := array[
    'profiles','daily_logs','meals','meal_items','weight_entries','goal_phases',
    'saved_foods','saved_food_portions','saved_meals','saved_meal_items',
    'target_recommendations','activity_daily','training_distribution_settings',
    'training_days','ai_actions','change_log','weekly_reviews','diet_native_devices'
  ];
begin
  select * into s from private.diet_recovery_snapshots where snapshot_id=p_snapshot_id;
  if not found then raise exception 'Diet recovery snapshot not found'; end if;

  verification:=private.diet_p15_verify_snapshot(p_snapshot_id);
  foreach t in array target_tables loop
    execute format('select count(*) from public.%I where user_id=$1',t) into n using s.user_id;
    current_counts:=current_counts||jsonb_build_object(t,n);
  end loop;

  return jsonb_build_object(
    'safe_to_stage',coalesce((verification->>'ok')::boolean,false)
                    and exists(select 1 from auth.users where id=s.user_id),
    'snapshot_id',s.snapshot_id,
    'user_id',s.user_id,
    'captured_at',s.captured_at,
    'source',s.source,
    'verification',verification,
    'snapshot_counts',s.row_counts,
    'current_counts',current_counts,
    'requires_maintenance_window',true,
    'destructive_restore_is_automatic',false,
    'native_device_credentials_restored',false,
    'note','P15 intentionally requires an operator-reviewed restore runbook; no browser or scheduled job can apply a destructive restore.'
  );
end
$$;

create or replace function private.diet_p15_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
select jsonb_build_object(
  'snapshot_count',(select count(*) from private.diet_recovery_snapshots),
  'owner_count',(select count(distinct user_id) from private.diet_recovery_snapshots),
  'latest_captured_at',(select max(captured_at) from private.diet_recovery_snapshots),
  'latest_verified_at',(select max(verified_at) from private.diet_recovery_snapshots where verification_status='verified'),
  'failed_snapshot_count',(select count(*) from private.diet_recovery_snapshots where verification_status='failed'),
  'total_payload_bytes',(select coalesce(sum(payload_bytes),0) from private.diet_recovery_snapshots),
  'schema_sha256',private.diet_p15_schema_sha256(),
  'daily_job_enabled',exists(select 1 from cron.job where jobname='diet-p15-daily-snapshot' and active),
  'monthly_job_enabled',exists(select 1 from cron.job where jobname='diet-p15-monthly-snapshot' and active)
)
$$;

revoke all on function private.diet_p15_schema_sha256() from public,anon,authenticated;
revoke all on function private.diet_p15_verify_snapshot(uuid) from public,anon,authenticated;
revoke all on function private.diet_p15_capture_owner_snapshot(uuid,text) from public,anon,authenticated;
revoke all on function private.diet_p15_capture_all(text) from public,anon,authenticated;
revoke all on function private.diet_p15_prune() from public,anon,authenticated;
revoke all on function private.diet_p15_daily_job() from public,anon,authenticated;
revoke all on function private.diet_p15_monthly_job() from public,anon,authenticated;
revoke all on function private.diet_p15_restore_plan(uuid) from public,anon,authenticated;
revoke all on function private.diet_p15_status() from public,anon,authenticated;

grant execute on function private.diet_p15_verify_snapshot(uuid) to service_role;
grant execute on function private.diet_p15_restore_plan(uuid) to service_role;
grant execute on function private.diet_p15_status() to service_role;

do $$
declare jid bigint;
begin
  select jobid into jid from cron.job where jobname='diet-p15-daily-snapshot';
  if jid is not null then perform cron.unschedule(jid); end if;
  perform cron.schedule(
    'diet-p15-daily-snapshot',
    '17 2 * * *',
    'select private.diet_p15_daily_job();'
  );

  jid:=null;
  select jobid into jid from cron.job where jobname='diet-p15-monthly-snapshot';
  if jid is not null then perform cron.unschedule(jid); end if;
  perform cron.schedule(
    'diet-p15-monthly-snapshot',
    '47 2 1 * *',
    'select private.diet_p15_monthly_job();'
  );
end
$$;
