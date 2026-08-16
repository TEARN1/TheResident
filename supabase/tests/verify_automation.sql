-- Post-migration verification for the automation substrate.
-- Read-only except for the append-only probe, which it rolls back.
-- Run after `supabase db push`; every assertion raises on failure.

do $$
declare
  v_count int;
  v_ok    boolean;
begin
  -- ── 1. Tables exist ──────────────────────────────────────────────────────
  select count(*) into v_count from information_schema.tables
   where table_schema = 'public'
     and table_name in ('res_audit_log','res_jobs','res_job_runs','res_policies',
                        'res_effect_keys','res_transitions','res_initial_states');
  if v_count <> 7 then
    raise exception 'expected 7 automation tables, found %', v_count;
  end if;

  -- ── 2. The kill switch exists and is CLOSED ──────────────────────────────
  select enabled into v_ok from res_policies where key = 'automation.enabled';
  if v_ok is null then
    raise exception 'automation.enabled policy is missing — there is no kill switch';
  end if;
  if v_ok then
    raise exception 'automation.enabled is TRUE straight after migration; it must ship closed';
  end if;

  -- ── 3. No job is enabled on arrival ──────────────────────────────────────
  select count(*) into v_count from res_jobs where enabled;
  if v_count > 0 then
    raise exception '% job(s) enabled straight after migration', v_count;
  end if;

  -- ── 4. Audit log is service-role only ────────────────────────────────────
  select count(*) into v_count
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'res_audit_log'
     and grantee in ('anon','authenticated','PUBLIC');
  if v_count > 0 then
    raise exception 'res_audit_log is reachable by a client role (% grants)', v_count;
  end if;

  -- ── 5. Audit log really is append-only ───────────────────────────────────
  insert into res_audit_log (actor_kind, action, entity, reason)
  values ('system', 'verify.probe', 'res_audit_log', 'append-only verification probe');

  begin
    delete from res_audit_log where action = 'verify.probe';
    raise exception 'res_audit_log allowed a DELETE — it is not append-only';
  exception when others then
    if sqlerrm not like '%append-only%' then raise; end if;
  end;

  -- ── 6. Every res_ function pins search_path (CONTRACT §5) ────────────────
  select count(*) into v_count
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'res\_%'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                      where c like 'search_path=%');
  if v_count > 0 then
    raise exception '% res_ function(s) do not pin search_path', v_count;
  end if;

  -- ── 7. No res_ function is executable by anon ────────────────────────────
  select count(*) into v_count
    from information_schema.role_routine_grants
   where routine_schema = 'public' and routine_name like 'res\_%'
     and grantee in ('anon','PUBLIC');
  if v_count > 0 then
    raise exception '% res_ function grant(s) to anon/PUBLIC', v_count;
  end if;

  -- ── 8. No job may be allowlisted against profiles (CONTRACT §2/§3) ───────
  begin
    insert into res_jobs (name, description, schedule, table_allowlist)
    values ('__probe__', 'allowlist guard probe', '0 0 * * *', array['profiles']);
    raise exception 'res_jobs accepted profiles in table_allowlist';
  exception when others then
    if sqlerrm not like '%table_allowlist%' then raise; end if;
  end;

  -- ── 9. Transitions were seeded and match the generator ───────────────────
  select count(*) into v_count from res_transitions;
  if v_count < 40 then
    raise exception 'res_transitions has only % rows; the seed migration did not run', v_count;
  end if;

  select count(*) into v_count from res_initial_states;
  if v_count < 10 then
    raise exception 'res_initial_states has only % rows', v_count;
  end if;

  -- ── 10. The critical-alert guard is present and correct ──────────────────
  select guard = 'notCritical' into v_ok from res_transitions
   where entity = 'res_alerts' and from_state = 'active' and to_state = 'auto_closed';
  if not coalesce(v_ok, false) then
    raise exception 'the auto_closed alert transition is not guarded by notCritical';
  end if;

  -- ── 11. Fault layer: evidence must not be client-writable ───────────────
  -- res_faults counters and res_fault_vouches rows are what make a fault
  -- credible. If a client could write either directly, the evidence would be
  -- self-reported and the whole mechanism worthless.
  select count(*) into v_count
    from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'res_fault_vouches'
     and privilege_type = 'INSERT' and grantee in ('anon','authenticated','PUBLIC');
  if v_count > 0 then
    raise exception 'res_fault_vouches is directly insertable by a client role — the proximity gate can be bypassed';
  end if;

  select count(*) into v_count from pg_policies
   where schemaname = 'public' and tablename = 'res_faults' and cmd = 'UPDATE';
  if v_count > 0 then
    raise exception 'res_faults has an UPDATE policy; counters must only be written by the escalate_faults job';
  end if;

  -- ── 12. The danger path is intact ───────────────────────────────────────
  -- A downed conductor escalates on the first report. If this transition ever
  -- disappears, faults that can kill someone would silently start queuing
  -- behind a five-neighbour corroboration threshold.
  if not exists (
    select 1 from res_transitions
     where entity = 'res_faults' and from_state = 'reported' and to_state = 'escalated'
       and 'job' = any(actors)
  ) then
    raise exception 'the immediate-danger escalation path for res_faults is missing';
  end if;

  raise notice 'verify_automation: all checks passed';
end $$;

-- The probe row from check 5 stays. It cannot be cleaned up — that is exactly
-- what check 5 proved — and a record that the automation substrate was
-- verified on this database, at this time, is legitimate audit history rather
-- than litter.
