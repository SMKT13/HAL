/* HAL Desk 5 independent risk-simulation primitives, no trading or data I/O.
   Simulated frequencies are conditional on input assumptions, NOT calibrated forecasts. */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function rng32(seed){
 let a=seed>>>0;
 return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);
  t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function quantile(sorted,p){
 const pos=(sorted.length-1)*p,low=Math.floor(pos),w=pos-low;
 return sorted[low]*(1-w)+sorted[Math.min(low+1,sorted.length-1)]*w;
}
function simulateRisk(input,priceToPnl){
 const {startSpot,annualVolPct,driftPct=0,days,iterations=250,seed=1307}=input||{};
 if(!finite(startSpot)||startSpot<=0||!finite(annualVolPct)||annualVolPct<0||
    annualVolPct>500||!finite(driftPct)||Math.abs(driftPct)>1000||
    !finite(days)||days<=0||days>3650||
    !Number.isInteger(iterations)||iterations<100||iterations>2000||
    !Number.isSafeInteger(seed)||typeof priceToPnl!=='function')
  throw Error('invalid simulation assumptions');
 const rng=rng32(seed),t=days/365,vol=annualVolPct/100,drift=driftPct/100,spots=[],pnls=[];
 for(let i=0;i<iterations;i++){
  let u=rng();if(u<Number.EPSILON)u=Number.EPSILON;
  const v=rng(),z=Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  const spot=startSpot*Math.exp((drift-0.5*vol*vol)*t+vol*Math.sqrt(t)*z);
  if(!finite(spot)||spot<=0)throw Error('invalid simulated price');
  const pnl=priceToPnl(spot);
  if(!finite(pnl))throw Error('scenario P&L unavailable; no distribution reported');
  spots.push(spot);pnls.push(pnl);
 }
 const spotSorted=spots.slice().sort((a,b)=>a-b),sorted=pnls.slice().sort((a,b)=>a-b);
 const tail=Math.max(1,Math.ceil(iterations*0.05));
 return {count:iterations,seed,assumptions:{startSpot,annualVolPct,driftPct,days},
  spot:{p05:quantile(spotSorted,.05),median:quantile(spotSorted,.5),p95:quantile(spotSorted,.95)},
  pnl:{p05:quantile(sorted,.05),median:quantile(sorted,.5),p95:quantile(sorted,.95),
   worst:sorted[0],best:sorted[iterations-1],mean:sorted.reduce((a,b)=>a+b,0)/iterations,
   worstFivePctMean:sorted.slice(0,tail).reduce((a,b)=>a+b,0)/tail,
   fractionBelowZero:sorted.filter(x=>x<0).length/iterations},
  caveat:'Illustrative lognormal-model frequencies only, not real-world odds, trading signals, backtests or guaranteed loss bounds.'};
}
const api={simulateRisk};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Quant=api;
})(typeof globalThis!=='undefined'?globalThis:this);
