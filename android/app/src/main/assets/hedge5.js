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
function compareOneLot(book,market,ownedId,candidateKey,settings={},now=Date.now()){
 const E=typeof module==='object'?require('./engine4.js'):root.HAL4Engine;
 const b=E.validateBook(book),p=E.hedgePreferences(settings);
 const old=b.legs.find(l=>l.id===ownedId&&l.type==='PE');
 if(!old)throw Error('Choose an owned protective put.');
 if(b.legs.some(l=>E.expiryTime(l.expiry)<=now))throw Error('Reconcile expired legs before comparing a rollover.');
 if(!b.legs.some(l=>l.type==='FUT'))throw Error('Record the futures exposure first.');
 const next=market.contracts.find(c=>c.instrumentKey===candidateKey&&c.type==='PE');
 if(!next||!date(next.expiry)||next.expiry<=old.expiry||!finite(next.strike)||next.strike<=0)
  throw Error('Choose a listed put with a later expiry.');
 if(next.lotSize!==old.lotSize)throw Error('One replacement lot must cover the same units as one owned lot.');
 const units=old.lotSize;
 function price(leg,side){
  const match=E.matchContract(leg,market);
  if(match.error)throw Error(match.error);
  const q=market.quotes[match.contract.instrumentKey];
  const quality=E.quoteQuality(q,{now,requireFresh:true,requireTrade:true,maxAge:p.maxAge,maxTradeAge:p.maxTradeAge});
  if(!quality.valid)throw Error(side+' quote: '+quality.reasons.join(', '));
  if(!finite(q.bid)||!finite(q.ask)||q.bid<=0||q.ask<q.bid)throw Error(side+' needs a valid two-sided quote.');
  if((q.ask-q.bid)/((q.ask+q.bid)/2)*100>p.maxSpread)throw Error(side+' spread exceeds your limit.');
  if(!finite(q[side+'Qty'])||q[side+'Qty']<units)throw Error('Insufficient displayed '+side+' depth for one lot.');
  if(!finite(q.volume)||q.volume<p.minVolume||!finite(q.oi)||q.oi<p.minOI)throw Error(side+' volume or open interest is unavailable or below your limits.');
  return q;
 }
 const sell=price(old,'bid'),buy=price(next,'ask');
 const sale=sell.bid*units*(1-p.slippage/100),purchase=buy.ask*units*(1+p.slippage/100);
 const fees=p.exitFees+p.buyFees,netCash=purchase+fees-sale;
 const dates=[...new Set(b.legs.map(l=>l.expiry).concat(next.expiry))].sort();
 const coverage=dates.map(expiry=>{
  const remaining=b.legs.filter(l=>l.expiry>expiry);
  const count=type=>remaining.filter(l=>l.type===type).reduce((sum,l)=>sum+quantity(l),0);
  const futures=count('FUT'),keep=count('PE');
  const rolled=keep-(old.expiry>expiry?units:0)+(next.expiry>expiry?units:0);
  return {expiry,futures,keep:Math.min(futures,keep),rolled:Math.min(futures,rolled),putUnits:rolled};
 });
 const spot=market.spot,spotQuality=E.quoteQuality(spot,{now,requireFresh:true,requireTrade:true});
 const scenarios=[0,-.03,-.05,-.10].map(shock=>{
  if(!spotQuality.valid)return {shock,error:'Fresh HAL spot required for scenarios.'};
  const params={spot:spot.price*(1+shock),horizon:old.expiry,fallbackIV:p.fallbackIV,ivShift:p.ivShift,rate:p.rate,dividend:p.dividend};
  const model=E.scenario([{...next,id:'replacement',lots:1,entry:0}],market,params,now);
  if(!model.complete)return {shock,error:model.errors.join(', ')};
  const keepValue=Math.max(old.strike-params.spot,0)*units;
  const rollValue=model.rows[0].modelPrice*units;
  return {shock,keepValue,rollValue,difference:rollValue-keepValue-netCash};
 });
 return {units,sale,purchase,fees,netCash,sell,buy,coverage,scenarios};
}
const api={quantity,auditHedge,compareOneLot};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Hedge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
