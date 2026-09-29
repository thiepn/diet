
create table if not exists private.diet_mutation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null,
  operation text not null,
  payload_sha256 text not null,
  status text not null check (status in ('started','complete')),
  result jsonb,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key(user_id,request_id),
  check (length(request_id) between 8 and 120),
  check (length(operation) between 1 and 96),
  check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  check ((status='started' and completed_at is null) or (status='complete' and completed_at is not null))
);

alter table private.diet_mutation_requests enable row level security;
revoke all on table private.diet_mutation_requests from public,anon,authenticated;
drop policy if exists diet_p19_mutation_requests_deny on private.diet_mutation_requests;
create policy diet_p19_mutation_requests_deny
on private.diet_mutation_requests
as restrictive
for all
to authenticated
using (false)
with check (false);

create or replace function private.diet_p19_begin_mutation(
  p_operation text,
  p_payload jsonb,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_uid uuid:=auth.uid();
  v_anonymous boolean:=coalesce((auth.jwt()->>'is_anonymous')::boolean,false);
  v_hash text;
  v_row private.diet_mutation_requests%rowtype;
begin
  if v_uid is null or v_anonymous then
    raise exception 'Authenticated Diet account required' using errcode='42501';
  end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then
    raise exception 'Invalid request ID';
  end if;
  if p_operation is null or p_operation !~ '^diet_app_[a-z0-9_]{1,80}$' then
    raise exception 'Invalid mutation operation';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('diet-p19-owner:'||v_uid::text,0)
  );

  v_hash:=encode(
    extensions.digest(
      convert_to(coalesce(p_payload,'{}'::jsonb)::text,'UTF8'),
      'sha256'
    ),
    'hex'
  );

  insert into private.diet_mutation_requests(
    user_id,request_id,operation,payload_sha256,status
  ) values(
    v_uid,p_request_id,p_operation,v_hash,'started'
  )
  on conflict(user_id,request_id) do nothing;

  select * into v_row
  from private.diet_mutation_requests
  where user_id=v_uid and request_id=p_request_id
  for update;

  if not found then
    raise exception 'Mutation request claim failed';
  end if;

  if v_row.operation<>p_operation or v_row.payload_sha256<>v_hash then
    raise exception 'Request ID collision: this ID is already bound to a different Diet mutation';
  end if;

  if v_row.status='complete' then
    return jsonb_build_object(
      'replay',true,
      'result',coalesce(v_row.result,'{}'::jsonb),
      'operation',v_row.operation
    );
  end if;

  return jsonb_build_object('replay',false,'operation',v_row.operation);
end
$fn$;

revoke all on function private.diet_p19_begin_mutation(text,jsonb,text) from public,anon,authenticated;
grant execute on function private.diet_p19_begin_mutation(text,jsonb,text) to service_role;

create or replace function private.diet_p19_complete_mutation(
  p_operation text,
  p_request_id text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_uid uuid:=auth.uid();
begin
  update private.diet_mutation_requests
  set status='complete',
      result=coalesce(p_result,'{}'::jsonb),
      completed_at=clock_timestamp()
  where user_id=v_uid
    and request_id=p_request_id
    and operation=p_operation
    and status='started';

  if not found then
    raise exception 'Mutation request completion failed';
  end if;
end
$fn$;

revoke all on function private.diet_p19_complete_mutation(text,text,jsonb) from public,anon,authenticated;
grant execute on function private.diet_p19_complete_mutation(text,text,jsonb) to service_role;

create or replace function private.diet_p19_prune_mutation_requests()
returns bigint
language plpgsql
security definer
set search_path=''
as $fn$
declare
  v_deleted bigint;
begin
  delete from private.diet_mutation_requests
  where created_at < clock_timestamp()-interval '35 days';
  get diagnostics v_deleted=row_count;
  return v_deleted;
end
$fn$;

revoke all on function private.diet_p19_prune_mutation_requests() from public,anon,authenticated;
grant execute on function private.diet_p19_prune_mutation_requests() to service_role;

do $wrap$
declare
  r record;
  i int;
  v_payload_parts text;
  v_call_args text;
  v_payload_expr text;
  v_wrapper text;
begin
  for r in
    select
      p.oid,
      p.proname,
      pg_get_function_arguments(p.oid) as declaration,
      oidvectortypes(p.proargtypes) as type_list,
      p.proargnames as argnames
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prokind='f'
      and p.proname like 'diet_app_%'
      and 'p_request_id'=any(coalesce(p.proargnames,array[]::text[]))
      and not exists(
        select 1
        from pg_proc pc
        join pg_namespace nc on nc.oid=pc.pronamespace
        where nc.nspname='private'
          and pc.proname=p.proname
          and pc.proargtypes=p.proargtypes
      )
    order by p.proname
  loop
    v_payload_parts:='';
    v_call_args:='';

    for i in 1..array_length(r.argnames,1) loop
      if v_call_args<>'' then v_call_args:=v_call_args||','; end if;
      v_call_args:=v_call_args||quote_ident(r.argnames[i]);

      if r.argnames[i]<>'p_request_id' then
        if v_payload_parts<>'' then v_payload_parts:=v_payload_parts||','; end if;
        v_payload_parts:=v_payload_parts||
          quote_literal(r.argnames[i])||','||quote_ident(r.argnames[i]);
      end if;
    end loop;

    if v_payload_parts='' then
      v_payload_expr:='''{}''::jsonb';
    else
      v_payload_expr:='jsonb_build_object('||v_payload_parts||')';
    end if;

    execute format(
      'alter function public.%I(%s) set schema private',
      r.proname,r.type_list
    );

    execute format(
      'revoke all on function private.%I(%s) from public,anon,authenticated',
      r.proname,r.type_list
    );
    execute format(
      'grant execute on function private.%I(%s) to service_role',
      r.proname,r.type_list
    );

    v_wrapper:=format($fmt$
      create function public.%I(%s)
      returns jsonb
      language plpgsql
      security definer
      set search_path=''
      as $body$
      declare
        v_claim jsonb;
        v_result jsonb;
        v_payload jsonb;
      begin
        if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
          raise exception 'Authenticated Diet account required' using errcode='42501';
        end if;

        v_payload:=%s;
        v_claim:=private.diet_p19_begin_mutation(%L,v_payload,p_request_id);

        if coalesce((v_claim->>'replay')::boolean,false) then
          return coalesce(v_claim->'result','{}'::jsonb)
            ||jsonb_build_object('idempotent_replay',true,'p19_replay',true);
        end if;

        v_result:=private.%I(%s);
        perform private.diet_p19_complete_mutation(%L,p_request_id,v_result);
        return v_result;
      end
      $body$;
    $fmt$,
      r.proname,
      r.declaration,
      v_payload_expr,
      r.proname,
      r.proname,
      v_call_args,
      r.proname
    );

    execute v_wrapper;

    execute format(
      'revoke all on function public.%I(%s) from public,anon',
      r.proname,r.type_list
    );
    execute format(
      'grant execute on function public.%I(%s) to authenticated,service_role',
      r.proname,r.type_list
    );
    execute format(
      'comment on function public.%I(%s) is %L',
      r.proname,r.type_list,
      'Diet P19 concurrency/idempotency wrapper. Transactionally binds request ID to operation and payload before invoking private mutation core.'
    );
  end loop;
end
$wrap$;

create or replace function public.diet_p19_concurrency_status()
returns jsonb
language sql
stable
security definer
set search_path=''
as $fn$
select jsonb_build_object(
  'release','P19',
  'publicWriteWrappers',(
    select count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname like 'diet_app_%'
      and 'p_request_id'=any(coalesce(p.proargnames,array[]::text[]))
  ),
  'privateWriteCores',(
    select count(*) from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.proname like 'diet_app_%'
      and 'p_request_id'=any(coalesce(p.proargnames,array[]::text[]))
  ),
  'ledgerRows',(select count(*) from private.diet_mutation_requests),
  'startedRows',(select count(*) from private.diet_mutation_requests where status='started'),
  'retentionDays',35,
  'ownerMutationSerialization',true,
  'payloadBoundIdempotency',true,
  'autoMergeStaleContentEdits',false
)
$fn$;

revoke all on function public.diet_p19_concurrency_status() from public,anon,authenticated;
grant execute on function public.diet_p19_concurrency_status() to service_role;

do $cron$
declare j record;
begin
  for j in select jobid from cron.job where jobname='diet-p19-idempotency-prune' loop
    perform cron.unschedule(j.jobid);
  end loop;
end
$cron$;

select cron.schedule(
  'diet-p19-idempotency-prune',
  '27 3 * * *',
  $cmd$select private.diet_p19_prune_mutation_requests();$cmd$
);
