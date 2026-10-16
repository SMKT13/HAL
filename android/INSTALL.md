# HAL Desk 2.0 — update and quick guide

## Install the update

1. Download **HAL-Desk-v2.0.apk** on your Android phone.
2. Open it and choose **Update / Install** over the working HAL Upstox app. **Do not uninstall the old app first.** The package and signing certificate are the same, so the update preserves its encrypted connection and saved positions.
3. Open **HAL Desk**. Check the positions and contract lot sizes against your own records. If Android says the signatures are incompatible, stop instead of uninstalling; the installed app may be a different HAL build.
4. In Settings → Backup & portability, save a backup after confirming your positions. Keep this financial file private.

Android 8+ and an updated Android System WebView/Chrome are required. No computer or Android Studio is needed. This updates HAL Upstox 1.0, not a separately named HAL Compass installation.

## Connect your data

Your previous connection should remain saved. If needed, open Settings → Manage secure connection.

| Mode | Credential to enter | Requirement |
| --- | --- | --- |
| Direct Upstox | Your Upstox token, preferably an Analytics Token with access to the research feeds | No Render deployment needed |
| Existing Render server | The separate `HAL_VIEWER_KEY` | Updated backend deployed; server has `UPSTOX_ACCESS_TOKEN` and `HAL_VIEWER_KEY` |

Enter credentials only in the native app dialog. Never paste the Upstox token into the viewer-key field, a backup or Git. If a token is rejected or expires, replace it in Connection (or on Render for server mode). Permissions and provider quotas can make individual feeds unavailable; Settings → Data health shows each feed separately.

The Android release supports direct mode immediately. The accompanying GitHub pull request contains the server research adapter; server mode gains the new research feeds after that change is merged and deployed.

## Your five screens

- **Overview:** HAL quote/history, your basket P&L, hedge coverage, position review cards, latest news and upcoming dates.
- **Positions:** editable long futures/protective puts, risks and expiry timeline, rollover comparison, model scenarios, completed-close journal and funding snapshots.
- **Markets:** daily/15-minute/hourly candlesticks, volume and moving averages; futures and searchable call/put chain with available Greeks.
- **Research:** technical indicators with evidence; quarterly/annual fundamentals; valuation, cash flow and shareholding; sourced business notes and official disclosures.
- **News:** recent HAL news and NSE disclosures, topic filters, similar-headline grouping, source links and saved articles.

Choose Graphite dark, Paper light or Follow device in Settings. Refresh market quotes manually or every 60 seconds while the app is open. Research feeds have their own refresh buttons and timestamps.

## Record your strategy correctly

Existing v1 positions migrate automatically. The earlier October plan remains a template you must review before saving; it is not confirmation of current holdings. **Use listed lot sizes** fills only exact contract matches. A mismatch blocks automatic P&L. Load each put expiry when a basket spans multiple dates.

**Record completed close** is a local journal action for a trade/settlement already completed elsewhere. It reduces the saved open lots and records actual exit price and charges. It does not place a trade. Record a roll as a completed close plus a new open contract with its actual entry. Record charges once. Settlement cash is kept separate from strategy P&L; funding balances are separate too.

Price/time/IV scenarios can model mixed expiries only up to the earliest expiry. They are hypothetical estimates, exclude costs and margin, and show their assumptions. The exact shared-expiry payoff is a separate calculation. Greeks are withheld when incomplete or not recently fetched. Quantity coverage does not mean full downside protection.

## Backup and recovery

Save backup exports positions, journal, notes, bookmarks, preferences and recorded snapshots, without tokens. Import validates the file and shows the counts before you choose to replace the current book. Settings → Review previous import recovery copy can restore the pre-import book. Journal CSV is also available. Uninstalling removes local data; keep a backup before changing devices.

## What was checked

The APK compiled and its signature matches v1.0. Automated checks covered calculations, accounting, v1 migration, import/export, charts, news, light/dark themes and phone layouts. The three official NSE RSS feeds were fetched and parsed successfully; no HAL item was present in their sampled window.

Authenticated Upstox access and physical-device behavior could not be tested from this build environment. On your phone, check that quotes, candles, news and financials load, then review their source times. Missing or unavailable data remains labelled. Background alerts and AI summaries remain outside Stages 1–2.
