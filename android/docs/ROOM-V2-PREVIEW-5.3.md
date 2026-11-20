# HAL Atlas 5.3 Room v2 read-only fallback

The optional native terminal now detects the Library 5.1.24 Room v2 database by `PRAGMA user_version` and reads the `FoPositionEntity` table via an **OPEN_READONLY** SQLite connection. It verifies the original book SHA-256 checksum when present, checks types, side, expiry, quantities and premiums, and shows **all** verified native FUT/CE/PE positions with explicit BUY/SELL labeling. It discloses the count of Room-native-only contracts and existing ledger entries without claiming to calculate or reconcile lifetime P&L.

No Room table, legacy ledger, backup or credential is modified by the preview. The GitHub version-1 `BookStore` remains **write-blocked** for Room v2. A full bidirectional v2 migration and physical-device upgrade test are still mandatory before lifting the signing gate.
