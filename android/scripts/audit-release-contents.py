"""Reject identifiable bundled credentials and verify every tracked web asset."""
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
assets = json.loads((root / "web-assets-sha256.json").read_text())
patterns = (
    rb"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----",
    rb"AIza[0-9A-Za-z_-]{35}",
    rb"gh[pousr]_[A-Za-z0-9]{36,}",
)
with zipfile.ZipFile(sys.argv[1]) as archive:
    names = archive.namelist()
    if len(names) != len(set(names)):
        raise SystemExit("Duplicate APK entries")
    for name in names:
        path = Path(name.lower())
        if path.suffix in {".p12", ".pfx", ".jks", ".keystore", ".key"} or path.name in {
            ".env", "key.properties", "local.properties", "password.txt", "credentials.json"
        }:
            raise SystemExit(f"Unexpected sensitive file type in {name}")
        content = archive.read(name)
        if any(re.search(pattern, content) for pattern in patterns):
            raise SystemExit(f"Potential credential in {name}")
    for name, expected in assets.items():
        if hashlib.sha256(archive.read("assets/" + name)).hexdigest() != expected:
            raise SystemExit(f"Tested asset differs: {name}")
print(f"Verified {len(assets)} asset digests; no recognized credential patterns in {len(names)} entries")
