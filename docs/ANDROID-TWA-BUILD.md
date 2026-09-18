# Android build — Trusted Web Activity, not Expo/EAS

A request came in describing an EAS-built `.aab` for `com.thegruvs_tearn`
(versioned, signed, with a Firebase config and a native crash fix). That
belongs to **The Gruvs' own native codebase** — this repo is `the-resident`,
a Next.js PWA with no Expo, no React Native, and no native Android project at
all. Nothing here can produce that specific artifact, and EAS wouldn't be the
right tool for this repo even if it could: EAS builds Expo/React Native apps,
and this is neither.

This document is the real path for **this** app: wrapping the existing PWA as
a genuine Android app using **Bubblewrap** — Google's own tool for exactly
this, free and open-source, no cloud build service, no subscription. It
produces a real Android Studio/Gradle project you build locally into a signed
`.aab`.

**What I could not do myself**: this sandbox has no JDK, no Android SDK, and
no Gradle (`java -v`, `sdkmanager`, `gradle` all resolve to nothing here). I
scaffolded every file Bubblewrap needs and cannot fabricate the parts that
only exist once you run it — a signing key and its fingerprint. Those steps
are commands for you to run locally or in CI, not something written into the
repo.

## What's already in the repo

| File | Purpose |
|---|---|
| `twa-manifest.json` | Bubblewrap's config — app id, colours, icon, shortcuts. `packageId: com.theresidentcrew.twa` is a **placeholder** — it's permanent once published, confirm the real one before your first real build. |
| `public/.well-known/assetlinks.json` | Digital Asset Links — proves to Android that this domain and that app belong to the same person. Ships with a placeholder fingerprint; **the TWA will show a browser URL bar until this is replaced with the real one** (see step 3). |
| `.gitignore` | Excludes `*.keystore`, `*.jks`, `key.properties`, `/android/` — a leaked upload key can't be revoked like a password; the fix is re-keying through Play App Signing, which is disruptive. Never commit the keystore. |

## Prerequisites (install these yourself — none exist in this sandbox)

- Node.js (already required by this repo)
- JDK 17
- Android SDK command-line tools (`sdkmanager`, accept the licenses)
- The app deployed and reachable over HTTPS at the `host` in `twa-manifest.json` — Bubblewrap fetches the live `manifest.json` and service worker from that URL, it doesn't build from local files

## Steps

### 1. Confirm the real domain and package id

Edit `twa-manifest.json`:
- `host` — must be the actual production domain (Vercel or wherever this deploys)
- `packageId` — **cannot change after your first Play Console upload.** Decide it for real now.

### 2. Generate the project and a signing key

```bash
npx @bubblewrap/cli init --manifest ./twa-manifest.json
```

This asks a few questions and, on first run, offers to generate
`android.keystore` for you. **Back that file up somewhere outside this repo
and never commit it** — Play Console will refuse every future update signed
with a different key.

### 3. Get the real fingerprint and fix assetlinks.json

```bash
keytool -list -v -keystore android.keystore -alias android
```

Copy the `SHA256:` fingerprint it prints, and replace the placeholder in
`public/.well-known/assetlinks.json` with it (colon-separated hex, exactly as
`keytool` prints it). Deploy that change — the file has to be live at
`https://<host>/.well-known/assetlinks.json` before the TWA will render full
screen. Verify it with Google's own checker:

```
https://developers.google.com/digital-asset-links/tools/generator
```

Until this is done correctly, the app opens but shows a Chrome address bar —
that's Android telling you ownership isn't verified yet, not a bug.

### 4. Build the signed `.aab`

```bash
npx @bubblewrap/cli build
```

Output: `app-release-bundle.aab` — the actual file Play Console accepts.
`npx` fetches Bubblewrap on demand rather than adding it as a project
dependency, so it costs nothing to have this documented even before anyone
runs it.

### 5. Play Console

Google's own one-time developer registration fee (currently $25, paid to
Google, not to us or any service this app depends on) applies regardless of
which tool builds the `.aab` — Bubblewrap doesn't remove it, nothing does.
Beyond that, this path adds no recurring cost: no EAS build minutes, no
cloud-build subscription.

Real icons matter here too — see the "still missing" note in
`docs/RUNBOOK.md` about the single 768×768 `logo.png`: a maskable variant
with real safe-zone padding should exist before a real store listing, or the
adaptive-icon shapes Android applies will clip it.

## Notifications

`enableNotifications: true` is set in `twa-manifest.json` because the map
layer already asks for permissions the TWA shell needs to broker (location,
per `features.locationDelegation`). Web Push through a TWA additionally needs
a Firebase Cloud Messaging sender ID wired into the generated Android project
— that's a real Firebase project you'd create, not something to fabricate a
placeholder for. Leave it disabled in the store listing until that's set up
for real, rather than shipping a permission that silently does nothing.
