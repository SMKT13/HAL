/* HAL Desk 5: deterministic market-data provenance boundary.
   Compare normalized REST quotes only; STREAM never promotes to marks.
   Conflicting same-time prices or contract identities fail closed. No orders/network. */
(function(root){'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function clock(x){const t=typeof x==='string'&&x?Date.parse(x):NaN;return Number.isFinite(t)?t:null;}
function errorQuote(q,reason){
 return {...q,price:null,bid:null,ask:null,failure:reason,
  provenanceFailure:true};
}
function sameContract(a,b){
 if(!a||!b||a.instrumentKey!==b.instrumentKey)return false;
 for(const k of ['type','expiry','lotSize']){
  if(a[k]!=null&&b[k]!=null&&a[k]!==b[k])return false;
 }
 if((a.type==='PE'||a.type==='CE'||b.type==='PE'||b.type==='CE')&&
    a.strike!=null&&b.strike!=null&&a.strike!==b.strike)return false;
 return true;
}
function chooseQuote(a,b){
 if(!a)return b;
 if(!b)return a;
 // A disagreement is meaningful only if the provider quote AND last-exchange-trade
 // timestamps match. A changed bid/ask alone is not a last-traded-price conflict.
 const aq=clock(a.quoteAt),bq=clock(b.quoteAt),at=clock(a.tradeAt),bt=clock(b.tradeAt);
 if(aq!==null&&bq!==null&&aq===bq&&at!==null&&bt!==null&&at===bt&&
    finite(a.price)&&finite(b.price)&&Math.abs(a.price-b.price)>0.01){
  return errorQuote(b,'Conflicting prices for identical provider quote and trade timestamps');
 }
 // Once a conflict is detected, only a strictly newer provider timestamp
 // can re-establish a valuation mark. An identical-clock reread cannot erase it.
 const holdA=a.provenanceFailure||typeof a.failure==='string'&&a.failure.startsWith('HAL5 quote integrity: ');
 const holdB=b.provenanceFailure||typeof b.failure==='string'&&b.failure.startsWith('HAL5 quote integrity: ');
 if(holdA&&(!(bq!==null&&aq!==null&&bq>aq)))return a;
 if(holdB&&(!(aq!==null&&bq!==null&&aq>bq)))return b;
 if(aq!==null&&bq===null)return a;
 if(bq!==null&&aq===null)return b;
 if(at!==null&&bt!==null&&bt<at)return a;
 if(aq!==null&&bq!==null){
  if(bq<aq)return a;
  if(bq>aq)return b;
 }
 // Cached observations with identical source clocks never overwrite a
 // REST mark. Lower-quality feeds remain usable only as labelled backups.
 if(a.source==='REST'&&b.source==='CACHE')return a;
 if(b.source==='REST'&&a.source==='CACHE')return b;
 const ar=clock(a.retrievedAt),br=clock(b.retrievedAt);
 if(ar!==null&&br!==null&&br<ar)return a;
 return b;
}
function audit(market,now=Date.now()){
 if(!market||typeof market!=='object'||!finite(now))throw Error('Invalid market-audit input');
 const out={total:0,missingPrice:0,cached:0,stale:0,futureClock:0,provenanceFailures:0,
  missingProviderTime:0,missingTradeTime:0,problems:[]};
 const quotes=[['HAL spot',market.spot],...Object.entries(market.quotes||{})];
 for(const [label,q] of quotes){
  out.total++;
  if(!q||!finite(q.price)||q.price<=0)out.missingPrice++;
  const qt=clock(q?.quoteAt),tt=clock(q?.tradeAt),rt=clock(q?.retrievedAt);
  if(q?.source==='CACHE')out.cached++;
  if(q?.failure||q?.provenanceFailure) {
   out.provenanceFailures++;
   if(out.problems.length<12)out.problems.push({instrument:label,issue:String(q.failure||'Provider provenance unavailable').slice(0,160)});
  }
  if(qt===null)out.missingProviderTime++;
  if(tt===null)out.missingTradeTime++;
  if([qt,tt,rt].some(t=>t!==null&&t>now+5000))out.futureClock++;
  if(qt!==null&&now-qt>120000)out.stale++;
 }
 for(const key of market.contractConflicts||[]){
  if(out.problems.length<12)out.problems.push({instrument:key,issue:'Conflicting instrument contract identity'});
 }
 out.contractConflicts=(market.contractConflicts||[]).length;
 // These are independent counts; they must not be added to obtain a number
 // of invalid contracts. Actual mark eligibility remains in quoteQuality().
 return out;
}
const api={clock,sameContract,chooseQuote,errorQuote,audit};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Quality=api;
})(typeof globalThis!=='undefined'?globalThis:this);
