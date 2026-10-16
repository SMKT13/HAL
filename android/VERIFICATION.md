# HAL Desk 2.1 verification — 16 October 2026

## Passed

- 21 original financial/contract checks and 15 existing analytics/accounting tests.
- 20 new hedge tests: exact lots, ask-based cost, bid-based sale proceeds, no sale-credit P&L double count, entry-basis reconciliation, budget before credits, loss constraints, deterministic categories/deduplication, non-divisible lots, saved contract mismatches, stale/missing/future timestamps, old trades, crossed/wide quotes, depth/volume/OI, missing Greeks/IV, aggregated existing-put depth, mixed-expiry stopping rules, December/November gap warning, incomplete expiry feeds, futures basis at expiry, saved-setting compatibility and invalid settings.
- 46 Python backend tests, including 7 new hedge feed tests for quote timestamps/depth, 100-key batches, HAL/PE/strike/expiry identity verification, immutable snapshot cache, absent quotes, failed feeds, validation and token-aware cache. Timestamp strings with unknown timezone are unavailable rather than treated as fresh.
- 16 existing web JavaScript regression tests.
- Chromium UI suite: earlier v1 migration, all five screens, chart/news/accounting/import flows, plus fresh hedge shortlists, exact cash explanation, scenario selection, no book mutation, per-expiry failure withholding, timer-based staleness withholding, no-match state, settings in backups, responsive 320/390/768 px layouts and enlarged text. Synthetic fixtures only.
- Inspected dark phone screenshots for the hedge controls, shortlist and comparison. QA data and screenshots are excluded from the APK and Git.
- Android SDK 35 / build-tools 35.0.0 shell compilation; package `in.smkt.haldesk`, version code 3 / name 2.1, minimum SDK 26, target SDK 35. APK alignment and v2/v3 signatures verify. Signing certificate matches both earlier releases.
- Fixed read-only GET destination policy and unchanged WebView storage origin. No order endpoints, broker positions, tokens or signing keys added to repository or APK assets.

## Limits

No physical Android device or emulator was available. Authenticated Upstox full quotes are implemented against official API contracts and covered by offline fixtures; they were not fetched with the user's token here. First-device upgrade, actual token permissions, broker depth availability and Android document-picker behavior still need a phone check. The optional Gradle route was not used.

Java compilation retains compatibility/deprecation warnings but no errors. The new server endpoint is supplied as source; the APK does not merge or deploy it. Direct mode uses the native implementation independently. Rankings are model comparisons under entered assumptions, not guaranteed fills, maximum losses or forecasts.
