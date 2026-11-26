"""Verify a release against a previous original-identity APK and tested assets."""
import argparse, hashlib, json, re, struct, subprocess, zipfile
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('apk', type=Path)
p.add_argument('--unsigned', action='store_true', help='Verify an unsigned development APK')
p.add_argument('--previous', required=True, type=Path)
p.add_argument('--build-tools', required=True, type=Path)
a = p.parse_args()
root = Path(__file__).resolve().parents[1]
def run(name, *args):
    return subprocess.check_output([str(a.build_tools/name), *map(str,args)], text=True, stderr=subprocess.STDOUT)
def identity(apk):
    s = run('aapt','dump','badging',apk)
    return s, re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'",s).groups()
new, (package,code,version) = identity(a.apk)
old, (oldpackage,oldcode,oldversion) = identity(a.previous)
assert package == oldpackage == 'in.smkt.haldesk'
assert int(code) == 60 and int(code)>int(oldcode) and version=='5.4.0'
assert "application-label:'HAL Atlas'" in new
assert "sdkVersion:'26'" in new and "targetSdkVersion:'35'" in new
expected_permissions = {
    'android.permission.INTERNET', 'android.permission.POST_NOTIFICATIONS',
    'android.permission.WAKE_LOCK', 'android.permission.ACCESS_NETWORK_STATE',
    'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.FOREGROUND_SERVICE',
    'in.smkt.haldesk.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION',
}
assert set(re.findall(r"uses-permission: name='([^']+)'",new)) == expected_permissions
oldsig = run('apksigner','verify','--verbose','--print-certs',a.previous)
fingerprint = lambda s: re.search(r'Signer #1 certificate SHA-256 digest: (\w+)',s).group(1)
previous_cert = fingerprint(oldsig)
assert previous_cert == 'a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382'
cert = None
schemes = []
if a.unsigned:
    check = subprocess.run([str(a.build_tools/'apksigner'),'verify',str(a.apk)],
                           text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    assert check.returncode != 0 and 'Missing META-INF/MANIFEST.MF' in check.stdout, check.stdout
else:
    sig = run('apksigner','verify','--verbose','--print-certs',a.apk)
    cert = fingerprint(sig)
    assert cert == previous_cert
    for scheme in ('v2','v3'):
        assert f'Verified using {scheme} scheme (APK Signature Scheme {scheme}): true' in sig
        schemes.append(scheme)
run('zipalign','-c','-P','16','4',a.apk)
alignment = {}
with zipfile.ZipFile(a.apk) as z:
    for name in ['index.html','style4.css','desk4.js']:
        assert z.read('assets/'+name)==(root/'app/src/main/assets'/name).read_bytes(), name+' is stale'
    assert b'SYNTH_F' not in z.read('assets/desk4.js')
    for name in z.namelist():
        assert not name.lower().endswith(('.jks','.keystore','password.txt','.onnx')), name
        if name.startswith(('lib/arm64-v8a/','lib/x86_64/')) and name.endswith('.so'):
            b=z.read(name);assert b[:6]==b'\x7fELF\x02\x01'
            offset=struct.unpack_from('<Q',b,32)[0]
            size,count=struct.unpack_from('<HH',b,54)
            values=[struct.unpack_from('<Q',b,offset+i*size+48)[0] for i in range(count) if struct.unpack_from('<I',b,offset+i*size)[0]==1]
            assert values and all(n>=16384 for n in values), (name,values)
            alignment[name]=values
assert alignment
print(json.dumps({'applicationId':package,'versionName':version,'versionCode':int(code),'previousVersion':oldversion,'previousCode':int(oldcode),'certificateSHA256':cert,'previousCertificateSHA256':previous_cert,'schemes':schemes,'zipAlignment':'passed 16 KB','nativeLoadSegmentAlignments':alignment,'testedAssetsMatch':True,'sizeBytes':a.apk.stat().st_size,'apkSHA256':hashlib.sha256(a.apk.read_bytes()).hexdigest()},indent=2))
