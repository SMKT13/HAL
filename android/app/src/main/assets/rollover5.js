/* HAL Desk 5 — a conditional, read-only listed-futures rollover comparison.
 * Neither a rollover order nor a broker cash/margin estimate. Exact saved
 * contract, distinct later expiry and two timely REST bid/ask quotes required. */
(function(root){'use strict';
const E=typeof module==='object'&&module.exports?require('./engine4.js'):root.HAL4Engine;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function compare(book,market,params={},now=Date.now()){
 const b=E.validateBook(book),m=E.normalizeMarket(market);
 if(!finite(now))throw Error('Invalid model time');
 const leg=b.legs.find(l=>l.id===params.legId);
 if(!leg||leg.type!=='FUT')throw Error('Choose an open recorded HAL futures leg');
 if(E.expiryTime(leg.expiry)<now)throw Error('Reconcile expired futures before considering a replacement');
 const target=m.contracts.find(c=>c.instrumentKey===params.targetInstrumentKey&&c.type==='FUT');
 if(!target||!target.instrumentKey)throw Error('Select an exactly listed later futures contract');
 if(target.expiry<=leg.expiry||E.expiryTime(target.expiry)<=now)
  throw Error('A rollover replacement must have a later unexpired expiry');
 if(target.lotSize!==leg.lotSize)
  throw Error('Replacement contract lot size differs from the saved actual futures leg');
 const current=E.matchContract(leg,m);
 if(current.error||!current.contract)throw Error('Verify the exact saved current futures contract: '+current.error);
 if(current.contract.instrumentKey===target.instrumentKey)throw Error('Choose a distinct later futures instrument');
 if((m.contractConflicts||[]).some(k=>[current.contract.instrumentKey,target.instrumentKey].includes(k)))
  throw Error('Conflicting instrument metadata; no rollover preview can be trusted');
 const oldQ=m.quotes[current.contract.instrumentKey],nextQ=m.quotes[target.instrumentKey];
 const qa=E.quoteQuality(oldQ,{now,requireFresh:true,requireTrade:true}),
  qb=E.quoteQuality(nextQ,{now,requireFresh:true,requireTrade:true});
 if(!qa.valid||!qb.valid)throw Error('Fresh REST quotes for both exact contracts required: '+[...qa.reasons,...qb.reasons].join('; '));
 if(![oldQ?.bid,oldQ?.ask,nextQ?.bid,nextQ?.ask].every(finite)||
    oldQ.bid<=0||oldQ.ask<=0||nextQ.bid<=0||nextQ.ask<=0||
    oldQ.ask<oldQ.bid||nextQ.ask<nextQ.bid)
  throw Error('Current bid/ask depth is invalid or unavailable for one of the futures');
 const exitFees=params.exitFees??0,newFees=params.newFees??0,slippage=params.slippagePerUnit??0;
 if(![exitFees,newFees,slippage].every(v=>finite(v)&&v>=0))
  throw Error('Enter non-negative fees and slippage');
 if(slippage>=oldQ.bid)throw Error('Assumed sell slippage would make the exit price invalid');
 const qty=leg.lots*leg.lotSize;
 if(!Number.isSafeInteger(qty)||qty<=0)throw Error('Invalid exact lot quantity');
 const sellPrice=oldQ.bid-slippage,buyPrice=nextQ.ask+slippage;
 const closeGross=(sellPrice-leg.entry)*qty,closeNet=closeGross-exitFees;
 const observedSpread=nextQ.price-oldQ.price,executionSpread=buyPrice-sellPrice;
 const putThroughTarget=b.legs.filter(l=>l.type==='PE'&&l.expiry>=target.expiry)
  .reduce((n,l)=>n+l.lots*l.lotSize,0);
 const warnings=[];
 if(!finite(oldQ.bidQty)||oldQ.bidQty<qty)
  warnings.push('Current futures best-bid quantity is missing or smaller than the proposed close quantity; actual fill could differ.');
 if(!finite(nextQ.askQty)||nextQ.askQty<qty)
  warnings.push('Later futures best-ask quantity is missing or smaller than the proposed buy quantity; actual fill could differ.');
 if(putThroughTarget<qty)
  warnings.push((qty-putThroughTarget)+' of '+qty+' newly dated futures units lack matching long-put quantity through '+target.expiry+'. This does not forecast actual delta-equivalent protection.');
 if(b.legs.filter(l=>l.type==='FUT').length>1)
  warnings.push('Other futures legs also consume put coverage; this simple comparison cannot allocate overlapping hedges.');
 const result={
  complete:true,kind:'Read-only hypothetical rollover quote comparison',
  current:{id:leg.id,expiry:leg.expiry,entry:leg.entry,instrumentKey:current.contract.instrumentKey,
   bid:oldQ.bid,ask:oldQ.ask,quoteAt:oldQ.quoteAt,tradeAt:oldQ.tradeAt},
  replacement:{expiry:target.expiry,instrumentKey:target.instrumentKey,bid:nextQ.bid,ask:nextQ.ask,
   quoteAt:nextQ.quoteAt,tradeAt:nextQ.tradeAt},
  lots:leg.lots,units:qty,verifiedLotSize:leg.lotSize,
  assumedClosePrice:sellPrice,assumedNewEntryPrice:buyPrice,
  conditionalCloseGross:closeGross,conditionalCloseNetBeforePriorFees:closeNet,
  assumedNewFees:newFees,assumedExitFees:exitFees,totalAdditionalFees:exitFees+newFees,
  observedLastTradeSpread:observedSpread,
  assumedExecutableSpreadPerUnit:executionSpread,
  totalReferenceSpreadPoints:executionSpread,
  rollSpreadAcrossUnits:executionSpread*qty,
  newFuturesNotionalReference:buyPrice*qty,
  putUnitsHeldThroughNewExpiry:putThroughTarget,
  minimumUncoveredNewUnits:Math.max(0,qty-putThroughTarget),
  brokerFundingRequired:null,actualMarginCash:null,physicalSettlementCash:null,
  warnings,assumptions:[
   'Bid-side closing and ask-side opening are hypothetical; the user has not placed or executed an order.',
   'The futures price spread is NOT cash paid to roll; the new futures notional is exposure, NOT a deposit.',
   'Fees and slippage are supplied additional assumptions. Previously recorded lifetime charges are not recomputed here.',
   'Future daily variation margin, total broker margin, open/close tax and physical-delivery cash obligations remain unknown.',
   'Putting up a new later-dated future does not automatically extend existing protective puts.',
   'This is not a hedge replacement or forecast of future prices.'
  ]
 };
 return result;
}
const api={compare};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Rollover=api;
})(typeof globalThis!=='undefined'?globalThis:this);
