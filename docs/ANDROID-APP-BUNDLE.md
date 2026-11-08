# Android App Bundle (`.aab`) Build & Play Console Guide

The Resident is packaged for Google Play as a **Trusted Web Activity (TWA)** using Google's official `androidbrowserhelper` and `locationdelegation` libraries.

## Generated Artifacts

| File | Purpose |
| --- | --- |
| `the-resident-release.aab` | Signed release Android App Bundle ready for Google Play Console upload (copied from `android/app/build/outputs/bundle/release/app-release.aab`). |
| `android/upload-keystore.jks` | Upload signing keystore (PKCS12, RSA 2048, alias `upload`). **Gitignored — back this file and `android/key.properties` up securely outside the repo.** |
| `android/key.properties` | Keystore credentials consumed automatically by `android/app/build.gradle` during release builds (gitignored). |
| `public/.well-known/assetlinks.json` | Digital Asset Links binding `https://theresidentcrew.com` to `com.TheResidentCrew.app` so Android hides the browser address bar. |
| `android/play-store-icon-512.png` | 512×512 opaque PNG store listing icon required by Google Play Console. |

## Build Metadata

- **Application ID (`package_name`)**: `com.TheResidentCrew.app`
- **Version**: `1.0.0` (`versionCode 2`)
- **SDK Levels**: `minSdk 24` (Android 7.0+) / `targetSdk 36` / `compileSdk 36`
- **Upload Certificate SHA-256**:
  `51:54:F7:28:1B:C5:44:FE:8C:8B:4E:33:C4:48:E7:DA:24:47:F4:58:77:56:48:51:4E:60:F7:C3:38:06:EA:AF`

## Rebuilding Future Releases

1. Bump `versionCode` (must increment by at least `1` on every Play Console upload) and `versionName` in `android/app/build.gradle`.
2. Run:
   ```powershell
   npm run build:aab
   ```

## Important Before Going Live on Google Play

1. **Back up `android/upload-keystore.jks` and `android/key.properties` immediately.** If you lose your upload key, Play Console requires an upload-key reset before you can ship updates.
2. **Deploy `public/.well-known/assetlinks.json` to `https://theresidentcrew.com/.well-known/assetlinks.json`.** Once Google Play App Signing is enabled in Play Console (**Setup → App signing**), copy Google Play's **App signing key certificate SHA-256 fingerprint** and add it as a second string inside `sha256_cert_fingerprints` in `public/.well-known/assetlinks.json` so Play-signed installs verify full-screen automatically.
