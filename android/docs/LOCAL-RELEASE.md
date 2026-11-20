# Build and verify HAL Atlas 5.3.0 locally on Windows (no GitHub Actions minutes)

This is an **optional personal verification path**, not evidence that Android CI, phone testing or signature verification has already passed. Build this candidate from `rebuild/hal-atlas-5.3.0`. The installed Android 4.6 package must not be uninstalled.

## Prerequisites

- Windows with free disk space and internet for one-time dependency downloads.
- Java **17** / JDK 17, Node.js **22**, Android Studio command-line SDK with **Android platform 35** and **Build Tools 35.0.0**.
- Clone `SMKT13/HAL` and check out the intended commit on the rebuild branch. Do not commit `.jks`/password files.
- Keep a verified exported backup of the installed app's actual Position/History ledger **off the phone**. Store PAPER exports separately.

PowerShell, from inside the repository's `android` directory:

```powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
.\scripts\local-windows-release.ps1
```

The script checks package/version, runs `npm ci`, all Android JS unit suites, bundles the WebView resources, runs Playwright on Chromium, performs native Robolectric tests/lint, assembles the Android release candidate, and verifies zip alignment. It produces `build\HAL-Atlas-v5.3.0-unsigned.apk`. A build that fails any step stops immediately; it **does not** silently create a signed installable upgrade.

To run an incremental **not release-verified** check without installing Playwright:

```powershell
.\scripts\local-windows-release.ps1 -SkipBrowser
```

Signing is disabled in both release scripts while the physical in-place upgrade is pending. The original 5.1.24 certificate SHA-256 is `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`.

## After any local build

An unsigned APK is only a testing artifact; it cannot update an app signed by the original certificate. Even a signed APK is **not production-verified** until a careful in-place update on Android 8+ preserves the real SQLite book, October completed history, all charges, journal, PAPER history, Keystore token, and offline behavior. Validate live Upstox data separately on the phone and preserve the ability to roll back via an exported backup.

The GitHub Actions spending allowance is independent of these local steps. These commands do not invoke Actions or require paid CI runners.

**5.3 development branch:** Bash build now runs both npm unit tests and browser UI tests before Android compilation, after the Python v1/v2 database audit and in-memory rehearsal suites. Install Chromium locally using `npx playwright install chromium`. This changes source validation only. Signing remains intentionally blocked until Room migration and physical-device upgrade checks pass.
