# HAL Atlas 5.3.0 rebuild

The development branch is `rebuild/hal-atlas-5.3.0`. The Android application ID is `in.smkt.haldesk`, the version code is 59, the minimum SDK is 26 and the target SDK is 35.

## Using the native tradebook

Open **Native terminal**, review the saved contracts, then select **Open native tradebook**. A schema-1 book stays on its existing SQLite path until the user opens the native tradebook. That action runs Room's transactional migration on the existing file. A schema-2 installation opens its existing Room entities. The original WebView desk continues to provide book editing for supported long futures and puts, research, analysis, backups and paper scenarios.

The native tradebook includes Desk, Analysis, F&O, Recovery and Connect. F&O supports local entry, edits and closing futures, calls and puts, plus a read-only Upstox position sync. Recovery uses recorded gross amounts and charges, integer paise and a saved set of baseline transactions. Connect supports foreground thresholds in the review screen and optional periodic notifications through WorkManager in the tradebook. Android schedules periodic work on a best-effort basis.

## Data compatibility

The migration retains the original book, previous-book recovery, cache and additional SQLite tables. It checks the original payload digest, validates the book, archives the original bytes and projects positions and ledger entries into the 5.1.24 Room schema. Migration failure rolls back the transaction. The generated Room identity matches the schema identity in the original signed 5.1.24 APK.

The legacy editor validates mirrored history and charges before enabling writes. Generation checks prevent stale writes after native edits. A mixed or conflicting book routes to review. Native-only ledger entries, short positions, calls, alerts and cache rows survive compatible legacy edits. Android's SQLite corruption callbacks preserve the damaged file for recovery.

## Release status

The target is an unsigned candidate. Release signing remains gated on validating a backed-up in-place upgrade on Android. Keep the installed app and its data during that check.
