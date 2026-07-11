# Connected-Apps Contract — The Gruvs ↔ The Resident

Both apps are clients of **one Supabase project** (`feevvddvrjmfbhffccbf`). This
file is the API contract between them: who owns what, what may be read across
the boundary, and the conventions every new table/RPC must follow. A copy lives
in both repos — **change it in both or not at all.**

## 1. Identity (SSO)

- One `auth.users` account + one `public.profiles` row = one person in both apps.
- **The Gruvs owns `public.profiles`.** The Resident extends it via
  `public.res_profiles` (1:1, FK `profiles.id`) and writes ONLY its extension.
- Signup in either app creates the shared `profiles` row (via the
  `create_user_profile` RPC). The Resident additionally upserts `res_profiles`
  with a role (`tenant` / `landlord` / `visitor`) on first entry.

## 2. Table ownership

| Prefix / table | Writes | Reads |
|---|---|---|
| `profiles` | Gruvs (+ own-row via `update_profile` RPC) | both |
| `res_*` (12 tables) | The Resident | both (RLS-scoped) |
| `events`, `messages`, `notifications`, everything else unprefixed | The Gruvs | both (RLS-scoped) |

**Rule: every new Resident table is `res_`-prefixed.** Unprefixed names belong
to The Gruvs.

## 3. Trust columns (read-only across the boundary)

The Resident may READ these `profiles` columns to render credibility on
listings/lifts/services — it must NEVER write them (a DB trigger pins them):

`username, display_name, avatar_url, bio, city, vibe_score, is_verified,
social_integrity_score, badges, xp, created_at`

Never read (Gruvs-private): `push_token, email, first_name, surname,
emergency_contacts, lat/lon, birth_*`.

## 4. Shared rails (use these — do not rebuild)

- **DM / contact**: insert into `messages`
  (`sender_id, recipient_id, body, message_type, is_request`). First contact
  between strangers sets `is_request = true` (request-gated). Realtime channel
  convention: `dm_fast_<idA_idB>` (ids sorted).
- **Notifications**: insert into `notifications`
  (`recipient_id, actor_id, type, title, body, data jsonb, read`). Device push
  is delivered automatically by the `push-notify` edge function (DB webhook on
  INSERT) — clients never call push APIs directly.
  Resident-owned `type` values are prefixed: `res_room_request`,
  `res_request_approved`, `res_lift_join`, `res_dispatch`, `res_token_claim`,
  `res_alert_panic`, `res_alert_response`, `res_market_reply`, `res_groupbuy_pledge`,
  `res_lostfound`, `res_care_missed`, `res_status`.
- **Storage**: reuse existing buckets; upload paths MUST start with
  `${user.id}/` (RLS enforces it). Resident sub-folders:
  `${user.id}/res/listing_*`, `${user.id}/res/tool_*`, etc.
- **Location**: `{ lat, lon }` double columns, WGS84. Currency: prices stored
  as plain numerics + `currency` code (display-only — see §6).

## 5. Functions / RPC conventions

- This DB is **default-deny**: a new function gets NO client execute. Every
  Resident RPC must `revoke ... from public, anon` +
  `grant execute ... to authenticated, service_role` explicitly, pin
  `set search_path`, and be `res_`-prefixed:
  - `res_toggle_rsvp`
  - `res_is_household_member`
  - `res_is_community_member`
  - `res_broadcast_alert`
  - `res_award_good_neighbour`
- Cross-app RPCs (Phase 2+): `get_public_trust(p_user_id)` returns ONLY the §3
  columns.

## 6. Money posture — BROKER, never wallet

Neither app moves money. Prices (`price`, `price_per_seat`, `deposit`,
`price_estimate`) are display data; parties settle off-platform (cash/EFT).
No balance columns, no stored voucher/token codes, no escrow. "Claimed"/"rented"
statuses are coordination signals, not transactions.

## 7. Security baseline (both apps)

- RLS on every table; writes always carry `WITH CHECK`; no `USING (true)`
  write policies; private-by-relationship for applications/disputes/dispatches.
- The Resident is signed-in only (no anon SELECT on `res_*`).
- `TIMESTAMPTZ` for time; `touch_updated_at()` trigger for `updated_at`.
- Reference: `supabase/queries/security_layers.sql` (Gruvs repo) — the
  standard all schema changes are held to.

## 8. Cross-app product hooks (phased)

- **Phase 2**: Resident cards show Gruvs trust (§3) + "Message on The Gruvs"
  (§4 DM rails).
- **Phase 3**: `res_lift_clubs.event_id` ➔ lifts attach to Gruvs events and
  surface in the event's CarpoolBoard; handyman ➔ `gig_posts` bridge;
  "moving day" spawns a private Gruvs event.
- **Phase 4**:
  - **Panic Alerts**: Critical resident panic alerts trigger `res_broadcast_alert` and pin a warning banner at the top of the social feed in `LandingPage.js`.
  - **Shared Business Directory**: Spaza shops and handyman services register in Resident and automatically list under Gruvs `ServiceMarketplace.js` gig list.
  - **Reputation Integration**: Local help/mutual aid actions trigger `res_award_good_neighbour` to increment user's universal Gruvs XP.
