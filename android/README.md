# HAL Desk 2.0 — Android research and position monitor

Personal, read-only HAL app for Android 8+ with an updated Android System WebView. Package `in.smkt.haldesk`, version code 2. This updates the earlier HAL Upstox 1.0 app using its original signing key and storage origin.

## Stage 1 and Stage 2

- Five screens: Overview, Positions, Markets, Research and News. Graphite dark, paper light and device theme; responsive phone layouts, accessible controls and source timestamps.
- Direct Upstox connection using Android Keystore encrypted credentials, or the existing authenticated Render service. No credentials enter JavaScript, backups or source control. Fixed HTTPS GET destinations; authenticated redirects are rejected.
- Spot and futures quotes, exact contract lot sizes, option chain with bid/ask, OI, IV and available provider Greeks. Optional foreground refresh every 60 seconds.
- Bundled TradingView Lightweight Charts 5.0.8: daily, 15-minute and hourly candles, volume, SMA 20/50 and position levels. No external chart script requests.
- Completed-bar SMA 20/50/200, RSI 14, MACD 12/26/9, Wilder ATR 14, MFI 14, Bollinger bands, pivots, recent support/resistance and daily realised volatility. Rules and evidence are shown; directional commentary waits for sufficient, recently fetched data.
- Upstox quarterly/annual financials, consolidated/standalone basis, valuation ratios, cash flow, balance sheet, shareholding, corporate actions and provider company/peer context. Period-matched margins and cash conversion; unknown fields remain unavailable.
- Upstox recent news plus three official NSE corporate RSS feeds. Topic filters, conservative duplicate grouping, bookmarks and source links. Media reports are distinct from exchange disclosures; corroboration is not inferred automatically. Manual sourced business notes can record order book, deliveries, guidance and event dates.
- Manual long futures/protective-put book, indicative LTP or bid marks, explicit manual overrides, exact expiry/strike matching and lot mismatch checks. Existing v1 positions migrate without deleting their original record.
- Active hedge quantity coverage, unit-based delta/theta when every put chain is complete and recently retrieved, expiry timeline and expiry-gap warnings. Rollover comparison is a non-executable futures LTP spread.
- Mixed-expiry price/time/IV scenarios only up to the earliest expiry. European Black–Scholes put estimates and constant-basis futures; editable rate/dividend/IV assumptions. Exact intrinsic payoff remains limited to shared-expiry baskets.
- Local completed-close journal with partial closes, charges, separate settlement cash and strategy net P&L. Manual funding snapshots are separate. Sparse P&L observations accumulate while the app is open.
- Android document-picker JSON backup/import with validation, review before replacement, previous-import recovery, and journal CSV. Credentials are excluded. Open positions are manual records, not imported broker holdings.

No trading, orders, automatic rollovers, background workers, Stage 3 notifications or paid AI service are included.

## Data and refresh

Official Upstox endpoints supply instrument search, quotes, option contracts/chains, V3 candles, news, fundamentals and NSE status. The app discovers HAL rather than hardcoding provider instrument tokens. Research refreshes independently of the main quote request. Financials cache for six hours; news, filings and candles for 15 minutes; market status and extra expiry chains for one minute. NSE RSS provides a rolling window; an empty HAL result does not prove that no disclosure exists. The news request returns up to 100 items from the provider's recent seven-day window.

Use an Upstox Analytics Token where available for read-only research. Token validity, access and quotas remain provider-controlled. A normal OAuth access token can expire daily. Replace credentials in the native Connection dialog when rejected; do not put them in Git or chat. The app does not implement OAuth login or renewal.

Direct mode works without Render. Server mode requires the accompanying backend changes to be deployed and both `UPSTOX_ACCESS_TOKEN` and the separate `HAL_VIEWER_KEY` configured. The backend's new `/api/upstox/research` endpoint uses the same viewer-key gate. Existing Yahoo-based web routes remain independent.

## Calculation boundaries

Chain retrieval time is not a per-option trade timestamp. Greeks remain indicative even when fetched recently; basket Greeks are withheld for missing, failed, mismatched or more-than-two-minute-old chain inputs. P&L marks may be old and are labelled by source/time. Structural quantity matching does not guarantee a downside floor across different strikes or expiries.

Scenario values are model estimates, not forecasts or executable prices. The model does not infer the price path through an earlier expiry, margin needs or settlement deliveries. Its 6% rate and 0% dividend defaults are editable assumptions, not fetched market inputs. Model P&L is before costs. Journal net subtracts recorded costs once; option premium is already included through entry-to-mark/exit P&L. Futures settlement cash is not added to P&L again.

Historical valuation multiples, automatic extraction of order-book figures from PDFs, broker position sync, continuous P&L history and background alerts are outside this release. Missing financial fields stay missing rather than being scraped from unreliable substitutes.

## Build and signing

Verified build route: Android SDK platform 35, build-tools 35.0.0, Java 8 source level and a JDK (or Java runtime plus Eclipse ECJ 3.39.0). From this directory:

```bash
export ANDROID_SDK_ROOT=/path/to/android-sdk
bash build.sh
```

Restore the existing private `signing/personal.jks` and `signing/password.txt` before building an update. They are deliberately excluded from Git. The build refuses to silently create a replacement signing identity. For a separate new installation only, set `HAL_CREATE_SIGNING_KEY=1`. A different key cannot update the previously installed app.

Output: `build/HAL-Desk-v2.0.apk`. The optional Android Studio/Gradle project uses AGP 8.7.3 / Gradle 8.9 / JDK 17; no wrapper is included. Studio can sync without private keys, but a release without a signing key is unsigned. The shell build is the route verified for this release.

## Checks

```bash
node tests/core.test.js
node --test tests/analytics.test.js
npm install
npx playwright install chromium
node tests/ui.test.js
```

An existing Chromium may be selected with `HAL_CHROMIUM_PATH`. UI tests run from this directory; fixtures use synthetic prices and 100-unit lots, never actual contract specifications. They are excluded from the APK. See `VERIFICATION.md` for results and device/feed limitations.

## License and privacy

Lightweight Charts 5.0.8 is bundled under Apache-2.0 with its copyright notice, full license and TradingView attribution. See `licenses/` and Settings → Open source notices. The application has no ads, telemetry, external JavaScript, or order API allowlist. Financial records are local to the app sandbox; Android automatic cloud backup and screenshots are disabled. Exported backups are ordinary private files under the user's control, not encrypted by the app. Uninstalling deletes the app's records and credentials.

This is an unofficial personal app, unaffiliated with HAL, NSE or Upstox.
