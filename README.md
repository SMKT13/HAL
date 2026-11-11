# HAL Desk 4.1.0

Personal Android research and position-management desk for Hindustan Aeronautics Limited (NSE: HAL). Package `in.smkt.haldesk`, versionCode **25**, Android **8.0+**. Direct read-only Upstox data, optional Gemini and opt-in local FinBERT. No broker orders, fund transfers or required application server.

The Android application has five primary tabs: **Position**, **History**, **Technicals**, **Research** and **AI Desk**. It supports multiple long futures and protective puts, partial closes, preserved realised history, exact-contract marks, expiry-gap checks, deterministic scenarios, hedge comparisons and offline books.

## 4.2.3 expired-position and manual-mark corrections

- Expired, unreconciled open derivatives cannot use old exchange prices or manual marks to fabricate open profit or strategy net P&L. Record the actual broker-confirmed close or settlement to recognise the outcome; existing positions and transaction records remain preserved.
- Manual futures marks must be strictly positive in the position editor. Older saved zero futures marks remain recoverable but are excluded from valuation; zero manual put marks remain supported.
- Release 4.2.3 / versionCode 25 retains package `in.smkt.haldesk` and requires the original signing certificate for in-place Android upgrades.

## 4.2.3 second-audit corrections

- Zero-valued provider market prices cannot become false portfolio losses; explicit user-entered zero put marks remain supported.
- HAL NSE stock derivative expiry clocks follow date-effective 15:30 / 15:40 / 15:45 IST sessions; settlement must still be reconciled separately.
- Price-review and net-loss alerts require valid fresh quotes rather than silently using stale observations.
- Import of exported lifetime-history CSV is supported; whole-statement grand totals are checked against HAL gross rows before saving.
- Upstox instrument-keyed news arrays and partial article metadata are supported, and absent option-contract discovery uses a bounded retry interval.
- Version 4.2.3 / versionCode 25 preserves the app ID and requires the original signing certificate for upgrades.

## 4.2.3 reliability fixes

The Android desk now isolates chain-only market errors from independent quotes, supports explicit user-assumed IV for strictly labelled model-only hedge comparisons when provider Greek timestamps are absent, and reconciles corrected named broker reports while preserving file hashes. Recognized statement total rows are safely ignored. **Distinct reports must use distinct file names**; never accept a reconciliation as separate trading activity without checking the source.

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

The previous 4.0.2 APK was built and signed privately with the original HAL certificate. The 4.2.3 source is an unsigned candidate until privately signed and verified. GitHub contains the source, tests and verification records; CI produces **unsigned** candidates for private local signing. Keystores, passwords, API credentials and personal portfolio backups must never be committed. Update the existing installation without uninstalling it or clearing its data, and export a book backup first.

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
