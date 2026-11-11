# HAL Desk 4.2.1 installation

This release has application ID `in.smkt.haldesk`, versionCode 23 and minimum Android API 26. Export a JSON backup from the installed app before updating. Keep the installed app and its storage if Android reports a certificate conflict.

## Sign the unsigned candidate

Sign the aligned APK locally with the original HAL keystore. The Android SDK Build Tools prompt for its password when this command runs in a terminal. The private keystore and password belong outside the source tree.

```sh
apksigner sign --ks /private/path/personal.jks --ks-key-alias hal-personal --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true --out HAL-Desk-v4.2.1-signed.apk HAL-Desk-v4.2.1-unsigned.apk
apksigner verify --verbose --print-certs HAL-Desk-v4.2.1-signed.apk
apksigner verify --verbose --print-certs HAL-Desk-v4.1.0-signed.apk
```

Compare the SHA-256 certificate fingerprints on both APKs. The expected fingerprint is `a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382`. Confirm v2 and v3 verification on the signed update. The project also provides `scripts/verify-apk.py` for these checks against the previous APK and the tested assets.

## Update and check the book

1. Open the verified signed 4.2 APK on the phone with the previous HAL Desk installation and select **Update**.
2. In **Position → Book**, check each open contract, expiry, lot size, entry and manual mark against your records. Check completed closes in **Journal & funding**.
3. In **History → Import statement**, select the private HAL history JSON or a supported HAL XLSX or CSV. Review duplicate rows, overlaps, accepted results and charge coverage. Confirm and save. The app also offers an explicit, broker-reviewed open-book import for an empty book.
4. In **Position → Break-even**, choose a scenario date, price range, basis and costs. For a date beyond an open put's expiry, supply the assumed earlier settlement spot or record the actual close. The gross open result remains available with an unknown allocation of historical costs.
5. Save dated checkpoints for comparisons under **Review periods**. Open **Settings** to inspect connections or export a backup.

Authenticated market feeds, optional AI requests and phone-specific upgrade behavior can be checked after installing the signed update. Cached quotes retain their source times. The history import works offline.
