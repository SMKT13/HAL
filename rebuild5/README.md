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

## Implemented in this branch
- `risk-core.mjs`: pure, side-aware expiry payoff, date-specific protection coverage and incremental risk from validated marks.
- `risk-core.test.mjs`: eight regression checks, including mixed-expiry refusal and November-to-December hedge gap.

Run `node --test rebuild5/risk-core.test.mjs` with Node 22+. This is not yet integrated into Android UI or release build.

## Licensing
Implement independent mathematical algorithms; do not copy AGPL Fincept source or proprietary Sensibull resources without a separate compatibility and license review.
