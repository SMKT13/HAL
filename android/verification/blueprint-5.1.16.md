# HAL Atlas 5.1.16 upgrade verification

## Feature map

| Destination | Features |
|---|---|
| Portfolio → Overview | Open P&L, latest session P&L when comparable, lifetime net, active put quantity, expiry timeline, units losing protection, risk, scenarios and hedge comparisons |
| Portfolio → Chart | Paired HAL spot and open P&L observations, independent scales, shared slider and touch inspection, gaps when comparable marks are unavailable |
| Portfolio → Position Book | Futures and puts, expandable details, entry review, partial close, linked atomic rollover, performance, history and journal |
| Market | HAL candles and volume, indices, futures basis and put quotes, optional moving averages, RSI, MACD and bands, existing derivatives and market tools |
| Research | Lead story, timeline, facts, original source, observed session reaction, explicit position-sharing review, company tools and AI |
| Settings | Data connections, System/Dark/Light, backups, recovery, existing model and provider configuration |

## Results

The signed package reports in.smkt.haldesk, version code 50, minimum API 26 and target API 35. APK v2 and v3 signatures verified. Signer SHA-256 a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382 matches the prior release identity. Six packaged web assets were byte-compared with the local generated release assets.

467 JavaScript tests passed excluding the browser suite. New regression cases exercised partial-roll confirmation, linked journal and replacement records, remaining lots, charges, duplicate save and stale revision rejection, invalid fills installed empty-book priority, and populated-book confirmation with recovery of the previous WebView copy. Open P&L, realised P&L, fees, and net P&L reconciled before and after this test.

The APK was assembled from the previous signed release's native binaries and the updated WebView assets. Automatic public Gemini briefings and their native opt-in dialog are in the accompanying Android source only. Building them into an APK requires the Android toolchain. The Gradle wrapper distribution was unavailable offline and its download failed. The Android source archive contains the module and build scripts for a full build. GitHub Actions was not used.

Android install-over, Android UI, populated SQLite upgrade and recovery, actual provider credentials, and live Gemini were not exercised on a device. Browser launch was blocked by the host socket restriction. The chart records eligible observations while Atlas is open and has live marks. It cannot reconstruct missing historical options prices.
