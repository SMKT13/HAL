# HAL Desk 4.0.2 repository synchronization

Prepared 2 November 2026 from the delivered `HAL-Desk-v4.0.2-Source.zip`, SHA-256 `5ddc2ec5a5301d3f944dda6c251eec495932a5323df2a05b8bdc1e40f0e86288`. The previous main commit was `76a041dc1302164bef227a2dfdf669ae5b2fa7e4` (Android 3.3 / versionCode 17).

## Contents

- Replace `android/` with the released Android 4.0.2 / versionCode 20 project, including its Gradle wrapper, locked dependencies, source, generated UI bundle, tests and original release verification records.
- Preserve every released Android runtime, test and build file byte-for-byte. Extend repository ignore rules and restore executable modes for shell entry points. Rebuilding the UI bundle reproduces the committed release bytes.
- Preserve the earlier web viewer's `core.js`, `analytics.js` and `hedge.js` byte-for-byte under `web-engine/`; change the web import and test paths. Keep its schema-2 behavior separate from Android schema 4.
- Update the root README and preserve web setup instructions in `docs/WEB-VIEWER.md`.
- Replace obsolete Android 3.3 CI commands with current Android and web jobs. CI runs synthetic tests, lint and an unsigned Android build. The previous cloud-signing workflow is removed: the original signing identity is used only through the documented private local workflow.
- Remove superseded Android source/tests from the active tree. Prior versions remain recoverable in Git history.

## Checks rerun for this synchronization

| Check | Result |
|---|---|
| Android calculation, data and evidence tests | 153 passed |
| Android browser integration | 28 passed, Playwright 1.51.1 / Chromium Headless Shell 134 |
| Mocked native Gemini policies, transport and evidence | 219 assertions passed, JDK 17 |
| Preserved web calculation tests | 25 core checks and 39 analytics/hedge tests passed |
| Python regression suite | 48 passed |
| Web TypeScript tests | 21 passed |
| Web TypeScript lint and Vite production build | Passed |
| React desktop/mobile browser integration | Passed |
| Package/version, legacy origin and UI source/bundle hashes | Passed |
| Released source and preserved web-engine byte comparison | Passed |
| Workflow structure, shell syntax and credential-pattern scan | Passed |

No authenticated broker or Gemini requests were made. The initial full Chromium launch was incompatible with this container's socket restrictions; the installed headless shell ran both browser suites successfully. The Android native/framework tests and APK assembly were performed for the existing release, as recorded in `android/docs/VERIFICATION.md`; they were not rerun locally during repository synchronization because the restored workspace did not contain an Android SDK. The updated CI configuration performs them on GitHub's Android build runner. A configured workflow is not itself a claim of a successful run; consult the commit's Actions checks.

This synchronization does not change the delivered signed APK or claim new phone-level verification. The original release's live-provider, physical-device and FinBERT inference limitations still apply. No signing keys, passwords, API credentials, APK binaries or user portfolio backups are included in this commit.

## CI runner compatibility

The first GitHub run passed the source identity, UI-bundle reproduction, Android calculation tests, web/Python tests and web production build, then stopped at browser setup because `ubuntu-latest` selected Ubuntu 26.04. The pinned Playwright 1.51.1 runner does not support that operating system. Both jobs now use explicit `ubuntu-24.04`, preserving the tested dependency versions and avoiding future `ubuntu-latest` changes. Check the follow-up run for the final native build and browser results.
