#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/test-libs build/test-classes
test_json_jar="${HAL_JSON_JAR:-build/test-libs/json-20250517.jar}"
python3 - "$test_json_jar" <<'PY'
import pathlib,sys,urllib.request,hashlib
p=pathlib.Path(sys.argv[1])
if not p.exists():
    with urllib.request.urlopen('https://repo.maven.apache.org/maven2/org/json/json/20250517/json-20250517.jar',timeout=30) as r:
        p.write_bytes(r.read())
if hashlib.sha256(p.read_bytes()).hexdigest()!='3ea61b2a06e31edf1c91134fe9106b0ebb16628be169f3db75bc7a2b06b45796':
    raise SystemExit('Test-only org.json dependency checksum mismatch')
PY
sources=(app/src/main/java/in/smkt/haldesk/AiEvidence.java app/src/main/java/in/smkt/haldesk/AiPolicy.java app/src/main/java/in/smkt/haldesk/AiClient.java app/src/main/java/in/smkt/haldesk/AgentDesk.java tests/AiPolicyTest.java tests/AiClientTest.java tests/AgentDeskTest.java tests/AiEvidenceTest.java app/src/main/java/in/smkt/haldesk/AiHistoryRetention.java tests/AiHistoryRetentionTest.java)
if command -v javac >/dev/null; then
 javac -encoding UTF-8 -source 8 -target 8 -cp "$test_json_jar" -d build/test-classes "${sources[@]}"
else
 : "${ECJ_JAR:?Set ECJ_JAR when javac is unavailable}"
 java -jar "$ECJ_JAR" -encoding UTF-8 -source 8 -target 8 -cp "$test_json_jar" -d build/test-classes "${sources[@]}"
fi
java -cp "build/test-classes:$test_json_jar" in.smkt.haldesk.AiPolicyTest
java -cp "build/test-classes:$test_json_jar" in.smkt.haldesk.AiClientTest
java -cp "build/test-classes:$test_json_jar" in.smkt.haldesk.AgentDeskTest


java -cp "build/test-classes:$test_json_jar" in.smkt.haldesk.AiEvidenceTest

java -cp "build/test-classes:$test_json_jar" in.smkt.haldesk.AiHistoryRetentionTest
