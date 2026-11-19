# HAL Atlas 5.1.0 release handoff

Updated 18 November 2026 (IST). Source: `bb14ad5415a0915f948755474e17dd3e69d4e4d1` on `design/hal-atlas`. This is the first signed Atlas redesign release, not completion of every proposed design feature.

## Artifact
- Filename: HAL-Atlas-v5.1.0-signed.apk
- Application ID: in.smkt.haldesk
- Version: 5.1.0 / code 34; minimum Android 8.0 (API 26).
- APK SHA-256: `839b9fffdd7bbdcb404dd1153489546cc0fffadd1dc73cab8dd124588d95c62c`
- Original certificate SHA-256: `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`
- Signed APK delivered separately; no private signing material belongs in this repository.

## Included
- HAL Atlas branding, contour launcher icon, navy/ivory/cobalt theme.
- Today, Portfolio, Plan and Research navigation.
- Lifetime performance drill-down and isolated paper copy of held positions.
- One-lot put rollover comparison with quote-quality checks, costs and shocks.
- Named frozen comparisons, side-by-side comparison and explicit repricing.
- Explicit review baseline and missing-contract indications.
- Dated expiry/company agenda and personal in-app reminders.
- Completed-candle cursor, OHLC table, remembered timeframe selection, timestamp-matched saved contract observations and dated journal closes.

## Verification and limits
The build-session record reports 451 Node tests, 61 browser UI checks and 81 native Robolectric tests passing; lint reported 0 errors and 5 warnings. APK alignment, v2/v3 signatures, original signer and all 33 bundled web asset hashes were checked in that session.

On 18 November the published source was recovered into a separate worktree, preserving older uncommitted changes. The 451 Node tests passed again, and the Android 8-compatible web assets rebuilt successfully. A browser rerun could not start: the workspace denied Chromium socket creation (Operation not permitted); this is not a new UI pass. The temporary build/emulator environment and original logs had not survived the workspace restoration, so this document is a release-session handoff record, not a replacement for those raw logs.

**Android 8 in-place upgrade: unconfirmed.** The test started with the previous APK, but no completed result was recovered. Do not treat installation of the old APK as evidence that the new APK preserved the database. Physical-device upgrade and live Upstox/Gemini checks remain outstanding.

Lint warnings recorded in the build session concerned SecretStore synchronous commit, the API 33 back attribute, enabled WebView JavaScript, redundant drawable-v26 resources and the v26 adaptive icon's absent monochrome definition (a v33 definition exists).

No GitHub Actions were used. Older files in android/verification may describe earlier releases; do not relabel them as 5.1 evidence.

## Installation
Export both the real-book JSON and separate PAPER backup first. Install the signed APK over the existing app using **Update**, then verify positions, history, fees and paper drafts. Do not uninstall to work around a certificate conflict. See [INSTALL.md](../INSTALL.md).

## Remaining design work
Advanced Held/Watching/Next-expiry watchlists, richer partial-rollover curves, grouped rollover journal events, richer trade/expiry chart overlays and the research drawer remain future work. Personal reminders are in-app only, not Android notifications.
