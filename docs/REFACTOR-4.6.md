# HAL Desk 4.6.0 — source refactor and migration-safety report

## Scope and boundaries

This is a targeted, cross-repository source refactor, **not** a claim that every one of the historical files was replaced. It preserves the original Android application ID \`in.smkt.haldesk\`, versionCode progression (30 → 31), expected original signing certificate and saved real-book schema 4. There is no order execution.

- **Paper ledger:** Immutable OPEN/CLOSED execution snapshots, explicit validated draft → open → close transitions, cumulative fees, transaction-clock checks, compatibility with saved schema-1 PAPER drafts and historical opened records. Real book and PAPER book remain separated.
- **Android build pipeline:** The generated browser JS bundle and SHA-256 manifest have one source of truth, the checked-in source modules. They are no longer tracked and are rebuilt by npm/Gradle before testing/packaging. CI rejects reintroduction of the generated files.
- **Private Python data server:** All \`/api/*\` routes—including Yahoo-backed research and agents—require a separate \`HAL_VIEWER_KEY\`. \`/health\` stays unauthenticated. Very long paths fail early. The developer's Python web viewer must send its key.
- **React backend:** POST \`Origin\` must match scheme, hostname and port of the configured public origin, not merely hostname. Set \`HAL_PUBLIC_ORIGIN\` behind an HTTPS reverse proxy.
- **Version/documentation:** Android build, native version, release identity test, scripts, current README and installation documentation reference the same version. Historical artifact records are not fresh CI evidence.
- **Tests:** New deterministic paper-ledger and API authorization cases; existing accounting, provider adapter, unit, native, browser and AI regression suites continue to run.

## Non-destructive migration invariants

1. The **real Position/History book** remains SQLite schema 4; no destructive migration, renaming of package ID or change in Android Keystore alias.
2. Existing PAPER cache schema 1 is still readable; a legacy open trade without a lock snapshot acquires a validation snapshot based on its saved existing legs, **without guessing its opening time**.
3. A PAPER trade opened after 4.6 has exact entry legs and fees locked. Only its non-financial metadata may change; an exit records explicit per-leg hypothetical prices and total charges. To change a trade, clone to a new draft.
4. Backups do not include provider/AI tokens or the signing private key. Actual portfolio and PAPER cache remain separate.
5. Financial values from incomplete quotes and mixed expiries remain unavailable rather than assumed correct.

## Release acceptance remaining

- GitHub CI must pass all Node/Python finance tests, native Robolectric tests, lint, Android unsigned APK assembly and browser UI tests.
- Install **signed with original certificate** on an Android 8+ device over an existing compatible HAL Desk installation without wiping data.
- Test real Upstox Analytics Token and entitlements, live contract quotes, stale/expired states, empty chains and offline recovery.
- Verify trading-account statement reconciliation, fees, funding and physical-delivery obligations with actual broker evidence.
- Optional security review and penetration testing of both public web deployment and native device storage.

This source change does not provide audit assurance for a live trading decision, a guaranteed hedge or complete Sensibull feature parity.
