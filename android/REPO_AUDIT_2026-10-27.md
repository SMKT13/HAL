# HAL repository audit — 27 October 2026

## Scope and method

Reviewed the GitHub repository tree and representative source/CI and test contracts across:
- Native Android: `MainActivity`, `MarketClient`, `MarketStream`, `StreamDecoder`, `ResearchClient`, `SecretStore`, app manifest/build, signing workflow.
- Android HTML/JS: app startup, portfolio calculations, source-readiness, position/hedge/scenario modules, market indices, stream LTPC preview, option-chain intelligence and tests.
- Web and API: React app, shared calculation modules, local-book import/export, Python server market routes and viewer-key boundary.
- CI: JS/TypeScript, Python, browser regression, Gradle APK, JVM protobuf decoder and release filename/signer checks.

This is a **source-level and synthetic-test audit**, not a security penetration test or a live-data acceptance test. GitHub CI is the authoritative build verifier. No market secrets or user accounts were accessed.

## Reproducible fixes in this branch

| ID | Affected source | Previously | Fixed behavior |
| --- | --- | --- | --- |
| Q-01 | `android/app/src/main/assets/core.js` | Spot freshness could be declared recent if **either** quote or exchange-trade timestamp was present; older trade missing from array | Requires **both** valid source clocks; flags missing, future or stale clocks rather than accepting a recent quote alone |
| I-02 | `core.js` numeric input | Whitespace-only numeric input could coerce to zero | Whitespace-only value is unknown/null, same as an empty input |
| C-03 | `market-pulse.js` | Future exchange timestamps were clamped to zero age and reported as recent | A trade time more than 60 seconds ahead is flagged as provider/device clock error |
| U-04 | `stream-preview.js` | A live India VIX/NIFTY numeric index point was displayed with a **₹** prefix | Currency prefix is shown only for HAL equity/futures prices; index values are unpriced index points |
| C-05 | `stream-preview.js` | Incoming preview with future clock got a generic older-trade label | Future trade/feed clock gets an explicit clock-error warning |
| S-06 | `MarketStream.java` + `StreamDecoder.java` | A new LTPC frame with **missing** trade time could replace a more recently verified cached trade | Rejects missing-time or out-of-order trade frames when a verified trade exists |

Additional tests cover missing clock, whitespace input, future VIX clocks, future stream clocks, index-unit display and out-of-order WebSocket updates.

## Security and correctness guardrails retained

- Upstox direct token is encrypted in native Android Keystore; WebView never receives the secret; GET allowlist and HTTPS destinations protect market/API calls.
- Option/Greek lookups and streams resolve HAL contracts from Upstox metadata. Stream previews remain **observational**; they do not feed the trade book, Greeks ledger or strategy P&L.
- Saved position book is manually authoritative; mixed-expiry and incomplete hedge conditions are warned; no broker order methods are included.
- The existing `hal_desk_v2` backup schema, application ID `in.smkt.haldesk`, and existing Android signing workflow are unchanged in this PR.
- Server read-only `/api/upstox/hal` and `/api/upstox/research` require the configured viewer key; public `/api/data` and `/api/agents` use non-account market data.

## Tests and release blockers

CI runs Node/TypeScript lint/tests, Python tests, browser view tests, generated V3 Protobuf JVM tests and Android unsigned release build. Check this branch's latest GitHub Actions result before merging.

**A signed, upgrade-compatible APK cannot be produced from this code review alone.** The last verified GitHub signing run (23 October 2026) failed in the *Restore original private signing identity* step because `HAL_SIGNING_JKS_BASE64` and `HAL_SIGNING_PASSWORD` were empty. Whether they have been populated since was not readable from this connection. Publishing a newly generated signing key would break upgrades to an already installed app; do not do that.

To produce HAL Desk 3.3 with the **original signing certificate**, check the private GitHub repository Actions secrets and, after this branch is merged and CI passes, manually dispatch `.github/workflows/android-signed-release.yml` on `main`. The expected artifact is `HAL-Desk-v3.3-signed`. Compare the old/new certificate SHA-256 fingerprints; verify current installed versionCode is below **17**; export a local-book backup; upgrade without uninstalling.

Real-device acceptance is outstanding: actual Upstox Analytics Token, NSE market-hours/after-hours data, active HAL contract lookup and Greeks, stream reconnect/stop behavior, network failure and saved-book retention. Synthetic CI cannot demonstrate those live conditions. **Do not use an unverified build as the sole basis for a financial trade.**
