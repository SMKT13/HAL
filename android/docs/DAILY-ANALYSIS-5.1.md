# HAL Desk 5.1 — Evidence-led Daily Analysis

## What changed
A read-only daily interpretation is available at **Technicals → Daily Analysis**, with a summary card on **Position → Overview**. It uses the existing Upstox Analytics Token and the local saved book; Gemini is **not required**. The feature never places orders or changes positions, charges, journals, marks or backup state.

The report turns data into conditional, explainable observations:
- Completed daily HAL cash candles are the **sole** price basis for the dated trend verdict. Previous close, participation, SMA20/50/200, RSI and MACD explain **why** the verdict is recovery, bearish caution, neutral or a conditional improving trend.
- Levels are selected from **real** recent daily highs/lows, available averages and next-session classic pivots; bullish/range/bearish scenarios describe **what would change the view**, not automated entry, exit, stop or profit guarantees.
- Market context compares HAL daily performance with Nifty 50 only when the quote timestamp matches the HAL analysis date. India VIX is displayed only with a matching dated provider quote.
- Recognizable **provider-reported** financial fields are accompanied by their original field path, reporting period, unit, source and retrieval time. No YoY growth, earnings acceleration or fair-value claim is inferred from one period. Missing figures remain unavailable.
- Recent dated Upstox and NSE headline metadata are classified as **potential relevance**, with source/date, not as verified full-article content or proven price causation. News is never invented.
- Actual saved futures and put quantities generate a nominal coverage and **expiry continuity** review, including the closest put strike vs the completed cash close. Quantity coverage is **not** a guaranteed economic loss floor. The app keeps its existing actual-book accounting engine and withholds unconfirmed, stale, manually marked or incomplete basket P&L.

## User workflow
1. Confirm actual positions under **Position → Book**, including listed contract identities, lots, expiry, strikes and executed entry prices.
2. Configure a read-only Upstox Analytics Token and refresh HAL daily candles and research feeds. The app continues to display saved evidence offline with a historical/cached label.
3. Open **Technicals → Daily Analysis**, read the dated verdict and the six components: technical drivers; levels and scenarios; market context; source-backed fundamentals; owned hedge risks; news and limitations.
4. For put expiry warnings, use **Position → Find a hedge**, where exact listed contracts, bid/ask, liquidity, fees and scenario risks are compared separately. A report does **not** select or execute a hedge.
5. Use **Position → Overview** for the short summary and a direct link to the report.

## Provenance and fail-closed behaviour
- At least **50 validated completed daily bars** are required for a directional verdict. Insufficient or future-dated data withhold it.
- A dated last-completed-bar close is not labelled a live price. Cached, stale or integrity-flagged evidence is clearly labelled. The report is recalculated locally during rendering; there is no hidden Gemini call or server-generated recommendation.
- Values are kept separate across sources and timestamps. Spot is **not** used to estimate December futures P&L; no quote is invented for a held option.
- Exact current P&L requires a confirmed book plus complete, non-manual, non-cached marks from the existing valuation engine. Otherwise the Analysis panel displays **Withheld**.
- Protection-gap warnings reflect **calendar expiries** and nominal lot sizes. Broker exercise windows, variation margin and physical settlement must still be verified externally.
- JavaScript UI strings are HTML-escaped. Headline links pass through the existing native URL allowlist.
- There are no embedded 19 Nov 2026 market numbers or demo holdings.

## Verification
- `npm test`: the new `tests/analysis5.test.js` covers rebound vs reversal, missing data, same-date benchmark comparison, provider financial provenance, strike-distance explanations, expiry mismatch and verified-mark boundaries.
- `npm run test:ui`: the added browser check navigates to Daily Analysis, verifies its major narrative sections and asserts the saved book was not changed.
- Android release remains `in.smkt.haldesk`, minSdk 26, book schema 4, versionCode 34 and versionName 5.1.0. Private signing with the existing certificate is mandatory for a seamless update.
- CI/GitHub Actions is intentionally **not** triggered. A full Android SDK, WebView/device validation, local build, and private signing remain necessary before labeling any APK installed or release-verified.
