'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const B=require('../app/src/main/assets/backtest5.js');
const oneDay=86400000,first=Date.parse('2025-01-01T03:45:00Z');
function bars(prices){
 return prices.map((c,i)=>({t:first+i*oneDay,o:c,h:c+2,l:c-2,c,v:1000}));
}
const fallRiseFall=bars(Array.from({length:190},(_,i)=>i<60?200-i:i<110?140+(i-60)*2:240-(i-110)*2));
test('flat market has no false fills',()=>{
 const r=B.backtestSma(bars(Array(100).fill(100)),{fast:5,slow:20});
 A.equal(r.events.length,0);A.equal(r.metrics.netPerShare,0);
});
test('signals execute only at NEXT candle open',()=>{
 const r=B.backtestSma(fallRiseFall,{fast:5,slow:20});
 A.ok(r.events.length>=2);
 const all=new Map(fallRiseFall.map((bar,i)=>[bar.t,i]));
 for(const x of r.events)A.equal(all.get(x.fillAt),all.get(x.signalAt)+1);
});
test('a last-bar crossover cannot be filled retroactively',()=>{
 const prices=Array.from({length:70},(_,i)=>200-i);
 const a=bars(prices),b=bars([...prices.slice(0,-1),1000]);
 const p=B.backtestSma(a,{fast:5,slow:20}),q=B.backtestSma(b,{fast:5,slow:20});
 A.equal(p.events.length,0);A.equal(q.events.length,0);
});
test('fees and slippage reduce simulated per-share net',()=>{
 const a=B.backtestSma(fallRiseFall,{fast:5,slow:20}),b=B.backtestSma(fallRiseFall,{fast:5,slow:20,feeBps:20,slippageBps:10});
 A.ok(a.events.length>0);A.ok(a.metrics.netPerShare>b.metrics.netPerShare);
 A.ok(b.metrics.modeledFeesPerShare>0);
});
test('bad ordering and implausible OHLC refuse calculation',()=>{
 const x=bars(Array(80).fill(100));A.throws(()=>B.backtestSma([...x].reverse(),{fast:5,slow:20}),/unordered/);
 x[4].h=90;A.throws(()=>B.backtestSma(x,{fast:5,slow:20}),/Invalid/);
});
test('invalid moving-average windows, fees and short histories refused',()=>{
 const x=bars(Array(80).fill(100));
 A.throws(()=>B.backtestSma(x,{fast:20,slow:20}));
 A.throws(()=>B.backtestSma(x,{fast:5,slow:20,feeBps:-1}));
 A.throws(()=>B.backtestSma(x.slice(0,15),{fast:5,slow:20}));
});
test('unrealized mark distinguished from closed trades',()=>{
 const x=bars(Array.from({length:100},(_,i)=>i<60?200-i:140+(i-60)*3));
 const r=B.backtestSma(x,{fast:5,slow:20});
 A.ok(r.openPosition);
 A.equal(r.metrics.closedTrades,0);
 A.equal(r.metrics.realizedGrossPerShare,0);
 A.ok(r.metrics.unrealizedPerShare>0);
});
test('market regime labels trend and historical volatility only',()=>{
 const prices=Array.from({length:120},(_,i)=>100+i*0.5+Math.sin(i/3));
 const r=B.marketRegime(bars(prices));A.equal(r.ready,true);
 A.equal(r.trend,'Uptrend evidence');
 A.ok(r.volatility20AnnualPct>=0);
});
test('short regime history gives no directional conclusion',()=>{
 const r=B.marketRegime(bars(Array(50).fill(100)));
 A.equal(r.ready,false);A.match(r.reason,/62/);
});
