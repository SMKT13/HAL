# HAL Atlas 5.3 — initial native/legacy book interop

This is a development branch source integration based on the Library 5.1.24 AtlasInterop implementation.

- The existing v1 book remains v1 and is not destructively migrated.
- On an existing Room v2 database, the original WebView book reads a validated supported long FUT/PE projection of the native Room tables.
- Supported book edits update both the original SHA-256-protected book and matching Room position/ledger mirror rows within a single SQLite transaction, **without deleting native-only short FUT, short options, long calls, alerts, caches, or independently entered ledger rows**.
- An SQLite generation trigger detects stale book edits after native changes and rejects them with `revision_conflict_reload_required`.
- Native-only records remain out of the original long-futures/protective-put editor; the native terminal preview shows them independently.
- This does not add Room/KSP dependencies or new schema-2 tables to legacy v1 databases.

**Verification caveat:** A source integration and regression tests are not equivalent to a built, tested, signed upgrade. Java/Kotlin Android compilation and real-device Room-v2 interoperability have not been verified here. Do not sign or install this development build. The release-signing block remains.

Native-only close records are immutable: an old-book replacement that omits a Room-native close does not delete it. When the mirror refers to the native close with inconsistent gross/fee amounts, the transaction rejects the change instead of rewriting the native ledger. This is covered by a new Robolectric source test, pending Android SDK execution.

**Accounting safety:** If Room has native-only unsupported contracts (calls/shorts) or native-only transactions that cannot be mapped into the legacy long-futures/protective-put book, the legacy editor refuses to show an incomplete basket or lifetime P&L. The full native terminal remains accessible for a separate read-only review. This is intentional until full native portfolio/accounting UI parity is implemented and tested.

**Missing journal mirror guard:** Before a Room-v2 snapshot is shown in the legacy editor, every historical journal mirror in the original checksum-validated book must be present in Room (either under journal/id or a Room-native close id). Missing original fees, settlements or closed trades now reject the projection and preserve the on-disk original. A Robolectric regression fixture tests that original journal bytes remain accessible.
