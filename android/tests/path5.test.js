'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const R=require('../app/src/main/assets/risk5.js');
const P=require('../app/src/main/assets/path5.js');
const F={type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35};
const A1={type:'PE',expiry:'2026-11-23',lots:1,lotSize:150,strike:4500,entry:38.9};
const A2={type:'PE',expiry:'2026-11-23',lots:1,lotSize:150,strike:4400,entry:24.1};
const opts=()=>({spotAtExpiry:{'2026-11-23':4300},futureAtExpiry:{'2026-12-29':5000},charges:100});
const near=(a,b)=>A.ok(Math.abs(a-b)<.01,a+' vs '+b);
test('dated P&L matches the original separately-priced expiry scenario',()=>{
 const result=P.path([F,A1,A2],opts(),'2026-11-15');
 const source=R.settlementScenario([F,A1,A2],opts());
 A.equal(result.complete,true);
 A.equal(result.events.length,2);
 near(result.totalNetEconomicPnl,source.total);
 near(result.totalGrossEconomicPnl,source.total+100);
 A.equal(result.assumedAdditionalCosts,100);
});
test('earlier November put P&L is not borrowed from December futures settlement',()=>{
 const r=P.path([F,A1,A2],opts(),'2026-11-15');
 const early=r.events[0],late=r.events[1];
 A.equal(early.expiry,'2026-11-23');A.equal(late.expiry,'2026-12-29');
 near(early.grossPutPnl,(200-38.9)*150+(100-24.1)*150);
 A.equal(early.remainingFutureUnits,300);
 A.equal(early.uncoveredFutureUnitsAfter,300);
 near(late.grossFuturePnl,(5000-4927.35)*300);
});
test('option exercise value and premium outlay are not reported as usable settlement cash',()=>{
 const e=P.path([F,A1,A2],opts(),'2026-11-15').events[0];
 A.equal(e.putIntrinsicEconomicValue,45000);
 near(e.putEntryPremiumPreviouslyPaid,9450);
 const all=P.path([F,A1,A2],opts(),'2026-11-15');
 A.equal(all.brokerCashRequirement,null);
 A.equal(all.physicalDeliveryUnits,null);
 A.equal(all.variationMarginPath,null);
 A.equal(all.contractCashObligationsAvailable,false);
});
test('missing earlier expiry spot never becomes a zero payout or cumulative figure',()=>{
 const p=opts();delete p.spotAtExpiry['2026-11-23'];
 const r=P.path([F,A1,A2],p,'2026-11-15');
 A.equal(r.complete,false);A.equal(r.totalNetEconomicPnl,null);
 A.equal(r.events[0].economicPnl,null);
 A.equal(r.events[0].putIntrinsicEconomicValue,null);
 A.equal(r.events[1].cumulativeGrossEconomicPnl,null);
});
test('missing later futures settlement prevents total but preserves known earlier date',()=>{
 const p=opts();delete p.futureAtExpiry['2026-12-29'];
 const r=P.path([F,A1,A2],p,'2026-11-15');
 A.equal(r.complete,false);A.equal(r.events[0].available,true);
 A.equal(r.events[1].available,false);
 A.equal(r.totalNetEconomicPnl,null);
});
test('same-expiry contracts do not create an invented earlier protection gap',()=>{
 const p={spotAtExpiry:{'2026-12-29':4000},futureAtExpiry:{'2026-12-29':4200},charges:0};
 const r=P.path([F,{...A1,expiry:'2026-12-29'},{...A2,expiry:'2026-12-29'}],p,'2026-11-15');
 A.equal(r.gapDates.length,0);A.equal(r.events.length,1);
});
test('expired, unsupported short/call contracts are refused in real-book path',()=>{
 A.throws(()=>P.path([A1],opts(),'2026-11-24'),/Reconcile/);
 A.throws(()=>P.path([{...A1,side:'short'}],opts(),'2026-11-15'),/long futures/);
 A.throws(()=>P.path([{...A1,type:'CE'}],opts(),'2026-11-15'),/actual HAL position/);
});
test('invalid dates, invalid charges and missing legs are rejected',()=>{
 A.throws(()=>P.path([F],opts(),'2026-02-30'),/valid as-of date/);
 A.throws(()=>P.path([],opts(),'2026-11-15'),/one open/);
 A.throws(()=>P.path([F],{...opts(),charges:-1},'2026-11-15'),/charges/);
});
test('source input remains unchanged after scenario analysis',()=>{
 const legs=[F,A1,A2],inputs=opts(),before=JSON.stringify([legs,inputs]);
 P.path(legs,inputs,'2026-11-15');
 A.equal(JSON.stringify([legs,inputs]),before);
});
