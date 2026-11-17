# HAL Desk Android — 5.0.0 rebuild branch (versionCode 33)

This update preserves the Android package and SQLite schema-4 book used by 4.6.0 (versionCode 31).

Personal offline-capable HAL research, risk, history and PAPER option strategies. Android **8.0+**, applicationId `in.smkt.haldesk`, target SDK 35. Direct Upstox Analytics Token and optional Gemini/FinBERT; **read-only, no orders**.

## HAL Atlas redesign branch

On the Atlas branch, open **Today → Since last review → Mark reviewed** to set the comparison the next time you check your position. Current REST prices and trade timestamps are required for HAL and every open leg. Contracts with missing, stale or manual marks are listed for inspection. Refreshing, switching tabs and reopening the app preserve the chosen comparison. Existing HAL Desk review observations remain available when upgrading.

Open **Today → Agenda** to see expiry dates, dated company notes, disclosures with a supplied event date and personal reminders. Tap **Inspect legs** to see the contracts and units expiring together. For an official filing with only a publication date, **Research → News & filings → Add event date** lets you enter the scheduled date from the document. Reminders appear in the app and travel with the saved-book backup.

## User interface

The five primary tabs remain **Position, History, Technicals, Research and AI Desk**. The real book supports only long futures and protective puts; the isolated Technicals → **Options Lab** supports hypothetical long/short futures, calls and puts, conventional strategies, payoff/risk modelling, model Greeks, IV/OI snapshots, watchlists and virtual journal entries.

**PAPER ledger v1 is now a state machine.** A draft can be edited. Marking it OPEN freezes its validated entry legs, quantity, price and opening charges. An open trade can be closed with explicit hypothetical prices and cumulative fees, but cannot be retroactively edited; clone to create another draft. Old 4.4/4.5 records load with unchanged schema 1 and establish a read-only opening snapshot on migration. This is not an executed order ledger.

Actual-book accounting and recovery remain schema 4 in SQLite, with revision checks, checksums, previous-book recovery, cost accounting and confirmed-broker-history reconciliation. In 5.0, JSON backup import first previews the existing-versus-imported open legs, journal, lifetime history, notes, recorded charges and booked net; destructive replacement requires a checkbox plus typing `REPLACE`. Failed native book saves leave the saved book and current calculation state unchanged. Import is a full replacement, not an automatic merge. No migrations delete legacy `hal_desk_v2`/`hal_positions_v1` browser data. Credentials continue using the original Android Keystore alias `hal-upstox-secrets-v1` and app package identity.

## HAL Desk 5 research additions

Read-only HAL Desk 5 modules include `risk5.js` (dated option and future settlements), `quant5.js` (conditional Monte Carlo), `backtest5.js` (next-bar-open PAPER strategy research), `hedge5.js` (hedge replacement audit), `lenses5.js` (local evidence readiness), `quality5.js` and `continuity5.js` (market-data identity, clock and refresh safeguards), `attribution5.js` (reconciled contract-by-contract last-visit market movement), `migrate5.js` (book-upgrade preservation), `portfolio5.js` (lifetime P&L reconciliation), `expiry5.js` (dated protection gaps), `reconcile5.js` (read-only broker-close preview), `path5.js` (expiry-specific hypothetical P&L, never a forecast of delivery cash), and `rollover5.js` (read-only, exact-contract bid/ask and fee comparison of later-dated futures). The close preview cannot write to the real journal; actual completed transactions are recorded separately in Position → Book. Today and Performance withhold inconsistent totals. These are compatible vertical slices of the existing architecture, **not yet a fully independent rebuild**.

## Architecture

| Layer | Implementation |
| --- | --- |
| Native shell | `app/src/main/java/in/smkt/haldesk/MainActivity.java`, isolated local WebView and native bridge |
| Provider | `MarketClient`, `ResearchClient`, `NseMcpClient`; Upstox derivatives and independently labeled NSE cash research |
| Storage | `BookStore`, `BookValidator`, `SecretStore`; SQLite + Keystore |
| Finance | `engine4.js`, `history5.js`, `workflow4.js`, `recovery5.js` |
| Options Lab | `optionslab5.js`, `optionslab-advanced6.js`, dedicated UI modules and PAPER cache |
| Evidence/AI | `insights4.js`, `AiPolicy`, `AiEvidence`, `AiClient`, opt-in `FinbertClassifier` |
| UI | `ui4.js`, modular history/review/recovery views, `style4.css` and Lightweight Charts |

Web sources live in `app/src/main/assets/`. The pinned esbuild transformation (Chrome 61 target) produces `desk4.js` and the SHA-256 asset manifest. **These are build outputs and are intentionally excluded from git.** `npm run assets` produces them; `npm run test:ui` produces them automatically; `gradlew ...` regenerates them before verifying/package. Run `npm ci` first to install pinned esbuild.

For Windows PC users avoiding the exhausted GitHub Actions allowance, a separate [local verification and optional original-key signing guide](docs/LOCAL-RELEASE.md) provides `scripts/local-windows-release.ps1`. Its full default run executes JavaScript, browser, native Android tests, lint, unsigned APK assembly and zip alignment. Actual signing requires the original keystore and no browser tests may be skipped.

## Build and regression tests

Prerequisites: JDK 17; Android SDK platform 35 / Build Tools 35.0.0; Node 22; Gradle wrapper 8.10.2.

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
bash tests/test-native-ai.sh
HAL_UNSIGNED_ONLY=1 ANDROID_SDK_ROOT="$ANDROID_HOME" bash build.sh
```

The build regenerates WebView assets, runs `:app:testReleaseUnitTest`, `:app:lintRelease` and `:app:assembleRelease`, then produces an **aligned unsigned APK**. The CI pipeline runs separate Python/web and Android suites. Tests use synthetic broker data and mocked callbacks, not actual Upstox credentials.

To sign an installable upgrade, supply local paths through `HAL_SIGNING_KEY_FILE` and `HAL_SIGNING_PASSWORD_FILE` (see [INSTALL.md](INSTALL.md)). Signing key alias is `hal-personal`; the original certificate is enforced by `build.sh`. Never commit signing keys or put private credentials into logs.

## Known limitations

- This is **HAL-specific**. Neither the native real-book validator nor the Python viewer implements an arbitrary NSE trading book.
- Market subscriptions, quote ages, live option chains, and broker permissions must be tested using the owner's Upstox Analytics Token. UI and model test fixtures are not evidence of live market access.
- Mixed option expiries are **not** interchangeable at a single settlement spot. Early-expiring legs require a separate settlement assumption or actual broker reconciliation.
- Saved local IV/OI observations do not constitute backfilled official historical data or vendor IVP. Missing OI, IV, timestamps, strikes and quotes remain unavailable.
- Stock derivatives can trigger physical delivery/margin obligations. No broker margin or settlement cash call is guaranteed by the model.
- Offline FinBERT requires explicit optional model download, compatible device resources and licensing checks; Gemini usage may incur charges.
- Android credentials, saved books, paper history and the desktop viewer live in different storage boundaries. Backup and restore explicitly before changing devices.

See [system-level audit](../docs/REFACTOR-4.6.md), [original signing/install](INSTALL.md), [API capabilities](docs/API-CAPABILITIES.md) and [NSE provenance](docs/NSE-MCP-4.3.md).
