# HAL Atlas 5.3 — read-only database compatibility audit

The Library Android 5.1.24 source uses **the same** \`haldesk_book.db\` as the original SQLite BookStore, but extends it through Room migration 1 → 2. Room v2 contains the tables \`FoPositionEntity\`, \`TradeLedgerEntity\`, \`PriceAlertEntity\`, \`CachedSnapshotEntity\` and \`room_master_table\`. Legacy BookStore on GitHub main still opens that file as version 1. Installing it over a version-2 database would trigger a downgrade failure. **This auditor does not migrate anything or make the APK safe to install.**

## Verify against private copies, never an active phone database

Copy \`haldesk_book.db\` and corresponding \`-wal\`/\`-shm\` together when applicable. Keep private data on your trusted computer. Do not upload personal tradebook databases, signing keys or passwords to GitHub. Use Python 3:

\`\`\`sh
cd android
python -m unittest discover -s tests -p test_audit_book_compat.py -v
python tests/audit_book_compat.py --db /secure/offline-copy/haldesk_book.db
\`\`\`

The JSON output deliberately has **only schema/version, counts, flags, errors and status**, not position records, account identifiers or fees. \`legacy_v1_readable\` merely means the book can be inspected without changing it. \`room_v2_review_required\` means preservation of sidecar transactions must be validated with an explicit migration and round-trip tests before enabling 5.3 signing. \`blocked\` means errors must be resolved using original copies and recovery workflows.

Synthetic tests cover schema-1 books, Room v2 with original/native-only/edited positions and ledger rows, corrupt book SHA-256, missing Room tables, and unknown versions; tests verify byte-for-byte preservation of a v1 fixture. They **do not** prove compatibility with all real on-device data, Room identity hashes or Android's live WAL behavior.

## Release policy

Until a tested v1+v2 compatible BookStore/Room transaction protocol is implemented and the Android upgrade test passes on an isolated backed-up device, 5.3 signing stays disabled. Do not uninstall the existing app to force an upgrade.
