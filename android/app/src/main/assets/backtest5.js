/* HAL Desk 5 — independent, long-only historical SMA research.
 * Pure calculations on completed HAL daily OHLCV bars. No accounts or orders.
 * Entry/exit signals at a completed bar's CLOSE fill only at NEXT bar's OPEN.
 * This is a simple stock-per-share PAPER reference, not a HAL futures/options backtest.
 */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function validatedBars(input){
 if(!Array.isArray(input)||input.length<3||input.length>3000)throw Error('Require 3–3000 completed OHLCV bars.');
 let prev=-Infinity;
 return input.map(x=>{
  if(!x||!Number.isSafeInteger(x.t)||x.t<=prev||![x.o,x.h,x.l,x.c,x.v].every(finite)||
   Math.min(x.o,x.h,x.l,x.c)<=0||x.v<0||x.h<Math.max(x.o,x.c,x.l)||x.l>Math.min(x.o,x.c,x.h))
    throw Error('Invalid, unordered, duplicate or incomplete OHLCV bar.');
  prev=x.t;
  return {t:x.t,o:x.o,h:x.h,l:x.l,c:x.c,v:x.v};
 });
}
function sma(prices,period){
 let sum=0;
 return prices.map((price,i)=>{
  sum+=price;if(i>=period)sum-=prices[i-period];
  return i>=period-1?sum/period:null;
 });
}
function backtestSma(input,settings={}){
 const bars=validatedBars(input);
 const {fast=20,slow=50,feeBps=0,slippageBps=0}=settings;
 if(!Number.isInteger(fast)||!Number.isInteger(slow)||fast<2||fast>=slow||slow>200||
  bars.length<slow+3||!finite(feeBps)||feeBps<0||feeBps>300||
  !finite(slippageBps)||slippageBps<0||slippageBps>300)
  throw Error('Invalid windows, sample length or modelled trading costs.');
 const f=sma(bars.map(b=>b.c),fast),s=sma(bars.map(b=>b.c),slow);
 let open=null,realizedGross=0,charged=0,peak=0,maxDrawdown=0;
 const trades=[],events=[],curve=[];
 for(let j=0;j<bars.length;j++){
  const bar=bars[j];
  if(j>=slow+1){
   const prior=f[j-2]-s[j-2],latest=f[j-1]-s[j-1];
   if(!open&&prior<=0&&latest>0){
    const entry=bar.o*(1+slippageBps/10000);
    const entryFee=bar.o*feeBps/10000;
    open={price:entry,at:bar.t,signalAt:bars[j-1].t,fee:entryFee};
    charged+=entryFee;
    events.push({side:'BUY',signalAt:bars[j-1].t,fillAt:bar.t,fillPrice:entry});
   }else if(open&&prior>=0&&latest<0){
    const exit=bar.o*(1-slippageBps/10000),exitFee=bar.o*feeBps/10000;
    charged+=exitFee;
    const gross=exit-open.price,net=gross-open.fee-exitFee;
    realizedGross+=gross;
    trades.push({entryAt:open.at,entrySignalAt:open.signalAt,exitAt:bar.t,
      exitSignalAt:bars[j-1].t,entryPrice:open.price,exitPrice:exit,
      grossPerShare:gross,costsPerShare:open.fee+exitFee,netPerShare:net});
    events.push({side:'SELL',signalAt:bars[j-1].t,fillAt:bar.t,fillPrice:exit});
    open=null;
   }
  }
  const unrealized=open?bar.c-open.price:0,net=realizedGross-charged+unrealized;
  peak=Math.max(peak,net);
  maxDrawdown=Math.max(maxDrawdown,peak-net);
  curve.push({t:bar.t,netPerShare:net});
 }
 const markedUnrealized=open?bars[bars.length-1].c-open.price:0;
 const netPerShare=realizedGross+markedUnrealized-charged;
 const wins=trades.filter(x=>x.netPerShare>0).length;
 const basis=bars[slow+1].o;
 return {strategy:'SMA crossover, long-only',fast,slow,
  sample:{from:bars[0].t,to:bars[bars.length-1].t,bars:bars.length,firstEligibleFillAt:bars[slow+1].t},
  closedTrades:trades,events,openPosition:open?{entryAt:open.at,entryPrice:open.price,markedAt:bars[bars.length-1].t,mark:bars[bars.length-1].c}:null,
  metrics:{closedTrades:trades.length,wins,winRate:trades.length?wins/trades.length:null,
   realizedGrossPerShare:realizedGross,unrealizedPerShare:markedUnrealized,
   modeledFeesPerShare:charged,netPerShare,netPctOfReferencePrice:100*netPerShare/basis,
   maxDrawdownPerShare:maxDrawdown,maxDrawdownPctOfReferencePrice:100*maxDrawdown/basis},
  lastSignal:events.length?events[events.length-1]:null,
  caveats:['Signals depend only on previously completed candles; entries/exits use the next candle open.',
   'One notional cash-equity share, no leverage, options, physical delivery or futures rolls.',
   'This is in-sample descriptive research, not an out-of-sample forecast or executable fills.',
   'Only specified fee/slippage assumptions are included; taxes, borrow costs and financing are omitted.']};
}
function windowVol(prices,end,length){
 const rets=[];
 for(let i=end-length+1;i<=end;i++)rets.push(Math.log(prices[i]/prices[i-1]));
 const mean=rets.reduce((a,b)=>a+b,0)/rets.length;
 const variance=rets.reduce((a,b)=>a+(b-mean)*(b-mean),0)/(rets.length-1);
 return Math.sqrt(variance)*Math.sqrt(252)*100;
}
function marketRegime(input){
 const bars=validatedBars(input);
 if(bars.length<62)return {ready:false,reason:'At least 62 completed daily observations are required.',asOf:bars[bars.length-1].t};
 const prices=bars.map(b=>b.c),last=prices.length-1;
 const a20=prices.slice(-20).reduce((a,b)=>a+b,0)/20,a50=prices.slice(-50).reduce((a,b)=>a+b,0)/50;
 const nowVol=windowVol(prices,last,20),pastVol=windowVol(prices,last-20,20);
 const ratio=pastVol>0?nowVol/pastVol:null;
 return {ready:true,asOf:bars[last].t,count:bars.length,
  trend:prices[last]>a20&&a20>a50?'Uptrend evidence':prices[last]<a20&&a20<a50?'Downtrend evidence':'Mixed trend',
  sma20:a20,sma50:a50,return20Pct:100*(prices[last]/prices[last-20]-1),
  volatility20AnnualPct:nowVol,priorVolatility20AnnualPct:pastVol,
  volatilityRegime:ratio==null?'Prior-volatility comparison unavailable':ratio>=1.25?'Rising realized volatility':ratio<=0.8?'Falling realized volatility':'Similar realized volatility',
  caveat:'Historical observations, not a predictive signal. Use only completed daily bars and verify retrieval age.'};
}
const api={validatedBars,backtestSma,marketRegime};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Backtest=api;
})(typeof globalThis!=='undefined'?globalThis:this);
