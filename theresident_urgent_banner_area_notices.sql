-- theresident_urgent_banner_area_notices.sql
--
-- Backlog A2: a `critical` AREA notice never raised the urgent banner.
--
-- WHAT WAS WRONG. res_pending_urgent_broadcasts only reads res_org_broadcasts
-- — the follow-based table — so an evacuation sent to an area landed in the
-- bell and in the Area Notices panel but never in the banner that stays until
-- acknowledged. Phase D built the entire acknowledgement path for area
-- notices (res_ack_area_broadcast, res_area_broadcast_receipts, requires_ack
-- in the payload) and nothing surfaced it. The interrupt-level delivery that
-- justifies the whole feature was missing for the half of it that reaches
-- people who never opted in.
--
-- THE SHAPE. One function, two sources, a `source` column so the client knows
-- which acknowledgement to call. Merged in SQL rather than by two client
-- fetches because the banner shows strictly one notice at a time, worst
-- first, and that ordering has to be decided across both sets — otherwise a
-- routine follow notice can sit in front of an evacuation.
--
-- The area half is derived from the notifications already delivered, not
-- re-resolved from geometry: if a resident was not notified, a banner for it
-- would be a banner for something they cannot see anywhere else.
--
-- Paste into the Supabase SQL editor. Replaces the existing function; the
-- return type gains a column, so it is dropped first.

drop function if exists public.res_pending_urgent_broadcasts();

create or replace function public.res_pending_urgent_broadcasts()
returns table (
  id uuid,
  unit_id uuid,
  unit_name text,
  title text,
  body text,
  priority text,
  created_at timestamptz,
  -- 'follow' → acknowledge with res_ack_broadcast
  -- 'area'   → acknowledge with res_ack_area_broadcast
  source text,
  -- Null for follow-based notices; the area a notice covered, for the rest.
  target_label text
)
language sql
stable
security definer
set search_path = public
as $$
  -- The union is wrapped: Postgres will not take an expression in ORDER BY
  -- directly after a UNION, and this ordering is the whole point of merging
  -- the two sources in SQL rather than in the client.
  select q.id, q.unit_id, q.unit_name, q.title, q.body, q.priority,
         q.created_at, q.source, q.target_label
  from (
  -- Follow-based, unchanged.
  select b.id, b.unit_id, u.name as unit_name, b.title, b.body, b.priority,
         b.created_at, 'follow'::text as source, null::text as target_label
  from res_org_broadcasts b
  join res_org_units u on u.id = b.unit_id
  left join res_org_broadcast_receipts r
         on r.broadcast_id = b.id and r.user_id = auth.uid()
  where b.priority in ('urgent', 'critical')
    and r.acknowledged_at is null
    and (b.expires_at is null or b.expires_at > now())
    and exists (
      select 1 from res_org_follows f
      where f.follower_user_id = auth.uid()
        and public.res_is_unit_ancestor_or_self(b.unit_id, f.unit_id)
    )

  union all

  -- Area-based. Membership comes from the notification actually delivered to
  -- this resident, so the banner can never show something the rest of the app
  -- has no record of them receiving.
  select ab.id, ab.unit_id, u.name as unit_name, ab.title, ab.body, ab.priority,
         ab.sent_at as created_at, 'area'::text as source, ab.target_label
  from res_area_broadcasts ab
  join res_org_units u on u.id = ab.unit_id
  left join res_area_broadcast_receipts ar
         on ar.broadcast_id = ab.id and ar.user_id = auth.uid()
  where ab.priority in ('urgent', 'critical')
    and ar.acknowledged_at is null
    and (ab.expires_at is null or ab.expires_at > now())
    and exists (
      select 1 from notifications n
      where n.recipient_id = auth.uid()
        and n.type = 'res_area_broadcast'
        and (n.data ->> 'area_broadcast_id')::uuid = ab.id
    )
  ) q
  -- Worst first across BOTH sources. The banner shows one notice at a time,
  -- so this ordering is what decides whether an evacuation or a school notice
  -- is the one a resident sees.
  order by
    case q.priority when 'critical' then 0 else 1 end,
    q.created_at desc
  limit 20;
$$;

revoke all on function public.res_pending_urgent_broadcasts() from public, anon;
grant execute on function public.res_pending_urgent_broadcasts() to authenticated, service_role;
