#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to a SDK with platform 35 and build-tools 35.0.0}"
bt="$ANDROID_SDK_ROOT/build-tools/35.0.0"
platform="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
# Gradle resolves and packages ONNX Runtime's Java classes and native libraries.
# A hand-assembled APK cannot load ONNX Runtime's required .so files.
if ! command -v gradle >/dev/null 2>&1; then
 echo "Gradle 8.10+ is required for the offline ONNX Android build." >&2
 exit 1
fi
mkdir -p build
gradle --no-daemon :app:assembleRelease
unsigned="app/build/outputs/apk/release/app-release-unsigned.apk"
test -f "$unsigned" || { echo "Gradle did not produce an unsigned release APK" >&2; exit 1; }
"$bt/zipalign" -f 4 "$unsigned" build/aligned.apk
if [ "${HAL_UNSIGNED_ONLY:-0}" = "1" ]; then
 echo "Unsigned validation build: android/build/aligned.apk"
 exit 0
fi
if [ ! -f signing/personal.jks ]; then
 if [ "${HAL_CREATE_SIGNING_KEY:-0}" != "1" ]; then
  echo "Restore your existing private signing files to signing/ for compatible updates. For a separate new installation only, set HAL_CREATE_SIGNING_KEY=1." >&2
  exit 1
 fi
 umask 077
 python3 -c 'import secrets,pathlib;pathlib.Path("signing/password.txt").write_text(secrets.token_urlsafe(32))'
 keytool -genkeypair -keystore signing/personal.jks -storepass:file signing/password.txt -keypass:file signing/password.txt -alias hal-personal -dname 'CN=HAL Upstox Personal App' -keyalg RSA -keysize 3072 -validity 10000 >/dev/null 2>&1
fi
"$bt/apksigner" sign --ks signing/personal.jks --ks-pass file:signing/password.txt --out build/HAL-Desk-v3.2.apk build/aligned.apk
"$bt/apksigner" verify --verbose --print-certs build/HAL-Desk-v3.2.apk

