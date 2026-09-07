# The database is in Ireland. The users are in South Africa.

## The decision, up front

**Move the project to `af-south-1` (Cape Town) now, before launch.** The cost
of moving is as close to zero as it will ever be, and it only ever rises from
here.

This is one of the few decisions in the whole system that gets *harder* every
week rather than easier, which is why it is written down rather than left as
a note at the bottom of the disaster-recovery doc.

## What it costs today

Measured against the live project, not estimated:

| Table | Rows |
|---|---|
| `res_profiles` | 2 |
| `res_properties` | 1 |
| `res_gossip_posts` | 2 |
| `res_listings` | 0 |
| `res_rooms`, `res_room_requests` | 0 |
| `res_home_areas` | 0 |
| `res_service_reports` | 0 |
| `res_org_units`, `res_org_broadcasts`, `res_area_broadcasts` | 0 |
| `web_push_subscriptions` | 12 |

That is the entire production dataset. A migration today is a dump, a fresh
project, and a schema apply — the exact procedure already written and tested
in `docs/DISASTER-RECOVERY.md` §3, and already proven to work by
`scripts/restore-drill.sh` running in CI on every push.

The honest framing: **there is nothing to lose yet.** Everything hardened
over the past weeks was hardened before there were users to harm, which is
the right order — but it also means the constraint on moving is not
technical, and will not be technical until real residents are on it.

## What it costs later

Every one of these grows monotonically:

- **Data volume.** A dump/restore of a few rows is instant. A dump/restore of
  a live neighbourhood app with photos, gossip history and tenancy records is
  a maintenance window you have to announce.
- **Downtime tolerance.** Nobody notices an outage today. Once a landlord is
  fielding room requests through the app, they do.
- **Push subscriptions.** The 12 rows in `web_push_subscriptions` are tied to
  endpoints, not to the region, so they survive — but the number only grows,
  and each one is a person who signed up expecting to be reached.
- **POPIA.** Cross-border transfer of South African personal information is
  answerable now with "two test accounts". It is a different conversation
  once there are thousands of records, and a much worse one to have for the
  first time under scrutiny.

## What it buys

- **~150–180 ms saved on every single request**, before anyone's mobile
  network is accounted for. Cape Town to Johannesburg is single-digit
  milliseconds; Johannesburg to Ireland is not. This is not a percentage
  improvement to a fast app — it is a fixed tax on every interaction, paid by
  users on the worst connections.
- **The POPIA question answered by geography** rather than by argument.
- **A clean story for officials.** A ward councillor or municipality asking
  where residents' data lives is a question this feature set invites, and
  "in South Africa" is a materially better answer than the alternative.

## What it does not fix

Latency to the database is not the same as latency to the app. The Next.js
deployment's region matters too, and moving one without the other trades one
long hop for another. Both should land in or near `af-south-1`.

## Why this is not already done

It needs a Supabase project created under an account and billing plan, which
is not something this repository can do on its own. The procedure is written,
the schema rebuild is tested continuously, and the verification checklist
already exists in `docs/DISASTER-RECOVERY.md` §4.

The blocking step is a decision, not an engineering task — and the right time
to take it is while the table above still reads mostly zeroes.
