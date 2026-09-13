# Design system — when to use what

Item 199 of `docs/DESIGN-OVERHAUL.md`. Short on purpose: a reference nobody
reads is the same as no reference. Everything here is enforced by a test, and
the test is named, so you can find out what will fail before you push.

## The one rule

**Never write a raw colour, duration or tap-target size.** Every one of them
has a token, and every one of them is checked in CI. This is not a style
preference — each rule below exists because its absence shipped a real defect.

| Don't | Do | Enforced by |
|---|---|---|
| `#1A1712`, `rgb(26,23,18)`, `text-black` | `text-content`, `bg-surface` | `src/styles/noRawColour.test.ts` |
| `duration-300`, `duration-700` | `motion-fast` / `motion-base` / `motion-slow` | `src/components/ui/components.test.ts` |
| `py-1.5` as a button's only height | `min-h-[44px]`, or the `Button` component | `src/components/ui/tapTargets.test.ts` |
| A colour that is the only signal of state | a colour **and** an icon or label | `states.test.ts`, reviewed by hand |

## Components

Everything below lives in `src/components/ui/`.

| Need | Use | Notes |
|---|---|---|
| Any action | `Button` | Four variants: `primary` (one per screen), `secondary` (the default), `tertiary` (must not compete — Cancel, Skip), `destructive`. `loading` disables as well as spins. |
| A person | `Avatar` | Initials fallback is the normal case, not the edge case — most residents never upload a photo. |
| A status, tier or category | `Badge` | Pass an `icon`. Colour alone is invisible to a colour-blind resident and in daylight. |
| A text input | `Field` | Real `<label>`, validation on blur then live. Never a placeholder standing in for a label. |
| Switching between views | `Tabs` | A real tab list: roving tabindex, arrow keys. |
| Two or three exclusive choices | `SegmentedControl` | For choices, not navigation. |
| Searching a list | `SearchInput` | Debounced, with a clear button. |
| A dialog or sheet | `Modal` | Traps focus, restores it to the opener, closes on Escape. Sheet on phone, dialog from tablet up. |
| Numbers | `StatTile` + `StatGrid` | Two-column grid; an odd last tile spans both. |
| A page or section heading | `PageHeader` / `SectionHeader` | One `<h1>` per page, and it always has text. |
| Nothing to show | `EmptyState` | **Pick the right variant.** See below. |
| Content is loading | `SkeletonList` + `useMinimumDuration` | Not a bare spinner. |
| A gate | `GatedNotice` | `guest` or `unverified`. Never express a gate as an absence. |

## The four empty states, and why it matters

`EmptyState` takes a `variant`, and choosing the wrong one makes the app lie:

- `empty` — there genuinely is nothing yet. Encourage creating the first thing.
- `filtered` — there is content, the filter excludes it. Offer to clear it.
- `error` — the request failed. Offer a retry.
- `offline` — no connection.

The gossip feed rendered "Nothing posted yet" whenever its fetch threw, so a
resident was told their neighbourhood had gone quiet when the app had simply
failed to ask. That is the failure this exists to prevent.

## Anything that waits on the network

Three things, every time, or a control strands permanently:

1. Set the busy flag.
2. Clear it in a **`finally`** — not at the end of the function. A rejected
   request never reaches the end.
3. Wrap the await in **`withTimeout()`** (`src/utils/resilientCall.ts`) or an
   `AbortController`. A `finally` runs when a promise *settles*; one that
   never answers never settles, and the loader stays up forever.

`src/utils/noPermanentSpinner.test.ts` enforces all three. It keys on the
*name* of the flag, so if you invent a new word for "busy", add it to
`BUSY_FLAG` there — four real bugs hid behind words it had not been taught.

## Motion

150–250ms, on `transform` and `opacity` only — anything else forces layout on
a low-end Android. Reduced motion has one global backstop in `globals.css`; do
not add per-component guards. Haptics (`src/utils/haptics.ts`) reinforce
feedback that already exists visually, and never carry it alone — iOS Safari
has no support at any version.

## Honesty rules

These are not style. They are the recurring defect in this codebase:

- **Never promise a timeframe the system cannot keep.** No "reviewed within 24
  hours" unless something actually reviews within 24 hours.
- **Never show a number you cannot source.** A made-up badge count is worse
  than no badge — that is why Gossip has none.
- **Absent and zero are different claims.** A missing score rendered as `0`
  tells every neighbour this person scored zero.

## Run the project's own checks, not your own approximation of them

`npm run lint` — not `npx eslint src/`. They are not the same command and they
do not report the same thing. I ran the second one all session, saw "0 errors",
pushed, and CI failed on an error the project's own config catches and mine
did not. The gate before a push is exactly this, in this order:

```
npx tsc --noEmit && npm run lint && npm test && npm run build && node scripts/smoke.mjs
```

The smoke suite needs a free port and a Chromium path in some environments:
`SMOKE_PORT=3100 CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/smoke.mjs`.

## Changing a colour

Edit `scripts/gen-tokens.mjs` and run `node scripts/gen-tokens.mjs`. Never edit
`src/styles/tokens.css` by hand — it is generated, and the dark palette has to
appear in two places that must not drift. `src/styles/tokens.test.ts` re-checks
every foreground/background pair against WCAG AA on every run.
