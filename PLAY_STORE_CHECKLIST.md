# Google Play Console readiness

Where this app actually stands today: distribution is a directly-downloaded
`public/theresident.apk` linked from the landing page (`src/app/page.tsx`),
**not** a Play Store listing — nothing here has ever gone through Play
Console. That APK's origin (which tool built it, whether it's signed, what
package name/version it declares) isn't recorded anywhere in this repo, so
treat it as unverified for a real submission rather than reusable as-is.

This file splits what Play Console actually requires into what's fixed in
this session vs. what only you can do (an account, a signing key, a build,
and a set of judgment calls Play makes you answer directly).

## Done this session

- [x] **Privacy Policy page** — `src/app/privacy/page.tsx` (`/privacy`), public,
  no login required. Content is grounded in what the app actually collects
  (CONTRACT.md's table-ownership rules, the storage/upload conventions, the
  third-party services actually called: Supabase, OpenStreetMap/Nominatim,
  Paystack), not a generic template. Play Console **requires** a working
  privacy policy URL for every app, and specifically for any app requesting
  location or account-linked data — which this one does.
- [x] **Terms of Service page** — `src/app/terms/page.tsx` (`/terms`), same
  no-login pattern.
- [x] Both linked from the landing page footer (`src/app/page.tsx`).
- [x] App icon exists at `public/logo.png`, 768×768 — large enough to derive
  every size Play Store asks for (512×512 hi-res icon, adaptive icon
  foreground/background).

## Blocked on you — cannot be done from a code session

Play Console fundamentally needs a signed Android app binary uploaded through
a browser to an account only you can create, plus a set of policy answers
that are legal/business judgment calls, not code. None of this is something
I can complete on your behalf:

### 1. Google Play Console account
- A [Google Play Developer account](https://play.google.com/console/signup)
  — one-time $25 USD registration fee, tied to a Google account you control.
- Identity verification (Google now requires this for all new developer
  accounts — a government ID and, for an organisation, business
  verification documents).

### 2. An actual installable Android app
This is the biggest gap. There is **no Android project in this repo at all**
— no Gradle, no `AndroidManifest.xml`, no Capacitor/Bubblewrap config. The
existing `public/theresident.apk` is a standalone binary with no visible
build process behind it. Two realistic paths, both requiring tools and a
signing decision I can't make for you:

- **Trusted Web Activity (recommended for a PWA like this one)** — wraps this
  existing website in a thin native shell using
  [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap) or
  [PWABuilder](https://www.pwabuilder.com/). Needs: the production URL live
  over HTTPS (already true), a `public/.well-known/assetlinks.json` file
  that binds this domain to your Android app's package name and signing
  certificate (cannot be generated until you have that certificate), and an
  Android signing keystore you generate and keep permanently — losing it
  means you can never update the app again under the same listing.
- **Capacitor** — wraps the app with more native capability (e.g. real
  background push) at the cost of a real Android project to maintain
  alongside this repo.

Either path produces an `.aab` (Android App Bundle) — Play Console requires
`.aab`, not a raw `.apk`, for all new app submissions.

### 3. Target API level
Play Console enforces a minimum `targetSdkVersion` that rises roughly every
year (as of the 2024/2025 cycle, Android 14 / API 34, with Android 15 / API
35 following). Whatever tool builds the AAB must target a current API level
— this is a build-time flag, not something fixable in this repo's own code.

### 4. Store listing content (all judgment calls, not code)
- App name, short description (80 chars), full description (4000 chars).
- **Screenshots** — at least 2, ideally 4–8, per supported device type
  (phone required; tablet/Chromebook optional). These have to be real
  captures of the running app; I can't generate a signed build to screenshot
  from without the tooling in §2.
- **Feature graphic** — 1024×500 banner image for the store listing.
- **App icon** — 512×512 PNG, no alpha channel. `public/logo.png` can be
  resized down to this once you're producing store assets, but Play wants
  it uploaded as a distinct file, not referenced from the running app.
- Category (likely "Lifestyle" or "Communication"), contact email, and (if
  you have one) a support website.

### 5. Data Safety form
Play Console requires you to declare, inside its own UI, every category of
data the app collects and why, matching what `src/app/privacy/page.tsx`
already documents in prose:
- **Location** (approximate + precise) — collected, user-initiated, not sold.
- **Personal info** (name, email) — collected for account creation.
- **Photos/videos** — collected, user-submitted content.
- **Messages** — collected (in-app DMs).
- **Financial info** — NOT collected directly (Paystack processes payment
  details; this app never sees card numbers).
- Whether data is encrypted in transit (yes — HTTPS via Vercel/Supabase) and
  whether users can request deletion (yes — see the account-deletion edge
  function referenced in `SECURITY.md`).

I've listed the categories above from what this codebase actually does, but
Play's own form has to be filled in by you inside Play Console — it's tied
to your developer account and isn't reachable via an API from here.

### 6. Content rating questionnaire
Answered inside Play Console (IARC questionnaire) — covers violence, user-
generated content, user-to-user communication (this app has DMs and public
posts, both relevant), and location sharing. Likely lands around "Teen" or
similar given open messaging and user-generated content, but that's Play's
call to make from your answers, not something to pre-decide here.

### 7. Closed testing requirement
Google now requires new developer accounts to run a closed test with **at
least 12 testers for 14 continuous days** before an app can go to production
on Play. Budget for that timeline before assuming this can go live quickly
once the AAB exists.

## Suggested order

1. Register the Play Console account and start identity verification (§1) —
   this alone can take days, so start it first regardless of anything else.
2. Pick a wrapping approach (§2) and get a signed AAB building — this is real
   engineering work outside this repo; happy to help design the Capacitor/TWA
   setup once you've decided which and can run the Android tooling somewhere
   (this sandboxed session has no Android SDK).
3. Once you have a signable build, come back and I'll generate
   `public/.well-known/assetlinks.json` from your package name + certificate
   fingerprint, and help produce app-icon variants at the exact sizes Play
   wants.
4. Fill in the Data Safety form (§5) using this file's §5 as a starting
   answer key — verify it still matches the app before submitting.
