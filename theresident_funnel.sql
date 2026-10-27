-- Growth funnel for the platform admin.
--
-- The app writes a few named steps to analytics_events with
-- platform = 'resident' (src/utils/track.ts). That table has an insert
-- policy and no select policy, so the rows are write-only for clients. This
-- function is the one way to read them back, and only for a platform admin
-- (res_platform_admins). Everyone else gets no rows.
--
-- `actual` is the ground truth from the app's own tables where one exists,
-- so the tracked numbers can be sanity-checked (an ad blocker or an old
-- cached build can make tracked counts lower than real ones).

create or replace function public.res_funnel_summary(p_days int default 30)
returns table(step text, tracked bigint, sessions bigint, actual bigint)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as since
  ),
  steps(name, ord) as (
    values ('visit', 1), ('room_page_view', 2), ('signup', 3), ('listing_created', 4),
           ('apply_sent', 5), ('share_whatsapp', 6), ('concierge_click', 7)
  ),
  ev as (
    select e.event, count(*) as n, count(distinct e.session_id) as s
    from analytics_events e, bounds b
    where e.platform = 'resident' and e.created_at >= b.since
    group by e.event
  )
  select
    st.name,
    coalesce(ev.n, 0),
    coalesce(ev.s, 0),
    case st.name
      when 'signup' then (select count(*) from res_profiles p, bounds b where p.created_at >= b.since)
      when 'listing_created' then (select count(*) from res_listings l, bounds b where l.created_at >= b.since)
      when 'apply_sent' then (select count(*) from res_room_requests r, bounds b where r.created_at >= b.since)
    end
  from steps st
  left join ev on ev.event = st.name
  where res_is_platform_admin()
  order by st.ord;
$$;

revoke all on function public.res_funnel_summary(int) from public, anon;
grant execute on function public.res_funnel_summary(int) to authenticated;
