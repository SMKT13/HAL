'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const E=require('../app/src/main/assets/engine4.js'),D=require('../app/src/main/assets/data4.js');
const ui=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/ui4.js'),'utf8');
const iso=E.istDate(),later=String(Number(iso.slice(0,4))+1)+iso.slice(4);
const held={id:'existing',type:'FUT',expiry:iso,lots:2,lotSize:150,entry:100};
function rollover(){
 const book={...E.emptyBook(),legs:[held]},forms=[],saves=[];
 const values={'roll-listed':'next','roll-out':1,'roll-in':1,'roll-date':iso,'roll-entry':103,'roll-exit':102,'roll-fees':12};
 const context={E,book,revision:8,market:()=>({contracts:[{instrumentKey:'next',expiry:later,type:'FUT',lotSize:150}]}),crypto:require('node:crypto').webcrypto,
 date:String,money:String,select:()=>'',input:()=>'',table:()=>'',row:()=>'',modal:(title,body,label,submit)=>forms.push(submit),
 text:k=>values[k],value:k=>values[k],commit:b=>{saves.push(E.validateBook(b));context.revision++;},toast:()=>{}};
 vm.runInNewContext(ui.slice(ui.indexOf('function recordRollover('),ui.indexOf('function closeLeg('))+"\nrecordRollover('existing');",context);
 return {forms,saves,book,context,values};
}
test('partial rollover waits for confirmation and writes linked close and open together once',()=>{
 const {forms,saves,book}=rollover();forms[0]();assert.equal(saves.length,0);forms[1]();
 const updated=saves[0];assert.equal(book.legs[0].lots,2);assert.equal(updated.legs[0].lots,1);
 assert.equal(updated.legs[1].instrumentKey,'next');assert.equal(updated.legs[1].entry,103);
 assert.equal(updated.journal[0].gross,300);assert.equal(updated.journal[0].fees,12);
 assert.ok(updated.journal[0].note.includes(updated.legs[1].id));assert.throws(forms[1],/changed/);assert.equal(saves.length,1);
});
test('invalid fills and changes during review leave the book untouched',()=>{
 const {forms,saves,context,values}=rollover();values['roll-out']=3;assert.throws(forms[0]);values['roll-out']=1;
 forms[0]();context.revision++;assert.throws(forms[1],/changed/);assert.equal(saves.length,0);
});
test('installed empty native book takes precedence over legacy storage and differs from fresh install',()=>{
 const empty=E.emptyBook();const installed=D.loadBook({loadBook:()=>JSON.stringify({ok:true,book:empty,revision:2})},{getItem:()=>{throw Error('unexpected legacy read');}});
 assert.equal(installed.exists,true);assert.equal(installed.revision,2);
 assert.equal(!!D.loadBook(null,{getItem:()=>null}).exists,false);
});

test('installed-book review preserves populated records and a recoverable pre-review copy',()=>{
 const source=E.emptyBook();
 source.legs=[{...held,lots:3,manual:108,manualAt:new Date().toISOString()}];
 const populated=E.closeLeg(source,held.id,1,105,7,iso);
 populated.preferences.theme='light';
 const original=JSON.stringify(populated);
 const entries=new Map([['hal_desk_v4',original]]);
 const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v)};
 const loaded=D.loadBook(null,storage);
 let confirm;
 const ctx={D,N:null,localStorage:storage,book:loaded.book,revision:loaded.revision,upgradeReview:{exists:loaded.exists},
  modal:(title,body,label,submit)=>{confirm=submit;},render:()=>{},date:String,money:String,table:()=>'',row:()=>'',E};
 vm.runInNewContext(ui.slice(ui.indexOf('function reviewInstalled('),ui.indexOf('document.addEventListener',ui.indexOf('function reviewInstalled(')))+'\nreviewInstalled();',ctx);
 assert.equal(storage.getItem('hal_desk_v4'),original);
 confirm();
 assert.equal(storage.getItem('hal_previous_v4'),original);
 assert.equal(storage.getItem('atlas.blueprint.reviewed.v1'),'1');
 const restored=D.loadBook(null,storage).book;
 for(const field of ['legs','journal','preferences'])assert.deepEqual(restored[field],loaded.book[field]);
 const before=E.ledger(loaded.book),after=E.ledger(restored);
 for(const field of ['open','realized','charges','net'])assert.equal(after[field],before[field]);
 assert.equal(after.realized,750);assert.equal(after.charges,7);
});
test('Risk, F&O and AI context use the routes registered in the directory',()=>{
 const routes=ui.slice(ui.indexOf('const atlasTabs='),ui.indexOf('function workspace('));
 for(const [screen,key,tab,title] of [['position','risk','plan','Current protection'],['position','fno','research','F&O Desk'],['ai','coach','research','Skills coach']]){
  const context={ui:{screen,[screen==='ai'?'aiPage':screen]:key},researchDesks:{company:[]}};
  const result=vm.runInNewContext('Array.prototype.flat=undefined;'+routes+';[atlasTab(),currentAtlasRoute().route[2]]',context);
  assert.deepEqual(Array.from(result),[tab,title]);
 }
});
