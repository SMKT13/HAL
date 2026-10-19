## v2.6 position desk — 2026-10-19

- 15 new pure-engine regressions plus a native asset-route contract check cover profile migration/validation, per-leg clocks/units, accounting, model-to-model shocks, futures cash/reserve separation, stale/future funding, confirmation edits/expiry, trigger gates, failed/pending feeds, missing IV and nonmutation.
- New Chromium desk suite covers four destinations, limits/confirmation/funding, trigger rendering, immediate refresh withholding, Plan navigation, consented AI evidence/research privacy, edited-book invalidation, persistence/backups, 320/390/768px dark/light and enlarged text.
- Existing Android UI/AI/intelligence, React browser regression, Python/TypeScript and Android calculation suites pass. TypeScript and Vite build pass.
- Native Gemini checks: 59 request-policy and 99 transport/response checks pass with mocked HTTPS.
- SDK35 APK build succeeds: package `in.smkt.haldesk`, version code 9/name 2.6; original certificate SHA-256 `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`; alignment and APK v2/v3 signatures checked.
- Today screenshots in both themes inspected locally. All test quotes, lot units, holdings and headlines are synthetic.
- Not verified: physical-phone install/upgrade, background timing, user Upstox/Gemini credentials/entitlements, current holdings or live market results. No live-provider or trading-performance testing claim.

# HAL Desk 2.5 intelligence and rollover verification — 18 October 2026

- 149 backend/calculation checks pass: 48 Python, 21 Node/TypeScript, 21 original Android core, 39 analytics/hedge and 20 new intelligence checks. TypeScript checking and the production React build pass.
- New pure intelligence checks cover close/one-lot/target-lot routes, immutability, fee/slippage reconciliation, post-exit funding without double sale credits, carry exposure, missing/zero limits, matching-expiry floors, earlier/later put expiry boundaries, stale/future/missing clocks, depth, aggregated old-put sales, exact lot coverage, failed required chains, saved-setting migrations, checkpoint privacy and same-book comparisons. Pattern tests verify no overlapping full outcome windows, outcomes strictly before the query, price-unit invariance, incomplete/future-bar exclusion and missing/stale/flat/discontinuous history withholding.
- All four Chromium suites pass: React, original native assets, direct Gemini, and new intelligence flows. New UI checks cover checkpoints, shape overlays, synthetic AI evidence, sharing consent, private-text exclusion, research-mode separation, failed/pending history invalidation, saved plans without position mutation, expiry gaps, clock-driven quote expiry, reload persistence, 320/390/768px layouts and enlarged text. Dark rollover and light pattern screenshots were inspected.
- 59 Java policy and 99 native REST mock checks pass. The evidence limit expands to 24,000 characters; request caps remain bounded. Direct Google API, encrypted native credentials, key-paste handling, cancellation, safe output and fixed destination policies are retained. No live model or broker call is used by these tests.
- SDK 35 signed build passes for package `in.smkt.haldesk`, version 2.5/code 8. Alignment and v2/v3 signatures verify against the original signing certificate. The asset origin remains unchanged for update compatibility. Signing files and test fixtures are excluded from the APK and Git.

Limits: no Android phone/emulator or user Gemini/Upstox credential is available here. Installation, live quote permissions/depth and current provider quota still need a phone check. Financial tests use synthetic prices and lot sizes; no live best-put or trade recommendation is claimed. No Render deployment, broker order, automatic rollover or position edit occurs. Historical matches are selected observations, not a forecast, option backtest or validated strategy. Broker margin and interim cash calls remain outside the terminal payoff calculation. The optional Gradle build was not exercised.

# HAL Desk 2.4.1 key-paste verification — 18 October 2026

- 59 Java policy checks pass, including standard-style and long dotted synthetic keys, leading/trailing and wrapped whitespace, non-breaking/invisible separators, quote wrappers, empty-input retention, 8,192-character boundary, oversized/incomplete input and unsupported control/non-ASCII rejection.
- 99 native REST client checks pass using a synthetic 600+ character dotted authorization-style key. The complete key reaches only the HTTPS header, with no body leakage, URL credential, redirection or stale cancellation result. No live provider call is made.
- SDK 35 signed build passes for version 2.4.1/code 7. APK alignment and v2/v3 signatures verify with the original certificate. The native field no longer truncates at 256 characters; paste cleanup happens before validation and encrypted storage.
- The AI asset browser regression suite remains passing. Native clipboard/paste and a live user-key call still require a phone check; no physical device/emulator or user key was available here.

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

