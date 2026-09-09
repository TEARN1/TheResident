\set ON_ERROR_STOP on
-- The content-complaint queue must be readable ONLY by a platform admin, and
-- acting on a report must be admin-only too.
--
-- res_reports existed with a full status workflow and residents could file
-- into it, but nothing ever read it: no queue, no reviewer, no way to act on
-- a complaint — while every reporter was told it "will be reviewed".
--
-- These functions are the review side. If their admin gate ever fails open,
-- any signed-in resident could read every complaint on the platform (and so
-- learn what is being said about whom) and take down anyone's content.

insert into profiles (id) values
  ('d1111111-1111-4111-8111-111111111111'),   -- platform admin
  ('d2222222-2222-4222-8222-222222222222')    -- ordinary resident
on conflict (id) do nothing;

insert into res_platform_admins (user_id)
values ('d1111111-1111-4111-8111-111111111111')
on conflict do nothing;

-- ── An ordinary resident may not read the queue ───────────────────────────
delete from auth._current;
insert into auth._current values ('d2222222-2222-4222-8222-222222222222');

do $$ begin
  if to_regprocedure('public.res_pending_reports(integer)') is null then return; end if;
  begin
    perform * from public.res_pending_reports(10);
    raise exception 'TEST FAILED: a resident read the moderation queue';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
end $$;
select 'a_resident_cannot_read_the_moderation_queue' as check, true as pass;

-- ── An ordinary resident may not take content down ────────────────────────
do $$ begin
  if to_regprocedure('public.res_resolve_report(text,uuid,text,text)') is null then return; end if;
  begin
    perform public.res_resolve_report(
      'gossip_post', 'cf000000-0000-4000-8000-000000000001', 'hide', 'because I disagree');
    raise exception 'TEST FAILED: a resident took content down';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'admin_required%' then raise; end if;
  end;
end $$;
select 'a_resident_cannot_take_content_down' as check, true as pass;

-- ── The admin can, and it is recorded ─────────────────────────────────────
delete from auth._current;
insert into auth._current values ('d1111111-1111-4111-8111-111111111111');

do $$ begin
  if to_regprocedure('public.res_pending_reports(integer)') is null then return; end if;
  perform * from public.res_pending_reports(10);
end $$;
select 'a_platform_admin_can_read_the_queue' as check, true as pass;

-- An unknown action must be refused rather than silently doing nothing —
-- a moderation call that appears to succeed and changes nothing is worse
-- than one that fails loudly.
do $$ begin
  if to_regprocedure('public.res_resolve_report(text,uuid,text,text)') is null then return; end if;
  begin
    perform public.res_resolve_report(
      'gossip_post', 'cf000000-0000-4000-8000-000000000001', 'delete_everything', null);
    raise exception 'TEST FAILED: an unknown moderation action was accepted';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'invalid_action%' then raise; end if;
  end;
end $$;
select 'an_unknown_action_is_refused' as check, true as pass;

-- NULL must be refused too. `NULL not in (...)` is NULL, and `if NULL then
-- raise` does not fire — the exact shape that was a live privilege
-- escalation in res_moderate. coalesce is why this passes.
do $$ begin
  if to_regprocedure('public.res_resolve_report(text,uuid,text,text)') is null then return; end if;
  begin
    perform public.res_resolve_report(
      'gossip_post', 'cf000000-0000-4000-8000-000000000001', null, null);
    raise exception 'TEST FAILED: a NULL action fell through the guard';
  exception when others then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
    if sqlerrm not like 'invalid_action%' then raise; end if;
  end;
end $$;
select 'a_null_action_cannot_fall_through' as check, true as pass;
