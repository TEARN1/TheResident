-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815000900_seed_infra_providers
--
-- Seeds the utility/department directory so escalate_faults has somewhere to
-- route a fault. Without these rows routeToProvider() returns null for every
-- fault and the sector routing is dead code.
--
-- Read this carefully, because the distinction matters:
--
--   These rows are DIRECTORY ENTRIES, not accounts. Nobody is claiming that
--   any of these organisations has agreed to anything, uses this app, or has
--   even heard of it. They exist so that a fault can be filed under "this is
--   an electricity matter for City Power's area" rather than filed nowhere.
--
--   No row here grants anyone access. Access comes only from a row in
--   res_infra_partner_admins, which is added by hand after a real human
--   verification — never automatically, and never as part of a migration.
--
--   contact_email / contact_phone are deliberately LEFT NULL. Populating them
--   from a web search would put unverified contact details in front of
--   residents during an emergency, and the app would be the thing that sent
--   someone to a wrong number. They get filled in only from an organisation's
--   own published channels, by a person who checked.
--
-- The UI must therefore present an unclaimed provider as exactly that:
-- "filed under City Power — not yet claimed by them".
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.res_infra_providers (name, kind) values
  -- Electricity
  ('Eskom',                         'electricity'),
  ('City Power (Johannesburg)',     'electricity'),
  ('City of Ekurhuleni Energy',     'electricity'),
  ('City of Tshwane Energy',        'electricity'),
  -- Water and sanitation
  ('Johannesburg Water',            'water'),
  ('Rand Water',                    'water'),
  ('Ekurhuleni Water and Sanitation','water'),
  ('Municipal Sanitation',          'sanitation'),
  -- Refuse
  ('Pikitup',                       'refuse'),
  ('Municipal Waste Services',      'refuse'),
  -- Roads
  ('Johannesburg Roads Agency',     'roads'),
  ('SANRAL',                        'roads'),
  -- Telecoms — generic, because a network fault is rarely attributable by a
  -- resident to a specific operator from the street.
  ('Network Operator',              'telecoms')
on conflict do nothing;

-- Every fault sector must have somewhere to go. A fault filed under a sector
-- with no directory entry silently loses its routing, which is the kind of
-- gap that only shows up during an actual outage.
do $$
declare
  v_missing text;
begin
  select string_agg(s, ', ') into v_missing
    from unnest(array['electricity','water','sanitation','refuse','telecoms','roads']) s
   where not exists (select 1 from public.res_infra_providers p where p.kind = s);

  if v_missing is not null then
    raise exception 'no provider directory entry for sector(s): %', v_missing;
  end if;
end $$;

comment on table public.res_infra_providers is
  'Directory of utilities and departments, used to route faults by sector. A row here is NOT an account and grants no access — that requires a res_infra_partner_admins row added after human verification.';
