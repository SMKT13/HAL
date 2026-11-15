'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js'),R=require('../app/src/main/assets/rollover5.js');
const now=Date.parse('2026-11-15T09:00:00Z'),at=new Date(now-15000).toISOString();
const leg={id:'f',type:'FUT',expiry:'2026-11-23',lots:2,lotSize:150,entry:4927.35,instrumentKey:'F1'};
const put={id:'p',type:'PE',expiry:'2026-11-23',strike:4500,lots:2,lotSize:150,entry:50,instrumentKey:'P1'};
const book=()=>({...E.emptyBook(),legs:[{...leg},{...put}]});
const quote=(p,bid,ask)=>({price:p,bid,ask,bidQty:300,askQty:300,quoteAt:at,tradeAt:at,retrievedAt:at,source:'REST'});
const market=()=>({spot:quote(4900,4899,4901),contracts:[
 {type:'FUT',instrumentKey:'F1',expiry:'2026-11-23',lotSize:150},
 {type:'FUT',instrumentKey:'F2',expiry:'2026-12-29',lotSize:150}],
 quotes:{F1:quote(5000,4999,5001),F2:quote(5030,5029,5031)}});
const params=()=>({legId:'f',targetInstrumentKey:'F2',exitFees:150,newFees:200,slippagePerUnit:1});
const near=(a,b)=>A.ok(Math.abs(a-b)<.001,a+' vs '+b);
test('quantity, bid-close, ask-open and fees are kept separate from actual booked history',()=>{
 const p=R.compare(book(),market(),params(),now);
 A.equal(p.units,300);A.equal(p.assumedClosePrice,4998);
 A.equal(p.assumedNewEntryPrice,5032);
 near(p.conditionalCloseGross,(4998-4927.35)*300);
 near(p.conditionalCloseNetBeforePriorFees,p.conditionalCloseGross-150);
 A.equal(p.totalAdditionalFees,350);
 A.equal(p.rollSpreadAcrossUnits,34*300);
 A.equal(p.newFuturesNotionalReference,5032*300);
 A.equal(p.brokerFundingRequired,null);
});
test('earlier-expiring put cannot be relabeled as December protection',()=>{
 const p=R.compare(book(),market(),params(),now);
 A.equal(p.putUnitsHeldThroughNewExpiry,0);
 A.equal(p.minimumUncoveredNewUnits,300);
 A.match(p.warnings.join(' '),/300 of 300/);
});
test('unexpired, matched later puts appear only as quantity not guaranteed risk floor',()=>{
 const b=book();b.legs[1].expiry='2026-12-29';
 const p=R.compare(b,market(),params(),now);
 A.equal(p.putUnitsHeldThroughNewExpiry,300);
 A.equal(p.minimumUncoveredNewUnits,0);
});
test('same expiry or earlier expiry not a rollover',()=>{
 const m=market();A.throws(()=>R.compare(book(),m,{...params(),targetInstrumentKey:'F1'},now),/later/);
 A.throws(()=>R.compare(book(),m,{...params(),targetInstrumentKey:'missing'},now),/listed later/);
});
test('expired saved future cannot be silently rolled',()=>A.throws(()=>R.compare(book(),market(),params(),Date.parse('2026-11-24T09:00:00Z')),/Reconcile expired/));
test('wrong replacement lot size cannot pretend to cover the same unit count',()=>{
 const m=market();m.contracts[1].lotSize=125;
 A.throws(()=>R.compare(book(),m,params(),now),/lot size/);
});
test('unverified or cached provider observations cannot become a rollover fill',()=>{
 const m=market();m.quotes.F2.source='CACHE';A.throws(()=>R.compare(book(),m,params(),now),/Fresh REST/);
 const n=market();n.quotes.F2.quoteAt=null;A.throws(()=>R.compare(book(),n,params(),now),/Fresh REST/);
});
test('quote and depth constraints are refused or explicitly warned',()=>{
 const m=market();m.quotes.F1.bid=null;A.throws(()=>R.compare(book(),m,params(),now),/bid\/ask/);
 const n=market();n.quotes.F2.askQty=10;const p=R.compare(book(),n,params(),now);
 A.match(p.warnings.join(' '),/smaller than/);
});
test('negative fees or assumed slippage cannot create a fake fill',()=>{
 A.throws(()=>R.compare(book(),market(),{...params(),slippagePerUnit:-1},now),/non-negative/);
 A.throws(()=>R.compare(book(),market(),{...params(),exitFees:-5},now),/non-negative/);
 A.throws(()=>R.compare(book(),market(),{...params(),slippagePerUnit:6000},now),/exit price/);
});
test('conflicting contract specification fails even if manual saved mark exists',()=>{
 const m=market();m.contractConflicts=['F1'];
 A.throws(()=>R.compare(book(),m,params(),now),/Conflicting/);
});
test('rollover comparison cannot edit real saved positions or provider quotes',()=>{
 const b=book(),m=market(),prior=JSON.stringify([b,m]);
 R.compare(b,m,params(),now);
 A.equal(JSON.stringify([b,m]),prior);
});
test('no cash or automatic trade is implied by futures spread',()=>{
 const p=R.compare(book(),market(),params(),now);
 A.equal(p.actualMarginCash,null);A.equal(p.physicalSettlementCash,null);
 A.match(p.assumptions.join(' '),/NOT cash paid to roll/);
});
