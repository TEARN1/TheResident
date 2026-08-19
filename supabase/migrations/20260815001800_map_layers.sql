-- ═══════════════════════════════════════════════════════════════════════════
-- 20260815001800_map_layers — put the neighbourhood on the neighbourhood map
--
-- The VibeMap reads exactly one source (map_zones) while the app holds sixteen
-- tables carrying coordinates. Rooms, spaza shops, water points, wifi
-- hotspots, faults, lost pets — all invisible. It is a road-hazard map wearing
-- a neighbourhood map's name.
--
-- The fix splits along a line that matters, because putting everything into
-- map_zones would be a category error:
--
--   TRANSIENT things — faults, hazards — genuinely ARE zones. They have a
--   start, an end, a severity, and they resolve. They mirror into map_zones
--   and inherit its expiry and confirm/dispute machinery for free.
--
--   PERMANENT places — a shop, a room, a borehole — are not. Forcing them into
--   a table with ends_at means inventing fake expiry dates, polluting the
--   hazard confirm/dispute counts, and burning the 30-active-zone cap on
--   things that never go away. They get their own read path instead.
--
-- One more constraint shapes this: map_zones is GRUVS-OWNED (unprefixed —
-- CONTRACT.md §2) and its kind check allows exactly seven values. Adding a
-- kind would push data onto The Gruvs map uninvited, so nothing here invents
-- one. Faults and hazards map onto kinds that already exist and that The Gruvs
-- already knows how to draw.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Mirror transient things into map_zones ──────────────────────────────
-- Extends the existing res_mirror_to_map rather than adding a second mirror
-- function, so there stays exactly one answer to "how does a Resident row
-- become a map zone".
create or replace function public.res_mirror_to_map()
returns trigger
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_uid   uuid;
  v_lat   double precision;
  v_lon   double precision;
  v_sev   int;
  v_kind  text := 'alert';
  v_label text;
  v_note  text;
  v_resolved boolean;
  v_ttl   interval := interval '24 hours';
  v_src   text := TG_TABLE_NAME;
  g       geometry;
begin
  if TG_TABLE_NAME = 'res_alerts' then
    if NEW.kind not in ('incident','suspicious') then return NEW; end if;
    v_uid := NEW.user_id; v_lat := NEW.lat; v_lon := NEW.lon;
    v_label := NEW.title; v_note := NEW.description;
    v_sev := case lower(coalesce(NEW.severity,''))
               when 'low' then 1 when 'medium' then 2
               when 'high' then 3 when 'critical' then 3
               else 2 end;
    v_resolved := (lower(coalesce(NEW.status,'')) in ('resolved','false_alarm','closed','cleared'))
                  or NEW.resolved_at is not null;

  elsif TG_TABLE_NAME = 'res_faults' then
    -- A fault is a zone in every meaningful sense: somewhere, for a while,
    -- with a severity, and it ends. Only corroborated faults reach the map — a
    -- single unconfirmed report should not put a red dot on somebody's street,
    -- which is the same two-threshold reasoning the routing design uses.
    if NEW.status in ('reported','rejected') then return NEW; end if;
    v_uid := NEW.reported_by; v_lat := NEW.lat; v_lon := NEW.lon;
    v_label := coalesce(NEW.title, replace(NEW.kind, '_', ' '));
    v_note := NEW.detail;
    v_sev := case
               when NEW.kind in ('power_line_down','substation_damage','sewage_spill') then 3
               when NEW.severity >= 3 then 3
               else 2 end;
    v_resolved := NEW.status in ('resolved','verified','lapsed');
    -- Infrastructure faults outlive a day. A burst pipe is still a burst pipe
    -- tomorrow, and expiring it overnight would teach people the map is wrong.
    v_ttl := interval '7 days';

  elsif TG_TABLE_NAME = 'res_traffic_reports' then
    -- These predate res_report_map_zone and were being written by the app,
    -- fetched into Redux, and rendered by nothing at all. Mirroring them means
    -- hazards residents already reported finally appear.
    v_uid := NEW.reporter_id; v_lat := NEW.lat; v_lon := NEW.lon;
    v_label := replace(NEW.report_type, '_', ' ');
    v_note := NEW.description;
    v_sev := case NEW.report_type
               when 'accident' then 3 when 'roadblock' then 3 else 2 end;
    -- Onto kinds map_zones already allows, so nothing changes for The Gruvs.
    v_kind := case NEW.report_type
                when 'congestion' then 'heavy_traffic'
                when 'roadblock'  then 'road_closed'
                else 'alert' end;
    v_resolved := false;
    v_ttl := case NEW.report_type
               when 'congestion'  then interval '2 hours'
               when 'accident'    then interval '6 hours'
               when 'dead_robots' then interval '12 hours'
               when 'roadblock'   then interval '24 hours'
               when 'pothole'     then interval '30 days'
               else interval '48 hours' end;

  else
    -- res_neighbourhood_status, unchanged.
    v_uid := NEW.reporter_id; v_lat := NEW.lat; v_lon := NEW.lon;
    v_label := NEW.kind; v_note := NEW.detail; v_sev := 2;
    v_resolved := lower(coalesce(NEW.status,'')) in
                  ('resolved','restored','cleared','normal','ok','back','online');
  end if;

  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    return NEW;
  end if;
  if v_lat is null or v_lon is null
     or v_lat < -90 or v_lat > 90 or v_lon < -180 or v_lon > 180 then
    return NEW;
  end if;

  g := st_setsrid(st_makepoint(v_lon, v_lat), 4326);

  if not v_resolved and (
       select count(*) from public.map_zones
       where created_by = v_uid and source_app = 'resident'
         and status not in ('removed','expired') and ends_at > now()) >= 30 then
    return NEW;
  end if;

  insert into public.map_zones
    (ext_source, ext_id, source_app, event_id, kind, geom, label, note, severity,
     starts_at, ends_at, created_by, status)
  values
    (v_src, NEW.id, 'resident', null, v_kind, g,
     nullif(btrim(left(v_label, 200)), ''),
     nullif(btrim(left(v_note,  500)), ''),
     v_sev,
     coalesce(NEW.created_at, now()),
     coalesce(NEW.created_at, now())
       + case when v_resolved then interval '1 minute' else v_ttl end,
     v_uid,
     case when v_resolved then 'expired' else 'declared' end)
  on conflict (ext_source, ext_id) where ext_source is not null do update set
     geom     = excluded.geom,
     label    = excluded.label,
     note     = excluded.note,
     severity = excluded.severity,
     ends_at  = excluded.ends_at,
     status   = case when excluded.status = 'expired' then 'expired'
                     when public.map_zones.status = 'official' then 'official'
                     else public.map_zones.status end;

  return NEW;

-- A mirror failure must never break the underlying insert: a resident
-- reporting a burst pipe cares that the fault was recorded, not that a pin
-- appeared on a map.
exception when others then
  return NEW;
end;
$fn$;

drop trigger if exists res_faults_mirror on public.res_faults;
create trigger res_faults_mirror
  after insert or update on public.res_faults
  for each row execute function public.res_mirror_to_map();

drop trigger if exists res_traffic_mirror on public.res_traffic_reports;
create trigger res_traffic_mirror
  after insert or update on public.res_traffic_reports
  for each row execute function public.res_mirror_to_map();

-- ── 2. Places: a separate, read-only layer ─────────────────────────────────
-- Permanent things the neighbourhood should be able to see. Unioned at read
-- time — no copies, no sync job, nothing that can drift out of date.
create or replace function public.res_places_near(
  p_lat double precision,
  p_lon double precision,
  p_radius_m numeric default 8000,
  p_limit int default 400
) returns table (
  id uuid, place_kind text, title text, subtitle text,
  lat double precision, lon double precision, suburb text, radius_m numeric
)
language sql stable security definer
set search_path = public
as $fn$
  with origin as (
    select st_setsrid(st_makepoint(p_lon, p_lat), 4326)::geography as g
  ),
  places as (
    -- Assets first, deliberately. A map showing only danger teaches only
    -- fear, and these water points and wifi hotspots were already in the
    -- database going unused.
    select r.id, 'water_point' as place_kind, r.title,
           coalesce(r.access_note, r.availability) as subtitle,
           r.lat, r.lon, r.suburb, null::numeric as radius_m
      from res_shared_resources r
     where r.kind in ('water_point','borehole') and r.lat is not null and r.archived_at is null
    union all
    select r.id, 'wifi', r.title, coalesce(r.access_note, r.availability),
           r.lat, r.lon, r.suburb, null
      from res_shared_resources r
     where r.kind = 'wifi_hotspot' and r.lat is not null and r.archived_at is null
    union all
    select r.id, 'generator', r.title, coalesce(r.access_note, r.availability),
           r.lat, r.lon, r.suburb, null
      from res_shared_resources r
     where r.kind in ('generator','other') and r.lat is not null and r.archived_at is null
    union all
    select v.id, 'vendor', v.name, coalesce(v.hours, v.kind),
           v.lat, v.lon, v.suburb, null
      from res_vendors v
     where v.lat is not null and v.archived_at is null
    union all
    select s.id, 'service', s.business_name, s.category,
           s.lat, s.lon, s.suburb, null
      from res_handyman_services s
     where s.lat is not null and s.archived_at is null
    union all
    select k.id, 'skill', k.title, k.category, k.lat, k.lon, k.suburb, null
      from res_skills k
     where k.lat is not null and k.archived_at is null
    union all
    select l.id, 'room', l.title,
           coalesce(l.currency, 'ZAR') || ' ' || l.price::text,
           l.lat, l.lon, l.suburb, null
      from res_listings l
     where l.lat is not null and l.status = 'open' and l.archived_at is null
    union all
    select m.id, 'for_sale', m.title, m.category, m.lat, m.lon, m.suburb, null
      from res_market_items m
     where m.lat is not null and m.status = 'available' and m.archived_at is null
    union all
    select lf.id, 'lost_found', lf.title, lf.kind || ' ' || lf.category,
           lf.lat, lf.lon, lf.suburb, null
      from res_lost_found lf
     where lf.lat is not null and lf.status = 'open' and lf.archived_at is null
    union all
    -- radius_m is why that column exists at all: a community is an area, and
    -- it has been sitting in the schema waiting to be drawn as one.
    select c.id, 'community', c.name, c.kind, c.lat, c.lon, c.suburb, c.radius_m
      from res_communities c
     where c.lat is not null and c.archived_at is null
  )
  select p.id, p.place_kind, p.title, p.subtitle, p.lat, p.lon, p.suburb, p.radius_m
    from places p, origin o
   where st_dwithin(st_setsrid(st_makepoint(p.lon, p.lat), 4326)::geography, o.g, p_radius_m)
   order by st_distance(st_setsrid(st_makepoint(p.lon, p.lat), 4326)::geography, o.g)
   limit p_limit;
$fn$;

revoke execute on function public.res_places_near(double precision,double precision,numeric,int) from public, anon;
grant execute on function public.res_places_near(double precision,double precision,numeric,int) to authenticated, service_role;

comment on function public.res_places_near is
  'Permanent places for the map, unioned at read time. Deliberately NOT mirrored into map_zones: that table is for transient hazards with an expiry, and a spaza shop does not expire.';
