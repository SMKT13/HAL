/* HAL Desk 5 — expiry-dated economic scenario audit, not a cash/margin forecast.
 * A cash-equity-settled result cannot be inferred from derivative intrinsic
 * value. Each dated economic P&L is conditional on user-supplied settlements.
 * No portfolio, journal, provider, broker, or storage writes.
 */
(function(root){'use strict';
const R=typeof module==='object'&&module.exports?require('./risk5.js'):root.HAL5Risk;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function path(legs,inputs={},asOfDate){
 if(!Array.isArray(legs)||!legs.length)throw Error('Record at least one open contract');
 if(!R.validDate(asOfDate))throw Error('Select a valid as-of date for the scenario');
 const checked=legs.map(R.validateLeg);
 if(checked.some(l=>l.expiry<asOfDate))
  throw Error('Reconcile previously expired contracts with broker records before estimating any hypothetical settlement path');
 if(checked.some(l=>l.side!=='long'))
  throw Error('The real-book expiry path requires long futures and protective long puts only');
 if(checked.some(l=>!['FUT','PE'].includes(l.type)))
  throw Error('The actual HAL position book supports long futures and puts, not short or call trades');
 const result=R.settlementScenario(checked,inputs);
 const dates=[...new Set(checked.map(l=>l.expiry))].sort();
 let running=0,allPriorPriced=true;
 const events=dates.map(expiry=>{
  const indices=checked.map((l,i)=>l.expiry===expiry?i:-1).filter(i=>i>=0);
  const legsHere=indices.map(i=>checked[i]),valuations=indices.map(i=>result.rows[i]);
  const known=valuations.every(v=>finite(v.pnl)&&finite(v.settlement));
  const pricedOptions=indices.filter(i=>checked[i].type==='PE'&&finite(result.rows[i].settlement));
  const optionExerciseEconomicValue=pricedOptions.reduce((n,i)=>n+checked[i].quantity*result.rows[i].settlement,0);
  const optionPremiumEntry=legsHere.filter(l=>l.type==='PE')
   .reduce((n,l)=>n+l.entry*l.quantity,0);
  const futureEntryNotional=legsHere.filter(l=>l.type==='FUT')
   .reduce((n,l)=>n+l.entry*l.quantity,0);
  const futureGrossPnl=known?indices.filter(i=>checked[i].type==='FUT').reduce((n,i)=>n+result.rows[i].pnl,0):null;
  const putGrossPnl=known?indices.filter(i=>checked[i].type==='PE').reduce((n,i)=>n+result.rows[i].pnl,0):null;
  const pnl=known?valuations.reduce((n,v)=>n+v.pnl,0):null;
  if(!known)allPriorPriced=false;
  if(allPriorPriced)running+=pnl;
  const remaining=checked.filter(l=>l.expiry>expiry),
   futuresUnits=remaining.filter(l=>l.type==='FUT').reduce((n,l)=>n+l.quantity,0),
   putsUnits=remaining.filter(l=>l.type==='PE').reduce((n,l)=>n+l.quantity,0);
  const firstUnderlying=inputs.spotAtExpiry&&inputs.spotAtExpiry[expiry];
  const firstFuture=inputs.futureAtExpiry&&inputs.futureAtExpiry[expiry];
  return {expiry,legs:legsHere.length,
   expiringPutUnits:legsHere.filter(l=>l.type==='PE').reduce((n,l)=>n+l.quantity,0),
   expiringFutureUnits:legsHere.filter(l=>l.type==='FUT').reduce((n,l)=>n+l.quantity,0),
   assumedUnderlyingSpot:finite(firstUnderlying)?firstUnderlying:null,
   assumedFuturesSettlement:finite(firstFuture)?firstFuture:null,
   putIntrinsicEconomicValue:pricedOptions.length===legsHere.filter(l=>l.type==='PE').length?optionExerciseEconomicValue:null,
   putEntryPremiumPreviouslyPaid:optionPremiumEntry,
   futuresEntryNotionalNotCash:futureEntryNotional,
   grossPutPnl:putGrossPnl,grossFuturePnl:futureGrossPnl,
   economicPnl:pnl,cumulativeGrossEconomicPnl:allPriorPriced?running:null,
   remainingFutureUnits:futuresUnits,remainingPutUnits:putsUnits,
   uncoveredFutureUnitsAfter:Math.max(0,futuresUnits-putsUnits),
   available:known,
   physicalSettlement:legsHere.some(l=>l.type==='FUT'||l.type==='PE')?'Broker settlement/exercise and physical delivery must be confirmed. Economic payoff is not a cash delivery amount.':null};
 });
 const completed=events.every(e=>e.available)&&result.complete;
 const sum=completed?events.reduce((n,e)=>n+e.economicPnl,0):null;
 if(completed&&Math.abs(sum-result.total-result.charges)>0.011)
  throw Error('Expiry audit does not reconcile with original scenario calculation');
 return {
  complete:completed,events,
  totalGrossEconomicPnl:sum,totalNetEconomicPnl:completed?result.total:null,
  assumedAdditionalCosts:result.charges,errors:result.errors.slice(),
  brokerCashRequirement:null,physicalDeliveryUnits:null,variationMarginPath:null,
  contractCashObligationsAvailable:false,
  gapDates:events.filter(e=>e.uncoveredFutureUnitsAfter>0).map(e=>({
   afterExpiry:e.expiry,uncoveredUnits:e.uncoveredFutureUnitsAfter})),
  assumptions:[
   'This is hypothetical economic P&L by expiry, not the amount the broker will debit, credit, or demand as delivery cash.',
   'Each earlier put expiry uses its own assumed underlying spot; a later futures settlement cannot retroactively value that put.',
   'Option premium entry outlay is already in recorded P&L and is not charged twice; option intrinsic/exercise value does not guarantee a cash receipt.',
   'Actual stock option exercise, assignment, physical-delivery cash, tax and funding obligations are not derivable from these assumptions.',
   'Futures daily mark-to-market, margin calls, and their dates remain unknown without a broker ledger and path of settlement marks.',
   'Additional hypothetical charges are deducted once only in the all-expiries net; they are not assigned to individual dates.',
   'No scenario creates or updates a position or a broker order.'
  ]
 };
}
const api={path};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5ScenarioPath=api;
})(typeof globalThis!=='undefined'?globalThis:this);
