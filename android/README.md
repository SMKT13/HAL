# HAL Desk 4.2.1

Personal HAL research and derivatives desk for Android 8 and later. Package `in.smkt.haldesk`, versionCode 23.

- **Position** shows the open book, protection, risk, scenarios, hedge comparisons and dated break-even calculations.
- **History** imports HAL contract summaries and reconciles them with completed trades and cumulative fees. A preview shows the resulting totals before saving.
- **Technicals** includes charts, completed-bar indicators, derivatives data and historical pattern comparisons.
- **Research** brings together company disclosures, fundamentals, news and sourced business notes.
- **AI Desk** provides optional Gemini analysis with an evidence preview and explicit consent.

Review periods are available from each workspace. The open-position and lifetime recovery prices use the selected valuation date, remaining contract quantities, costs and assumptions. See [installation and private signing instructions](INSTALL.md).

## Architecture

The Android platform layer is Java, with a local, isolated WebView interface and independent JavaScript finance/evidence/data modules. This retains the original Keystore identity and WebView origin and makes lossless schema-2 migration straightforward. Java is used instead of introducing a second native language into the preserved platform boundary. UI and calculations require no Python, Node service, hosted website or account login.

- `engine4.js`: deterministic accounting, exact contract matching, Greeks, scenarios, hedge eligibility/ranking, indicators and historical patterns.
- `data4.js`: provider adapters for the interface, clock provenance, per-feed failures, cache handling and legacy migration.
- `insights4.js`: allowlisted evidence packets, checkpoints and local review prompts.
- `workflow4.js`: daily review eligibility, combined strategy summaries, common-assumption exposure comparisons and HAL business evidence groups.
- `ui4.js`: escaped presentation, local editing, confirmation and explicit AI evidence consent.
- `MainActivity`, `MarketClient`, `ResearchClient`: native lifecycle and fixed HTTPS read-only operations.
- `BookStore`: SQLite transactions with revision checks, checksums, previous snapshot and corruption quarantine. `SecretStore`: AES-GCM with Android Keystore.
- `MarketStream`/`StreamDecoder`: official Upstox V3 Protobuf decoding, separately retained observation preview.
- `AiPolicy`/`AiEvidence`/`AiClient`: native request validation, consent boundary and direct Gemini transport.
- `FinbertClassifier`: pinned model/tokenizer checksums, cancellable opt-in download, local ONNX inference.

Sources are compiled into `desk4.js` with esbuild 0.25.12 targeting Chrome 61 syntax; small array compatibility shims are included. Gradle checks source/bundle hashes to prevent stale generated assets shipping. The original chart library license is retained.

## Data and migration

Portfolio schema 4 stores `legs`, immutable completed-close records in `journal`, costs/cash movements, `legacy` realised history, notes, bookmarks, risk limits, funding, preferences, review checkpoints and hedge settings. Each leg records type, exact expiry, strike, lots, lot size, entry, optional manual mark/time and exact instrument key.

The app retains `https://appassets.androidplatform.net/`, `hal_desk_v2`, `hal_positions_v1` and related legacy keys. It reads and validates old data, writes the migrated book transactionally to SQLite, and leaves old browser records intact. Old rollover settings are archived, never interpreted as future instructions. A malformed native book does not silently become an empty portfolio. Credentials keep the original `private_credentials` preference file and `hal-upstox-secrets-v1` Keystore alias. Credentials and model binaries are excluded from JSON exports and Android cloud/device-transfer backups.

## Build and verify

Use JDK 17, Android SDK 35/build-tools 35.0.0 and Gradle 8.10.2. Dependencies are pinned; install/build dependency downloads require internet. Normal Android startup does not.

```sh
npm ci
npm run assets
npm test
npx playwright install chromium
npm run test:ui
./gradlew :app:testReleaseUnitTest :app:lintRelease :app:assembleRelease
```

The browser suite uses synthetic native callbacks and data, not an Android device or a live broker account. `HAL_BROWSER` selects an available test browser, and `HAL_PLAYWRIGHT_MODULE` can select a compatible installed Playwright runner. The release verification used Playwright 1.62.1 with Chrome Headless Shell 156; the pinned project runner can use its matching downloaded browser.

`tests/test-native-ai.sh` additionally exercises direct Gemini request/response and evidence policies using mocks. Native Gradle tests exercise real SQLite and WebView configuration under Robolectric API 26 and 35, plus provider parsing and Protobuf fixtures.

For original-identity signing, supply **file paths** privately in `HAL_SIGNING_KEY_FILE` and `HAL_SIGNING_PASSWORD_FILE`, then run `build.sh`. The script never creates a replacement key and rejects an unexpected certificate. `HAL_UNSIGNED_ONLY=1` creates an unsigned artifact. Private signing files are not part of this source archive.

See `INSTALL.md`, `docs/API-CAPABILITIES.md` and the supplied verification report. Synthetic tests establish implemented behavior, not live-provider access or successful installation on an untested phone.
