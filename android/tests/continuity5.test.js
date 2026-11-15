'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const C=require('../app/src/main/assets/continuity5.js');
const E=require('../app/src/main/assets/engine4.js');
const D=require('../app/src/main/assets/data4.js');
const start='2026-11-15T09:00:00.000Z',early='2026-11-15T08:59:30.000Z',late='2026-11-15T09:01:00.000Z';
const now=Date.parse('2026-11-15T09:02:00.000Z');
const q=(p,t=start)=>({last_price:p,quote_as_of:t,last_trade_at:t,retrieved_at:t,bid:p-.2,ask:p+.2});
const snap=(s=start)=>({fetched_at_iso:s,spot:q(4700,s),
 futures:[{instrument_key:'F1',expiry:'2026-12-29',lot_size:150,quote:q(5000,s)}],
 option_expiry:'2026-11-23',option_rows:[{strike:4500,put:{instrument_key:'P1',
 lot_size:150,quote:q(50,s)}}]});
test('a new but older HTTP observation cannot silently roll back spot and futures marks',()=>{
 const old=snap();const incoming=snap(early);incoming.spot.last_price=4300;incoming.futures[0].quote.last_price=4000;
 const r=C.reconcile(old,incoming,now);
 A.equal(r.packet.spot.last_price,4700);
 A.equal(r.packet.futures[0].quote.last_price,5000);
 A.match(r.packet.spot.failure,/clock moved backward/);
 A.equal(r.issues.filter(x=>x.code==='provider_clock_regression').length,3);
 A.equal(old.spot.failure,undefined);
});
test('same quote and exchange-trade clocks with different prices become unavailable',()=>{
 const old=snap(),incoming=snap();incoming.spot.last_price=4900;incoming.futures[0].quote.last_price=5100;
 const r=C.reconcile(old,incoming,now);
 A.equal(r.packet.spot.last_price,null);
 A.equal(r.packet.futures[0].quote.last_price,null);
 A.equal(E.normQuote(r.packet.spot).price,null);
 A.equal(r.issues.filter(x=>x.code==='same_clock_price_conflict').length,2);
});
test('same-clock bid and ask changes do not fabricate a last-trade conflict',()=>{
 const old=snap(),incoming=snap();incoming.futures[0].quote.bid=4980;
 const r=C.reconcile(old,incoming,now);
 A.equal(r.packet.futures[0].quote.last_price,5000);
 A.equal(r.issues.length,0);
});
test('a previously quarantined quote stays blocked until a strictly newer clock',()=>{
 const conflict=snap(),same=snap();same.spot.last_price=4500;
 const first=C.reconcile(conflict,same,now).packet;
 const attempt=C.reconcile(first,snap(),now).packet;
 A.equal(attempt.spot.last_price,null);
 const fresh=snap(late);fresh.spot.last_price=4701;
 const accepted=C.reconcile(attempt,fresh,now).packet;
 A.equal(accepted.spot.last_price,4701);
 A.equal(accepted.spot.failure,undefined);
});
test('future clocks are labelled and cannot create apparently current marks',()=>{
 const old=snap(),incoming=snap('2026-11-15T10:00:00Z');
 const r=C.reconcile(old,incoming,now);
 A.equal(r.packet.spot.last_price,null);
 A.match(r.packet.spot.failure,/future-dated/);
});
test('same instrument key but different lot size is recorded as contract conflict',()=>{
 const old=snap(),incoming=snap(late);
 incoming.futures[0].lot_size=125;
 const r=C.reconcile(old,incoming,now);
 A.deepEqual(r.contractConflicts,['F1']);
 A.equal(r.packet.futures[0].quote.last_price,null);
 A.equal(r.contractConflictSpecs.length,2);
});
test('dated REST quote can repair a previously quarantined observation with no clock',()=>{
 const old=snap(),newer=snap(late);
 old.spot={last_price:null,quote_as_of:null,last_trade_at:null,
   failure:'HAL5 quote integrity: missing provider clock'};
 newer.spot.last_price=4755;
 const r=C.reconcile(old,newer,now);
 A.equal(r.packet.spot.last_price,4755);
 A.equal(r.packet.spot.failure,undefined);
});
test('future-clock quarantine is resolved by a valid later clock without waiting for the bogus future hour',()=>{
 const old=snap(),bad=snap('2026-11-15T10:00:00Z');
 const first=C.reconcile(old,bad,now).packet;
 A.equal(first.spot.last_price,null);
 A.equal(first.spot.quote_as_of,start);
 const good=snap(late);good.spot.last_price=4800;
 const recovered=C.reconcile(first,good,now).packet;
 A.equal(recovered.spot.last_price,4800);
 A.equal(recovered.spot.failure,undefined);
});
test('a same-clock verified contract result cannot erase quarantined snapshot prices',()=>{
 const prior=snap(),contradict=snap();contradict.futures[0].quote.last_price=6000;
 let s=D.ingest(D.empty(),'snapshot',prior,start);
 s=D.ingest(s,'snapshot',contradict,late);
 const before=D.market(s);
 A.equal(before.quotes.F1.price,null);
 s=D.ingest(s,'research',{section:'contracts',frame:'D',fetched_at_iso:late,
  data:{contracts:[{type:'FUT',instrument_key:'F1',expiry:'2026-12-29',
   lot_size:150,verified:true,quote:q(5000,start)}]}},late);
 const after=D.market(s);
 A.equal(after.quotes.F1.price,null);
 A.equal(after.quotes.F1.failure.startsWith('HAL5 quote integrity:'),true);
});
test('failure cannot modify prior or incoming source packets',()=>{
 const old=snap(),incoming=snap(early),before=JSON.stringify([old,incoming]);
 C.reconcile(old,incoming,now);
 A.equal(JSON.stringify([old,incoming]),before);
});
test('first valid observation passes through unchanged',()=>{
 const initial=snap();
 const r=C.reconcile(null,initial,now);
 A.deepEqual(r.packet,initial);A.equal(r.issues.length,0);
});
test('data boundary preserves newer held mark after an out-of-order later HTTP response',()=>{
 const old=snap(),incoming=snap(early);incoming.futures[0].quote.last_price=1000;
 let s=D.ingest(D.empty(),'snapshot',old,start);
 s=D.ingest(s,'snapshot',incoming,late);
 const m=D.market(s);
 A.equal(m.quotes.F1.price,5000);
 A.equal(m.quotes.F1.failure.includes('HAL5 quote integrity'),true);
 A.equal(m.dataQuality.provenanceFailures>0,true);
});
test('contract identity conflict remains visible across later ordinary refreshes',()=>{
 const old=snap(),changed=snap(late);changed.futures[0].lot_size=125;
 let s=D.ingest(D.empty(),'snapshot',old,start);
 s=D.ingest(s,'snapshot',changed,late);
 A.equal(s.failure,'market_integrity_review');
 const later='2026-11-15T09:01:30Z',next=snap(later);next.futures[0].lot_size=125;
 s=D.ingest(s,'snapshot',next,later);
 A.equal(s.failure,'market_integrity_review');
 A.ok(s.health.market.integrityWarnings.some(x=>x.code==='unresolved_contract_identity'));
 A.equal(D.market(s).contracts.some(c=>c.instrumentKey==='F1'),false);
});
test('contract identity rollover cannot be accepted as the same saved instrument',()=>{
 const old=snap(),incoming=snap(late);incoming.futures[0].lot_size=125;
 let s=D.ingest(D.empty(),'snapshot',old,start);
 s=D.ingest(s,'snapshot',incoming,late);
 const m=D.market(s);
 A.ok(m.contractConflicts.includes('F1'));
 A.equal(m.contracts.some(c=>c.instrumentKey==='F1'),false);
 const mark=E.resolveMark({type:'FUT',id:'f',instrumentKey:'F1',
 expiry:'2026-12-29',lots:1,lotSize:150,entry:4800,manual:5000},m,{now});
 A.equal(mark.price,null);
});
