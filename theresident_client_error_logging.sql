-- theresident_client_error_logging.sql
--
-- Somewhere for a production crash to land. Until now a React error in a
-- resident's browser was invisible: no Sentry, no logging, and the only way
-- to learn about a broken screen was for someone to say so.
--
-- WHY A NEW TABLE WHEN client_errors ALREADY EXISTS. It does, and nothing in
-- The Resident writes to it — but CONTRACT.md §2 is unambiguous: unprefixed
-- tables belong to The Gruvs, and "every new Resident table is res_-prefixed".
-- The shared rails The Resident may write to are listed in §4 and
-- client_errors is not among them. Duplicating a table is the lesser problem;
-- consolidating them is a conversation with the Gruvs side, not a decision to
-- make unilaterally from this repo.
--
-- WHAT MUST NOT END UP IN HERE. Error text is written by the browser and can
-- contain whatever was on screen. The client redacts before sending (see
-- src/utils/errorReporting.ts) and this table is deliberately not readable by
-- residents at all — not even their own rows. It exists to be read by whoever
-- operates the app, through the service role. A crash report is diagnostic
-- data, not something to show a user or let another user find.
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_client_errors (
  id bigint generated always as identity primary key,
  -- Nullable: a crash on a signed-out page is still worth knowing about.
  user_id uuid,
  -- A short, stable identifier for the kind of failure ('render',
  -- 'unhandled_rejection', 'window_error'), so the same bug groups together
  -- instead of scattering across message variations.
  label text not null,
  message text,
  context jsonb,
  path text,
  app_version text,
  created_at timestamptz not null default now()
);

create index if not exists res_client_errors_recent_idx
  on public.res_client_errors (created_at desc);
create index if not exists res_client_errors_label_idx
  on public.res_client_errors (label, created_at desc);

alter table public.res_client_errors enable row level security;

-- No policy at all, and no grants: nothing reachable through the API can read
-- or write this table directly. The only way in is the RPC below; the only way
-- out is the service role.
revoke all on public.res_client_errors from anon, authenticated;

create or replace function public.res_log_client_error(
  p_label text,
  p_message text default null,
  p_context jsonb default null,
  p_path text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_label), '') = '' then
    return; -- nothing useful to record; not worth an error about an error
  end if;

  -- A crash loop is exactly when this gets called hardest, so it is limited
  -- like any other write path. Generous enough to capture a real burst,
  -- tight enough that a runaway render loop cannot fill the table.
  begin
    perform public.res_check_rate_limit('client_error', 30, 3600);
  exception when others then
    -- Over the limit, or not signed in. Either way, swallow: an error
    -- reporter that throws is worse than one that misses a report.
    return;
  end;

  insert into res_client_errors (user_id, label, message, context, path, app_version)
  values (
    auth.uid(),
    left(trim(p_label), 60),
    left(p_message, 2000),
    p_context,
    left(p_path, 300),
    left(p_app_version, 40)
  );
exception when others then
  -- Same reasoning one level up. Reporting a crash must never cause one.
  return;
end;
$$;

revoke all on function public.res_log_client_error(text, text, jsonb, text, text) from public;
-- anon included on purpose: a crash on the public /verify-kin page or the
-- signed-out landing page is one of the more useful things to hear about, and
-- the function records auth.uid() (null) rather than trusting any caller
-- claim about who they are.
grant execute on function public.res_log_client_error(text, text, jsonb, text, text) to anon, authenticated, service_role;

-- What an operator actually looks at: which failures are happening, how often,
-- and how recently. Service role only.
create or replace function public.res_client_error_summary(p_hours integer default 24)
returns table (
  label text,
  occurrences bigint,
  affected_users bigint,
  last_seen timestamptz,
  sample_message text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.label,
    count(*) as occurrences,
    count(distinct e.user_id) as affected_users,
    max(e.created_at) as last_seen,
    (array_agg(e.message order by e.created_at desc))[1] as sample_message
  from res_client_errors e
  where e.created_at > now() - make_interval(hours => greatest(1, least(p_hours, 720)))
  group by e.label
  order by count(*) desc;
$$;

revoke all on function public.res_client_error_summary(integer) from public, anon, authenticated;
grant execute on function public.res_client_error_summary(integer) to service_role;

-- Crash reports are diagnostic, not archival. Ninety days is long enough to
-- spot a slow regression and short enough that this never becomes a quiet
-- store of what people were doing when something broke.
create or replace function public.res_prune_client_errors()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from res_client_errors where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.res_prune_client_errors() from public, anon, authenticated;
grant execute on function public.res_prune_client_errors() to service_role;
