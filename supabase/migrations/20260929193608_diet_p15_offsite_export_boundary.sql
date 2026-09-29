create or replace function public.diet_p15_offsite_export()
returns jsonb
language sql
security definer
set search_path = ''
as $$
with latest as (
  select distinct on (user_id)
    snapshot_id,user_id,captured_at,source,schema_version,migration_version,
    schema_sha256,payload_sha256,row_counts,payload,payload_bytes,verified_at
  from private.diet_recovery_snapshots
  where verification_status='verified'
  order by user_id,captured_at desc
)
select jsonb_build_object(
  'format','diet-p15-offsite-v1',
  'generated_at',clock_timestamp(),
  'project_ref','hycegznamzjhwinegaai',
  'schema_sha256',private.diet_p15_schema_sha256(),
  'snapshot_count',(select count(*) from latest),
  'snapshots',coalesce((
    select jsonb_agg(jsonb_build_object(
      'snapshot_id',snapshot_id,
      'user_id',user_id,
      'captured_at',captured_at,
      'source',source,
      'schema_version',schema_version,
      'migration_version',migration_version,
      'schema_sha256',schema_sha256,
      'payload_sha256',payload_sha256,
      'row_counts',row_counts,
      'payload',payload,
      'payload_bytes',payload_bytes,
      'verified_at',verified_at
    ) order by user_id)
    from latest
  ),'[]'::jsonb)
)
$$;

revoke all on function public.diet_p15_offsite_export() from public,anon,authenticated;
grant execute on function public.diet_p15_offsite_export() to service_role;

comment on function public.diet_p15_offsite_export() is
'Diet P15 internal export endpoint for the OIDC-authenticated off-site backup Edge Function. Service-role only; returns latest verified owner snapshots.';
