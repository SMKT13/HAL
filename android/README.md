# HAL Desk 2.4.1 — Android research and position monitor

Personal, read-only HAL app for Android 8+ with an updated Android System WebView. Package `in.smkt.haldesk`, version code 7. Preserve the original signing key and storage origin to update an existing installation without losing its saved book.

## Fixed in 2.4.1 — API key paste

The native key field no longer silently truncates at 256 characters or rejects dots. It accepts header-safe opaque keys up to 8,192 characters, including long authorization-key formats. Pasted whitespace, line wrapping, common invisible separators and matching quote wrappers are cleaned before secure storage. Empty input retains a saved key. Incomplete, oversized and unsupported-character errors are distinguished; Google checks actual key validity on an explicit review request. Neither keys nor clipboard content are logged or exposed to the page.

## New in 2.4 — direct Gemini API

The sixth **AI** tab calls Google's Gemini API directly from Android over HTTPS. No HAL backend, website or downloaded model is needed. The React/web interface keeps its existing server-side Gemini integration.

1. Install the signed APK over the existing app. Keep the original signing key and app data.
2. Open **AI → Gemini settings**. Paste your own Gemini API key in the masked native dialog, and choose a Gemini text model. The default is `gemini-3.8-flash`; model access is controlled by Google.
3. Refresh the market/research data you want to review, choose a mode and question, check the evidence-sharing checkbox, then press **Ask** or **Run**.

**Position Copilot** explains the shared engine's calculated marks, ledger, risk and hedge limitations. **Six perspectives** asks one model for six views: technicals, business, news, derivatives, risk and synthesis. **App research** shares fetched research and the question without the position book or ledger. AI has no web-search tools; refresh Research/News for newer app evidence. Missing or stale inputs remain labelled, and app calculations remain authoritative.

The request lists the selected evidence before sharing. For position reviews this includes open legs, calculated P&L/charges, funding, hedge settings, risk and fetched research. Private notes, bookmarks, free-text journal entries and broker credentials are excluded. Only the key entered in the native dialog is used for authentication; it is never exposed to JavaScript, exports or source control. It is encrypted with Android Keystore, sent only in Google's `x-goog-api-key` HTTPS header, and can be removed independently of market credentials. The provider host is fixed and redirects are rejected. Reading saved settings does not contact Google or validate the key; the first explicit generation verifies access. Internet and Google API quota/billing are required.

AI replies and evidence are transient, never cached/exported by the app. Provider processing is subject to your Google API account's terms. Stop disconnects the request and suppresses a late answer; it cannot undo data already sent or guarantee that Google stops processing/billing. Errors for rejected keys, missing models, quota, network timeout and incomplete answers are explicit. Earlier replies are discarded if the question, mode, API settings or saved financial book changes. The feature has no trading tools or order endpoints.

Official REST reference: https://ai.google.dev/api/generate-content . Current models: https://ai.google.dev/gemini-api/docs/models . No Google SDK, model weights, native inference library or third-party runtime is added to the APK.

## New in 2.1 — Find a hedge

Positions → Find a hedge compares one new protective-put contract against the saved long-futures basket and all existing puts, without changing positions or placing orders. Enter the total new-hedge budget, the maximum acceptable **additional loss from now in sampled scenarios**, and a protection end date. Settings are included in version-2 backups; older backups receive empty/default hedge settings.

- Three transparent categories: lower cost, balanced and stronger protection. A contract may win multiple categories. All winners must satisfy budget, sampled-loss, date, quote-quality and exact whole-lot quantity requirements. No qualifying contract means no shortlist.
- All currently listed put expiries on/after the protection date are examined. Missing/failed/stale required expiry feeds pause rankings. The horizon cannot extend beyond the earliest saved futures expiry. Earlier existing puts are valued only through their own first expiry; later keep-current values are unavailable rather than invented. A protection date or candidate put ending before later futures triggers a gap warning.
- The new `hedges` research section enriches verified HAL PE chain keys with full market quotes in batches of 100. Per-contract bid/ask, top quantities, provider quote/trade timestamps, volume and OI are retained. Source timestamps are never replaced by request times. Only fixed read-only GET endpoints are used.
- Quotes and chain retrievals must be within 120 seconds, with no clock lead above 60 seconds. Option/futures trades must be within 15 minutes, spot trades within 2 minutes. Puts require positive volume/OI, valid IV/delta/theta, an uncrossed positive bid/ask within the user spread limit, and sufficient displayed top quantity for the whole purchase or existing-put sale. Same-contract existing legs are aggregated for depth checks. These are conservative filters, not execution guarantees.
- New cost is ask × (1 + slippage) × matched units + entered buy charges. The budget is tested **before** existing-put credits. Existing sale proceeds are bid × (1 − slippage) × existing units. Net cash outlay adds exit charges and subtracts those proceeds. Charges are explicit total estimates, not inferred tax calculations.
- Additional replacement P&L equals futures change from current LTP + future model value of the new puts − new hedge cost + old sale proceeds − old current bid value − exit charges. Thus asset-sale proceeds are not treated as new profit. An optional entry-based view reconciles to the original saved open entries; historical journal charges and already-closed trades are excluded.
- Scenario grid: unchanged, −3%, −5%, −10% HAL at now, midpoint, protection date, plus intervening existing-put expiry checkpoints. The largest sampled loss is **not a guaranteed maximum loss**, VaR or probability. European Black–Scholes uses provider IV plus the editable shift; futures preserve current basis until expiry, then settle at scenario spot. Models do not infer earlier settlement from a later spot, financing, margin calls or physical-delivery funding.
- Lower cost minimises gross new hedge cost. Stronger protection minimises largest sampled loss. Balanced minimises squared normalised cost plus squared normalised sampled loss, equally weighted within qualifying candidates. Ties use cost, spread, expiry and strike. Bid/ask, IV/Greeks, timestamps, exclusions and exact costs are available for review.

Default assumptions are 0.5% slippage per side, 10% maximum spread, zero entered charges, 6% annual interest, zero dividend yield and zero IV shift. Zero charges produce an explicit exclusion notice. Change these to reflect the intended comparison; they are not fetched costs or market rates. Manual position marks are not used by this finder.

Hedge quote refresh is user-initiated. Results are re-evaluated every 30 seconds while visible and rankings disappear as inputs expire. Server packets cache for 30 seconds; original chain cache times remain visible to the validator. Fresh comparisons generally require an open market. The broader quote desk can still display labelled older snapshots outside market hours.

API contracts: [Upstox full market quotes](https://upstox.com/developer/api-documentation/get-full-market-quote/), [option contracts](https://upstox.com/developer/api-documentation/get-option-contracts/), [put/call option chain](https://upstox.com/developer/api-documentation/get-pc-option-chain/).

## Stage 1 and Stage 2

- Six screens: Overview, Positions, Markets, Research, News and AI. Graphite dark, paper light and device theme; responsive phone layouts, accessible controls and source timestamps.
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

No trading, orders, automatic rollovers, background workers or Stage 3 notifications are included. Gemini API usage may incur provider charges.

## Data and refresh

Official Upstox endpoints supply instrument search, quotes, option contracts/chains, V3 candles, news, fundamentals and NSE status. The app discovers HAL rather than hardcoding provider instrument tokens. Research refreshes independently of the main quote request. Financials cache for six hours; news, filings and candles for 15 minutes; market status and extra expiry chains for one minute. NSE RSS provides a rolling window; an empty HAL result does not prove that no disclosure exists. The news request returns up to 100 items from the provider's recent seven-day window.

Use an Upstox Analytics Token where available for read-only research. Token validity, access and quotas remain provider-controlled. A normal OAuth access token can expire daily. Replace credentials in the native Connection dialog when rejected; do not put them in Git or chat. The app does not implement OAuth login or renewal.

Direct mode works without Render. Server mode requires the accompanying backend changes to be deployed and both `UPSTOX_ACCESS_TOKEN` and the separate `HAL_VIEWER_KEY` configured. The backend's new `/api/upstox/research` endpoint uses the same viewer-key gate. Existing Yahoo-based web routes remain independent.

## Calculation boundaries

Chain retrieval time is not a per-option trade timestamp. Greeks remain indicative even when fetched recently; basket Greeks are withheld for missing, failed, mismatched or more-than-two-minute-old chain inputs. P&L marks may be old and are labelled by source/time. Structural quantity matching does not guarantee a downside floor across different strikes or expiries.

Scenario values are model estimates, not forecasts or executable prices. The model does not infer the price path through an earlier expiry, margin needs or settlement deliveries. Its 6% rate and 0% dividend defaults are editable assumptions, not fetched market inputs. Model P&L is before costs. Journal net subtracts recorded costs once; option premium is already included through entry-to-mark/exit P&L. Futures settlement cash is not added to P&L again.

Historical valuation multiples, automatic extraction of order-book figures from PDFs, broker position sync, continuous P&L history and background alerts are outside this release. Missing financial fields stay missing rather than being scraped from unreliable substitutes.

## Build and signing

Verified build route: Android SDK platform 35, build-tools 35.0.0, Java 8 source level and JDK 21 (or Java 17 runtime plus Eclipse ECJ 3.39.0). From this directory:

```bash
export ANDROID_SDK_ROOT=/path/to/android-sdk
bash build.sh
```

Restore the existing private `signing/personal.jks` and `signing/password.txt` before building an update. They are deliberately excluded from Git. The build refuses to silently create a replacement signing identity. For a separate new installation only, set `HAL_CREATE_SIGNING_KEY=1`. A different key cannot update the previously installed app.

Output: `build/HAL-Desk-v2.4.1.apk`. The optional Android Studio/Gradle project uses AGP 8.7.3 / Gradle 8.9 / JDK 21; no wrapper is included. Studio can sync without private keys, but a release without a signing key is unsigned. The shell build is the route verified for this release. It uses the installed Android SDK tools and standard platform APIs only; no AI dependency or model downloads are performed by the build.

## Checks

```bash
node tests/core.test.js
node --test tests/analytics.test.js tests/hedge.test.js
npm install
npx playwright install chromium
node tests/ui.test.js
node tests/ai-ui.test.js
bash tests/test-native-ai.sh
```

An existing Chromium may be selected with `HAL_CHROMIUM_PATH`. UI tests run from this directory; fixtures use synthetic prices and 100-unit lots, never actual contract specifications. Native REST tests mock HTTPS and use a checksum-pinned, test-only org.json jar; it is never packaged into the APK. Set `HAL_JSON_JAR` to a predownloaded copy and `ECJ_JAR` if javac is unavailable. Tests are excluded from the APK. See `VERIFICATION.md` for results and device/feed limitations.

## License and privacy

Lightweight Charts 5.0.8 is bundled under Apache-2.0 with its copyright notice, full license and TradingView attribution. See `licenses/` and Settings → Open source notices. The application has no ads, telemetry, external JavaScript, or order API allowlist. Saved financial records stay in the app sandbox; selected evidence is sent directly to Google only for user-initiated AI requests as described above. Android automatic cloud backup and screenshots are disabled. Exported backups are ordinary private files under the user's control, not encrypted by the app. Uninstalling deletes the app's records and credentials.

This is an unofficial personal app, unaffiliated with HAL, NSE or Upstox.
