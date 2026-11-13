# HAL Desk 4.3.0 — independent Official NSE Insights

## What is shipped
Technical > Charts & derivatives, Indicators and Pattern Scanner now include an
**Official NSE Insights** research section at the top of the Technicals workspace.

- Official NSE CM-Market MCP HAL EQ quote with exchange timestamp and separate
  HTTP retrieval timestamp, session-state and in-session staleness warnings.
- NIFTY 50 and India VIX quotes; their own NSE publication timestamps.
- NSE Bhavcopy 20/50/200-day SMAs, 30-session volume anomaly (traded/average),
  latest 20 historical close observations and a compact chart.
- Recent five-/20-session OHLC high/low observations and classic session pivot,
  S1 and R1, clearly labelled historical/reference levels.
- One-month HAL vs NIFTY 50 price-only comparative returns from NSE's
  stock-versus-index tool; no fabricated beta when there are too few samples.
- NSE market advance/decline breadth and last-year corporate-action history.
- Independent SQLite-backed research snapshot with a cached/stale badge.
  A failed refresh retains visible earlier evidence but never re-labels it live.

## Architecture and isolation
The Java `NseMcpClient` uses direct Streamable HTTP JSON-RPC over HTTPS,
allowlisted to only:

- `https://mcp.nseindia.in/cmmkt/mcp`
- `https://mcp.nseindia.in/bhavcopy/cm/mcp`

It negotiates MCP initialization, sends `notifications/initialized`,
supports both JSON and SSE tool responses, bounds response size and timeouts,
never follows redirects, and sends **no token**. Source data is parsed and
validated natively before being forwarded to the separately allowlisted
`nse4.js` local WebView asset. The UI escapes provider text.

The existing Upstox SDK/REST V3/V2 calls, futures, put-option chain, journal,
P&L, expiry engine, AI policy, and positions remain untouched. NSE EQ values
**never enter** derivatives marks or strategy P&L, and there is no trading API.
The new research panel loads only when visiting Technicals, with a 60-second
request throttle; it is optional and the app remains usable offline.

NSE data may lag the market by 1–3 minutes, historical data may update only after
a session closes, and holiday data can reflect an earlier trading session.
Corporate-action-adjusted comparison returns are separate from the unadjusted
OHLC-derived price levels. Where a module fails, its values are omitted rather
than inferred.

## Terms and boundaries
Per [NSE's official MCP terms](https://www.nseindia.com/nse-mcp), use is limited
to informational/personal educational research, not real-time trade execution,
investment advice, data redistribution, or commercial deployment. Upstox remains
the authorized derivative-data source subject to its own terms. Users should
review exchange/source timestamps and data freshness before any decision.

## Build and regression checks
The application keeps package `in.smkt.haldesk`, original signing alias,
Android 8+ support, data schema, Keystore references and saved positions.
Version advances from 4.2.4/code 26 to 4.3.0/code 27.

Run:

```sh
cd android
npm ci
npm run assets
npm test
./gradlew :app:testReleaseUnitTest :app:lintRelease :app:assembleRelease
```

Native `NseMcpClientTest` checks quote provenance and source exclusivity,
response parsing (JSON/SSE), future-clock rejection and level calculations.
Browser UI tests use synthetic NSE packets to check script execution, safe
escaping, offline cache and non-interference with portfolio values.

GitHub Actions produces an **unsigned** candidate. To produce an in-place
installable signed APK, supply original signing-key and password *file paths*
privately as documented in `android/INSTALL.md`. Never commit credentials.
