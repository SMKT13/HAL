/* HAL Desk 5: evidence-led post-market interpretation; read-only, deterministic, offline. */
(function(root){'use strict';
const engine=typeof module==='object'&&module.exports?require('./engine4.js'):root.HAL4Engine;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const arr=x=>Array.isArray(x)?x:[];
const number=x=>finite(x)?x:null;
const day=x=>{const d=Date.parse(x||'');return Number.isFinite(d)?new Date(d+330*60000).toISOString().slice(0,10):null;};
const currentDay=now=>new Date(now+330*60000).toISOString().slice(0,10);
const round=x=>Math.round(x*100)/100;
const fmt=x=>finite(x)?'₹'+x.toLocaleString('en-IN',{maximumFractionDigits:2}):'unavailable';
const percent=x=>finite(x)?(x>=0?'+':'')+round(x)+'%':'unavailable';
const unique=values=>{const seen=[];return values.filter(v=>finite(v.price)&&v.price>0&&!seen.some(w=>Math.abs(w.price-v.price)<0.5)&&(seen.push(v),true));};
function relativeNews(headline){
 const s=String(headline||'').toLowerCase();
 if(/result|revenue|profit|margin|earning|guidance|quarter|dividend/.test(s))return 'Financial results can change the earnings outlook; verify the reported period, margins and filing.';
 if(/order|contract|procure|defence budget|defense budget|tender|approval/.test(s))return 'Potential demand relevance; verify whether this is an actual HAL order, a proposal or a sector-wide announcement.';
 if(/tejas|engine|deliver|production|supply|aircraft|helicopter/.test(s))return 'Delivery schedules and production execution may affect HAL cash flow; check official milestones.';
 return 'Potentially relevant headline; price impact and causation are not established by a headline alone.';
}
function fundamentalReview(f={}){
 const metrics=arr(f.metrics).filter(m=>m&&m.kind==='provider'&&typeof m.label==='string'&&finite(m.value));
 const categories=[
  {title:'Revenue / income',match:/revenue|turnover|total income|sales/i,interpretation:'Review execution and delivery progress against the same reported period; a single revenue number cannot establish growth.'},
  {title:'Net earnings',match:/net profit|profit after tax|profit attributable|\bpat\b/i,interpretation:'Earnings durability depends on margins, execution and cash conversion. A single period does not confirm an earnings trend.'},
  {title:'Profitability margin',match:/ebitda margin|operating margin|net margin|profit margin/i,interpretation:'Compare margins with the same basis and earlier periods before concluding cost efficiency is improving.'},
  {title:'Valuation',match:/price.to.earnings|p.e ratio|\bpe ratio\b|price.earnings/i,interpretation:'A valuation multiple is not a buy signal without earnings quality, peer and historical comparisons.'},
  {title:'Cash flow',match:/cash flow from operat|operating cash flow|net cash from operat/i,interpretation:'Cash conversion and working-capital needs matter even when reported profit is positive.'}
 ];
 const readings=[];
 for(const cat of categories){
  const m=metrics.find(x=>cat.match.test(x.label.split('/').pop().replace(/_/g,' ').trim())&&typeof x.period==='string'&&x.period.trim());
  if(m)readings.push({title:cat.title,label:m.label,value:m.value,unit:typeof m.unit==='string'?m.unit:null,period:typeof m.period==='string'?m.period:null,source:m.source||'Provider financial data',retrievedAt:m.retrievedAt||null,interpretation:cat.interpretation});
 }
 return {available:readings.length>0,readings,summary:readings.length?'Provider-reported financial fields are shown with explicit periods. No YoY growth, margin trend or valuation conclusion is inferred without comparable verified periods.':'No recognizable period-tagged financial fields are loaded. Business-specific earnings claims are withheld.',driver:'For HAL, track verified aircraft and helicopter delivery milestones, order execution, supply-chain constraints and government defence budgets; distinguish firm orders from proposals.'};
}
function benchmarkReview(m={},asOf,changePct,now=Date.now()){
 const valid=q=>asOf&&q&&Date.parse(q.quoteAt)<=now&&finite(q.price)&&q.price>0&&day(q.quoteAt)===asOf;
 const nifty=valid(m.nifty)?{price:m.nifty.price,changePct:number(m.nifty.changePct),at:m.nifty.quoteAt}:null;
 const vix=valid(m.vix)?{price:m.vix.price,changePct:number(m.vix.changePct),at:m.vix.quoteAt}:null;
 const relative=nifty&&finite(changePct)&&finite(nifty.changePct)?round(changePct-nifty.changePct):null;
 return {nifty,vix,relative,summary:finite(relative)?'HAL '+(relative>=0?'outperformed':'underperformed')+' Nifty 50 by '+Math.abs(relative)+' percentage points in the same-dated session; this is comparison, not proof of why HAL moved.':'Same-date, timestamped benchmark changes are unavailable, so relative outperformance is withheld.'};
}
function positionReview(book,valuation,confirmed,now,cached){
 const legs=arr(book?.legs),active=legs.filter(l=>l&&engine.expiryTime(l.expiry)>=now);
 const qty=l=>Number.isSafeInteger(l.lots)&&Number.isSafeInteger(l.lotSize)&&l.lots>0&&l.lotSize>0?l.lots*l.lotSize:0;
 const futures=active.filter(l=>l.type==='FUT'),puts=active.filter(l=>l.type==='PE'),futureUnits=futures.reduce((n,l)=>n+qty(l),0),putUnits=puts.reduce((n,l)=>n+qty(l),0);
 const earliestPut=puts.map(l=>l.expiry).sort()[0]||null;
 const nextFuture=futures.map(l=>l.expiry).sort()[0]||null;
 const expiryDates=[...new Set(puts.map(l=>l.expiry))].sort();
 const unitsAfter=(legs,date)=>legs.filter(l=>l.expiry>date).reduce((sum,l)=>sum+qty(l),0);
 const gapDate=expiryDates.find(date=>unitsAfter(futures,date)>unitsAfter(puts,date));
 const reviewDate=gapDate||earliestPut;
 const futureUnitsAfter=unitsAfter(futures,reviewDate);
 const putUnitsAfter=unitsAfter(puts,reviewDate);
 const gap=Boolean(gapDate);
 const invalidQuantity=active.some(l=>!qty(l));
 const expiryDays=earliestPut?Math.ceil((engine.expiryTime(earliestPut)-now)/86400000):null;
 const messages=[];
 if(legs.length&&!confirmed)messages.push('Saved broker positions are not confirmed; verify exact contracts and quantities before using this review.');
 if(invalidQuantity)messages.push('At least one active leg has invalid or missing lot quantity; coverage cannot be trusted.');
 if(!invalidQuantity&&futureUnits&&putUnits)messages.push('Nominal put quantity coverage is '+round(putUnits/futureUnits*100)+'%; strike, premium and expiry still affect actual downside protection.');
 if(gap)messages.push('Hedge continuity warning: '+futureUnitsAfter+' future units extend beyond '+gapDate+', with '+Math.max(0,futureUnitsAfter-putUnitsAfter)+' units without later-dated put quantity protection.');
 if(expiryDays!==null&&expiryDays<=7&&expiryDays>=0)messages.push('Next recorded put expiry is in '+expiryDays+' calendar day(s). Review rollover, option exercise, physical settlement and broker margin requirements.');
 if(futureUnits&&!puts.length)messages.push('No currently unexpired protective puts are recorded for the open futures.');
 if(futureUnits)messages.push('Futures variation margin and physical-delivery obligations are not eliminated by holding protective puts.');
 const pnlAvailable=confirmed&&!cached&&!invalidQuantity&&valuation?.complete===true&&valuation?.stale!==true&&valuation?.manual!==true&&finite(valuation.open);
 return {hasBook:legs.length>0,confirmed,futureUnits,putUnits,coverage:futureUnits&& !invalidQuantity?round(putUnits/futureUnits*100):null,earliestPut,nextFuture,gap,expiryDays,protectedUnitsAfter:putUnitsAfter,uncoveredUnitsAfter:gap?Math.max(0,futureUnitsAfter-putUnitsAfter):0,openPnl:pnlAvailable?valuation.open:null,marksWithheld:!pnlAvailable,putStrikes:puts.map(l=>({strike:number(l.strike),expiry:l.expiry,units:qty(l)})),messages};
}
function build(context={},now=Date.now()){
 const t=context.technical||{},m=context.market||{},book=context.book||{},rows=arr(t.rows);
 const last=rows[rows.length-1],prev=rows[rows.length-2],asOf=day(t.asOf),today=currentDay(now);
 const position=positionReview(book,context.valuation,context.confirmed===true,now,context.cached===true||context.integrityBlocked===true);
 const fundamentals=fundamentalReview(context.fundamentals),benchmark=benchmarkReview(context.integrityBlocked?{}:m,asOf,null,now);
 const base={version:1,generatedAt:new Date(now).toISOString(),asOf:t.asOf||null,date:asOf,source:'Completed HAL daily candles · read-only provider',position,fundamentals,benchmark,headlines:[],signals:[],levels:{supports:[],resistances:[]},scenarios:[],caveats:[],ready:false,quality:'Unavailable',title:'Daily analysis unavailable',verdict:'Insufficient evidence',summary:'Load HAL daily candles to generate a dated, evidence-led report.',price:null,change:null,changePct:null,volumeRatio:null};
 if(!last||!finite(last.c)||last.c<=0||!asOf||asOf>today||Date.parse(t.asOf)>now||!finite(last.v)||last.v<0){
  base.caveats.push('A valid completed daily candle with source date and volume is required. No price or trend conclusion is invented.');
  return base;
 }
 const price=last.c,daily=prev&&finite(prev.c)&&prev.c>0?price-prev.c:null,pct=finite(daily)?daily/prev.c*100:null;
 base.price=price;base.change=daily;base.changePct=pct;base.ready=rows.length>=50&&t.ready!==false;
 if(position.putStrikes.length){const strikes=position.putStrikes.map(x=>x.strike).filter(finite);if(strikes.length){const upper=Math.max(...strikes);if(price>upper)position.messages.push('At the completed HAL equity close of '+fmt(price)+', the highest recorded put strike '+fmt(upper)+' was out of the money by '+fmt(price-upper)+' per share. Quantity coverage alone does not protect that price gap.');}}
 base.benchmark=benchmarkReview(context.integrityBlocked?{}:m,asOf,pct,now);
 const reportStale=context.cached===true||context.integrityBlocked===true||t.stale===true||asOf!==today;
 base.quality=context.integrityBlocked===true?'Source integrity review':reportStale?'Historical / cached evidence':'Current completed daily evidence';
 base.caveats.push('This is a dated interpretation, not a prediction or order signal. Levels are conditional observation zones, not guaranteed fills or stop orders.');
 if(reportStale)base.caveats.push('Data are cached, older, or have incomplete freshness verification. Do not treat this as a live market verdict.');
 if(context.integrityBlocked){
  base.ready=false;
  base.summary='Review the provider integrity warning and refresh before using a directional assessment.';
  base.caveats.push('Market comparisons and trend scenarios are withheld until the integrity warning clears.');
  return base;
 }
 if(!base.ready){base.summary='Only '+rows.length+' completed bars are available. Review observed prices but withhold a trend verdict until at least 50 bars and validated technicals are present.';base.caveats.push('Short history: directional analysis withheld.');return base;}
 const s20=number(t.sma20),s50=number(t.sma50),s200=number(t.sma200),rsi=number(t.rsi),hist=number(t.hist),macd=number(t.macd);
 const prior=rows.slice(-21,-1);
 const avg=prior.length===20&&prior.every(r=>finite(r?.v)&&r.v>=0)?prior.reduce((sum,r)=>sum+r.v,0)/20:null;
 const vr=finite(avg)&&avg>0&&finite(last.v)?last.v/avg:null;base.volumeRatio=finite(vr)?round(vr):null;
 const averages=[['20-day SMA',s20],['50-day SMA',s50],['200-day SMA',s200]];
 for(const [label,value]of averages)base.signals.push({label,value,reading:finite(value)?price>value?'Close above':price<value?'Close below':'At average':'Unavailable',interpretation:finite(value)?price>value?'Supportive relative position':'Unrecovered trend level':'Insufficient completed history'});
 base.signals.push({label:'RSI (14)',value:rsi,reading:!finite(rsi)?'Unavailable':rsi>=55?'Positive momentum':rsi>=45?'Neutral zone':rsi>=30?'Weak momentum':'Oversold region',interpretation:!finite(rsi)?'No inference':rsi<50?'Buying momentum remains unconfirmed':'Momentum improvement needs price confirmation'});
 base.signals.push({label:'MACD histogram',value:hist,reading:!finite(hist)?'Unavailable':hist>0?'Positive':'Negative / flat',interpretation:finite(hist)?hist>0?'Momentum is supportive':'Momentum confirmation is missing':'No inference'});
 base.signals.push({label:'Volume / prior 20-session average',value:base.volumeRatio,reading:!finite(vr)?'Unavailable':vr>=1.2?'Above average':vr<0.8?'Below average':'Near average',interpretation:!finite(vr)?'No inference':vr<0.8?'Participation is weaker than average':'Watch whether follow-through persists'});
 const below=(finite(s20)&&price<s20?1:0)+(finite(s50)&&price<s50?1:0);
 if(finite(daily)&&daily>0&&below>0){base.title='Recovery attempt · not yet confirmed';base.verdict='Cautious / neutral';base.summary='HAL closed higher after the previous session, but remains under '+below+' of the 20/50-day averages. A sustained reclaim with better participation would strengthen the recovery case.';}
 else if(below===2&&(finite(daily)&&daily<=0||finite(hist)&&hist<0)){base.title='Short-term pressure persists';base.verdict='Bearish caution';base.summary='HAL remains below both short-term averages, with no confirmed price breakout. Watch support before assuming a reversal.';}
 else if(finite(s20)&&finite(s50)&&price>s20&&price>s50&&finite(rsi)&&rsi>=50&&finite(hist)&&hist>0){base.title='Trend confirmation improving';base.verdict='Constructive, conditional';base.summary='Price is above both short-term averages and momentum confirms the move. Retests and volume remain important.';}
 else {base.title='Mixed trend evidence';base.verdict='Neutral / watch levels';base.summary='Price, momentum and moving averages do not agree enough for a strong directional conclusion.';}
 const highs=rows.slice(-5).map(r=>r.h).filter(finite),lows=rows.slice(-5).map(r=>r.l).filter(finite);
 const candidates=unique([
  {price:last.h,label:'Last session high'},{price:last.l,label:'Last session low'},
  {price:prev?.h,label:'Previous session high'},{price:prev?.l,label:'Previous session low'},
  {price:highs.length?Math.max(...highs):null,label:'Five-session high'},
  {price:lows.length?Math.min(...lows):null,label:'Five-session low'},
  {price:t.support,label:'20-session low'},{price:t.resistance,label:'20-session high'},
  {price:s20,label:'20-day SMA'},{price:s50,label:'50-day SMA'},{price:s200,label:'200-day SMA'},
  {price:t.r1,label:'Next-session R1 pivot'},{price:t.s1,label:'Next-session S1 pivot'}
 ]);
 base.levels.resistances=candidates.filter(x=>x.price>price+0.5).sort((a,b)=>a.price-b.price).slice(0,4).map(x=>({...x,price:round(x.price)}));
 base.levels.supports=candidates.filter(x=>x.price<price-0.5).sort((a,b)=>b.price-a.price).slice(0,4).map(x=>({...x,price:round(x.price)}));
 const up=base.levels.resistances[0],down=base.levels.supports[0];
 if(up)base.scenarios.push({kind:'bullish',title:'Recovery extends',trigger:'Sustained trade and preferably a completed close above '+fmt(up.price),interpretation:'Watch follow-through, price acceptance and volume; a breakout is not confirmed before it happens.',next:base.levels.resistances[1]?fmt(base.levels.resistances[1].price):'Further resistance unavailable'});
 if(up&&down)base.scenarios.push({kind:'range',title:'Consolidation',trigger:'Price stays within '+(down?fmt(down.price):'unavailable')+' to '+(up?fmt(up.price):'unavailable'),interpretation:'Mixed evidence favours observation over assuming a trend. A range can fail in either direction.',next:'Wait for a confirmed change'});
 if(down)base.scenarios.push({kind:'bearish',title:'Support fails',trigger:'Sustained trade and preferably a completed close below '+fmt(down.price),interpretation:'A break weakens the recovery attempt; evaluate protection and exposure, not a guaranteed outcome.',next:base.levels.supports[1]?fmt(base.levels.supports[1].price):'Further support unavailable'});
 const cutoff=Date.parse(t.asOf),stories=arr(context.news).filter(n=>{
  const p=Date.parse(n?.publishedAt||'');return typeof n?.title==='string'&&Number.isFinite(p)&&p<=now&&(!Number.isFinite(cutoff)||p>=cutoff-30*86400000);
 }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).slice(0,4);
 base.headlines=stories.map(n=>({title:n.title,source:n.source||'Unspecified',publishedAt:n.publishedAt,url:n.url||null,official:n.official===true,interpretation:relativeNews(n.title)}));
 if(!base.headlines.length)base.caveats.push('No date-verified recent headlines are available. Fundamental and news conclusions are withheld.');
 if(position.hasBook&&!position.confirmed)base.caveats.push('Portfolio review is based on unconfirmed locally saved positions; do not equate the book with live broker holdings.');
 return base;
}
const api={build,positionReview,relativeNews,fundamentalReview,benchmarkReview};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.HAL5Analysis=api;
})(typeof globalThis==='undefined'?this:globalThis);
