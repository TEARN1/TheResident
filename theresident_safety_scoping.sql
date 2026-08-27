-- theresident_safety_scoping.sql
--
-- Fixes items #3 and #4 from the "Resident Scaling Risks" audit:
--
--   #3. res_alerts and res_neighbourhood_status had `for select to
--       authenticated using (true)` — any signed-in user of either app
--       sharing this Supabase project (The Gruvs or The Resident) could
--       read every panic alert and every outage report ever filed,
--       anywhere. Narrowed to: your own rows, rows in a community you
--       belong to, or (when an alert/status has a city on it) rows in
--       your own city.
--
--       IMPORTANT: today the app never sets community_id or city when
--       creating an alert or status report (alertToRow / neighbourhood
--       StatusToRow in src/store/dbMappers.ts only send suburb, lat,
--       lon — not those two columns). An earlier version of this file
--       narrowed access to ONLY those two signals, which would have
--       made every alert/status report invisible to everyone except
--       its own creator, since community_id and city are always null
--       in practice. Fixed: rows with neither signal set fall back to
--       the original authenticated-can-read-all behaviour, so nothing
--       regresses today; the narrowing takes effect automatically once
--       a future change starts populating community_id/city on insert.
--
--   #4. res_broadcast_alert fanned out notifications with a plpgsql
--       for-loop doing one `insert into notifications` per recipient.
--       Rewritten as a single set-based `insert ... select`, same
--       recipient logic, one query instead of N round-trips through
--       the PL/pgSQL executor.
--
--       Same caveat applies here too and predates this change: because
--       community_id/city are never set on insert, res_broadcast_alert's
--       community/city match never fires today, so panic-alert push
--       notifications are effectively a no-op in production right now.
--       That's a separate, pre-existing gap (the alert row itself has
--       always been visible to everyone via the old `using (true)`
--       policy; it's only the *notification* that silently never sent).
--       Not fixed here — closing it means deciding how an alert's
--       community/city should be captured at creation time, which is a
--       product decision, not a one-line SQL patch.
--
-- Paste this into the Supabase SQL editor and run it. It only touches
-- res_alerts / res_neighbourhood_status policies and the
-- res_broadcast_alert function body — no table or column changes, and
-- nothing here is destructive.

-- ── #3: narrow res_alerts SELECT ──────────────────────────────────────────
drop policy if exists res_alerts_select on public.res_alerts;
create policy res_alerts_select on public.res_alerts
  for select to authenticated using (
    user_id = auth.uid()
    or (community_id is null and city is null)
    or (community_id is not null and public.res_is_community_member(community_id, auth.uid()))
    or (
      community_id is null
      and city is not null
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.city = res_alerts.city)
    )
  );

-- ── #3: narrow res_neighbourhood_status SELECT ────────────────────────────
drop policy if exists res_status_select on public.res_neighbourhood_status;
create policy res_status_select on public.res_neighbourhood_status
  for select to authenticated using (
    reporter_id = auth.uid()
    or (community_id is null and city is null)
    or (community_id is not null and public.res_is_community_member(community_id, auth.uid()))
    or (
      community_id is null
      and city is not null
      and exists (select 1 from public.profiles p where p.id = auth.uid() and p.city = res_neighbourhood_status.city)
    )
  );

-- ── #4: set-based res_broadcast_alert ──────────────────────────────────────
create or replace function public.res_broadcast_alert(p_alert_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_alert record;
begin
  select * into v_alert from res_alerts where id = p_alert_id;
  if not found then
    raise exception 'alert not found';
  end if;

  -- Same recipient rule as before (community match, or same-city fallback
  -- when the alert has no community_id) — now one insert instead of a
  -- per-recipient loop.
  insert into notifications (recipient_id, actor_id, type, title, body, data)
  select
    p.id,
    v_alert.user_id,
    'res_alert_panic',
    '🚨 NEIGHBOURHOOD ALERT: ' || v_alert.title,
    v_alert.description,
    jsonb_build_object('alert_id', v_alert.id, 'kind', v_alert.kind)
  from profiles p
  left join res_community_members cm on cm.user_id = p.id
  where p.id <> v_alert.user_id
    and p.is_verified = true
    and (
      (v_alert.community_id is not null and cm.community_id = v_alert.community_id)
      or (v_alert.community_id is null and v_alert.suburb is not null and p.city = v_alert.city)
    );
end;
$$;

revoke execute on function public.res_broadcast_alert(uuid) from public, anon;
grant execute on function public.res_broadcast_alert(uuid) to authenticated, service_role;
