'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/optionslab5.js');require('../app/src/main/assets/optionslab-advanced6.js');
const NOW=Date.parse('2026-11-14T05:00:00Z'),expiry='2026-12-29';
const leg=(type,side,strike,entry,lots=1)=>({type,side,strike,entry,lots,lotSize:150,expiry});
const val=legs=>E.evaluate(legs,{mode:'expiry',now:NOW});
const chain=(at=new Date(NOW).toISOString())=>E.normalizeChain({
 option_expiry:expiry,fetched_at_iso:at,option_rows:[{strike:100,call:{instrument_key:'c1',lot_size:150,quote:{last_price:3,bid:2.5,ask:3.5,open_interest:0,previous_oi:0}},put:{instrument_key:'p1',lot_size:150,quote:{last_price:4,bid:3.5,ask:4.5,open_interest:0,previous_oi:0}}}]
});
const near=(x,y)=>A.ok(Math.abs(x-y)<1e-6,'Values differ: '+x+' / '+y);
test('expiry breakeven is found above twice the option strike',()=>{
 const s=E.summary(val([leg('CE','LONG',100,200)]),100);
 A.deepEqual(s.breakevens,[300]);A.equal(s.maxProfit,Infinity);near(s.maxLoss,30000);
});
test('expiry spread terminal breakeven independent of reference spot',()=>{
 const v=val([leg('CE','LONG',100,80),leg('CE','SHORT',200,5)]);
 A.deepEqual(E.summary(v,10).breakevens,[175]);A.deepEqual(E.summary(v,1000).breakevens,[175]);
});
test('guaranteed-loss put cannot report a fictitious zero maximum profit',()=>{
 const s=E.summary(val([leg('PE','LONG',100,150)]),100);
 near(s.maxProfit,-7500);near(s.maxLoss,22500);A.deepEqual(s.breakevens,[]);
});
test('known zero OI differs from missing provider OI',()=>{
 const c=chain(),a=E.analytics(c,100);A.equal(a.callOI,0);A.equal(a.putOI,0);A.equal(a.pcr,null);
 delete c.rows[0].call.quote.open_interest;delete c.rows[0].put.quote.open_interest;
 const m=E.analytics(c,100);A.equal(m.callOI,null);A.equal(m.putOI,null);
});
test('closed PAPER exit missing or malformed is rejected',()=>{
 const record={version:1,drafts:[{id:'x',status:'closed',legs:[leg('PE','LONG',100,4)],exits:[]}]};
 A.throws(()=>E.paperDoc(record),/every leg/);
 record.drafts[0].exits=[''];A.throws(()=>E.paperDoc(record),/exit prices/);
 record.drafts[0].exits=[null];A.throws(()=>E.paperDoc(record),/exit prices/);
 record.drafts[0].exits=[0];A.equal(E.paperDoc(record).drafts[0].exits[0],0);
});
test('stale HTTP observations cannot be captured as fresh option history',()=>{
 A.throws(()=>E.snapshot(chain(new Date(NOW-3600000).toISOString()),100,NOW),/within 10 minutes/);
 A.equal(E.snapshot(chain(),100,NOW).expiry,expiry);
});
test('captured history mismatch is rejected without modifying input',()=>{
 const bad={version:1,samples:[{at:'2026-11-14T05:00:00Z',day:'2026-11-30',expiry,spot:100}]},old=JSON.stringify(bad);
 A.throws(()=>E.history(bad),/mismatch/);A.equal(JSON.stringify(bad),old);
});
test('NSE November and December close-time boundary is preserved',()=>{
 A.equal(new Date(E.end('2026-11-23')).toISOString(),'2026-11-23T10:10:00.000Z');
 A.equal(new Date(E.end('2026-12-29')).toISOString(),'2026-12-29T10:15:00.000Z');
});
test('snapshot refuses expired contract',()=>{
 const c=chain();c.expiry='2026-10-27';A.throws(()=>E.snapshot(c,100,NOW),/expired/);
});


test('balanced large short/long call legs retain finite payoff limits',()=>{
 const long=leg('CE','LONG',100,1,10000),short=leg('CE','SHORT',200,2,10000);
 const sum=E.summary(val([long,short]),120);
 A.equal(sum.maxProfit,150000000);A.equal(sum.maxLoss,150000000);
 A.equal(sum.tailSlope,0);
});
test('OI/IV samples are ordered by real time across mixed ISO offsets',()=>{
 const h={version:1,samples:[
  {at:'2026-11-13T21:30:00Z',day:'2026-11-14',expiry,iv:31},
  {at:'2026-11-14T00:30:00+05:30',day:'2026-11-14',expiry,iv:30}
 ]};
 const sorted=E.history(h);
 A.equal(sorted.samples[0].iv,30);A.equal(sorted.samples[1].iv,31);
 const duplicate={at:'2026-11-14T03:00:00+05:30',day:'2026-11-14',expiry,iv:32};
 const dedup=E.appendHistory(sorted,duplicate);
 A.equal(dedup.samples.length,2);A.equal(dedup.samples[1].iv,32);
});
