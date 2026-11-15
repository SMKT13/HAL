'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js'),P=require('../app/src/main/assets/portfolio5.js');
const now=Date.parse('2026-11-15T06:00:00Z');
const f=(manual=5000)=>({id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35,manual,manualAt:'2026-11-15T05:55:00Z'});
const put=(manual=20)=>({id:'p',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:38.9,manual,manualAt:'2026-11-15T05:55:00Z'});
const book=()=>({...E.emptyBook(),legs:[f(),put()]});
const valuation=b=>E.ledger(b,{}, {now});
const near=(x,y)=>A.ok(Math.abs(x-y)<.005,x+' != '+y);
test('per-leg P&L, lifetime and recovery reconcile in units, not lots',()=>{
 const b=book();const result=P.audit(b,valuation(b));
 A.equal(result.consistent,true);A.equal(result.complete,true);
 near(result.open,(5000-4927.35)*300+(20-38.9)*150);
 near(result.net,result.open);A.equal(result.rows[0].units,300);
 A.equal(result.markQuality,'manual');
});
test('recorded losses and costs define booked recovery requirement',()=>{
 const b=book();
 b.journal=[{id:'closed-oct',kind:'close',date:'2026-10-27',
 leg:{id:'oct',type:'PE',expiry:'2026-10-27',strike:4500,lots:1,lotSize:150,entry:57.4},
 exit:.3,fees:100},{id:'fee2',kind:'fee',date:'2026-10-27',amount:50}];
 const result=P.audit(b,valuation(b));
 near(result.realizedGross,-8565);near(result.recordedCharges,150);
 near(result.bookedRecoveryRequirement,8715);near(result.net,result.open-8715);
});
test('missing leg mark withholds basket and live shortfall but retains booked net',()=>{
 const b=book();b.legs[1].manual=null;
 const result=P.audit(b,valuation(b));
 A.equal(result.complete,false);A.equal(result.net,null);A.equal(result.indicativeShortfall,null);
 A.equal(result.bookedNet,0);A.deepEqual(result.unpricedLegs,['p']);
});
test('unreconciled expired option cannot become a zero-price position',()=>{
 const b=book();b.legs[1].expiry='2026-10-27';
 const result=P.audit(b,valuation(b));
 A.equal(result.net,null);A.deepEqual(result.expiredUnreconciled,['p']);
});
test('deliberately corrupted ledger P&L is detected and not shown',()=>{
 const b=book(),v=valuation(b);v.open+=1500;
 const result=P.audit(b,v);
 A.equal(result.consistent,false);A.equal(result.net,null);
 A.match(result.errors.join(' '),/Basket open/);
});
test('a wrong quantity or mark P&L cannot produce a consistent total',()=>{
 const b=book(),v=valuation(b);v.rows[0].units=150;
 const result=P.audit(b,v);A.equal(result.consistent,false);
 A.match(result.errors.join(' '),/quantity/);
});
test('cash funding and settlements never become realized P&L',()=>{
 const b=book();b.journal=[{id:'money',kind:'funding',date:'2026-11-10',amount:20000},
 {id:'mtm',kind:'settlement',date:'2026-11-11',amount:-2500}];
 const r=P.audit(b,valuation(b));
 A.equal(r.fundingCash,20000);A.equal(r.settlementCash,-2500);
 A.equal(r.realizedGross,0);
});
test('partial future close counts closed quantity and leaves original open units',()=>{
 const initial=book();
 const b=E.closeLeg(initial,'f',1,5100,20,'2026-11-14',{now,id:'partial'});
 const result=P.audit(b,valuation(b));
 A.equal(result.consistent,true);A.equal(result.completedLots,1);
 A.equal(result.rows.find(x=>x.id==='f').units,150);
 near(result.realizedGross,(5100-4927.35)*150);
 A.equal(initial.legs[0].lots,2);
});
test('no open book has zero net, not fabricated open positions',()=>{
 const b=E.emptyBook(),r=P.audit(b,valuation(b));
 A.equal(r.complete,true);A.equal(r.net,0);
 A.equal(r.rows.length,0);
});
