/* Position-centred review. Pure calculations; no execution or network access. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&typeof require==='function'?require('./core.js'):root.HALCore;
const A=typeof module!=='undefined'&&typeof require==='function'?require('./analytics.js'):root.HALAnalytics;
const {finite}=C,DAY=86400000,units=l=>l.lots*l.lotSize;
const recent=(stamp,now,limit)=>{const age=now-Date.parse(stamp);return finite(age)&&age>=-60000&&age<=limit;};
// Excludes presentation/mark settings. Quantity, contract and cost-basis edits invalidate confirmation.
function bookKey(legs){return JSON.stringify(legs.map(l=>[l.type,l.expiry,l.strike??null,l.lots,l.lotSize,l.entry]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));}
// One immutable valuation view for Today, My Position, ledger, scenarios and AI.
// Keep full contract timestamps intact: retrieving a fresh spot never refreshes an option.
function valuation(base,packets={},legs=[],{failed=[],pending=[],lastFailed=false,now=Date.now()}={}){
 if(!base)return null;
 const out={...base,chains:{...(base.chains||{})},futures:(base.futures||[]).map(f=>({...f}))};
 const held=[...new Set(legs.filter(l=>l.type==='PE').map(l=>l.expiry))];
 const sane=t=>Number.isFinite(Date.parse(t))&&Date.parse(t)<=now+60000;
 for(const expiry of held){
  const full=packets[expiry];if(!full||full.option_expiry!==expiry||full.chain_error||!Array.isArray(full.option_rows)||!sane(full.fetched_at_iso)||!sane(full.quotes_fetched_at))continue;
  const previous=base.option_expiry===expiry?base:base.chains?.[expiry];
  const required=legs.filter(l=>l.type==='PE'&&l.expiry===expiry);
  const previousFull=required.every(l=>previous?.option_rows?.find(r=>r.strike===l.strike)?.put?.quote);
  // A newer basic chain does not erase a previously retrieved full quote or its age.
  if(!previousFull||!sane(previous?.quotes_fetched_at||previous?.fetched_at_iso)||Date.parse(full.quotes_fetched_at)>Date.parse(previous?.quotes_fetched_at||previous?.fetched_at_iso||'')){
   const chain={...full};out.chains[expiry]=chain;
   if(base.option_expiry===expiry){out.option_rows=chain.option_rows;out.optionChainFetchedAt=chain.fetched_at_iso;out.optionQuotesFetchedAt=chain.quotes_fetched_at;out.chain_error=chain.chain_error;}
  }
  out.futures=out.futures.map(f=>{
   const candidate=(full.futures||[]).find(c=>c.expiry===f.expiry);
   if(!candidate||candidate.lot_size!==f.lot_size||!sane(candidate.quote?.quote_as_of))return f;
   if(!sane(f.quote?.quote_as_of)||Date.parse(candidate.quote.quote_as_of)>Date.parse(f.quote?.quote_as_of||''))return {...candidate,quotes_fetched_at:full.fetched_at_iso};
   return f;
  });
 }
 out.failedExpiries=[...new Set([...failed,...pending])].filter(d=>held.includes(d));
 out.researchUnavailable=lastFailed;
 return out;
}
function context(legs,news=[],financials=null,{now=Date.now(),newsHealth={},filingsHealth={},fundamentalHealth={}}={}){
 const ageState=(h,ttl)=>h.pending?'refreshing':h.failed?'previous copy':!recent(h.at,now,ttl)?'older / unavailable':h.partial?'partial feed':'recently retrieved';
 const futures=legs.filter(l=>l.type==='FUT'&&A.expiryTime(l.expiry)>=now).reduce((n,l)=>n+units(l),0);
 const puts=legs.filter(l=>l.type==='PE'&&A.expiryTime(l.expiry)>=now).reduce((n,l)=>n+units(l),0);
 const topics={
  MoU:['Potential future business','Check whether a binding contract has been signed, and distinguish approvals from executable orders.'],
  Orders:['Order visibility and execution','Verify signed value, delivery schedule, scope and whether the order was already disclosed.'],
  Results:['Earnings and cash generation','Compare matching year-on-year periods, operating margins, receivables and cash conversion.'],
  Operations:['Delivery and production timing','Check confirmed delivery schedules, engine availability and whether a delay changes revenue timing.'],
  Sector:['Defence-sector and policy context','Check the primary policy or budget document and whether it applies directly to HAL.'],
  Market:['Price-sensitive market context','Check the underlying source and whether the information adds anything beyond price movement.']
 };
 const items=A.groupNews(news.filter(n=>A.safeURL(n.url))).slice(0,8).map(g=>{
  const n=[g.item,...g.related].find(x=>x.official)||g.item,topic=A.topic(n.title+' '+(n.summary||''));
  const uncertain=/rumou?r|unconfirmed|reportedly|may (?:get|win|receive)|likely to|sources say/i.test(n.title+' '+(n.summary||''));
  const published=Number.isFinite(Date.parse(n.published))&&Date.parse(n.published)<=now+60000?n.published:null;
  return {title:String(n.title).slice(0,500),url:A.safeURL(n.url),source:n.source||'Official filing feed',published,topic,official:!!n.official,
   state:ageState(n.official?filingsHealth:newsHealth,1800000),evidence:uncertain?'Unconfirmed wording — verify the original source':n.official?'Official feed item — read the underlying disclosure':'Reported headline — verify against primary disclosures',
   development:topics[topic][0],verify:topics[topic][1],affected:futures?futures+' long futures units; '+puts+' put units recorded':'HAL research; no active futures recorded',
   positionLink:futures?'A change in HAL’s business outlook can affect the long position. Protective puts act through strike, remaining time and volatility; they do not remove all cash-flow risk.':'Review the business evidence before linking it to a position.',
   priceImpact:null,relatedSources:g.related.length};
 });
 const summary=A.financialSummary(financials),sameProfit=summary.profit?.period===summary.revenue?.period;
 return {items,newsState:ageState(newsHealth,1800000),filingsState:ageState(filingsHealth,1800000),
  business:{state:ageState(fundamentalHealth,21600000),retrievedAt:fundamentalHealth.at||null,partial:!!fundamentalHealth.partial,
   basis:financials?.income?.type||'Reporting basis unavailable',period:summary.revenue?.period||null,revenue:summary.revenue?.value??null,profit:sameProfit?summary.profit?.value??null:null,
   margin:summary.margin??null,operatingMargin:summary.opMargin??null,cash:summary.cash?.value??null,cashPeriod:summary.cash?.period||null,cashConversion:summary.conversion??null},
  limitations:'Topic matching gives review prompts, not a verified event-to-price forecast. Feed coverage is incomplete; absence of an item does not mean no development exists.'};
}
function legState(l,s,now){
 const chain=s?.option_expiry===l.expiry?s:s?.chains?.[l.expiry];
 const contract=l.type==='FUT'?(s?.futures||[]).find(f=>f.expiry===l.expiry):A.optionFor(l,s);
 const lot=l.type==='FUT'?contract?.lot_size:contract?.lot_size;
 const q=l.type==='FUT'?contract?.quote:contract?.quote;
 const m=C.mark(l,s),expired=A.expiryTime(l.expiry)<now;
 const failed=s?.researchUnavailable||(l.type==='PE'&&(s?.failedExpiries?.includes(l.expiry)||chain?.chain_error));
 let status='current',reason='Timestamped provider mark';
 if(expired){status='unavailable';reason='Expired leg: record the actual close or settlement';}
 else if(lot!==l.lotSize){status='unavailable';reason=finite(lot)?'Listed units per lot differ from the saved book':'Contract units have not been verified by this feed';}
 else if(!finite(m.price)){status='unavailable';reason='Contract mark unavailable';}
 else if(failed){status='saved';reason='Refresh failed or is pending; previous mark retained';}
 else if(finite(l.manual)){status='saved';reason='Manual mark; provider freshness does not verify it';}
 else if(!recent(l.type==='PE'?(s?.option_expiry===l.expiry?s?.optionQuotesFetchedAt||s?.quotes_fetched_at||chain?.fetched_at_iso:chain?.quotes_fetched_at||chain?.fetched_at_iso):contract?.quotes_fetched_at||s?.fetched_at_iso,now,120000)||!recent(q?.quote_as_of,now,120000)||!recent(q?.last_trade_at,now,900000)){
  status='saved';reason='Older or missing contract timestamps; saved planning only';
 }
 return {type:l.type,expiry:l.expiry,strike:l.strike??null,units:units(l),status,reason,mark:m.price,source:m.source,quoteAt:q?.quote_as_of||null,tradeAt:q?.last_trade_at||null,manualAt:l.manualAt||null};
}
function review(book,s,{now=Date.now(),technical=null,refreshing=false}={}){
 const profile=A.riskProfile(book.riskProfile),legs=book.legs,active=legs.filter(l=>A.expiryTime(l.expiry)>=now),risk=A.risk(legs,s,now),ledger=A.ledger(book,s);
 const states=legs.map(l=>legState(l,s,now));
 const spot=s?.spot?.last_price;
 const spotCurrent=finite(spot)&&spot>0&&!s?.researchUnavailable&&!refreshing&&recent(s?.fetched_at_iso,now,120000)&&recent(s?.spot?.quote_as_of,now,120000)&&recent(s?.spot?.last_trade_at,now,120000);
 const dataMode=!s||!finite(spot)||spot<=0||states.some(l=>l.status==='unavailable')?'unavailable':spotCurrent&&states.every(l=>l.status==='current')?'current':'saved';
 const confirmed=legs.length>0&&profile.confirmedBook===bookKey(legs)&&recent(profile.confirmedAt,now,DAY);
 const fundingCurrent=finite(book.funding.free)&&recent(book.funding.at,now,DAY);
 const events=[];
 const add=(id,level,title,detail,affected,evidence,action)=>events.push({id,level,title,detail,affected,evidence,action});
 if(!legs.length)add('empty','setup','Add your current open position','Save the actual contracts, quantities and entries before reviewing exposure.','Open book','No broker position sync; records are manual.','book');
 else if(!confirmed)add('confirm','setup','Confirm your saved book','Check the contracts and quantities against your broker. Confirmation lasts 24 hours and resets after a position edit.','All saved legs',profile.confirmedAt?'Last confirmed '+profile.confirmedAt:'No book confirmation recorded.','book');
 if(legs.length&&dataMode!=='current')add('data','data',dataMode==='saved'?'Saved planning snapshot':'Position data incomplete','Structural checks remain available. Full-basket loss triggers are withheld; a fresh spot price can still trigger your saved price levels.','All price-dependent checks','Each contract needs verified units and its own timestamps. A recent spot price alone is insufficient.','data');
 for(const [i,w]of risk.warnings.entries())if(w.title!=='Greeks incomplete')add('structure-'+i,'review',w.title,w.detail,'Active futures and protective puts','Saved contract quantities and expiries; not a broker settlement instruction.','risk');
 const futures=active.filter(l=>l.type==='FUT');
 const notional=states.filter(l=>l.type==='FUT');
 const futuresNotional=notional.length&&notional.every(l=>l.status!=='unavailable'&&finite(l.mark))?notional.reduce((v,l)=>v+l.mark*l.units,0):null;
 const protection=active.filter(l=>l.type==='PE').map(l=>({strike:l.strike,expiry:l.expiry,units:units(l),distancePct:finite(spot)&&spot>0?(spot-l.strike)/spot*100:null}));
 // Reprice both base and shock through the same model. Observed premium/model differences
 // must not appear as an instantaneous profit or loss in the scenario change.
 let scenarios=[],scenarioError=null;
 if(legs.length&&dataMode!=='unavailable')try{
  if(s?.researchUnavailable||refreshing||s?.failedExpiries?.some(d=>legs.some(l=>l.type==='PE'&&l.expiry===d)))throw Error('Refresh is pending or failed. Restore the required position feeds before modelling.');
  const base=A.scenario(legs,s,{spot,days:0,ivShift:0},now);
  scenarios=[-3,-5,-10].map(shock=>{
   const result=A.scenario(legs,s,{spot:spot*(1+shock/100),days:0,ivShift:0},now);
   const futuresCashLoss=futures.reduce((v,l)=>v+units(l)*spot*(-shock/100),0);
   return {shock,spot:spot*(1+shock/100),modelChange:result.total-base.total,futuresCashLoss,
    cashAfterReserve:fundingCurrent&&finite(profile.reserve)?book.funding.free-profile.reserve-futuresCashLoss:null};
  });
 }catch(error){scenarioError=error.message;}
 else scenarioError=legs.length?'A complete, contract-verified saved snapshot is required.':'Add an open book first.';
 if(legs.length&&!fundingCurrent)add('funding','setup','Update your funding snapshot','Save free funds and margin from the broker before assessing cash stress. The desk uses a snapshot for at most 24 hours.','Futures cash flow','Funding is entered manually; hedge value is not assumed to be available as cash.','funding');
 if(legs.length&&profile.reserve===null)add('reserve','setup','Set a cash reserve','Enter the cash amount you want to keep untouched. Cash headroom stays unknown until this is set.','Funding buffer','Your own limit, not an exchange margin estimate.','profile');
 const cashStress=scenarios.find(x=>finite(x.cashAfterReserve)&&x.cashAfterReserve<0);
 if(cashStress)add('cash-stress','review','Futures stress exceeds available buffer','The '+cashStress.shock+'% price scenario uses more than free cash less your reserve. Review funding or position size.','Long futures','One-for-one futures cash-loss estimate; no put sale credit. This does not estimate additional margin or the full path.','scenario');
 if(legs.length&&profile.maxLoss===null)add('loss-limit','setup','Set a strategy loss limit','Enter the maximum loss from recorded entry costs that you want to review. This is separate from drawdown from a high-water mark.','Whole strategy','Open and realised P&L less recorded charges, with no double counting of settlement cash.','profile');
 if(confirmed&&dataMode==='current'&&finite(profile.maxLoss)&&finite(ledger.net)&&ledger.net<=-profile.maxLoss)add('loss-breach','review','Strategy loss limit reached','Recorded net strategy P&L has reached your saved loss threshold. Compare reducing exposure, changing protection or closing in the paper planners.','Open and realised strategy','Net P&L includes recorded charges once. This is a review trigger, never an order.','plan');
 if(confirmed&&spotCurrent)for(const [k,crossed,label]of [['reviewBelow',spot<=profile.reviewBelow,'Lower'],['reviewAbove',spot>=profile.reviewAbove,'Upper']])if(finite(profile[k])&&crossed)add(k,'review',label+' review price reached','HAL spot crossed your saved '+label.toLowerCase()+' review level. Recheck the thesis and position rather than treating this as an automatic trade.','Net long exposure','Timestamped spot '+s.spot.quote_as_of+'; user-defined review level.','technical');
 if(technical?.ready&&!technical.stale&&confirmed&&spotCurrent&&futures.length&&technical.bias==='Bearish')add('technical','review','Daily technical evidence leans lower','Review the distance to your put strikes and the amount of long exposure you intend to retain.','Long futures and protective puts','Completed daily candles through '+new Date(technical.asOf).toISOString()+'; a rule-based reading, not a forecast.','technical');
 const reviewCount=events.filter(e=>e.level==='review').length,missing=events.filter(e=>e.level==='setup'||e.level==='data').length;
 return {asOf:new Date(now).toISOString(),profile,confirmed,dataMode,spotCurrent,states,risk,ledger,futuresNotional,protection,scenarios,scenarioError,fundingCurrent,
  capitalReturnPct:finite(profile.capital)&&finite(ledger.net)?ledger.net/profile.capital*100:null,
  events,reviewCount,missing,status:!legs.length?'Start with your position':reviewCount?'Review '+reviewCount+' position trigger'+(reviewCount===1?'':'s'):missing?'Complete your review inputs':'No monitored rule triggered',
  limitations:'Checks cover the saved book and available feeds only. Missing news, market context and future margin changes remain unknown. No trade execution.'};
}
const api={bookKey,valuation,context,legState,review};
if(typeof module!=='undefined'&&typeof require==='function')module.exports=api;root.HALDesk=api;
})(typeof globalThis!=='undefined'?globalThis:this);
