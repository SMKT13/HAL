# Install HAL Desk 4.1.0

CI produces an **unsigned candidate**, not an installable update to a privately
signed installation. First sign it with the original HAL certificate using
`build.sh`, then verify it against the previous signed APK with
`scripts/verify-apk.py`. No replacement signing key is generated.

After private signing and verification:

1. Export a JSON book backup from your installed HAL Desk.
2. Open `HAL-Desk-v4.1.0-signed.apk` on the same phone and choose **Update**.
3. Keep the existing installation and its storage. Check the exact contracts,
   entries and completed history in My Position, then confirm against your broker.
4. Connect Upstox in Settings if needed. Today saves its first review only after
   all required prices are current. The next visit can then show changes.
5. Try What if? and Compare in Plan. These calculations never record a trade.
6. Gemini is optional and still requires reviewing and consenting to each request.

The candidate identity is `in.smkt.haldesk`, versionName **4.1.0**, versionCode
**21**. Updating an existing app requires the preserved certificate
`a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`.
Certificate matching and installation must be verified on the privately signed
artifact; source checks do not establish either. If Android requests uninstalling
or reports a signature conflict, retain the current app and backup.

## Data quality and offline behavior

Saved positions, journal, manual marks, assumptions and backups work offline. Cached observations show their original clocks. Missing values stay unavailable. REST prices are distinct from the live WebSocket preview.

Strict hedge ranking can produce no qualifying contract. In particular, the documented option-chain schema does not provide a separate Greek timestamp; net Greeks and timestamp-qualified hedge rankings remain unavailable unless reliable provenance is supplied. Theta additionally requires verified units. Do not treat an empty shortlist as evidence that no listed puts exist; the Markets view can still show the returned chain. Explicit-IV stress calculations remain available.

Provider fundamental fields retain their reported periods/units. Order backlog, delivery guidance and business notes need sourced disclosures; the app does not invent them. English FinBERT sentiment describes text, not expected price direction.

A physical-device upgrade, your authenticated Upstox/Gemini access and an actual FinBERT model download/inference are not established by the synthetic release tests. Check these optional connections on your phone. No background monitoring is guaranteed.

After this update, open My Position → Book → Verify contracts and refresh. A missing instrument key is now handled correctly; genuine expiry/strike/lot mismatches remain unavailable and show metadata for review. No saved trade is automatically changed.
