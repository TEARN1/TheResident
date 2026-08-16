-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000100_universal_columns
--
-- Layer 0, Step 0.2/0.3 of docs/SELF-MANAGING.md.
--
-- Automation needs four things on every row it may touch, and today most
-- res_* tables have none of them:
--   updated_at   — a clock. 22 of 44 tables had no way to say "when did this
--                  last change", so no time-based rule could be written.
--   archived_at  — a soft delete. Nothing autonomous may hard-delete; a job
--                  that destroys rows is a job you cannot recover from.
--   expires_at   — ONE field every expiry job reads, instead of each job
--                  knowing a different table's bespoke staleness rule.
--   managed_by   — null = a human last touched this, else the job name. Makes
--                  "did automation do this?" a query, not an investigation.
--
-- Additive and idempotent: safe to re-run, and it changes no existing value.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. updated_at on every res_ table that lacks it ─────────────────────────
-- touch_updated_at() is Gruvs-owned (CONTRACT.md §7) and already exists.
do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relname like 'res\_%'
  loop
    execute format(
      'alter table public.%I add column if not exists updated_at timestamptz not null default now()',
      t.relname);

    -- Re-create rather than skip: a table may have the column but no trigger,
    -- which is the silent-staleness case we are trying to remove.
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$I', t.relname);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$I
         for each row execute function public.touch_updated_at()', t.relname);
  end loop;
end $$;

-- ── 2. Lifecycle columns on automatable content tables ──────────────────────
-- Deliberately NOT applied to join/config tables (res_blocks, res_rate_limits,
-- res_saved_pins, res_saved_searches, res_notification_prefs,
-- res_community_members, res_infra_partner_admins, res_purchases,
-- res_subscriptions): those are either owned by another system, or have no
-- lifecycle of their own. Money tables in particular stay out of reach.
do $$
declare
  t text;
  content_tables text[] := array[
    'res_listings','res_market_items','res_lost_found','res_notice_events',
    'res_alerts','res_group_buys','res_skills','res_vendors',
    'res_shared_resources','res_tool_library','res_utility_tokens',
    'res_room_requests','res_service_dispatches','res_community_disputes',
    'res_lift_clubs','res_handyman_services','res_roommate_seekers',
    'res_neighbourhood_status','res_care_circle','res_chore_schedule',
    'res_gossip_posts','res_communities','res_properties','res_reports',
    -- Crowd-reported hazards are the most visibly unmanaged data in the app:
    -- nothing ever removes them, so the VibeMap accumulates potholes and
    -- roadblocks forever. expire_traffic_reports is the first job to ship.
    'res_traffic_reports'
  ];
begin
  foreach t in array content_tables loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, table not present', t;
      continue;
    end if;

    execute format(
      'alter table public.%I
         add column if not exists archived_at timestamptz,
         add column if not exists expires_at  timestamptz,
         add column if not exists managed_by  text', t);

    -- Partial indexes: expiry jobs only ever scan live rows, and the partial
    -- predicate keeps the index small as archived rows accumulate.
    execute format(
      'create index if not exists idx_%1$s_expires
         on public.%1$I (expires_at) where archived_at is null and expires_at is not null', t);
    execute format(
      'create index if not exists idx_%1$s_live
         on public.%1$I (updated_at) where archived_at is null', t);
  end loop;
end $$;

comment on column public.res_listings.managed_by is
  'Name of the automation job that last modified this row; null when a human did.';
comment on column public.res_listings.expires_at is
  'Single field read by the expiry jobs. Null = never expires.';
comment on column public.res_listings.archived_at is
  'Soft delete. Every RLS select policy must filter archived_at is null.';
