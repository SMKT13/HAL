/* HAL Desk 4.7 quant and evidence engine — independently implemented.
 * Pure calculations. No transport, execution, credentials or book writes.
 * Do not interpret model outputs as executable quotes or guarantees. */
(function(root) {
'use strict';
const E = typeof module === 'object' && module.exports ? require('./engine4.js') : root.HAL4Engine;
const ok = x => typeof x === 'number' && Number.isFinite(x);
const err = m => { throw new Error(m); };
const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const percentile = (sorted,p) => { const pos=(sorted.length-1)*p, lo=Math.floor(pos), f=pos-lo; return sorted[lo]*(1-f)+sorted[Math.min(lo+1,sorted.length-1)]*f; };
function bars(raw,now=Date.now()) {
 if (!ok(now)) err('Invalid analysis timestamp');
 return E.completed(E.candles(raw),'D',now);
}
function statistics(xs) {
 if(!Array.isArray(xs)||!xs.length||xs.some(x=>!ok(x))) return null;
 const a=xs.slice().sort((x,y)=>x-y);
 return {min:a[0],p10:percentile(a,.1),p50:percentile(a,.5),p90:percentile(a,.9),max:a[a.length-1],mean:mean(a),count:a.length};
}
function marketRegime(raw,options={}) {
 const now=options.now===undefined?Date.now():options.now, xs=bars(raw,now);
 if(xs.length<55)return {ready:false,asOf:xs.length?new Date(xs[xs.length-1].t).toISOString():null,reason:'At least 55 completed daily bars are required',sampleSize:xs.length};
 const close=xs.map(x=>x.c),last=close[close.length-1];
 const s20=mean(close.slice(-20)),s50=mean(close.slice(-50));
 const rsi=E.rsi(close,14).slice(-1)[0],atr=E.atr(xs,14);
 const rets=close.slice(-21).slice(1).map((v,i)=>Math.log(v/close[close.length-21+i]));
 const mu=mean(rets),sd=Math.sqrt(rets.reduce((s,x)=>s+(x-mu)*(x-mu),0)/(rets.length-1));
 const trend=last>s20&&s20>s50?'Rising':last<s20&&s20<s50?'Falling':'Mixed';
 return {ready:true,sampleSize:xs.length,asOf:new Date(xs[xs.length-1].t).toISOString(),close:last,sma20:s20,sma50:s50,rsi,atr,annualizedVolPct:sd*Math.sqrt(252)*100,trend,description:'Historical completed-bar classification, not an entry recommendation or forward forecast'};
}
function backtest(raw,params={}) {
 const now=params.now===undefined?Date.now():params.now, xs=bars(raw,now),fast=params.fast===undefined?20:params.fast,
 slow=params.slow===undefined?50:params.slow,feeBps=params.feeBps===undefined?10:params.feeBps,
 slippageBps=params.slippageBps===undefined?5:params.slippageBps,capital=params.capital===undefined?100000:params.capital;
 if(!Number.isInteger(fast)||!Number.isInteger(slow)||fast<2||slow<=fast||slow>250||!ok(capital)||capital<=0||!ok(feeBps)||feeBps<0||feeBps>1000||!ok(slippageBps)||slippageBps<0||slippageBps>1000)err('Invalid backtest parameters');
 if(xs.length<slow+2)return {ready:false,sampleSize:xs.length,reason:'Need at least '+(slow+2)+' completed daily bars; historical options prices are not reconstructed'};
 const prices=xs.map(x=>x.c),f=E.sma(prices,fast),s=E.sma(prices,slow);
 let cash=capital,shares=0,peak=capital,maxDrawdown=0,tradeCount=0;
 const fills=[],equity=[],buyAndHold=capital*xs[xs.length-1].c/xs[slow].o;
 // Signals from completed bar i-1 are executed at bar i OPEN. No look-ahead.
 for(let i=slow;i<xs.length;i++){
   const enter=f[i-1]>s[i-1],exit=f[i-1]<=s[i-1],open=xs[i].o;
   if(shares===0&&enter){
     const costPerShare=open*(1+(feeBps+slippageBps)/10000);
     shares=cash/costPerShare;cash=0;tradeCount++;
     fills.push({date:new Date(xs[i].t).toISOString().slice(0,10),action:'BUY',price:open*(1+slippageBps/10000)});
   } else if(shares>0&&exit){
     cash=shares*open*(1-(feeBps+slippageBps)/10000);shares=0;tradeCount++;
     fills.push({date:new Date(xs[i].t).toISOString().slice(0,10),action:'SELL',price:open*(1-slippageBps/10000)});
   }
   const nav=cash+shares*xs[i].c;peak=Math.max(peak,nav);maxDrawdown=Math.max(maxDrawdown,(peak-nav)/peak);
   equity.push({date:new Date(xs[i].t).toISOString().slice(0,10),value:nav});
 }
 const terminal=equity[equity.length-1].value,benchmark=buyAndHold;
 return {ready:true,sampleSize:xs.length,asOf:new Date(xs[xs.length-1].t).toISOString(),
   initialCapital:capital,finalEquity:terminal,totalReturnPct:(terminal/capital-1)*100,
   benchmarkReturnPct:(benchmark/capital-1)*100,maxDrawdownPct:maxDrawdown*100,
   tradeCount,fills,equity,positionOpen:shares>0,
   caveat:'HAL underlying long/flat trend test only. Signals use previous completed close; fills at next daily open with assumed flat bps fees/slippage. No futures carry, margins, taxes, option history, borrow or guaranteed liquidity.'};
}
function rng(seed) {
 if(!Number.isInteger(seed)||seed<=0||seed>=2147483647)err('Seed must be between 1 and 2147483646');
 let v=seed;return ()=>{v=(v*16807)%2147483647;return (v-.5)/2147483647;};
}
function monteCarlo(params={}) {
 const spot=params.spot,volPct=params.volPct,days=params.days===undefined?5:params.days,
 paths=params.paths===undefined?300:params.paths,seed=params.seed===undefined?47:params.seed,
 driftPct=params.driftPct===undefined?0:params.driftPct;
 if(!ok(spot)||spot<=0||!ok(volPct)||volPct<0||volPct>300||!Number.isInteger(days)||days<1||days>365||
 !Number.isInteger(paths)||paths<100||paths>2000||!ok(driftPct)||Math.abs(driftPct)>100)err('Invalid Monte Carlo assumptions');
 const uniform=rng(seed),t=days/365,sigma=volPct/100,drift=driftPct/100;
 const outcomes=[];
 for(let i=0;i<paths;i++){const u1=Math.max(uniform(),1e-12),u2=uniform(),z=Math.sqrt(-2*Math.log(u1))*Math.cos(2*Math.PI*u2);
  outcomes.push(spot*Math.exp((drift-.5*sigma*sigma)*t+sigma*Math.sqrt(t)*z));}
 const stats=statistics(outcomes);
 return {outcomes,stats,probBelowSpot:outcomes.filter(x=>x<spot).length/paths,spot,volPct,days,paths,seed,
  assumptions:'Independent lognormal endpoint samples, zero default price drift, annual volatility and ACT/365. A stochastic illustration, not a probability-calibrated forecast.'};
}
function portfolioForecast(book,market,params={}) {
 const now=params.now===undefined?Date.now():params.now,spot=params.spot,days=params.days===undefined?5:params.days;
 if(!ok(now)||!ok(spot)||spot<=0)err('Enter a positive scenario spot and valid date');
 if(!book||!Array.isArray(book.legs)||!book.legs.length)return {ready:false,reason:'No actual open legs in the saved book'};
 const e=Math.min(...book.legs.map(l=>E.expiryTime(l.expiry)));
 if(!ok(e)||e<now)return {ready:false,reason:'Reconcile expired or invalid contracts before forecasting'};
 if(now+days*E.DAY>e)return {ready:false,reason:'Scenario horizon crosses the earliest open expiry; earlier settlements cannot be guessed'};
 const mc=monteCarlo({...params,spot,days});
 const scenarios=[],errors=new Set();
 for(const futureSpot of mc.outcomes){
  const r=E.scenario(book,market,{spot:futureSpot,days,rate:params.rate===undefined?6:params.rate,
    dividend:params.dividend===undefined?0:params.dividend,ivShift:params.ivShift===undefined?0:params.ivShift,
    fallbackIV:params.fallbackIV===undefined?25:params.fallbackIV,basis:'carry'},now);
  if(r.complete)scenarios.push(r.total);else r.errors.forEach(x=>errors.add(x));
 }
 if(errors.size||scenarios.length!==mc.paths)return {ready:false,reason:Array.from(errors).join('; ')||'Incomplete portfolio scenarios'};
 const ledger=E.ledger(book,market,{now}),stats=statistics(scenarios);
 return {ready:true,price:mc.stats,openPnL:stats,lifetimeNet:statistics(scenarios.map(x=>x+ledger.realized-ledger.charges)),
   inputs:{spot,days,volPct:params.volPct,paths:mc.paths,seed:mc.seed,fallbackIV:params.fallbackIV===undefined?25:params.fallbackIV},
   caveat:'Model P&L is measured from recorded entry costs; lifetime net includes recorded realised gross and lifetime charges. Hypothetical futures use carry, puts use fixed assumed IV. Margins, delivery, path effects, rolls and execution are excluded.'};
}
function stressGrid(book,market,params={}) {
 const spot=params.spot,now=params.now===undefined?Date.now():params.now,
 days=params.days===undefined?5:params.days,iv=params.fallbackIV===undefined?25:params.fallbackIV;
 if(!ok(spot)||spot<=0||!Number.isInteger(days)||days<0||days>365||!ok(iv)||iv<0||iv>500)err('Invalid stress-grid inputs');
 const rows=[];
 for(const shock of [-.10,-.05,-.03,0,.03,.05]){
  const cells=[];for(const shift of [-5,0,5]){
   const r=E.scenario(book,market,{spot:spot*(1+shock),days,rate:params.rate===undefined?6:params.rate,
      dividend:params.dividend===undefined?0:params.dividend,ivShift:shift,fallbackIV:iv,basis:'carry'},now);
   cells.push({ivShift:shift,openPnL:r.complete?r.total:null,error:r.errors.join('; ')||null});
  }rows.push({shock,spot:spot*(1+shock),cells});}
 return {rows,days,fallbackIV:iv,assumptions:'Spot and IV shocks relative to explicitly assumed inputs. Model P&L relative to entry, before realised trades and charges. Withheld when earliest contract expires first.'};
}
function headlineSignals(items,now=Date.now()) {
 if(!Array.isArray(items)||items.length===0)return {ready:false,reason:'No dated headlines available; do not infer that no HAL news occurred'};
 const valid=items.filter(x=>x&&typeof x.title==='string'&&Number.isFinite(Date.parse(x.publishedAt||''))&&
 Date.parse(x.publishedAt)<=now+5000&&Date.parse(x.publishedAt)>=now-7*86400000);
 const distinct=[],seen=new Set();
 for(const n of valid){const key=n.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  if(!seen.has(key)){seen.add(key);distinct.push(n);}}
 const recent=distinct.filter(x=>now-Date.parse(x.publishedAt)<=3600000).length,
 prior=distinct.filter(x=>{const age=now-Date.parse(x.publishedAt);return age>3600000&&age<=7200000;}).length;
 const official=distinct.filter(x=>x.official).length;
 return {ready:true,count:distinct.length,lastHour:recent,previousHour:prior,officialCount:official,
  spike:recent>=5&&recent>=3*Math.max(1,prior),asOf:new Date(now).toISOString(),
  caveat:'Counts of available, dated, deduplicated headlines only; missing feed coverage or headline spikes do not predict market direction.'};
}
function sixPerspectives(ctx={}) {
 const out=[],t=ctx.technical||{},r=ctx.risk||{},l=ctx.valuation||{},b=ctx.book||{},
 headlines=headlineSignals(ctx.news||[],ctx.now===undefined?Date.now():ctx.now);
 out.push({desk:'Technical',evidence:t.ready&&!t.stale?t.bias:'Current completed technical evidence unavailable',confidence:t.ready&&!t.stale?'observed':'withheld'});
 out.push({desk:'Derivatives',evidence:r.futureUnits===undefined?'Validated risk totals unavailable':r.futureUnits+' future units; '+r.putUnits+' put units; '+r.uncoveredUnits+' uncovered',confidence:r.futureUnits===undefined?'withheld':'recorded'});
 out.push({desk:'Portfolio',evidence:l.complete&&!l.stale&&!l.manual?'Indicative lifetime net '+l.net:'Live complete portfolio mark unavailable or manually valued',confidence:l.complete&&!l.stale&&!l.manual?'estimated':'withheld'});
 out.push({desk:'Fundamental',evidence:'Check dated consolidated results, order backlog and official filings in Research; model does not verify unstamped financial assertions',confidence:'source-review-required'});
 out.push({desk:'News',evidence:headlines.ready?headlines.count+' distinct recent headlines; '+headlines.officialCount+' official':'Dated headline feed unavailable',confidence:headlines.ready?'coverage-limited':'withheld'});
 out.push({desk:'Risk control',evidence:(r.warnings||[]).map(w=>w.title).slice(0,3).join('; ')||'Verify contract expiry, margin and physical settlement',confidence:'action-required'});
 return {perspectives:out,headlines,kind:'Local evidence checklist; no LLM forecast, autonomous orders or investment recommendation.'};
}
const api={bars,statistics,marketRegime,backtest,monteCarlo,portfolioForecast,stressGrid,headlineSignals,sixPerspectives};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.HAL47Quant=api;
})(typeof globalThis!=='undefined'?globalThis:this);
