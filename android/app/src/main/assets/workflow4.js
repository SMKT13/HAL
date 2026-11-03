/* Daily workflows compose the finance engine; they never change holdings or place orders. */
(function(root){
'use strict';
const E=typeof module!=='undefined'&&module.exports?require('./engine4.js'):root.HAL4Engine;
const I=typeof module!=='undefined'&&module.exports?require('./insights4.js'):root.HAL4Insights;

function latestReview(candidates,now=Date.now()){
 return (candidates||[]).filter(c=>c&&c.version===4&&typeof c.bookRevision==='string'&&
  Number.isFinite(Date.parse(c.savedAt))&&Date.parse(c.savedAt)<=now&&
  Number.isFinite(Date.parse(c.quoteAsOf))&&Date.parse(c.quoteAsOf)<=now+5000)
  .sort((a,b)=>Date.parse(b.savedAt)-Date.parse(a.savedAt))[0]||null;
}
function canCaptureReview(input,now=Date.now()){
 const v=input.valuation||{};
 return !!input.book?.legs?.length&&v.complete===true&&!v.manual&&!v.stale&&
  !input.market?.failure&&!input.market?.failureReason&&
  E.quoteQuality(input.market?.spot,{now,requireFresh:true,requireTrade:true}).valid&&
  (v.rows||[]).length===input.book.legs.length&&
  v.rows.every(r=>r.mark?.source!=='Manual'&&r.mark?.status==='current'&&
   E.quoteQuality(r.mark.quote,{now,requireFresh:true,requireTrade:true}).valid);
}
function strategy(book,market,now=Date.now()){
 const risk=E.risk(book,market,now),valuation=E.ledger(book,market,{now});
 const puts=risk.distribution.slice().sort((a,b)=>a.expiry.localeCompare(b.expiry));
 const nextPutExpiry=puts[0]?.expiry||null;
 const afterProtection=nextPutExpiry?risk.timeline.find(t=>t.date===nextPutExpiry):null;
 return {risk,valuation,nextPutExpiry,afterProtection,puts,
  explanation:risk.futureUnits?`${risk.coveredUnits} of ${risk.futureUnits} futures units have matching put quantity today.`:
   risk.putUnits?`${risk.putUnits} put units are held without active futures.`:'No active futures or puts.',
  caveat:'Matching quantity is not a guaranteed loss limit. Strike, futures basis and expiry affect the outcome.'};
}
function priority(input,configured,now=Date.now()){
 const {book,valuation={},risk={},market={}}=input;
 if(!book?.legs?.length)return {title:'Set up your position',detail:'Record your actual HAL futures and puts to see their combined exposure.',action:'add',label:'Add first position'};
 if(!configured)return {title:'Connect market prices',detail:'Your saved positions are available offline. Connect Upstox to value exact contracts.',action:'connection',label:'Connect Upstox'};
 if(market.failure||market.lastFailure&&(!market.lastSuccess||Date.parse(market.lastFailure)>Date.parse(market.lastSuccess)))return {title:'Refresh your prices',detail:'The last refresh failed. Retained observations have not become live prices.',action:'retry-prices',label:'Retry prices'};
 if(!valuation.complete)return {title:'Complete your position prices',detail:'A saved contract is missing a usable mark. Review its expiry, strike and lot size.',action:'review-contracts',label:'Review missing prices'};
 const urgent=['expired','loss_limit','lower_review','upper_review','reserve','near_expiry','expiry_gap','quantity_gap','overhedged'];
 const warning=urgent.map(code=>(risk.warnings||[]).find(w=>w.code===code)).find(Boolean);
 if(warning)return {...warning,action:warning.code==='expired'?'go-book':'go-risk',label:warning.code==='expired'?'Review open contracts':'Review protection'};
 if(!I.isBookConfirmed(book,now))return {title:'Confirm your recorded position',detail:'Check entries and quantities against your broker so planning starts with the right book.',action:'confirm',label:'Check my position'};
 if(valuation.stale||!E.quoteQuality(market.spot,{now,requireFresh:true,requireTrade:true}).valid)return {title:'Prices need an update',detail:'Review the source times before comparing changes or modelling your position.',action:'retry-prices',label:'Refresh prices'};
 return {title:'Review your downside',detail:'Explore a lower HAL price using your saved position and explicit model assumptions.',action:'quick-fall',label:'Explore a 5% fall'};
}

// Both alternatives use the same scenario price, horizon, IV and basis. Compare
// future changes from current marks, not entry-based P&L of different quantities.
function compareReduction(book,market,params,legId,lots,exitCosts=0,now=Date.now()){
 const original=E.validateBook(book),leg=original.legs.find(l=>l.id===legId);
 if(!leg||leg.type!=='FUT'||!Number.isInteger(lots)||lots<1||lots>leg.lots)throw Error('Choose a futures contract and a whole number of lots to reduce.');
 if(!E.finite(exitCosts)||exitCosts<0)throw Error('Enter non-negative exit charges and slippage.');
 const reduced=E.validateBook(original);
 reduced.legs=reduced.legs.map(l=>l.id===legId?{...l,lots:l.lots-lots}:l).filter(l=>l.lots>0);
 const evaluate=(b,cost)=>{
  const valuation=E.ledger(b,market,{now}),result=E.scenario(b,market,params,now);
  const errors=[...result.errors];
  if(!valuation.complete)errors.push('Current marks are required to compare additional P&L.');
  return {additional:result.complete&&valuation.complete?result.total-valuation.open-cost:null,
   entryPnl:result.total,horizon:result.horizon,errors,manual:valuation.manual,stale:valuation.stale,
   futureUnits:b.legs.filter(l=>l.type==='FUT').reduce((n,l)=>n+E.units(l),0),
   putUnits:b.legs.filter(l=>l.type==='PE').reduce((n,l)=>n+E.units(l),0)};
 };
 const current=evaluate(original,0),alternative=evaluate(reduced,exitCosts);
 // A comparison must not silently show just the alternative when the original
 // crosses an expiry or is missing prices.
 const complete=E.finite(current.additional)&&E.finite(alternative.additional);
 return {current,alternative,complete,removedUnits:lots*leg.lotSize,exitCosts,
  difference:complete?alternative.additional-current.additional:null,
  assumptions:['Additional P&L is the change from current marks to the same scenario horizon.',
   'Reduction assumes the recorded current futures mark as the exit reference; entered costs are deducted once.',
   'All existing puts remain held. Their quantity may exceed the remaining futures.',
   'No trade, settlement or journal entry is recorded. Model outcomes are not execution quotes.']};
}

const drivers=[
 {id:'orders',title:'Order book',question:'Are new orders translating into a funded, executable backlog?',pattern:/order|backlog|contract|procurement/i},
 {id:'deliveries',title:'Deliveries & execution',question:'Are aircraft, helicopter and engine deliveries keeping pace with guidance?',pattern:/deliver|production|engine|tejas|helicopter|execution|delay/i},
 {id:'margins',title:'Revenue & margins',question:'Is revenue growth converting into sustainable operating profit?',pattern:/revenue|margin|profit|earnings|results|income/i},
 {id:'cash',title:'Cash conversion',question:'Are earnings converting to operating cash, with receivables under control?',pattern:/cash|receivable|working.capital|debt/i}
];
function businessReview(notes,articles,now=Date.now()){
 const safeNews=I.newsGroups(articles),today=E.istDate(now);
 return {drivers:drivers.map(d=>({...d,
  notes:(notes||[]).filter(n=>d.pattern.test([n.category,n.title,n.text].join(' '))).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3),
  articles:safeNews.filter(n=>d.pattern.test(n.title+' '+(n.summary||''))).slice(0,2)})),
  events:(notes||[]).filter(n=>E.validDate(n.eventDate)&&n.eventDate>=today).slice().sort((a,b)=>a.eventDate.localeCompare(b.eventDate)).slice(0,8)};
}
const api={latestReview,canCaptureReview,strategy,priority,compareReduction,businessReview};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HAL4Workflow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
