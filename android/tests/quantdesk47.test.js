'use strict';
/* HAL Desk 4.7 regression gates. Synthetic prices, never real recommendations. */
const test=require('node:test'),A=require('node:assert/strict'),E=require('../app/src/main/assets/engine4.js'),Q=require('../app/src/main/assets/quantdesk47.js');
const NOW=Date.parse('2026-11-13T07:30:00Z');
const raw=(n=240,modifier=()=>0)=>Array.from({length:n},(_,i)=>{
  const c=4300+i*1.7+Math.sin(i/6)*8+modifier(i);
  return [new Date(NOW-(n+1-i)*E.DAY).toISOString(),c-2,c+12,c-12,c,1000+i];
});
const F={id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35,manual:null,instrumentKey:'F'};
const P={id:'p',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:38.9,manual:null,instrumentKey:'P'};
const book=(legs=[F,P])=>({...E.emptyBook(),legs});
const options={now:NOW,spot:4900,days:5,volPct:28,paths:300,seed:47,fallbackIV:25};
const approx=(a,b,e=1e-7)=>A.ok(Math.abs(a-b)<e,'expected '+a+' ≈ '+b);
test('market regime requires enough bars and never fabricates a signal',()=>{
 const s=Q.marketRegime(raw(20),{now:NOW});
 A.equal(s.ready,false);A.match(s.reason,/55/);
});
test('market regime classifies completed daily data and labels dated observations',()=>{
 const r=Q.marketRegime(raw(),{now:NOW});
 A.equal(r.ready,true);A.equal(r.trend,'Rising');A.ok(r.atr>0);A.ok(r.annualizedVolPct>0);A.ok(r.asOf);
});
test('backtest refuses short history rather than promising a profit',()=>{
 const r=Q.backtest(raw(40),{now:NOW,slow:50,fast:20});
 A.equal(r.ready,false);A.match(r.reason,/at least 52/);
});
test('backtest uses previous close to trade next day and charges both sides',()=>{
 const x=Q.backtest(raw(),{now:NOW,fast:10,slow:30,feeBps:10,slippageBps:10});
 const y=Q.backtest(raw(),{now:NOW,fast:10,slow:30,feeBps:0,slippageBps:0});
 A.ok(x.ready);A.ok(x.tradeCount>=1);A.ok(x.finalEquity<y.finalEquity);
 A.ok(x.fills[0].date>new Date(NOW-240*E.DAY).toISOString().slice(0,10));
});
test('backtest ignores incomplete future candle',()=>{
 const a=raw(),future=[new Date(NOW+E.DAY).toISOString(),999999,999999,999999,999999,1000];
 const x=Q.backtest(a,{now:NOW}),y=Q.backtest(a.concat([future]),{now:NOW});
 approx(x.finalEquity,y.finalEquity);A.deepEqual(x.fills,y.fills);
});
test('backtest validates parameter range',()=>{
 A.throws(()=>Q.backtest(raw(),{now:NOW,fast:50,slow:20}),/Invalid/);
 A.throws(()=>Q.backtest(raw(),{now:NOW,slippageBps:-1}),/Invalid/);
});
test('Monte Carlo samples are seeded and reproducible',()=>{
 const a=Q.monteCarlo(options),b=Q.monteCarlo(options);
 A.deepEqual(a.outcomes,b.outcomes);A.ok(a.stats.p10<a.stats.p50);A.ok(a.stats.p50<a.stats.p90);
});
test('zero-volatility Monte Carlo uses deterministic zero drift',()=>{
 const x=Q.monteCarlo({...options,volPct:0});
 approx(x.stats.min,options.spot);approx(x.stats.p90,options.spot);
});
test('Monte Carlo rejects nonfinite spot, invalid seed and huge computation',()=>{
 for(const p of [{spot:NaN},{spot:0},{seed:0},{paths:100000},{days:-1},{volPct:900}])
  A.throws(()=>Q.monteCarlo({...options,...p}),/Invalid|Seed/);
});
test('Monte Carlo percentile and below-spot frequency are bounded',()=>{
 const r=Q.monteCarlo(options);A.ok(r.probBelowSpot>=0&&r.probBelowSpot<=1);
 A.equal(r.stats.count,300);A.equal(r.outcomes.length,300);
});
test('portfolio simulations refuse settlement crossing earlier put expiration',()=>{
 const r=Q.portfolioForecast(book(),{}, {...options,days:20});
 A.equal(r.ready,false);A.match(r.reason,/earliest open expiry/);
});
test('portfolio simulations report hypothetical lifetime net, not trade execution',()=>{
 const r=Q.portfolioForecast(book(),{},options);
 A.equal(r.ready,true);A.ok(r.openPnL.p10<r.openPnL.p90);
 A.ok(Number.isFinite(r.lifetimeNet.p50));
 A.match(r.caveat,/Margins, delivery/);
});
test('portfolio simulation with no real positions refuses to hallucinate',()=>{
 const r=Q.portfolioForecast(book([]),{},options);
 A.equal(r.ready,false);A.match(r.reason,/No actual open legs/);
});
test('stress grid contains all shock rows, IV shifts and no fabricated crossing payout',()=>{
 const grid=Q.stressGrid(book(),{},options);
 A.equal(grid.rows.length,6);A.deepEqual(grid.rows[0].cells.map(x=>x.ivShift),[-5,0,5]);
 A.ok(grid.rows.every(x=>x.cells.length===3));
 const beyond=Q.stressGrid(book(),{}, {...options,days:20});
 A.ok(beyond.rows.every(x=>x.cells.every(c=>c.openPnL===null&&c.error)));
});
test('headline count deduplicates dated articles and excludes future articles',()=>{
 const a={title:'HAL signs defence contract',publishedAt:new Date(NOW-10000).toISOString(),official:true};
 const b={...a,title:'hal signs DEFENCE contract',official:false};
 const c={title:'HAL unknown tomorrow',publishedAt:new Date(NOW+3*E.DAY).toISOString()};
 const r=Q.headlineSignals([a,b,c],NOW);
 A.equal(r.count,1);A.equal(r.officialCount,1);A.equal(r.lastHour,1);
});
test('headline spike needs enough independent dated articles',()=>{
 const n=Array.from({length:5},(_,i)=>({title:'HAL item '+i,publishedAt:new Date(NOW-120000).toISOString()}));
 const r=Q.headlineSignals(n,NOW);A.equal(r.spike,true);
 A.equal(Q.headlineSignals(n.slice(0,3),NOW).spike,false);
});
test('six-perspective research is a dated evidence checklist rather than buy-sell AI',()=>{
 const r=Q.sixPerspectives({now:NOW,book:book(),valuation:{complete:false},risk:{futureUnits:300,putUnits:150,uncoveredUnits:150,warnings:[{title:'Expiry gap'}]},technical:{ready:false},news:[]});
 A.equal(r.perspectives.length,6);
 A.ok(r.perspectives.some(p=>p.desk==='Risk control'&&p.evidence.includes('Expiry gap')));
 A.match(r.kind,/no LLM forecast/);
});
test('all quant engines are read-only: input book is never mutated',()=>{
 const b=book(),before=JSON.stringify(b);
 Q.stressGrid(b,{},options);Q.portfolioForecast(b,{},options);
 A.equal(JSON.stringify(b),before);
});
