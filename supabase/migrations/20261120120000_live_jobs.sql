-- Live jobs on the Vibe Map: bakkie, truck and tow-truck requests carry map
-- points and stages, and the driver's position is shared with that job's
-- customer only, only while the job is under way.

alter table public.res_service_dispatches
  add column if not exists pickup_lat double precision,
  add column if not exists pickup_lon double precision,
  add column if not exists dropoff_lat double precision,
  add column if not exists dropoff_lon double precision,
  add column if not exists job_stage text not null default 'requested',
  add column if not exists stage_at timestamptz not null default now();

do $$ begin
  alter table public.res_service_dispatches add constraint res_dispatch_job_stage_check
    check (job_stage in ('requested','accepted','on_the_way','arrived','loaded','delivered','cancelled'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.res_service_dispatches add constraint res_dispatch_points_check
    check ((pickup_lat is null or (pickup_lat between -90 and 90 and pickup_lon between -180 and 180))
       and (dropoff_lat is null or (dropoff_lat between -90 and 90 and dropoff_lon between -180 and 180)));
exception when duplicate_object then null; end $$;

-- One row per job: the driver's latest position.
create table if not exists public.res_dispatch_positions (
  dispatch_id uuid primary key references public.res_service_dispatches(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  accuracy_m real check (accuracy_m is null or accuracy_m >= 0),
  heading real,
  speed_mps real,
  at timestamptz not null default now()
);

alter table public.res_dispatch_positions enable row level security;

-- Is the signed-in user the driver (owner of the service) for this job?
create or replace function public.res_is_job_driver(p_dispatch uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.res_service_dispatches d
    join public.res_handyman_services s on s.id = d.service_id
    where d.id = p_dispatch and s.owner_id = (select auth.uid())
  );
$$;

drop policy if exists res_dispatch_positions_select on public.res_dispatch_positions;
create policy res_dispatch_positions_select on public.res_dispatch_positions
  for select to authenticated
  using (
    driver_id = (select auth.uid())
    or exists (select 1 from public.res_service_dispatches d
               where d.id = res_dispatch_positions.dispatch_id and d.sender_id = (select auth.uid()))
  );

-- The driver writes their own position, and only while the job is under way.
drop policy if exists res_dispatch_positions_insert on public.res_dispatch_positions;
create policy res_dispatch_positions_insert on public.res_dispatch_positions
  for insert to authenticated
  with check (
    driver_id = (select auth.uid())
    and public.res_is_job_driver(dispatch_id)
    and exists (select 1 from public.res_service_dispatches d
                where d.id = dispatch_id and d.job_stage in ('accepted','on_the_way','arrived','loaded'))
  );

drop policy if exists res_dispatch_positions_update on public.res_dispatch_positions;
create policy res_dispatch_positions_update on public.res_dispatch_positions
  for update to authenticated
  using (driver_id = (select auth.uid()))
  with check (
    driver_id = (select auth.uid())
    and exists (select 1 from public.res_service_dispatches d
                where d.id = dispatch_id and d.job_stage in ('accepted','on_the_way','arrived','loaded'))
  );

grant select, insert, update on public.res_dispatch_positions to authenticated;

-- Moves a job to its next stage. The driver moves it forward; the customer
-- can cancel before the vehicle is loaded. Ending the job stops the sharing.
create or replace function public.res_set_job_stage(p_dispatch uuid, p_stage text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := (select auth.uid());
  v_row public.res_service_dispatches;
  v_driver boolean;
  v_order text[] := array['requested','accepted','on_the_way','arrived','loaded','delivered'];
  v_from int; v_to int;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;
  select * into v_row from public.res_service_dispatches where id = p_dispatch for update;
  if not found then raise exception 'job not found' using errcode = 'P0002'; end if;
  v_driver := public.res_is_job_driver(p_dispatch);

  if p_stage = 'cancelled' then
    if not (v_driver or v_row.sender_id = v_uid) then raise exception 'not your job' using errcode = '42501'; end if;
    if v_row.job_stage not in ('requested','accepted','on_the_way','arrived') then
      raise exception 'this job can no longer be cancelled' using errcode = '22023';
    end if;
  else
    if not v_driver then raise exception 'only the driver moves the job on' using errcode = '42501'; end if;
    v_from := array_position(v_order, v_row.job_stage);
    v_to := array_position(v_order, p_stage);
    if v_from is null or v_to is null or v_to <> v_from + 1 then
      raise exception 'a job moves one stage at a time' using errcode = '22023';
    end if;
  end if;

  update public.res_service_dispatches
     set job_stage = p_stage,
         stage_at = now(),
         -- status keeps its three old values; job_stage says it was cancelled.
         status = case p_stage when 'delivered' then 'completed'
                               when 'cancelled' then status else 'accepted' end
   where id = p_dispatch;

  if p_stage in ('delivered','cancelled') then
    delete from public.res_dispatch_positions where dispatch_id = p_dispatch;
  end if;
  return p_stage;
end $$;

revoke all on function public.res_set_job_stage(uuid, text) from public, anon;
grant execute on function public.res_set_job_stage(uuid, text) to authenticated;
revoke all on function public.res_is_job_driver(uuid) from public, anon;
grant execute on function public.res_is_job_driver(uuid) to authenticated;

-- The app's "complete with proof" call had no function behind it.
create or replace function public.res_complete_dispatch(p_dispatch uuid, p_proof_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.res_is_job_driver(p_dispatch) then
    raise exception 'only the driver completes the job' using errcode = '42501';
  end if;
  update public.res_service_dispatches
     set status = 'completed', job_stage = 'delivered', stage_at = now(),
         proof_file_url = nullif(left(p_proof_url, 2000), '')
   where id = p_dispatch and job_stage <> 'cancelled';
  delete from public.res_dispatch_positions where dispatch_id = p_dispatch;
end $$;
revoke all on function public.res_complete_dispatch(uuid, text) from public, anon;
grant execute on function public.res_complete_dispatch(uuid, text) to authenticated;

-- Live updates for both screens.
do $$ begin
  alter publication supabase_realtime add table public.res_dispatch_positions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.res_service_dispatches;
exception when duplicate_object then null; end $$;
