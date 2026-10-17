# React + AI repair verification

Repair base: `5a2380b25e2bc014f60718791643e39a19ca049b` (17 October 2026).
The React desk and Gemini integration are retained. Real read-only data adapters and the native Android source are restored from the prior tested implementation.

## Local checks

- TypeScript check and Vite production build passed.
- Python: 47 regressions passed for authenticated/allowlisted feeds, quote sanitation, contract discovery, full option quote batches, cache behavior, completed-session summaries and benchmark alignment.
- Node: 19 API/book regressions passed, covering viewer authentication, AI consent, configured search, rate limiting, provenance, provider failure, migration, backup atomicity, CSV safety and exact full-quote marking.
- Android/shared calculations: 56 checks passed for marks, accounting, scenarios, expiry gaps, missing/stale/crossed quotes, lot matching, depth, hedge cost/P&L reconciliation and settings.
- React browser checks passed at desktop and phone widths: six views, bid mode, hedge comparison without position mutation, chart remount, timeframe and expiry requests, saved headlines, AI consent/failure/grounding labels, 12-leg import, persistence, recovery, invalid-import rejection and themes.
- Native Android asset browser checks passed: five screens, charts, backup migration/recovery, close accounting, hedge checks and responsive/offline behavior.
- Android API 35 compilation, dexing, packaging and alignment passed in unsigned validation mode. No signing secret was used or published. Existing deprecation/compiler warnings remain.

Fixtures are synthetic and clearly separated from production data paths. No real order was placed or supported.

## Limits

Live Upstox token permissions/entitlements and a live Gemini response were not tested without the user's configured credentials. AI model/quota failures remain explicit, with no invented research fallback. Docker configuration is provided; a local Docker image was not run. Physical Android installation was not tested. The existing native APK is not silently replaced by the web repair.

GitHub Actions repeats the regression/build gates on the pull request. See its current check status for remote validation results.
