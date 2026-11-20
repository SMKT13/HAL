# HAL Atlas 5.3 Room v2 read-only fallback

The optional native terminal now detects the Library 5.1.24 Room v2 database by `PRAGMA user_version` and reads the `FoPositionEntity` table via an **OPEN_READONLY** SQLite connection. It verifies the original book SHA-256 checksum when present, checks types, side, expiry, quantities and premiums, and shows **all** verified native FUT/CE/PE positions with explicit BUY/SELL labeling. It discloses the count of Room-native-only contracts and existing ledger entries without claiming to calculate or reconcile lifetime P&L.

No Room table, legacy ledger, backup or credential is modified by the preview. The GitHub version-1 `BookStore` remains **write-blocked** for Room v2. A full bidirectional v2 migration and physical-device upgrade test are still mandatory before lifting the signing gate.

## Additional non-destructive reconciliation checks

The preview now counts:
- **Native-only positions:** Room positions not present in the last validated legacy book.
- **Changed positions:** matching IDs with differences in type, side, expiry, lots, lot size, entry or strike (ignoring display-only metadata).
- **Legacy-only positions:** IDs in the legacy book but no longer present in the Room position table.
- **Ledger row count:** number of saved Room ledger entries; **not** lifetime net P&L.

These are review signals, not proof a contract is active or settled. The legacy WebView reports that Room v2 editing is blocked and directs users to this read-only preview rather than attempting a destructive recovery.

The Python compatibility audit now uses economic-field comparisons consistent with the native preview. Both the native guard's JS tests and the Python audit tests are wired into local release scripts. **Android compilation, real Room migration tests, device upgrade checks and signing are still blocked or unverified.**
