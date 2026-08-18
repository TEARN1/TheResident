-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001700_schema_snapshot — Layer 5 of docs/SELF-MANAGING.md
--
-- Automation acts on assumptions about the schema: that a column exists, that
-- RLS is on, that a function is not callable by anon. When production drifts
-- from those assumptions jobs do not crash politely — they quietly do the
-- wrong thing to real rows.
--
-- The design here is shaped by a failure mode observed in the sibling app,
-- whose drift check has failed every run for eleven days across every branch.
-- A check that is always red is not a check; everyone has stopped reading it,
-- so the day it means something nobody will notice.
--
-- So this compares the live schema against an ACCEPTED SNAPSHOT rather than
-- against an ideal. Applying a migration re-accepts the snapshot, which makes
-- legitimate change silent and leaves only unexplained change speaking.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.res_schema_snapshot (
  id          bigserial primary key,
  facts       jsonb not null,
  accepted_at timestamptz not null default now(),
  accepted_by text,
  note        text
);

create index if not exists idx_res_schema_snapshot_at
  on public.res_schema_snapshot (accepted_at desc);

alter table public.res_schema_snapshot enable row level security;
revoke all on public.res_schema_snapshot from public, anon, authenticated;
grant select, insert on public.res_schema_snapshot to service_role;
grant usage on sequence public.res_schema_snapshot_id_seq to service_role;

-- ── The facts ──────────────────────────────────────────────────────────────
-- Deliberately narrow: only the properties automation actually relies on, and
-- only for res_ objects. Fingerprinting every column type and default would
-- make the check fire on harmless changes, which is the road to wallpaper.
create or replace function public.res_schema_facts()
returns jsonb
language sql stable security definer
set search_path = public
as $fn$
  select jsonb_build_object(
    'tables', coalesce((
      select jsonb_agg(t order by t->>'name')
        from (
          select jsonb_build_object(
            'name', c.relname,
            'columns', (
              select coalesce(jsonb_agg(a.attname order by a.attname), '[]'::jsonb)
                from pg_attribute a
               where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped),
            'rlsEnabled', c.relrowsecurity,
            'policyCount', (
              select count(*) from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname)
          ) as t
            from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r'
             and c.relname like 'res\_%'
        ) s), '[]'::jsonb),

    'functions', coalesce((
      select jsonb_agg(f order by f->>'name')
        from (
          select jsonb_build_object(
            'name', p.proname,
            'searchPathPinned', exists (
              select 1 from unnest(coalesce(p.proconfig, '{}')) cfg
               where cfg like 'search_path=%'),
            'anonExecutable', exists (
              select 1 from information_schema.role_routine_grants g
               where g.routine_schema = 'public'
                 and g.routine_name = p.proname
                 and g.grantee in ('anon', 'PUBLIC'))
          ) as f
            from pg_proc p
            join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'res\_%'
        ) s), '[]'::jsonb)
  );
$fn$;

-- Records the current schema as expected. Called at the END of a migration
-- run, which is what makes normal change silent.
create or replace function public.res_accept_schema(p_note text default null)
returns bigint
language plpgsql security definer
set search_path = public
as $fn$
declare v_id bigint;
begin
  insert into res_schema_snapshot (facts, accepted_by, note)
  values (res_schema_facts(), current_user, p_note)
  returning id into v_id;

  perform res_audit('system', 'schema.accept', 'res_schema_snapshot', null,
    coalesce(p_note, 'schema accepted as the new baseline'),
    null, jsonb_build_object('snapshot_id', v_id),
    null, null, null, null, false, null);

  return v_id;
end;
$fn$;

create or replace function public.res_accepted_schema()
returns jsonb
language sql stable security definer
set search_path = public
as $fn$
  select facts from res_schema_snapshot order by accepted_at desc, id desc limit 1;
$fn$;

revoke execute on function public.res_schema_facts() from public, anon;
revoke execute on function public.res_accept_schema(text) from public, anon;
revoke execute on function public.res_accepted_schema() from public, anon;
grant execute on function public.res_schema_facts() to service_role;
grant execute on function public.res_accept_schema(text) to service_role;
grant execute on function public.res_accepted_schema() to service_role;

-- ── Accept the schema as it stands after this migration run ────────────────
-- Everything applied up to here is intentional by definition, so it becomes
-- the baseline. Any difference the drift job finds afterwards is a change
-- nobody recorded — which is exactly the thing worth being told about.
select public.res_accept_schema('baseline accepted by migration 20260815001700');

comment on table public.res_schema_snapshot is
  'Accepted schema baselines. The drift check compares live against the newest row, so applying a migration (which re-accepts) keeps legitimate change silent.';
