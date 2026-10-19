## Position desk update — v2.6 (version code 9)

Install `HAL-Desk-v2.6.apk` over the existing HAL Desk installation. The package, app-assets origin and original signing certificate are preserved. Export a backup in Settings before updating; keep the app installed to retain its local book and encrypted keys.

Open **My Position**, check the saved contracts against your broker, confirm them, and enter your own limits and a current funding snapshot. Today shows the rules that can be evaluated. Blank inputs remain unknown. Markets, News and AI are under Research; hedge/scenario/rollover tools are under Plan. A basic chain may correctly show Saved planning because it lacks per-contract clocks.

No real orders, background notifications or automatic AI calls are introduced. This is the first position-centred rework stage.

# HAL Desk 2.1 — hedge finder update

## Install over your current app

1. Export a backup of your current app records before updating.
2. Download **HAL-Desk-v2.1.apk**, open it on your Android phone, and choose **Update / Install**. Do not uninstall the working app first.
3. The package, signing certificate and storage origin match versions 1.0 and 2.0. The update is built to retain positions, journal, preferences and the encrypted connection. Check those records after installation. If Android reports a signature mismatch, stop instead of uninstalling.

Android 8+ and an updated Android System WebView/Chrome are required. This updates the existing HAL Upstox / HAL Desk app, not a separate HAL Compass installation.

## Use Find a hedge

1. Check your actual saved long futures and existing puts under **Positions → Book**, including each expiry, strike, lots and listed lot size. The earlier October template is not confirmation of current holdings.
2. Open **Positions → Find a hedge**. Swipe the subtab row horizontally on a narrow phone if needed.
3. Enter your **new-hedge budget**, **sampled-loss limit**, and **protection end date**. Budget applies to the full new purchase before selling existing puts. The loss limit is additional model loss from current marks in the tested scenarios; it is not a guaranteed loss cap.
4. Open **Costs, liquidity & model assumptions** and review total buy/exit charges, slippage, spread, rate, dividend and IV change. Defaults are assumptions. Zero charges mean relevant brokerage/taxes are excluded until you enter an estimate.
5. Tap **Save settings & refresh comparisons** during the market session. Required full quotes must pass the timestamps, liquidity and contract checks. Token permissions or an unmerged server update can prevent this feed from loading.
6. Review **Lower cost**, **Balanced**, and **Stronger protection**. These compare qualifying puts only; one put may win several categories. No match means no forced recommendation. Excluded contracts and reasons remain visible.
7. Tap **Compare with current hedge**. Review new cost, existing-put sale proceeds, net cash needed, and unchanged / −3% / −5% / −10% HAL scenarios at several dates. Selecting a comparison does not edit your book or submit a trade.

The finder models buying one put strike/expiry in enough whole lots to exactly match all saved long-futures units, replacing all existing puts if present. It does not optimise mixed-strike portfolios or assume a future rollover. Keep-current comparisons stop at the earliest existing put expiry because a later spot price cannot determine earlier settlement.

For your proposed December-futures / November-put structure, the expiry gap is shown explicitly. Choose a December protection end date to require puts that extend through that date; November puts cannot qualify for a December target. Update saved futures only after an actual rollover completed elsewhere.

## Understand the prices and ranking

New puts use the ask plus entered slippage; existing-put sales use the bid less slippage. Sale proceeds reduce cash needed but are not counted as new profit. Futures current LTPs and existing-put bids define the starting P&L basis. The entry-based detail separately includes saved open-position entry costs. Historical closed trades and earlier journal charges are excluded from the finder.

Quotes/chain retrieval must be within two minutes; option/futures trades within 15 minutes and spot trades within two minutes. Puts require positive volume/OI, valid IV/Greeks, an acceptable spread and enough displayed top quantity. Same-contract saved put quantities are combined for the sale check. Fresh retrieval alone cannot make an old option trade fresh. Outside market hours the shortlist may correctly remain paused.

Lower cost minimises new-hedge cost; stronger protection minimises the largest loss across sampled scenarios. Balanced gives equal weight to normalised cost and sampled loss. This is a rules-based comparison, not an AI price prediction or trade signal.

Models use European Black–Scholes puts and constant-basis futures before expiry. They do not predict future volatility, execution prices, margin calls, funding needs or physical settlement. A matching put quantity is not a guarantee of full downside protection. The largest sampled loss is not the largest possible loss.

## Connection and preservation

**Direct Upstox** uses your existing encrypted token and works without a Render deployment. Enter credentials only in the native Connection dialog. The finder uses public market-data GET operations; it never reads broker holdings or places orders.

**Render server mode** requires the new `hedges` research section from this release to be merged and deployed. The phone uses `HAL_VIEWER_KEY`; the server uses its separate `UPSTOX_ACCESS_TOKEN`. If the server update is not deployed, Direct Upstox is available immediately. The APK does not deploy backend code.

Your five existing screens, themes, charts, technical/fundamental research, news, journal and backup features remain available. Version-1 and version-2 position records are compatible. Saved hedge settings are included in JSON backups; tokens are excluded. Uninstalling deletes app data.

## Verification and first phone check

The update passed 56 Android calculation/accounting checks, 46 Python backend tests, 16 existing web regression tests and the Chromium UI suite, including hedge comparisons, failure/staleness handling, settings backup, and 320/390/768 px layouts with enlarged text. The APK compiled, aligned and verified against the original update certificate.

Authenticated Upstox quotes and a physical Android upgrade could not be tested in the build environment. On your phone, confirm the saved book, load current full quotes and inspect the timestamps. No token is embedded in the APK and no synthetic test quotes ship in the app.

