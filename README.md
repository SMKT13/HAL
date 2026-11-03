# HAL Desk 4.1.0

Personal Android research and position-management desk for Hindustan Aeronautics Limited (NSE: HAL). Package `in.smkt.haldesk`, versionCode **21**, Android **8.0+**. Direct read-only Upstox data, optional Gemini and opt-in local FinBERT. No broker orders, fund transfers or required application server.

The Android application has four workspaces: **Today**, **My Position**, **Plan** and **Research**. It supports multiple long futures and protective puts, partial closes, preserved realised history, exact-contract marks, expiry-gap checks, deterministic scenarios, hedge comparisons and offline books.

## Daily review update

4.1.0 reorganizes the app around Today → My Position → Plan: a compact daily
briefing, automatic previous-visit comparisons, combined protection explanations,
question-led scenarios and hypothetical exposure comparisons. Business evidence
is grouped around HAL's orders, deliveries, margins and cash flow. Contextual AI
keeps the explicit evidence-sharing consent step.
See [behavior and validation](android/docs/DAILY-REVIEW-4.1.md).

The 4.0.2 protective-put matching fix remains included. Saved holdings and
completed history retain schema 4.

## Source and release

- [Android architecture and build instructions](android/README.md)
- [Installation and preserved signing identity](android/INSTALL.md)
- [Historical 4.0.2 verification report and limitations](android/docs/VERIFICATION.md)
- [Provider capabilities and restrictions](android/docs/API-CAPABILITIES.md)
- [Acceptance criteria](android/docs/ACCEPTANCE.md)
- [Repository synchronization notes](docs/REPOSITORY-SYNC-4.0.2.md)

The previous 4.0.2 APK was built and signed privately with the original HAL certificate. The 4.1.0 source is an unsigned candidate until privately signed and verified. GitHub contains the source, tests and verification records; CI produces **unsigned** candidates for private local signing. Keystores, passwords, API credentials and personal portfolio backups must never be committed. Update the existing installation without uninstalling it or clearing its data, and export a book backup first.

```sh
cd android
npm ci
npm run assets
npm test
npx playwright install chromium
npm run test:ui
./gradlew :app:testReleaseUnitTest :app:lintRelease :app:assembleRelease
```

Use JDK 17, Gradle 8.10.2 and Android SDK 35/build-tools 35.0.0. The Gradle wrapper and npm lockfile pin build dependencies. Run `bash tests/test-native-ai.sh` for the additional mocked Gemini checks. Signing is a separate private local step described in the Android guide.

Historical 4.0.2 release verification recorded 153 calculation/data tests, 57 native/framework tests, 28 browser integration checks and 219 mocked Gemini assertions passing. Framework tests use Robolectric API 26 and 35. A physical-device upgrade, authenticated provider requests and actual FinBERT inference remain unverified; these results do not claim live-account or phone testing.

## Existing web viewer

The earlier React/Python web viewer remains available with its [own setup guide](docs/WEB-VIEWER.md). Its three existing calculation modules and regression tests are preserved under `web-engine/`, independent of the Android rebuild. It retains schema-2 behavior and is not a web edition of Android 4.0.2. Do not import an Android schema-4 book into it without a compatible migration.
