/* HAL Desk 5 — read-only preview of broker-reported close/settlement accounting.
   Deliberately returns NO book mutation, no order, and no transaction object
   suitable for automatically saving. The existing explicit Book -> Close control
   remains the only path for recording a real transaction after user confirmation. */
(function(root){'use strict';
 const E=typeof module==='object'&&module.exports?require('./engine4.js'):root.HAL4Engine;
 const H=typeof module==='object'&&module.exports?require('./history5.js'):root.HAL5History;
 const valid=x=>typeof x==='number'&&Number.isFinite(x);
 const money=x=>Math.sign(x)*Math.round((Math.abs(x)+Number.EPSILON)*100)/100;
 function preview(book,details,now=Date.now()){
  const b=E.validateBook(book),d=details||{};
  if(d.confirmed!==true)throw Error('Review the completed transaction against your broker before previewing.');
  if(typeof d.source!=='string'||!d.source.trim()||d.source.length>200)
   throw Error('Identify the broker record used for this close.');
  if(typeof d.legId!=='string'||!d.legId)throw Error('Choose a recorded open contract.');
  const leg=b.legs.find(x=>x.id===d.legId);
  if(!leg)throw Error('No matching recorded open contract. Nothing has been changed.');
  if(!Number.isSafeInteger(d.lots)||d.lots<=0||d.lots>leg.lots)
   throw Error('Close only a positive whole-lot quantity currently in the book.');
  if(!valid(d.exitPrice)||d.exitPrice<0||d.exitPrice>1e7||
     leg.type==='FUT'&&d.exitPrice===0)
   throw Error('Enter the actual broker-reported exit/settlement price. A futures price must be positive.');
  if(!valid(d.fees)||d.fees<0||d.fees>1e9)throw Error('Enter non-negative actual charges.');
  if(!E.validDate(d.closeDate)||d.closeDate>E.istDate(now))
   throw Error('Enter a completed trade or settlement date no later than today.');
  // An expiry date is not a broker execution timestamp. Actual confirmed
  // settlement can post later; never infer a fill from spot, IV or intrinsic value.
  let id='v5-readonly-preview-'+b.revision;
  while(b.journal.some(j=>j.id===id))id+='x';
  const next=E.closeLeg(b,leg.id,d.lots,d.exitPrice,d.fees,d.closeDate,
   {id,now,note:'Read-only preview; not recorded'});
  const before=H.totals(b),after=H.totals(next);
  const gross=money((d.exitPrice-leg.entry)*d.lots*leg.lotSize);
  const grossDelta=money(after.realized-before.realized);
  if(Math.abs(grossDelta-gross)>0.011)throw Error('Gross close P&L did not reconcile; preview withheld.');
  const chargesDelta=money(after.charges-before.charges);
  if(chargesDelta<-.01||chargesDelta>d.fees+.01)
   throw Error('Incremental charges did not reconcile; preview withheld.');
  const chargeCovered=!!b.history?.charges&&d.closeDate<=b.history.charges.asOf;
  return {
   previewOnly:true,sourceProvided:true,kind:leg.type,legId:leg.id,
   expiry:leg.expiry,closeDate:d.closeDate,
   lots:d.lots,units:d.lots*leg.lotSize,remainingLots:leg.lots-d.lots,
   exitPrice:d.exitPrice,entryPrice:leg.entry,
   enteredCloseFees:d.fees,
   recordedGrossChange:grossDelta,
   recordedChargeChange:chargesDelta,
   recordedNetChange:money(grossDelta-chargesDelta),
   priorRealizedGross:before.realized,previewRealizedGross:after.realized,
   priorBookedNet:before.net,previewBookedNet:after.net,
   chargesCoveredByConfirmedCumulativeStatement:chargeCovered,
   warnings:[
    'PREVIEW ONLY: no saved position, broker account or transaction journal has been changed.',
    'The entered exit is an explicit broker-reported transaction input, never an inferred exchange settlement.',
    chargeCovered?'A previously confirmed cumulative charge statement covers the recorded date; the close fees are not added again. Check that statement includes this transaction.':
     'Entered close fees are included as a new recorded charge; confirm that they are not already included elsewhere.',
    'For stock derivatives verify exercise/assignment, physical delivery, margin and cash obligations separately.',
    'Use Book → Record completed close to actually write your confirmed transaction; do not mistake this preview for a saved close.'
   ]
  };
 }
 const api={preview};
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.HAL5Reconcile=api;
})(typeof globalThis!=='undefined'?globalThis:this);
