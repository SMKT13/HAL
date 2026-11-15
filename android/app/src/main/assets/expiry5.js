/* HAL Desk 5: date-driven, read-only HAL derivative review agenda.
 * Position expiry dates come ONLY from verified/saved records.
 * No exchange holiday inference, broker cutoffs, price forecasts, or order placement.
 */
(function(root){'use strict';
const E=typeof module==='object'?require('./engine4.js'):root.HAL4Engine;
const V=typeof module==='object'?require('./risk5.js'):root.HAL5Risk;
const DAY=86400000;
function dayIndex(date){
 if(!V.validDate(date))throw Error('Invalid expiry review date');
 return Date.parse(date+'T00:00:00Z')/DAY;
}
function addDay(date){
 return new Date((dayIndex(date)+1)*DAY).toISOString().slice(0,10);
}
function sortedAlerts(alerts){
 const rank={critical:0,review:1,information:2};
 return alerts.sort((a,b)=>rank[a.severity]-rank[b.severity]||
  (a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')||
  a.code.localeCompare(b.code));
}
function agenda(book,asOfDate){
 const b=E.validateBook(book);
 const today=asOfDate==null?E.istDate():asOfDate;
 const todayDay=dayIndex(today);
 const legs=b.legs.map(l=>{
  const expiry=dayIndex(l.expiry);
  return {id:l.id,type:l.type,expiry:l.expiry,daysUntilExpiry:expiry-todayDay,
   units:E.units(l),strike:l.strike??null};
 });
 const alerts=[];
 const push=(code,severity,title,detail,date=null,units=null,action='go-risk')=>
  alerts.push({code,severity,title,detail,date,units,action});
 const grouped=new Map();
 for(const l of legs){
  const key=l.expiry+'|'+l.type,group=grouped.get(key)||{date:l.expiry,type:l.type,units:0,ids:[]};
  group.units+=l.units;group.ids.push(l.id);grouped.set(key,group);
  if(l.daysUntilExpiry<0){
   push('expired-'+l.id,'critical','Expired contract awaiting reconciliation',
    'Saved '+l.type+' '+l.expiry+' has passed. Confirm the executed close, exercise or broker settlement before treating it as an open valued position.',
    l.expiry,l.units,'go-book');
  }
 }
 const futures=legs.filter(l=>l.type==='FUT'&&l.daysUntilExpiry>=0),
  puts=legs.filter(l=>l.type==='PE'&&l.daysUntilExpiry>=0),
  futureUnits=futures.reduce((n,l)=>n+l.units,0),
  putUnits=puts.reduce((n,l)=>n+l.units,0),
  covered=Math.min(futureUnits,putUnits);
 if(futureUnits&&covered<futureUnits){
  push('uncovered-now','critical','Futures quantity lacks current put coverage',
   (futureUnits-covered)+' of '+futureUnits+' futures underlying units have no matching unexpired long-put quantity. Quantity matching alone is not a guaranteed downside floor.',
   today,futureUnits-covered);
 }
 const earliestFuture=futures.length?futures.map(l=>l.expiry).sort()[0]:null;
 for(const g of grouped.values()){
  const days=dayIndex(g.date)-todayDay;
  if(days<0)continue;
  const label=g.type==='FUT'?'futures':g.type==='PE'?'protective puts':'option contracts';
  if(days<=3){
   push('due-'+g.type+'-'+g.date,'critical',days===0?'Contract expiry recorded today':'Contract expiry in '+days+' calendar day'+(days===1?'':'s'),
    g.units+' units of '+label+' expire on '+g.date+'. Verify the broker cutoff, margin and physical-settlement/exercise obligations directly; no session-time or holiday adjustment is inferred.',
    g.date,g.units);
  }else if(days<=14){
   push('upcoming-'+g.type+'-'+g.date,'review','Upcoming '+label+' expiry',
    g.units+' underlying units are recorded to expire on '+g.date+' ('+days+' calendar days). Review broker settlement rules and any required hedge/position action before the contract expires.',
    g.date,g.units);
  }
  if(g.type==='PE'){
   const next=addDay(g.date);
   const futureAfter=futures.filter(l=>l.expiry>=next).reduce((n,l)=>n+l.units,0);
   const putAfter=puts.filter(l=>l.expiry>=next).reduce((n,l)=>n+l.units,0);
   const gap=Math.max(0,futureAfter-Math.min(putAfter,futureAfter));
   if(gap>0){
    push('gap-after-'+g.date,'review','Protection gap after put expiry',
     'From '+next+', '+gap+' futures units would have no matching remaining put quantity, assuming the saved positions are otherwise unchanged. Review before '+g.date+'; no future hedge purchase is assumed.',
     g.date,gap,'go-hedge');
   }
  }
 }
 if(earliestFuture&&puts.some(p=>p.expiry>earliestFuture)){
  const excess=puts.filter(l=>l.expiry>earliestFuture).reduce((n,l)=>n+l.units,0);
  push('put-after-future','review','Put contracts may outlast futures',
   excess+' put units have recorded expiry later than at least one futures contract. These may become standalone positions after that future expires; verify expiry-by-expiry.',
   earliestFuture,excess);
 }
 if(futureUnits){
  const funds=b.funding||{},r=b.riskProfile||{};
  if(funds.margin==null||funds.free==null){
   push('funding-unknown','review','Margin and liquidity snapshot not recorded',
    'Future positions exist but a manually recorded margin or available-funds figure is missing. Verify the current broker margin and physical-settlement cash requirements; the app does not estimate them.',
    null,null,'go-book');
  }else{
   const at=typeof funds.at==='string'&&funds.at?Date.parse(funds.at):NaN;
   const fundingDate=Number.isFinite(at)?new Date(at+19800000).toISOString().slice(0,10):null;
   if(fundingDate!==today){
    push('funding-stale','review','Recorded funding snapshot needs verification',
     'The available-funds/margin figures are manual observations from '+(fundingDate||'an unknown date')+'. They are not verified broker balances for '+today+'.',
     null,null,'go-book');
   }
   if(funds.free===0){
    push('funding-zero','review','No available funds in recorded snapshot',
     'The manually recorded available-funds balance is zero. Check the broker account before assuming sufficient cash for margin, exercise or physical settlement.',
     null,null,'go-book');
   }
   if(typeof r.reserve==='number'&&Number.isFinite(r.reserve)&&funds.free<r.reserve){
    push('reserve-below-limit','review','Available funds below your saved reserve',
     'Recorded available funds are below the user-entered reserve threshold. This is not a broker margin calculation.',
     null,null,'go-risk');
   }
  }
 }
 const confirmed=!!b.riskProfile?.confirmedAt&&!!b.riskProfile?.confirmedBook;
 if(legs.length&&!confirmed){
  push('broker-confirmation','review','Position book not broker-confirmed',
   'Check recorded entry prices, units and expiries against the broker before relying on an automated review or scenario.',
   null,null,'confirm');
 }
 const all=sortedAlerts(alerts);
 return {asOf:today,nextExpiry:legs.filter(l=>l.daysUntilExpiry>=0).map(l=>l.expiry).sort()[0]||null,
  futureUnits,putUnits,covered,uncovered:Math.max(0,futureUnits-covered),
  expiredCount:legs.filter(l=>l.daysUntilExpiry<0).length,
  alerts:all,needsReview:all.some(x=>x.severity==='critical'||x.severity==='review'),
  caveats:[
   'Calendar days, not market sessions. Actual last trading date, holiday adjustments and broker cutoffs must be verified independently.',
   'Physical settlement/exercise and margin cash requirements cannot be inferred from contract quantities alone.',
   'Recorded dates and units are used without guessing current positions, prices or exchange trades.',
   'Alerts are review prompts and never place, cancel or recommend a specific live order.'
  ]};
}
const api={agenda};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Expiry=api;
})(typeof globalThis!=='undefined'?globalThis:this);
