# HAL Atlas 5.1.17 — daily interpretation upgrade

## Starting point
The release being upgraded is the real **HAL Atlas 5.1.16** Classic Blueprint, Android versionCode **50**, existing signed APK recorded in the private HAL Library. Source branch `upgrade/classic-blueprint-5.1.16`, commit `8546e673850a4d17f50699cbf7c7239a7e603ae6`. This source update is on `upgrade/hal-atlas-5.1.17-daily-analysis`. It is **not** a rewrite of the older HAL Desk 5.1 / versionCode 34 source and does not merge the competing five-tab layout.

## User-facing changes
- Portfolio landing screen includes **HAL · What the evidence means** with the current evidence state and a link to the full report. Existing aircraft portfolio chart, saved position book, finance and PAPER workflow stay intact.
- Research tab opens with **Evidence-led daily report**. The older company-news/source timeline and separate market summary remain accessible in disclosures, without adding another primary bottom tab.
- The **Daily Analysis** route is available in the existing Market & Research directory.
- The local analysis explains verified completed HAL daily candles using SMA20/50/200, RSI, MACD, 20-day relative volume, price and participation; conditional support/resistance, observation zones, and bullish/range/bearish scenarios. No automatic orders or predicted fills.
- The report adds timestamp-matched Nifty 50 and VIX when available, dated source-attributed fundamentals/news relevance without claiming causation, and locally saved futures/put nominal coverage, strikes and expiry-gap review. Unconfirmed or poorly marked positions do not generate a fabricated open P&L.
- With missing/insufficient completed candles, the directional verdict is **withheld**, not replaced with hardcoded market facts. Upstox and official NSE data sources remain separated, with freshness and retrieval timestamps.
- Refresh requests existing permitted read-only feeds; no changes to credential policy, order routing or consent to Gemini.

## Android upgrade identity
| Property | Value |
|---|---|
| Android app title | HAL Atlas |
| `applicationId` and namespace | `in.smkt.haldesk` |
| Version name | `5.1.17` |
| Version code | `51` (higher than 5.1.16 / 50) |
| Minimum Android | API 26 / Android 8 |
| SQLite database | Existing `haldesk_book.db`, unchanged |
| Credential alias | Existing `hal-upstox-secrets-v1`, unchanged |
| Original signing alias | `hal-personal` |
| Required signer SHA-256 | `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382` |

**Do not uninstall HAL Atlas 5.1.16.** Export your saved real-book JSON, PAPER book, history and charges before any upgrade. Preserve the 5.1.16 APK and verification report.

## Verification performed and still required
Source branch includes analysis model/view modules, the analysis test suite, Classic Blueprint regression tests, updated browser smoke test, aligned Gradle/Java/npm version strings, local build/signing script names, and a corrected APK verifier.

The previously delivered 5.1.16 source ZIP was locally tested with Node 22 and passed **463 tests**. Those tests were run against the preserved 5.1.16 ZIP, not this full modified GitHub branch. Focused module and source checks on this upgrade should be reported separately with their counts. Full Android Gradle compile, browser Playwright, signed APK generation, signed in-place installation, native data retention and broker API verification **have not yet passed** and cannot be inferred from source checks.

## Build without GitHub Actions
From the upgrade branch under `android`, using JDK 17, Node 22, Android SDK 35 and Build Tools 35.0.0:

```powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
.\scripts\local-windows-release.ps1
```

The default is unsigned and runs JavaScript tests, browser UI tests, Robolectric, lint and Gradle release assembly. Signing on a trusted machine requires the *original* keystore and password kept outside the repository, set as `HAL_SIGNING_KEY_FILE` and `HAL_SIGNING_PASSWORD_FILE`, then:

```powershell
.\scripts\local-windows-release.ps1 -Sign
```

The script must fail on missing tests or a mismatched original certificate; never sign with a replacement key. The intended output is `build/HAL-Atlas-v5.1.17-signed.apk`.

## Acceptance after building
Confirm same-package in-place Android install over 5.1.16, displayed version 5.1.17/code51, saved broker positions and expiry details, past transactions, fees, notes, PAPER journal, encrypted Upstox token and offline behavior. Confirm Research and Portfolio analysis only uses timestamped completed candles; report no-quote and stale-feed warnings in airplane mode.
