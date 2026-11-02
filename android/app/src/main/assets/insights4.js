/* HAL Desk 4: local research evidence. No networking, credentials, or trading actions. */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const number=x=>finite(x)?x:null;
const stamp=x=>typeof x==='string'&&Number.isFinite(Date.parse(x))?new Date(Date.parse(x)).toISOString():null;
const text=(x,n=200)=>typeof x==='string'?x.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n):null;
const array=x=>Array.isArray(x)?x:[];
const iso=now=>new Date(now).toISOString();
function safeURL(value){
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(_){return null;}
}
function select(source,keys){const out={};for(const k of keys){const x=source?.[k];if(typeof x==='boolean'||x===null||finite(x))out[k]=x;else if(typeof x==='string')out[k]=text(x,300);}return out;}
function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
}
function fingerprint(value){let h=2166136261;const s=canonical(value);for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return 'rev-'+(h>>>0).toString(16).padStart(8,'0');}
function contract(leg){return select(leg,['id','type','expiry','strike','lots','lotSize','entry','manual','manualAt','instrumentKey']);}
function materialFingerprint(book){
 return fingerprint({legs:array(book?.legs).map(contract),journal:array(book?.journal).map(j=>({id:j.id,kind:j.kind,date:j.date,leg:j.leg?contract(j.leg):null,exit:number(j.exit),fees:number(j.fees),amount:number(j.amount)})),legacy:select(book?.legacy,['realized','costs']),funding:select(book?.funding,['margin','free','at']),markMode:book?.preferences?.markMode||'ltp',riskProfile:select(book?.riskProfile,['capital','maxLoss','hedgeBudget','reserve','minCoverage','maxMarginUsage','reviewBelow','reviewAbove','expiryWarningDays'])});
}
function isBookConfirmed(book,now=Date.now()){const at=Date.parse(book?.riskProfile?.confirmedAt);return Number.isFinite(at)&&at<=now+60000&&book?.riskProfile?.confirmedBook===materialFingerprint(book);}
function marketEvidence(market={}){
 const quote=q=>{if(!q||typeof q!=='object')return null;return select(q,['instrumentKey','symbol','price','last_price','change','changePct','prevClose','previousClose','quoteAt','tradeAt','retrievedAt','source','status','cached','lastSuccess','lastFailure','error']);};
 return {spot:quote(market.spot),nifty:quote(market.nifty),vix:quote(market.vix),status:select(market.status,['state','status','market','exchange','source','asOf','retrievedAt']),lastSuccess:stamp(market.lastSuccess),lastFailure:stamp(market.lastFailure),failureReason:text(market.error||market.failureReason)};
}
function normalizeNews(raw){
 return array(raw).map(n=>({id:text(n.id,120),title:text(n.title||n.headline,260),url:safeURL(n.url||n.link),source:text(n.source,100),publishedAt:stamp(n.publishedAt||n.published_at||n.date),retrievedAt:stamp(n.retrievedAt||n.retrieved_at),official:n.official===true,topic:text(n.topic,60),summary:text(n.summary,500)})).filter(n=>n.title);
}
function newsGroups(raw){
 const groups=new Map();
 for(const n of normalizeNews(raw)){
  const key=n.title.toLowerCase().replace(/\bhal\b/g,'hindustan aeronautics').replace(/[^a-z0-9]+/g,' ').trim();
  if(!groups.has(key))groups.set(key,{...n,duplicates:[]});
  else{const group=groups.get(key);group.duplicates.push(n);if(n.official&&!group.official){const old={...group};delete old.duplicates;Object.assign(group,n);group.duplicates=[old,...group.duplicates.filter(x=>x!==n)];}}
 }
 return [...groups.values()].sort((a,b)=>(Date.parse(b.publishedAt)||0)-(Date.parse(a.publishedAt)||0));
}
function technicalEvidence(t={}){
 const out=select(t,['bias','frame','completedCount','vol','asOf','interval','bars','ready','stale','reason','trend','momentum','sma20','sma50','sma200','ema12','ema26','rsi','rsi14','atr','atr14','mfi','mfi14','historicalVolatility','hv','volumeTrend']);
 if(finite(t.macd))out.macd={value:t.macd,signal:number(t.signal),histogram:number(t.hist)};if(finite(t.bbMid))out.bollinger={lower:number(t.bbLow),middle:t.bbMid,upper:number(t.bbHigh)};if(finite(t.pivot))out.pivots=select(t,['pivot','r1','r2','s1','s2']);for(const k of ['macd','bollinger','pivots'])if(t[k]&&typeof t[k]==='object')out[k]=select(t[k],['value','macd','signal','histogram','upper','middle','lower','pivot','r1','r2','r3','s1','s2','s3']);
 for(const k of ['support','resistance']){const v=t[k];out[k]=finite(v)?v:array(v).filter(finite).slice(0,5);}
 return out;
}
function valuationEvidence(v={}){
 return {...select(v,['open','realized','charges','net','complete','openPutPremium','settlements','fundingMovements']),rows:array(v.rows).slice(0,30).map(r=>({leg:contract(r.leg||{}),units:number(r.units),pnl:number(r.pnl),mark:select(r.mark,['price','source','quoteAt','tradeAt','retrievedAt','status'])}))};
}
function riskEvidence(r={}){
 return {...select(r,['futureUnits','putUnits','coveredUnits','uncoveredUnits','coverage','delta','theta','greeksComplete','nextExpiry']),warnings:array(r.warnings).slice(0,12).map(w=>typeof w==='string'?text(w,220):select(w,['code','title','detail'])),distribution:array(r.distribution).slice(0,30).map(x=>select(x,['expiry','strike','units','lots','type']))};
}
function scenarioEvidence(s){return array(s).slice(0,12).map(x=>({...select(x,['total','horizon','complete','spot','shock','ivShift','rate','dividend']),errors:array(x.errors).map(x=>text(x,160)).slice(0,5),assumptions:array(x.assumptions).map(x=>text(x,200)).slice(0,6),rows:array(x.rows).slice(0,30).map(r=>({leg:contract(r.leg||{}),modelPrice:number(r.modelPrice),pnl:number(r.pnl),iv:number(r.iv)}))}));}
function fundamentalEvidence(f={}){
 const profile=select(f.profile,['name','symbol','sector','industry','description','source','retrievedAt']);profile.url=safeURL(f.profile?.url);
 const metrics=array(f.metrics).slice(0,30).map(m=>({...select(m,['label','value','unit','period','source','retrievedAt','kind']),url:safeURL(m.url)})).filter(m=>m.label&&(m.kind==='provider'||m.kind==='derived'));
 return {profile,metrics};
}
function providerFundamentals(packet){
 const metrics=[],data=packet?.data||{},retrievedAt=stamp(packet?.fetched_at_iso),source='Upstox official API';
 function walk(v,path,context={},depth=0){if(depth>8||metrics.length>=30)return;if(Array.isArray(v)){v.slice(0,20).forEach((x,i)=>walk(x,path+' ['+(i+1)+']',context,depth+1));return;}if(v&&typeof v==='object'){const c={period:v.period??v.reporting_period??v.fiscal_year??v.year??context.period,unit:v.unit??v.units??v.currency??context.unit};for(const [k,x]of Object.entries(v))walk(x,path+' / '+k,c,depth+1);}else if(finite(v))metrics.push({label:path,value:v,period:context.period==null?null:String(context.period),unit:context.unit==null?null:String(context.unit),source,retrievedAt,kind:'provider'});}
 for(const k of ['income','annual','ratios','balance','cash','shareholding'])if(data[k])walk(data[k],k);
 return {profile:{symbol:'HAL',source,retrievedAt},metrics};
}
function evidencePacket(input={},options={}){
 const now=options.now??Date.now(),mode=options.mode||'research';
 if(!['research','copilot','deliberate'].includes(mode))throw Error('Unknown AI review mode.');
 const includePortfolio=mode!=='research'&&options.includePortfolio===true;
 const market=marketEvidence(input.market||{}),news=normalizeNews(input.news).slice(0,12);
 const sources=new Map();for(const n of news)if(n.url)sources.set(n.url,{label:n.source||n.title,url:n.url,publishedAt:n.publishedAt,retrievedAt:n.retrievedAt});
 for(const s of array(input.sources)){const url=safeURL(s.url);if(url)sources.set(url,{label:text(s.label||s.title||s.source,150),url,publishedAt:stamp(s.publishedAt),retrievedAt:stamp(s.retrievedAt)});}
 const packet={schemaVersion:4,generatedAt:iso(now),quoteAsOf:market.spot?.quoteAt||null,portfolioIncluded:includePortfolio,market,technical:technicalEvidence(input.technical),fundamentals:fundamentalEvidence(input.fundamentals),news,sources:[...sources.values()].slice(0,20)};
 if(includePortfolio){
  packet.bookRevision=materialFingerprint(input.book);
  packet.portfolio={confirmedAt:isBookConfirmed(input.book,now)?stamp(input.book.riskProfile.confirmedAt):null,legs:array(input.book?.legs).slice(0,30).map(contract)};
  packet.valuation=valuationEvidence(input.valuation||input.ledger);
  packet.risk=riskEvidence(input.risk);
  packet.scenarios=scenarioEvidence(input.scenarios);
  packet.funding=select(input.funding||input.book?.funding,['margin','free','at','source']);
  packet.coach=coach(input,now).map(x=>select(x,['code','severity','title','detail']));
 }
 let serialized=JSON.stringify(packet);
 if(serialized.length>23000){packet.news=packet.news.slice(0,5);packet.scenarios=packet.scenarios?.slice(0,4);serialized=JSON.stringify(packet);}
 if(serialized.length>24000)throw Error('Evidence exceeds the safe request limit. Review fewer legs or scenarios.');
 return packet;
}
function coach(input={},now=Date.now()){
 const book=input.book||{},risk=input.risk||{},valuation=input.valuation||input.ledger||{},market=input.market||{},items=[];
 const add=(code,severity,title,detail)=>items.push({code,severity,title,detail});
 if(!array(book.legs).length)add('EMPTY_BOOK','info','Research is available','No current holdings are assumed. Record and confirm your actual broker position before position analysis.');
 else {
  if(!isBookConfirmed(book,now))add('CONFIRM_BOOK','review','Confirm the saved book','Compare every expiry, strike, quantity and entry against your broker.');
  if(valuation.complete===false)add('INCOMPLETE_MARKS','review','Basket P&L is unavailable','One or more necessary marks are missing or invalid. Review each leg; missing values are not zero.');
  if(finite(risk.coverage)&&risk.coverage<100)add('QUANTITY_GAP','review','Protection quantity is incomplete',`${risk.uncoveredUnits??'Some'} futures units are uncovered. Quantity coverage does not guarantee a loss limit.`);
  if(risk.greeksComplete===false)add('GREEKS_INCOMPLETE','info','Net Greeks are unavailable','Required contract Greeks are missing or invalid.');
  for(const w of array(risk.warnings)){const title=typeof w==='string'?w:w.title;add(w.code||'RISK_REVIEW','review',text(title,120),text(typeof w==='string'?w:w.detail,300));}
  const funding=input.funding||book.funding||{},at=Date.parse(funding.at);
  if(!Number.isFinite(at)||at>now+60000||now-at>86400000)add('FUNDING_STALE','review','Review margin and available funds','The latest manual funding snapshot is missing, future-dated or over 24 hours old. Broker margin can change.');
 }
 const spot=market.spot||{},quoted=Date.parse(spot.quoteAt),trade=Date.parse(spot.tradeAt);
 if(!Number.isFinite(quoted))add('SOURCE_TIME_MISSING','review','Quote time is unavailable','HTTP retrieval time does not establish a fresh exchange quote.');
 else if(quoted>now+60000||Number.isFinite(trade)&&trade>now+60000)add('CLOCK_MISMATCH','review','Check source and device clocks','A source timestamp is ahead of this device.');
 else if(now-quoted>120000)add('QUOTE_STALE','info','Using an older observation','The last quote is older than two minutes. Review the source timestamp and official market status.');
 if(market.lastFailure&&(!market.lastSuccess||Date.parse(market.lastFailure)>Date.parse(market.lastSuccess)))add('REFRESH_FAILED','review','Last refresh failed',text(market.error||market.failureReason||'Previously cached data remains visible and is not a successful refresh.',300));
 return items.slice(0,24);
}
function checkpoint(input={},now=Date.now()){
 const v=input.valuation||input.ledger||{},r=input.risk||{},spot=input.market?.spot||{};
 return {version:4,savedAt:iso(now),bookRevision:materialFingerprint(input.book),quoteAsOf:stamp(spot.quoteAt),spot:number(spot.price??spot.last_price),open:number(v.open),complete:v.complete===true,coverage:number(r.coverage),delta:number(r.delta),theta:number(r.theta),rsi:number(input.technical?.rsi??input.technical?.rsi14),newsURLs:normalizeNews(input.news).map(n=>n.url).filter(Boolean).slice(0,100),legs:array(input.book?.legs).map(contract)};
}
function changes(previous,current,news=[]){
 const base={ready:false,reason:null,sameBook:false,from:previous?.savedAt||null,to:current?.savedAt||null};
 const a=Date.parse(previous?.savedAt),b=Date.parse(current?.savedAt);
 if(!previous||previous.version!==4||!Number.isFinite(a)||!current||current.version!==4||!Number.isFinite(b))return {...base,reason:'Save a new review checkpoint to begin comparison.'};
 if(a>b)return {...base,reason:'Previous checkpoint is ahead of the current clock.'};
 const sameBook=previous.bookRevision===current.bookRevision,diff=(a,b)=>finite(a)&&finite(b)?b-a:null,seen=new Set(array(previous.newsURLs));
 return {...base,ready:true,sameBook,fromQuote:previous.quoteAsOf,toQuote:current.quoteAsOf,spot:diff(previous.spot,current.spot),open:sameBook&&previous.complete&&current.complete?diff(previous.open,current.open):null,coverage:sameBook?diff(previous.coverage,current.coverage):null,delta:sameBook?diff(previous.delta,current.delta):null,theta:sameBook?diff(previous.theta,current.theta):null,rsi:diff(previous.rsi,current.rsi),newNews:normalizeNews(news).filter(n=>n.url&&!seen.has(n.url)).slice(0,12),reason:sameBook?'Changes compare saved observations; price movements are not attributed to news.':'The book changed. Open P&L and exposure changes are withheld as like-for-like comparisons.'};
}
function canUseAnswer(answer,book){return Boolean(answer&&answer.portfolioIncluded===false||answer&&answer.bookRevision&&answer.bookRevision===materialFingerprint(book));}
const api={safeURL,canonical,materialFingerprint,isBookConfirmed,contract,normalizeNews,newsGroups,fundamentalEvidence,providerFundamentals,evidencePacket,coach,checkpoint,changes,canUseAnswer};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HAL4Insights=api;
})(typeof globalThis!=='undefined'?globalThis:this);
