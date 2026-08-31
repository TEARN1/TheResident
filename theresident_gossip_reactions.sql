-- theresident_gossip_reactions.sql
--
-- "Can we brainstorm this, it's too basic, a lot is missing here" — about
-- the Gossip Feed. The single most obviously-missing piece on a feed that
-- only supports comments: there is no way to react to a post at all, so
-- every post either gets a comment or gets nothing, with no lightweight
-- way to say "seen, agreed" the way every other feed in the app (Marketplace,
-- Notice Board reviews) already lets people signal something cheaply.
--
-- Scoped deliberately to one reaction type (a heart/like toggle), matching
-- how res_gossip_posts itself is written directly from the client rather
-- than through an RPC — this is the same shape, not a new pattern.
--
-- Paste into the Supabase SQL editor. Additive only.

create table if not exists public.res_gossip_post_reactions (
  post_id uuid references public.res_gossip_posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists res_gossip_post_reactions_post_idx
  on public.res_gossip_post_reactions (post_id);

alter table public.res_gossip_post_reactions enable row level security;

-- Counts and "who reacted" are the whole point of a reaction, same as a
-- like count anywhere else — public read, matching res_gossip_posts itself.
drop policy if exists res_gossip_post_reactions_select on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_select on public.res_gossip_post_reactions
  for select using (true);

drop policy if exists res_gossip_post_reactions_insert on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_insert on public.res_gossip_post_reactions
  for insert with check (user_id = auth.uid());

drop policy if exists res_gossip_post_reactions_delete on public.res_gossip_post_reactions;
create policy res_gossip_post_reactions_delete on public.res_gossip_post_reactions
  for delete using (user_id = auth.uid());
