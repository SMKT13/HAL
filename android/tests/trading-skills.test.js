'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {review}=require('../app/src/main/assets/trading-skills.js');
const book=()=>({
 legs:[
  {type:'FUT',expiry:'2026-12-29',lots:2,lotSize:100,entry:5000},
  {type:'PE',expiry:'2026-11-24',lots:1,lotSize:100,entry:50,strike:4500}],
 funding:{free:10000,margin:100000,at:'2026-10-21T05:00:00Z'},
 notes:[{text:'SECRET SHOULD NOT LEAVE PHONE'}]
});
const desk=()=>({
 confirmed:true,dataMode:'current',fundingCurrent:true,
 profile:{maxLoss:15000,reserve:5000},
 risk:{nextExpiry:'2026-11-24'},events:[],asOf:'2026-10-21T05:00:00Z'
});
test('skills are an advisory checklist, not executable signals',()=>{
 const a=review(book(),desk());
 assert.equal(a.status,'REVIEW_REQUIRED');
 assert.equal(a.checks.find(x=>x.id==='hedge').status,'REVIEW');
 assert.match(a.checks.find(x=>x.id==='hedge').detail,/fewer than futures units/);
 assert.ok(!JSON.stringify(a).includes('SECRET'));
 assert.ok(!JSON.stringify(a).includes('GO'));
 assert.equal(a.futuresUnits,200);
 assert.equal(a.putUnits,100);
});
test('stale quotes, unconfirmed contracts and missing reserve withhold conclusions',()=>{
 const d=desk();d.confirmed=false;d.dataMode='saved';d.profile.reserve=null;d.fundingCurrent=false;
 const a=review(book(),d);
 for(const key of ['book','quotes','funding'])assert.equal(a.checks.find(x=>x.id===key).status,'REVIEW');
 assert.equal(a.status,'REVIEW_REQUIRED');
});
test('real limit breaches take priority over apparently valid inputs',()=>{
 const d=desk();d.events=[{id:'loss-breach'},{id:'cash-stress'}];
 const a=review(book(),d);
 assert.equal(a.status,'LIMIT_ALERT');
 assert.equal(a.checks.find(x=>x.id==='risk').status,'LIMIT');
 assert.equal(a.checks.find(x=>x.id==='funding').status,'LIMIT');
});
test('matching unit counts with earlier puts still highlight expiry gap',()=>{
 const b=book();b.legs[1].lots=2;
 const a=review(b,desk());
 assert.equal(a.checks.find(x=>x.id==='hedge').status,'REVIEW');
 assert.match(a.checks.find(x=>x.id==='hedge').detail,/expires before/);
});
test('no positions or contract units never produce a favourable pre-check',()=>{
 const a=review({legs:[]},desk());
 assert.equal(a.status,'REVIEW_REQUIRED');
 assert.equal(a.checks.find(x=>x.id==='book').status,'REVIEW');
 const b=book();b.legs[1].lotSize=null;
 const partial=review(b,desk());
 assert.equal(partial.futuresUnits,null);
 assert.equal(partial.checks.find(x=>x.id==='hedge').status,'REVIEW');
});
test('all structural checks noted still do not authorise a trade',()=>{
 const b=book();b.legs[0].expiry='2026-12-29';b.legs[1].expiry='2026-12-29';b.legs[1].lots=2;
 const d=desk();d.risk.nextExpiry='2026-12-29';
 const a=review(b,d);
 assert.equal(a.status,'STRUCTURAL_CHECKS_ONLY');
 assert.match(a.note,/never authorises a trade/);
});
