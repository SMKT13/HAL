"""Verify source release identity. Artifact certificate verification is done after signing."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
build=(root/'app/build.gradle').read_text();main=(root/'app/src/main/java/in/smkt/haldesk/MainActivity.java').read_text()
assert re.search(r"applicationId ['\"]in.smkt.haldesk['\"]",build)
assert re.search(r'versionCode\s+60\b',build)
assert re.search(r"versionName ['\"]5\.4\.0['\"]",build)
assert 'https://appassets.androidplatform.net/' in main
assert 'obj.put("version","5.4.0")' in main
assert 'HAL Atlas' in (root/'app/src/main/AndroidManifest.xml').read_text()
assert 'HAL_SIGNING_KEY_FILE' in (root/'build.sh').read_text()
print('Source identity verified: in.smkt.haldesk 5.4.0 / 60; legacy origin retained')
