-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001200_sponsorship_stats — what the sponsor actually got
--
-- Sponsors renew when you can answer "what did I get for my R150?". Without a
-- number that conversation is a negotiation about a feeling, and it goes badly.
--
-- Deliberately DAILY AGGREGATES, never events:
--
--   * No row identifies a person. There is no user_id, no session, no IP —
--     just "on this day, this placement was opened N times". A count cannot be
--     turned into a list of who looked at what, so there is nothing here to
--     leak, subpoena, or have to explain under POPIA.
--   * One row per placement per day, upserted. A busy month is 30 rows, not
--     30,000 events, which keeps this free to store and instant to read.
--
-- Opens, not impressions. "38 people opened your listing" is a truer and more
-- persuasive sentence than "1,200 impressions", and it costs a fraction of the
-- writes.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.res_sponsorship_stats (
  sponsorship_id uuid not null references public.res_sponsorships(id) on delete cascade,
  day            date not null default current_date,
  opens          int  not null default 0 check (opens >= 0),
  updated_at     timestamptz not null default now(),
  primary key (sponsorship_id, day)
);

create index if not exists idx_res_sponsorship_stats_day
  on public.res_sponsorship_stats (sponsorship_id, day desc);

alter table public.res_sponsorship_stats enable row level security;

-- No client reads. A sponsor's numbers are reported by you, not exposed to
-- every signed-in neighbour — and a competitor should not be able to read how
-- a rival's placement is performing.
revoke all on public.res_sponsorship_stats from public, anon, authenticated;
grant select, insert, update on public.res_sponsorship_stats to service_role;

-- ── Recording an open ──────────────────────────────────────────────────────
-- security definer so a signed-in user can bump a counter they cannot read or
-- edit. Takes no user identity and stores none.
create or replace function public.res_sponsorship_opened(p_sponsorship uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;   -- not signed in: silently do nothing, never error the UI
  end if;

  -- Only count opens for a placement that is genuinely live, so a stale client
  -- cannot inflate a finished campaign.
  if not exists (
    select 1 from res_sponsorships s
     where s.id = p_sponsorship and s.status = 'active'
       and s.archived_at is null and s.starts_at <= now() and s.ends_at > now()
  ) then
    return;
  end if;

  insert into res_sponsorship_stats (sponsorship_id, day, opens)
  values (p_sponsorship, current_date, 1)
  on conflict (sponsorship_id, day)
  do update set opens = res_sponsorship_stats.opens + 1, updated_at = now();
end;
$$;

-- ── Reading the report ─────────────────────────────────────────────────────
-- The sentence you send on WhatsApp at the end of the month.
create or replace function public.res_sponsorship_report(p_sponsorship uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_s record;
  v_total int;
  v_days int;
begin
  select * into v_s from res_sponsorships where id = p_sponsorship;
  if not found then
    raise exception 'sponsorship % not found', p_sponsorship;
  end if;

  select coalesce(sum(opens), 0) into v_total
    from res_sponsorship_stats where sponsorship_id = p_sponsorship;

  select greatest(1, count(*)) into v_days
    from res_sponsorship_stats where sponsorship_id = p_sponsorship and opens > 0;

  return jsonb_build_object(
    'sponsorship_id', p_sponsorship,
    'suburb', v_s.suburb,
    'category', v_s.category,
    'surface', v_s.surface,
    'slot', v_s.slot,
    'status', v_s.status,
    'starts_at', v_s.starts_at,
    'ends_at', v_s.ends_at,
    'total_opens', v_total,
    'active_days', v_days,
    -- Plain English, so it can be copied straight into a message.
    'summary', format('%s %s opened this listing from the sponsored slot in %s.',
                      v_total,
                      case when v_total = 1 then 'person' else 'people' end,
                      coalesce(v_s.suburb, 'your area')));
end;
$$;

revoke execute on function public.res_sponsorship_opened(uuid) from public, anon;
revoke execute on function public.res_sponsorship_report(uuid) from public, anon;
grant execute on function public.res_sponsorship_opened(uuid) to authenticated, service_role;
-- The report is for you and the sponsor, not for every signed-in user.
grant execute on function public.res_sponsorship_report(uuid) to service_role;

comment on table public.res_sponsorship_stats is
  'Daily open counts per placement. Aggregates only — no user, session or IP is ever recorded, so this cannot be turned into a record of who looked at what.';
