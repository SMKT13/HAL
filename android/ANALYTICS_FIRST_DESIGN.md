# HAL Desk — Analytics-first redesign (27 Oct 2026)

## Purpose and design constraints

Make the Upstox **read-only Analytics Token** the primary official market-data connection for the personal Android app. Keep the installed app identity `in.smkt.haldesk`, locally saved `hal_desk_v2` book, journal and risk limits, encrypted Android Keystore token, direct Gemini optional integration, on-device FinBERT optional download, portfolio-first 4 destinations, and current standalone read-only/no-trade policy. Do not require Render, a paid server, an OpenAI subscription, or real-trade access.

**Do not** reintroduce the removed detailed rollover planner, rollover cash-route projections, or quick-action tiles. Keep listed-futures **carry spread**, expiry mismatch warnings, stress tests, Find a hedge, verified quotes, ledger/partial closes, manual funding, position confirmation, evidence-first research, backup compatibility and consent-only AI.

### Source of truth

1. Broker **market feeds** provide quotes, last-trade timestamps, option chain, OI, Greeks, historical candles, news and fundamentals. Each resource keeps its own provider timestamp, retrieval timestamp, request status and access requirements.
2. **Local journal/book** provides recorded entries, position units, partial closes, realised P&L, fees, user limits and optional manual funding. Never auto-fill from a previous conversation or mix expired legs into active coverage.
3. **Deterministic calculations** `core.js`, `analytics.js`, `desk.js`, `hedge.js` produce portfolio P&L, risk, expiry gaps and scenarios. AI may explain, not overwrite, these.
4. **A dated research layer** presents verified NSE/Upstox source links, financial statement basis/period, and optional on-device sentiment (confidence describes a classifier score, not stock-return probability).

Never label a record `LIVE` merely because its HTTP request succeeded. Provider last-trade and quote times must be displayed separately from fetch time. Null and missing marks are not zero; incomplete basket P&L must be marked indicative/incomplete rather than fabricated.

## Broker capability / app feature map

| API and data | Features | Current implementation | Limits |
| --- | --- | --- | --- |
| Instruments & listed contracts (equity, F&O expiry, size) | exact HAL futures/put identity; lot checks; expiry timeline | Existing Android | Contract masters change; old expiries need archiving |
| Market quotes (spot, futures, full held-put quotes, depth, OI, volume, previous close) | mark-to-market, liquidity checks, spread and carry | Existing Android (mostly V2) | Trade time and quote age differ; strict freshness gating |
| Option chain (bid/ask, OI, prior OI, IV, Greeks, strike, expiry) | protective coverage, Find a hedge; alternative cost/liquidity comparisons | Existing Android | Mixed expiries have no guaranteed later floor; IV is a snapshot, not forecast |
| Historical V3 candles (price, volume, derivatives OI when available) | RSI/MACD, trend, SMA, support levels, pattern scanner | Existing Android | Completed candles only for stable indicator signals; expired F&O data may require Plus |
| Fundamental APIs (statements, ratios, shareholding, corporate actions, peers) | business checks, fundamentals, event review triggers | Existing Android | Missing entitlements/periods remain unavailable |
| News + external NSE corporate RSS | position-relevant headlines, official disclosure links; optional offline FinBERT | Existing Android | Source quality and retention window vary; classifier is not predicted returns |
| Market info/status | NSE session state and market-hours labels | Existing Android | No assumed trading day from device time alone |
| V3 index full quotes (NIFTY 50, India VIX) | portfolio-first market environment and Research market pulse | **Added by this feature branch** | Reads only two fixed index keys; quotes can be stale; no VIX-derived entry signals |
| V3 WebSocket `ltpc`, `full`, `option_greeks` | foreground live quote streaming, intra-session event log, reduced manual refresh | **Phase 2** | binary Protobuf, subscription/connection limits, reconnect + rate budget; never guarantee background data |
| Charges and margin calculators (public/read-only GET where eligible) | *estimated* trade/hedge fees and margin requirements | **Phase 2** | never substitute calculations for actual broker funding |
| Broker profile, holdings, positions, order/trade book, account funds and P&L | reconciliation, real margin/headroom, realised fills and charges | **Phase 3 optional** | requires a **whitelisted static IP** and separate secure opt-in backend; never route these via Android direct token |
| IPO and other market categories | only if individually relevant to HAL context | Not included in HAL portfolio screen | Not all API endpoints add value to this strategy |

Source categories: https://upstox.com/developer/api-documentation/analytics-token/
Market data feed V3: https://upstox.com/developer/api-documentation/v3/get-market-data-feed/
Full quotes V3: https://upstox.com/developer/api-documentation/get-full-market-quote-v3/

## Home — Today

1. **My open strategy**, not spot chart: verified/missing/incomplete open P&L, net/realised P&L, futures units, total put units and next expiry. Never preload saved position from chat.
2. **Market environment**: NIFTY 50 and India VIX official V3 quotes, percentage vs previous close if provider close exists, last trade time/status, retrieval time. Do not infer market regime from only two values.
3. **Protection you own**: listed strikes, matched-units percentage, days before futures expiry that hedge stops protecting. A 100% unit match with an earlier expiry is **not** a terminal floor.
4. **What needs review**: actual quote age/failed refresh, next expiry, loss/risk-limit breach from confirmed book, missing funds confirmation, option liquidity, HAL official-source developments.
5. **Shock preview**: -3%/-5%/-10% futures cash stress with put scenario outcomes under dated IV assumptions; keep potential physical delivery and interim margin issues prominent.
6. **Research changes**: dated fundamental comparisons/news/filings and voluntary Gemini/FinBERT explanations. No scheduled paid AI refresh.

## Navigation — retain four destinations

- **Today**: strategy overview, market environment, alerts, protection, recent developments.
- **My Position**: manual multi-leg journal/position editor, verified quotes, open/realized/net P&L, risk/Greeks, expires/carry and manual margin snapshots. Consent-based broker reconciliation *future phase only*.
- **Plan**: Stress test and Find a hedge; compare kept basket vs replacement, premium cost, fees, coverage and expiry mismatch; no trade operation.
- **Research**: Markets, Company & Analysis, News, Insights and Gemini AI Desk. Include the same market pulse in Markets so source claims match Today.

## Implementation and release gates

**Phase 1 in this branch**: Add a fixed-index V3 quote reader, safe GET destination allowlist, error-isolated `context` packet, display tiles and source-clock readouts in Today and Markets, initial refresh + cache TTL, no position edits, no paid/cloud AI calls, synthetic unit/UI tests. Retain server compatibility but prefer direct token.

**Phase 2 — incremental implementation in this branch (V3 futures participation)**: A separate `participation` research feed retrieves Upstox V3 full market quotes for discovered, listed HAL futures. It keeps existing V2 position valuation as the P&L source of truth, while displaying V3 price change vs previous close, OI change vs previous session, volume, top-of-book bid/ask spread, and separate provider quote/trade clocks. This is marked *observation*, not a trade recommendation. The Today screen restricts the view to saved futures expiries when available; Markets can show all fetched expiries. No account APIs, orders, static-IP assumption or new credentials are introduced. This branch adds deterministic JS/browser regressions but still needs actual token/on-phone validation.

**Remaining Phase 2**: Shared quote-clocked data store, token-expiry reminder based on explicit user-supplied creation date (do not infer type), selective V3 market/greek requests, WebSocket V3 foreground reconnect, richer HAL option OI-change and price/volume/IV breakdown, low-volatility timeout and rate-limit backoff; scenario "risk" hints explain evidence not guaranteed performance.

**Phase 3 optional**: Account read-only reconciliation using whitelist-approved static egress IP; separate vault/backend and explicit consent, no credentials in JS, no blind migration from local manual book, audit reconciliation differences instead of silently overwriting.

**Release gates**: Node/Playwright and native Android regression tests, Gradle unsigned build, strict no-writes check, no secret in JS/log/backups, quote status accurate on market close or network failure, same package/signing identity for upgrade, on-device live token smoke test, export backup before install. Only a candidate/PR is produced until checks pass; a new signed APK requires the existing signing key.
