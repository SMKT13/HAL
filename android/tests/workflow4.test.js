'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js'),I=require('../app/src/main/assets/insights4.js'),W=require('../app/src/main/assets/workflow4.js');
const NOW=Date.parse('2026-11-02T06:30:00Z'),STAMP=new Date(NOW-1000).toISOString();
const future={id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4900,manual:null,instrumentKey:'F'};
const put={id:'p',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:40,manual:null,instrumentKey:'P'};
const book=()=>({...E.emptyBook(),legs:[{...future},{...put}]});
const quote=price=>({price,quoteAt:STAMP,tradeAt:STAMP,retrievedAt:STAMP,greeksAt:STAMP,iv:30,delta:-.3,theta:-.2,thetaPerDayVerified:true});
const market=()=>({spot:quote(4950),contracts:[{...future},{...put}],quotes:{F:quote(5000),P:quote(50)}});
const input=()=>{const b=book(),m=market();return {book:b,market:m,risk:E.risk(b,m,NOW),valuation:E.ledger(b,m,{now:NOW})};};
const near=(a,b)=>A.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);

test('combined strategy describes quantity and earliest protection loss without promising a floor',()=>{
 const s=W.strategy(book(),market(),NOW);A.equal(s.risk.coveredUnits,150);A.equal(s.nextPutExpiry,'2026-11-23');
 A.equal(s.afterProtection.uncoveredUnits,300);A.equal(s.valuation.openPutPremium,6000);A.match(s.caveat,/not a guaranteed/);
});
test('puts remaining after all futures are reduced are identified as separate exposure',()=>{
 const b=book();b.legs=[b.legs[1]];A.match(W.strategy(b,market(),NOW).explanation,/without active futures/);
});
test('automatic reviews require every fresh, non-manual contract mark',()=>{
 A.equal(W.canCaptureReview(input(),NOW),true);
 for(const change of [x=>x.valuation.complete=false,x=>x.valuation.manual=true,x=>x.valuation.stale=true,
  x=>x.market.failure='network_unavailable',x=>x.valuation.rows.pop(),x=>x.market.spot.tradeAt=null,
  x=>x.market.spot.quoteAt=new Date(NOW+60000).toISOString(),x=>x.valuation.rows[0].mark.quote.tradeAt=null,
  x=>x.valuation.rows[0].mark.quote.quoteAt=new Date(NOW-300000).toISOString()]){
  const x=input();change(x);A.equal(W.canCaptureReview(x,NOW),false);
 }
});
test('cached and expired observations cannot establish a new automatic review',()=>{
 const x=input();x.market.spot.source='CACHE';A.equal(W.canCaptureReview(x,NOW),false);
 A.equal(W.canCaptureReview(input(),NOW+300000),false);
});
test('review baseline selection ignores malformed and future records',()=>{
 const c=I.checkpoint(input(),NOW),old={...c,savedAt:new Date(NOW-10000).toISOString()};
 A.equal(W.latestReview([null,{},old,c,{...c,savedAt:new Date(NOW+1).toISOString()}],NOW),c);
 A.equal(W.latestReview([{...c,quoteAsOf:'broken'},{...c,version:1}],NOW),null);
});
test('a changed book never produces a like-for-like automatic P&L change',()=>{
 const x=input(),a=I.checkpoint(x,NOW);x.book.legs[0].lots=1;
 A.equal(I.changes(a,I.checkpoint(x,NOW+1000)).open,null);
});
test('reduction comparison counts removed futures exposure and execution costs once',()=>{
 const b=book(),m=market(),before=JSON.stringify({b,m});
 const r=W.compareReduction(b,m,{spot:4455,fallbackIV:30},'f',1,100,NOW);
 A.equal(r.complete,true);near(r.difference,74150);A.equal(r.removedUnits,150);
 A.equal(r.alternative.putUnits,150);A.equal(r.alternative.futureUnits,150);
 A.equal(JSON.stringify({b,m}),before);
});
test('comparison is unchanged by historic entries, realised profits and old fees',()=>{
 const a=W.compareReduction(book(),market(),{spot:4455,fallbackIV:30},'f',1,100,NOW),b=book();
 b.legs[0].entry=4200;b.legs[1].entry=99;b.journal=[{id:'fee',kind:'fee',date:'2026-11-01',amount:25000}];
 b.legacy={realized:80000,costs:350,journal:[]};
 const r=W.compareReduction(b,market(),{spot:4455,fallbackIV:30},'f',1,100,NOW);
 near(r.current.additional,a.current.additional);near(r.alternative.additional,a.alternative.additional);
});
test('flat futures-only scenario has zero further P&L and deducts estimated reduction cost',()=>{
 const b=book();b.legs=[b.legs[0]];
 const r=W.compareReduction(b,market(),{spot:4950},'f',2,125,NOW);
 near(r.current.additional,0);near(r.alternative.additional,-125);near(r.difference,-125);
});
test('mixed-expiry comparisons reject a later common horizon',()=>{
 const r=W.compareReduction(book(),market(),{spot:4500,horizon:'2026-12-29',fallbackIV:30},'f',1,0,NOW);
 A.equal(r.complete,false);A.equal(r.difference,null);A.match(r.current.errors.join(' '),/Horizon exceeds/);
});
test('missing current marks cannot produce a comparison even with a theoretical scenario',()=>{
 const m=market();delete m.quotes.P;
 const r=W.compareReduction(book(),m,{spot:4500,fallbackIV:30,basis:'carry'},'f',1,0,NOW);
 A.equal(r.complete,false);A.equal(r.difference,null);A.equal(r.current.additional,null);
});
test('invalid reduction size, contract or costs do not mutate the book',()=>{
 const b=book(),before=JSON.stringify(b);
 for(const [id,lots,cost]of [['p',1,0],['missing',1,0],['f',3,0],['f',.5,0],['f',0,0],['f',1,-1],['f',1,null]])
  A.throws(()=>W.compareReduction(b,market(),{spot:4500},id,lots,cost,NOW));
 A.equal(JSON.stringify(b),before);
});
test('business review groups sourced evidence without inventing events or facts',()=>{
 const notes=[{id:'a',title:'Engine delivery milestone',category:'Deliveries',date:'2026-11-01',eventDate:'2026-11-10',url:'https://example.org/source',text:'User interpretation'},
 {id:'b',title:'Old result',eventDate:'2026-10-01'},{id:'c',title:'No known date',eventDate:'invalid'}];
 const r=W.businessReview(notes,[{title:'HAL order update',url:'https://example.org/news',source:'Fixture'}],NOW);
 A.equal(r.events.length,1);A.equal(r.events[0].id,'a');A.equal(r.drivers[0].articles.length,1);
 A.equal(r.drivers[1].notes.length,1);A.equal(r.drivers[3].notes.length,0);
});
test('next action distinguishes missing prices, failed refresh and an empty book',()=>{
 const x=input();A.equal(W.priority(x,true,NOW).action,'go-risk');
 x.valuation.complete=false;A.equal(W.priority(x,true,NOW).action,'review-contracts');
 x.market.failure='network_unavailable';A.equal(W.priority(x,true,NOW).action,'retry-prices');
 x.book.legs=[];A.equal(W.priority(x,false,NOW).action,'add');
});
