'use strict';
const test=require('node:test'),A=require('node:assert/strict'),Q=require('../app/src/main/assets/quant5.js');
test('zero-volatility zero-drift simulation is deterministic',()=>{
 const r=Q.simulateRisk({startSpot:1000,annualVolPct:0,days:30,iterations:100,seed:1},s=>s-1000);
 A.equal(r.spot.median,1000);A.equal(r.pnl.median,0);A.equal(r.pnl.fractionBelowZero,0);
});
test('seeded samples are repeatable',()=>{
 const p={startSpot:4500,annualVolPct:35,days:30,iterations:250,seed:876};
 A.deepEqual(Q.simulateRisk(p,s=>s-4500),Q.simulateRisk(p,s=>s-4500));
});
test('spot distribution is positive and spans shocks',()=>{
 const r=Q.simulateRisk({startSpot:4500,annualVolPct:40,days:45,iterations:250},s=>s-4500);
 A.ok(r.spot.p05<r.spot.median&&r.spot.median<r.spot.p95);
 A.ok(r.pnl.p05<0&&r.pnl.p95>0);
});
test('tail average does not exceed fifth percentile for negative distribution',()=>{
 const r=Q.simulateRisk({startSpot:4500,annualVolPct:40,days:60,iterations:500},s=>s-4600);
 A.ok(r.pnl.worstFivePctMean<=r.pnl.p05);
});
test('invalid callback values refuse all results',()=>A.throws(()=>
 Q.simulateRisk({startSpot:4500,annualVolPct:20,days:10,iterations:100},()=>null),/unavailable/));
test('no negative volatility or unsupported sample count',()=>{
 A.throws(()=>Q.simulateRisk({startSpot:4500,annualVolPct:-1,days:10,iterations:100},()=>0));
 A.throws(()=>Q.simulateRisk({startSpot:4500,annualVolPct:20,days:10,iterations:20000},()=>0));
});
