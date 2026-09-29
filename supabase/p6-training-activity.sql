-- Diet Copilot 2.0 P6 — training-day nutrition and activity integration
-- Snapshot from the verified canonical Supabase project.

create table if not exists public.training_distribution_settings(
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  weekly_template jsonb not null default '{"mon":"rest","tue":"rest","wed":"rest","thu":"rest","fri":"rest","sat":"rest","sun":"rest"}'::jsonb,
  hard_extra_kcal integer not null default 150 check(hard_extra_kcal between 0 and 300),
  moderate_extra_kcal integer not null default 75 check(moderate_extra_kcal between 0 and 250),
  light_extra_kcal integer not null default 25 check(light_extra_kcal between 0 and 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_days(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  training_date date not null,
  day_type text not null check(day_type in ('rest','light','moderate','hard')),
  status text not null default 'planned' check(status in ('planned','completed','skipped')),
  title text,
  duration_minutes numeric,
  source text not null default 'manual' check(source in ('manual','health_connect','imported')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,training_date),
  check(duration_minutes is null or (duration_minutes>=0 and duration_minutes<=1440))
);

alter table public.training_distribution_settings enable row level security;
alter table public.training_days enable row level security;

drop policy if exists diet_training_distribution_owner_select on public.training_distribution_settings;
create policy diet_training_distribution_owner_select on public.training_distribution_settings
for select to authenticated using ((select auth.uid())=user_id);

drop policy if exists diet_training_days_owner_select on public.training_days;
create policy diet_training_days_owner_select on public.training_days
for select to authenticated using ((select auth.uid())=user_id);

revoke all on table public.training_distribution_settings from public,anon,authenticated;
revoke all on table public.training_days from public,anon,authenticated;
grant select on table public.training_distribution_settings to authenticated;
grant select on table public.training_days to authenticated;

create index if not exists idx_training_days_user_date on public.training_days(user_id,training_date desc);

CREATE OR REPLACE FUNCTION public.diet_app_delete_training_day(p_training_day_id uuid, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_old public.training_days%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  select * into v_old from public.training_days where id=p_training_day_id and user_id=v_uid for update;
  if not found then raise exception 'Training day not found'; end if;
  if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then
    raise exception 'Conflict: training day changed since last read';
  end if;

  delete from public.training_days where id=v_old.id and user_id=v_uid;
  v_result:=jsonb_build_object('deleted',true,'training_day_id',v_old.id,'training_date',v_old.training_date);
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'training_day_delete','training_day',v_old.id,jsonb_strip_nulls(to_jsonb(v_old)-'user_id'),v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_save_training_distribution(p_enabled boolean, p_weekly_template jsonb, p_hard_extra_kcal integer, p_moderate_extra_kcal integer, p_light_extra_kcal integer, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_template jsonb:=coalesce(p_weekly_template,'{}'::jsonb);
  v_normalized jsonb;
  v_result jsonb;
  v_key text;
  v_value text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  if jsonb_typeof(v_template)<>'object' then raise exception 'Weekly template must be an object'; end if;
  for v_key,v_value in select key,value #>> '{}' from jsonb_each(v_template)
  loop
    if v_key not in ('mon','tue','wed','thu','fri','sat','sun') then raise exception 'Invalid weekday key: %',v_key; end if;
    if v_value not in ('rest','light','moderate','hard') then raise exception 'Invalid training type for %',v_key; end if;
  end loop;
  v_normalized:=jsonb_build_object(
    'mon',coalesce(v_template->>'mon','rest'),
    'tue',coalesce(v_template->>'tue','rest'),
    'wed',coalesce(v_template->>'wed','rest'),
    'thu',coalesce(v_template->>'thu','rest'),
    'fri',coalesce(v_template->>'fri','rest'),
    'sat',coalesce(v_template->>'sat','rest'),
    'sun',coalesce(v_template->>'sun','rest')
  );

  if p_hard_extra_kcal is null or p_hard_extra_kcal<0 or p_hard_extra_kcal>300 or mod(p_hard_extra_kcal,25)<>0 then
    raise exception 'Hard-day shift must be 0 to 300 kcal in 25 kcal increments';
  end if;
  if p_moderate_extra_kcal is null or p_moderate_extra_kcal<0 or p_moderate_extra_kcal>250 or mod(p_moderate_extra_kcal,25)<>0 then
    raise exception 'Moderate-day shift must be 0 to 250 kcal in 25 kcal increments';
  end if;
  if p_light_extra_kcal is null or p_light_extra_kcal<0 or p_light_extra_kcal>150 or mod(p_light_extra_kcal,25)<>0 then
    raise exception 'Light-day shift must be 0 to 150 kcal in 25 kcal increments';
  end if;
  if p_hard_extra_kcal<p_moderate_extra_kcal or p_moderate_extra_kcal<p_light_extra_kcal then
    raise exception 'Training shifts must satisfy hard >= moderate >= light';
  end if;

  insert into public.training_distribution_settings(
    user_id,enabled,weekly_template,hard_extra_kcal,moderate_extra_kcal,light_extra_kcal,updated_at
  ) values(
    v_uid,coalesce(p_enabled,false),v_normalized,p_hard_extra_kcal,p_moderate_extra_kcal,p_light_extra_kcal,now()
  )
  on conflict(user_id) do update set
    enabled=excluded.enabled,
    weekly_template=excluded.weekly_template,
    hard_extra_kcal=excluded.hard_extra_kcal,
    moderate_extra_kcal=excluded.moderate_extra_kcal,
    light_extra_kcal=excluded.light_extra_kcal,
    updated_at=now();

  select jsonb_strip_nulls(to_jsonb(s)-'user_id') into v_result
  from public.training_distribution_settings s where s.user_id=v_uid;

  insert into public.ai_actions(user_id,request_id,action_type,entity_type,after_data)
  values(v_uid,p_request_id,'training_distribution_save','training_distribution',v_result);

  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_upsert_training_day(p_training_day_id uuid, p_training_date date, p_day_type text, p_status text, p_title text, p_duration_minutes numeric, p_notes text, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_old public.training_days%rowtype;
  v_row public.training_days%rowtype;
  v_before jsonb;
  v_today date:=(now() at time zone 'Europe/Berlin')::date;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  if p_training_date is null or p_training_date<v_today-730 or p_training_date>v_today+365 then
    raise exception 'Training date outside allowed range';
  end if;
  if p_day_type not in ('rest','light','moderate','hard') then raise exception 'Invalid training day type'; end if;
  if p_status not in ('planned','completed','skipped') then raise exception 'Invalid training day status'; end if;
  if p_title is not null and length(trim(p_title))>120 then raise exception 'Training title is too long'; end if;
  if p_notes is not null and length(p_notes)>1000 then raise exception 'Training notes are too long'; end if;
  if p_duration_minutes is not null and (p_duration_minutes<0 or p_duration_minutes>1440) then raise exception 'Invalid training duration'; end if;

  if p_training_day_id is not null then
    select * into v_old from public.training_days
    where id=p_training_day_id and user_id=v_uid
    for update;
  else
    select * into v_old from public.training_days
    where user_id=v_uid and training_date=p_training_date
    for update;
  end if;

  if v_old.id is not null then
    if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then
      raise exception 'Conflict: training day changed since last read';
    end if;
    v_before:=jsonb_strip_nulls(to_jsonb(v_old)-'user_id');
    update public.training_days set
      training_date=p_training_date,
      day_type=p_day_type,
      status=p_status,
      title=nullif(trim(coalesce(p_title,'')),''),
      duration_minutes=p_duration_minutes,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      source='manual',
      updated_at=now()
    where id=v_old.id and user_id=v_uid
    returning * into v_row;
  else
    insert into public.training_days(
      user_id,training_date,day_type,status,title,duration_minutes,source,notes
    ) values(
      v_uid,p_training_date,p_day_type,p_status,nullif(trim(coalesce(p_title,'')),''),
      p_duration_minutes,'manual',nullif(trim(coalesce(p_notes,'')),'')
    ) returning * into v_row;
  end if;

  v_existing:=jsonb_strip_nulls(to_jsonb(v_row)-'user_id');
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'training_day_upsert','training_day',v_row.id,v_before,v_existing);
  return v_existing;
end $function$;

revoke all on function public.diet_app_delete_training_day(uuid, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_delete_training_day(uuid, timestamp with time zone, text) to authenticated;

revoke all on function public.diet_app_save_training_distribution(boolean, jsonb, integer, integer, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_save_training_distribution(boolean, jsonb, integer, integer, integer, text) to authenticated;

revoke all on function public.diet_app_upsert_training_day(uuid, date, text, text, text, numeric, text, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_upsert_training_day(uuid, date, text, text, text, numeric, text, timestamp with time zone, text) to authenticated;

CREATE OR REPLACE FUNCTION public.diet_app_delete_training_day(p_training_day_id uuid, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_old public.training_days%rowtype;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  select * into v_old from public.training_days where id=p_training_day_id and user_id=v_uid for update;
  if not found then raise exception 'Training day not found'; end if;
  if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then
    raise exception 'Conflict: training day changed since last read';
  end if;

  delete from public.training_days where id=v_old.id and user_id=v_uid;
  v_result:=jsonb_build_object('deleted',true,'training_day_id',v_old.id,'training_date',v_old.training_date);
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'training_day_delete','training_day',v_old.id,jsonb_strip_nulls(to_jsonb(v_old)-'user_id'),v_result);
  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_save_training_distribution(p_enabled boolean, p_weekly_template jsonb, p_hard_extra_kcal integer, p_moderate_extra_kcal integer, p_light_extra_kcal integer, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_template jsonb:=coalesce(p_weekly_template,'{}'::jsonb);
  v_normalized jsonb;
  v_result jsonb;
  v_key text;
  v_value text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  if jsonb_typeof(v_template)<>'object' then raise exception 'Weekly template must be an object'; end if;
  for v_key,v_value in select key,value #>> '{}' from jsonb_each(v_template)
  loop
    if v_key not in ('mon','tue','wed','thu','fri','sat','sun') then raise exception 'Invalid weekday key: %',v_key; end if;
    if v_value not in ('rest','light','moderate','hard') then raise exception 'Invalid training type for %',v_key; end if;
  end loop;
  v_normalized:=jsonb_build_object(
    'mon',coalesce(v_template->>'mon','rest'),
    'tue',coalesce(v_template->>'tue','rest'),
    'wed',coalesce(v_template->>'wed','rest'),
    'thu',coalesce(v_template->>'thu','rest'),
    'fri',coalesce(v_template->>'fri','rest'),
    'sat',coalesce(v_template->>'sat','rest'),
    'sun',coalesce(v_template->>'sun','rest')
  );

  if p_hard_extra_kcal is null or p_hard_extra_kcal<0 or p_hard_extra_kcal>300 or mod(p_hard_extra_kcal,25)<>0 then
    raise exception 'Hard-day shift must be 0 to 300 kcal in 25 kcal increments';
  end if;
  if p_moderate_extra_kcal is null or p_moderate_extra_kcal<0 or p_moderate_extra_kcal>250 or mod(p_moderate_extra_kcal,25)<>0 then
    raise exception 'Moderate-day shift must be 0 to 250 kcal in 25 kcal increments';
  end if;
  if p_light_extra_kcal is null or p_light_extra_kcal<0 or p_light_extra_kcal>150 or mod(p_light_extra_kcal,25)<>0 then
    raise exception 'Light-day shift must be 0 to 150 kcal in 25 kcal increments';
  end if;
  if p_hard_extra_kcal<p_moderate_extra_kcal or p_moderate_extra_kcal<p_light_extra_kcal then
    raise exception 'Training shifts must satisfy hard >= moderate >= light';
  end if;

  insert into public.training_distribution_settings(
    user_id,enabled,weekly_template,hard_extra_kcal,moderate_extra_kcal,light_extra_kcal,updated_at
  ) values(
    v_uid,coalesce(p_enabled,false),v_normalized,p_hard_extra_kcal,p_moderate_extra_kcal,p_light_extra_kcal,now()
  )
  on conflict(user_id) do update set
    enabled=excluded.enabled,
    weekly_template=excluded.weekly_template,
    hard_extra_kcal=excluded.hard_extra_kcal,
    moderate_extra_kcal=excluded.moderate_extra_kcal,
    light_extra_kcal=excluded.light_extra_kcal,
    updated_at=clock_timestamp();

  select jsonb_strip_nulls(to_jsonb(s)-'user_id') into v_result
  from public.training_distribution_settings s where s.user_id=v_uid;

  insert into public.ai_actions(user_id,request_id,action_type,entity_type,after_data)
  values(v_uid,p_request_id,'training_distribution_save','training_distribution',v_result);

  return v_result;
end $function$;

CREATE OR REPLACE FUNCTION public.diet_app_upsert_training_day(p_training_day_id uuid, p_training_date date, p_day_type text, p_status text, p_title text, p_duration_minutes numeric, p_notes text, p_expected_updated_at timestamp with time zone, p_request_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid:=auth.uid();
  v_existing jsonb;
  v_old public.training_days%rowtype;
  v_row public.training_days%rowtype;
  v_before jsonb;
  v_today date:=(now() at time zone 'Europe/Berlin')::date;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if p_request_id is null or p_request_id !~ '^[A-Za-z0-9:_-]{8,120}$' then raise exception 'Invalid request ID'; end if;
  select after_data into v_existing from public.ai_actions where user_id=v_uid and request_id=p_request_id;
  if found then return v_existing||jsonb_build_object('idempotent_replay',true); end if;

  if p_training_date is null or p_training_date<v_today-730 or p_training_date>v_today+365 then
    raise exception 'Training date outside allowed range';
  end if;
  if p_day_type not in ('rest','light','moderate','hard') then raise exception 'Invalid training day type'; end if;
  if p_status not in ('planned','completed','skipped') then raise exception 'Invalid training day status'; end if;
  if p_title is not null and length(trim(p_title))>120 then raise exception 'Training title is too long'; end if;
  if p_notes is not null and length(p_notes)>1000 then raise exception 'Training notes are too long'; end if;
  if p_duration_minutes is not null and (p_duration_minutes<0 or p_duration_minutes>1440) then raise exception 'Invalid training duration'; end if;

  if p_training_day_id is not null then
    select * into v_old from public.training_days
    where id=p_training_day_id and user_id=v_uid
    for update;
  else
    select * into v_old from public.training_days
    where user_id=v_uid and training_date=p_training_date
    for update;
  end if;

  if v_old.id is not null then
    if p_expected_updated_at is not null and v_old.updated_at<>p_expected_updated_at then
      raise exception 'Conflict: training day changed since last read';
    end if;
    v_before:=jsonb_strip_nulls(to_jsonb(v_old)-'user_id');
    update public.training_days set
      training_date=p_training_date,
      day_type=p_day_type,
      status=p_status,
      title=nullif(trim(coalesce(p_title,'')),''),
      duration_minutes=p_duration_minutes,
      notes=nullif(trim(coalesce(p_notes,'')),''),
      source='manual',
      updated_at=clock_timestamp()
    where id=v_old.id and user_id=v_uid
    returning * into v_row;
  else
    insert into public.training_days(
      user_id,training_date,day_type,status,title,duration_minutes,source,notes
    ) values(
      v_uid,p_training_date,p_day_type,p_status,nullif(trim(coalesce(p_title,'')),''),
      p_duration_minutes,'manual',nullif(trim(coalesce(p_notes,'')),'')
    ) returning * into v_row;
  end if;

  v_existing:=jsonb_strip_nulls(to_jsonb(v_row)-'user_id');
  insert into public.ai_actions(user_id,request_id,action_type,entity_type,entity_id,before_data,after_data)
  values(v_uid,p_request_id,'training_day_upsert','training_day',v_row.id,v_before,v_existing);
  return v_existing;
end $function$;

revoke all on function public.diet_app_delete_training_day(uuid, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_delete_training_day(uuid, timestamp with time zone, text) to authenticated;

revoke all on function public.diet_app_save_training_distribution(boolean, jsonb, integer, integer, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_save_training_distribution(boolean, jsonb, integer, integer, integer, text) to authenticated;

revoke all on function public.diet_app_upsert_training_day(uuid, date, text, text, text, numeric, text, timestamp with time zone, text) from public, anon, authenticated, service_role;
grant execute on function public.diet_app_upsert_training_day(uuid, date, text, text, text, numeric, text, timestamp with time zone, text) to authenticated;

