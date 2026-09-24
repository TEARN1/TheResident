# What I am not happy about

Twenty-five things, worst first. Every number here was measured this session,
not estimated — where a figure is a scan with limits, the limits are stated.

This is a working list, not a plan. Nothing here is scheduled and nothing is
assigned; it exists so the next decision is made against the real state of the
app rather than against memory.

---

## 0. The fork — read this before anything else

**1. `main` and `claude/app-not-working-io5l8f` have diverged into two
incompatible apps.** 14 commits on main, 112 on the branch, from the same base
(`752b8e7`). Main contains **none** of the branch's work — no `tokens.css`, no
component library, no Service Desk, no room inventory, no home areas, no
request timeouts, no `DESIGN-OVERHAUL.md`. The branch contains none of main's
11 new features. A merge produces **110 conflict hunks across 21 files**.

The collision is not cosmetic:

```
main:    'surface': 'rgba(10, 10, 10, 0.65)'     hardcoded, dark only
branch:   surface: 'rgb(var(--surface-rgb) / <alpha-value>)'   themeable
```

Main's redesign hardcodes colour, so the light theme, the WCAG AA contrast
work and the guardrail that fails the build on a raw colour cannot function on
it. The *aesthetic* is not the problem — glassmorphism can be built on tokens.
The hardcoded implementation is.

Every day this sits unresolved, both sides get more expensive to reconcile.
Nothing else on this list should start first.

**2. Main still carries both Preflight bugs.** It has no `border-style` rule
and no global `box-sizing`, so every Tailwind border paints nothing and
`w-full` elements with padding overrun their container. The luxury redesign
was built on a base where borders were invisible.

---

## 1. Broken or dishonest right now

**3. The design system is largely a fiction.** 311 raw `<button>` in app code;
`Button` is imported by **2 files**. Five components are imported by **zero**:
`Field`, `GatedNotice`, `Modal`, `PageHeader`, `SearchInput`. Legacy
`GoldButton` has 12. Items 4–6 are all symptoms of this one.

**4. Most forms are unlabelled for a screen reader.** 112 `<label>` elements;
only **24 use `htmlFor`**, 22 wrap their control. The rest sit beside the field
as decoration. `Field.tsx` solves this correctly and nothing imports it.
(Scan limit: a label wrapping its control is invisible to the scan, so the true
count is lower than the raw 159. Both spot-checks opened were genuine.)

**5. 26 of 167 icon-bearing buttons have no accessible name** — 13 are the
close `X`, so the predicted failure is being unable to find the way out of
anything. The send button in a conversation is one of them.

**6. Three tab strips are not tabs** — no `role`, no `aria-selected`. One is
Create Profile / Log In, the first screen anyone meets. `Tabs.tsx` does it
correctly; one file uses it.

**7. Everyday notifications never reach a phone.** `web-push-send` is deployed
and 13 people hold real subscriptions, but there is **no trigger on
`notifications`**. Only `res_push_area_broadcast` and `res_broadcast_alert`
call it. A direct message or a room request pushes nothing.

**8. `push-notify` is still ACTIVE in production** — the stale Expo function
that reads `profiles.push_token` and writes to `notifications.push_error`, a
column that does not exist. Dead code holding live credentials.

**9. No test ever renders a component. Zero.** Every test is static analysis or
pure functions. This is exactly why the nav bar shipped invisible and why every
Tailwind border in the app painted nothing for the project's entire life, with
tsc, eslint, 307 tests, the build and the smoke test all green throughout.

**10. Everything fixed this session is unverified where it matters.** Borders,
`box-sizing`, the success animation, the page transition — all on auth-gated
screens. The mechanism is proven in a browser; the result on a signed-in screen
is not.

---

## 2. Security and operations

**11. Leaked-password protection is disabled.** One toggle in the Supabase
dashboard.

**12. `leaderboard_snapshot` is a materialized view exposed over the Data API
with RLS off** — the one ERROR-level advisory on the project.

**13. 33 tables have RLS enabled and zero policies**, which in Postgres means
deny-all. Some are deliberate (`res_client_errors` is written through a
`security definer` function). The rest need triage, because "locked down on
purpose" and "abandoned and broken" look identical from the outside.

**14. PostGIS is installed in the `public` schema, and `is_admin()` is
executable by `anon`.** Both Gruvs-side; both worth raising with them.

**15. PITR and the backup cron are unverified.** The restore drill passed
against a dump I made myself, which is not the same as knowing production can
be restored.

---

## 3. Product

**16. "My Business" is effectively unreachable** — one link buried on the
profile page, and the nav entry only appears once you are already on it. That
is the monetisation surface with no route in.

**17. `LiveLocationToggle` says "coming soon"** in the shipped app.

**18. The Gossip feed.** Called too basic, with a lot missing. Untouched,
because what it should become has never been written down.

**19. Four features are deferred with no plan**: next-of-kin verification
links, property deletion with safe cascading, reporting a *person* rather than
a post, and follow.

**20. The Automation Hub** is dev-gated but still compiled into the production
bundle.

---

## 4. Structure and process

**21. `src/store/index.ts` is 3,052 lines.** `VibeMap.tsx` is 1,707,
`housing/page.tsx` 1,295. These are where bugs hide.

**22. The map is probably unusable non-visually.** The honest fix may be a text
alternative — "3 reports within 2km: …" — rather than making a canvas
navigable.

**23. 2.3MB of client JS**, largest chunk 241K, for an app aimed at South
African phones on mobile data.

**24. The smoke test proves almost nothing about the real app.** 10 of its 15
routes redirect a guest to `/auth`, so it has been checking the login screen
twelve times per run.

**25. The schema of record drifts from the live database.** `SECURITY.md` once
claimed a whole feature was unapplied when all four of its tables were live.
The habit of checking the database first is now in place; nothing enforces it.

---

## If only three

**9** — render tests. It is the item that would have caught 4, 5 and the border
bug before anyone saw them, and it is the reason to trust anything else here.

**7** — push is ninety percent built and delivers nothing to the people who
already granted permission.

**3** — adopting the components collapses 4, 5 and 6 into migration work
instead of three separate campaigns.

All three are blocked behind **1**. The fork is the first decision.
