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
- `android/app/src/main/assets/ui4.js`: Risk tab shows the protection ladder, read-only multiple-expiry settlement input, and hypothetical lifetime net using actual recorded closed gross P&L and costs. Stress tab can simulate additional P&L relative to complete current marks using user-specified annual stock volatility.
- `android/scripts/build-assets.js`: includes the two new modules in the pinned esbuild/Chrome 61 WebView bundle, subject to asset hash checks.
- `android/tests/risk5.test.js`, `quant5.test.js` and additions to `ui4.test.js`: formula, safety and UI/book-isolation regressions; now included in `npm test` and `npm run test:ui`.
- `rebuild5/risk-core.mjs`: compatibility re-export from the Android source of truth. No duplicate financial implementation.

## Verification and limitations
- Run `cd android && npm ci && npm test && npm run test:ui`. GitHub Actions also executes native Java/Android tests, lint and an unsigned candidate build. Inspect the PR checks for the latest commit before claiming pass.
- The current branch is **not** a cleanly reimplemented application yet. It is an isolated, compatible vertical slice in preparation for further modular replacement. Existing 4.6 remains on `main`.
- It has **not** been installed on a physical phone, authenticated against real Upstox quotes or signed with the original certificate.
- Monte Carlo fractions are **conditional model samples**, not real-world loss probabilities, historical backtests, guarantees or entry signals.
- The multi-expiry calculator needs explicit settlement values for every option/futures expiry. It is not a substitute for physical-settlement funding/margin calculations, actual broker account records or commission reconciliation.
- Next: independently rebuilt data/position adapters, richer hedge comparison, historical strategy backtesting, six-perspective AI workflow and source-validated release testing.

## Licensing
Implement independent mathematical algorithms; do not copy AGPL Fincept source or proprietary Sensibull resources without a separate compatibility and license review.
