# HAL Desk 4.5 — Sensibull-inspired Options Lab

This is an independently implemented **HAL-only, PAPER-first** derivatives lab. The user-provided Sensibull v0.4.938 base APK was a static resource reference only. No Sensibull code, artwork, endpoints, login or proprietary analytics were reused.

## Access
Open **Technicals → Options Lab**. The top navigation includes:
- **Option chain & builder:** two-sided HAL CE/PE chain with strike/OI/spread filters, premium, IV, delta, volume and add-to-PAPER; existing strategy builder, price/date payoff and three-way strategy overlays; paper ledger with manual closes
- **38 strategies:** conventional examples for 31 named categories with one fully listed chain; buy/sell futures require exact validated futures quote; the two calendars need matching near/far expiry option chains; Batman, double plateau and range forward have ambiguous category names and require manual leg construction. The asset names do not establish Sensibull's precise leg recipe.
- **OI / IV charts:** call/put OI bars, PCR, max pain, ATM IV, ATM rolling straddle; manually captured timestamped local observation series. IV percentile requires at least **20 distinct captured sessions for that exact option expiry**, not vendor historical IV.
- **Greeks & risk:** share-scaled theoretical delta, gamma, theta per calendar day, vega per one percentage-point IV change, risk-neutral probability-of-profit estimate, common-expiry breakevens and bounded/unbounded risk flags.
- **Watchlist & events:** saved HAL strikes, manually recorded earnings/event review dates and personal discipline notes.

## Accounting boundary
All Options Lab trades are **hypothetical**. The actual position/history/recovery schema is unchanged (schema 4). PAPER data and historical observations use separate local cache keys with Android storage checksums. The real HAL position may be **copied** to PAPER; copying does not amend or settle an actual trade. Closed paper trades cannot be edited in place, but they may be cloned as new drafts.

## Model and market limits
- Every option template requires listed HAL contract keys, verified lot sizes and available buy-ask/sell-bid quotes. These are indicative quotes, **not** executable fills.
- Short naked option positions can have substantial or unbounded loss and mandatory physical settlement/delivery obligations. The app does not calculate real broker margin or funding requirements.
- Risk charts for mixed expiries beyond the first expiry are withheld. Target-date scenarios before the first expiry are model estimates, not guaranteed payoff or a cross-expiry settlement plan.
- Black–Scholes Greeks and probability use user-set IV, interest, dividend yield and target date. They are **not** broker Greeks or real-world probabilities.
- OI PCR/max pain/straddle/IV values are derived from available chain data; missing quote times and provider historical prices are not invented. User-captured history can be incomplete, expire mid-month or be stale.
- Sensibull private account positions, broker trading integrations, verified-broker P&L badges, paid feeds, FII/DII breadth not HAL-specific, and automatic market-history backfill are intentionally excluded. No order routing or trade placement.

## Verification
```sh
cd android
npm ci
npm run assets
npm test
npm run test:ui
./gradlew :app:testReleaseUnitTest :app:lintRelease :app:assembleRelease
```
CI performs browser synthetic-data tests and native regression tests. Android package remains `in.smkt.haldesk`; build 4.5.0 uses versionCode 29. A signed **upgrade** must use the original signing certificate, which is not checked into the repository. Unsigned CI APKs are not installable upgrades.
