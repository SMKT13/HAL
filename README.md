# HAL Desk

A private, read-only HAL research and position monitor. The React/TypeScript interface and Gemini integration are retained. Real feed adapters, the native Android source, backup migrations and regression tests are restored.

The app does **not** place orders, read broker positions, or initiate trades. You record your own holdings and completed fills.

## Run the React desk

Requirements: Node 22.10+ and Python 3.11+ (standard library only).

```bash
npm ci
cp .env.example .env
# Configure the server credentials in .env, then:
npm run dev
```

Open `http://localhost:3000`. Enter `HAL_VIEWER_KEY` in **Desk settings**. This is a separate random password, never your Upstox token. It is required for every data and AI API route and is stored in browser session storage, excluded from backups.

For production:

```bash
npm run build
npm start
```

Node serves the React build and authenticated API. It launches a Python feed worker on an ephemeral **loopback-only** port with a separate random internal key. Only Node listens publicly. No second public service or paid database is required. `/health` checks whether the worker is running; it does not assert that provider credentials or upstream feeds are healthy.

## Server configuration

| Variable | Purpose |
| --- | --- |
| `HAL_VIEWER_KEY` | Required private viewer password; data access fails closed when missing. |
| `UPSTOX_ACCESS_TOKEN` | Your server-side Upstox access token. Renew it through your existing broker authorization process when it expires. |
| `GEMINI_API_KEY` | Optional server-side Gemini key. AI stays unavailable when absent. |
| `GEMINI_MODEL` | Defaults to the existing `gemini-3.8-flash`; configurable without code changes. |
| `HAL_AI_SEARCH` | Set to `1` to enable Google Search grounding. Defaults to `0`. |
| `HAL_AI_HOURLY_LIMIT` | Global per-process AI request cap, default 20, maximum 100. Two concurrent requests allowed. |
| `HAL_PUBLIC_ORIGIN` | Your deployed HTTPS origin when behind a reverse proxy. |
| `PORT` | Public server port, default 3000. |
| `PYTHON` | Optional Python executable, default `python3`. |

Keep credentials outside git. Never prefix provider secrets with `VITE_`. The app does not claim Gemini or search requests are free: requests use the configured account's access, quota and pricing. No AI request is triggered by opening a screen or by background refresh. A visible checkbox and Run/Ask button control sharing.

Gemini offers six review perspectives, a position Copilot and optional search research. These are perspectives from **one model**, not six independent agents. The server validates the book and computes quote, ledger, risk and hedge context using its own feeds. Client-supplied prices or metrics are ignored. Failed AI calls return an explicit error; there is no fabricated verified-research fallback. Search grounding is shown only when the provider returns usable source links. Source links still need verification.

Official API references: [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search), [Upstox developer documentation](https://upstox.com/developer/api-documentation/).

## Data and monitoring

- **Overview:** actual provider spot, dated daily indicators, benchmark beta/correlation from aligned returns, recorded P&L and expiry warnings. Missing data is unavailable, never a synthetic live price.
- **Position Desk:** up to 12 long futures/put legs, exact-contract LTP or bid marks, explicit manual marks, per-contract lot validation, risk timeline, funding snapshots, journalled actual closes and charges.
- **Scenarios:** actual expiry horizons, explicit IV assumptions when absent, futures basis before expiry, model assumptions displayed. A single future spot cannot value an already-settled earlier expiry.
- **Put hedge:** compare the existing basket with a replacement that matches futures units in whole lots. Requires fresh spot, futures, chain and full option quotes; acceptable spread, trades, OI, volume, depth and Greeks; and complete relevant listed-expiry coverage. Earlier-expiring candidates are rejected. New premium, sale proceeds, fees, net cash outlay and additional P&L are distinct. Keep-current scenarios stop at the first existing put expiry. Categories are based on cost and **sampled** scenario loss, not a guaranteed maximum-loss floor. Comparing never edits holdings or executes an order.
- **Markets:** real daily/15-minute/hourly candles, SMA overlays, listed futures and expiry-specific option chains. Data availability is explicit. TradingView opens as an external chart.
- **HAL Research:** provider fundamentals with statement basis, periods and partial errors; personal sourced notes. No hardcoded financial dossier is substituted for missing data.
- **Newsroom:** Upstox news and NSE RSS disclosures, provider dates, safe source links and persisted bookmarks. The NSE feed is a recent window, not a complete filing archive.

Upstox is accessed only through explicit GET allowlists. There are no order or broker-account routes. Access to news/fundamentals can depend on provider entitlements. Quotes can be old, especially outside the session; retrieval time is never substituted for provider quote time. Strict hedge checks may correctly produce no shortlist outside the market session.

Yahoo daily data is an optional delayed feed with a 15-minute cache. Indicator summaries use completed sessions; charts may include provisional candles. The NIFTY block is absent when its feed fails. Historical/cached prices are dated and must not be interpreted as executable quotes.

## Backups and earlier books

Canonical storage uses the Android-compatible `hal_desk_v2` book. Import supports Android v1/v2 backups and the prior React `version: 3` position/funding/journal/notes export. Existing browser `halpos3`/`halpos2`, journal and notes are migrated when no canonical book exists. No sample holdings are created on first launch.

A full backup includes all open legs, journal, notes, bookmarks, hedge preferences, funding and display settings. Import validates before writing, shows record counts, persists one complete book and retains the previous saved book under `hal_before_import_v2`. Credentials are excluded. Invalid data is rejected without replacing the book. If earlier saved data is corrupt or uses non-integral lots, it remains untouched for recovery rather than becoming a default portfolio.

Earlier React realized P&L and charge totals are retained as opening reconciliation. Its amount-only notebook is kept separately because those entries did not update the running totals automatically; they are not added again. Review them under Journal. New actual closes update quantity and realized P&L together. Settlement cash is tracked separately and never counted again as trading profit.

Browser data is per origin and device. Moving to another deployment URL does not move it automatically: export first, then import. Native Android has its own storage; use explicit backup transfer. Native market caches/history are not part of the React position ledger import.

## Deploy

The restored `Dockerfile` builds the React bundle and installs Node plus Python in one image. `render.yaml` uses that Docker image. Set secrets through the host's environment settings, set the public HTTPS origin, and enter the matching viewer key in the app. An older Render service configured as Python must switch to this Docker setup; merely changing its start command is insufficient.

The optional feed cache is disposable. Open books remain on the user's device; clearing browser storage loses them unless backed up. The AI limiter is in memory per process: use one instance or add a shared limiter before scaling beyond a private desk.

## Android

The complete native source is restored under `android/`, including its direct read-only Upstox connection, encrypted local credential storage, five native asset screens and tested hedge tools. The React AI desk is the web interface; this repair does not silently install a new APK or change the native app's release identity.

Both interfaces use the same pure `core.js`, `analytics.js` and `hedge.js` calculations. See [Android build instructions](android/README.md). Preserve your original private signing files for compatible updates; never commit or distribute them.

A signing-free validation build is available for CI:

```bash
HAL_UNSIGNED_ONLY=1 ANDROID_SDK_ROOT=/path/to/android-sdk bash android/build.sh
```

The aligned unsigned APK is for build verification, not installation as an update.

## Verification

```bash
npm run lint
npm run test:python
npm test
npm run test:android
npm run build
npx playwright install chromium
npm run test:ui
(cd android && node tests/ui.test.js)
```

GitHub Actions runs the Python, Node, Android calculation, React browser and native asset browser regressions and compiles an unsigned Android APK. Browser tests use clearly synthetic fixtures and do not call Upstox or Gemini. Live token permissions, model quota and physical-device behavior require verification in the user's configured environment.
