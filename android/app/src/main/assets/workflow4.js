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
 // Expired unreconciled derivatives take precedence over missing prices or a
 // disconnected provider. Refreshing cannot restore a contract after expiry.
 const expired=(risk.warnings||[]).find(w=>w.code==='expired');
 if(expired)return {...expired,action:'go-book',label:'Reconcile expired contract'};
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
function reviewPeriods(now=Date.now()){
 const offset=19800000,day=86400000;
 const local=new Date(now+offset);
 if(!Number.isFinite(local.getTime()))throw Error('Invalid review clock.');
 const y=local.getUTCFullYear(),m=local.getUTCMonth(),d=local.getUTCDate();
 const today=Date.UTC(y,m,d)-offset,week=today-((local.getUTCDay()+6)%7)*day,month=Date.UTC(y,m,1)-offset;
 const periods=[['since-review','Since previous checkpoint',null,now,true],['day','Previous calendar day',today-day,today,false],['week','Previous week',week-7*day,week,false],['month','Previous month',Date.UTC(y,m-1,1)-offset,month,false],['week-to-date','Week to date',week,now,true],['month-to-date','Month to date',month,now,true]];
 return periods.map(([id,label,start,end,toDate])=>({id,label,start:start===null?null:new Date(start).toISOString(),end:new Date(end).toISOString(),toDate}));
}

function reviewSummary(input,checkpoints,period='since-review',now=Date.now()){
 const bounds=reviewPeriods(now).find(p=>p.id===period);
 if(!bounds)throw Error('Choose a supported review period.');
 const saved=(checkpoints||[]).filter(c=>c?.version===4&&typeof c.bookRevision==='string'&&Number.isFinite(Date.parse(c.savedAt))&&Date.parse(c.savedAt)<=now).slice().sort((a,b)=>Date.parse(a.savedAt)-Date.parse(b.savedAt));
 const current=I.checkpoint(input,now),unique=new Map(saved.map(c=>[Date.parse(c.savedAt),c]));
 if(bounds.toDate)unique.set(now,current);
 const start=Date.parse(bounds.start),end=Date.parse(bounds.end);
 const periodPoints=[...unique.values()].filter(c=>{
   const at=Date.parse(c.savedAt);return (bounds.start===null||at>=start)&&(bounds.toDate?at<=end:at<end);
 });
 const since=period==='since-review';
 const first=since?saved.filter(c=>Date.parse(c.savedAt)<now).slice(-1)[0]:periodPoints[0];
 const last=since?current:periodPoints[periodPoints.length-1];
 const newsStart=since?Date.parse(first?.savedAt):start;
 const articles=[...(input.news||[])];for(const c of periodPoints)articles.push(...(Array.isArray(c.news)?c.news:[]));
 const uniqueArticles=new Map();
 for(const n of I.normalizeNews(articles)){
   const pub=Date.parse(n.publishedAt);
   if(!n.url||!Number.isFinite(pub)||!(pub>=newsStart)||pub>end||(!bounds.toDate&&pub===end))continue;
   const key=n.url+'|'+n.publishedAt;if(!uniqueArticles.has(key))uniqueArticles.set(key,n);
 }
 const news=I.newsGroups([...uniqueArticles.values()]).slice(0,60);
 const result={...bounds,period,start:bounds.start||first?.savedAt||null,ready:false,reason:null,completePeriodCoverage:false,
   from:first?.savedAt||null,to:last?.savedAt||null,fromQuote:first?.quoteAsOf||null,toQuote:last?.quoteAsOf||null,
   changes:{},summary:[],warnings:[],news,observations:since?(first?2:1):periodPoints.length};
 if(!first||!last||Date.parse(first.savedAt)>=Date.parse(last.savedAt)){
   result.reason=since?'Save a checkpoint to compare against a later review.':'Two distinct saved observations in this period are required for a comparison.';
   return result;
 }
 result.ready=true;
 if(!since&&(Date.parse(first.savedAt)>start||(!bounds.toDate&&Date.parse(last.savedAt)<end-1))){
   result.warnings.push('Changes use the first and last available observations within this period. Activity before or after these observations is outside the comparison.');
 }else result.completePeriodCoverage=true;
 const diff=field=>E.finite(first[field])&&E.finite(last[field])?last[field]-first[field]:null;
 const usableTime=(c,key)=>Number.isFinite(Date.parse(c[key]))&&Date.parse(c[key])<=Date.parse(c.savedAt)+5000;
 const comparableQuotes=usableTime(first,'quoteAsOf')&&usableTime(last,'quoteAsOf')&&Date.parse(last.quoteAsOf)>=Date.parse(first.quoteAsOf);
 const sameBook=Array.isArray(first.legs)&&Array.isArray(last.legs)
   ?I.canonical(first.legs)===I.canonical(last.legs)&&(first.markMode||'ltp')===(last.markMode||'ltp')
   :first.bookRevision===last.bookRevision;
 const technicalOk=[first,last].every(c=>usableTime(c,'technicalAt')&&c.technicalStale===false)&&Date.parse(first.technicalAt)<=Date.parse(last.technicalAt);
 result.sameBook=sameBook;
 const changes=result.changes;
 for(const k of ['realized','charges','net','bookedNet','coverage','futureUnits','putUnits'])changes[k]=diff(k);
 for(const k of ['margin','free'])changes[k]=usableTime(first,'fundingAt')&&usableTime(last,'fundingAt')?diff(k):null;
 changes.spot=comparableQuotes?diff('spot'):null;
 changes.open=sameBook&&first.complete&&last.complete?diff('open'):null;
 changes.rsi=technicalOk?diff('rsi'):null;changes.atr=technicalOk?diff('atr'):null;
 result.fundingAt=last.fundingAt||null;result.technicalAt=last.technicalAt||null;
 const fmt=value=>Math.abs(value).toLocaleString('en-IN',{maximumFractionDigits:2});
 if(!sameBook)result.summary.push('The saved position or mark basis changed. Open P&L movements cannot be compared on the same holdings.');
 if(E.finite(changes.bookedNet))result.summary.push(changes.bookedNet===0?'Booked P&L after recorded charges was unchanged.':'Booked P&L after recorded charges '+(changes.bookedNet>0?'improved':'fell')+' by ₹'+fmt(changes.bookedNet)+'.');
 if(E.finite(changes.futureUnits)&&changes.futureUnits!==0)result.summary.push('Futures exposure '+(changes.futureUnits>0?'increased':'decreased')+' by '+fmt(changes.futureUnits)+' underlying units.');
 if(technicalOk&&first.bias&&last.bias&&first.bias!==last.bias)result.summary.push('Recorded daily technical assessment changed from '+first.bias+' to '+last.bias+'.');
 if(!comparableQuotes)result.warnings.push('Spot change needs dated provider quotes in chronological order.');
 if(comparableQuotes&&(Date.parse(first.quoteAsOf)<Date.parse(first.savedAt)-120000||Date.parse(last.quoteAsOf)<Date.parse(last.savedAt)-120000))result.warnings.push('At least one spot observation used a quote over two minutes old.');
 if(first.marksStale||last.marksStale||first.marksManual||last.marksManual)result.warnings.push('One or both portfolio valuations include older or manual marks.');
 if(!technicalOk)result.warnings.push('Indicator changes require dated, completed and current technical observations at both endpoints.');
 if(!result.fundingAt||!usableTime(last,'fundingAt')||Date.parse(last.savedAt)-Date.parse(last.fundingAt)>86400000)result.warnings.push('The ending funding snapshot is unavailable or more than one day old.');
 if(!E.finite(changes.bookedNet))result.warnings.push('At least one checkpoint lacks a recorded realised balance or charge total.');
 return result;
}
const api={latestReview,canCaptureReview,strategy,priority,compareReduction,businessReview,reviewSummary,reviewPeriods};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HAL4Workflow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
