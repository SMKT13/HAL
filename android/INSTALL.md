# HAL Atlas 5.1.0 — local build and upgrade instructions

Build and verify the release locally. Back up both ledgers before an in-place upgrade.

This source builds Android application ID **`in.smkt.haldesk`**, versionCode **34**, versionName **5.1.0**, minimum SDK **26**. The original signing certificate is mandatory for installing **over** an earlier HAL Desk without uninstalling or losing app data.

## 1. Back up your data

On the installed app, export the real Position/History JSON backup and keep it safely outside the device. Paper research drafts are stored independently and require their own PAPER export from Plan → Options Lab. Record the current app version, outstanding contracts and lifetime fees. **Do not uninstall the existing app.**

## 2. Build an unsigned candidate

Use Node 22, JDK 17, Android SDK 35 and Build Tools 35.0.0:

```sh
cd android
npm ci
npm test
npm run test:ui
HAL_UNSIGNED_ONLY=1 ANDROID_SDK_ROOT="$ANDROID_HOME" bash build.sh
```

The script rebuilds generated WebView assets, runs native tests and lint, assembles, and aligns `build/HAL-Atlas-v5.1.0-unsigned.apk`. A CI artifact is unsigned and cannot upgrade an existing installation.

## 3. Sign privately with the **original** keystore

Keep the keystore and password **outside** the repository, CI workflow and shared folders. The signing alias is `hal-personal`. On a trusted local workstation:

```sh
export HAL_SIGNING_KEY_FILE="/path/outside/repo/HAL-Desk-original-personal.jks"
export HAL_SIGNING_PASSWORD_FILE="/path/outside/repo/password.txt"
ANDROID_SDK_ROOT="$ANDROID_HOME" bash build.sh
```

`build.sh` uses Android `zipalign` and `apksigner`, verifies v2/v3 signatures and **refuses** to output an upgrade APK if the certificate does not match the expected SHA-256 fingerprint:

```text
a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382
```

The output is `build/HAL-Atlas-v5.1.0-signed.apk`. Signing with a new keystore—even with the same alias—does not make it upgrade-compatible.

## 4. Upgrade and verify

1. Keep the installed old HAL Desk; install the verified **signed** APK and choose **Update**.
2. Confirm the installed version shows 5.1.0 and the open futures/puts have unchanged contract identities, quantities, expiries, entry values and manual marks.
3. Check lifetime realised history, closed October trades, premium costs, charges, funding and journal counts against the exported backup.
4. Open the Options Lab and confirm saved paper drafts, opened/closed trade records and separate OI/IV history (if previously recorded). Open PAPER positions should be immutable.
5. Check offline mode; then validate live Upstox spot/futures/options, quote freshness and token-expiry handling. Confirm AI remains opt-in.
6. If installation reports a **certificate conflict**, stop. Do not uninstall or replace the app; compare the old and new APK signing certificate fingerprints first.

GitHub Actions and browser tests **do not substitute** for real-device upgrade and live-market-data checks.
