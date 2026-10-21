-- Roommate ads (one per person: the row id is the user's id) could be posted
-- and edited but never removed. Let people take their own ad down.
drop policy if exists res_seekers_delete on public.res_roommate_seekers;
create policy res_seekers_delete on public.res_roommate_seekers
  for delete to authenticated using (id = (select auth.uid()));
