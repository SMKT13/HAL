#!/usr/bin/env bash
# No Android SDK, Gradle, JUnit or external downloads required.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
command -v kotlinc >/dev/null || { echo "Kotlin compiler (kotlinc) required" >&2; exit 2; }
command -v java >/dev/null || { echo "Java runtime required" >&2; exit 2; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
kotlinc "$ROOT/app/src/main/java/in/smkt/haldesk/NativeCoverage.kt" \
  "$ROOT/tests/native-coverage-smoke.kt" -include-runtime -d "$TMP/native-coverage.jar"
java -jar "$TMP/native-coverage.jar"
