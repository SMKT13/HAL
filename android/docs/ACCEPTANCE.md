# Acceptance evidence

| Requirement | Measurable check |
|---|---|
| Exact multi-leg accounting | Synthetic quantities, zero manual mark, missing-mark basket withheld, fees/settlement separation, partial and full closes |
| Risk integrity | Exact expiry/strike/key, lot mismatch, quantity gaps, earlier protection expiry, incomplete Greek provenance |
| Scenarios | Black–Scholes known values, expiry payoff, horizon before all expiries, rate/dividend/IV validation |
| Hedge comparisons | Listed contracts only, depth/spread/volume/OI checks, strict timestamps, exact whole lots, budget, transparent scores and rejected reasons |
| Market provenance | Quote/trade/retrieval clocks, future/stale/missing time, failed refresh, per-packet caches, older quote arbitration |
| Streaming | Official Protobuf fixtures, duplicates/old frames, REST mark isolation |
| Local records | SQLite transactions/restart, revision conflict, malformed inputs, v2 migration, completed October history preserved, preview/recovery |
| Screens | Fresh/offline navigation through all sections, edits/partial close/confirmation/import, chart rendering, light/dark 320/390/768 px layouts |
| AI/security | Explicit consent, research excludes portfolio, private memos excluded, native allowlist, cancellation, response parsing, XSS escaping |
| Android versions | Robolectric API 26 and API 35 lifecycle/storage checks; these are not hardware tests |
| Release | SDK/Gradle build, lint, package/version metadata, signing certificate match, v2/v3 signatures and zip alignment |

All automatic finance and provider tests use synthetic fixtures. No tests connect to the user's live trading account. See the release report for the actual run totals and remaining validation limits.
