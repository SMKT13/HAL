/* HAL Desk 5 — read-only independent P&L and recovery attribution.
 * Never treats missing/expired marks as zero. Does not post trades, change books,
 * move funding cash or infer gains required from future trading decisions. */
(function(root){'use strict';
const E=typeof module==='object'?require('./engine4.js'):root.HAL4Engine;
const H=typeof module==='object'?require('./history5.js'):root.HAL5History;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function cents(v){if(!finite(v))throw Error('Invalid financial amount');return Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON)*100);}
function rupees(v){if(!Number.isSafeInteger(v))throw Error('Financial amount exceeds safe precision');return v/100;}
function audit(book,valuation){
 const b=E.validateBook(book),v=valuation||E.ledger(b),history=H.totals(b);
 const journal=b.journal.filter(j=>j.kind==='close'),
  completedLots=journal.reduce((n,j)=>n+j.leg.lots,0),
  historyRecords=b.history?.records||[];
 const errors=[],rows=[];let rawOpenSum=0;
 if(!v||!Array.isArray(v.rows)||v.rows.length!==b.legs.length)
  errors.push('Incomplete portfolio leg valuation rows');
 if(!finite(v?.realized)||Math.abs(v.realized-history.realized)>.005)errors.push('Recorded realized P&L does not reconcile');
 if(!finite(v?.charges)||Math.abs(v.charges-history.charges)>.005)errors.push('Recorded charges do not reconcile');
 const valued=Array.isArray(v?.rows)&&v.rows.length===b.legs.length;
 if(valued)for(let i=0;i<b.legs.length;i++){
  const leg=b.legs[i],r=v.rows[i],qty=leg.lots*leg.lotSize;
  if(!r||r.leg?.id!==leg.id||r.units!==qty){errors.push('Open leg quantity or identity mismatch');continue;}
  const mark=finite(r.mark?.price)?r.mark.price:null;
  const rawPnl=mark===null?null:(mark-leg.entry)*qty;
  const expected=rawPnl===null?null:rupees(cents(rawPnl));
  if(rawPnl!==null)rawOpenSum+=rawPnl;
  if(mark!==null&&(mark<0||leg.type==='FUT'&&mark===0))errors.push('Invalid open contract mark');
  if((expected===null)!==(r.pnl===null)||expected!==null&&(!finite(r.pnl)||Math.abs(expected-r.pnl)>.005))
   errors.push('Open-leg mark/P&L mismatch');
  const expired=r.mark?.status==='expired_unreconciled';
  rows.push({id:leg.id,type:leg.type,expiry:leg.expiry,units:qty,entry:leg.entry,
   mark,markSource:r.mark?.source||'Unavailable',markStatus:r.mark?.status||'unavailable',
   openPnl:expected,expiredUnreconciled:expired});
 }
 const allMarked=valued&&rows.length===b.legs.length&&rows.every(r=>finite(r.openPnl));
 let computedOpen=null;
 if(allMarked)computedOpen=rupees(cents(rawOpenSum));
 if(v.complete!==allMarked)errors.push('Basket completion flag disagrees with per-leg marks');
 if(allMarked&&(!finite(v.open)||Math.abs(v.open-computedOpen)>.005))
  errors.push('Basket open P&L does not reconcile');
 if(!allMarked&&v.open!==null)errors.push('Incomplete basket wrongly contains an open P&L total');
 const recordedRealized=rupees(cents(history.realized)),
  recordedCharges=rupees(cents(history.charges)),
  bookedNet=rupees(cents(recordedRealized)-cents(recordedCharges)),
  expectedNet=allMarked?rupees(cents(bookedNet)+cents(computedOpen)):null;
 if(allMarked&&(!finite(v.net)||Math.abs(v.net-expectedNet)>.005))
  errors.push('Lifetime net P&L does not reconcile');
 if(!allMarked&&v.net!==null)errors.push('Lifetime net must be missing when an open leg is unpriced');
 const consistent=errors.length===0,complete=consistent&&allMarked;
 return {consistent,complete,errors,rows:consistent?rows:[],
  open:complete?computedOpen:null,realizedGross:consistent?recordedRealized:null,
  recordedCharges:consistent?recordedCharges:null,
  bookedNet:consistent?bookedNet:null,
  net:complete?expectedNet:null,
  indicativeShortfall:complete?Math.max(0,-expectedNet):null,
  bookedRecoveryRequirement:consistent?Math.max(0,-bookedNet):null,
  unpricedLegs:consistent?rows.filter(r=>r.openPnl===null).map(r=>r.id):[],
  expiredUnreconciled:consistent?rows.filter(r=>r.expiredUnreconciled).map(r=>r.id):[],
  completedLots,completedCloseRecords:journal.length,historyRecordCount:historyRecords.length,
  realizedByType:consistent?history.byType:null,unallocatedLegacyGross:consistent?history.legacyGross:null,
  chargesAsOf:b.history?.charges?.asOf||null,
  markQuality:!consistent?'unverifiable':!b.legs.length?'no open positions':!complete?'incomplete':v.manual?'manual':v.stale?'stale':'provider',
  settlementCash:b.journal.filter(j=>j.kind==='settlement').reduce((n,j)=>n+j.amount,0),
  fundingCash:b.journal.filter(j=>j.kind==='funding').reduce((n,j)=>n+j.amount,0),
  notes:[
   'Booked recovery requirement equals recorded charges minus gross realized P&L, floored at zero; it does not forecast any future trade.',
   'Lifetime net and indicative shortfall are withheld if any open leg is unpriced, expired-unreconciled or inconsistent.',
   'Manual and stale marks make complete totals indicative rather than broker-certified.',
   'Completed settlement and funding cash are reported separately, not added to trading P&L.',
   'A cumulative lifetime charge statement includes fees through its stated coverage date; later fees are added once by the existing ledger.'
  ]};
}
const api={audit};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Portfolio=api;
})(typeof globalThis!=='undefined'?globalThis:this);
