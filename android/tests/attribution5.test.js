'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const R=require('../app/src/main/assets/attribution5.js');
const t0='2026-11-12T10:00:00.000Z',t1='2026-11-12T10:01:00.000Z';
const q0='2026-11-12T09:59:30.000Z',q1='2026-11-12T10:00:30.000Z';
const make=(at,q,fut,put)=>({version:4,savedAt:at,bookRevision:'rev-fixed',markMode:'ltp',
 complete:true,open:(fut-4900)*300+(put-50)*150,realized:-1000,charges:500,
 net:(fut-4900)*300+(put-50)*150-1500,
 positionMarks:[{id:'f',type:'FUT',expiry:'2026-12-29',strike:null,instrumentKey:'FUT1',units:300,
   entry:4900,price:fut,source:'REST LTP',status:'current',quoteAt:q,tradeAt:q,retrievedAt:at},
  {id:'p',type:'PE',expiry:'2026-11-23',strike:4500,instrumentKey:'PE1',units:150,
   entry:50,price:put,source:'REST LTP',status:'current',quoteAt:q,tradeAt:q,retrievedAt:at}]});
test('separately attributes futures and put mark moves and reconciles to net basket',()=>{
 const r=R.compare(make(t0,q0,5000,50),make(t1,q1,5010,40));
 A.equal(r.available,true);
 A.equal(r.items.length,2);
 A.equal(r.items[0].pnl,3000);
 A.equal(r.items[1].pnl,-1500);
 A.equal(r.total,1500);
 A.equal(r.openChange,1500);
 A.equal(r.bookedNetChange,0);
});
test('cannot attribute if earlier saved checkpoint lacks per-leg marks',()=>{
 const first=make(t0,q0,5000,50);delete first.positionMarks;
 const r=R.compare(first,make(t1,q1,5010,40));
 A.equal(r.available,false);A.match(r.reason,/not captured/);
});
test('changed book, position size or mark mode invalidates comparison',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40);
 A.equal(R.compare({...a,bookRevision:'rev-other'},b).available,false);
 b.positionMarks[0].units=150;A.equal(R.compare(a,b).available,false);
 b.positionMarks[0].units=300;b.markMode='bid';A.equal(R.compare(a,b).available,false);
});
test('cached, stale, manual, and future-dated observations cannot be represented as verified attribution',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40);
 for(const mutate of [
  x=>x.source='Cached REST',x=>x.source='Manual',x=>x.status='stale',
  x=>x.tradeAt='2026-11-12T10:02:00.000Z',x=>x.quoteAt='2026-11-12T09:30:00.000Z',
  x=>x.retrievedAt=null]){
  const copy=JSON.parse(JSON.stringify(b));mutate(copy.positionMarks[0]);
  A.equal(R.compare(a,copy).available,false);
 }
});
test('missing futures or put mark cannot become an invented zero',()=>{
 const a=make(t0,q0,5000,50);
 for(const val of [null,NaN,Infinity,-1,0]){
  const b=make(t1,q1,5010,40);b.positionMarks[0].price=val;
  A.equal(R.compare(a,b).available,false);
 }
});
test('changed recorded fees or realised trades stop pure market-move attribution',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40);
 b.charges++;A.equal(R.compare(a,b).available,false);
 b.charges--;b.realized++;A.equal(R.compare(a,b).available,false);
});
test('rejects nonreconciling basket even when each leg quote appears valid',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40);b.open+=10;b.net+=10;
 const r=R.compare(a,b);A.equal(r.available,false);A.match(r.reason,/reconcile/);
});
test('rejects duplicate or fabricated identifiers',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40);
 b.positionMarks[1].id='f';A.equal(R.compare(a,b).available,false);
});
test('invalid observation order and missing period safely withhold attribution',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40);
 A.equal(R.compare(b,a).available,false);
 A.equal(R.compare(null,b).available,false);
});
test('spot sources cannot be treated as proved cause of individual contract move',()=>{
 const r=R.compare(make(t0,q0,5000,50),make(t1,q1,5010,40));
 A.match(r.scope,/not realised P&L, fees or causation/);
});
test('input checkpoints are not modified by comparisons',()=>{
 const a=make(t0,q0,5000,50),b=make(t1,q1,5010,40),before=JSON.stringify([a,b]);
 R.compare(a,b);A.equal(JSON.stringify([a,b]),before);
});
