# HAL Atlas recovery baseline

Retain 5.3.0 as the restore version until the owner explicitly designates a successor. Keep future development off `restore/hal-atlas-5.3.0`. Its pinned revision is `d282f223a9dafa4e8b63e75678eddf76228cdc6c`. The APK build source is `505ea68673bd13397916d78c9bad2ce3ef77b90f`.

The retained signed artifact is HAL-Atlas-5.3.0-signed.apk, package in.smkt.haldesk, versionCode 59. SHA-256: `04e2920b5c7924ae142ac6d84618cd34d2eae7d73d5098b70392cc228204e4c1`. See REBUILD-5.3.md for signature and verification details.

Before each update, retain a dated independent backup and check restoration on a test installation, including native-only entries, journal, charges and recovery records. The source checkpoint and APK contain no personal book backup.

If an update fails, preserve the installed app and its data. For source recovery, start a repair branch from the pinned revision. For an installed newer version, prepare an original-key-signed repair build with a higher versionCode and support for the installed database schema. Rehearse it against a backed-up copy before updating the phone. Do not uninstall, clear storage or force a database downgrade. Device recovery remains unverified until rehearsed.
