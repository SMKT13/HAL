# HAL Dashboard — live NSE tracker + analysis

A zero-dependency (Python stdlib only) website that tracks Hindustan Aeronautics
(NSE: HAL) with automatically refreshing data, computed technicals, trading
levels, and your F&O position marked to market.

## Run it (pick one)
- **Windows:** double-click `run.bat`
- **Mac/Linux:** `./run.sh`
- **Any terminal:** `python3 server.py`

Serves on http://localhost:8000 (PC) — open `http://<pc-ip>:8000` on your phone
(same Wi-Fi).
Open `http://<machine-ip>:8000` from any device on the same network, or port-forward /
expose it (e.g. `ssh -L 8000:localhost:8000`) to reach it from your phone.

## What it does
- **Live quote** (Yahoo Finance NSE feed, ~15-min delayed): price, change, OHLC, 52W range
- **Chart**: candlesticks + SMA20/50/200, RSI-14, MACD — drawn client-side, no external libraries
- **Levels engine** (recomputed on every refresh):
  - Gate = 20-DMA (close above = correction over)
  - Reduce line = 4,750 (old floor / box floor, Fib 23.6%; close below = cut 1 lot)
  - Hard floor = 4,616 (16-Sep-2026 swing low; close below = exit all)
  - 50-DMA = dynamic trend reference (info)
  - Pivots (R2/R1/P/S1/S2), Fib 38.2/61.8, targets 5,000 / 52W-high
- **Live zone chip**: tells you which playbook action applies right now
- **Position tracker**: your Oct futures (2 lots @ 5,124.90, exp 27-Oct) and Sep
  4500 PE (2 lots @ 24.02, exp 29-Sep) auto-marked — futures via cost-of-carry to
  the leg's own expiry, put via Black-Scholes at your fill-implied IV (24.7%).
  Each leg carries its own expiry (and strike/IV for the put); a leg that has
  expired is settled at that day's close and flagged EXPIRED instead of silently
  rolling to the next month. Editable, saved in the browser (localStorage)
- **Reference sections**: F&O strategies + execution rules, Q1 FY27 fundamentals,
  catalysts and risks
- **Refresh whenever needed**: page auto-refreshes every 5 min; the ↻ button
  forces an instant fresh fetch (bypasses the 15-min server cache). Falls back to the last cached data if the
  upstream feed is unreachable (marked "⚠ cached"), and to the snapshot embedded in
  the page if there is no cache at all (marked "📄 Snapshot mode").

## Notes
- Data source is delayed ~15 min — fine for daily analysis; don't use for
  second-by-second execution.
- Option/futures marks are model estimates; verify on your broker terminal.
- Educational tool only — not investment advice.

## Files
- `server.py` — fetch, indicator engine (SMA/RSI/MACD/MFI/ATR/pivots/levels), cache, HTTP
- `index.html` — responsive single-page UI (works on phone & PC), inline CSS/JS;
  charts and position marks (cost-of-carry, Black-Scholes) are computed client-side
- `cache.json` — last data snapshot (auto-created, git-ignored)
- `Dockerfile`, `render.yaml` — deploy configs; `run.sh` / `run.bat` — launchers

## Deploy
Free Render.com hosting via `render.yaml` (the `DEPLOY_FREE.md` walkthrough lives
outside this repo). Live: https://hal-5ndu.onrender.com
