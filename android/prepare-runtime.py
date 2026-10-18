#!/usr/bin/env python3
"""Fetch pinned Android inference artifacts; never downloads model weights."""
import hashlib
import json
from pathlib import Path
import urllib.request
from zipfile import ZipFile

root = Path(__file__).resolve().parent
cache = root / "runtime"
cache.mkdir(exist_ok=True)
for item in json.loads((root / "runtime-lock.json").read_text()):
    target = (cache / "tools" if item.get("build_only") else cache) / item["name"]
    target.parent.mkdir(exist_ok=True)
    if not target.exists() or hashlib.sha256(target.read_bytes()).hexdigest() != item["sha256"]:
        print("Downloading", item["name"], flush=True)
        partial = target.with_suffix(target.suffix + ".part")
        try:
            with urllib.request.urlopen(item["url"], timeout=60) as response, partial.open("wb") as out:
                while chunk := response.read(1024 * 1024):
                    out.write(chunk)
            if hashlib.sha256(partial.read_bytes()).hexdigest() != item["sha256"]:
                raise RuntimeError("Runtime checksum mismatch: " + item["name"])
            partial.replace(target)
        finally:
            partial.unlink(missing_ok=True)
with ZipFile(cache / "litertlm-android-0.18.0.aar") as bundle:
    (cache / "litertlm.jar").write_bytes(bundle.read("classes.jar"))
    for abi in ("arm64-v8a", "x86_64"):
        dest = cache / "lib" / abi / "liblitertlm_jni.so"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(bundle.read("jni/" + abi + "/liblitertlm_jni.so"))
print("Pinned LiteRT-LM 0.18.0 runtime ready; model weights are not bundled.")
