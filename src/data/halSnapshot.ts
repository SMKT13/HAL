// 9 October 2026 archived snapshot data from HAL Desk
export const HAL_SNAPSHOT = {
  quote: {
    price: 4655.6,
    prev_close: 4647.39990234375,
    open: 4650.0,
    day_high: 4696.0,
    day_low: 4590.0,
    volume: 502657,
    w52h: 5149.9,
    w52l: 3479.1
  },
  ind: {
    sma20: 4748.584985351563,
    sma50: 4826.17400390625,
    sma200: 4418.030997314453,
    rsi14: 44.401939280821374,
    macd: -40.43726967715156,
    macd_sig: -32.82901118476384,
    macd_hist: -7.608258492387719,
    hist_prev: -6.9574974651498,
    atr14: 114.2036039773251,
    bb_lo: 4553.260432211884,
    bb_mid: 4748.584985351563,
    bb_up: 4943.909538491242,
    mfi14: 41.51798488672701,
    mfi_rsi_spread: -2.883954394094367,
    flow_signal: "neutral",
    ann_vol_realized: 30.475943332532925
  },
  levels: {
    pivot: 4647.200032552083,
    pivot_session: "2026-10-09",
    r1: 4704.400065104166,
    r2: 4753.200032552083,
    s1: 4598.400065104166,
    s2: 4541.200032552083,
    gate: 4748.584985351563,
    reduce: 4750.0,
    floor: 4616.0,
    stop: 4826.17400390625,
    target1: 5000.0,
    target2: 5149.9,
    fib: {
      "0.236": 4755.6,
      "0.382": 4511.7,
      "0.5": 4314.5,
      "0.618": 4117.3
    }
  },
  fno: {
    lot: 150,
    expiry1: "2026-10-27",
    days1: 18,
    expiry2: "2026-11-24",
    days2: 46,
    fut_expiry: "2026-10-27",
    fut_days: 18,
    opt_expiry: "2026-10-27",
    opt_days: 18,
    fut_est: 4670.5,
    pe_strike: 4500,
    pe2_strike: 4300,
    pe_iv: 24.8,
    pe_est: 37.5,
    pe2_est: 13.0
  },
  week: [
    { d: "2026-10-01", o: 4666.0, h: 4699.7, l: 4559.3, c: 4601.0, v: 739864 },
    { d: "2026-10-05", o: 4601.0, h: 4688.0, l: 4601.0, c: 4680.0, v: 465865 },
    { d: "2026-10-06", o: 4680.0, h: 4837.1, l: 4680.0, c: 4816.0, v: 935720 },
    { d: "2026-10-07", o: 4819.9, h: 4831.4, l: 4732.1, c: 4746.3, v: 515972 },
    { d: "2026-10-08", o: 4756.7, h: 4759.8, l: 4620.5, c: 4647.4, v: 521431 },
    { d: "2026-10-09", o: 4650.0, h: 4696.0, l: 4590.0, c: 4655.6, v: 502657 }
  ],
  mkt: {
    price: 22520.5,
    prev: 22231.8,
    chg_pct: 1.3,
    rsi14: 36.5,
    s20: 22972,
    s200: 24271,
    w52l: 22232,
    w52h: 26329,
    above_200dma: false,
    above_20dma: false,
    dist_52wl_pct: 1.3,
    beta60: 0.97,
    corr60: 0.4,
    quote_as_of: "2026-10-09T15:30:00+05:30",
    last_session: "2026-10-09"
  },
  fetched_at: "09-Oct-2026 17:05:21 IST",
  fetched_at_iso: "2026-10-09T11:35:21Z",
  quote_as_of: "2026-10-09T15:30:00+05:30",
  last_session: "2026-10-09",
  stale: true,
  snapshot_mode: true,
  data_status: "snapshot",
  market_state: "Closed"
};

export const ARCHIVED_NOTES = {
  oct2026: {
    title: "📋 Archived trading notes — Sep–Oct 2026",
    content: `Fri 9-Oct: +0.18% to 4,655.60 — the knife-edge HELD. Nifty +1.30% to 22,520 off the 22,222 double support (never near Thu's low); HAL pierced 4,615 to 4,590 (first sub-4,600 since the crash) and was bought straight back, closing 62% up the range. All-in ≈ −₹1.48L at your broker quotes (4500PE 37.45 / 4300PE 13.05 → market IV 24.8/28.7%): puts are ₹7.6k vs ₹12.2k cost (−₹4.6k) — the insurance decays while the strikes hold.

Roll & hedge frame: Friday's hold eases the early-roll urgency — if Nifty reclaims 22,600 next week, revert to the planned 23/26-Oct put roll; below 22,200 the early roll fires. Levels: 4,590 demand shelf → 4,549 → 4,515; resistance 4,700 → 4,732 → 4,821. Fut roll 27-Oct; Q2 results Nov.

Oct calendar: Mon 12 CPI + HCL Q2 → ~mid-Oct Mk1A review → Sat 17 bank Q2s (HDFC/ICICI/Axis) → Mon 19 weekly expiry (MOVED from 20th) → Tue 20 Dussehra, closed → Fri 23 Infosys Q2 + put roll → Tue 27 monthly expiry (stock F&O) + fut roll to Dec → Wed 28 US Fed → Thu 29 BSE expiry.`,
    technicalState: [
      { item: "Trend", now: "Below all DMAs except 200-DMA (4,404). 20/50 death cross INTO the break" },
      { item: "Momentum", now: "RSI 33.9 (near oversold) · MFI 42.4 (accumulation edge gone) · MACD −26.4 crushed · ATR 107" },
      { item: "Supports", now: "4,512 Fib 38.2% · 4,500 · 4,404 (200-DMA) · 4,314 · 4,117" },
      { item: "Resistances", now: "4,604–4,616 (100-DMA + old floor = sell zone) · 4,750 · 4,813" }
    ],
    playbook: [
      { path: "Exit into the bounce", steps: "Sell 1 fut lot at 4,600–4,650, 2nd at 4,700–4,750. Sell 4300 PE into the bounce; keep 4500 PE as tail policy" },
      { path: "Hold everything", steps: "Net +196 delta: 4,800 → −₹1.10L · 4,500 → −₹2.00L · 4,300 → −₹2.30L (all-in)" },
      { path: "Exit all now", steps: "Locks ≈ −₹1.47L all-in; zero regret" }
    ]
  },
  actionMap: {
    title: "📐 Archived F&O action map — 29-Sep-2026",
    rules: [
      { condition: "Bounce to 4,604–4,650 (sell zone)", action: "Exit 1 fut lot; sell 4300 PE into strength" },
      { condition: "Bounce extends to 4,700–4,750", action: "Exit 2nd fut lot — repair complete" },
      { condition: "Close < 4,500", action: "Exit all longs — max-pain pocket below" },
      { condition: "Close < 4,404 (200-DMA)", action: "Full bear regime — 4,314 / 4,117 next" }
    ],
    starterStrategies: [
      { strategy: "Bull put spread", structure: "Sell 4600 PE / Buy 4400 PE", when: "Price near 4,750–4,820 support" },
      { strategy: "Iron condor", structure: "Sell 5200C+4500P, Buy 5400C+4300P", when: "Range 4,500–5,200" },
      { strategy: "Bull call spread", structure: "Buy 4900 CE / Sell 5100 CE", when: "Only after close > gate" },
      { strategy: "Covered call", structure: "Sell 5100 CE vs shares", when: "Below gate, income" }
    ]
  },
  fundamentals: {
    title: "🏢 Archived fundamentals — Q1 FY27",
    metrics: [
      { metric: "Revenue", value: "₹5,515 Cr (+14.4% YoY) — beat est ₹5,288 Cr" },
      { metric: "EBITDA", value: "₹1,526 Cr (+46.9%), margin 27.7%" },
      { metric: "Net profit", value: "₹1,590 Cr (+14.9%) — beat est ₹1,540 Cr" },
      { metric: "Order book", value: "₹2.54 L Cr (~8× FY26 revenue) + ₹90k Cr pipeline" },
      { metric: "Guidance FY27", value: "10–12% revenue growth; margins ~30–31%" },
      { metric: "Quality", value: "ROE ~24%, ROCE ~32%, debt-free, GoI ~71.6%" },
      { metric: "Shareholding (latest)", value: "Promoter (GoI) 71.6% stable · FII 9.3% (trimming) · DII ~12.0% (accumulating) · Public ~7%" },
      { metric: "Street view (Trendlyne)", value: "BUY — 27 analysts, avg target ₹5,501 (+15%); 22/27 bullish · Piotroski 6/9" }
    ],
    catalysts: [
      "GE Aerospace: 3 more F404-IN20 engines delivered (Tejas Mk1A)",
      "F414 ToT deal targeted this FY (Tejas Mk-II)",
      "Safran JV: Aravalli helicopter engine contract signed",
      "Contender in ₹1 L Cr, 60-aircraft transport tender"
    ],
    risks: [
      "Valuation (~34×) prices in execution",
      "Q2/Q3 seasonally weaker",
      "GOI OFS overhang",
      "Engine supply timing"
    ]
  }
};
