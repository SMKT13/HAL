'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js');
const H=require('../app/src/main/assets/history5.js');
const R=require('../app/src/main/assets/reconcile5.js');
const NOW=Date.parse('2026-11-15T06:00:00Z');
const book=()=>({...E.emptyBook(),legs:[
 {id:'dec',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35},
 {id:'nov',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:38.9}
]});
const d=(x={})=>({confirmed:true,source:'Broker contract note',legId:'dec',
 lots:1,exitPrice:5100,fees:125,closeDate:'2026-11-14',...x});
const nearly=(x,y)=>A.ok(Math.abs(x-y)<0.011,x+' != '+y);
test('partial future close shows gross, charges and remaining unit quantity without saving',()=>{
 const b=book(),snapshot=JSON.stringify(b);
 const r=R.preview(b,d(),NOW);
 A.equal(r.previewOnly,true);A.equal(r.remainingLots,1);
 A.equal(r.units,150);nearly(r.recordedGrossChange,(5100-4927.35)*150);
 A.equal(r.recordedChargeChange,125);nearly(r.recordedNetChange,r.recordedGrossChange-125);
 A.equal(JSON.stringify(b),snapshot);A.equal(b.journal.length,0);
});
test('zero-premium completed put close is valid, not an unavailable mark',()=>{
 const r=R.preview(book(),d({legId:'nov',lots:1,exitPrice:0,fees:0}),NOW);
 A.equal(r.remainingLots,0);nearly(r.recordedGrossChange,-38.9*150);
});
test('zero futures settlement price is rejected',()=>A.throws(()=>
 R.preview(book(),d({exitPrice:0}),NOW),/positive/));
test('missing explicit broker confirmation or source does not create P&L',()=>{
 A.throws(()=>R.preview(book(),d({confirmed:false}),NOW),/broker/);
 A.throws(()=>R.preview(book(),d({source:''}),NOW),/broker record/);
});
test('missing, excess or fractional lots are rejected',()=>{
 for(const lots of [0,1.5,3,null])A.throws(()=>R.preview(book(),d({lots}),NOW),/whole-lot/);
});
test('future-dated and invalid transaction dates are rejected',()=>{
 A.throws(()=>R.preview(book(),d({closeDate:'2026-11-16'}),NOW),/today/);
 A.throws(()=>R.preview(book(),d({closeDate:'2026-02-30'}),NOW),/completed/);
});
test('a confirmed cumulative charge statement avoids double-counting older fees',()=>{
 const initial=book(),b=H.setCharges(initial,{amount:34720.5,
  asOf:'2026-11-14',source:'Broker cumulative statement'},true);
 const r=R.preview(b,d({fees:125}),NOW);
 A.equal(r.chargesCoveredByConfirmedCumulativeStatement,true);
 A.equal(r.recordedChargeChange,0);
 nearly(r.previewBookedNet,r.priorBookedNet+r.recordedGrossChange);
 A.equal(b.history.charges.amount,34720.5);
});
test('later confirmed close fees add once after cumulative fee statement',()=>{
 const initial=book(),b=H.setCharges(initial,{amount:34720.5,
  asOf:'2026-11-12',source:'Broker cumulative statement'},true);
 const r=R.preview(b,d({fees:125}),NOW);
 A.equal(r.chargesCoveredByConfirmedCumulativeStatement,false);
 A.equal(r.recordedChargeChange,125);
});
test('an expired recorded put remains eligible for preview only after broker confirmation',()=>{
 const b=book();b.legs[1].expiry='2026-10-27';
 const r=R.preview(b,d({legId:'nov',lots:1,exitPrice:.3}),NOW);
 A.equal(r.expiry,'2026-10-27');
 A.equal(b.legs.length,2);
});
test('existing journal close identifiers cannot be overwritten by preview',()=>{
 const b=book();b.journal.push({id:'v5-readonly-preview-0',kind:'fee',date:'2026-11-14',amount:0});
 const r=R.preview(b,d(),NOW);A.equal(r.previewOnly,true);
 A.equal(b.journal.length,1);
});
