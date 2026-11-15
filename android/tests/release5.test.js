'use strict';
const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('alpha build retains package identity, API 26 minimum and higher upgrade code',()=>{
 const b=read('app/build.gradle');
 A.match(b,/applicationId\s+['"]in\.smkt\.haldesk['"]/);
 A.match(b,/namespace\s+['"]in\.smkt\.haldesk['"]/);
 A.match(b,/minSdk\s+26\b/);
 const code=Number(b.match(/versionCode\s+(\d+)/)?.[1]);
 A.ok(code>31,'5.0 alpha must be an upgrade over v4.6 code31');
 A.match(b,/versionName\s+['"]5\.0\.0-alpha\.1['"]/);
});
test('source version matches Gradle and npm lock metadata',()=>{
 const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
 A.equal(pkg.version,'5.0.0-alpha.1');
 A.equal(lock.version,pkg.version);
 A.equal(lock.packages[''].version,pkg.version);
 A.match(read('app/src/main/java/in/smkt/haldesk/MainActivity.java'),
  /obj\.put\("version","5\.0\.0-alpha\.1"\)/);
});
test('private original-certificate release signing remains mandatory',()=>{
 const build=read('build.sh');
 A.match(build,/HAL_SIGNING_KEY_FILE/);
 A.match(build,/HAL_SIGNING_PASSWORD_FILE/);
 A.match(build,/hal-personal/);
 A.match(build,/a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382/);
 A.match(build,/apksigner["']?\s+verify --verbose --print-certs/);
 A.match(build,/HAL_UNSIGNED_ONLY/);
 A.match(build,/HAL-Desk-v5\.0\.0-alpha\.1-signed\.apk/);
});
test('existing offline data, cleartext and order-routing restrictions remain explicit',()=>{
 const manifest=read('app/src/main/AndroidManifest.xml');
 A.match(manifest,/android:allowBackup="false"/);
 A.match(manifest,/android:usesCleartextTraffic="false"/);
 A.doesNotMatch(manifest,/android\.permission\.READ_SMS|android\.permission\.SEND_SMS/);
 A.match(read('README.md'),/read-only, no orders/i);
});
