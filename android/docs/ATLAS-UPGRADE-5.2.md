# HAL Atlas 5.2.0 — existing-app upgrade

## What was actually changed
- Reviewed the current `main` version on 19 November 2026: **HAL Desk 5.1.0**, versionCode **34**.
- Upgraded the **same** Android project to source version **HAL Atlas 5.2.0**, versionCode **35**, with a launcher name, self-contained vector compass/market icon, colorful dark/light design and matching native dialogs, Settings, new backup filenames and user-facing financial analysis.
- The existing third bottom tab remains the `technicals` route internally but is labeled **Analysis** and defaults to **Daily Analysis**; all older technical screens, Options Lab, derivatives, indicators, pattern scanner and backtest remain available.
- The evidence-led local daily analysis introduced in 5.1 is retained: trend narrative, price levels, conditional scenarios, source timestamps, published news relevance, fundamental/benchmark context, and owned futures-versus-puts expiry risk. No Gemini key is needed for deterministic report generation.
- Fixed the five-tab nav to five equal columns, refreshed contrast and card design, and kept 44px minimum interactive controls.
- Updated release helper scripts to output `HAL-Atlas-v5.2.0-unsigned.apk` and `HAL-Atlas-v5.2.0-signed.apk`. Corrected stale 4.2.4 and versionCode 33 assertions in `scripts/verify-apk.py` and installation notes.

## Identity and saved-data preservation
The following values must **never** be renamed just because the brand is now Atlas:

| Permanent identity | Preserved value |
| --- | --- |
| Android application ID | `in.smkt.haldesk` |
| Android Java namespace | `in.smkt.haldesk` |
| Existing SQLite database | `haldesk_book.db` |
| Android credential Keystore alias | `hal-upstox-secrets-v1` |
| Signing alias | `hal-personal` |
| Required previous signing certificate SHA-256 | `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382` |
| Book and backup JSON structure | Schema 4 |
| Legacy WebView book key | `hal_desk_v4`; earlier `hal_desk_v2` remains readable |
| Actual book versus PAPER ledger | Continues to be separate |

New JSON exports include `app: "HAL Atlas"`; previous `app: "HAL Desk"` backups remain importable using the existing schema-4 validator. **No application data is automatically migrated, cleared or overwritten** by renaming the visible title.

## Safest local verification sequence (no GitHub Actions)
1. Export both the real-book JSON and separate PAPER research backup from the **installed** app. Preserve copies off the device.
2. On a trusted Windows PC, use JDK 17, Node 22, Android SDK 35 / Build Tools 35.0.0.
3. On the intended source commit under `android/`, run `npm ci`, `npm test`, `npm run test:ui`. Then run `scripts/local-windows-release.ps1` (without `-Sign`) for unit tests, browser simulations, lint, APK assembly and alignment. Never bypass failed tests.
4. Only after successful checks, sign with the **original** keystore and password file **outside the repository**. The local script accepts `HAL_SIGNING_KEY_FILE` and `HAL_SIGNING_PASSWORD_FILE`; never paste keys or passwords into a chat, issue, repository or CI.
5. Verify the output certificate fingerprint and Android `aapt` identity: label `HAL Atlas`, package `in.smkt.haldesk`, versionCode `35`, versionName `5.2.0`.
6. Install the signed APK **over** the current HAL Desk/Atlas installation without uninstalling it. Compare all positions, strikes, expiries, realised history, charges, PAPER trades, token availability and offline behavior with your exported backup. Validate live Upstox quotes separately.

## Status
This change updates **repository source**. It does **not** certify an installable APK: full local npm/Playwright/Android SDK tests, Gradle packaging, original-key signing and a physical in-place upgrade are separate acceptance steps. No GitHub Actions minutes are required or automatically used.
