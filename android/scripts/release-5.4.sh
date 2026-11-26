#!/usr/bin/env bash
# Build an upgrade-test candidate. Signing requires review of this exact unsigned APK.
set -euo pipefail
set +x
umask 077
cd "$(dirname "$0")/.."
: "${ANDROID_SDK_ROOT:?SDK 35 and build-tools 35.0.0 required}"
: "${HAL_BASELINE_APK:?Path to the original signed 5.3.0 APK required}"
tools="$ANDROID_SDK_ROOT/build-tools/35.0.0"
out="build/atlas-5.4"
mkdir -p "$out"
stage=$(mktemp -d "$out/.candidate.XXXXXXXX")
trap 'rm -rf -- "$stage"' EXIT
baseline=04e2920b5c7924ae142ac6d84618cd34d2eae7d73d5098b70392cc228204e4c1
[[ $(sha256sum < "$HAL_BASELINE_APK" | cut -d' ' -f1) == "$baseline" ]] || { echo '5.3.0 baseline digest differs' >&2; exit 1; }
verify() {
  python3 -E scripts/verify-apk.py "$@" --previous "$HAL_BASELINE_APK" --build-tools "$tools"
}
unsigned="$out/HAL-Atlas-5.4.0-unsigned.apk"
signed="$out/HAL-Atlas-5.4.0-signed.apk"
case "${1:-build}" in
build)
  python3 -E tests/check_release_identity.py
  npm ci --no-audit --no-fund
  npm run assets
  npm test
  python3 -m unittest discover -s tests -p 'test_*.py' -v
  bash tests/test-native-ai.sh
  bash tests/test-native-coverage.sh
  npm run test:ui
  ./gradlew --no-daemon :app:testDebugUnitTest :app:testReleaseUnitTest :app:lintDebug :app:lintRelease :app:assembleRelease
  "$tools/zipalign" -f -P 16 4 app/build/outputs/apk/release/app-release-unsigned.apk "$stage/unsigned.apk"
  verify "$stage/unsigned.apk" --unsigned
  python3 scripts/audit-release-contents.py "$stage/unsigned.apk"
  sha256sum < "$stage/unsigned.apk" | cut -d' ' -f1 > "$stage/tested.sha256"
  mv "$stage/unsigned.apk" "$unsigned"
  mv "$stage/tested.sha256" "$out/tested.sha256"
  ;;
sign)
  : "${HAL_ACCEPTED_UNSIGNED_SHA256:?Confirm upgrade rehearsal and acceptance for this exact tested APK digest before signing}"
  cp -- "$unsigned" "$stage/unsigned.apk"
  digest=$(sha256sum < "$stage/unsigned.apk" | cut -d' ' -f1)
  [[ "$digest" == "$HAL_ACCEPTED_UNSIGNED_SHA256" && "$digest" == "$(cat "$out/tested.sha256")" ]] || { echo 'Acceptance digest differs' >&2; exit 1; }
  verify "$stage/unsigned.apk" --unsigned
  python3 scripts/audit-release-contents.py "$stage/unsigned.apk"
  : "${HAL_SIGNING_KEY_FILE:?Path to original private keystore required}"
  : "${HAL_SIGNING_PASSWORD_FILE:?Path to protected password file required}"
  "$tools/apksigner" sign --ks "$HAL_SIGNING_KEY_FILE" --ks-key-alias hal-personal \
    --ks-pass "file:$HAL_SIGNING_PASSWORD_FILE" --v1-signing-enabled false \
    --v2-signing-enabled true --v3-signing-enabled true --v4-signing-enabled false \
    --out "$stage/signed.apk" "$stage/unsigned.apk"
  verify "$stage/signed.apk"
  python3 scripts/audit-release-contents.py "$stage/signed.apk"
  mv "$stage/signed.apk" "$signed"
  ;;
*) echo 'Usage: release-5.4.sh [build|sign]' >&2; exit 2 ;;
esac
