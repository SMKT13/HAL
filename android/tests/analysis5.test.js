'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../app/src/main/assets/analysis5.js');
const now=Date.parse('2026-11-19T19:20:00+05:30');
const rows=Array.from({length:60},(_,i)=>({c:4760+(i===58?-85:i===59?0:(i-60)*2),o:4700,h:4800,l:4650,v:i===59?600:1000}));
const technical={ready:true,stale:false,rows,asOf:'2026-11-19T15:30:00+05:30',fetchedAt:'2026-11-19T16:05:00+05:30',sma20:4863.5,sma50:4828.1,rsi:44.3,hist:-28.6,macd:-20.8,support:4600,resistance:5119,r1:4787,s1:4707};
const call=(x={})=>A.build({technical,...x},now);
test('No completed candle never becomes an invented price or buy verdict',()=>{
 const r=A.build({},now);
 assert.equal(r.ready,false);assert.equal(r.price,null);assert.equal(r.verdict,'Insufficient evidence');
});
test('Daily rebound below both averages is recovery, not a confirmed breakout',()=>{
 const r=call();
 assert.equal(r.ready,true);assert.match(r.title,/Recovery attempt/);assert.equal(r.verdict,'Cautious \/ neutral');
 assert.equal(r.price,4760);assert.equal(r.change,85);assert.equal(r.volumeRatio,0.6);
 assert.ok(r.levels.resistances[0].price>r.price);assert.ok(r.levels.supports[0].price<r.price);
});
test('Histograms and averages are evidence, not fabricated trade orders',()=>{
 const r=call();
 assert.ok(r.scenarios.some(x=>x.kind==='bullish'&&/Sustained/.test(x.trigger)));
 assert.ok(r.scenarios.some(x=>x.kind==='bearish'));
 assert.ok(r.signals.some(x=>x.label==='RSI (14)'&&x.value===44.3));
 assert.ok(r.caveats.some(x=>/not a prediction/.test(x)));
});
test('Insufficient 50-bar history withholds directional conclusion',()=>{
 const r=call({technical:{...technical,rows:rows.slice(-12),ready:false}});
 assert.equal(r.ready,false);assert.equal(r.verdict,'Insufficient evidence');
});
test('Cached or stale daily candles are labelled and not called live',()=>{
 const r=call({cached:true});
 assert.equal(r.quality,'Historical / cached evidence');assert.ok(r.caveats.some(x=>/cached/.test(x)));
 const v=call({integrityBlocked:true});assert.equal(v.quality,'Source integrity review');
});
test('Guard future-dated technical data',()=>{
 const r=call({technical:{...technical,asOf:'2026-11-20T15:30:00+05:30'}});
 assert.equal(r.ready,false);assert.equal(r.price,null);
});
test('Hedge expiry gap uses actual saved leg expiries and nominal quantities',()=>{
 const book={legs:[
  {type:'FUT',lots:2,lotSize:150,expiry:'2026-12-29',entry:4927.35},
  {type:'PE',lots:1,lotSize:150,expiry:'2026-11-23',strike:4500},
  {type:'PE',lots:1,lotSize:150,expiry:'2026-11-23',strike:4400}
 ]};
 const r=call({book,confirmed:true});
 assert.equal(r.position.futureUnits,300);assert.equal(r.position.putUnits,300);
 assert.equal(r.position.coverage,100);assert.equal(r.position.gap,true);
 assert.equal(r.position.uncoveredUnitsAfter,300);
 assert.ok(r.position.messages.some(x=>/out of the money by ₹260/.test(x)));
 assert.ok(r.position.messages.some(x=>/Hedge continuity warning/.test(x)));
 assert.equal(r.position.openPnl,null);
});
test('Expiry-matched protection does not manufacture a later hedge gap',()=>{
 const book={legs:[{type:'FUT',lots:1,lotSize:150,expiry:'2026-12-29'},
 {type:'PE',lots:1,lotSize:150,expiry:'2026-12-29',strike:4500}]};
 assert.equal(call({book,confirmed:true}).position.gap,false);
});
test('Real-money P&L is withheld unless exact current marks and book are valid',()=>{
 const book={legs:[{type:'FUT',lots:1,lotSize:150,expiry:'2026-12-29'}]},valuation={complete:true,stale:false,manual:false,open:-5000};
 assert.equal(call({book,valuation,confirmed:false}).position.openPnl,null);
 assert.equal(call({book,valuation,confirmed:true,cached:true}).position.openPnl,null);
 assert.equal(call({book,valuation:{...valuation,manual:true},confirmed:true}).position.openPnl,null);
 assert.equal(call({book,valuation,confirmed:true}).position.openPnl,-5000);
});
test('Headline interpretation is conditional and never establishes order causation',()=>{
 const r=call({news:[{title:'Defence ministry proposes larger procurement allocation',publishedAt:'2026-11-19T13:00:00+05:30',source:'Source A'},{title:'Future unverified results',publishedAt:'2026-11-20T13:00:00+05:30'}]});
 assert.equal(r.headlines.length,1);assert.match(r.headlines[0].interpretation,/verify/);
});

test('Fundamental report uses only actual provider fields and does not manufacture growth',()=>{
 const f=A.fundamentalReview({metrics:[
  {kind:'provider',label:'income / revenue',value:7613,unit:'INR crore',period:'Q2 FY27',source:'Upstox',retrievedAt:'2026-11-19T12:00:00Z'},
  {kind:'note',label:'net profit',value:999999}
 ]});
 assert.equal(f.available,true);
 assert.equal(f.readings.length,1);
 assert.equal(f.readings[0].value,7613);
 assert.match(f.summary,/No YoY growth/);
 assert.ok(!f.readings.some(x=>x.value===999999));
});
test('Benchmark outperformance is withheld without matched quote timestamps',()=>{
 const unaligned=A.benchmarkReview({nifty:{price:25514,changePct:1.14,quoteAt:'2026-11-18T15:30:00+05:30'}},'2026-11-19',1.82);
 assert.equal(unaligned.relative,null);
 const aligned=A.benchmarkReview({nifty:{price:25514,changePct:1.14,quoteAt:'2026-11-19T15:30:00+05:30'}},'2026-11-19',1.82);
 assert.equal(aligned.relative,0.68);
});
test('Saved source timestamps cannot convert stale data to live evidence',()=>{
 const r=call({cached:true,market:{nifty:{price:25514,changePct:1.14,quoteAt:'2026-11-19T15:30:00+05:30'}}});
 assert.equal(r.quality,'Historical / cached evidence');
 assert.equal(r.benchmark.relative,0.68);
});
