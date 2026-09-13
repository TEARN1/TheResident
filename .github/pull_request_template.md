## What this changes

<!-- One or two sentences. What behaviour is different afterwards? -->

## Why

<!-- The problem, not the solution. If it fixes a defect, say what a user
     experienced before this. -->

## Design review

Required for any change that renders something. Delete this section only if
the change is server-side or tooling with no UI at all.

- [ ] Screenshot at **320px** (the narrowest phone still in real use here)
- [ ] Screenshot at **390px**
- [ ] Checked in **both themes** — light and dark
- [ ] No raw colours, durations, or sub-44px tap targets (`npm test` covers these)
- [ ] Empty, loading and error states all render — and say different things

## Verification

<!-- What you actually ran, and what it said. "Tests pass" on its own is not
     verification; name the failure you reproduced first, if there was one. -->

- [ ] `npm run lint` — the project's own command, not `npx eslint <path>`; they differ
- [ ] `npm test`
- [ ] `npx tsc --noEmit`
- [ ] `npm run build`
- [ ] `./sql-tests/run.sh` (if any SQL changed)
- [ ] Driven in a real browser — tests and a build do not render a component

## Anything you are unsure about

<!-- Better here than discovered in review. -->
