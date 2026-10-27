# HAL Desk 3.3 — Analytics-first Android release candidate

**Status: candidate, not signed or tested with a live Upstox token on a physical phone.**

The previous phase merges introduced Upstox Analytics Token direct mode, V3 futures/chain/held-put Greeks, and foreground WebSocket LTPC previews. This candidate adds a **Data readiness** panel and advances Android `versionCode` to **17** / `versionName` to **3.3**. Existing application ID remains `in.smkt.haldesk`. All locally saved position and journal keys remain unchanged (including `hal_desk_v2`, `hal_cache_v2` and existing encrypted token storage). No broker order access or new backend is introduced.

## Before touching the installed app

1. In the currently installed HAL Desk, select **Your desk → Backup & portability → Save backup**. Save it outside the app; it includes positions and journal but **not** access tokens.
2. Confirm the installed app's **package ID**, **signing-certificate SHA-256 fingerprint** and **versionCode** against the old signed APK or your original signing materials. `apksigner verify --print-certs path/to/old-signed.apk` displays the APK signing certificate. The new build must use the **exact same** certificate; verify that its versionCode is higher than the installed version. The repo's 17 is only a candidate value and might need to be increased if the installed app has a higher code.
3. Do **not** uninstall the current app if the signing identity differs; uninstalling can erase the local book and encrypted credentials. Never upload the signing keystore or passwords to GitHub, chat or cloud CI.
4. Never use `HAL_CREATE_SIGNING_KEY=1` for an upgrade; it generates a **new** identity incompatible with the installed APK.

## Build/check the unsigned candidate

- GitHub Actions -> **HAL regression tests** workflow for the release commit -> check both **regression** and **android-build** jobs.
- Download the private Actions artifact **HAL-Desk-v3.3-unsigned-and-apksigner**. The APK inside is **unsigned** and **cannot** be used as a normal installable update until it is signed with the original certificate.
- The project-local command `HAL_UNSIGNED_ONLY=1 ANDROID_SDK_ROOT="$ANDROID_HOME" bash android/build.sh` builds `android/build/aligned.apk` with Gradle and Android 35 tools (the installed Android system does not need to be Android 35).
- To sign **offline on your own trusted PC** with the original `android/signing/personal.jks` and `android/signing/password.txt`, use `ANDROID_SDK_ROOT="$ANDROID_HOME" bash android/build.sh`; this uses `apksigner` and produces `android/build/HAL-Desk-v3.3.apk`. If the previous APK used a **different** alias or key location, do not create a replacement keystore: adapt signing locally using the original signing identity and compare certificate fingerprints before install.

## Real-device Analytics Token checklist (mandatory)

Use your own **Upstox Analytics Token** inside the app's encrypted **Direct Upstox** connection. Never paste it into an issue, PR, log or chat. Test during an actual NSE session and after trading:

- [ ] Direct Analytics Token can load HAL spot, active futures and available option expiries without a server or static IP. No orders are possible.
- [ ] Save/verify the actual HAL December futures and currently active protective put **contracts, entry prices, lot sizes and dates**. Do not assume prior conversational positions still match the broker. The source-readiness panel must treat unconfirmed saved legs as unconfirmed.
- [ ] Spot source-readiness shows HTTP fetch time, provider quote time and last trade time. A previously cached snapshot, failed refresh or stale after-hours clock never becomes “current” merely because the app was opened.
- [ ] V3 futures participation shows OI, previous-day OI and top-of-book data only when Upstox returns it. Option chain OI and IV show missing values rather than false zeros.
- [ ] Held-put V3 Greeks show exact saved strike/expiry and separate retrieval time; **they must not change P&L**.
- [ ] **Start preview** on the WebSocket card. Check separately labeled HAL spot / futures / NIFTY / India VIX and their trade vs feed timestamps. Stop; background app and return; confirm the stream stopped. Live-preview prices **must not** silently overwrite REST marks or risk calculations.
- [ ] Test offline, denied token, wrong token, market-close and airplane mode. Position book and backup survive, errors are visible, prices do not silently revert to zero.
- [ ] Back up, install the **same-certificate signed** update as an upgrade (not uninstall/reinstall), re-open and confirm book, journal, preferences and encrypted Analytics Token remain available.
- [ ] If these steps fail, do not distribute a new signed update yet.

## Scope and limitations

This is a *personal read-only analysis app*. The app does not reconcile broker positions, real funding or fills. Upstox stream previews are indicative observations; portfolio P&L still uses timestamped REST full quotes and saved/manual marks as identified on each leg. Markets can be stale after-hours. Mixed-expiry protective puts do not establish a terminal futures floor. Android test suites use synthetic data: successful CI **does not substitute** for a real Upstox token and hardware tests.
