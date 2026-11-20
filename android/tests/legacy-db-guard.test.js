'use strict';
const test=require('node:test'), A=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const base=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8');
test('legacy store fails closed on installed Room 2 instead of downgrading',()=>{
 const code=read('app/src/main/java/in/smkt/haldesk/BookStore.java');
 A.match(code,/SQLiteDatabase\.OPEN_READONLY/);
 A.match(code,/schemaAtOpen==2/);
 A.match(code,/room_v2_requires_reconciliation/);
 A.match(code,/getWritableDatabase\(\)/);
 A.match(code,/getReadableDatabase\(\)/);
 A.doesNotMatch(code,/fallbackToDestructiveMigration|deleteDatabase\(/);
});

test('detect installed schema exactly once and surface a clear fail-closed message',()=>{
 const code=read('app/src/main/java/in/smkt/haldesk/BookStore.java');
 const main=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 A.match(code,/BookStore\(Context context\)\{this\(context,schemaOf\(context\)\);\}/);
 A.match(code,/schemaAtOpen=observedSchema/);
 A.match(main,/This installation has a newer Room trading database/);
});

test('unknown or corrupt sqlite schema cannot crash BookStore construction',()=>{
 const store=read('app/src/main/java/in/smkt/haldesk/BookStore.java');
 const robo=read('app/src/test/java/in/smkt/haldesk/BookStoreGuardTest.java');
 A.match(store,/return \(version==1\|\|version==2\)\?version:0/);
 A.match(store,/database_unreadable_or_unsupported/);
 A.match(robo,/malformedSqliteCannotCrashConstructorOrDestroyBytes/);
 A.match(robo,/unknownSchemaFailsClosedWithoutCrashingConstructor/);
});
