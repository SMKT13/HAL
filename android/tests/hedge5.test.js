'use strict';
const test=require('node:test'),A=require('node:assert/strict'),H=require('../app/src/main/assets/hedge5.js');
const base=()=>({
 book:{legs:[
  {type:'FUT',lots:2,lotSize:150,expiry:'2026-12-29'},
  {type:'PE',lots:1,lotSize:150,strike:4500,expiry:'2026-11-23'}
 ]},
 result:{
  current:[{horizon:'2026-11-20T10:00:00.000Z',shock:-.05,additionalPnl:-28000}],
  currentErrors:[{horizon:'2026-12-01T10:00:00.000Z',shock:-.05,reason:'Earlier November option settlement unavailable'}],
  candidates:[{contract:{instrumentKey:'DEC4500',expiry:'2026-12-29',strike:4500,lotSize:150},
  lots:2,units:300,newPremium:30000,buyFees:100,grossCost:30100,
  exitFees:80,saleProceeds:5000,netCashRequired:25180,existingExitSlippage:25,
  worstLoss:22000,ivSource:'user-assumed',
  scenarios:[{horizon:'2026-11-20T10:00:00.000Z',shock:-.05,additionalPnl:-20000,spot:4500},
    {horizon:'2026-12-01T10:00:00.000Z',shock:-.05,additionalPnl:-22000,spot:4500}]}]
 }});
const run=x=>H.auditHedge(x.book,x.result,'DEC4500','2026-12-29');
test('cash requirement reconciles without treating old proceeds as profit',()=>{
 const x=run(base());A.equal(x.accounting.netCashRequired,25180);
 A.equal(x.accounting.oldPutSaleProceeds,5000);
 A.equal(x.accounting.grossPurchase,30100);
});
test('one valid current scenario and one earlier-expiry-unavailable scenario',()=>{
 const x=run(base());A.equal(x.comparable,1);A.equal(x.unavailable,1);
 A.equal(x.comparisons[0].replacementMinusExisting,8000);
 A.equal(x.comparisons[1].replacementMinusExisting,null);
 A.match(x.comparisons[1].reason,/November/);
});
test('candidate before futures expiry is flagged, not assumed protected',()=>{
 const x=base();x.result.candidates[0].contract.expiry='2026-12-15';
 const r=H.auditHedge(x.book,x.result,'DEC4500','2026-12-15');
 A.equal(r.coverageGapAfter,'2026-12-15');
});
test('candidate after futures expiry is identified as potential remaining long put',()=>{
 const x=base();x.result.candidates[0].contract.expiry='2027-01-28';
 const r=H.auditHedge(x.book,x.result,'DEC4500','2026-12-29');
 A.equal(r.putContinuesAfterFutures,true);
});
test('cannot accept unlisted candidate or insufficient whole lots',()=>{
 const x=base();A.throws(()=>H.auditHedge(x.book,x.result,'FAKE','2026-12-29'),/not eligible/);
 x.result.candidates[0].lots=1;A.throws(()=>run(x),/fully cover/);
});
test('cash-releasing rollover keeps signed negative net requirement',()=>{
 const x=base(),c=x.result.candidates[0];
 c.saleProceeds=35000;c.netCashRequired=c.grossCost+c.exitFees-c.saleProceeds;
 const v=run(x);A.equal(v.accounting.netCashRequired,-4820);
});
test('reject net cash accounting mismatch',()=>{
 const x=base();x.result.candidates[0].netCashRequired++;
 A.throws(()=>run(x),/Inconsistent/);
});
test('reject incorrect sampled worst-loss metric',()=>{
 const x=base();x.result.candidates[0].worstLoss=2000;
 A.throws(()=>run(x),/worst-loss/);
});
test('does not alter recorded positions or source comparisons',()=>{
 const x=base(),before=JSON.stringify(x);run(x);A.equal(JSON.stringify(x),before);
});
test('reject missing input and negative accounting fields',()=>{
 const x=base();x.result.candidates[0].saleProceeds=null;A.throws(()=>run(x),/Missing or negative/);
});

test('one-lot roll prices only the selected bid, keeps the other put, and withholds stale comparisons',()=>{
 const E=require('../app/src/main/assets/engine4.js'),now=Date.parse('2026-11-17T05:00:00Z'),at=new Date(now).toISOString();
 const old={type:'PE',expiry:'2026-11-23',strike:4500,lotSize:150,lots:1,entry:35,id:'a',instrumentKey:'a'};
 const other={...old,strike:4400,id:'b',instrumentKey:'b'};
 const next={...old,expiry:'2026-12-29',id:'c',instrumentKey:'c'};
 const future={...old,id:'f',type:'FUT',expiry:next.expiry,instrumentKey:'f',strike:null,entry:4900,lots:2};
 const b={...E.emptyBook(),legs:[future,old,other]},before=JSON.stringify(b);
 const q=bid=>({bid,ask:bid+1,price:bid,bidQty:150,askQty:150,volume:400,oi:800,quoteAt:at,tradeAt:at,retrievedAt:at,source:'REST'});
 const m=E.normalizeMarket({spot:q(4900),contracts:[old,other,next],quotes:{a:q(40),b:q(20),c:q(60)}});
 const p={slippage:0,buyFees:10,exitFees:5,fallbackIV:25};
 const run=(leg='a',settings=p)=>H.compareOneLot(b,m,leg,'c',settings,now);
 const r=run();A.equal(r.netCash,(61-40)*150+15);A.equal(run('b').netCash,(61-20)*150+15);
 A.equal(r.coverage[0].keep,0);A.equal(r.coverage[0].rolled,150);A.equal(r.coverage[0].futures,300);
 A.equal(r.scenarios.length,4);for(const s of r.scenarios)A.equal(s.difference,s.rollValue-s.keepValue-r.netCash);
 A.ok(run('a',{...p,fallbackIV:null}).scenarios.every(s=>s.error));
 m.quotes.c.askQty=149;A.throws(run,/depth/);m.quotes.c.askQty=150;
 m.quotes.c.tradeAt='2026-11-16T05:00:00Z';A.throws(run,/quote/);m.quotes.c.tradeAt=at;
 m.contracts.find(c=>c.instrumentKey==='c').lotSize=100;A.throws(run,/same units/);
 A.equal(JSON.stringify(b),before);
});
