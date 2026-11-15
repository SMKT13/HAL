'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const Q=require('../app/src/main/assets/quality5.js'),E=require('../app/src/main/assets/engine4.js'),D=require('../app/src/main/assets/data4.js');
const at='2026-11-15T09:00:00Z',later='2026-11-15T09:00:30Z';
const q=(price,date=at)=>({price,quoteAt:date,tradeAt:date,retrievedAt:date,source:'REST'});
const one={instrumentKey:'F1',type:'FUT',expiry:'2026-12-29',lotSize:150,strike:null};
test('matching timestamp and conflicting last-trade prices withhold marks',()=>{
 const r=Q.chooseQuote(q(5000),q(5001));
 A.equal(r.price,null);A.match(r.failure,/Conflicting prices/);
 A.equal(E.quoteQuality(r,{now:Date.parse(at)}).valid,false);
});
test('sub-paisa rounding does not manufacture a feed conflict',()=>{
 const r=Q.chooseQuote(q(5000.001),q(5000.005));
 A.ok(Number.isFinite(r.price));
});
test('later quote restores after conflicting earlier packet',()=>{
 const conflict=Q.chooseQuote(q(5000),q(4900));
 A.equal(Q.chooseQuote(conflict,q(5100,at)).price,null);
 A.equal(Q.chooseQuote(conflict,q(5100,later)).price,5100);
});
test('older source clock and older trade cannot displace valid quote',()=>{
 A.equal(Q.chooseQuote(q(5000,later),q(6000,at)).price,5000);
});
test('cache cannot displace equally timestamped REST',()=>{
 const r=Q.chooseQuote(q(5000),{...q(5000),source:'CACHE',retrievedAt:later});
 A.equal(r.source,'REST');
});
test('contract lot or expiry mismatch is a hard identity conflict',()=>{
 A.equal(Q.sameContract(one,{...one}),true);
 A.equal(Q.sameContract(one,{...one,lotSize:125}),false);
 A.equal(Q.sameContract(one,{...one,expiry:'2027-01-28'}),false);
 A.equal(Q.sameContract({...one,type:'PE',strike:4500},{...one,type:'PE',strike:4400}),false);
});
test('market aggregation with conflicting same-time option quote fails closed',()=>{
 const now=at,snap={spot:{last_price:4700,quote_as_of:at,last_trade_at:at,retrieved_at:at},
  futures:[{instrument_key:'F1',expiry:'2026-12-29',lot_size:150,quote:{last_price:5000,quote_as_of:at,last_trade_at:at,retrieved_at:at}}]};
 let s=D.ingest(D.empty(),'snapshot',snap,now);
 s=D.ingest(s,'research',{section:'contracts',frame:'D',data:{contracts:[{
  type:'FUT',expiry:'2026-12-29',instrument_key:'F1',lot_size:150,verified:true,
  quote:{last_price:4990,quote_as_of:at,last_trade_at:at,retrieved_at:at}
 }]}},now);
 const mark=E.resolveMark({id:'f',type:'FUT',expiry:'2026-12-29',lots:1,lotSize:150,entry:4800,instrumentKey:'F1'},D.market(s),{now:Date.parse(at)});
 A.equal(mark.price,null);
 A.equal(D.market(s).dataQuality.provenanceFailures>0,true);
});
test('conflicting same-key lot sizes remove contract from eligible marks',()=>{
 const now=at,snap={spot:{last_price:4700,quote_as_of:at,last_trade_at:at,retrieved_at:at},
  futures:[{instrument_key:'F1',expiry:'2026-12-29',lot_size:150,quote:{last_price:5000,quote_as_of:at,last_trade_at:at,retrieved_at:at}}]};
 let s=D.ingest(D.empty(),'snapshot',snap,now);
 s=D.ingest(s,'research',{section:'contracts',frame:'D',data:{contracts:[{
  type:'FUT',expiry:'2026-12-29',instrument_key:'F1',lot_size:125,verified:true
 }]}},now);
 const m=D.market(s);
 A.equal(m.contracts.some(c=>c.instrumentKey==='F1'),false);
 A.deepEqual(m.contractConflicts,['F1']);
});
test('data audit retains independent clocks and counts',()=>{
 const m={spot:q(4700),quotes:{a:q(50,later),b:{...q(60),source:'CACHE'}},
 contractConflicts:['F2']};
 const a=Q.audit(m,Date.parse(at)+150000);
 A.equal(a.total,3);A.equal(a.cached,1);A.equal(a.contractConflicts,1);
 A.equal(a.stale,2);A.ok(a.problems.some(x=>x.instrument==='F2'));
});
test('pure merges never mutate source quote objects',()=>{
 const a=q(5000),b=q(4990),before=JSON.stringify([a,b]);
 Q.chooseQuote(a,b);
 A.equal(JSON.stringify([a,b]),before);
});
