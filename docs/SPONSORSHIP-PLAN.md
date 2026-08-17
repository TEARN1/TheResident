# Local business sponsorship — the plan

The one thing in the monetization list that can earn money **before** The
Resident has an audience. This document is the careful version: what to build,
what deliberately not to build, and the order.

Written to be read by a person, not a compiler.

---

## 1. The idea in one paragraph

A spaza shop, plumber or security company already listed in the app pays a
small monthly fee to appear in a clearly-labelled **Sponsored** slot at the top
of the list for their suburb and category. Everyone else stays listed, free, in
the normal list below — unchanged and complete. The sponsor is buying
*position*, never *existence*.

That last sentence is the whole design. It is already the documented rule in
`src/utils/subscriptions.ts`:

> *Pay-for-priority, not pay-to-play: a free provider is always fully listed
> and bookable, paying only buys speed/visibility.*

---

## 2. Five decisions that make this smart rather than naive

### 2.1 A sponsorship promotes a listing that already exists. It is never a banner.

A sponsorship row points at a real `res_vendors`, `res_handyman_services` or
`res_skills` row. It does not carry its own image, copy or link.

Why this matters more than it looks:

| Banner approach | Promote-a-listing approach |
|---|---|
| New content type to moderate | Nothing new to moderate — the listing was already moderated |
| Needs image hosting, sizes, review | Reuses the listing's existing fields |
| Links out to an external site (liability, users leave) | Opens the in-app profile |
| Stays up when the business is suspended | Suspended business → placement disappears automatically |
| Looks like an ad, feels foreign | Looks like the app, because it is the app |

This single decision removes about 70% of the work and most of the risk.

### 2.2 Scarcity is the product

If every business can be sponsored, being sponsored means nothing, and you can
never raise the price. So slots are **capped per suburb × category** — start at
**2**.

Scarcity gives you three things at once:
- A real sales line: *"there are two plumbing slots in Ivory Park and one is
  taken."*
- Protection for the resident: the list can never become mostly adverts.
- Room to raise prices later without changing any code — the cap lives in
  `res_policies`, tunable without a deploy.

### 2.3 Some surfaces are never for sale

Hard rule, enforced by an allowlist in code rather than by good intentions:

**Sellable:** services (handyman), vendors/spaza, skills, market.

**Never sellable:** faults and outages, panic alerts, care circle, disputes,
safety tab, notifications. Also never the *ordering* of any safety content.

A sponsored slot next to a panic alert would end the app's credibility in one
screenshot. Putting the rule in a code-level allowlist means a future
well-meaning change cannot quietly cross the line.

### 2.4 It never touches trust

Sponsorship must not grant verification, raise a reputation score, hide a bad
review, or bypass moderation. A sponsor who breaks the rules gets suspended
like anyone else, and their placement stops with them.

Good news: this is already enforced. The Guard in
`supabase/functions/res-scheduler/lib/guard.ts` forbids automation from writing
`is_verified`, `reputation_score`, `vibe_score` and `badges` at all, and there
are adversarial tests for it.

### 2.5 Version one has no payment code

`local_business_sponsorship` is priced at **R150/month** and marked
`contact_sales` in `src/utils/pricing.ts` — a negotiated sale, not a checkout
button. The `paystack-checkout` function does not list it as an item.

So: **sell it in person or on WhatsApp, take EFT, and record the placement.**
No checkout, no webhook change, no edge-function deploy.

That is not a shortcut, it is the correct order. Self-serve checkout is worth
building when you are turning away sales because you cannot process them fast
enough. You are nowhere near that, and building it first would be a week spent
on the part that isn't the risk. The risk is whether anyone pays at all.

---

## 3. Selling this honestly before you have users

This needs saying plainly, because it is the part that can go wrong in a way
that is hard to undo.

**You will be selling advertising to an audience that does not exist yet.** If a
shop owner believes they are reaching thousands of residents and they are
reaching eleven, you have taken their money under a false impression — and in a
neighbourhood where your whole product depends on being trusted, that is the
most expensive possible mistake.

The honest version is also the better sales pitch:

> *"We're launching in Ivory Park. Right now the app is new — I'm not going to
> pretend it has thousands of users. I'm offering the first businesses a
> founding rate of R150/month locked for 12 months, because you're taking the
> risk with me. You'll be the first plumber people see when it grows."*

That is truthful, it explains the low price, and it creates the urgency the
inflated version was faking. Concretely:

- **State current usage honestly** when asked. Never estimate upward.
- **Sell a founding rate**, locked 12 months, first ~10 businesses.
- **Month-to-month, cancel anytime.** Nobody is locked into something that
  isn't working for them.
- **No performance promises.** Sell presence and locality, not clicks.

---

## 4. What gets built

### Phase 1 — Placement (the only phase that matters right now)

**A table.** `res_sponsorships`:

| Column | Why |
|---|---|
| `subject_table` + `subject_id` | Which listing is promoted (§2.1) |
| `sponsor_user_id` | Who owns it |
| `suburb`, `category` | Where it is bought |
| `slot` | Which of the capped positions (§2.2) |
| `starts_at`, `ends_at` | The term |
| `status` | `pending → active → expired / cancelled` |
| `rate_zar_cents`, `payment_note` | What was agreed, and how it was paid (EFT ref) — **a record, not a balance** |
| `sold_by`, `created_at` | Who sold it |

Money note: `rate_zar_cents` records *what was agreed off-platform*. The app
still holds no balance and moves no money, so `CONTRACT.md` §6 is intact. The
Guard's forbidden-column list should gain `rate_zar_cents` so no job can ever
change an agreed price.

**Slot configuration** in `res_policies`, so caps and sellable surfaces are
tunable without a deploy:

```
sponsorship.slots      → { "maxPerSuburbCategory": 2 }
sponsorship.surfaces   → { "allowed": ["services","vendors","skills","market"] }
```

**A read path.** One function returning the active sponsored listings for a
given suburb + category, filtered to listings that are still live and not
suspended.

**A UI slot.** Sponsored entries at the top of the list, with:
- a permanent, non-dismissible **"Sponsored"** label (required by SA
  advertising rules, and the thing that keeps residents trusting the list)
- visually part of the app, not a foreign ad block
- the organic list below completely unchanged

**An expiry job.** `expire_sponsorships` — runs daily, moves `active → expired`
at `ends_at`, and notifies you a week before so you can renew. This slots
straight into the scheduler, transitions, audit log and kill switch that
already exist. It is maybe thirty lines.

**Admin = SQL.** You create rows in the Supabase SQL editor. No admin UI in
phase 1. When you have more than ~15 sponsors, that stops being reasonable and
we build a small screen.

### Phase 2 — Proof for the sponsor (only after the first renewal conversation)

Sponsors renew when you can answer *"what did I get?"*

- **Count profile opens from the sponsored slot.** One daily aggregate row per
  sponsorship. **No per-user tracking** — a count, never a list of who looked.
  That keeps it POPIA-clean and cheap.
- **A monthly line** you can send on WhatsApp: *"38 people opened your listing
  from the sponsored slot in March."*

Deliberately not impressions — more writes, less meaning, and "38 people opened
your page" is a better sentence than "1,200 impressions".

### Phase 3 — Self-serve checkout (only if sales outpace you)

Add `sponsorship` to the `paystack-checkout` item list, write to
`res_subscriptions` with `product='sponsorship'`, and let a business buy an open
slot themselves. Requires an edge-function deploy, which is yours to do.

**Do not start here.**

---

## 5. Risks, and what handles each

| Risk | Handling |
|---|---|
| Selling reach that doesn't exist | Honest founding-rate pitch (§3). State real numbers when asked |
| The list becomes mostly ads | Cap of 2 per suburb × category, in policy |
| Sponsorship creeps onto safety surfaces | Code-level allowlist, not a guideline |
| A sponsor expects preferential treatment | Written into the offer: position only. Moderation and trust are untouched |
| Sponsor is suspended but still promoted | Read path filters to live listings only |
| Placement outlives the payment | `expire_sponsorships` job + a renewal reminder |
| Undisclosed advertising | Permanent non-dismissible label |
| A job silently changes an agreed rate | Add `rate_zar_cents` to the Guard's forbidden columns |
| It doesn't sell at all | You find out in a week, for a day of work — which is the point of this order |

---

## 6. What this is worth

R150/month × 10 businesses = **R1,500/month**. That is not a business yet.

What it actually buys you is the answer to the only question that matters right
now: **will a local business pay for a place in this app?** If ten say yes, the
R500/month infrastructure-partner tier and the R2,500 insights report become
credible conversations. If ten say no, you have learned that for one day of
work instead of building an entire advertising stack first.

---

## 7. Order of work

1. **Decide the offer** — surfaces, cap, price, term, what a sponsor gets. No
   code. (You)
2. **Migration + read path + expiry job.** (Me — small)
3. **Sponsored slot in the services and vendors lists, labelled.** (Me — small)
4. **Sell to two businesses you already know.** (You)
5. Only then: counters, statements, self-serve checkout.

Steps 2 and 3 are genuinely small because they reuse the scheduler, transitions,
audit log and policy tables that already exist. Step 4 is the one that decides
everything.
