'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js');
const X=require('../app/src/main/assets/expiry5.js');
const B=()=>({...E.emptyBook(),legs:[
 {id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35},
 {id:'p4500',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:38.9},
 {id:'p4400',type:'PE',expiry:'2026-11-23',strike:4400,lots:1,lotSize:150,entry:24.1}
]});
test('full put quantity covers recorded futures before first expiry',()=>{
 const r=X.agenda(B(),'2026-11-15');
 A.equal(r.futureUnits,300);A.equal(r.putUnits,300);A.equal(r.covered,300);
 A.equal(r.uncovered,0);A.equal(r.nextExpiry,'2026-11-23');
});
test('November expiry exposes December 300-unit gap without a false second hedge',()=>{
 const r=X.agenda(B(),'2026-11-15');
 const g=r.alerts.find(a=>a.code==='gap-after-2026-11-23');
 A.equal(g.units,300);A.match(g.detail,/From 2026-11-24/);
 A.equal(r.alerts.some(a=>a.code==='uncovered-now'),false);
});
test('on expiry date uses a review prompt, not a guessed cutoff',()=>{
 const r=X.agenda(B(),'2026-11-23');
 const a=r.alerts.find(x=>x.code==='due-PE-2026-11-23');
 A.equal(a.severity,'critical');A.match(a.detail,/broker cutoff/);
});
test('day after put expiry requires broker reconciliation and flags uncovered futures',()=>{
 const r=X.agenda(B(),'2026-11-24');
 A.equal(r.expiredCount,2);A.equal(r.putUnits,0);
 A.equal(r.uncovered,300);A.equal(r.alerts.filter(x=>x.code.startsWith('expired-')).length,2);
});
test('partial futures close reduces uncovered units in scheduled gap',()=>{
 const b=B();b.legs[0].lots=1;
 const r=X.agenda(b,'2026-11-15');
 A.equal(r.futureUnits,150);A.equal(r.alerts.find(a=>a.code==='gap-after-2026-11-23').units,150);
});
test('later-dated put is flagged as possibly independent after future expiration',()=>{
 const b=B();b.legs[1].expiry='2027-01-28';b.legs[2].expiry='2027-01-28';
 const r=X.agenda(b,'2026-11-15');
 A.ok(r.alerts.some(a=>a.code==='put-after-future'));
});
test('urgency prioritizes expired and uncovered risks even with old quote data',()=>{
 const r=X.agenda(B(),'2027-01-01');
 A.equal(r.alerts[0].severity,'critical');
 A.equal(r.expiredCount,3);A.equal(r.futureUnits,0);
});
test('empty book produces no invented holdings or expiry',()=>{
 const r=X.agenda(E.emptyBook(),'2026-11-15');
 A.equal(r.alerts.length,0);A.equal(r.nextExpiry,null);
});
test('invalid calendar dates and invalid lots reject the agenda',()=>{
 A.throws(()=>X.agenda(B(),'2026-02-30'),/Invalid/);
 const b=B();b.legs[0].lots=0;A.throws(()=>X.agenda(b));
});
test('futures margin and available cash never inferred when snapshot is absent',()=>{
 const r=X.agenda(B(),'2026-11-15');
 A.ok(r.alerts.some(a=>a.code==='funding-unknown'));
 A.equal(r.alerts.some(a=>a.detail.includes('required margin is')),false);
});
test('stale manual funding observation is labelled as needing verification',()=>{
 const b=B();b.funding={margin:600000,free:10000,at:'2026-11-13T10:00:00Z'};
 const r=X.agenda(b,'2026-11-15');
 A.ok(r.alerts.some(a=>a.code==='funding-stale'));
});
test('user reserve threshold warns without inventing a broker margin requirement',()=>{
 const b=B();b.funding={margin:600000,free:5000,at:'2026-11-15T08:00:00Z'};
 b.riskProfile.reserve=10000;
 const r=X.agenda(b,'2026-11-15');
 A.ok(r.alerts.some(a=>a.code==='reserve-below-limit'));
 A.equal(r.alerts.some(a=>a.code==='funding-stale'),false);
});
test('recorded zero available funds prompts broker verification',()=>{
 const b=B();b.funding={margin:20000,free:0,at:'2026-11-15T09:00:00Z'};
 A.ok(X.agenda(b,'2026-11-15').alerts.some(a=>a.code==='funding-zero'));
});
test('agenda is immutable and deterministic',()=>{
 const b=B(),before=JSON.stringify(b);
 A.deepEqual(X.agenda(b,'2026-11-15'),X.agenda(b,'2026-11-15'));
 A.equal(JSON.stringify(b),before);
});
test('position confirmation affects review status without altering journal',()=>{
 const b=B();b.riskProfile.confirmedAt='2026-11-14T10:00:00Z';
 b.riskProfile.confirmedBook='synthetic-confirmation';
 const r=X.agenda(b,'2026-11-15');
 A.equal(r.alerts.some(x=>x.code==='broker-confirmation'),false);
});
