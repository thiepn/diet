
create table if not exists private.diet_release_checkpoints (
  release text primary key,
  operations_version text not null,
  schema_sha256 text not null check (schema_sha256 ~ '^[0-9a-f]{64}$'),
  certified_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('release','manual')),
  notes text
);

create table if not exists private.diet_schema_drift_audits (
  audit_id uuid primary key default gen_random_uuid(),
  audited_at timestamptz not null default clock_timestamp(),
  source text not null check (source in ('release','manual','cron')),
  status text not null check (status in ('clean','drift','no_checkpoint')),
  checkpoint_release text,
  expected_sha256 text,
  current_sha256 text not null check (current_sha256 ~ '^[0-9a-f]{64}$'),
  details jsonb not null
);

alter table private.diet_release_checkpoints enable row level security;
alter table private.diet_schema_drift_audits enable row level security;
revoke all on table private.diet_release_checkpoints from public,anon,authenticated;
revoke all on table private.diet_schema_drift_audits from public,anon,authenticated;

drop policy if exists diet_p20_release_checkpoints_deny on private.diet_release_checkpoints;
create policy diet_p20_release_checkpoints_deny
on private.diet_release_checkpoints
as restrictive
for all
to authenticated
using (false)
with check (false);

drop policy if exists diet_p20_schema_drift_audits_deny on private.diet_schema_drift_audits;
create policy diet_p20_schema_drift_audits_deny
on private.diet_schema_drift_audits
as restrictive
for all
to authenticated
using (false)
with check (false);

create or replace function private.diet_p20_schema_contract()
returns jsonb
language sql
stable
security definer
set search_path=''
as $fn$
with
target_relations(schema_name,table_name) as (
  values
    ('public','profiles'),
    ('public','daily_logs'),
    ('public','meals'),
    ('public','meal_items'),
    ('public','weight_entries'),
    ('public','goal_phases'),
    ('public','saved_foods'),
    ('public','saved_food_portions'),
    ('public','saved_meals'),
    ('public','saved_meal_items'),
    ('public','target_recommendations'),
    ('public','activity_daily'),
    ('public','training_distribution_settings'),
    ('public','training_days'),
    ('public','ai_actions'),
    ('public','change_log'),
    ('public','weekly_reviews'),
    ('public','diet_native_devices'),
    ('private','diet_recovery_snapshots'),
    ('private','diet_integrity_audits'),
    ('private','diet_mutation_requests'),
    ('private','diet_release_checkpoints'),
    ('private','diet_schema_drift_audits')
),
relations as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    c.relkind,
    c.relrowsecurity,
    c.relforcerowsecurity
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
columns as (
  select
    c.table_schema as schema_name,
    c.table_name,
    c.ordinal_position,
    c.column_name,
    c.data_type,
    c.udt_schema,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    c.is_identity,
    c.identity_generation,
    c.is_generated,
    c.generation_expression
  from information_schema.columns c
  join target_relations t
    on t.schema_name=c.table_schema and t.table_name=c.table_name
),
constraints as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    con.conname,
    con.contype,
    pg_catalog.pg_get_constraintdef(con.oid,true) as definition
  from pg_catalog.pg_constraint con
  join pg_catalog.pg_class c on c.oid=con.conrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
indexes as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    i.relname as index_name,
    pg_catalog.pg_get_indexdef(i.oid) as definition
  from pg_catalog.pg_index x
  join pg_catalog.pg_class c on c.oid=x.indrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join pg_catalog.pg_class i on i.oid=x.indexrelid
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
policies as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    p.polname as policy_name,
    p.polpermissive,
    p.polcmd,
    coalesce((
      select array_agg(r.rolname order by r.rolname)
      from pg_catalog.pg_roles r
      where r.oid=any(p.polroles)
    ),array[]::text[]) as roles,
    pg_catalog.pg_get_expr(p.polqual,p.polrelid) as using_expression,
    pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid) as check_expression
  from pg_catalog.pg_policy p
  join pg_catalog.pg_class c on c.oid=p.polrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
),
triggers as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    tg.tgname as trigger_name,
    pg_catalog.pg_get_triggerdef(tg.oid,true) as definition
  from pg_catalog.pg_trigger tg
  join pg_catalog.pg_class c on c.oid=tg.tgrelid
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  join target_relations t on t.schema_name=n.nspname and t.table_name=c.relname
  where not tg.tgisinternal
),
functions as (
  select
    n.nspname as schema_name,
    p.proname,
    pg_catalog.pg_get_function_identity_arguments(p.oid) as identity_args,
    p.prokind,
    p.prosecdef,
    p.provolatile,
    p.proconfig,
    coalesce(p.proacl::text,'') as acl,
    pg_catalog.pg_get_functiondef(p.oid) as definition
  from pg_catalog.pg_proc p
  join pg_catalog.pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private')
    and p.proname like 'diet_%'
),
crons as (
  select jobname,schedule,command,database,username,active
  from cron.job
  where jobname like 'diet-%'
)
select jsonb_build_object(
  'format','diet-p20-schema-contract-v1',
  'relations',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name) from relations x),'[]'::jsonb),
  'columns',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,ordinal_position) from columns x),'[]'::jsonb),
  'constraints',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,conname) from constraints x),'[]'::jsonb),
  'indexes',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,index_name) from indexes x),'[]'::jsonb),
  'policies',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,policy_name) from policies x),'[]'::jsonb),
  'triggers',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,table_name,trigger_name) from triggers x),'[]'::jsonb),
  'functions',coalesce((select jsonb_agg(to_jsonb(x) order by schema_name,proname,identity_args) from functions x),'[]'::jsonb),
  'crons',coalesce((select jsonb_agg(to_jsonb(x) order by jobname) from crons x),'[]'::jsonb)
)
$fn$;

revoke all on function private.diet_p20_schema_contract() from public,anon,authenticated;
grant execute on function private.diet_p20_schema_contract() to service_role;

create or replace function private.diet_p20_schema_fingerprint()
returns text
language sql
stable
security definer
set search_path=''
as $fn$
select encode(
  extensions.digest(
    convert_to(private.diet_p20_schema_contract()::text,'UTF8'),
    'sha256'
  ),
  'hex'
)
$fn$;

revoke all on function private.diet_p20_schema_fingerprint() from public,anon,authenticated;
grant execute on function private.diet_p20_schema_fingerprint() to service_role;

create or replace function private.diet_p20_certify_release(
  p_release text,
  p_operations_version text,
  p_source text default 'release',
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_release text:=trim(coalesce(p_release,''));
  v_operations text:=trim(coalesce(p_operations_version,''));
  v_source text:=case when p_source in ('release','manual') then p_source else 'manual' end;
  v_hash text;
begin
  if v_release !~ '^P[0-9]{1,3}$' then
    raise exception 'Invalid release label';
  end if;
  if v_operations !~ '^P[0-9]{1,3}\.0$' then
    raise exception 'Invalid operations version';
  end if;

  v_hash:=private.diet_p20_schema_fingerprint();

  insert into private.diet_release_checkpoints(
    release,operations_version,schema_sha256,certified_at,source,notes
  ) values(
    v_release,v_operations,v_hash,clock_timestamp(),v_source,nullif(trim(coalesce(p_notes,'')),'')
  )
  on conflict(release) do update set
    operations_version=excluded.operations_version,
    schema_sha256=excluded.schema_sha256,
    certified_at=excluded.certified_at,
    source=excluded.source,
    notes=excluded.notes;

  return jsonb_build_object(
    'release',v_release,
    'operationsVersion',v_operations,
    'schemaSha256',v_hash,
    'source',v_source
  );
end
$fn$;

revoke all on function private.diet_p20_certify_release(text,text,text,text) from public,anon,authenticated;
grant execute on function private.diet_p20_certify_release(text,text,text,text) to service_role;

create or replace function private.diet_p20_run_drift_audit(
  p_source text default 'manual'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_source text:=case when p_source in ('release','manual','cron') then p_source else 'manual' end;
  v_current text:=private.diet_p20_schema_fingerprint();
  v_checkpoint private.diet_release_checkpoints%rowtype;
  v_status text;
  v_details jsonb;
begin
  select * into v_checkpoint
  from private.diet_release_checkpoints
  order by certified_at desc
  limit 1;

  if not found then
    v_status:='no_checkpoint';
  elsif v_checkpoint.schema_sha256=v_current then
    v_status:='clean';
  else
    v_status:='drift';
  end if;

  v_details:=jsonb_build_object(
    'release','P20',
    'status',v_status,
    'checkpointRelease',v_checkpoint.release,
    'operationsVersion',v_checkpoint.operations_version,
    'expectedSha256',v_checkpoint.schema_sha256,
    'currentSha256',v_current,
    'autoRepair',false
  );

  insert into private.diet_schema_drift_audits(
    source,status,checkpoint_release,expected_sha256,current_sha256,details
  ) values(
    v_source,v_status,v_checkpoint.release,v_checkpoint.schema_sha256,v_current,v_details
  );

  delete from private.diet_schema_drift_audits
  where audited_at < clock_timestamp()-interval '365 days';

  return v_details;
end
$fn$;

revoke all on function private.diet_p20_run_drift_audit(text) from public,anon,authenticated;
grant execute on function private.diet_p20_run_drift_audit(text) to service_role;

create or replace function public.diet_p20_release_status()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $fn$
declare
  v_current text:=private.diet_p20_schema_fingerprint();
  v_checkpoint private.diet_release_checkpoints%rowtype;
  v_latest_audit private.diet_schema_drift_audits%rowtype;
begin
  select * into v_checkpoint
  from private.diet_release_checkpoints
  order by certified_at desc
  limit 1;

  select * into v_latest_audit
  from private.diet_schema_drift_audits
  order by audited_at desc
  limit 1;

  return jsonb_build_object(
    'release','P20',
    'checkpointRelease',v_checkpoint.release,
    'operationsVersion',v_checkpoint.operations_version,
    'expectedSha256',v_checkpoint.schema_sha256,
    'currentSha256',v_current,
    'drift',coalesce(v_checkpoint.schema_sha256<>v_current,true),
    'lastAuditStatus',v_latest_audit.status,
    'lastAuditedAt',v_latest_audit.audited_at,
    'auditRetentionDays',365,
    'autoRepair',false,
    'latestDietMigration',(
      select jsonb_build_object('version',version,'name',name)
      from supabase_migrations.schema_migrations
      where name like 'diet_%'
      order by version desc
      limit 1
    )
  );
end
$fn$;

revoke all on function public.diet_p20_release_status() from public,anon,authenticated;
grant execute on function public.diet_p20_release_status() to service_role;

do $cron$
declare j record;
begin
  for j in select jobid from cron.job where jobname='diet-p20-schema-drift-daily' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$cron$;

select cron.schedule(
  'diet-p20-schema-drift-daily',
  '37 3 * * *',
  $cmd$select private.diet_p20_run_drift_audit('cron');$cmd$
);

select private.diet_p20_certify_release(
  'P20',
  'P20.0',
  'release',
  'Initial certified Diet production schema contract'
);

select private.diet_p20_run_drift_audit('release');
