## v3.1 — Position-first MVP update (23 October 2026)

HAL Desk 3.1 preserves the original v3.0 Android app identity, book, ledger, funding, protective puts, market data, news, technical/fundamental research and direct Gemini AI. Navigation retains **Today / My Position / Plan / Research**. Research now has **Markets / Company & Analysis / News / Insights / AI Desk**, with checkpoints and historical patterns in Insights. Plan offers **Stress test / Find a hedge**.

The user-approved removals are: (1) the Today four-tile quick-action row, (2) the detailed paper futures/puts rollover planner, and (3) its route-specific cash/funding/cost projections. Separate features retained: simple listed-futures carry spread in My Position → Risk; expiry-gap warnings; manual funding snapshots; scenario stress tests; put hedge comparisons (including gross cost, bid sale proceeds and net cash outlay); journal close accounting; and the archived October position template.

Old `rollover` preference fields remain validated in historical local books and backups for compatibility; the UI no longer edits them or provides route results to Gemini. Gemini remains the only native AI provider: **no OpenAI GPT API or additional AI integration** was added. Gemini can still consume quota or incur provider charges.

Version `3.1` / `versionCode 15` keeps Android application ID `in.smkt.haldesk` and the existing local storage origin. Export a private backup before updating. CI verifies an unsigned Android candidate; in-place upgrade requires the existing signing certificate. UI regressions use synthetic fixtures and do not verify physical-device, live broker or Google API access.

## v3.0 — Portfolio-first HAL UI redesign

HAL Desk 3.0 refreshes the Android presentation with a broker-inspired clean
dashboard, a four-tile quick-navigation row (My position, Risk, Find a hedge,
Rollover), underlined sub-tabs, minimal cards and clearer bottom navigation.
The redesigned dark/light palettes honour the user's previously saved theme.
It is an independent HAL Desk design inspired by general Groww UI patterns,
not affiliated with Groww and not a copy of Groww assets or source. Review
[PORTFOLIO_REDESIGN_AUDIT.md](PORTFOLIO_REDESIGN_AUDIT.md) for references, scope
and test/fidelity limits.

All contracts, book data, hedge/rollover engines, quote freshness, AI and
Skills Coach remain unchanged; no new broker order controls or API calls were
introduced. Same package in.smkt.haldesk, Android versionCode 14/versionName
3.0. Use the matching HAL signing identity to install over your current app.
Export a backup before updating.


## v2.9 — Trading Skills Coach for HAL NSE futures & options

Research → AI review → **Skills Coach** now runs a local, free checklist adapted from the
MIT-licensed [TraderMonty / dr-pabs Claude Trading Skills](TRADING_SKILLS_ATTRIBUTION.md).
It highlights saved-contract verification, quote freshness, user-defined loss
thresholds, funding freshness, futures-versus-put contract units, protection
expiry gaps, and rollover review. It never grants broker trade permission or
executes trades. The app's existing deterministic risk, hedge and rollover
engines remain authoritative; CHECKED simply means local evidence was present.

Optionally check the Gemini evidence-sharing consent and press **Run Skills
Coach** for **one** direct Gemini analysis (not the six-agent workflow). The
AI can explain documented assumptions and a thesis/invalidation checklist but
cannot invent lot sizes, fills, Greeks, margin or live prices. Your private
notes, journal memo text and broker credentials remain excluded from its
evidence packet. No US FMP/Alpaca API, Python runtime, or additional backend is
installed. The user must refresh and verify Upstox data for time-sensitive use.

Version code 13, versionName 2.9, same Android package `in.smkt.haldesk`.
Install only an APK signed with the previous HAL signing key over your existing
installation, and export a backup first.

## v2.8.1 — Avoid Gemini agent answer-limit errors

Fix: Android Agent Desk previously used a 2,000-token shared response budget per agent. Thinking tokens count toward this budget, so the Gemini model could reach `MAX_TOKENS` before producing a usable answer. Gemini 3/4 calls now request supported `thinkingLevel: low` and allow up to 8,192 combined output/thought tokens, while agent prompts request short evidence-backed findings (120 words each, 200 for the risk chair). Existing non-agent direct Gemini modes also use low thinking for Gemini 3/4.

This should substantially reduce answer-limit failures but cannot guarantee success for every model or lengthy question. No automatic retrial, additional implicit billable request, suppressed provider error or partial trading decision is added. A failed agent response reports the failed stage and does not present a fabricated completed review.

Android package `in.smkt.haldesk`, versionName **2.8.1**, versionCode **12**. Install over 2.8 using the original matching signing certificate; back up local records first.

## v2.8 — Experimental direct Gemini multi-agent review

The existing Android v2.7 Position Desk is preserved. In Research → AI review, select **Agent desk** and explicitly consent to the selected evidence. Six *sequential* Gemini API calls analyze technicals, business/news, saved F&O position, bull case, bear case and final risk-chair review. Each role is a distinct prompt with role-specific evidence, but all calls use the **same selected Gemini model**: this is not a set of independent model providers and it does not install or run upstream Python TradingAgents/LangGraph on Android.

Each role sees a bounded subset of the app-provided data. The final risk review is shown first; the five underlying analyst responses are expandable. The review makes no Upstox order calls, does not alter holdings, never retrieves live prices, and cannot replace deterministic P&L, expiry or hedge computations. Quotes must be refreshed in the app; stale/missing data remains a limitation. No report is saved in backups.

**Cost and privacy:** One explicit run makes up to six paid/quota-limited Google API calls instead of one. No background or automatic AI call is added. The Gemini key remains in native encrypted storage, only selected consented evidence goes to Google and progress/errors are visible. Stop can cancel future calls but cannot reverse completed provider requests or incurred charges. A fully successful six-stage run is required before final findings display. The existing Copilot and six-perspective single-call modes remain available.

The Android version is **2.8 (code 11)**, package `in.smkt.haldesk`. For an in-place upgrade from 2.7 preserve the original signing key; do not remove your existing app or clear its storage. GitHub CI creates only an unsigned APK. Live provider access, API billing and device installation require independent verification.

## v2.7 — Held-contract quotes and position context

The position desk now refreshes full put quotes for every active expiry in the saved book, using the existing read-only Upstox full-quote feed. One shared valuation feeds Today, My Position, the ledger, scenarios and AI. The regular market snapshot still supplies spot and futures; a newer full-feed futures quote can update the same verified contract. Per-contract quote/trade/retrieval clocks remain intact, and a newer spot/basic chain cannot relabel an old put quote as fresh. Missing strikes, mismatched lot sizes, failed/pending requests and clock errors retain explicit unavailable/saved states. Full held-quote refreshes reuse the existing endpoint and observe a 15-second retry cooldown.

Today also maps reported headlines to position-review questions. MoUs remain potential business, unconfirmed wording is labelled, and duplicate stories prefer the official source when available. Each card preserves publication time, source link, affected saved exposure, verification prompts and feed age. This is topic-based context, not independent verification or a numerical event-to-price forecast. Business checks show period-matched revenue, operating margin/profit and annual operating-cash-to-profit, with unknowns and partial/failed sources labelled. Direct Gemini receives this same position context only in consented position modes.

Foreground auto-refresh retains its existing one-minute setting and now refreshes held put expiries as well; provider permissions/rate limits still apply. Full expiry chains are fetched by the existing feed, rather than a new arbitrary-instrument quote route. When the app is closed or Android suspends it, no refresh/notification guarantee is made. Background notifications, broader NIFTY/sector/VIX context and selective hedge adjustment routes remain future work.

## v2.6 — Position desk foundation

The first position-centred rework is implemented in Android. Four primary destinations replace the six-item bottom bar: **Today, My Position, Plan, Research**. Markets, News and direct Gemini remain inside Research; Today opens a position-specific AI question without sending it automatically.

- **Today** starts with open P&L, units and next expiry. It adds net strategy P&L, verified-contract notional, net delta, owned put strikes/dates, review triggers, downside shocks and per-contract source clocks. Graphite and warm-paper themes use a restrained green accent.
- **My Position** keeps the book, risk, funding and journal tools. An optional profile records allocated capital, maximum net strategy loss, new-hedge budget, reserve and two spot review prices. Confirmation applies to the saved contracts for 24 hours; quantity, contract or entry edits invalidate it. No prior chat holding is silently loaded.
- **Plan** hosts the existing stress-test, hedge and rollover engines. Budget/reserve can be copied explicitly; a strategy loss limit is never copied into a planner's additional-loss field because the baselines differ. Comparisons never edit holdings or place trades.
- **AI** receives desk limits, triggered rules, data state and scenarios only in position modes with explicit consent. Research-only requests exclude them. Keys stay in native encrypted storage; no new server, permissions or automatic paid AI calls.

### Trust and calculations

`desk.js` is a pure review engine. Each leg requires exact contract units. A current mark requires retrieval/provider quote within two minutes, a last trade within fifteen minutes, no manual override and no failed/pending required refresh. Spot quote and trade must both be within two minutes. Basic option-chain rows lack individual clocks, so **Saved planning** is expected unless full contract timestamps are actually present. A fresh spot price does not make the whole basket fresh. This release does not add a new full-quote feed.

Saved snapshots support labelled structural/scenario review. Missing contract units/marks, expired legs, or failed/pending required feeds withhold scenarios; no IV is invented. The -3/-5/-10% table compares two model values at the same time and IV, avoiding false changes from quoted/model premium differences. It is not an executable P&L, terminal floor or forecast.

Futures cash loss is active futures units × spot × shock magnitude at constant basis, without crediting put gains or sale proceeds. Headroom subtracts that loss and the reserve from manual free funds. Funding expires after 24 hours; additional margin and price paths are not modelled. Net strategy P&L reuses open + realised − charges; put premium and settlement cash are not counted twice. Net return on allocated capital is not a money-weighted return or peak-to-trough drawdown.

Price triggers need a confirmed book and fresh spot. The strategy-loss trigger additionally needs a current full basket. These are review rules, not automatic suitability/trade recommendations. The profile is included in v2 backups; existing v1/v2 imports gain blank defaults. App storage origin and signing identity are preserved.

### Remaining agreed roadmap

This is the **position-desk foundation**, not the entire redesign. Remaining: unified full-quote refresh for held contracts; selective add/replace/reduce hedge comparisons; material-event impact mapping; NIFTY/sector/VIX context; fuller long-horizon ledger; best-effort on-device trading-day notifications. Existing foreground refresh remains. No background scheduler or notification permission is added. Physical-phone and user-token validation remain necessary.

# HAL Desk 2.5 — Android research and position monitor

Personal, read-only HAL app for Android 8+ with an updated Android System WebView. Package `in.smkt.haldesk`, version code 8. Preserve the original signing key and storage origin to update an existing installation without losing its saved book.

## New in 2.5 — intelligence and next rollover

- **AI → Know what changed:** save a local comparison point, then review spot, same-book open P&L, RSI and newly observed news URLs. Position edits withhold financial change comparisons. Checkpoints contain calculated metrics, not private notes or AI replies; they remain on this device and are separate from book backups.
- **AI → Historical pattern scanner:** load up to five years of completed daily bars, choose a 20/40/60/90-session window and 5/10/20/40-session outcome, then compare. Banded DTW compares log-price shapes with direction, volatility and 50-bar trend filters. Selected full pattern-plus-outcome windows never overlap, and all outcomes end before the current pattern starts. The chart overlays historical shapes without a projected future line. Median/range, adverse excursion and close drawdown describe selected observations, not forecast probabilities or a strategy backtest. Flat windows and large price discontinuities are excluded rather than adjusted. Missing, failed, refreshing or older-than-seven-day history withholds retained results.
- **Positions → My next rollover:** compare closing the saved current basket, rolling one futures lot and rolling your target quantity. Choose listed futures and put expiries, enter premium/loss limits, post-exit cash, incremental margin per new futures lot, reserve, charges, slippage and maximum spread; refresh full quotes and compare. Settings persist in version-2 book backups. Comparing never changes actual holdings.
- Gemini now receives more dated news, quarterly/annual financial history, ratios, technical indicators and feed-health flags. Optional shortcuts explain the calculated checkpoint, historical matches and rollover. Each request still requires sharing consent. App research mode excludes positions, journal, funding, checkpoint changes and rollover plans. Direct Google API and the key-paste fix are retained.

Rollover quotes require recent source times, acceptable spread, traded volume/OI and enough displayed bid/ask depth for exact contract units. Required chain failures or pending refreshes withhold choices. Zero or missing budgets and funding assumptions cannot produce a qualifying choice. The label **Lowest premium within entered limits** describes a calculation, not a best-trade claim or broker approval. Results re-evaluate every 30 seconds while visible.

**Funding:** entered cash is the amount available *after closing the old basket and paying all exit costs*. It must already reflect futures settlement and old put sale proceeds. The calculator does not add sale proceeds again. Required cash equals entered incremental margin per new lot × new lots + new put premium + entry charges + reserve. Carry points are exposure from the higher futures entry, not an additional upfront cash payment. Actual broker margin and delivery funding remain unverified.

**Loss baseline:** additional payoff loss starts from the old basket's quoted-bid liquidation value before exit friction. It includes old exit slippage/fees and new entry slippage/fees once. An exact terminal floor requires identical new futures/put expiry and fully matched units. Earlier puts disclose the calendar-day gap, with scenarios stopping at put expiry under constant futures basis; they cannot qualify against a full-futures-expiry loss limit. Puts outliving futures have unknown residual value. Terminal scenarios do not cap interim margin calls. Original realised P&L and recorded charges reconcile separately to strategy net without double counting option premium or settlement cash.

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
- Active hedge quantity coverage, unit-based delta/theta when every put chain is complete and recently retrieved, expiry timeline and expiry-gap warnings. The simple carry view is a non-executable futures LTP spread; the new rollover workspace uses full bid/ask quotes.
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

Output: `build/HAL-Desk-v2.5.apk`. The optional Android Studio/Gradle project uses AGP 8.7.3 / Gradle 8.9 / JDK 21; no wrapper is included. Studio can sync without private keys, but a release without a signing key is unsigned. The shell build is the route verified for this release. It uses the installed Android SDK tools and standard platform APIs only; no AI dependency or model downloads are performed by the build.

## Checks

```bash
node tests/core.test.js
node --test tests/analytics.test.js tests/hedge.test.js tests/intelligence.test.js
npm install
npx playwright install chromium
node tests/ui.test.js
node tests/ai-ui.test.js
node tests/intelligence-ui.test.js
bash tests/test-native-ai.sh
```

An existing Chromium may be selected with `HAL_CHROMIUM_PATH`. UI tests run from this directory; fixtures use synthetic prices and 100/150-unit lots, never inferred current contract specifications. Native REST tests mock HTTPS and use a checksum-pinned, test-only org.json jar; it is never packaged into the APK. Set `HAL_JSON_JAR` to a predownloaded copy and `ECJ_JAR` if javac is unavailable. Tests are excluded from the APK. See `VERIFICATION.md` for results and device/feed limitations.

## License and privacy

Lightweight Charts 5.0.8 is bundled under Apache-2.0 with its copyright notice, full license and TradingView attribution. See `licenses/` and Settings → Open source notices. The application has no ads, telemetry, external JavaScript, or order API allowlist. Saved financial records stay in the app sandbox; selected evidence is sent directly to Google only for user-initiated AI requests as described above. Android automatic cloud backup and screenshots are disabled. Exported backups are ordinary private files under the user's control, not encrypted by the app. Uninstalling deletes the app's records and credentials.

This is an unofficial personal app, unaffiliated with HAL, NSE or Upstox.

