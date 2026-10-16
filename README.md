# HAL — Market & Position Desk

A personal web dashboard for Hindustan Aeronautics (NSE: HAL), with delayed
market data, technical indicators and a locally saved long futures/puts book.
The Python server uses only the standard library. No account or API key is
required. This repository is a browser app, not an Android APK.

## Run

Use Python 3.10 or later:

```sh
python3 server.py
```

Open `http://localhost:8000`. On Windows, use `run.bat`; on Mac/Linux, use
`sh run.sh`. A phone on the same trusted Wi-Fi can use `http://<pc-ip>:8000`.
The server listens on all interfaces. `PORT` defaults to `8000`.

## What is available

- HAL quote, daily OHLCV candles, SMA20/50/200, Wilder RSI/ATR, MACD, MFI,
  Bollinger calculations and 20-return annualized historical volatility.
- Descriptive trend levels and pivots based on the latest completed daily bar.
  A same-day bar is treated as provisional until 16:00 IST, a conservative local
  cutoff rather than an exchange calendar. There is no live holiday calendar.
- Optional NIFTY context, with beta/correlation from up to 60 date-aligned
  simple returns. At least 40 paired prices are required.
- Separate labels for newly retrieved data, a warm cache, a failed-refresh
  cache and the embedded **9 October 2026 archived snapshot**. Provider quote
  time, retrieval time and latest daily-bar date are shown separately.
- Editable long futures and two long put legs: quantities, entry prices,
  contract dates, put strikes/IV, broker-mark overrides, realized P&L, costs,
  interest-rate and dividend-yield assumptions.
- Expiry payoff scenarios for active legs sharing the same expiry, plus a
  custom scenario price. Different expiries are explicitly unsupported by the
  simple payoff table.
- JSON position export/import. Existing `halpos2` quantities/entries migrate
  to `halpos3` on the next edit; zero quantities remain zero. Corrupt or blocked
  local storage does not crash the page.
- The original trading and fundamental notes, preserved in collapsed,
  prominently dated archive sections. They are not current verified analysis.

## Position and valuation rules

Initial holdings reproduce the original repository's October 2026 book and
the prior realized loss. They are **defaults, not confirmation of your actual
holdings**. Verify and edit them. Quantities are units, not lots. The initial
lot size (150) is also a stored assumption; verify the actual contract.

- Enter `0` quantity for a closed leg. Closing a leg does not automatically
  transfer its profit/loss into realized P&L; update that field yourself.
- A manual broker mark, including `0`, overrides a model. Its entry timestamp
  is shown. Clear it to restore model valuation. It does not refresh itself.
- Contract dates never change automatically. Confirm the exact exchange date,
  including holiday changes. Models stop on the expiry date in IST; enter an
  actual broker/settlement mark, or record the leg as closed.
- Futures use continuous cost of carry, `spot × exp((r − q) × T)`. Puts use
  European Black–Scholes with editable fixed IV and continuous dividend yield.
  `T` uses calendar days between the displayed spot session and entered expiry,
  divided by 365. There is no intraday time-decay or discrete-dividend model.
- Model estimates are not executable F&O quotes, margin requirements or
  settlement amounts. Archived/stale spot inputs produce historical estimates.
- All-in P&L = open-leg P&L + entered realized P&L − entered costs. Charges,
  slippage, delivery funding and taxes are not calculated automatically.
- Positions are stored in this browser only and are never sent to the Python
  API. Export a backup before clearing browser storage or switching devices.

NSE specifies last-Tuesday monthly stock-derivative expiry, moved to the
previous trading day when that Tuesday is a holiday. Use the actual contract
date, not a weekday calculation. See [NSE contract specifications](https://www.nseindia.com/static/products-services/equity-derivatives-contract-specifications).

## Market-data behavior

Yahoo Finance chart endpoints are an unofficial integration with no service
guarantee. Quotes can be delayed; the app does not promise a fixed 15-minute
delay. Successful retrieval does not prove that the quote itself is current.

The browser refreshes every five minutes. Server cache TTL is 15 minutes.
Manual refresh bypasses that TTL, with a 30-second minimum between successful
fetches. Concurrent refreshes share a lock and cache writes use atomic replace.
Invalid/incomplete/non-finite OHLCV bars are discarded; insufficient indicator
history becomes `null`, not zero. An old cache is retained if a refresh fails.
NIFTY failure does not discard a valid HAL response.

If both the API and server cache are unavailable, the browser shows the
embedded dated snapshot. All four browser/server files must be present; opening
`index.html` directly can show that snapshot but cannot fetch fresh server data.

### Endpoints

| Path | Purpose |
| --- | --- |
| `/` | Dashboard |
| `/api/data` | Validated quote/history/indicators; HTTP 503 when no usable server data exists |
| `/api/data?force=1` | Request refresh, subject to the 30-second successful-fetch floor |
| `/health` | Process health, without calling a market provider |

API schema version 2 includes `data_status`, `quote_as_of`, `fetched_at_iso`,
`last_session`, `provisional_bar` and `cache_age_seconds`. Old cache schemas
are ignored. Contract valuation moved from the server's auto-rolling `fno`
block into the browser's explicit saved portfolio; that legacy block and
hard-coded trading targets are no longer returned by the API.

## Verification

Python tests use only the standard library. JavaScript tests require Node 20+
and use its built-in test runner; no npm installation is needed.

```sh
python3 -m unittest discover -s tests -v
node --test tests/*.test.js
```

Tests cover indicator edges, incomplete history, previous-session selection,
cache corruption/outages/concurrency, HTTP routes, portfolio math, expiry,
zero values, storage failures and actual dashboard-script execution against
the page's element IDs. The DOM harness is not a real-browser layout test.

## Deployment and files

The included `render.yaml` starts `python server.py` and uses `/health`.
The Dockerfile copies all required scripts; build with `docker build -t hal .`
and run with `docker run --rm -p 8000:8000 hal`.

| File | Role |
| --- | --- |
| `server.py` | Data validation, indicators, cache and HTTP |
| `index.html` | Responsive layout, archived notes and embedded snapshot |
| `dashboard.js` | Rendering, loading, storage and charts |
| `portfolio.js` | Validated position model and payoff calculations |
| `tests/` | Offline regression suite |
| `IMPROVEMENTS.md` | Review findings, implemented fixes and prioritized next steps |
| `cache.json` | Generated local cache; ignored by Git |

This is a personal tool with no authentication layer. The original embedded
holdings/research are visible to anyone who can load the page; review them
before exposing a deployment publicly. Educational analysis only; verify
prices and settlement obligations with your broker.



## New: Research Agent Desk

Open **/agents** or tap **Agent desk** in the dashboard's mobile navigation.
The added \`/api/agents\` endpoint analyzes the **same source and timestamps**
as \`/api/data\` using transparent, offline, deterministic rules. It provides
technical, bull, bear and risk panels. Fundamental, news and live NSE F&O
panels explicitly say **data not connected** instead of inventing figures.
This free path needs **no API keys, paid LLMs or new Python packages**.

The research panels never access \`localStorage\`, saved futures/puts or broker
data. Technical signals have no calibrated probability or trade-execution
function. Stale feed state suppresses any directional assessment.

### Optional real TauricResearch TradingAgents integration (v0.6.0)

A separate Python script invokes the **actual upstream** TradingAgentsGraph
for \`HAL.NS\`, using the selected market and news analyst agents. It does **not**
run automatically when someone visits the public website (to prevent surprise
inference fees, abuse or prompts hitting an unauthenticated server).

Set up locally on Python 3.11+ with sufficient memory and internet:
\`\`\`sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# Linux/macOS: source .venv/bin/activate
python -m pip install "git+https://github.com/TauricResearch/TradingAgents.git@v0.6.0"
\`\`\`

**Free local LLM example**, with Ollama installed and running:
\`\`\`sh
ollama pull qwen3:8b
python run_tradingagents.py --provider ollama --confirm-run
\`\`\`

For a hosted model, set the appropriate provider credentials securely in
environment variables, plus \`TRADINGAGENTS_QUICK_THINK_LLM\` and
\`TRADINGAGENTS_DEEP_THINK_LLM\`, then specify \`--provider PROVIDER\`.
Hosted providers can charge money; check rates before \`--confirm-run\`.
The upstream vendor configuration uses Yahoo/yfinance for HAL.NS; India
coverage, headlines and filing data may be incomplete or delayed. **This runner
does not integrate a live NSE futures/option chain or calculate hedge Greeks.**

The runner saves only the stock-level report, with a strict HAL.NS ticker, to
\`reports/hal-tradingagents-latest.json\`. It does not send your browser-saved
positions to any AI provider. Reports are excluded from Git. To display that
report on a trusted server, copy its file there and launch with
\`HAL_TA_PUBLISH_REPORT=1\` (Windows PowerShell:
\`$env:HAL_TA_PUBLISH_REPORT="1"\`). Otherwise
\`/api/tradingagents/report\` intentionally returns HTTP 404.
Review AI reports before publishing: they can include externally sourced text.

Default \`requirements.txt\` and free Render setup stay unchanged. The optional
full TradingAgents process is **not installed on Render**; it requires a
separate opt-in local/VM run, model hosting and adequate resources.
A web deployment does not automatically gain a locally generated report.

### New endpoints

| Path | Purpose |
| --- | --- |
| \`/agents\` | Responsive research agent desk |
| \`/api/agents\` | Grounded deterministic research panels; 503 without market data |
| \`/api/tradingagents/report\` | Read-only report, opt-in publish via \`HAL_TA_PUBLISH_REPORT=1\` |

Run offline checks with:
\`\`\`sh
python -m unittest discover -s tests -v
node --test tests/*.test.js
\`\`\`


## Upstox HAL F&O desk (read-only, opt-in)

On Render set BOTH server-side environment variables:
- \`UPSTOX_ACCESS_TOKEN\`: the actual Upstox OAuth token, set only in Render (never Git).
- \`HAL_VIEWER_KEY\`: a **different**, long random private viewer password you choose.

Open \`/upstox\` and enter only the **viewer key**. The Upstox OAuth token is
never entered into the browser. The \`/api/upstox/hal\` endpoint rejects requests
unless the separate viewer key is provided in \`X-HAL-Viewer-Key\`.
Do not use the broker OAuth token as the viewer key. Treat the viewer key as a
sensitive secret and use HTTPS. If your site is public, remember that the page
itself is public; only the F&O API data is access-controlled. For stronger
protection use identity-aware proxy authentication and per-user authorization.

This beta uses the Upstox V2 instrument-search, full-market-quote and option-chain
endpoints; it searches exact HAL instruments at runtime, and shows the front three
futures, lot sizes, spot and selected option chain. Bid/ask, LTP, OI and provider
Greeks appear when supplied; missing fields remain unavailable. It refreshes
only when the button is clicked. Successful snapshots cache for 60 seconds.

This path is **separate** from the legacy Yahoo-backed \`/api/data\`, which
continues to work when Upstox expires or is not configured. No financial-data
response is permanently written to Git or placed in browser storage.
No broker holdings, orders, order placement, execution or automatic rolling.
The real Upstox token expires according to the provider's OAuth policy; replace
it on Render after expiry, or implement an authorized renewal workflow.

Upstox market-data availability, permissions and quotas vary. Verify your own
license/terms before using this on a publicly accessible service. For a highly
sensitive personal account, access the service over authenticated private
networking rather than assuming the viewer key alone provides full protection.

Offline tests: \`python3 -m unittest discover -s tests -v\`.


## HAL Desk 2.0 Android app — Stages 1 and 2

The `android/` directory contains the Android 8+ app source: five premium-styled screens, direct encrypted Upstox connection, charts, financial research, news/disclosures, manual futures/put tracking, expiry risk, mixed-expiry model scenarios, a completed-close journal and portable backups. No trading operations or Stage 3 background alerts are added. See [Android README](android/README.md), [installation](android/INSTALL.md) and [verification](android/VERIFICATION.md).

The new authenticated GET `/api/upstox/research?section=candles&frame=D&type=consolidated` supports `candles`, `news`, `fundamentals`, `filings`, `status` and `chain`. It requires the existing `X-HAL-Viewer-Key` header. Market credentials remain server-side; official NSE RSS requests do not receive broker credentials. News/fundamentals access depends on Upstox token permissions. Existing web routes remain independent.

The market adapter now retains exact option-contract lot sizes and futures bid/ask, blocks redirects, invalidates its cache on token rotation and preserves quotes if a non-auth chain request fails. Docker includes the Upstox and research modules. Merge/deploy the backend change for the Android server connection's new research features; Android Direct Upstox mode does not depend on deployment.

Android signing keys, credentials, APKs, test screenshots and build outputs are excluded from the repository. Keep the existing private signing backup for compatible updates.
