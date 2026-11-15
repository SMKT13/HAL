# HAL Desk 4.7 — Quant rebuild, audit and release contract

## Rebuild strategy

HAL Desk 4.7 creates a new independent quant engine inside the existing installable
Android application. A destructive from-zero replacement would break Android
Keystore access, SQLite revisions, history imports and compatibility with
installed 4.6 applications. Therefore the delivery is a non-destructive
architecture rebuild / refactor, not a new application ID or a Fincept clone.

**Scope:** Android 8+, `in.smkt.haldesk`, versionCode 32, read-only provider,
no broker order permissions, no payments or fund transfers, schema-4 real
trades, isolated schema-1 PAPER lab, private original signing key.

## Source contracts

- `app/src/main/assets/quantdesk47.js`: deterministic, side-effect-free
  quant methods using existing `engine4.js` contract validation and expiry clocks.
- `app/src/main/assets/quantdesk47-ui.js`: on-device Quant Lab presentation
  and explicitly user-controlled assumption inputs.
- `app/src/main/assets/ui4.js`: navigation from Position and Technicals.
- `scripts/build-assets.js`: pins new modules before the top-level UI.
- `tests/quantdesk47.test.js`: no-lookahead, seeded simulation,
  expiry and immutable-book safety checks.

The feature is **independently implemented**: no Fincept source, API
keys, paid datasets, scripts, icons or proprietary Sensibull source are copied.

## Five phases: honest implementation boundaries

### Phase 1: Data and original accounting — retained and guarded

- Source: Android `MarketClient`, `ResearchClient`, `NseMcpClient`,
  `BookStore`, `BookValidator`, `SecretStore`.
- Real-book accounting, saved fees, reconciliation, expiry review, no execution,
  technical timestamp provenance, backup/recovery and compatibility are retained
  from 4.6.
- New Quant Lab reads these inputs only. No model output is written to
  `BookStore` or to journal/recovery history.
- Live broker entitlement, actual quote timeliness and physical device
  behaviour remain **unverified** until tested with the owner's authorized
  read-only token.

### Phase 2: Derivatives risk — retained, extended for scenario comparisons

- Existing `engine4.scenario`, `findHedges`, Options Lab PAPER strategy builder,
  option chain and Greeks continue to own contract maths.
- New six-row spot shock × three-column IV shift scenario matrix tests
  the *actual saved book* using explicit interest, dividend, volatility and
  an assumed futures carry model.
- P&L is based on **entry values**. Closed realised P&L and charges remain
  independent. Users must use Position → Find a hedge for eligibility,
  old-put sell bid, new-put buy ask, liquidity, broker lot size and estimated
  costs. This feature never routes an order.
- **Mixed expiries:** scenario horizons crossing the earliest open leg expiry
  are withheld. A later spot price never determines an earlier expiry payoff.
- No exact broker margin / physical settlement cash projection is claimed.

### Phase 3: Quantitative research — added in 4.7

- Deterministic daily moving-average long/flat backtest: 20/50 defaults,
  signal measured at completed previous daily close, hypothetical entry/exit at
  next daily open, explicit brokerage/slippage basis points, mark-to-market
  close equity and max observed daily close-to-close drawdown.
- This is a HAL **underlying share** test only, not an options/futures test.
  Cash financing, leverage, shorting, corporate-action adjustment,
  dividends, futures basis, contract rolls and executable slippage are omitted.
- Market regime uses completed candles, SMA20/50, RSI14, ATR14 and annualized
  recent historical standard deviation. Stale market observations are labelled.
- Seeded Monte Carlo lognormal endpoint model: annual volatility, zero
  drift default, ACT/365, 100–2,000 paths, percentiles and below-spot fraction.
  It is an illustrative distribution, NOT a calibrated price prediction.
- Real-position scenario distribution revalues each leg using explicit flat
  put IV, assumed futures carry and the saved entry ledger. Simulated lifetime
  net adds recorded realised gross and subtracts recorded charges.
  Broker fees, funding, settlement cash and margin calls are not modeled.

### Phase 4: AI and research workflows — existing AI + local checklist

- Existing opt-in Gemini AI Desk, evidence stamping, AI policy and FinBERT
  remain isolated from deterministic financial accounting.
- New six-perspective checklist gives independent Technical, Derivatives,
  Portfolio, Fundamental, News and Risk-control observations with confidence
  state. It is **local rules and evidence**, not six autonomous AI agents.
- Dated headline dedup and count anomaly may suggest further reading, not
  price direction or a trade.
- Scheduled agent orchestration, company semantic news correlations and an
  accurate historical IV/OI warehouse require verified permitted data feeds;
  those are not silently claimed by this release.

### Phase 5: Tests, upgrade and release validation — CI gate

1. `npm ci` from `android/`.
2. `npm test`: existing engine, book, hedge, options and new quant regressions.
3. `npm run assets` and `npm run test:ui`: UI in Android 8-compatible
   Chromium and an isolated synthetic Android bridge.
4. `HAL_UNSIGNED_ONLY=1 ANDROID_SDK_ROOT="$ANDROID_HOME" bash build.sh`:
   Gradle native tests, lint and aligned unsigned APK.
5. Original signing certificate must match the fingerprint enforced in
   `android/build.sh`. No key or password is stored in GitHub.
6. Before an installed 4.6→4.7 upgrade: backup actual real-book history and PAPER
   snapshots; verify upgrade without clearing data; manually inspect exact
   future/put identities, lots, fees, checkpoint history and Keystore tokens.
7. Confirm with authenticated real Upstox quotes on a physical Android device.
   Synthetic CI tests cannot establish those live-provider requirements.

## Explicitly unimplemented or limited advanced ideas

- Real past option contracts and full point-in-time historical premiums/IV/OI,
  options strategy backtesting, gamma exposure and accurate IV surfaces.
- True statistical confidence intervals or real-world probabilities of profit.
- Real-time exchange margin, margin offsets and physically settled obligations.
- Autonomous multi-agent debate, scheduled local notifications and execution.
- Fincept desktop UI port, its proprietary/Enterprise datasets, and any
  AGPL source-code copying. Additional licensing and data entitlement checks
  are required before importing third-party code.
- Device upgrade, battery, background connectivity and authenticated provider
  acceptance require owner-side validation.

## Release decision

CI passing produces an **unsigned candidate for further testing**, not a signed,
verified upgrade. The 4.7 branch should only be merged after automated checks,
manual mobile QA and owner approval of the new model limitations.
