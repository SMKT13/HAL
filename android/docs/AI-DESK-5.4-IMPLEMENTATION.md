# HAL Atlas AI Desk 5.4 — implementation audit (21 Nov 2026)

## Branch and rollback boundaries
- Development-only branch: `feature/hal-atlas-ai-desk-5.4.0`
- Based on `rebuild/hal-atlas-5.3.0` at `651146da203d9108d60a9728d07ee3546a66459b`.
- Keep `main`, `rebuild/hal-atlas-5.3.0`, and `restore/hal-atlas-5.3.0` untouched.
- Existing build identity remains `in.smkt.haldesk`, 5.3.0, versionCode 59 **while changes are under development**. Assign a strictly higher code for the first release candidate after full verification.
- The source branch is NOT a replacement for the pinned 5.3.0 restore APK/source. Do not install this work as a downgraded replacement or clear device storage.

## Implemented in this branch (development slice)
1. Added `ai-intelligence5.js` as a pure local classification, smart-evidence and priority module. Source is included before `ui4.js` by the asset builder.
2. Added adaptive Daily Brief with Market, Position/Hedge, Recovery, News, What Changed and Next Review entry points.
3. Split AI Desk internal navigation into Brief, Ask Atlas, Deep Research, while retaining legacy finance engines and native key settings.
4. Smart context selection excludes private portfolio evidence from market-only/research questions even when the source packet contains saved positions. A comprehensive Daily Brief can include approved financial context.
5. Connected the existing six-role `AgentDesk` to Android's actual Gemini request path, with stage-progress events, six-request consent disclosure and source schema alignment.
6. Preserved role summaries through bounded sanitization so Bull, Bear and Risk Chair stages can consider earlier analysts.
7. Added a separate AndroidKeyStore AES-GCM encrypted AI history store. Ordinary saved reports expire after 90 days; pinned reports remain until manual deletion. Includes native bridge methods and history read/pin/delete/clear UI.
8. Added independent test inputs for JS context/privacy/priority and Java 90-day retention policy, with native test-script registration.
9. Added encrypted conversation IDs, opt-in follow-up context, native revision-scope filtering, and an exact-payload equality check before Android sends approved previous turns.
10. Corrected 90-day expiry to apply to the last activity of an ordinary conversation rather than deleting individual turns mid-discussion. Removed silent record truncation on storage limits.
11. Added a structured Gemini response schema for Brief and Ask Atlas (not the six short role calls), validation of required sections and citations against the approved source URLs, plus sectioned screen rendering.
12. Added a manually triggered read-only model metadata check. It does not generate text, use portfolio evidence, or silently switch model IDs.
13. Fixed the 'fresh' versus 'current' quote-status mismatch; added cautious, labeled calendar-day expiry review when a verified NSE session count is not provided.
14. Added private `NativeAiDeskActivity` (Compose) with Brief, Ask Atlas, Deep Research and expandable encrypted history. The native gateway launches the original consent-protected WebView AI analysis instead of creating a second unverified AI calculation engine.
15. Registered a validated native-to-WebView AI route and a native-terminal entry point. `main` and restore branches were not changed.
16. Corrected adaptive priority precedence so an imminent verified expiry cannot be hidden by a lower-priority coverage gap; clarified that invalid market quotes are not current prices.
17. Carried the application-owned recovery-completeness caution safely through native evidence sanitization without trusting arbitrary user text.
18. Added a configurable, conservative local AI request allowance (default 20 reservations per IST day, 1–60 configurable), six-call reservation for Deep Research, and a clear distinction from actual Google billing limits.
19. Added JS native-integration guard tests, additional priority tests, and a Robolectric test for daily request limits and India-calendar midnight reset.
20. Allowed six-role Deep Research to run with public HAL evidence while excluding private positions; unavailable personal hedge/recovery assessments are explicitly labeled. Added role isolation regression cases.
21. Added a conservative explicit-rupee claim guard to structured AI responses. INR figures must match approved source numerics; unverified lakh/crore conversions are rejected. This guard does not mathematically verify all prose or percentage claims.
22. Added a chronological Ask Atlas conversation transcript, search of encrypted local history, and historical-answer labels; no remote history index is used.
23. Added explicit report sharing via Android's system share sheet **after a full native privacy preview and confirmation**. No tradebook mutations or automatic sharing.
24. Added Java test sources for the monetary guard and native integration tests for conversation UI and consent-based sharing.
25. Extended the private native Compose Daily Brief with a saved Room v2 snapshot using `RoomReadOnlyPreview.read` and `nominalCoverage`. Data conflicts and unsupported exposures withhold quantities; no market marks, ledger writes or unverified recovery totals are created.
26. Added regression guards covering readonly Room exposure and approved three-view navigation.
27. Protected six-role free-form text by verifying explicit INR amounts against approved market, option and deterministic scenario fields. The price allowlist now recognizes validated technical support/resistance, averages, Bollinger bands, and pivots; unsupported generated monetary projections are rejected.
28. Added Google-reported token metadata to standard requests and six-role aggregate reports, stored only inside encrypted AI history. The UI clearly distinguishes provider token counts from a bill or cost estimate. Invalid/fractional usage counts are ignored.
29. Added regression checks protecting the local-only WebView bridge against external navigation or non-allowlisted resources.
30. Confirmed that manifest backup is disabled, cloud/device transfer excludes private preferences, and this branch has not altered protected Room/legacy database migrations.
31. Found and corrected a monetary-evidence validation gap: incomplete basket valuations and incomplete stress scenarios no longer authorize Gemini to quote their totals as verified rupee amounts. Market observation and recorded individual leg amounts remain separate evidence categories.
32. Added source and Java regression cases covering incomplete valuation/scenario rejection, preserving validated complete scenarios and avoiding false claims of financial completeness.
33. Rechecked the Android Gradle build task: `preBuild` regenerates and verifies `desk4.js` through Node/esbuild, but `npm ci`, Android SDK 35, Gradle/AGP and dependency access must be available. The local session lacks Android SDK and Gradle and cannot access public Maven, so full APK compilation is not possible here.
34. Corrected the actual sanitized request boundary: `AiEvidence.sanitize` now removes incomplete basket open/net/charge totals and incomplete scenario P&L rows **before** they reach the native consent preview or Gemini. Missing-data errors and complete scenarios remain visible.
35. Aligned the WebView's `insights4.js` evidence packet with the same incomplete-data filtering, so the initial request preview also excludes unverified totals. Added independent Java and JavaScript regression cases for both levels and validated idempotent native sanitization in synthetic fixtures.
36. Fixed an obsolete `AgentDeskTest` expectation that incorrectly required the F&O role to exclude technical evidence. Included approved technical levels in the Risk Chair stage to support its numerical-claim validation, with updated role-isolation tests.
37. Added `android/tests/test-native-coverage.sh` and `android/tests/native-coverage-smoke.kt` for standalone Kotlin verification without Android SDK, JUnit, Gradle or external downloads. Pure `NativeCoverage.kt` calculations were independently compiled and exercised using the locally installed Kotlin compiler. This does not compile Compose or Android services.

## Checks executed in the assistant tool runtime
- Parsed `ui4.js` and `ai-intelligence5.js` with a JavaScript parser: no syntax errors.
- Executed **66 focused JavaScript checks** across `insights4`, `ai-intelligence5`, and native integration guards using an isolated JavaScript runtime (with a test-only URL shim): 66 passed, 0 failed. These are not a full Node/npm suite.
- Parsed `ui4.js`, `ai-intelligence5.js`, `ai-intelligence5.test.js`, and `scripts/build-assets.js` successfully.
- Passed 10 earlier structural wiring checks covering build order, native opt-in context, six-agent invocation, schema and model probe connections.
- Compiled and ran a standalone smoke harness for the pure Kotlin `NativeCoverage.kt` logic: passed. Android/Compose code was not compiled.
- Checked the local toolchain: Java, javac, Node and Kotlin compiler available; Android SDK/Gradle and Maven network dependencies unavailable.
- Reviewed the new branch files via the connected GitHub repository.

## Not yet proven or incomplete
- No full `npm test`, `npm run assets`, Java org.json suite, Gradle, Robolectric, Android lint, APK build, signing, or device run was performed in this environment (Java/Node/Kotlin compiler exist locally, but Android SDK/Gradle and Maven downloads are unavailable). Focused isolated JS and pure Kotlin smoke checks have run; checked-in Java/Android tests have **not** run.
- A native Compose AI gateway is implemented, including encrypted-history viewing, read-only reconciled Room v2 nominal-coverage preview, and launch into the full desk; native in-screen Gemini chat and verified live market data parity remain incomplete.
- Initial threaded follow-ups are wired through saved conversation IDs, with up to eight bounded, consented, revision-matched previous exchanges. A full chat transcript and local history filtering now exist, but transcript pagination, export formats and Android device usability are unverified.
- Structured response format, field bounds, approved URL validation and a conservative monetary-token guard (which excludes incomplete basket/scenario totals) are implemented; complete claim-level numerical/semantic verification is **not** implemented. Gemini should never be trusted as the source of position P&L.
- Exact NSE trading-session expiry counting is not connected; the priority engine accepts a verified count but does not invent one.
- Live model metadata verification is available on demand, but remains untested with a real API key. A conservative local request allowance has been implemented; Google-reported token counts are shown when present, but exact pricing, provider billing/quota telemetry, and optional search grounding remain incomplete.
- A database upgrade rehearsal against the user's signed installation and a live API verification are outstanding.
- Restore baseline requires an independently retained original-key-signed APK; this branch has not replaced it.

## Safety boundaries maintained
- No order execution, broker writes or fund transfers were introduced.
- No changes to SQLite/Room transaction schema or legacy financial-book migrations.
- AI remains an interpretation layer over existing deterministic financial engines.
- History ciphertext is kept in separate private preferences with a separate Keystore alias; no plaintext financial history is intentionally persisted in app preferences.
- All Gemini calls require the existing explicit evidence consent workflow.

## Next implementation gates
1. Run full offline asset/JS and Java/Android test suites, resolve regressions.
2. Complete conversation transcript and safe resumable-thread UX, building on revision-scoped opt-in history.
3. Test the structured Gemini API contract live; add independent numerical-claim checks and ensure reports remain usable when a provider cannot support JSON output.
4. Complete native Compose UI parity, transcript pagination, actual provider billing details and cross-screen consistency.
5. Rehearse signed data-preserving installation from 5.3.0 on a backed-up Android device.
6. Only then prepare a versionCode >59 candidate and request separate merge/release approval.
