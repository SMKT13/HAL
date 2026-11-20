# HAL Atlas 5.3.0 rebuild

The development branch is `rebuild/hal-atlas-5.3.0`. The Android application ID is `in.smkt.haldesk`, the version code is 59, the minimum SDK is 26 and the target SDK is 35.

## Using the native tradebook

Open **Native terminal**, review the saved contracts, then select **Open native tradebook**. A schema-1 book stays on its existing SQLite path until the user opens the native tradebook. That action runs Room's transactional migration on the existing file. A schema-2 installation opens its existing Room entities. The original WebView desk continues to provide book editing for supported long futures and puts, research, analysis, backups and paper scenarios.

The native tradebook includes Desk, Analysis, F&O, Recovery and Connect. F&O supports local entry, edits and closing futures, calls and puts, plus a read-only Upstox position sync. Recovery uses recorded gross amounts and charges, integer paise and a saved set of baseline transactions. Connect supports foreground thresholds in the review screen and optional periodic notifications through WorkManager in the tradebook. Android schedules periodic work on a best-effort basis.

## Data compatibility

The migration retains the original book, previous-book recovery, cache and additional SQLite tables. It checks the original payload digest, validates the book, archives the original bytes and projects positions and ledger entries into the 5.1.24 Room schema. Migration failure rolls back the transaction. The generated Room identity matches the schema identity in the original signed 5.1.24 APK.

The legacy editor validates mirrored history and charges before enabling writes. Generation checks prevent stale writes after native edits. A mixed or conflicting book routes to review. Native-only ledger entries, short positions, calls, alerts and cache rows survive compatible legacy edits. Android's SQLite corruption callbacks preserve the damaged file for recovery.

## Release status

The signed 5.3.0 candidate is available for an in-place upgrade test. Production release approval is pending a backed-up in-place upgrade on Android. Keep the installed app and its data during that check.

## Local verification, 20 November 2026

The unsigned release was built from `505ea68673bd13397916d78c9bad2ce3ef77b90f` with JDK 17, Gradle 8.10.2, Android platform 35 and Build Tools 35.0.0. No hosted workflow ran.

| Check | Result |
| --- | --- |
| Python service and database suites | 49 service tests and 15 audit/rehearsal tests passed |
| JavaScript and TypeScript | 486 Android desk tests, 22 root tests, 39 web-engine tests and 25 calculation checks passed |
| Browser UI | 59 Android desk checks with a simulated native bridge passed. The React desktop/mobile suite also passed |
| Web build | TypeScript type checking and the Vite production build passed |
| Debug and release Android tests | All 115 passed in each variant. Includes Room migration, native-only transactions, damaged-file retention, stale writers, foreground alerts and a Robolectric Compose launch |
| Debug and release lint | Zero errors and three warnings in each variant. Lint flagged synchronous credential preference persistence, JavaScript in the bundled WebView and the back-navigation attribute on older APIs |
| APK inspection | Package ID, version, SDK levels, expected permissions, signature absence, asset equality, zip alignment and 64-bit native library segment alignment verified |

The aligned APK is 43,079,879 bytes. Its SHA-256 is `73f4320a24ee15c4922203439fe1d07108f7a1dc1da1beb52adf9acafa362046`.

**Still unverified on a device.** The environment had no attached Android device. Physical upgrade from the signed 5.1.24 installation, preservation of the user's actual ledger and Keystore entries, live authenticated Upstox/NSE responses, and background notification delivery on the user's phone require device checks. The original APK certificate was verified independently. The signed candidate is ready for that test.

## Signed upgrade-test APK

The original HAL signing key signed the verified build as `HAL-Atlas-5.3.0-signed.apk` (43,085,031 bytes). APK signature schemes v2 and v3 passed verification against the 5.1.24 certificate. The package is `in.smkt.haldesk`, version code 59.

- Signed APK SHA-256: `04e2920b5c7924ae142ac6d84618cd34d2eae7d73d5098b70392cc228204e4c1`
- Signer certificate SHA-256: `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`
