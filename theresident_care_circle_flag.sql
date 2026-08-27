-- theresident_care_circle_flag.sql
--
-- Fixes audit finding #53: a "needs assistance" Care Circle check-in was
-- never actually persisted. res_care_circle.status only ever allowed
-- 'active'/'paused' (whether the check-in cadence itself is running), which
-- has no room for "the subject just flagged that they need help" — a
-- different axis entirely. The app's write handler for a needs_assistance
-- check-in silently did nothing rather than violate that check constraint,
-- so the most safety-critical state a vulnerable person could set reverted
-- to whatever was last in the DB on the next refresh, with no error shown.
--
-- Adds a separate `flag` column rather than widening the `status` check
-- constraint, so "is this check-in circle active" and "does the subject
-- currently need help" stay independent — a paused circle can still carry
-- an unresolved flag, and marking someone OK clears it without touching
-- whether their check-in cadence is active or paused.
--
-- Paste this into the Supabase SQL editor and run it. Additive only — no
-- existing column, row, or policy is touched or dropped.

alter table public.res_care_circle
  add column if not exists flag text check (flag in ('none', 'needs_assistance')) default 'none' not null,
  add column if not exists flagged_at timestamptz;
