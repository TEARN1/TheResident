-- Real voice notes and real calls in DMs.
--
-- Before this, the DM screen only pretended: a "voice note" was a line of
-- text with a fake play button, and a "call" rang and "connected" on a timer
-- without the other person ever being reached.

-- 1. Voice notes ------------------------------------------------------------
-- Private bucket. Files live at <sender id>/<recipient id>/<file>, so the
-- two people in the conversation (and nobody else) can read them, through
-- short-lived signed URLs. Only the sender can upload into their folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'res-voice-notes', 'res-voice-notes', false, 10485760,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a']
)
on conflict (id) do nothing;

create policy "res_voice_notes_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'res-voice-notes'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] is not null
);

create policy "res_voice_notes_read_participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'res-voice-notes'
  and auth.uid()::text in ((storage.foldername(name))[1], (storage.foldername(name))[2])
);

create policy "res_voice_notes_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'res-voice-notes'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Call signalling ----------------------------------------------------------
-- WebRTC peers swap an offer, an answer and network candidates before audio
-- and video flow directly between them. Those small messages go through this
-- table: from_id is always the real sender (RLS), each side only receives
-- rows addressed to it (Realtime honours RLS), and you can only ring someone
-- you have already exchanged a message with, so strangers can't call you.

create table if not exists public.res_call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null,
  from_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invite', 'answer', 'ice', 'decline', 'cancel', 'hangup', 'busy')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint res_call_signals_not_self check (from_id <> to_id),
  constraint res_call_signals_payload_size check (octet_length(payload::text) <= 20000)
);

create index if not exists res_call_signals_to_idx on public.res_call_signals (to_id, created_at desc);
create index if not exists res_call_signals_call_idx on public.res_call_signals (call_id);

alter table public.res_call_signals enable row level security;

create policy "res_call_signals_insert_known_contact"
on public.res_call_signals for insert to authenticated
with check (
  from_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where (m.sender_id = auth.uid() and m.recipient_id = res_call_signals.to_id)
       or (m.sender_id = res_call_signals.to_id and m.recipient_id = auth.uid())
  )
);

create policy "res_call_signals_select_own"
on public.res_call_signals for select to authenticated
using (to_id = auth.uid() or from_id = auth.uid());

create policy "res_call_signals_delete_own"
on public.res_call_signals for delete to authenticated
using (to_id = auth.uid() or from_id = auth.uid());

revoke all on public.res_call_signals from anon;
grant select, insert, delete on public.res_call_signals to authenticated;

alter publication supabase_realtime add table public.res_call_signals;
