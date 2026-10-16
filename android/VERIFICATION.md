# HAL Desk 2.0 verification — 16 October 2026

## Passed

- 21 original financial/contract checks: exact expiry and strike, quantity calculations, missing/zero marks, date validation, lot mismatch, quote age and shared-expiry payoff.
- 15 new analytics/accounting checks: a known Black–Scholes put value, mixed-expiry horizon limits, missing IV and contract mismatch, signed unit-based delta/theta, expiry gaps, stale Greeks, partial-close accounting, premiums/costs/settlement separation, import sanitization, completed candles, indicator boundaries, news grouping and period-matched financial ratios.
- Bundled UI end-to-end test in Chromium: v1 migration, five screens, chart drawing, financial-basis switching without losing news, scenarios, partial closes, settlement accounting, safe CSV, backup validation/import, bookmarks, dark/light appearance, 320/390/768 px layouts and enlarged text, offline errors, persistence and chart reset. Synthetic fixtures only.
- 39 Python backend tests including new viewer-auth, read-only allowlist, redirects, RSS filtering/entity rejection, partial research failures, token-rotation cache and exact option lot/bid schema checks.
- 16 existing web JavaScript regression tests.
- Three live official NSE RSS feeds fetched and parsed. The sampled feed window contained no matching HAL items; the announcements feed contained 706 total company items.
- Android SDK 35 / build-tools 35.0.0 shell build; package `in.smkt.haldesk`, version code 2, min SDK 26, target SDK 35. APK alignment and v2/v3 signatures verify. Update certificate matches the earlier v1.0 delivery.
- Reviewed phone screenshots for dark/light overview, risk, market chart and fundamentals. QA screenshots and synthetic data are not distributed in the app.

## Remaining limits

No physical Android device or emulator was available. Authenticated Upstox feeds were implemented against official API contracts and tested with offline fixtures, not a live account token. Android document-picker interaction and actual device upgrade are compiled but require a first run on the user's phone. No token is embedded in source, fixtures or APK. Backend CI also runs the Android pure calculation tests; the Playwright UI suite was run locally.

Native code emits Android API deprecation warnings for compatibility methods, with no compilation errors. The optional Gradle build route was not run. The new server endpoints are supplied in a pull request, not deployed by the Android APK.
