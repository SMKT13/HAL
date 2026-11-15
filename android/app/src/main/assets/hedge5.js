/* HAL Desk 5 — pure read-only audit of an eligible put-hedge comparison.
   The existing provider-aware hedge engine remains responsible for quote,
   depth, exact contract, expiry and IV eligibility. No order placement. */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
 Number.isFinite(Date.parse(x+'T00:00:00Z'))&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
function quantity(x){
 if(!x||!Number.isSafeInteger(x.lots)||x.lots<=0||!Number.isSafeInteger(x.lotSize)||x.lotSize<=0)
   throw Error('Unverified whole-lot contract quantity');
 const n=x.lots*x.lotSize;
 if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid contract quantity');
 return n;
}
function auditHedge(book,engineResult,instrumentKey,throughDate){
 if(!book||!Array.isArray(book.legs)||!engineResult||!Array.isArray(engineResult.candidates))
  throw Error('Missing verified hedge comparison data');
 const futures=book.legs.filter(x=>x.type==='FUT');
 if(!futures.length)throw Error('No long futures position');
 if(futures.some(x=>!date(x.expiry)))throw Error('Unverified futures expiry');
 const futureUnits=futures.reduce((n,x)=>n+quantity(x),0);
 const futuresLastExpiry=futures.map(x=>x.expiry).sort().slice(-1)[0];
 if(!date(throughDate))throw Error('Invalid protection-through date');
 if(typeof instrumentKey!=='string'||!instrumentKey)throw Error('Select an eligible listed put');
 const c=engineResult.candidates.find(x=>x.contract?.instrumentKey===instrumentKey);
 if(!c)throw Error('Candidate is not eligible in this verified comparison');
 const ex=c.contract.expiry;
 if(!date(ex)||!finite(c.contract.strike)||c.contract.strike<=0)
  throw Error('Invalid candidate contract');
 if(ex<throughDate)throw Error('Candidate protection expires before the chosen protection-through date');
 if(!Number.isSafeInteger(c.lots)||c.lots<1||
    !Number.isSafeInteger(c.contract.lotSize)||c.contract.lotSize<1||
    c.lots*c.contract.lotSize!==futureUnits||c.units!==futureUnits)
  throw Error('Candidate does not fully cover futures quantity in whole lots');
 const amounts=['newPremium','grossCost','buyFees','exitFees','saleProceeds',
  'existingExitSlippage','worstLoss'];
 if(amounts.some(k=>!finite(c[k])||c[k]<0)||!finite(c.netCashRequired))throw Error('Missing or negative hedge accounting input');
 const tol=.02;
 if(Math.abs(c.grossCost-(c.newPremium+c.buyFees))>tol||
    Math.abs(c.netCashRequired-(c.grossCost+c.exitFees-c.saleProceeds))>tol)
  throw Error('Inconsistent gross/net hedge cash requirements');
 if(!Array.isArray(c.scenarios)||!c.scenarios.length)throw Error('No complete sampled hedge scenarios');
 const current=new Map();
 for(const x of Array.isArray(engineResult.current)?engineResult.current:[]){
  if(finite(x.additionalPnl)&&typeof x.horizon==='string'&&finite(x.shock))
   current.set(x.horizon+'|'+x.shock,x.additionalPnl);
 }
 const currentErrors=new Map();
 for(const x of Array.isArray(engineResult.currentErrors)?engineResult.currentErrors:[]){
  if(typeof x.horizon==='string'&&finite(x.shock))currentErrors.set(x.horizon+'|'+x.shock,x.reason||'Existing protection could not be valued at this horizon');
 }
 const comparisons=c.scenarios.map(s=>{
  if(!s||typeof s.horizon!=='string'||!finite(Date.parse(s.horizon))||
    !finite(s.shock)||!finite(s.additionalPnl))throw Error('Invalid model scenario');
  const key=s.horizon+'|'+s.shock,old=current.has(key)?current.get(key):null;
  return {horizon:s.horizon,shock:s.shock,spot:finite(s.spot)?s.spot:null,
   replacementAdditionalPnl:s.additionalPnl,existingAdditionalPnl:old,
   replacementMinusExisting:old===null?null:s.additionalPnl-old,
   reason:old===null?(currentErrors.get(key)||'Existing-put scenario unavailable for this date; do not extrapolate across expiry'):null};
 });
 const loss=Math.max(0,-Math.min(...comparisons.map(x=>x.replacementAdditionalPnl)));
 if(Math.abs(c.worstLoss-loss)>tol)throw Error('Sampled worst-loss metric does not reconcile to scenarios');
 const oldPuts=book.legs.filter(x=>x.type==='PE').map(x=>({expiry:x.expiry,strike:x.strike,units:quantity(x)}));
 if(oldPuts.some(x=>!date(x.expiry)))throw Error('Invalid recorded put expiry');
 const ahead=ex<futuresLastExpiry,overhang=ex>futuresLastExpiry;
 return {verified:true,contract:{instrumentKey,expiry:ex,strike:c.contract.strike,
   lots:c.lots,lotSize:c.contract.lotSize,units:futureUnits},
  throughDate,latestFutureExpiry:futuresLastExpiry,coverageGapAfter: ahead?ex:null,
  putContinuesAfterFutures:overhang,
  oldPuts,accounting:{grossPurchase:c.grossCost,
   oldPutSaleProceeds:c.saleProceeds,additionalExitFees:c.exitFees,
   netCashRequired:c.netCashRequired,existingExitSlippage:c.existingExitSlippage,
   sampledWorstLoss:c.worstLoss,modelIVSource:c.ivSource||'unavailable'},
  comparable:comparisons.filter(x=>x.existingAdditionalPnl!==null).length,
  unavailable:comparisons.filter(x=>x.existingAdditionalPnl===null).length,
  comparisons,assumptions:[
   'The provider-aware engine already screened quotes, trading times, depth, spread, IV and whole-lot eligibility.',
   'Full replacement means all existing puts are assumed sold at screened bid less slippage.',
   'Sale proceeds offset purchase cash requirements, not investment profit.',
   'Additional P&L is conditional on scenario and price-model assumptions, not a maximum loss bound.',
   'Different expiries cannot be compared using a common later spot without earlier settlements.',
   'Physical-delivery, margin and broker cutoffs require separate account-specific review.'
  ]};
}
const api={quantity,auditHedge};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Hedge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
