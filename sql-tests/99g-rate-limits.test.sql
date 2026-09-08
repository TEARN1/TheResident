\set ON_ERROR_STOP on
-- Write RPCs that create rows, mint public links or notify people must be
-- rate limited.
--
-- res_check_rate_limit existed but guarded only a handful of the write RPCs.
-- The rest could be called as fast as a script can issue HTTP requests:
-- creating rooms and listings, minting public next-of-kin verification URLs,
-- pledging to group buys, booking lift seats. That is a spam vector, a cost
-- vector, and on the kin links a way to generate unbounded public URLs.
--
-- Guarded by to_regprocedure because the local harness builds a subset of the
-- schema; absence reads as "not installed here". On the live project every
-- signature below resolves.

select 'the_rate_limiter_itself_exists' as check,
  to_regprocedure('public.res_check_rate_limit(text,integer,integer)') is not null as pass;

-- The limiter must refuse an unauthenticated caller outright, or a signed-out
-- script would simply share one anonymous bucket.
select 'the_limiter_requires_a_signed_in_caller' as check,
  (to_regprocedure('public.res_check_rate_limit(text,integer,integer)') is null
   or pg_get_functiondef(to_regprocedure('public.res_check_rate_limit(text,integer,integer)')::oid)
      ilike '%auth.uid() is null%') as pass;

-- The limiter counts per user, per action, per fixed window, atomically.
-- An implementation that read-then-wrote would let concurrent requests
-- through; the upsert is what makes the count trustworthy.
select 'the_limiter_counts_atomically' as check,
  (to_regprocedure('public.res_check_rate_limit(text,integer,integer)') is null
   or pg_get_functiondef(to_regprocedure('public.res_check_rate_limit(text,integer,integer)')::oid)
      ilike '%on conflict%do update%') as pass;

-- Each of these creates rows, mints a public URL, or spends a finite resource.
do $$
declare
  sig text;
  missing text[] := '{}';
begin
  foreach sig in array array[
    'public.res_create_kin_verification_link(text,text)',
    'public.res_create_room(uuid,text,numeric,text)',
    'public.res_advertise_room(uuid)',
    'public.res_pledge_group_buy(uuid,integer)',
    'public.res_book_seat(uuid)',
    'public.res_set_home_area(double precision,double precision,text)',
    'public.res_delete_property(uuid)',
    'public.res_toggle_echo(uuid)',
    'public.res_toggle_rsvp(uuid)',
    'public.res_toggle_vibe(uuid)'
  ]
  loop
    if to_regprocedure(sig) is not null
       and pg_get_functiondef(to_regprocedure(sig)::oid) not ilike '%res_check_rate_limit%' then
      missing := missing || sig;
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'not rate limited: %', array_to_string(missing, ', ');
  end if;
end $$;
select 'every_creating_rpc_is_rate_limited' as check, true as pass;
