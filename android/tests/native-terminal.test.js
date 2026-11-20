'use strict';
const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('native terminal is non-exported and linked only from bundled UI',()=>{
 A.match(read('app/src/main/AndroidManifest.xml'),/<activity android:name="\.NativeTerminalActivity" android:exported="false"/);
 A.match(read('app/src/main/java/in/smkt/haldesk/MainActivity.java'),/@JavascriptInterface public void terminal\(\)/);
 A.match(read('app/src/main/assets/index.html'),/id="native-terminal"/);
 A.match(read('app/src/main/assets/ui4.js'),/native\('terminal'\)/);
});
test('native terminal loads validated book without migrating or fabricating derivative marks',()=>{
 const code=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 A.match(code,/BookStore\(context\)\.use/);
 A.match(code,/store\.load\(false\)/);
 A.doesNotMatch(code,/store\.save\(|placeOrder|fallbackToDestructiveMigration|Room\.databaseBuilder/);
 A.match(code,/not a live exchange quote/);A.match(code,/does not substitute the HAL spot price/);
 A.match(code,/FLAG_SECURE/);
});
test('Compose build preserves original DB identity and uses versionCode above Library 58',()=>{
 const gradle=read('app/build.gradle');
 A.match(read('build.gradle'),/org\.jetbrains\.kotlin\.plugin\.compose/);
 A.match(gradle,/buildFeatures \{ compose true \}/);
 A.match(gradle,/versionCode 59/);
 A.match(gradle,/versionName '5\.3\.0'/);
 A.match(read('app/src/main/java/in/smkt/haldesk/BookStore.java'),/haldesk_book\.db",null,observedSchema==1\?1:2,PRESERVE_CORRUPT/);
});

test('native expiry and nominal-coverage safeguards are explicit',()=>{
 const src=read('app/src/main/java/in/smkt/haldesk/NativeCoverage.kt');
 const ui=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 A.match(src,/Math\.multiplyExact/);
 A.match(src,/put contracts|Put contracts/);
 A.match(src,/protection gap is possible/);
 A.match(src,/expiry is past/);
 A.match(ui,/nominalCoverage/);
});

test('Room v2 sidecar is previewed read-only with native BUY/SELL labeling',()=>{
 const reader=read('app/src/main/java/in/smkt/haldesk/RoomReadOnlyPreview.java');
 const ui=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 A.match(reader,/SQLiteDatabase\.OPEN_READONLY/);
 A.match(reader,/BookValidator\.parse\(raw\)/);
 A.match(reader,/FoPositionEntity/);
 A.match(reader,/TradeLedgerEntity/);
 A.doesNotMatch(reader,/\.insert\(|\.delete\(|\.update\(|execSQL\(/);
 A.match(ui,/RoomReadOnlyPreview\.read\(context\)/);
 A.match(ui,/Short put/);A.match(ui,/Short call/);
});

test('short puts and calls never inflate protective hedge coverage',()=>{
 const risk=read('app/src/main/java/in/smkt/haldesk/NativeCoverage.kt');
 const ui=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 A.match(risk,/it\.type == "PE" && it\.side == "BUY"/);
 A.match(risk,/Basic protective-put coverage is withheld/);
 A.match(ui,/ExposureLeg\(it.type, it.expiry, it.lots, it.lotSize, it.side\)/);
});

test('native sidecar preview detects economically changed and original-only contracts',()=>{
 const source=read('app/src/main/java/in/smkt/haldesk/RoomReadOnlyPreview.java');
 const ui=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 A.match(source,/contractDifferences/);
 A.match(source,/legacyOnly/);
 A.match(source,/sameFinite\(a,"entry",b\)/);
 A.match(ui,/Changed:/);
 A.match(ui,/Legacy-only:/);
});

test('Room v2 storage notice offers safe native preview rather than destructive restore',()=>{
 const ui=read('app/src/main/assets/ui4.js');
 A.match(ui,/Room tradebook review needed/);
 A.match(ui,/Do not replace or restore the existing database/);
 A.match(ui,/open-native-terminal/);
 A.match(ui,/'open-native-terminal':\(\)=>native\('terminal'\)/);
});

test('read-only Room ledger breakdown rejects malformed amounts and avoids P&L claims',()=>{
 const reader=read('app/src/main/java/in/smkt/haldesk/RoomReadOnlyPreview.java');
 const ui=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 A.match(reader,/Math\.addExact/);
 A.match(reader,/Math\.subtractExact/);
 A.match(reader,/room_v2_invalid_ledger_fees/);
 A.match(reader,/nativeLedgerRows/);
 A.match(ui,/pending reconciliation/);
 A.match(ui,/not verified lifetime P&L/);
});
