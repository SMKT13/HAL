# HAL Desk 5 — independent rebuild track

Status: **initial implementation, not a completed application**. Existing 4.6 remains untouched on main.

## Release invariants
- Android application ID `in.smkt.haldesk`, Android 8.0+ and original signing certificate.
- Keep real SQLite schema-4 ledger and original Keystore alias compatible; never overwrite it from PAPER.
- Read-only Upstox Analytics Token, separate NSE research, no order placement.
- Never infer option settlement at an earlier expiry from a later simulated spot.
- Missing quotes, marks, contract metadata or timestamps remain missing.
- New engines must be tested against independently calculated examples and real device QA.

## Work packages
1. **Baseline & migration:** 4.6 test audit, verified backup/recovery, compatibility fixtures, clean modular shell.
2. **Derivatives:** full chain, multi-leg PAPER strategy builder, payoff/Greeks, OI/IV and timestamp provenance.
3. **Risk:** dated scenario engine, mark-to-market attribution, hedge optimiser, rollover comparisons, settlement/margin warnings.
4. **Quant:** Monte Carlo, regime analysis, backtesting with survivorship/lookahead guards, portfolio stress.
5. **Research & AI:** sourced fundamentals/news, six-perspective optional Gemini, offline deterministic fallback.
6. **Release:** unit/integration/browser tests, Android API 26/35 QA, unsigned build, privately signed in-place upgrade.

## Implemented on this branch (first vertical slice)
- `android/app/src/main/assets/risk5.js`: strict civil-date validation, lot-to-share conversion, protective-put coverage through expiry, dated protection ladder, explicit per-expiry hypothetical settlement P&L, and mark-to-mark incremental risk.
- `android/app/src/main/assets/quant5.js`: seeded, reproducible illustrative lognormal spot-scenario distribution; accepts a supplied portfolio-pricing callback, refuses missing values.
- `android/app/src/main/assets/backtest5.js`: independent daily-bar SMA-cross research engine; next-bar-open PAPER fills only after completed close signals, explicit two-sided fee/slippage inputs, marked unrealised versus closed gains, drawdown tracking and descriptive 20/50 SMA + realised-volatility regime.
- `android/app/src/main/assets/hedge5.js`: independently audits eligible protective-put replacement scenarios produced by the provider-aware hedge engine; whole-lot units, gross purchase, old-put bid proceeds, signed net cash requirement, worst sampled loss, actual futures expiry gap and like-for-like current-vs-replacement scenario comparability. Model-only; no trading.
- `android/app/src/main/assets/lenses5.js`: local six-perspective evidence readiness map for Technical, F&O, Fundamentals, News, Market Context and Position Risk; explicitly marks stale/missing evidence. This local map does not call Gemini or send the real portfolio anywhere.
- `android/app/src/main/assets/quality5.js`: independent quote provenance/contract-identity reconciliation. Contradictory same-clock provider prices are withheld, while mismatched lot sizes/expiries/strikes retain conflict metadata through the finance engine so even manually entered marks cannot bypass a contract mismatch. Source integrity counts are visible in Data Health.
- `android/app/src/main/assets/migrate5.js`: QA-only, read-only schema-4 upgrade compatibility check. It rejects loss or mutation of positions, journal fees, lifetime history, private notes and risk limits, while allowing old broker-confirmation flags to be reset for fresh verification. The report contains only changed section names/counts, not the user's private financial or journal data.
- `android/app/src/main/assets/portfolio5.js`: read-only lifetime accounting audit. Independently reconciles per-leg units/marks, booked gross P&L, cumulative charge statements, later fees, manual/stale/expired marks and funding versus settlement cash. Withholds net and loss-recovery figures if any required mark or financial invariant fails. Exposes a booked recovery requirement without implying future returns.
- `android/tests/portfolio5.test.js`: tests closed October puts, partial futures closes, cumulative lifetime fee coverage, additional later fees, missing marks, expired contracts, corrupted totals and half-paise rounding. `ui4.test.js` covers the audited Performance screen and unchanged saved book.
- `android/tests/migrate5.test.js`: synthetic closed-put, fee, multi-expiry book, confirmation reset, malformed backup and no-mutation acceptance tests.
- `android/tests/hedge5.test.js`, `lenses5.test.js` and Playwright AI-panel review checks: accounting reconciliation, missing comparisons, net cash credits, expiry gap and no unintended AI network calls.
- `android/tests/backtest5.test.js` plus Playwright coverage: rejects invalid/missing candles, same-bar look-ahead and invalid window assumptions; confirms the real trade ledger is never modified.
- `android/app/src/main/assets/ui4.js`: Today and Performance use separately audited saved-book P&L and withholding safeguards. Risk tab shows the protection ladder, read-only multiple-expiry settlement input, and hypothetical lifetime net using actual recorded closed gross P&L and costs. Stress tab can simulate additional P&L relative to complete current marks using user-specified annual stock volatility. Technicals → Backtest provides a long-only cash-equity reference using verified completed daily candles. Position → Find a hedge → Inspect comparison displays the audited cash and expiry comparison, and AI Desk shows a local six-perspective evidence map without a Gemini request.
- `android/scripts/build-assets.js`: includes the independently authored risk, quant, backtest, hedge, evidence-readiness and quote-quality modules in the pinned esbuild/Chrome 61 WebView bundle, subject to asset hash checks.
- `android/tests/risk5.test.js`, `quant5.test.js`, `quality5.test.js`, `migrate5.test.js`, existing `data4.test.js`, and additions to `ui4.test.js`: finance, source-conflict, manual-mark bypass, and real-book isolation regression tests; included in `npm test` and `npm run test:ui`.
- `rebuild5/risk-core.mjs`: compatibility re-export from the Android source of truth. No duplicate financial implementation.

## Verification and limitations
- Run `cd android && npm ci && npm test && npm run test:ui`. GitHub Actions also executes native Java/Android tests, lint and an unsigned candidate build. Inspect the PR checks for the latest commit before claiming pass.
- Current CI limitation: recent GitHub Actions jobs have failed before runner assignment (no steps executed), even on retry. An earlier run passed the native and browser suite. Selected `data4.test.js` and `quality5.test.js` checks (45/45), plus `migrate5.test.js` checks (8/8), were executed manually in an isolated JavaScript harness. The lightweight harness does **not** replace `node --test`, full GitHub CI or real-device verification.
- The current branch is **not** a cleanly reimplemented application yet. It is an isolated, compatible vertical slice in preparation for further modular replacement. Existing 4.6 remains on `main`.
- It has **not** been installed on a physical phone, authenticated against real Upstox quotes or signed with the original certificate.
- Monte Carlo fractions are **conditional model samples**, not real-world loss probabilities, historical backtests, guarantees or entry signals.
- The multi-expiry calculator needs explicit settlement values for every option/futures expiry. It is not a substitute for physical-settlement funding/margin calculations, actual broker account records or commission reconciliation.
- Next: independently rebuilt data/position adapters, richer hedge comparison, advanced regime diagnostics, historical put/futures P&L backtesting once historical contract data is available, six-perspective AI workflow and source-validated release testing.

## Licensing
Implement independent mathematical algorithms; do not copy AGPL Fincept source or proprietary Sensibull resources without a separate compatibility and license review.
