#!/usr/bin/env python3
"""Fail CI if the Android build, manifest, and signed workflow disagree about release identity."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
BUILD = (ROOT / "android/app/build.gradle").read_text()
MANIFEST = (ROOT / "android/app/src/main/AndroidManifest.xml").read_text()
SCRIPT = (ROOT / "android/build.sh").read_text()
SIGNED = (ROOT / ".github/workflows/android-signed-release.yml").read_text()
TEST = (ROOT / ".github/workflows/test.yml").read_text()
MAIN = (ROOT / "android/app/src/main/java/in/smkt/haldesk/MainActivity.java").read_text()


def required(pattern, value, description):
    match = re.search(pattern, value)
    if not match:
        raise SystemExit(f"Release config mismatch: missing {description}")
    return match.group(1)


name = required(r"versionName\s+['\"]([^'\"]+)['\"]", BUILD, "versionName")
code = required(r"versionCode\s+(\d+)", BUILD, "versionCode")
application_id = required(r"applicationId\s+['\"]([^'\"]+)['\"]", BUILD, "applicationId")
if application_id != "in.smkt.haldesk":
    raise SystemExit("Release config mismatch: app package ID changed")
if f'android:versionName="{name}"' not in MANIFEST:
    raise SystemExit("Release config mismatch: AndroidManifest version name")
if f'android:versionCode="{code}"' not in MANIFEST:
    raise SystemExit("Release config mismatch: AndroidManifest version code")
if f'obj.put("version","{name}")' not in MAIN:
    raise SystemExit("Release config mismatch: native connection version")
signed_filename = f"HAL-Desk-v{name}.apk"
for source, label in [(SCRIPT, "build.sh"), (SIGNED, "signed workflow")]:
    if signed_filename not in source:
        raise SystemExit(f"Release config mismatch: expected {signed_filename} in {label}")
if f"name: HAL-Desk-v{name}-signed" not in SIGNED:
    raise SystemExit("Release config mismatch: signed artifact name")
if f"name: HAL-Desk-v{name}-unsigned-and-apksigner" not in TEST:
    raise SystemExit("Release config mismatch: unsigned artifact name")
if "HAL_SIGNING_JKS_BASE64" not in SIGNED or "HAL_SIGNING_PASSWORD" not in SIGNED:
    raise SystemExit("Release config mismatch: private signing identity not configured")
if "HAL_CREATE_SIGNING_KEY=1" in SIGNED:
    raise SystemExit("Signing workflow must never generate a replacement signing key")
if "workflow_dispatch:" not in SIGNED:
    raise SystemExit("Signed artifact publishing must be manually initiated")
print(f"Release config validated: {application_id} v{name}, code {code}, artifact {signed_filename}")
