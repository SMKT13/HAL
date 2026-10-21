#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT to a SDK with platform 35 and build-tools 35.0.0}"
bt="$ANDROID_SDK_ROOT/build-tools/35.0.0"
platform="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
rm -rf build/classes build/generated build/dex
rm -f build/classes.jar build/unsigned.apk build/aligned.apk
mkdir -p build/classes build/generated build/dex signing
"$bt/aapt2" compile --dir app/src/main/res -o build/resources.zip
"$bt/aapt2" link -o build/unsigned.apk -I "$platform" --manifest app/src/main/AndroidManifest.xml --java build/generated -A app/src/main/assets build/resources.zip
find app/src/main/java build/generated -name '*.java' > build/sources.txt
if command -v javac >/dev/null; then
 javac -encoding UTF-8 -source 8 -target 8 -classpath "$platform" -d build/classes @build/sources.txt
else
 : "${ECJ_JAR:?Set ECJ_JAR to Eclipse ecj.jar when javac is unavailable}"
 java -jar "$ECJ_JAR" -encoding UTF-8 -source 8 -target 8 -classpath "$platform" -d build/classes @build/sources.txt
fi
(cd build/classes && zip -q -r ../classes.jar .)
"$bt/d8" --lib "$platform" --min-api 26 --output build/dex build/classes.jar
(cd build/dex && zip -q ../unsigned.apk classes*.dex)
"$bt/zipalign" -f 4 build/unsigned.apk build/aligned.apk
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
"$bt/apksigner" sign --ks signing/personal.jks --ks-pass file:signing/password.txt --out build/HAL-Desk-v2.8.1.apk build/aligned.apk
"$bt/apksigner" verify --verbose --print-certs build/HAL-Desk-v2.8.apk

