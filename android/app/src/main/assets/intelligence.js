/* HAL historical evidence and paper rollover economics. No execution or network. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&typeof require==='function'?require('./core.js'):root.HALCore;
const A=typeof module!=='undefined'&&typeof require==='function'?require('./analytics.js'):root.HALAnalytics;
const H=typeof module!=='undefined'&&typeof require==='function'?require('./hedge.js'):root.HALHedge;
const DAY=86400000,sum=a=>a.reduce((s,x)=>s+x,0),mean=a=>a.length?sum(a)/a.length:null,units=l=>l.lots*l.lotSize;
const median=a=>{const b=[...a].sort((x,y)=>x-y),m=b.length>>1;return b.length?b.length%2?b[m]:(b[m-1]+b[m])/2:null;};
function bookKey(b){return JSON.stringify(b.legs.map(l=>[l.type,l.expiry,l.strike,l.lots,l.lotSize,l.entry,l.manual,l.manualAt]));}
function checkpoint(book,snapshot,tech,news,now=Date.now()){
 const mtm=C.mtm(book.legs,snapshot),r=A.risk(book.legs,snapshot,now);
 return {version:1,savedAt:new Date(now).toISOString(),quoteAsOf:snapshot?.spot?.quote_as_of||null,bookKey:bookKey(book),spot:snapshot?.spot?.last_price??null,open:mtm.total,complete:mtm.complete,coverage:r.coverage,delta:r.delta,theta:r.theta,rsi:tech?.rsi??null,newsURLs:news.map(n=>A.safeURL(n.url)).filter(Boolean).slice(0,100)};
}
function changes(previous,current,news=[]){
 if(previous?.version!==1||!Number.isFinite(Date.parse(previous.savedAt)))return {ready:false,reason:'Save a comparison point to begin tracking changes.'};
 if(Date.parse(previous.savedAt)>Date.parse(current.savedAt)+60000)return {ready:false,reason:'Checkpoint time is ahead of this device. Save a new comparison point.'};
 const sameBook=previous.bookKey===current.bookKey,delta=(a,b)=>C.finite(a)&&C.finite(b)?b-a:null,urls=new Set(previous.newsURLs||[]);
 return {ready:true,sameBook,from:previous.savedAt,to:current.savedAt,fromQuote:previous.quoteAsOf,toQuote:current.quoteAsOf,spot:delta(previous.spot,current.spot),open:sameBook&&previous.complete&&current.complete?delta(previous.open,current.open):null,rsi:delta(previous.rsi,current.rsi),coverage:sameBook?delta(previous.coverage,current.coverage):null,delta:sameBook?delta(previous.delta,current.delta):null,theta:sameBook?delta(previous.theta,current.theta):null,newNews:news.filter(n=>A.safeURL(n.url)&&!urls.has(A.safeURL(n.url))).slice(0,8)};
}
function shape(rows){const v=rows.map(r=>Math.log(r.c)),m=mean(v),sd=Math.sqrt(mean(v.map(x=>(x-m)**2)));return sd>1e-10?v.map(x=>(x-m)/sd):null;}
function vol(rows){const r=rows.slice(1).map((x,i)=>Math.log(x.c/rows[i].c)),m=mean(r);return r.length>1?Math.sqrt(sum(r.map(x=>(x-m)**2))/(r.length-1)):0;}
const jump=rows=>rows.some((r,i)=>i&&Math.abs(r.c/rows[i-1].c-1)>.35);
function dtw(a,b){const n=a.length,m=b.length,band=Math.max(Math.abs(n-m),Math.ceil(Math.max(n,m)*.1));let prev=Array(m+1).fill(Infinity);prev[0]=0;for(let i=1;i<=n;i++){const row=Array(m+1).fill(Infinity);for(let j=Math.max(1,i-band);j<=Math.min(m,i+band);j++)row[j]=(a[i-1]-b[j-1])**2+Math.min(prev[j],row[j-1],prev[j-1]);prev=row;}return Math.sqrt(prev[m]/Math.max(n,m));}
function patterns(raw,options={},now=Date.now()){
 const window=options.window??40,horizon=options.horizon??20,maxMatches=options.maxMatches??10;
 if(![20,40,60,90].includes(window)||![5,10,20,40].includes(horizon)||!Number.isInteger(maxMatches)||maxMatches<1||maxMatches>15)throw Error('Choose a supported pattern window and outcome horizon.');
 const rows=A.completed(A.candles(raw),'D',now).slice(-2600),start=rows.length-window,query=rows.slice(start),qs=shape(query),qv=vol(query),matches=[];
 const out={ready:false,window,horizon,bars:rows.length,asOf:rows.at(-1)?.t??null,matches,query:query.map(r=>({t:r.t,c:r.c})),stats:null,excluded:0,method:'Banded DTW on log-price shapes; matching direction, volatility ratio 0.5–2 and 50-bar trend. Selected pattern plus outcome windows never overlap.'};
 if(start<window+horizon+50){out.reason='More completed daily history is needed for separated pattern and outcome windows.';return out;}
 if(now-rows.at(-1).t>7*DAY){out.reason='Latest completed daily bar is over seven days old. Refresh history.';return out;}
 if(!qs||qv<=1e-10||jump(query)){out.reason='The current window is flat or crosses a large price discontinuity. Review corporate actions and history.';return out;}
 const direction=query.at(-1).c>=query[0].c,trend=rows.at(-1).c>=mean(rows.slice(-50).map(r=>r.c)),candidates=[];
 for(let end=window+49;end+horizon<start;end++){
  const segment=rows.slice(end-window+1,end+1),future=rows.slice(end+1,end+horizon+1),v=vol(segment);
  if(jump(rows.slice(end-window+1,end+horizon+1))||v<=1e-10||v/qv<.5||v/qv>2||(segment.at(-1).c>=segment[0].c)!==direction||(rows[end].c>=mean(rows.slice(end-49,end+1).map(r=>r.c)))!==trend){out.excluded++;continue;}
  const s=shape(segment);if(!s)continue;const distance=dtw(qs,s);if(distance>.65){out.excluded++;continue;}
  const entry=rows[end].c;let peak=entry,drawdown=0;for(const r of future){drawdown=Math.min(drawdown,(r.c/peak-1)*100);peak=Math.max(peak,r.c);}
  candidates.push({start:end-window+1,end:end+horizon,patternEnd:end,date:rows[end].t,distance,volRatio:v/qv,returnPct:(future.at(-1).c/entry-1)*100,favorablePct:Math.max(0,(Math.max(...future.map(r=>r.h))/entry-1)*100),adversePct:Math.min(0,(Math.min(...future.map(r=>r.l))/entry-1)*100),drawdownPct:drawdown,closes:segment.map(r=>r.c)});
 }
 candidates.sort((a,b)=>a.distance-b.distance||a.date-b.date);for(const c of candidates){if(matches.every(m=>c.end<m.start||c.start>m.end))matches.push(c);if(matches.length>=maxMatches)break;}
 out.ready=true;if(!matches.length){out.reason='No sufficiently similar, non-overlapping historical matches passed the filters.';return out;}
 const returns=matches.map(m=>m.returnPct);out.stats={count:matches.length,mean:mean(returns),median:median(returns),worst:Math.min(...returns),best:Math.max(...returns),positivePct:returns.filter(x=>x>0).length/matches.length*100,worstAdverse:Math.min(...matches.map(m=>m.adversePct))};
 out.reason=matches.length<5?'Small selected sample: historical frequencies are especially unstable.':'Selected historical outcomes are observations, not a forecast probability.';return out;
}
const rollPreferences=A.rollPreferences;
function rollover(book,snapshot,chains,settings,now=Date.now(),unavailable=[]){
 const s=rollPreferences(settings),errors=[],warnings=[],routes=[],out={settings:s,errors,warnings,routes,validUntil:null,sourceTime:snapshot?.fetched_at_iso||null};
 const futures=book.legs.filter(l=>l.type==='FUT'),puts=book.legs.filter(l=>l.type==='PE');
 if(!futures.length)throw Error('Save your actual futures book first. No sample position is assumed.');C.validate(book.legs);
 if(book.legs.some(l=>A.expiryTime(l.expiry)<=now))throw Error('Review expired positions before planning a rollover.');
 if(!s.from||!s.to||!s.putExpiry||!s.lots)throw Error('Choose current and destination futures, put expiry and target lots.');
 if(futures.some(l=>l.expiry!==s.from))throw Error('This planner needs one current futures expiry. Review a multi-expiry book separately.');
 if(s.to<=s.from||s.putExpiry<=s.from)throw Error('Choose later active futures and protection expiries.');
 const from=snapshot?.futures?.find(f=>f.expiry===s.from),to=snapshot?.futures?.find(f=>f.expiry===s.to),chain=chains[s.putExpiry],spot=snapshot?.spot?.last_price,currentUnits=sum(futures.map(units));
 out.currentUnits=currentUnits;out.gapDays=Math.max(0,(A.expiryTime(s.to)-A.expiryTime(s.putExpiry))/DAY);
 if(out.gapDays)warnings.push('Protection ends '+Math.round(out.gapDays)+' calendar days before the new futures. Later losses and replacement premiums are unknown.');
 if(s.putExpiry>s.to)warnings.push('The put outlives the futures. Residual value is unknown; an exact expiry loss floor is withheld.');
 if(!snapshot||snapshot.researchUnavailable||!H.fresh(snapshot.spot?.quote_as_of,now)||!H.fresh(snapshot.spot?.last_trade_at,now)||!C.finite(spot)||spot<=0)errors.push('Refresh spot during the market session. A quote and trade within two minutes are required.');
 if(!Number.isInteger(from?.lot_size)||!Number.isInteger(to?.lot_size)||to.lot_size<=0||futures.some(l=>l.lotSize!==from?.lot_size))errors.push('Verify current and destination contract lot sizes.');
 const check=(q,qty,side,label)=>{const why=H.quoteIssues(q,now,s,qty,side);if(why.length)errors.push(label+': '+why.join('; '));};check(from?.quote,currentUnits,'bid','Current futures');
 const old=puts.map(l=>({leg:l,chain:chains[l.expiry],option:chains[l.expiry]?.option_rows?.find(r=>r.strike===l.strike)?.put}));
 for(const r of old){const qty=sum(puts.filter(l=>l.expiry===r.leg.expiry&&l.strike===r.leg.strike).map(units));if(r.chain?.option_expiry!==r.leg.expiry||r.option?.lot_size!==r.leg.lotSize||unavailable.includes(r.leg.expiry)||r.chain?.chain_error||!H.fresh(r.chain?.quotes_fetched_at,now)||!H.fresh(r.chain?.fetched_at_iso,now))errors.push('Refresh and verify existing '+r.leg.strike+' put ('+r.leg.expiry+').');check(r.option?.quote,qty,'bid','Existing '+r.leg.strike+' put');}
 if(!chain||chain.option_expiry!==s.putExpiry||chain.chain_error||unavailable.includes(s.putExpiry)||!H.fresh(chain.fetched_at_iso,now)||!H.fresh(chain.quotes_fetched_at,now)||!chain.option_rows?.length)errors.push('Refresh full put quotes for the selected protection expiry.');
 if(s.budget===null||s.maxLoss===null)warnings.push('Enter a premium budget and maximum additional expiry loss before identifying qualifying choices.');
 if(s.requiredMargin===null||s.cashReserve===null||s.cashAvailable===null)warnings.push('Funding is unverified. Enter cash after closing the current basket, incremental margin per new lot and a separate reserve.');
 if(!s.exitFees||!s.entryFees)warnings.push('Zero charges omit relevant brokerage, taxes and fees. Enter total estimates for each route.');
 if(errors.length)return out;
 const fs=s.slippage/100,ps=s.optionSlippage/100,oldBid=from.quote.bid,exit=oldBid*(1-fs),putBid=sum(old.map(r=>r.option.quote.bid*units(r.leg))),putProceeds=putBid*(1-ps);
 const oldExitPnl=sum(futures.map(l=>(exit-l.entry)*units(l)))+sum(old.map(r=>(r.option.quote.bid*(1-ps)-r.leg.entry)*units(r.leg))),friction=(oldBid-exit)*currentUnits+putBid-putProceeds+s.exitFees,ledger=A.ledger(book,snapshot);
 Object.assign(out,{oldExitPnl,oldPutProceeds:putProceeds,closeFriction:friction,futuresCarryPoints:to.quote?.ask>0?to.quote.ask-oldBid:null});
 const quoted=q=>[Date.parse(q.quote_as_of)+120000,Date.parse(q.last_trade_at)+900000];
 const deadlines=[Date.parse(snapshot.spot.quote_as_of)+120000,Date.parse(snapshot.spot.last_trade_at)+120000,A.expiryTime(s.from),...quoted(from.quote),Date.parse(chain.fetched_at_iso)+120000,Date.parse(chain.quotes_fetched_at)+120000,...old.flatMap(r=>[...quoted(r.option.quote),Date.parse(r.chain.fetched_at_iso)+120000,Date.parse(r.chain.quotes_fetched_at)+120000])];
 routes.push({label:'Close current basket',lots:0,units:0,premium:0,newHedgeCost:0,additionalLoss:friction,oldExitPnl,netStrategy:ledger.realized-ledger.charges+oldExitPnl-s.exitFees,candidates:[]});
 for(const lots of [...new Set([1,s.lots])]){
  const qty=lots*to.lot_size,route={label:lots===1?'Roll one futures lot':'Roll '+lots+' futures lots',lots,units:qty,candidates:[],excluded:[],recommended:null};routes.push(route);
  const why=H.quoteIssues(to.quote,now,s,qty,'ask');if(why.length){route.errors=why;continue;}deadlines.push(...quoted(to.quote));const entry=to.quote.ask*(1+fs);route.futureEntry=entry;route.carryEquivalent=C.finite(out.futuresCarryPoints)?out.futuresCarryPoints*qty:null;
  for(const row of chain.option_rows){const o=row.put,q=o?.quote,why=H.quoteIssues(q,now,s,qty,'ask');if(!Number.isInteger(o?.lot_size)||o.lot_size<=0||qty%o.lot_size!==0)why.push('Whole put lots cannot cover the exact futures units');if(!C.finite(row.strike)||row.strike<=0)why.push('Invalid strike');if(why.length){route.excluded.push({strike:row.strike,reasons:why});continue;}
   deadlines.push(...quoted(q));const putEntry=q.ask*(1+ps),premium=putEntry*qty,newHedgeCost=premium+s.entryFees,matched=s.putExpiry===s.to,terminalLoss=matched?Math.max(0,(entry-row.strike+putEntry)*qty+s.entryFees+friction):null,cashNeeded=s.requiredMargin===null||s.cashReserve===null?null:s.requiredMargin*lots+newHedgeCost+s.cashReserve,limits=[];
   if(s.budget===null||s.maxLoss===null)limits.push('Loss limit or premium budget missing');if(s.budget!==null&&newHedgeCost>s.budget)limits.push('Above new-hedge budget');if(terminalLoss===null)limits.push('Expiries differ: full-horizon loss limit cannot be verified');else if(s.maxLoss!==null&&terminalLoss>s.maxLoss)limits.push('Above additional expiry-loss limit');if(cashNeeded===null||s.cashAvailable===null)limits.push('Funding inputs missing');else if(cashNeeded>s.cashAvailable)limits.push('Above available cash under entered margin/reserve assumptions');
   const scenarios=[0,-3,-5,-10].map(shock=>{const price=spot*(1+shock/100),futureExit=matched?price:s.putExpiry<s.to?to.quote.last_price+price-spot:null;return {shock,price,at:s.putExpiry,pnl:C.finite(futureExit)?(futureExit-entry)*qty+(Math.max(row.strike-price,0)-putEntry)*qty-s.entryFees-friction:null};});
   route.candidates.push({id:lots+':'+s.putExpiry+':'+row.strike,strike:row.strike,expiry:s.putExpiry,putLots:qty/o.lot_size,lotSize:o.lot_size,premium,newHedgeCost,additionalLoss:terminalLoss,cashNeeded,limits,scenarios,quoteAsOf:q.quote_as_of,putEntry,netStrategyAtFloor:matched?ledger.realized-ledger.charges+oldExitPnl-s.exitFees+(row.strike-entry-putEntry)*qty-s.entryFees:null});
  }
  route.candidates.sort((a,b)=>a.newHedgeCost-b.newHedgeCost||a.additionalLoss-b.additionalLoss||b.strike-a.strike);route.recommended=route.candidates.find(c=>!c.limits.length)||null;
 }
 out.validUntil=Math.min(...deadlines);return out;
}
const api={bookKey,checkpoint,changes,patterns,dtw,rollPreferences,rollover};if(typeof module!=='undefined'&&typeof require==='function')module.exports=api;root.HALIntelligence=api;
})(typeof globalThis!=='undefined'?globalThis:this);
