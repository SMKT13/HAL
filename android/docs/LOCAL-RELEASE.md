# Run HAL Desk 5.0 checks locally on Windows (no GitHub Actions minutes)

This is an **optional personal verification path**, not evidence that Android CI, phone testing or signature verification has already passed. The source branch is `rebuild/hal-desk-5-fincept` and PR #40 remains a draft. The installed Android 4.6 package must not be uninstalled.

## Prerequisites

- Windows with free disk space and internet for one-time dependency downloads.
- Java **17** / JDK 17, Node.js **22**, Android Studio command-line SDK with **Android platform 35** and **Build Tools 35.0.0**.
- Clone the private `SMKT13/HAL` repository and check out the build branch. Do not commit `.jks`/password files.
- Keep a verified exported backup of the installed app's actual Position/History ledger **off the phone**. Store PAPER exports separately.

PowerShell, from inside the repository's `android` directory:

```powershell
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
.\scripts\local-windows-release.ps1
```

The script checks package/version, runs `npm ci`, all Android JS unit suites, bundles the WebView resources, runs Playwright on Chromium, performs native Robolectric tests/lint, assembles the Android release candidate, and verifies zip alignment. It produces `build\HAL-Desk-v5.1.0-unsigned.apk`. A build that fails any step stops immediately; it **does not** silently create a signed installable upgrade.

To run an incremental **not release-verified** check without installing Playwright:

```powershell
.\scripts\local-windows-release.ps1 -SkipBrowser
```

To sign a fully tested candidate on a trusted personal computer **only if you still have the original keystore and signing password**:

```powershell
$env:HAL_SIGNING_KEY_FILE = "C:\secure-outside-repo\HAL-Desk-original-personal.jks"
$env:HAL_SIGNING_PASSWORD_FILE = "C:\secure-outside-repo\password.txt"
.\scripts\local-windows-release.ps1 -Sign
```

The script requires alias `hal-personal` and checks the original certificate SHA-256 `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`, plus v2/v3 signatures. On mismatch it removes the signed output and fails. **Do not create a new key, change the package ID, share the password or uninstall 4.6.** No real account API credentials are used by the tests.

## After any local build

An unsigned APK is only a testing artifact; it cannot update an app signed by the original certificate. Even a signed APK is **not production-verified** until a careful in-place update on Android 8+ preserves the real SQLite book, October completed history, all charges, journal, PAPER history, Keystore token, and offline behavior. Validate live Upstox data separately on the phone and preserve the ability to roll back via an exported backup.

The GitHub Actions spending allowance is independent of these local steps. These commands do not invoke Actions or require paid CI runners.
