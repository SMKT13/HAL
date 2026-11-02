# HAL Desk 4 provider and financial constraints

Verified against official public documentation on 28 October 2026. Documentation verification does not constitute an authenticated live-data or entitlement test. No user account was accessed.

## Architecture decision

Direct Android HTTPS is compatible with Upstox's documented Analytics Token: free, read-only GET access, one-year validity and one token per account. Market quotes, history, option chain, market information, fundamentals, news and WebSocket authorization do not require a static IP. Account-specific portfolio/order-history/funds APIs do require registered static IP and are outside this app's scope. Accept user-entered Analytics Token; never embed it or request trade permissions.

Source: https://upstox.com/developer/api-documentation/analytics-token/ and https://upstox.com/developer/api-documentation/announcements/analytics-token-static-ip/

## Capability matrix

All REST paths below are relative to `https://api.upstox.com`; all use GET and `Authorization: Bearer ...`. Permission failures remain possible and must be visible.

| Requirement | Documented endpoint/source | Implementation condition |
|---|---|---|
| HAL equity/futures/options discovery | `/v2/instruments/search` or daily NSE BOD JSON | Search HAL with NSE + EQ/FUT/OPT filters. Match exact symbol, underlying, expiry and type; paginate, do not use fuzzy first result. |
| Verified units per lot | Instrument `lot_size`, `minimum_lot`; option contracts | Preserve retrieved metadata and date; never globally assume 150. |
| Exact saved-contract quotes | `/v3/market-quote/quotes?instrument_key=...` | Up to 500 keys. Join by returned `instrument_token`, not display-key string. |
| Spot/futures OHLC, volume, depth, OI | Same V3 full quote | `last_price`, `ohlc`, `depth.buy/sell`, `volume`, `oi`, `previous_oi`; absent fields stay null. |
| NIFTY 50 / India VIX | Same V3 quote | Discover index instrument keys from BOD/search and verify identity. |
| Options/expiries | `/v2/option/contract?instrument_key=...` | Optional exact `expiry_date`; response includes expiry, strike, lot size, type and underlying key. |
| Calls/puts chain | `/v2/option/chain?instrument_key=...&expiry_date=YYYY-MM-DD` | Exact listed expiry. Chain has no quote/trade timestamp in documented schema; supplement each candidate with V3 quote. |
| Daily/hourly/15m history | `/v3/historical-candle/{key}/{unit}/{interval}/{to}/{from}` | `days/1`, `hours/1`, `minutes/15`. Chunk requests to documented lookback ranges. |
| Current intraday candles | `/v3/historical-candle/intraday/{key}/{unit}/{interval}` | Remove incomplete candle before indicators. |
| NSE exchange status | `/v2/market/status/NSE` | Preserve `status`, `last_updated`; not a device-clock weekday guess. |
| News | `/v2/news?category=instrument_keys&instrument_keys=...` | HAL-specific category avoids account access. Page at 1–100, size 1–100. |
| Company fundamentals | `/v2/fundamentals/{isin}/{endpoint}` | Discover HAL ISIN, preserve provider periods/units. Endpoint list below. |
| Official NSE announcements | NSE's published RSS offering | Do not scrape undocumented website APIs. External official announcement link/manual note fallback if feed inaccessible. |
| Foreground streaming | `/v3/feed/market-data-feed/authorize` then authorized WSS URI | Binary Protobuf messages; separate observation store, never authoritative P&L marks. |
| HAL order backlog / guidance | No dedicated typed Upstox field verified | Only sourced filings/news/manual business notes; no inferred order-book total. |

### Instrument discovery

Search query supports `query`, `exchanges=NSE`, `segments=EQ,FUT,OPT,INDEX` (or separate requests), `instrument_types=CE,PE`, exact `expiry`, `page_number` and `records` (max 30). Pagination is `meta_data.page.total_pages`. Search response expiry may differ from BOD's epoch-millisecond expiry; parse each adapter explicitly. BOD JSON is preferred over deprecated CSV; files refresh about 06:00 and expired contracts disappear next trading day. Save the exact contract tuple and metadata with each leg so an expired key cannot silently resolve to a new contract.

Sources: https://upstox.com/developer/api-documentation/instrument-search/ ; https://upstox.com/developer/api-documentation/instruments/ ; https://upstox.com/developer/api-documentation/get-option-contracts/

### Full V3 quote and freshness

Response is `status`, `data` map, with map keys such as `NSE_EQ:HAL`; each item identifies itself via `instrument_token`. V3 `timestamp` is documented as response-generation time (ISO 8601 with offset), not last exchange trade time. `last_trade_time` is epoch milliseconds encoded as string. `previous_oi` is previous-session OI, distinct from intraday OI high/low. `prev_close_price` is separate from current-session `ohlc.close`. Validate all finite numbers and strictly positive live prices; empty zero-depth levels are not executable bids/asks. Keep manual zero marks valid.

Store: retrieval time, provider response time, exchange last-trade time, stream envelope time, last successful refresh, last failed refresh and failure reason. Fresh HTTP cannot certify fresh trading. For hedge eligibility, require both valid provider time and recent trade time; retain stale values as visibly cached observations for closed/offline markets.

Source: https://upstox.com/developer/api-documentation/get-full-market-quote-v3/

### Option chain and Greeks

Each row has expiry, strike, underlying key/spot and `call_options`/`put_options`. Each side has an exact instrument key, `market_data` (`ltp`, volume, OI, close, bid/ask prices/quantities, `prev_oi`) and `option_greeks` (delta, gamma, theta, vega, IV, POP). No source timestamps are documented. A REST quote join establishes LTP/depth timestamps but does not prove the chain Greeks were sampled at the same instant; label this limitation. IV examples use percentage values, so conversion to model decimal volatility must be explicit. Documentation does not precisely specify all Greek unit conventions; do not claim contract-accurate theta scaling until validated. POP must never be presented as a portfolio success probability.

Source: https://upstox.com/developer/api-documentation/get-pc-option-chain/

### Candles

Arrays have `[timestamp, open, high, low, close, volume, openInterest]`; timestamp is candle start. Minute history from January 2022: 1–15m requests span max one month, >15m max one quarter. Hour history from January 2022: max one quarter. Daily history from January 2000: max one decade. Availability does not guarantee HAL existed or every requested interval is populated. Sort ascending; reject duplicates/conflicts and invalid OHLC; only calculate completed-bar indicators. Daily completion must reflect exchange trading session and IST, not timestamp+24h blindly.

Source: https://upstox.com/developer/api-documentation/v3/get-historical-candle-data/

### News and fundamentals

News response `data` maps instrument keys to arrays; items have `heading`, `summary`, `thumbnail`, `article_link`, `published_time` (Unix ms). Pagination is `metadata.page`, not instrument search's `meta_data.page`. Render provider text as plain text; open only user-selected HTTPS links externally. No portfolio or private memos are needed for news requests.

Source: https://upstox.com/developer/api-documentation/get-news/

Fundamental endpoint suffixes:

- `profile`: company profile and sector; sector market cap is not HAL market cap.
- `income-statement?type=consolidated&time_period=yearly|quarterly&fs=true`: `data.units_in`, categories and history with period/value/change; full statement optional.
- `balance-sheet?type=consolidated&fs=true`: assets/liabilities history and full statement. Current detailed endpoint docs list type/fs, not quarterly query support.
- `cash-flow?type=consolidated&fs=true`: operating/investing/financing categories and history. Current detailed endpoint docs list type/fs, not quarterly query support.
- `share-holdings`: category and quarterly period/value arrays.
- `key-ratios`: name, company_value and sector_value strings, sometimes percentage strings; no explicit valuation-as-of timestamp shown.
- `corporate-actions`: name, expiry_date, amount, ratio and event_details; distinguish ex-dividend from record dates.
- `competitors`: array with instrument key, profile and sector metadata.

Sources: https://upstox.com/developer/api-documentation/fundamentals/ and the corresponding `get-company-profile/`, `get-income-statement/`, `get-balance-sheet/`, `get-cash-flow/`, `get-share-holdings/`, `get-key-ratios/`, `get-corporate-actions/`, `get-competitors/` pages.

NSE publishes an RSS subscription service for corporate announcements; exact usable announcement feed URL was not exposed in the retrieved page's text. Its website terms restrict automated scraping, so do not treat undocumented website JSON APIs as an approved free data feed. Fallback: official filings link and user-saved source notes.

Sources: https://www.nseindia.com/static/rss-feed ; https://www.nseindia.com/static/nse-terms-of-use ; https://www.nseindia.com/companies-listing/corporate-filings-announcements

### WebSocket V3

Authorization returns `data.authorized_redirect_uri`; the URI code is single-use. Validate WSS scheme and an exact configured Upstox feeder host or strict `.upstox.com` suffix boundary, reject userinfo/custom ports, and avoid bearer-token forwarding or logging the signed URI. Subscription is UTF-8 JSON sent as binary WebSocket frame, e.g. `{guid,method:"sub",data:{mode:"full",instrumentKeys:[...]}}`. Server frames decode with official V3 Protobuf schema. First message is market status, second snapshot, later live updates; `currentTs` is message-generation time and LTPC `ltt` is trade time. Accepting an envelope does not mean every instrument traded.

Official schema: https://assets.upstox.com/feed/market-data-feed/v3/MarketDataFeed.proto

Normal limits: two connections per user; full-only 2000 keys; mixed-mode full 1500 and LTPC/Greeks 2000 each. Full D30 needs Plus; ordinary full provides 5 levels. HAL Desk needs only one foreground connection. Close/cancel on stop; explicitly reconnect with fresh authorization and clear ordering state for the new session while validating timestamps. Duplicate/out-of-order frames must not update observation state.

Sources: https://upstox.com/developer/api-documentation/v3/get-market-data-feed/ ; https://upstox.com/developer/api-documentation/get-market-data-feed-authorize-v3/

Standard API rate limits: 50/s, 500/min, 2000/30min per API/user. Use one coalesced foreground refresh about every 60 seconds, independent slower research cache refresh, exponential backoff with jitter, Retry-After when present, cancellation and no overlapping refresh. Handle 401/403/429 separately without discarding last good cache.

Source: https://upstox.com/developer/api-documentation/rate-limiting/

## Financial acceptance requirements

- Exact historical HAL lot sizes were NOT verified by authenticated provider retrieval. NSE directs users to dated `NSE_FO_contract_ddmmyyyy.csv.gz`; a current lot-size file cannot certify old contract economics. The linked current `fo_mktlots.csv` could not be rendered by research tooling. Preserve legacy 150 as unverified historical metadata, never replace automatically.
- NSE individual-stock options are European and physically settled. Futures daily variation margin and final settlement cash movements must stay separate from economic strategy P&L to avoid double counting. Physical delivery, increased margins and broker cutoffs require user review; no generic promise of maximum cash funding.
- Quantity coverage is not delta neutrality and does not guarantee protection after puts expire. Report both current covered units and through-date covered units.
- Combined mixed-expiry scenarios require horizon no later than every open leg expiry. An earlier put's settlement cannot be reconstructed from a later hypothetical spot. Exact expiry intrinsic payoff is different from pre-expiry Black–Scholes estimates and is not an executable bid.
- Additional sampled loss should be measured versus current verified marks, while total strategy P&L uses entries plus closed outcomes minus charges. Hedge sale proceeds are cash, not profit. Deduct sell slippage from valid bid and add buy slippage to valid ask; never finance a candidate with assumed unavailable bid.
- Whole-lot quantity selection uses each candidate's verified lot size and explicit under/overcoverage. Mixed strikes and expiries remain individually visible.
- Missing marks, missing Greeks, stale data and inconsistent units yield unavailable aggregates. A true manually recorded zero is distinct from missing.

Sources: https://www.nseindia.com/static/products-services/equity-derivatives-individual-securities ; https://www.nseindia.com/static/products-services/equity-derivatives-contract-information

## Synthetic acceptance tests for adapters

1. Correctly join V3 quote map via instrument_token; absent requested key leaves missing mark.
2. Parse ISO quote timestamp and numeric/string epoch LTT separately; reject future/missing clocks.
3. HTTP success with old LTT stays stale; HTTP failure updates failure timestamp while retaining prior cache age.
4. Missing versus zero depth, IV, volume and OI remain semantically distinct.
5. Chain without exact quote timestamps is excluded from live hedge rankings with reason.
6. Discovery verifies HAL identity/type/expiry/strike/lot size and processes every page.
7. Candle parsing rejects invalid OHLC/duplicates and incomplete daily/hourly/15m candles.
8. Protobuf fixtures cover status, snapshot, live LTPC, unknown fields, malformed data, duplicate and out-of-order frames.
9. Stream updates cannot mutate verified REST marks or saved manual overrides.
10. Redirects and URLs never disclose tokens; 401/403/429/network/schema failures have honest separate UI states.
