'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/optionslab5.js');
const example={version:1,drafts:[{id:'paper-1',name:'HAL virtual hedge',status:'draft',
 legs:[{type:'PE',side:'LONG',expiry:'2026-12-29',strike:4500,lots:1,lotSize:150,entry:38.9}],
 fees:45,createdAt:'2026-11-14T09:00:00Z',closedAt:'',exits:[],note:''}]};
const copy=x=>JSON.parse(JSON.stringify(x));
test('4.5 draft remains readable without schema changes',()=>{
 const old=copy(example);const migrated=E.paperDoc(old);
 A.equal(migrated.version,1);A.equal(migrated.drafts[0].status,'draft');
 A.equal(migrated.drafts[0].openedFees,45);
 A.equal(JSON.stringify(old),JSON.stringify(example));
});
test('PAPER trade opening locks exact legs, price, lots and initial charges',()=>{
 const opened=E.paperStart(copy(example),'paper-1','2026-11-14T09:30:00Z');
 const d=opened.drafts[0];A.equal(d.status,'open');A.equal(d.openedAt,'2026-11-14T09:30:00Z');
 A.equal(d.openedFees,45);A.deepEqual(d.openedLegs,d.legs);
 for(const change of [x=>x.entry=100,x=>x.lotSize=75,x=>x.lots=2,x=>x.strike=4300,x=>x.expiry='2027-01-28']){
  const tampered=copy(opened);change(tampered.drafts[0].legs[0]);
  A.throws(()=>E.paperDoc(tampered),/cannot be edited/);
 }
 A.throws(()=>E.paperReplaceDraft(opened,'paper-1',d.legs,1),/locked/);
 A.throws(()=>E.paperStart(opened,'paper-1','2026-11-14T10:00:00Z'),/Only nonempty PAPER drafts/);
});
test('valid PAPER close keeps original entry and account for total fees once',()=>{
 const opened=E.paperStart(copy(example),'paper-1','2026-11-14T09:30:00Z');
 const closed=E.paperClose(opened,'paper-1',[70],80,'2026-11-14T10:30:00Z');
 const d=closed.drafts[0];A.equal(d.status,'closed');A.deepEqual(d.exits,[70]);
 A.equal(d.openedFees,45);A.equal(d.fees,80);
 A.equal((d.exits[0]-d.legs[0].entry)*d.legs[0].lots*d.legs[0].lotSize-d.fees,4585);
 A.throws(()=>E.paperClose(closed,'paper-1',[80],90,'2026-11-14T11:30:00Z'),/Only open/);
 A.throws(()=>E.paperReplaceDraft(closed,'paper-1',d.legs,80),/locked/);
});
test('PAPER fees cannot decrease below locked opening charges',()=>{
 const opened=E.paperStart(copy(example),'paper-1','2026-11-14T09:30:00Z');
 A.throws(()=>E.paperClose(opened,'paper-1',[70],10,'2026-11-14T10:30:00Z'),/opening fees/);
 A.throws(()=>E.paperClose(opened,'paper-1',[],80,'2026-11-14T10:30:00Z'),/each open leg/);
 A.throws(()=>E.paperClose(opened,'paper-1',[-1],80,'2026-11-14T10:30:00Z'),/nonnegative/);
 A.throws(()=>E.paperClose(opened,'paper-1',[70],80,'2026-11-14T08:30:00Z'),/timestamp/);
});
test('draft can be edited before opening, without changing the actual portfolio',()=>{
 const realBook={legs:[{type:'FUT',expiry:'2026-12-29',lotSize:150,lots:2,entry:4927.35}],journal:[{id:'oct',fees:2000}]},before=JSON.stringify(realBook);
 const legs=[{...example.drafts[0].legs[0],entry:49}];
 const draft=E.paperReplaceDraft(copy(example),'paper-1',legs,50);
 A.equal(draft.drafts[0].legs[0].entry,49);
 A.equal(JSON.stringify(realBook),before);
});
test('historical opened PAPER without snapshot adopts its validated opening without rewriting',()=>{
 const legacy=copy(example);legacy.drafts[0].status='open';
 const upgraded=E.paperDoc(legacy);A.deepEqual(upgraded.drafts[0].openedLegs,upgraded.drafts[0].legs);
 A.equal(upgraded.drafts[0].openedAt,'');
});
test('invalid status, duplicated ID and closed trades without exits fail closed',()=>{
 const broken=copy(example);broken.drafts[0].status='FILLED';
 A.throws(()=>E.paperDoc(broken),/state/);
 const duplicate=copy(example);duplicate.drafts.push(copy(example.drafts[0]));
 A.throws(()=>E.paperDoc(duplicate),/duplicate/);
 const bad=copy(example);bad.drafts[0].status='closed';
 A.throws(()=>E.paperDoc(bad),/every leg/);
});
test('NSE stock derivatives preserve historical date-effective expiry clocks',()=>{
 A.equal(new Date(E.end('2026-07-30')).toISOString(),'2026-07-30T10:00:00.000Z');
 A.equal(new Date(E.end('2026-11-23')).toISOString(),'2026-11-23T10:10:00.000Z');
 A.equal(new Date(E.end('2026-12-29')).toISOString(),'2026-12-29T10:15:00.000Z');
});
