'use strict';
const test=require('node:test');
const A=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('HAL Atlas launcher display and identity coexist with preserved Android package',()=>{
 const manifest=read('app/src/main/AndroidManifest.xml');
 const gradle=read('app/build.gradle');
 const icon=read('app/src/main/res/drawable/ic_launcher.xml');
 A.match(manifest,/android:label="HAL Atlas"/);
 A.match(manifest,/android:icon="@drawable\/ic_launcher"/);
 A.match(manifest,/android:allowBackup="false"/);
 A.match(gradle,/applicationId 'in\.smkt\.haldesk'/);
 A.match(gradle,/namespace 'in\.smkt\.haldesk'/);
 A.match(gradle,/versionCode 59\b/);
 A.match(gradle,/versionName '5\.3\.0'/);
 A.match(icon,/android:viewportWidth="108"/);
 A.match(icon,/android:strokeColor="#FFCE78"/);
});
test('Atlas branding is visible and the existing internal route keeps research modules',()=>{
 const html=read('app/src/main/assets/index.html');
 const ui=read('app/src/main/assets/ui4.js');
 const css=read('app/src/main/assets/style4.css');
 A.match(html,/<title>HAL Atlas/);
 A.match(html,/HAL <span>ATLAS<\/span>/);
 A.match(html,/data-screen="technicals"[^>]*>[^<]*<span[^>]*>[^<]*<\/span>Analysis/);
 A.match(ui,/technicals:'analysis'/);
 A.match(ui,/technicals:'Analysis & markets'/);
 A.match(ui,/HAL Atlas · Settings/);
 A.match(ui,/\['analysis','Daily Analysis'\]/);
 A.match(css,/repeat\(5,minmax\(0,1fr\)\)/);
 A.match(css,/--atlas-violet/);
 const bundle=read('scripts/build-assets.js');
 A.ok(bundle.indexOf("'analysis5.js'")>0);
 A.ok(bundle.indexOf("'analysis-ui5.js'")>bundle.indexOf("'analysis5.js'"));
 A.ok(bundle.indexOf("'ui4.js'")>bundle.indexOf("'analysis-ui5.js'"));
});
test('existing accounts, local book history, signing secrets and migrations remain compatible',()=>{
 const book=read('app/src/main/java/in/smkt/haldesk/BookStore.java');
 const secret=read('app/src/main/java/in/smkt/haldesk/SecretStore.java');
 const storage=read('app/src/main/assets/data4.js');
 const main=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 A.match(book,/"haldesk_book.db"/);
 A.match(secret,/"hal-upstox-secrets-v1"/);
 A.match(storage,/hal_desk_v4/);
 A.match(storage,/hal_desk_v2/);
 A.match(storage,/app:'HAL Atlas'/);
 A.match(main,/obj.put\("version","5\.3\.0"\)/);
 A.doesNotMatch(main,/deleteDatabase\(|clearApplicationUserData\(/);
 const E=require('../app/src/main/assets/engine4.js');
 const D=require('../app/src/main/assets/data4.js');
 const legacy=D.previewImport({app:'HAL Desk',schema:4,book:E.emptyBook()});
 A.equal(legacy.version,E.emptyBook().version);
 A.equal(D.safeBackup(E.emptyBook()).app,'HAL Atlas');
});
test('local build and signing scripts align and never change the original certificate',()=>{
 const bash=read('build.sh');
 const windows=read('scripts/local-windows-release.ps1');
 for(const s of [bash,windows]){
  A.match(s,/HAL-Atlas-v5\.3\.0-signed\.apk/);
  A.match(s,/HAL_SIGNING_KEY_FILE/);
  A.match(s,/HAL_SIGNING_PASSWORD_FILE/);
  A.match(s,/hal-personal/);
  A.match(s,/a9e9cd47ef90edc5771ef9ec75046e1ff9033ad043f00325f286173b96837382/);
 }
 A.doesNotMatch(windows,/adb\s+uninstall|pm\s+clear/);
});
