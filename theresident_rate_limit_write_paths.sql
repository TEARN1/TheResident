-- theresident_rate_limit_write_paths.sql
--
-- Adds the shared limiter to write RPCs that had none. Before this, 10 of 69
-- write paths were rate limited: the Service Desk, gossip and area broadcasts.
-- Everything else — reviews, trust-connection requests, map reports, property
-- and room creation, invites — could be called in a loop.
--
-- WHY THESE, AND NOT ALL OF THEM. A limiter is worth adding where abuse is
-- both cheap and lands in front of somebody else: a review on a stranger's
-- profile, a connection request, a marker on the shared map, a listing in the
-- housing feed. Toggles (vibe, echo, RSVP) are excluded — they are idempotent
-- and self-reversing, so hammering one wastes only the caller's time.
-- res_notify is excluded deliberately: it is an internal helper called by
-- other functions during fan-out, and limiting it would throttle legitimate
-- delivery rather than the person causing it.
--
-- HOW. Each function is rewritten from pg_get_functiondef, which reproduces
-- the complete definition — signature, volatility, security, search_path — so
-- nothing but the inserted line changes.
--
-- The limiter is inserted immediately after the function's OUTERMOST `begin`.
-- An earlier version of this file anchored on the shared
-- "if auth.uid() is null" check instead, and a dry run showed 5 of the 13
-- functions do not use that wording — they check ownership or admin
-- membership instead. Anchoring on `begin` is uniform, and costs nothing in
-- safety because res_check_rate_limit raises on its own when there is no
-- signed-in user.
--
-- The rewrite refuses loudly unless that anchor appears exactly once, rather
-- than guessing at a position: landing the limiter inside a nested block, or
-- after the write it is meant to precede, would be worse than not adding it.
--
-- Paste into the Supabase SQL editor. Idempotent: re-running skips functions
-- that already have a limiter.

do $$
declare
  -- A non-indented `begin` on its own line is the function's outermost block;
  -- nested plpgsql blocks are always indented by the style used here.
  v_anchor constant text := '(\r?\n)begin(\r?\n)';
  v_target record;
  v_def text;
  v_new text;
  v_hits integer;
begin
  for v_target in
    select * from (values
      -- (function, action key, max, window seconds)
      -- Reviews are permanent and attached to someone else's name.
      ('res_submit_review',               'review',           10, 3600),
      -- A request lands as a notification on a stranger.
      ('res_request_trust_connection',    'trust_request',    20, 86400),
      -- Generates a public, no-login link.
      ('res_create_kin_verification_link','kin_link',         10, 86400),
      -- Markers on the shared map everyone sees.
      ('res_report_map_zone',             'map_report',       20, 3600),
      ('res_report_road_segment',         'road_report',      20, 3600),
      ('res_report_infra_official',       'infra_report',     10, 3600),
      -- Content in the housing feed.
      ('res_create_property',             'create_property',  10, 86400),
      ('res_create_room',                 'create_room',      40, 86400),
      ('res_advertise_room',              'advertise_room',   20, 86400),
      -- Invites, waitlists and pledges reach other people.
      ('res_create_invite',               'create_invite',    20, 86400),
      ('res_request_move_assist',         'move_assist',      10, 86400),
      ('res_waitlist_request',            'waitlist',         20, 86400),
      ('res_pledge_group_buy',            'group_buy_pledge', 30, 86400)
    ) as t(fn, action, max_calls, window_seconds)
  loop
    select pg_get_functiondef(p.oid) into v_def
    from pg_proc p
    where p.proname = v_target.fn and p.pronamespace = 'public'::regnamespace
    limit 1;

    if v_def is null then
      raise notice 'skipping %: not installed here', v_target.fn;
      continue;
    end if;

    if position('res_check_rate_limit' in v_def) > 0 then
      raise notice 'skipping %: already limited', v_target.fn;
      continue;
    end if;

    select count(*) into v_hits from regexp_matches(v_def, v_anchor, 'g');
    if v_hits <> 1 then
      raise exception 'refusing to rewrite %: found % outermost begin blocks, expected exactly 1',
        v_target.fn, v_hits;
    end if;

    v_new := regexp_replace(
      v_def, v_anchor,
      format(E'\\1begin\\2  perform public.res_check_rate_limit(%L, %s, %s);\\2',
             v_target.action, v_target.max_calls, v_target.window_seconds)
    );

    if v_new = v_def then
      raise exception 'refusing to rewrite %: the anchor matched but nothing changed', v_target.fn;
    end if;

    execute v_new;
    raise notice 'rate limited % (% per % seconds)', v_target.fn, v_target.max_calls, v_target.window_seconds;
  end loop;
end $$;
