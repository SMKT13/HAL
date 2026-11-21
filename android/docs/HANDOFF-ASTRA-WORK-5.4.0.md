# ASTRA 6.2 / ChatGPT Work — HAL Atlas 5.4.0 completion and signed APK handoff

**Owner request (2026-11-21):** Continue all remaining HAL Atlas AI Desk 5.4.0 work using Astra 6.2 in ChatGPT Work. Build, verify and, **only with the original signing key**, sign the final APK in the Work execution environment, as the 5.3.0 candidate was built and signed. Deliver the APK and verification evidence as user-accessible attachments in that Work conversation. Do not rely on GitHub Actions.

## Source of truth and protection

- Repository: https://github.com/SMKT13/HAL
- Working branch: `feature/hal-atlas-ai-desk-5.4.0`, **starting pre-handoff source commit** `b2a49608ed9cc27df90c120fb3467bc821c7de80`. This handoff document is a later commit on the same branch.
- Protected source: `main` at `a37e0239420513daa5b4235350be9036529fd60a`; `rebuild/hal-atlas-5.3.0` at `651146da203d9108d60a9728d07ee3546a66459b`; `restore/hal-atlas-5.3.0` at `d282f223a9dafa4e8b63e75678eddf76228cdc6c`. **Do not modify or merge to these branches without separate owner approval.**
- Preserve application ID `in.smkt.haldesk`, original certificate, package identity, saved book, Room v2 and legacy SQLite upgrade path, account/AI settings and native-only transactions. Never uninstall, clear user storage, drop tables, destructive-migrate or silently replace the signed restoration artifact.
- The current feature branch still declares `versionName '5.3.0'` / `versionCode 59` in `android/app/build.gradle`; `MainActivity.status()` and test fixtures also retain 5.3.0. **Before creating a 5.4.0 release candidate**, consistently update the candidate to `versionName 5.4.0`, `versionCode 60` (or another verified code strictly greater than 59), change only *necessary* version fixtures and source-identity validations, and validate the final APK manifest. Keep the pinned 5.3.0 restore source/artifact immutable.
- Make changes on the feature branch or on a new `release/hal-atlas-5.4.0-rc1` based on it. Make small reviewable commits with test results; no GitHub Actions required.

## Current implementation: do not rebuild from scratch

Read `android/docs/AI-DESK-5.4-IMPLEMENTATION.md` for a precise feature checklist and history. Core code already includes:
- `android/app/src/main/java/in/smkt/haldesk/`: `MainActivity.java`, `AiClient.java`, `AiPolicy.java`, `AiEvidence.java`, `AiStructuredReply.java`, `AiNumericClaimGuard.java`, `AgentDesk.java`, `AiModelProbe.java`, `AiHistoryStore.java`, `AiHistoryRetention.java`, `AiConversationContext.java`, `AiDailyBudget.java`, `AiUsageMetrics.java`, `NativeAiDeskActivity.kt`, `NativeCoverage.kt`, `RoomReadOnlyPreview.java`.
- WebView assets `ui4.js`, `insights4.js`, `ai-intelligence5.js`, `style4.css`, bundled via `android/scripts/build-assets.js`.
- Three AI Desk views: Brief, Ask Atlas, six-perspective Deep Research; evidence selection and consent, encrypted on-device history with pinned retention, quote/expiry priority, bounded conversation memory, provider token metadata, and read-only Room position-risk preview.
- Test cases in `android/tests/`, native Robolectric/JUnit under `android/app/src/test/`, and offline Kotlin smoke via `android/tests/test-native-coverage.sh`.
- `android/scripts/verify-ai-desk-5.4.ps1` checks dev builds without signing. Earlier isolated JS tests passed; **this is NOT proof of a complete native build or signed APK**.

## Mandatory engineering tasks (carry through to completion)

1. **Check out and audit actual source.** Run clean dependency resolution, compile immediately and fix all Java/Kotlin/Compose/Gradle/protobuf errors. Audit all usages of `AiHistoryStore` and native bridge against Android APIs and concurrent access. Treat JavaScript-only source guards as supplementary, not Android compilation evidence. Review `AgentDesk` role permissions and `AiEvidence` for inadvertent private-data inclusion and unsupported monetary claims.
2. **Complete native AI UX** without losing user-approved design: Brief, Ask Atlas and Deep Research (avoid nested menus); accurate verified HAL data/as-of, risk priority, current put/futures coverage and recovery indicators; explicit missing/stale/offline/closed-market states; readable conversation transcript, evidence source cards, history, pin/delete, consent previews, cancellation, and six-agent progress. Existing Compose gateway may navigate to the consent-protected WebView; complete or clearly document any missing native parity. No surprise Gemini calls.
3. **Preserve accounting and upgrading.** Exercise real/synthetic legacy SQLite schema-1 to Room-v2 and existing Room-v2 cases, including journal, historical fees/charges, original and native-only ledger entries, short/call positions, previous-book backup, margins, recovery tracking, manual marks and mixed expiries. Test rollback on corruption/conflict, backup/export/import and no destructive migration. Compare open/realised/lifetime net and recovery figures before/after. User's full current book is NOT contained in this repository; do not invent positions or imply that a synthetic test proves their actual phone data.
4. **Complete AI validation.** Run Java `org.json` tests, `AiStructuredReply` schema and source/rupee-claim checks, `AiHistoryRetention` and encrypted Keystore tests, model metadata probe, prompt injection/privacy tests, stale quotes, missing marks, trading-session vs calendar-day expiry. Verify structured JSON generation with a real configured Gemini model **only if an authorized, securely supplied API key is available**. Do not pretend metadata existence proves model/schema support. No automatic paid calls, order execution, broker writes, fabricated portfolio totals or unsupported guaranteed loss floors.
5. **Finish usability and operational checks.** Offline/invalid key/429/5xx/WebSocket disconnect, lost connection, dark Material 3, Android 8+ screen sizes, launch/upgrade, app background/foreground cancellation, backup/restore, report export, no secrets in logs/URLs/commits/APK. Ensure local daily Gemini budget never purports to be actual Google billing.
6. **Run complete tests and resolve failures.** JDK 17, Gradle wrapper (5.3.0 used Gradle 8.10.2), Android platform/build tools 35/35.0.0, Node 22, Python 3, Playwright Chromium. On a fresh checkout, for example:
   - `cd android && npm ci --no-audit --no-fund && npm test && python3 -m unittest discover -s tests -p 'test_*.py' -v && npm run assets`.
   - `bash tests/test-native-ai.sh` (requires pinned org.json JAR; verify checksum; no source edits to hide failures) and `bash tests/test-native-coverage.sh`.
   - `npx playwright install chromium && npm run test:ui`.
   - `./gradlew --no-daemon :app:testDebugUnitTest :app:testReleaseUnitTest :app:lintDebug :app:lintRelease :app:assembleRelease` (or `gradlew.bat` on Windows). Capture full logs and exact counts.
   - Fix and rerun any failure. Review remaining lint warnings. Check embedded WebView assets match regenerated source. Inspect APK for package/version/permissions/ABI 16 KB alignment and no credentials. Do not claim all issues are fixed without these checks.
7. **Upgrade rehearsal** using sanitized, backup-preserving test data from both old SQLite and Room v2 sources. Test old app -> new version and retain genuine restore capability. Actual installed-phone upgrade, private Keystore migration and user's real data need a device/secure backup; report those as unverified if absent.

## Original-key signing — copy 5.3.0 method, do not invent a key

- The 5.3.0 release documentation is `android/docs/REBUILD-5.3.md` and `android/docs/RESTORE-BASELINE.md`. Signed baseline `HAL-Atlas-5.3.0-signed.apk`: SHA-256 `04e2920b5c7924ae142ac6d84618cd34d2eae7d73d5098b70392cc228204e4c1`, `versionCode 59`, package `in.smkt.haldesk`.
- Required **signer certificate fingerprint** (SHA-256): `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`.
- Previous signing used build-tools `zipalign -f -P 16 4` and `apksigner sign` with `--ks-key-alias hal-personal`, v2 and v3 signatures enabled, v1 disabled. See `android/scripts/local-windows-release.ps1` and `android/build.sh` for the original restricted implementation. Both are **5.3.0-specific, safety-gated scripts**; do not blindly lift their signing blocks or bypass the migration tests. Create a separate explicitly gated 5.4.0 release script after acceptance checks.
- Look for the original private keystore **only in authorized secure local/Work resources used by the prior signing session**. It must not be checked into GitHub, included in the APK, copied into chat output, or logged. Use secret files/environment variables to pass paths and passwords, and clean up temporary copies. If the original key is unavailable, deliver an unsigned, verified APK plus the precise key dependency; **never sign with a new key while claiming in-place-upgrade compatibility**.
- Verify `apksigner verify --verbose --print-certs` fingerprint exactly matches the above, v2/v3 signature status, 16 KB zip/ELF native library alignment, app ID, `versionCode > 59`, expected permissions, absence of bundled secrets, and SHA-256 of final artifact. Patch `android/scripts/verify-apk.py` only for correct 5.4 version expectations, preserving its substantive checks.
- **Never install a candidate on the user's main phone until a separate backed-up upgrade rehearsal is confirmed.** No uninstall/clear-data or forced database downgrade.

## Deliverables in the Work conversation (not merely GitHub links)

1. A user-accessible **HAL-Atlas-5.4.0-signed.apk** file if and only if all release gates and the original-key certificate check pass. If signing isn't safely possible, provide **HAL-Atlas-5.4.0-unsigned.apk** and the exact blocker. No phantom `sandbox:/...` links.
2. A concise `5.4.0-build-verification.md` or PDF listing exact commit/build tools, tests, warnings, manifests, certificate fingerprint, checksums and upgrade rehearsal status, plus failures/limitations.
3. GitHub link/commit of final source changes on the development/release branch, preserving the 5.3.0 restore branch and `main`.
4. Clear install instructions **only after** a suitable data-preservation test; until then mark the APK as an upgrade-test candidate, not a production release.

**Operating instruction:** Work independently through tooling, fixing issues and retesting in the current Work task as far as resources allow. Do not repeatedly ask for status approval. Ask the owner only when access to the *original keystore* or the real device/backup is genuinely required; never request private passwords pasted into chat. Report reality plainly if the environment cannot complete any release gate.
