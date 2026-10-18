#!/usr/bin/env python3
"""Package JNI and class-loader resources required by the pinned runtime jars."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent
resources = {}
for jar in sorted((root / "runtime").glob("*.jar")):
    with ZipFile(jar) as archive:
        for item in archive.infolist():
            name = item.filename
            if item.is_dir() or name.endswith(".class") or name.upper() == "META-INF/MANIFEST.MF" or name.upper().endswith((".SF", ".RSA", ".DSA")):
                continue
            data = archive.read(name)
            if name.startswith("META-INF/services/") and name in resources:
                data = b"\n".join(dict.fromkeys((resources[name] + b"\n" + data).splitlines())) + b"\n"
            elif name in resources and resources[name] != data:
                # Keep all license texts without ambiguous duplicate ZIP entries.
                name = "assets/runtime-licenses/" + jar.stem + "/" + name
            resources[name] = data
with ZipFile(root / "build/unsigned.apk", "a", compression=ZIP_DEFLATED) as apk:
    for file in (root / "runtime/lib").rglob("*.so"):
        apk.write(file, file.relative_to(root / "runtime").as_posix())
    for name, data in resources.items():
        apk.writestr(name, data)
print("Packaged JNI libraries, Kotlin resources and service-loader metadata.")
