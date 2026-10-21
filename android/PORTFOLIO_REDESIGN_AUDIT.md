# HAL Desk 3.0 — portfolio-first interface redesign audit

This is an **original HAL interface** informed by widely used retail-brokerage
UX patterns visible in Groww's own public screenshots (not Groww code).
No Groww name, logo, icons, proprietary fonts, data or trade execution appear
inside the installed app. HAL Desk remains an unofficial, read-only app
connected through the user's existing HAL/Upstox setup.

## Reference inspection and scope (replica-skill approach)

Reference: [Groww F&O experience](https://groww.in/updates/updates-from-groww-tax-loss-harvesting-intraday-oco-bonds-and-lots-more)
and [Groww stocks holding screen](https://groww.in/updates/groww-stocks-track).
Source material reviewed: official screenshots and public descriptions, not a
reverse-engineered APK or copied assets.

| Reference pattern | HAL 3.0 implementation | Constraints |
|---|---|---|
| Minimal header, small status badges | HAL logo H, read-only status, actual data connection | No Groww branding |
| Portfolio total above the fold | Saved HAL position P&L, futures units, put units and next expiry | No guessed balance |
| Fast tools row | Real My Position, Risk, Find hedge, Rollover navigation | No inert actions |
| Thin underlined section tabs | Existing position/plan/research/market sub-tabs | Preserves input IDs |
| Green performance accent | HAL theme CSS for positive returns and active nav | Red loss, amber review |
| Market-first information hierarchy | HAL current quotes, futures, option chain and research panels | Use actual Upstox feeds |
| Bottom icon navigation | Existing four destinations with contrast/focus states | No fake Orders tab |
| Dark and light themes | Preserves saved theme; both receive new tokens | No local-data reset |

## Method checkpoints

1. Recon: inspected official Groww screenshots and existing HAL Android 2.9 source.
2. Architecture: retained existing WebView asset URL origin, app ID and JS/native bridge.
3. Design: created standalone, branded HAL tokens in portfolio-ui.css.
4. Build: bundled new CSS through native allowlisted WebView assets.
5. Backend: none; Upstox and Gemini access unchanged.
6. Test: browser actions for four quick navigation tiles, colors and sticky header.
7. Diff: regression suite covers core, risk, hedges, research and AI unchanged.
8. Entrepreneur: excluded Groww trading/account features to stay personal/read-only.
9. Brand: HAL H mark, no copied Groww logos/trademarks or screen text.
10. Launch: version code 14, version name 3.0, original package/signing identity.
11. Deploy: GitHub CI builds unsigned verification APK; local signed update needs
    the same existing HAL keystore, never committed to GitHub.

## Validity

* This is a UI inspiration/adaptation, **not** a pixel-perfect Groww replica.
* No measured pixel parity claimed without matching-resolution screenshots of
  both apps and independent real-device visual inspection.
* Two color modes and mobile widths 320/390/768 are covered by existing tests.
* All F&O marks, limits, trades, notes, margin estimates and account settings
  come from the existing app, not any Groww account.
* Existing Android users must export a local backup and **install over** their
  prior signed version, not uninstall it.
