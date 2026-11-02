# Install HAL Desk 4.0.2

1. In your installed HAL Desk 3.3, 4.0 or 4.0.1, export your JSON book backup before updating.
2. Open `HAL-Desk-v4.0.2-signed.apk` on the same phone. Allow installation from the app used to open it if Android asks.
3. Choose **Update**. Do not uninstall the old app or clear its storage.
4. Open My Position and compare every contract, expiry, quantity, entry and completed close with your broker. Use **Confirm book** after checking. Example holdings are never automatically loaded.
5. Open Settings → Upstox connection if the token needs replacement. Enter your own Analytics Token only in the native dialog. Request market data and inspect source/trade times and data health.
6. Optional: configure your own Gemini key. No request runs until you review evidence and explicitly send it. FinBERT is a separate opt-in download of approximately 111 MB; it is not included in backups.

The release identity is `in.smkt.haldesk`, versionName 4.0.2, versionCode 20. Its signing certificate matches the previous 4.0.1 artifact: `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`.

If Android reports a certificate conflict or requests uninstalling, stop and retain the existing app and exported backup. A phone with a later versionCode also cannot downgrade to 20. This build was compared with the previously delivered 4.0.1 APK (code 19), not with a remotely inspected phone installation.

## Data quality and offline behavior

Saved positions, journal, manual marks, assumptions and backups work offline. Cached observations show their original clocks. Missing values stay unavailable. REST prices are distinct from the live WebSocket preview.

Strict hedge ranking can produce no qualifying contract. In particular, the documented option-chain schema does not provide a separate Greek timestamp; net Greeks and timestamp-qualified hedge rankings remain unavailable unless reliable provenance is supplied. Theta additionally requires verified units. Do not treat an empty shortlist as evidence that no listed puts exist; the Markets view can still show the returned chain. Explicit-IV stress calculations remain available.

Provider fundamental fields retain their reported periods/units. Order backlog, delivery guidance and business notes need sourced disclosures; the app does not invent them. English FinBERT sentiment describes text, not expected price direction.

A physical-device upgrade, your authenticated Upstox/Gemini access and an actual FinBERT model download/inference are not established by the synthetic release tests. Check these optional connections on your phone. No background monitoring is guaranteed.

After this update, open My Position → Book → Verify contracts and refresh. A missing instrument key is now handled correctly; genuine expiry/strike/lot mismatches remain unavailable and show metadata for review. No saved trade is automatically changed.
