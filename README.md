# HAL Atlas

Personal research, derivatives risk and portfolio accounting for **Hindustan Aeronautics Limited (NSE: HAL)**. This repository contains two **separate** applications: the primary Android desk and an older desktop/browser viewer. Neither application sends orders, reads broker account holdings or transfers funds.

## Current release sources

| Application | Source | Version | Storage |
| --- | --- | --- | --- |
| Android HAL Atlas | `android/` | **5.1.0**, versionCode **34** | SQLite real-book schema 4, protected Android Keystore credentials, separate PAPER research cache |
| Desktop/web HAL viewer | `src/`, `backend/`, `server.ts`, `server.py` | Separate web product | Browser-origin-local portfolio, optional local Python market feed |

**The two apps do not automatically share positions, history, model outputs or subscriptions.** Export/import only through documented, validated formats. The web viewer is not the canonical Android portfolio.

## Getting started on Android

1. If upgrading, export your saved book first and install the signed APK over the existing app. HAL Atlas 5.1.0 supports Android 8.0 and later.
2. Open Settings to connect your read-only Upstox Analytics Token. Refresh market data and check the displayed timestamps before using marks.
3. In **Portfolio → Open book**, review your existing legs or enter your HAL futures and protective puts. Check expiry, lots, units per lot and entry prices against your records.
4. Use **Plan** for stress scenarios and hedge or rollover comparisons. Open **Portfolio → History** for completed trades, charges, funding and backups.
5. Open **Plan → Options Lab** to model a hypothetical strategy and track it in the PAPER journal. Use **Research** for company and market evidence and **AI Desk** for optional analysis.

See the [Android feature guide](android/README.md) for the four tabs, data sources, calculations and backup behaviour.

## Android desk capabilities

- **Position:** exact-contract long HAL futures and protective puts, partial closes, reconciliation, lifetime trading charges, risk and expiry gaps, multi-leg scenarios and break-even.
- **History:** actual completed trades, broker-reviewed statement imports, charges, funding snapshots, explicit backups and recovery.
- **Technicals / Options Lab:** expiry-specific chain, standard trading indicators, **PAPER-only** CE/PE/FUT strategies, 38 reference categories (only mathematically defined recipes can be auto-built), payoff graphs, Greek models, OI/IV snapshots, watchlist and paper journal. Opening PAPER trades freezes the position and entry snapshot in 4.6; editing requires a clone, not a retrospective rewrite.
- **Research:** corporate disclosures, fundamentals, company news and separately sourced official NSE cash-market observations.
- **AI Desk:** optional user-authorized Gemini calls and opt-in offline FinBERT. Deterministic calculations remain authoritative.

Data quality is explicit: retrieval time is not a trade time; incomplete chains cannot produce complete PCR/max pain; expired derivative legs require reconciliation; a single future spot cannot determine the settlement of already expired puts. Options with physical settlement entail broker-specific delivery/margin obligations. No hedge, recovery plan or model output guarantees profits.

## Run and test

### Android source

Requires **JDK 17**, Android **SDK 35** and Build Tools **35.0.0**, Gradle wrapper **8.10.2**, Node **22** and pinned npm packages.

```sh
cd android
npm ci
npm test
npx playwright install chromium
npm run test:ui
HAL_UNSIGNED_ONLY=1 ANDROID_SDK_ROOT="$ANDROID_HOME" bash build.sh
```

**4.6 change:** `app/src/main/assets/desk4.js` and `web-assets-sha256.json` are generated artifacts, **not committed files**. The pinned build script `scripts/build-assets.js` regenerates them for browser tests, and Gradle automatically regenerates and verifies them before Android packaging. No hand-edited or stale WebView bundle is used as source of truth.

Android application ID stays `in.smkt.haldesk`. An upgrade requires the **original HAL signing certificate**, not a new keystore. Use [private local signing instructions](android/INSTALL.md); never commit, paste into issues, or upload the JKS/password to CI.

### Desktop/web viewer

```sh
npm ci
cp .env.example .env
npm run lint
npm run test:python
npm test
npm run test:web-engine
npm run build
npm run dev
```

Set a **separate** `HAL_VIEWER_KEY` and any optional provider credentials in the local environment. Web API routes require viewer authentication. For production behind a reverse proxy, set `HAL_PUBLIC_ORIGIN` to the actual HTTPS origin; POST-origin checks include scheme and port. The optional standalone Python server also requires the viewer key for all `/api/*` endpoints.

See [web viewer deployment](docs/WEB-VIEWER.md), [Android architecture](android/README.md) and [provider capabilities](android/docs/API-CAPABILITIES.md).

## System boundaries and reliability

- **Financial accounting:** deterministic, revision-checked local saved book; exact expiry and lot validation; actual positions are never merged with hypothetical paper positions.
- **Market adapters:** direct read-only Upstox Android access; independent official NSE cash research; cached/offline states explicitly marked. Web feed is a separate service.
- **Security:** native Keystore AES-GCM, HTTPS and request allowlists, restricted bundled WebView origin, backup credential screening, no Android cloud/device transfer of the book or credentials. Keep any public clone free of signing material.
- **Regression gates:** Node finance tests, Android native/Robolectric tests, AI policy tests, lint, browser simulations, and local unsigned release APK assembly. These tests **do not** establish live Upstox access or a physical-device upgrade.
- **Android release process:** follow the [local release guide](android/docs/LOCAL-RELEASE.md) to build and verify the APK, then sign with the original certificate.

The signed HAL Atlas 5.1.0 APK has SHA-256 `839b9fffdd7bbdcb404dd1153489546cc0fffadd1dc73cab8dd124588d95c62c`.

The previous signed 5.0.0 APK was built from [release source 9218c0e](https://github.com/SMKT13/HAL/commit/9218c0e7a27b946fe50b5f4c98b30d7087b2feb3). Its SHA-256 is `d6d61285ce24ef9de4249c453b1a005379a51a35e76f178cebf2df303f890a4d`.

## Scope of the 4.6 refactor

The 4.6 source refactor removes stale generated files, adds an immutable PAPER ledger state machine (with backward-compatible old draft migration), requires authentication on the optional Python API, validates complete HTTPS origins for web AI POSTs, and expands regression coverage. **It is not a claim that every historical module was rewritten or every issue is eliminated.** Physical installation, original-key signing and authenticated broker validation remain release acceptance steps.

See [refactor audit and remaining tasks](docs/REFACTOR-4.6.md).
