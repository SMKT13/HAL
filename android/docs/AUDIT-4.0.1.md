# HAL Desk 4.0.1 audit fixes

Audit date: 2 November 2026. See VERIFICATION.md for final build evidence and limits.

## Accounting, risk and models

- Combine quantities of duplicate saved puts before checking available bid depth for assumed replacement sale proceeds. Previously each leg could independently pass against the same depth.
- Require a valid, recent, nonfuture timestamp for provider IV used by scenarios. Explicit user IV remains available offline.
- Exact expiry payoffs no longer depend on an unused present spot quote. Theoretical futures carry does not require an unused current basis quote.
- Reject malformed and future candles, withhold directional intraday conclusions when completed bars are materially old, and distinguish a valid incomplete bar from malformed history.
- Tie broker confirmation and AI conclusions to exact material portfolio state, including funding timestamps, legacy accounting and valuation basis. Import and recovery require fresh confirmation.

## Provider data and interface

- Preserve provider, trade and retrieval clocks for index context. Surface partial endpoint failures even when the enclosing HTTP request succeeds.
- Keep malformed research responses from replacing valid cached observations. Extreme news timestamps remain unavailable rather than crashing.
- Preserve hedge and pattern inputs across refreshes, show nested option volume/OI, and invalidate scenarios and comparisons when their evidence changes.
- Retain saved unlisted contract identities during manual edits. Escape select option values and keep provider HTML inert.
- Keep failed saves from changing the displayed book. A recovery confirmation uses the revision the user actually reviewed, so a concurrent change cannot be overwritten.
- Block position AI for a corrupt book; company research remains separate. Add compatibility for older WebView theme-listener APIs.

## Android lifecycle and local safety

- Recheck market, stream, AI and offline-model operation tickets when callbacks reach the UI thread. Cancelled queued work cannot start later or publish stale results.
- Clear refresh throttles and pending interface states on resume. Cancelled requests no longer leave loading controls stuck.
- Quarantine corrupt book bytes before recovery and preserve previous records. Recovery clears obsolete broker confirmation.
- Make FinBERT installation/scoring cancellation ticket-based, close native session options, and disable ONNX telemetry.
- Update ONNX Runtime from 1.20.0 to 1.23.2 to fix 64-bit native-library load alignment for Android devices using 16 KB pages. The final APK verifier checks actual ELF segments.
- Remove obsolete environment-specific release scripts that referred to old paths, versions and test counts; retain portable build and verification instructions.

All regression fixtures are synthetic. No test orders, broker account queries, user API calls, paid AI requests or automatic model downloads were made.
