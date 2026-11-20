# HAL Atlas 5.3.0 — controlled rebuild, feature branch

**Branch:** `rebuild/hal-atlas-5.3.0`, created from `main` at `a37e0239420513daa5b4235350be9036529fd60a`. **Main is not to be merged without separate user approval.**

## Inputs and changes integrated
- GitHub Android 5.2.0: retained read-only market adapters, five-tab WebView, analysis, protective puts, ledger, Options Lab, hedges, AI, backups, original Keystore alias and signing certificate.
- Library HAL Atlas 5.1.24: incorporated the native Compose design direction as a second **optional, read-only** screen, avoiding duplicate database writes; kept its source ZIP outside GitHub.
- VersionName 5.3.0, versionCode 59 (above the Library v5.1.24 code 58), applicationId `in.smkt.haldesk`, Android 8.0+ unchanged.
- Preserved browser/JS and native Java regression suites, local non-Actions build scripts, separate web viewer/backend, and generated WebView asset bundling.
- Added source test for native-screen accessibility, isolation and no fabricated derivative quotes.

## Not yet claimed complete
- The full Library TradebookActivity, Room v2 schema, native broker repository, alerts and WorkManager monitor are **not integrated**. Mixing BookStore schema 1 and Room schema 2 without a validated migration can corrupt or invalidate an installed book.
- Need to test native Compose compilation, complete npm tests, Playwright, Gradle/Robolectric, lint and actual APK output in Android SDK environment. No signed APK produced by this commit.
- Alert permissions, exact-contract streaming, feature parity and any further design refinements remain pending.
- Real Android in-place upgrade and certificate verification remain separate release gates.

## Required integration gates
1. Build with Node 22, JDK 17, Android SDK 35 and Build Tools 35.0.0. Run `npm ci && npm test && npm run test:ui`, then Gradle unit/lint/assemble.
2. Export actual saved Book/History and PAPER journal from the existing installed app. Never delete `haldesk_book.db` or use destructive migrations.
3. Confirm both Library 5.1.24 and GitHub 5.2.0 book data open after an in-place install using an independent saved test device, including charges, October history and expiry mismatches.
4. For future Room/alert changes use a staged migration with checksum, rollback, revision conflict and trigger tests; preserve original Keystore alias `hal-upstox-secrets-v1`.
5. Sign only on a trusted personal machine with original `hal-personal` keystore and verify certificate SHA-256 `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`.
6. Review branch changes and obtain explicit approval before updating `main`.

**No orders or fund transfers.** All source and screen changes are read-only with respect to the broker.

## BLOCKER: Library 5.1.24 Room v2 compatibility
The Library 5.1.24 Android archive contains a SQLiteOpenHelper at version 2 with Room tables FoPositionEntity and TradeLedgerEntity. This branch still uses GitHub's BookStore version 1. Installing this candidate over a device that used Library 5.1.24 can make the app unable to open the existing database. **Do not sign or install a v5.3 release until a non-destructive v2 compatibility plan and tests preserve both the legacy book and native transactions.** VersionCode 59 is for development identity only.

### Added read-only database test gate
Both Linux and Windows local release scripts now run `python -m unittest discover -s tests -p test_audit_book_compat.py -v` before Gradle packaging. Python 3 is required. The synthetic tests protect v1/v2 audit behavior but **do not lift** the signing block or replace a real Android migration test.

## Migration rehearsal
The independent tests/rehearse_room_v2.py tool audits an offline schema-1 database COPY in read-only mode and creates schema-2-like ledger mirror tables exclusively in SQLite memory. Its seven synthetic tests check original-book SHA-256, source version preservation, and position and journal row counts. Both platform build scripts now run both Python suites before Android packaging. This is not production Room migration and does not lift the signing block.
