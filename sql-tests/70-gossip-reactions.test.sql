\set ON_ERROR_STOP on
-- Public read (counts are the point), but you may only ever write your own
-- reaction row — not one on someone else's behalf, and not delete anyone
-- else's.

grant usage on schema public, auth to authenticated;
grant select, insert, delete on public.res_gossip_post_reactions to authenticated;
grant select, insert, update on auth._current to authenticated;
alter table public.res_gossip_post_reactions force row level security;

insert into public.profiles (id) values
  ('00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000702')
on conflict (id) do nothing;

insert into public.res_gossip_posts (id, author_id, body)
  values ('00000000-0000-0000-0000-000000000799', '00000000-0000-0000-0000-000000000701', 'Test post')
on conflict (id) do nothing;

set role authenticated;
update auth._current set uid = '00000000-0000-0000-0000-000000000701';

insert into public.res_gossip_post_reactions (post_id, user_id)
  values ('00000000-0000-0000-0000-000000000799', '00000000-0000-0000-0000-000000000701');

select 'own_reaction_recorded' as check,
  (select count(*) from public.res_gossip_post_reactions where post_id = '00000000-0000-0000-0000-000000000799') = 1 as pass;

do $$ begin
  begin
    insert into public.res_gossip_post_reactions (post_id, user_id)
      values ('00000000-0000-0000-0000-000000000799', '00000000-0000-0000-0000-000000000702');
    raise exception 'expected reacting as someone else to be rejected';
  exception when others then
    null;
  end;
end $$;
select 'cannot_react_as_someone_else' as check, true as pass;

-- A second resident sees the count publicly (select is true), including
-- being able to see who reacted.
update auth._current set uid = '00000000-0000-0000-0000-000000000702';
select 'other_resident_sees_the_reaction' as check,
  (select count(*) from public.res_gossip_post_reactions where post_id = '00000000-0000-0000-0000-000000000799') = 1 as pass;

do $$ begin
  begin
    delete from public.res_gossip_post_reactions
      where post_id = '00000000-0000-0000-0000-000000000799' and user_id = '00000000-0000-0000-0000-000000000701';
    if found then
      raise exception 'expected deleting someone else''s reaction to be blocked';
    end if;
  end;
end $$;
select 'cannot_delete_someone_elses_reaction' as check,
  (select count(*) from public.res_gossip_post_reactions where post_id = '00000000-0000-0000-0000-000000000799') = 1 as pass;

-- The original reactor can remove their own.
update auth._current set uid = '00000000-0000-0000-0000-000000000701';
delete from public.res_gossip_post_reactions
  where post_id = '00000000-0000-0000-0000-000000000799' and user_id = '00000000-0000-0000-0000-000000000701';
select 'own_reaction_removable' as check,
  (select count(*) from public.res_gossip_post_reactions where post_id = '00000000-0000-0000-0000-000000000799') = 0 as pass;

reset role;
