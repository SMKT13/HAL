# HAL Desk 2.3 local AI verification — 18 October 2026

- Existing 128 backend/calculation checks, TypeScript checks, production web build and existing React/native browser suites pass.
- Local AI browser tests run with networking disabled after loading the bundled assets. They verify no remote requests or credential fields, evidence calculated by the shared engine (including known P&L/charges/quantity), private-text exclusion, three local modes, missing quote/history values, safe text/sources, question/mode/book races, stop/timeout handling, rejection of remote-style responses, model setup/progress/cancellation, persistence and responsive dark/light/enlarged-text layouts.
- 41 pure-Java checks cover allowed download hosts, model/prompt bounds, unknown/stale evidence, container headers and atomic model import. Failed checksum/size, malformed header and cancellation before/during import preserve the previous file. Temporary test weights exercise file transfer only and are not inference models.
- The actual LiteRT-LM 0.18.0 AAR and transitive jars are bundled, with SHA-256-pinned downloads. D8/R8 9.1.56 supports the runtime's Kotlin 2.4 metadata. JNI libraries, Kotlin resources and service-loader files are packaged. Model weights are not part of the APK.
- APK package remains `in.smkt.haldesk`, version code 5/name 2.3, with the original asset origin. The build uses the existing private signing identity for upgrade compatibility.
- The optional default-model download is pinned to a public Qwen3 CPU model revision (344,671,744 bytes). Its Hugging Face metadata, SHA-256 and initial LiteRT-LM header were verified independently. This check did not download the complete model or run it.

Limits: no Android device/emulator was available, and actual local inference, model download/import through Android's UI, memory usage, speed and installation have not been exercised on a phone. Browser tests use a synthetic native bridge; they do not establish real model quality or device compatibility. Native classes compile against the actual runtime, but a successful build is not an inference benchmark. Normal Java deprecation warnings remain. Live Upstox feeds were not tested with the user's token.

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
