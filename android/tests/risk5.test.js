'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const R=require('../app/src/main/assets/risk5.js');
const near=(x,y)=>A.ok(Math.abs(x-y)<1e-6, x+' vs '+y);
const F={type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35};
const P={type:'PE',expiry:'2026-11-23',lots:1,lotSize:150,strike:4500,entry:38.9};
const P2={...P,strike:4400,entry:24.1};
test('strict expiry date validation',()=>{A.equal(R.validDate('2026-11-23'),true);A.equal(R.validDate('2026-02-30'),false);A.equal(R.validDate('2026-11-2x'),false);});
test('Android real book lots converted to units',()=>A.equal(R.validateLeg(F).quantity,300));
test('mismatch between explicit quantity and lots rejected',()=>A.throws(()=>R.validateLeg({...F,quantity:150}),/mismatch/));
test('single-expiry futures hypothetical settlement',()=>near(R.expiryPayoff([F],5000,'2026-12-29'),21795));
test('mixed expiry single-price calculation refused',()=>A.throws(()=>R.expiryPayoff([F,P],4500,'2026-12-29'),/mixed expiry/));
test('coverage with both puts before expiry',()=>A.deepEqual(R.protectionCoverage([F,P,P2],'2026-11-23'),{futures:300,puts:300,covered:300,uncovered:0,ratio:1}));
test('November puts cannot cover December futures',()=>A.deepEqual(R.protectionCoverage([F,P,P2],'2026-11-24'),{futures:300,puts:0,covered:0,uncovered:300,ratio:0}));
test('timeline discloses gap after first option expiry',()=>{const t=R.protectionTimeline([F,P,P2],'2026-11-15');A.equal(t[0].uncovered,0);A.equal(t[1].onDate,'2026-11-24');A.equal(t[1].uncovered,300);});
test('separate option and futures settlement scenario',()=>{
 const r=R.settlementScenario([F,P,P2],{spotAtExpiry:{'2026-11-23':4300},futureAtExpiry:{'2026-12-29':5000},charges:100});
 A.equal(r.complete,true);near(r.total,57245);A.equal(r.rows.length,3);
});
test('missing early option settlement refuses basket total',()=>{
 const r=R.settlementScenario([F,P],{futureAtExpiry:{'2026-12-29':5000}});
 A.equal(r.complete,false);A.equal(r.total,null);A.match(r.errors[0],/2026-11-23/);
});
test('missing futures settlement refuses basket total',()=>{
 const r=R.settlementScenario([F,P],{spotAtExpiry:{'2026-11-23':4200}});
 A.equal(r.complete,false);A.equal(r.total,null);
});
test('negative option settlement and negative charges rejected',()=>{
 A.equal(R.settlementScenario([P],{spotAtExpiry:{'2026-11-23':-1}}).complete,false);
 A.throws(()=>R.settlementScenario([P],{charges:-1}),/charges/);
});
test('incremental risk uses current marks, not entries',()=>near(R.incrementalRisk({currentMarks:[100,25],scenarioMarks:[90,40],quantities:[300,150],sides:['long','long']}),-750));
test('explicit zero mark is valid',()=>near(R.incrementalRisk({currentMarks:[0],scenarioMarks:[5],quantities:[150],sides:['long']}),750));
test('missing mark cannot become zero',()=>A.throws(()=>R.incrementalRisk({currentMarks:[null],scenarioMarks:[5],quantities:[150],sides:['long']}),/mark/));
test('lifetime scenario includes booked realized and costs once',()=>{
 const hypothetical=R.settlementScenario([F,P,P2],{spotAtExpiry:{'2026-11-23':4300},futureAtExpiry:{'2026-12-29':5000},charges:100});
 near(R.lifetimeNet(hypothetical,-15000,34720.5),7524.5);
 A.equal(R.lifetimeNet({complete:false,total:null},-15000,34720.5),null);
 A.equal(R.lifetimeNet(hypothetical,null,34720.5),null);
});
test('dates before valuation date rejected',()=>A.throws(()=>R.protectionCoverage([F], '2026-11-14','2026-11-15'),/before/));
