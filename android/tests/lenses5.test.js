'use strict';
const test=require('node:test'),A=require('node:assert/strict'),L=require('../app/src/main/assets/lenses5.js');
const NOW=Date.parse('2026-11-15T06:00:00Z'),recent=new Date(NOW-30000).toISOString();
function full(){return {technical:{ready:true,stale:false,asOf:recent,bias:'Mixed evidence'},
 market:{spot:{price:4700,quoteAt:recent,tradeAt:recent},
 nifty:{price:25000,quoteAt:recent},vix:{price:15,quoteAt:recent}},
 book:{legs:[{type:'FUT',expiry:'2026-12-29'}]},
 valuation:{complete:true},
 risk:{greeksComplete:true,warnings:[]},
 fundamentals:{metrics:[{label:'Revenue',value:1000,kind:'provider'}],profile:{retrievedAt:recent}},
 news:[{title:'HAL filing',url:'https://example.com/filing',publishedAt:recent}]};}
test('six evidence perspectives without proxying to an AI service',()=>{
 const r=L.build(full(),NOW,true);A.equal(r.lenses.length,6);A.equal(r.available,6);
 A.ok(r.lenses.every(x=>x.status==='available'&&x.check.length>5));
});
test('empty inputs produce no fabricated market or position facts',()=>{
 const r=L.build({},NOW);A.equal(r.lenses.length,6);A.equal(r.available,0);
 A.equal(r.lenses.find(x=>x.id==='risk').status,'unavailable');
});
test('missing trade clock blocks verified derivatives state',()=>{
 const x=full();delete x.market.spot.tradeAt;const r=L.build(x,NOW,true);
 A.equal(r.lenses.find(x=>x.id==='derivatives').status,'review');
});
test('no numeric sourced statement cannot claim fundamentals are available',()=>{
 const x=full();x.fundamentals.metrics=[{label:'Forward order book rumor',value:1000,kind:'user'}];
 A.equal(L.build(x,NOW,true).lenses.find(x=>x.id==='fundamentals').status,'unavailable');
});
test('undated or unsafe links are not counted as recent verified news',()=>{
 const x=full();x.news=[{title:'Claim',url:'javascript:alert(1)',publishedAt:recent},
 {title:'Undated',url:'https://example.com/',publishedAt:'invalid'}];
 A.equal(L.build(x,NOW,true).lenses.find(x=>x.id==='news').status,'review');
});
test('unconfirmed book retains review status',()=>{
 const x=full(),r=L.build(x,NOW,false);
 A.equal(r.lenses.find(x=>x.id==='risk').status,'review');
});
test('stale quotes and stale indexes are identified',()=>{
 const x=full(),old=new Date(NOW-3600000).toISOString();
 x.market.spot.quoteAt=old;x.market.vix.quoteAt=old;
 const r=L.build(x,NOW,true);
 A.equal(r.lenses.find(x=>x.id==='derivatives').status,'review');
 A.equal(r.lenses.find(x=>x.id==='market').status,'review');
});
test('source review is deterministic and never modifies input',()=>{
 const x=full(),before=JSON.stringify(x);
 A.deepEqual(L.build(x,NOW,true),L.build(x,NOW,true));A.equal(JSON.stringify(x),before);
});
