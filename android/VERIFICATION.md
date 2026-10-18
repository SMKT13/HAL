# HAL Desk 2.4 direct Gemini API verification — 18 October 2026

- Existing 128 backend/calculation checks, TypeScript checks and production web build pass. The separate web Gemini integration is retained.
- Android AI browser tests verify explicit sharing consent, app-calculated P&L/charges/quantity, private-text exclusion, three modes, missing/stale evidence, escaped model text, safe source links, question/mode/book/settings races, cancellation, quota/errors, timeout, non-persistence and responsive dark/light/enlarged-text layouts. The JavaScript page makes no external request; the native bridge handles the provider call.
- 34 pure-Java request-policy checks cover fixed HTTPS origin, model/path injection rejection, key format, prompt bounds, missing/stale evidence preservation and safe status errors. A further 99 checks run the actual native REST client with mock HTTPS: header-only key use, request JSON, no redirects/cache/tools, status errors, cancellation before/during the request, response bounds, blocked/empty/incomplete output, thought exclusion and key redaction. The checksum-pinned test-only org.json dependency is excluded from the APK.
- The Android SDK 35 shell build and APK alignment/v2/v3 signatures verify. Package remains `in.smkt.haldesk`, version code 6/name 2.4, with the original asset origin and signing certificate for update compatibility. The APK has no model weights, JNI inference libraries or AI SDK dependencies.
- The key is stored using the existing AES-GCM Android Keystore store, never in JavaScript or exports. Direct REST requests use a header rather than a URL credential; redirects, oversized replies, empty/blocked/incomplete output and thought parts are rejected or excluded. No automatic provider retries, generation on tab-open, order tools or HAL AI gateway are added.

Limits: no physical Android device/emulator or user Gemini/Upstox key was available. Browser tests use a synthetic native bridge and do not establish live provider access or answer quality. A phone check is still needed for installation, native key entry, Android Keystore, actual API/model quota and live feed permissions. Android deprecation warnings remain. The optional Gradle route was not exercised.

## Earlier 2.1 verification — 16 October 2026

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
