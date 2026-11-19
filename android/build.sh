#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to SDK35 and build-tools35}"
bt="$ANDROID_SDK_ROOT/build-tools/35.0.0"
if [ ! -f node_modules/esbuild/package.json ]; then
  echo "Installing pinned Android JS build tools (npm ci)" >&2
  npm ci --no-audit --no-fund
fi
if [ -x ./gradlew ]; then gradle_command=./gradlew; else gradle_command=gradle; fi
"$gradle_command" --no-daemon :app:testReleaseUnitTest :app:lintRelease :app:assembleRelease
mkdir -p build
"$bt/zipalign" -f -P 16 4 app/build/outputs/apk/release/app-release-unsigned.apk build/HAL-Atlas-v5.1.17-unsigned.apk
if [ "${HAL_UNSIGNED_ONLY:-0}" = 1 ]; then echo "Unsigned build ready"; exit 0; fi
: "${HAL_SIGNING_KEY_FILE:?Path to original private keystore required}"
: "${HAL_SIGNING_PASSWORD_FILE:?Path to private password file required}"
"$bt/apksigner" sign --ks "$HAL_SIGNING_KEY_FILE" --ks-key-alias hal-personal --ks-pass "file:$HAL_SIGNING_PASSWORD_FILE" --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true --out build/HAL-Atlas-v5.1.17-signed.apk build/HAL-Atlas-v5.1.17-unsigned.apk
"$bt/apksigner" verify --verbose --print-certs build/HAL-Atlas-v5.1.17-signed.apk > build/signature-verification.txt
if ! grep -Fq 'a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382' build/signature-verification.txt; then rm -f build/HAL-Atlas-v5.1.17-signed.apk; echo "Certificate mismatch; APK withheld" >&2; exit 1; fi
echo "Preserved identity verified: build/HAL-Atlas-v5.1.17-signed.apk"
