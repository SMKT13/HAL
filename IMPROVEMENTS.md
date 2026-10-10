# Repository review and improvement roadmap

Reviewed against `19e07078550e50963d1e93d6221bd59117011434` on 10 October 2026.

## What the original repository contains

A small standard-library Python web server, one HTML/CSS/JavaScript dashboard,
launchers, Docker/Render configuration and phone QR assets. The server fetches
HAL/NIFTY daily history from Yahoo Finance, calculates indicators and keeps a
disk cache. The page contains a 130-bar snapshot ending 9 October 2026,
hard-coded research, and defaults for one long futures and two long put legs.

There is no database, trade ledger, live news ingestion, sourced financial
statement pipeline, broker connection, native Android project or test suite
in that baseline. The quoted fundamentals and catalysts are prose, not a
maintained structured dataset. This review does not independently validate
those financial claims or confirm that the default positions remain open.

## Changes in this patch

| Original problem | Change |
| --- | --- |
| `render()` dereferenced missing `g1`/`g2` elements and stopped before charts/positions | Replaced the broken render path; regression tests execute against actual HTML IDs |
| `window.FB` could not see a top-level `const FB`; HTTP errors also bypassed fallback | Explicit snapshot global, response validation, archived fallback and last-good-response retention |
| `parseFloat(value) || default` reopened zero-quantity legs | Validated numeric state preserves zero and rejects invalid edits |
| Held futures/options silently changed month near expiry | Exact editable per-leg dates, with no automatic roll; models stop on the expiry date |
| Marks used fixed assumptions with no direct override | Editable IV/rate/yield, timestamped manual broker marks, realized P&L and costs |
| Archived action instructions appeared to be live signals | Dated collapsed archives; current cards describe measured indicators |
| A successful fetch could make an old quote appear current | Quote time, retrieval time, daily-bar date, cache mode and historical labels |
| Incomplete bars or short histories could break indicators | Validation, null warm-up values, neutral flat RSI/MFI, correct Wilder ATR seed |
| Pivots could use an unfinished daily candle | Completed-bar pivot basis with its date and documented conservative cutoff |
| Concurrent requests could overwrite the cache | Refresh lock and atomic cache replacement |
| No position-risk exploration | Same-expiry payoff scenarios and custom expiry-price input |
| README referenced missing deployment docs and obsolete positions | Updated standalone setup, valuation rules, deployment and data limitations |

## Recommended next work, in priority order

1. **Add source-linked HAL announcements and news.** Start with official HAL
   investor releases and exchange filings, then add permitted headline feeds.
   Store source URL, publisher, event date, publication time and retrieval time;
   deduplicate and label unconfirmed reports. Rank by HAL relevance and expose
   the original filing. Do not treat a headlines-only sentiment score as a
   trading signal.
2. **Build a sourced fundamentals history.** Import quarterly consolidated
   revenue, operating profit, PAT, operating cash flow, cash/debt, order book
   and delivery disclosures from original PDFs. Store units, reporting basis,
   period and source page, and compute YoY/TTM comparisons. Report extraction
   uncertainty and require verification before replacing historical notes.
3. **Use real contract identities and broker prices.** Add an authorized
   read-only broker or licensed market-data adapter for expiry, lot size,
   bid/ask, volume/open interest and marks. Keep its credentials on the server.
   A quote timestamp and liquidity check should accompany every F&O mark.
   Free delayed spot history does not establish executable derivative prices.
4. **Add a trade ledger and expiry operations.** Record fills, partial exits,
   realized P&L, charges and explicit two-leg rolls. Support broker-statement
   import with reconciliation. Add exchange-calendar and broker-margin data
   before estimating delivery obligations or producing expiry reminders.
5. **Extend risk analysis with tested assumptions.** Show delta/gamma/theta,
   explicit spot/IV/time shocks and hedge quantities. For different expiries,
   revalue each live leg at a named scenario date rather than adding expiry
   payoffs from different dates. Validate with broker references and fixed
   numerical cases before relying on outputs.
6. **Make it an installable phone companion.** Add a web manifest, icons and a
   service worker for the UI shell only. A failed quote fetch must remain
   visibly stale; do not cache an API response as if it were live. An Android
   APK and notifications are a separate build/deployment decision.
7. **Add continuous integration and browser QA.** Run the supplied regression
   commands on pull requests and add Chromium desktop/mobile viewport checks.
   Add authentication before sharing a deployment containing private research.

## Source references checked during this review

- [HAL financial results](https://hal-india.co.in/investors/financial-results)
- [HAL investor relations](https://hal-india.co.in/investor)
- [NSE derivative contract specifications](https://www.nseindia.com/static/products-services/equity-derivatives-contract-specifications)
- [NSE Clearing settlement-price methodology](https://www.nseclearing.in/clearing-settlement/equity-derivatives/settlement-price)

These links identify primary sources for future ingestion and contract
verification. The patch does not claim to have imported their current figures,
implemented a news feed or verified the archive's forecasts.

## Validation of this patch

- 19 Python regression tests passed, including real local HTTP requests.
- 16 Node tests passed, covering portfolio calculations and dashboard script
  execution against the page's actual element IDs.
- A live HAL provider fetch succeeded with 247 valid bars, ending 9 October
  2026, and a supplied quote timestamp of 9 October 2026, 15:15:01 IST.
- JavaScript/Python syntax checks and `git diff --check` passed.
- Real-browser visual QA remains pending: no Chromium executable was available
  and the attempted browser downloads did not return a usable archive. The
  DOM regression harness does not validate layout, file pickers or native date
  inputs. Deployment and Docker execution were not performed in this review.
