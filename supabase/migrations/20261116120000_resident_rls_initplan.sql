-- Database advisor fixes for The Resident's own tables (performance only;
-- who can see or change what is unchanged).
--
-- auth.uid() inside a policy is re-evaluated for every row. Wrapping it as
-- (select auth.uid()) lets Postgres evaluate it once per query
-- (advisor: auth_rls_initplan).

drop policy if exists res_call_signals_select_own on public.res_call_signals;
create policy res_call_signals_select_own on public.res_call_signals
  for select to authenticated
  using (to_id = (select auth.uid()) or from_id = (select auth.uid()));

drop policy if exists res_call_signals_delete_own on public.res_call_signals;
create policy res_call_signals_delete_own on public.res_call_signals
  for delete to authenticated
  using (to_id = (select auth.uid()) or from_id = (select auth.uid()));

drop policy if exists res_call_signals_insert_known_contact on public.res_call_signals;
create policy res_call_signals_insert_known_contact on public.res_call_signals
  for insert to authenticated
  with check (
    from_id = (select auth.uid())
    and exists (
      select 1 from public.messages m
      where (m.sender_id = (select auth.uid()) and m.recipient_id = res_call_signals.to_id)
         or (m.sender_id = res_call_signals.to_id and m.recipient_id = (select auth.uid()))
    )
  );

drop policy if exists res_room_vacancy_watches_select on public.res_room_vacancy_watches;
create policy res_room_vacancy_watches_select on public.res_room_vacancy_watches
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The caller's side of a call had no index (advisor: unindexed_foreign_keys).
create index if not exists res_call_signals_from_idx on public.res_call_signals (from_id);
