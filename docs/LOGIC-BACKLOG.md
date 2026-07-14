# The Resident — Logic Backlog (50 features × 5 logics)

250 concrete pieces of logic, grouped. Each entry states its intent, the tables
it uses, and five implementable rules.

**Status key**
- ✅ **Ready** — tables, columns and RLS already exist; needs UI + wiring only.
- ⚠️ **Migration** — needs a new table/column/policy.
- 🐛 **Fix** — corrects existing broken behaviour.

**House rules every logic must respect**
- **Broker posture** (CONTRACT.md §6): no money moves. No balances, no escrow,
  no stored voucher codes. `claimed` / `rented` are coordination signals only.
- **Ownership**: The Resident writes `res_*` only. `profiles`, `messages`,
  `notifications`, `events` are Gruvs-owned; we insert into the shared rails but
  never write profile columns.
- **Trust columns readable** (§3): `username, display_name, avatar_url, bio, city,
  vibe_score, is_verified, social_integrity_score, badges, xp, created_at`.
  **Never read**: `push_token, email, first_name, surname, emergency_contacts,
  lat/lon, birth_*`. → Resident must derive location from device geolocation or
  its own `res_*` lat/lon columns, **not** from `profiles`.
- **Notifications**: insert into `notifications` (`recipient_id, actor_id, type,
  title, body, data`); the `push-notify` edge function delivers push on INSERT.
  Resident types are prefixed: `res_room_request`, `res_request_approved`,
  `res_lift_join`, `res_dispatch`, `res_token_claim`, `res_alert_panic`,
  `res_alert_response`, `res_market_reply`, `res_groupbuy_pledge`, `res_lostfound`,
  `res_care_missed`, `res_status`.
- **Every new RPC**: `res_`-prefixed, `security definer`, pinned `search_path`,
  `revoke from public, anon` + `grant to authenticated, service_role`.

---

## A. Safety net — schema exists, zero UI

### 1. Panic alert broadcast ✅
`res_alerts` + the `res_broadcast_alert` RPC (written, never once called).

1. Long-press SOS inserts `res_alerts {kind:'panic', severity:'critical', status:'active'}` with device lat/lon and the user's `community_id`.
2. Immediately call `res_broadcast_alert(alert_id)` — it fans out `notifications` rows of type `res_alert_panic` to verified members of that community.
3. When `community_id` is null the RPC falls back to same-city verified profiles; cap the recipient count and dedupe so one alert can't blast the whole city.
4. Cooldown: one panic per user per 5 minutes. A second press updates the existing active alert instead of creating a new row (pocket-trigger protection).
5. Auto-expiry: an active alert with no responder activity for 6 hours prompts the reporter to confirm, then flips to `false_alarm` and stamps `resolved_at`.

### 2. Alert responder acknowledgement ✅
`res_alert_responders` — RLS already demands `profiles.is_verified = true`.

1. "I'm coming" inserts `{status:'coming'}`; if the user isn't verified the insert is denied by RLS, so show a "get verified to respond" state rather than a silent failure.
2. Status ladder `coming → arrived → stood_down`; a responder may only update their own row.
3. Each transition notifies the alert owner (`res_alert_response`).
4. Order responders by haversine distance from the alert's lat/lon and show a live count.
5. The first `arrived` flips the alert into a "help on scene" state visible to everyone watching it.

### 3. Neighbourhood status crowd signal ✅
`res_neighbourhood_status` (power / water / network).

1. Each report is an **insert**, never an update — it's an append-only crowd signal, so history is preserved.
2. Consensus rule: N ≥ 3 `down` reports for the same `kind` + `suburb` within 30 minutes = confirmed outage; below that it's "unconfirmed".
3. A confirmed outage pins a banner to the dashboard and notifies the suburb (`res_status`).
4. Load-shedding uses the `stage` status with the stage number in `detail`.
5. Auto-resolve: the first `up` report after a confirmed outage, corroborated by a second within 15 minutes, clears the banner.

### 4. Care circle check-ins ✅
`res_care_circle` (subject ↔ carer, daily/weekly cadence).

1. A carer registers a subject; RLS already scopes rows to subject or carer only.
2. "I'm OK" stamps `last_ok_at = now()` and keeps `status = 'active'`.
3. A missed check-in is derived, not stored: `now() - last_ok_at > cadence`.
4. On a miss, notify the carer (`res_care_missed`); after a second consecutive miss, escalate to community admins.
5. `paused` suppresses all escalation (holidays, hospital stays) without deleting the relationship.

### 5. Lost & found ✅
`res_lost_found` — persons, pets and items.

1. `kind` (lost/found) × `category` (person/pet/item) drives two different forms: a person needs last-seen time and description; an item needs photos.
2. Auto-match: a new `found` post is matched against open `lost` posts in the same suburb + category by title/description token overlap.
3. A match notifies both parties (`res_lostfound`) — it never auto-links them; a human confirms.
4. `status = 'reunited'` closes the post and awards good-neighbour XP to the finder (see #18).
5. Missing-person posts auto-escalate to a community-wide notification, unlike items.

### 6. Shared resources map ✅
`res_shared_resources` — boreholes, water points, WiFi hotspots, generators.

1. Owner registers a resource with `kind`, `access_note` and `is_free`; when not free, `price_note` is **text only** (broker posture — no transaction).
2. `availability` is a free-text schedule ("weekdays 6-8pm"); parse leniently and render an "open now" badge.
3. Map view clusters resources by `kind` within a radius of the user's device location.
4. During a confirmed water or power outage (#3), auto-surface the matching resource kind ("3 boreholes near you").
5. Owners can pause a resource (tank empty, generator broken) without deleting it.

---

## B. Local economy — schema exists, zero UI

### 7. Local market ✅
`res_market_items` — `price` nullable, so NULL means giveaway.

1. Three post types share one table: sell (price set), free (price null), wanted (needs a `kind` column ⚠️).
2. `condition` (new/good/fair/poor) is mandatory on physical goods and drives sort/filter.
3. `status` ladder `available → pending → gone`; "pending" means someone's coming to collect.
4. Replying opens a DM on the shared `messages` rail with `is_request = true` for first contact (CONTRACT §4) — never a Resident-local chat.
5. Auto-expire: an `available` item older than 60 days prompts the owner to relist or mark it gone.

### 8. Spaza & vendor directory ✅
`res_vendors` — `sells text[]`, `hours`, `contact_via_dm`.

1. `kind` (spaza/airtime/gas/food/produce/other) is the primary filter.
2. `sells[]` is a searchable tag array — "who has paraffin?" queries it directly.
3. `hours` renders an "open now" badge; vendors outside their hours sort below open ones.
4. `contact_via_dm = true` hides the phone number and routes contact through `messages`; false exposes `phone`.
5. One vendor row per user per `kind`, so nobody can flood the directory.

### 9. Group buy / stokvel ✅
`res_group_buys` + `res_group_buy_pledges` (unique per user per buy).

1. Organiser sets `target_quantity`, `display_price` and a `deadline`.
2. A pledge inserts into `res_group_buy_pledges`; the unique constraint means a second pledge is an **update**, not a duplicate.
3. `current_quantity` must be recomputed by an RPC that sums the pledges — never by client-side arithmetic (see #48).
4. Reaching `target_quantity` flips `status = 'completed'` and notifies all pledgers (`res_groupbuy_pledge`) to arrange collection.
5. Passing the `deadline` under target flips `status = 'cancelled'` and tells pledgers it didn't happen. No money ever moved, so nothing to refund.

### 10. Skills directory ✅
`res_skills` — hair, cleaning, childcare, tutoring.

1. `category` + `title` + `rate_note` (text, never a numeric price to settle).
2. `availability` is free text; surface it verbatim on the card.
3. Skills are community-scoped via `community_id` and fall back to suburb.
4. Hiring someone opens a DM; a completed job can be reviewed (needs the reviews table, #20 ⚠️).
5. Cross-post to the Gruvs gig marketplace (see #49).

---

## C. Communities and locality

### 11. Join / leave a community ✅
`res_community_members` exists and is entirely unused.

1. Join inserts `{community_id, user_id, role:'member'}`; the unique constraint makes double-joins a no-op.
2. Leave deletes the row; RLS already allows self-delete or removal by the community founder.
3. The creator of a community is inserted as `founder` in the same transaction.
4. `res_is_community_member` (written, never called) gates community-scoped content.
5. A user may belong to several communities; the UI needs an active-community switcher.

### 12. Community-scoped feeds ✅
Almost every Phase-4 table carries a `community_id`.

1. All feeds filter to the active community, then widen to suburb, then city, when the community is thin.
2. Content posted with `community_id = null` is suburb-public — make that visible to the poster before they publish.
3. An empty community shows a "seed it" state, not a blank page.
4. Cross-community content stays readable (RLS says `select using (true)`) but is visually de-emphasised.
5. The switcher rewrites the fetch filters, not the entire store.

### 13. Geo-suggested community on signup ⚠️
`res_communities` has `lat`, `lon` and `radius_m`, all unused.

1. On first entry, ask for device geolocation (the dashboard already has this flow).
2. Suggest every community whose `radius_m` circle contains the user's point, nearest first.
3. Suggest by `kind` precedence: street → block → complex → estate → suburb.
4. If nothing matches, offer to create one seeded with the detected suburb.
5. Never store the user's precise coordinates on `profiles` — that column is Gruvs-private (§3).

### 14. Private communities and invites ⚠️
The `is_private` flag exists with nothing behind it.

1. `is_private = true` hides the community from discovery — needs a narrower select policy, since the current one is `using (true)`.
2. Membership is by invite code, generated by an admin, with a TTL.
3. Redeeming a valid code inserts the membership row via a security-definer RPC.
4. Codes are single-use or capped-use; revocable by any admin.
5. Content in a private community must not leak into suburb-wide feeds.

### 15. Community moderation ⚠️
The member `role` column already distinguishes member / admin / founder.

1. Founders promote members to admin; only a founder can demote a founder.
2. Admins can remove members (the delete policy already permits founder-initiated removal).
3. Admins can hide a post in their community (needs a `hidden_by` column).
4. Every moderation action writes an audit row (needs a table) — never a silent delete.
5. Removing a member does not delete their content; it stops them posting.

---

## D. Trust, reputation and safety

### 16. Verification gating ✅
`profiles.is_verified` already gates alert responses at the RLS layer.

1. Surface verification state on every profile card and every gated action.
2. Blocked actions explain *why* ("only verified neighbours can respond to alerts") instead of failing silently.
3. Verification itself belongs to Gruvs — deep-link there; never write the column.
4. Verified-only mode: let a community require verification to post.
5. Cache the flag in Redux at login; it's a read-only trust column.

### 17. Landlord document review ⚠️
`res_listings` collects `verification_doc_url` and nothing ever looks at it.

1. Uploading a document sets a `pending_review` state on the listing (needs a column).
2. Reviewed listings earn a "documents checked" badge; unreviewed ones say so plainly.
3. Documents live in storage under `${user.id}/res/…` (RLS enforces the prefix, §4).
4. A rejected document notifies the landlord with a reason.
5. Never expose the document URL to tenants — only the resulting badge.

### 18. Good-neighbour XP ✅
`res_award_good_neighbour` exists and has never been called.

1. Award on: chore completed, tool returned on time, alert responded to, lost item reunited.
2. The RPC caps each award at 100 XP and forwards to the Gruvs `award_xp` — one shared reputation across both apps.
3. Awards are idempotent per event, so re-completing a chore can't farm XP.
4. XP is *earned by* the actor and *granted by* the counterparty's confirmation, never self-declared.
5. Show the resulting Gruvs `xp` / `badges` on the Resident profile card (read-only, §3).

### 19. Reputation decay and streaks ⚠️
The local `reputationScores` map is currently write-only and never persisted.

1. Score decays if there's no positive action for 30 days, so it reflects recent behaviour.
2. Consecutive weeks of completed chores build a streak multiplier.
3. A confirmed dispute against a user dampens their score.
4. Store the score server-side; a client-only score is trivially forged.
5. Never show a raw negative number — show tiers ("reliable", "new neighbour").

### 20. Reviews and ratings ⚠️ 🐛
**`res_handyman_services.rating` and `reviews_count` exist but nothing can compute them — there is no reviews table.** Today they're decorative.

1. Add `res_reviews` (subject type + id, author, rating 1–5, body, created_at).
2. Only a user with a `completed` dispatch against that service may review it — proven by the dispatch row.
3. One review per person per completed job; editable for 24 hours.
4. `rating` and `reviews_count` become derived values, recomputed by trigger or RPC — never client-written.
5. The same table serves tools, listings and skills, keyed by subject type.

### 21. Listing safety score ⚠️
`safety_rating` is currently self-declared by the landlord, which is worth little.

1. Blend the landlord's declaration with tenant reviews once #20 exists.
2. Weight recent reviews more heavily than old ones.
3. Show the sample size — "high (2 reviews)" is not "high (40 reviews)".
4. A listing with no reviews shows "unrated", not a default of "medium".
5. Corroborated safety incidents (#1) in the same street lower the area signal.

### 22. Scam heuristics ⚠️
1. Flag a listing priced far below its suburb median (see #32) for review before publishing.
2. Flag a landlord posting more than N listings in an hour.
3. Flag duplicate images or descriptions across accounts.
4. Flag off-platform payment requests in message bodies ("EFT deposit before viewing").
5. Flagged content is soft-hidden pending review, never hard-deleted.

### 23. Report and block ⚠️
Today the only abuse control is XSS scanning of input.

1. Add `res_reports` (reporter, subject type + id, reason, status).
2. Reporting hides the content for the reporter immediately, before any review.
3. N distinct reports auto-hide the content pending moderation.
4. Blocking a user hides their content and prevents DMs both ways.
5. Repeat offenders escalate to community admins, then to Gruvs account level.

### 24. Server-side rate limiting ⚠️ 🐛
The current limiter is an in-memory `Map` in middleware — it resets on cold start and doesn't survive multiple instances, so it's decorative in production.

1. Move counters into Postgres (or an edge KV) keyed by user, not IP.
2. Per-action limits: N listings/day, N alerts/hour, N messages/minute.
3. Enforce inside the insert RPC so the limit can't be bypassed by calling PostgREST directly.
4. Exceeding a limit returns a typed error the UI can explain, not a generic 429.
5. Keep the existing `scanInput` middleware for URL payloads — that part is real and works.

### 25. First-contact request gating ✅
The shared `messages` rail already has `is_request`.

1. A first DM between strangers sets `is_request = true` — the recipient accepts or ignores.
2. Accepting drops the flag for all subsequent messages.
3. Ignoring silently drops it; the sender is never told, which kills the harassment loop.
4. An existing relationship (approved room request, completed dispatch) skips the gate.
5. Never build a Resident-local chat table — reuse the rail (§4).

### 26. Dispute mediation with a real user-picker ⚠️ 🐛
**This fixes a live limitation**: the form types the accused as free text and hardcodes `mediatorId: 'landlord-1'`, so both `profiles` foreign keys must be null and cross-user mediation cannot work.

1. Replace the free-text field with a picker over the user's actual household members.
2. Set `against_user_id` to a real profile so the accused can see and answer the dispute.
3. Assign `mediator_id` to the household's actual landlord.
4. Widen the select policy so the accused and the mediator can read the row (today it's effectively reporter-only).
5. Log a resolution note when closing; both parties get notified.

---

## E. Matching and search

### 27. Roommate compatibility score ⚠️
Current matching is a naive gender + budget filter.

1. Weighted score: budget overlap, gender preference, children vs `req_max_children`, pets, smoking, suburb distance.
2. Hard filters (a listing that forbids pets and a seeker who has one) exclude rather than down-rank.
3. Show *why* something matched — "within budget, pets allowed" beats an opaque percentage.
4. Compute it in a memoised selector; the store already uses `createSelector` for exactly this.
5. Score is symmetric: the landlord sees the same number the tenant does.

### 28. Two-way listing ↔ seeker matching ⚠️
1. A new listing is matched against open `res_roommate_seekers` in that suburb.
2. A new seeker ad is matched against open listings.
3. Both sides get a "new match" notification, throttled to a daily digest.
4. Matches expire when the listing flips to `taken`.
5. Never auto-apply on the user's behalf — a match is an invitation to act.

### 29. Lift route matching ✅
`origin_lat/lon` and `dest_lat/lon` exist on `res_lift_clubs` and are completely unused.

1. Haversine-match a rider's origin and destination against every lift's endpoints.
2. Rank by combined detour distance, not straight-line distance to the origin alone.
3. Filter by `purpose` (commute / school_run / event / moving / errand) and `days`.
4. `carries_parcels` surfaces a "send a parcel" option distinct from a seat.
5. Match on departure window, not exact time — `departure_time` is free text and needs lenient parsing.

### 30. Distance-ranked search ✅
1. Every `res_*` table already has `lat`/`lon` — sort results by distance from the device's current position.
2. **Do not** read the user's coordinates from `profiles`; those columns are Gruvs-private (§3).
3. Cache the last known device position locally so a search works before the geolocation prompt resolves.
4. Show distance bands ("under 1 km") rather than false-precision metres.
5. Fall back to suburb-string matching when the user declines geolocation.

### 31. Saved searches ⚠️
1. Persist a user's filter set (price, suburb, amenities) as a named search.
2. A new listing matching a saved search notifies its owner.
3. Notifications are digested daily, never one per listing.
4. Saved searches expire after 60 days of no opens.
5. One tap turns a saved search back into an active filtered view.

### 32. Suburb price benchmarking ⚠️
1. Compute a median price per suburb per room type from `res_listings`.
2. Show it live on the create-listing form: "most rooms in Ivory Park go for R1 200–1 800".
3. Flag outliers on both ends — suspiciously cheap feeds the scam heuristic (#22).
4. Show tenants where a listing sits against the local median.
5. Suppress the benchmark below a minimum sample size rather than quoting a median of two.

### 33. Stale listing hygiene ⚠️
1. A listing untouched for 30 days prompts the landlord: still available?
2. No response in 7 days auto-flips it to `paused` (a status the schema already has).
3. `paused` listings drop out of search but keep their history and reviews.
4. One tap republishes and resets the clock.
5. A listing with an approved request auto-flips to `taken` (see #34).

---

## F. Coordination workflows (all broker-safe)

### 34. Room request lifecycle ✅
`res_room_requests` — unique on `(tenant_id, listing_id)`.

1. Applying inserts a `pending` request and notifies the landlord (`res_room_request`).
2. Approving notifies the tenant (`res_request_approved`).
3. Approving auto-rejects the other `pending` requests on that listing — one room, one tenant.
4. Approving flips the listing to `taken`.
5. The unique constraint means re-applying updates the existing request instead of spamming a second one.

### 35. Household formation ✅
This is the keystone that unlocks the whole co-living half of the app.

1. `res_is_household_member` already returns true for the landlord **or** a tenant with an approved request — the logic exists, nothing calls it.
2. An approved request therefore *is* household membership; no new table needed.
3. Household membership unlocks the chores tab, which is currently unreachable because chores need a `listing_id` no UI ever supplies.
4. Show the household roster on the listing (housemates, not strangers).
5. Leaving a household (request revoked) removes chore assignments but keeps the completion history.

### 36. Chore scheduling ✅ 🐛
`res_chore_schedule` — **there is no add-chore UI at all today**, so the table can only ever be empty.

1. Build the create-chore form; it must attach the household `listing_id` (NOT NULL, and the RLS check keys off it).
2. Auto-rotation: assign tasks round-robin across household members each week.
3. Completing a chore stamps `completed_at` and awards XP (#18).
4. The weekly reset deletes only that household's chores — the delete policy I added scopes exactly this.
5. An overdue chore nudges its owner, then the household.

### 37. Chore fairness ⚠️
1. Track completion rate per member over a rolling 4 weeks.
2. Surface imbalance gently ("Thandi has done 6 of the last 8") rather than shaming.
3. A repeatedly-skipped chore suggests reassignment.
4. Feed the fairness signal into reputation (#19).
5. Fairness is household-private — it must never leak into a public profile.

### 38. Tool lending lifecycle ✅
`res_tool_library` — `deposit` is display-only text money, never held.

1. Borrowing sets `status = 'rented'`, `rented_by`, `rented_until`.
2. The deposit is a *stated* amount the two parties settle in cash — the app never touches it (§6).
3. A due-date reminder goes to the borrower the day before `rented_until`.
4. Overdue escalates: borrower, then owner, then a reputation ding.
5. RLS already lets both owner and borrower update the row — which is what makes the two-sided handshake below possible.

### 39. Two-sided return handshake ⚠️
1. The borrower marks "returned"; the tool enters a `pending_return` state (needs the status value).
2. The owner confirms, which flips it back to `available` and clears `rented_by`.
3. Only the owner's confirmation awards the borrower their on-time XP.
4. A disputed return opens a dispute (#26) instead of a silent revert.
5. No confirmation within 72 hours auto-returns the tool but awards no XP.

### 40. Lift seat booking ✅ 🐛
1. Booking decrements `available_seats` — today this is computed client-side and overwritten, so two riders racing each other both "win" (see #48).
2. Move the decrement into an atomic RPC with a `available_seats > 0` guard.
3. A full lift offers a waitlist rather than a dead end.
4. Cancelling a seat returns it to the pool and promotes the first waitlisted rider.
5. Notify the driver on every join and cancellation (`res_lift_join`).

### 41. Recurring lifts ⚠️
1. `days` already stores a recurrence ("Mon-Fri"); parse it into actual trip instances.
2. Each instance has its own seat count — booking Tuesday shouldn't consume Wednesday's seat.
3. The driver can cancel a single instance without deleting the club.
4. Riders check in per trip; a no-show is recorded.
5. Repeated no-shows lose the standing seat.

### 42. Service dispatch state machine ✅
`res_service_dispatches` — `pending → accepted → completed`, with `proof_file_url`.

1. Dispatching notifies the business owner (`res_dispatch`).
2. Accepting notifies the sender; a quote is stated in the message body (text, never a charge).
3. Completing requires a proof-of-work upload — the column exists and no UI populates it.
4. Only the sender or the service owner can read the dispatch — RLS already enforces exactly that.
5. A completed dispatch unlocks the right to review (#20).

### 43. Utility voucher coordination ✅
`res_utility_tokens` — **the schema deliberately stores no voucher code** (§6).

1. A landlord advertises a voucher with a `meter_label` and a price; the code itself is handed over in person or by DM.
2. Claiming sets `status='claimed'`, `claimed_by`, `claimed_at` — a coordination lock, not a purchase.
3. RLS already permits any signed-in user to claim an `available` voucher and only the two parties to touch it afterwards.
4. An unconfirmed claim auto-releases after 24 hours so a voucher can't be squatted.
5. The UI must stop implying a wallet — nothing is bought, and the balance is cosmetic.

---

## G. Realtime, notifications and correctness

### 44. Realtime subscriptions ⚠️
The app fetches everything **once at login and never again** — no `postgres_changes` subscription exists anywhere in the codebase.

1. Subscribe to `res_notice_events`, `res_alerts` and `res_market_items` for the active community.
2. Merge incoming changes into the existing slices instead of refetching all 21 tables.
3. Unsubscribe on tab change and on unmount — no leaked channels.
4. Reconnect with backoff after a network drop, then reconcile with one fetch.
5. Alerts are the one channel that should stay subscribed app-wide, not per-tab.

### 45. Real push notifications ⚠️
The `notifications` table and the `push-notify` edge function already exist and **the Resident has never inserted a single row.** The bell icon is Redux-only, so nothing survives a refresh.

1. Every meaningful event inserts a `notifications` row with the correct `res_*` type.
2. Push delivery is automatic on INSERT — clients never call a push API (§4).
3. The bell reads from the table, so notifications survive a refresh and sync across devices.
4. `data jsonb` carries the deep-link target (alert id, listing id).
5. Mark-as-read writes back to the shared table, not just local state.

### 46. Notification preferences ⚠️
1. Per-type mute (chores, market, alerts) — panic alerts are not mutable.
2. Quiet hours, with panic alerts again exempt.
3. Digest mode batches low-priority types into one daily push.
4. Preferences live in a Resident-owned table; never write Gruvs profile columns.
5. Default to fewer notifications, not more.

### 47. Offline queue replay ✅ 🐛
`offlineQueue`, `queueOfflineAction` and `clearOfflineQueue` all exist in `uiSlice` — **and nothing anywhere ever dispatches them.** It is pure scaffolding.

1. On a write failure while `navigator.onLine === false`, enqueue the action.
2. Replay the queue in order on the `online` event.
3. Cap the queue and drop the oldest entries — an unbounded queue is a memory leak.
4. Reconcile after replay with one fetch, so a stale queued write can't overwrite fresher server data.
5. Show the pending count in the UI; silent queueing is how you lose someone's post.

### 48. Atomic counters ⚠️ 🐛
**This is a live bug, not a feature.** `bookSeat` and `pledgeGroupBuy` read the current value into JavaScript, add to it, and write the result back — so two concurrent users clobber each other and a seat gets sold twice.

1. Replace with a SQL-side increment: `set available_seats = available_seats - 1 where id = $1 and available_seats > 0`.
2. Wrap it in a security-definer RPC so the guard can't be bypassed.
3. The RPC returns the new value; the client trusts it rather than its own arithmetic.
4. Same treatment for `current_quantity` on group buys.
5. A rejected decrement (zero seats left) surfaces as a real error rather than a silent optimistic success.

### 49. Lift ↔ Gruvs event bridge ✅
`res_lift_clubs.event_id` already references `events(id)` and is never populated.

1. Creating a lift can attach it to a Gruvs event.
2. Event-attached lifts surface in that event's CarpoolBoard (CONTRACT §8, Phase 3).
3. Setting `purpose = 'event'` prompts for the event link.
4. Cancelling the event cancels its lifts.
5. The FK is already `on delete set null`, so a deleted event degrades the lift instead of destroying it.

### 50. Cross-app trust cards ✅
Every listing, lift and service is posted by a person whose Gruvs reputation you're allowed to read (§3).

1. Show `display_name`, `avatar_url`, `is_verified`, `vibe_score` and `badges` on every card.
2. "Message on The Gruvs" uses the shared `messages` rail (§4).
3. Never read the Gruvs-private columns — `email`, `push_token`, `lat/lon`, `emergency_contacts`, `birth_*`.
4. Never write a trust column; a DB trigger pins them anyway.
5. Resident actions feed XP back into that same score via `res_award_good_neighbour` (#18) — one reputation, two apps.

---

## Where to start

**Fix the bugs first** — they're small and they're actively wrong:
- **#48** atomic counters (double-booked seats)
- **#47** offline queue (dead scaffolding)
- **#20** ratings that nothing can compute

**Then the two that change how the app feels**, both riding rails that already exist and have never been used:
- **#45** real notifications (the `notifications` table + `push-notify` function are already there)
- **#44** realtime (the app is a one-shot snapshot from login today)

**Then the keystone**: **#35** household formation. `res_is_household_member` already exists and returns the right answer — nothing calls it. Wiring it up unlocks chores (#36), fairness (#37) and disputes (#26) in one move, because all three are already keyed off the household and all three are currently unreachable.

**Then the differentiator**: the safety cluster (**#1, #2, #3**). It's the most distinctive thing in this list, and the schema, the RLS and the broadcast RPC are all built and waiting.
