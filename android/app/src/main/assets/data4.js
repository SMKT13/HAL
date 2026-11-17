/* Native-only data boundary and lossless legacy migration. */
(function(root){'use strict';
const Q5=typeof module==='object'?require('./quality5.js'):root.HAL5Quality;
const C5=typeof module==='object'?require('./continuity5.js'):root.HAL5Continuity;
const E=typeof module==='object'?require('./engine4.js'):root.HAL4Engine,clone=x=>JSON.parse(JSON.stringify(x)),stamp=()=>new Date().toISOString();
const errors={credential_missing:'Add an Upstox Analytics Token in Connection.',token_expired_or_unauthorized:'Upstox rejected or expired the token. Replace it in Connection.',upstox_permission_denied:'This token cannot access this feed.',upstox_rate_limited:'Upstox rate limit reached. Wait before refreshing.',network_unavailable:'Network unavailable. Saved observations are retained.',market_integrity_review:'Provider quote clocks or contract identity changed unexpectedly. Review Market Data Health before relying on price comparisons.',bad_response:'Provider response could not be validated.',expiry_not_listed:'This exact expiry is no longer listed.',no_hal_option_contracts:'No eligible HAL option contracts were returned.',redirect_blocked:'An unexpected provider redirect was blocked.',cancelled:'Request cancelled when leaving the foreground.'};
function message(code){return errors[code]||String(code||'Data unavailable').replace(/_/g,' ');}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const errorSummary=data=>{const e={...(object(data?.data?.errors)?data.data.errors:{}),...(object(data?.errors)?data.errors:{})};if(data?.chain_error)e.chain=data.chain_error;return Object.keys(e).length?Object.entries(e).map(([k,v])=>k+': '+message(v)).join('; '):null;};
function empty(){return {snapshot:null,research:{},health:{},lastSuccess:null,lastFailure:null,failure:null,loading:false,cached:false,stream:null,integrityHistory:[]};}
function key(section,frame='D',type='consolidated'){return section+':'+frame+(section==='fundamentals'?':'+type:'');}
function ingest(state,event,data,now=stamp()){
 const s={...state,research:{...state.research},health:{...state.health}};
 if(event==='loading'){s.loading=true;s.health.market={...s.health.market,pending:now};}
 if(event==='idle')s.loading=false;
 if(event==='snapshot'){
  if(!data||data._cache===true||!Array.isArray(data.futures)||(data.spot!=null&&typeof data.spot!=='object'))return ingest(s,'error',{code:'bad_response'},now);
  const check=C5.reconcile(s.snapshot,data,Date.parse(now));
  s.snapshot={...check.packet,_received_at:now,_cache:false};
  const identityWarnings=(check.contractConflicts||[]).map(id=>({
   code:'unresolved_contract_identity',instrument:id,
   detail:'Instrument identity conflict remains blocked pending verified contract recheck.'}));
  const outstanding=[...check.issues,...identityWarnings];
  // Keep only bounded, source-free incident metadata; never store quote values,
  // broker tokens or actual portfolio entries in the market integrity trail.
  s.integrityHistory=[...(Array.isArray(s.integrityHistory)?s.integrityHistory:[]),
   ...check.issues.map(x=>({at:now,code:x.code,instrument:x.instrument,detail:x.detail}))].slice(-25);
  s.lastSuccess=now;s.failure=outstanding.length?'market_integrity_review':null;
  s.cached=false;s.loading=false;
  s.health.market={...s.health.market,pending:null,lastSuccess:now,
   error:outstanding.length?outstanding.map(x=>x.instrument+': '+x.detail).join('; '):errorSummary(data),
   integrityWarnings:outstanding};
 }
 if(event==='error'){s.lastFailure=now;s.failure=data.code||'network_unavailable';s.loading=false;s.health.market={...s.health.market,pending:null,lastFailure:now,error:s.failure};}
 if(event==='research'){if(!object(data)||data._cache===true||typeof data.section!=='string'||!object(data.data))return ingest(s,'research_error',{key:object(data)&&data.section?key(data.section,data.frame,data.type):'research:D',code:'bad_response'},now);const k=key(data.section,data.frame,data.type);s.research[k]={...clone(data),_received_at:now,_cache:false};s.health[k]={...s.health[k],pending:null,lastSuccess:now,error:errorSummary(data)};}
 if(event==='research_error'){const rawKey=data.key||key(data.section,data.frame,data.type),k=rawKey.startsWith('fundamentals:')?rawKey:rawKey.replace(/:(consolidated|standalone)$/,'');s.health[k]={...s.health[k],pending:null,lastFailure:now,error:data.code||'network_unavailable'};}
 if(event==='stream')s.stream=clone(data); // Observation only: never valuation marks.
 return s;
}
function packet(s,section,frame='D',type='consolidated'){return s.research[key(section,frame,type)]||s.research[section+':'+frame]||null;}
function market(s){
 const result={contracts:[],quotes:{},spot:E.normQuote({}),lastSuccess:s.lastSuccess,lastFailure:s.lastFailure,failure:s.failure};const contracts=new Map(),contractConflicts=new Set(),contractConflictSpecs=[];
 const tag=(q,p,h,option=false)=>{
  const errors={...(object(p?.data?.errors)?p.data.errors:{}),...(object(p?.errors)?p.errors:{})};
  const failedRefresh=!!h?.lastFailure&&(!h.lastSuccess||Date.parse(h.lastFailure)>=Date.parse(h.lastSuccess));
  // A chain/metadata error does not invalidate independent spot/futures quotes.
  // Failed quote refreshes and quote-specific provider errors must still fail closed.
  const quoteError=errors.quotes||(option?errors.option_quotes:null)||(failedRefresh?h.error||'refresh_failed':null);
  return {...q,source:p._cache?'CACHE':q.source,lastSuccess:h?.lastSuccess||p._received_at||p.fetched_at_iso,lastFailure:h?.lastFailure||null,failure:q.failure||quoteError||null};
 };
 const add=(raw,p,h)=>{
  const m=E.normalizeMarket(raw);
  for(const c of m.contracts){
   if(contractConflicts.has(c.instrumentKey))continue;
   const previous=contracts.get(c.instrumentKey);
   if(previous&&!Q5.sameContract(previous,c)){
    contractConflicts.add(c.instrumentKey);
    contractConflictSpecs.push({...previous},{...c});
    contracts.delete(c.instrumentKey);
   }else contracts.set(c.instrumentKey,c);
  }
  for(const [k,q]of Object.entries(m.quotes)){
   const contract=m.contracts.find(c=>c.instrumentKey===k);
   result.quotes[k]=Q5.chooseQuote(result.quotes[k],tag(q,p,h,contract?.type==='PE'||contract?.type==='CE'));
  }
  return m;
 };
 if(s.snapshot){const m=add(s.snapshot,s.snapshot,s.health.market);result.spot=tag(m.spot,s.snapshot,s.health.market);}
 for(const p of Object.values(s.research)){const d=p?.data;if(!d)continue;const h=s.health[key(p.section,p.frame,p.type)];if(['chain','hedges'].includes(p.section))add(d,p,h);if(p.section==='contracts')add({held_contracts:(d.contracts||[]).filter(c=>c.verified||c.reason==='lot_size_mismatch').map(c=>({...c,type:c.type==='PUT'?'PE':c.type})),fetched_at_iso:p.fetched_at_iso},p,h);}
 result.contracts=[...contracts.values()];const held=packet(s,'contracts');if(held)for(const c of held.data?.contracts||[])if(!c.verified&&!['lot_size_mismatch','instrument_key_mismatch'].includes(c.reason)){const type=c.type==='PUT'?'PE':c.type;result.contracts=result.contracts.filter(x=>!(x.type===type&&x.expiry===c.expiry&&(type!=='PE'||x.strike===c.strike)));}
 const status=packet(s,'status')?.data?.market;result.status=status||{};result.marketOpen=status?.status==='NORMAL_OPEN';
 const context=packet(s,'context');for(const [k,q]of Object.entries(context?.data?.indices||{})){const name=(q.symbol||q.instrument_token||k).toLowerCase(),n=tag(E.normQuote(q),context,s.health[key('context')]);if(name.includes('vix'))result.vix=n;else if(name.includes('nifty')&&name.includes('50'))result.nifty=n;}
 result.contractConflicts=[...new Set([...contractConflicts,...(s.snapshot?._continuityContractConflicts||[])])];
 result.contractConflictSpecs=[...contractConflictSpecs,...(s.snapshot?._continuityContractSpecs||[])];
 if(result.contractConflicts.length){
  result.contracts=result.contracts.filter(c=>!result.contractConflicts.includes(c.instrumentKey));
  for(const id of result.contractConflicts)result.quotes[id]=Q5.errorQuote(
   result.quotes[id]||E.normQuote({}), 'Conflicting instrument type, expiry, strike or lot size for the same key');
 }
 result.dataQuality=Q5.audit(result);
 return result;
}
function rawCandles(s,frame='D',section='candles'){const p=packet(s,section,frame),d=p?.data||{};const malformed=[d.history?.candles,d.intraday?.candles].some(x=>x!=null&&!Array.isArray(x));return {raw:[...(Array.isArray(d.history?.candles)?d.history.candles:[]),...(Array.isArray(d.intraday?.candles)?d.intraday.candles:[])],retrievedAt:p?.fetched_at_iso||null,error:malformed?'bad_response':s.health[key(section,frame)]?.error||null};}
function news(s){const result=[];const flatten=x=>{
 if(Array.isArray(x))return x.flatMap(flatten);
 if(!x||typeof x!=='object')return [];
 // Upstox /v2/news returns an array of instrument-keyed article arrays.
 // Stop recursion at an article instead of recursing into its scalar fields.
 if(typeof (x.heading??x.title??x.headline)==='string'||typeof (x.article_link??x.url??x.link??x.news_url)==='string')return [x];
 return Object.values(x).flatMap(flatten);
};for(const section of ['news','filings']){const p=packet(s,section),d=p?.data||{};let list=section==='filings'?d.items:d.articles;list=flatten(list);for(const n of list){if(!n||typeof n!=='object')continue;const t=n.published_time??n.publishedAt??n.published_at??n.published??n.published_date??n.date;result.push({title:n.heading||n.title||n.headline,url:n.article_link||n.url||n.link||n.news_url,publishedAt:typeof t==='number'?(Number.isFinite(t)&&Math.abs(t)<=8640000000000000?new Date(t).toISOString():null):t,source:typeof n.source==='string'?n.source:n.source?.name||(section==='filings'?'NSE disclosure':'Upstox news'),summary:n.summary||n.description,official:section==='filings'||n.official===true,retrievedAt:p?.fetched_at_iso,eventDate:E.validDate(n.eventDate)?n.eventDate:E.validDate(n.event_date)?n.event_date:null,topic:n.topic||'Business'});}}return result;}
function safeBackup(book){return {app:'HAL Desk',schema:4,exportedAt:stamp(),book:E.validateBook(book)};}
function previewImport(raw){if(!raw||typeof raw!=='object')throw Error('Invalid backup.');if(raw.schema!=null&&![2,4].includes(raw.schema))throw Error('Unsupported backup schema.');let b=raw.book||raw;if(b.version===1)b={...E.emptyBook(),legs:b.legs};const clean=E.validateBook(b);clean.riskProfile.confirmedAt=null;clean.riskProfile.confirmedBook=null;if(Array.isArray(raw.history))clean.migration={...(clean.migration||{}),legacyPriceHistory:clone(raw.history)};return clean;}
function loadBook(native,storage){
 if(native?.loadBook){const r=JSON.parse(native.loadBook());if(!r.ok)throw Error(r.message||'Native storage could not be read.');if(r.book)return {book:E.validateBook(typeof r.book==='string'?JSON.parse(r.book):r.book),revision:r.revision,migrated:false};}
 const current=storage.getItem('hal_desk_v4');if(current)return {book:E.validateBook(JSON.parse(current)),revision:0,migrated:false};
 let legacy=storage.getItem('hal_desk_v2'),from='hal_desk_v2';if(!legacy){legacy=storage.getItem('hal_positions_v1');from='hal_positions_v1';}
 if(legacy){let b=JSON.parse(legacy);if(b.version===1)b={...E.emptyBook(),legs:b.legs};const book=E.validateBook(b);book.migration={...(book.migration||{}),fromKey:from,at:stamp(),reviewRequired:true};for(const [k,label]of [['hal_checkpoint_v1','legacyCheckpoint'],['hal_last_visit_v2','legacyLastVisit']]){try{const x=storage.getItem(k);if(x)book.migration[label]=JSON.parse(x);}catch(_){}}try{const old=JSON.parse(storage.getItem('hal_cache_v2')||'null');if(old?.history)book.migration.legacyPriceHistory=old.history;}catch(_){}return {book,revision:0,migrated:true};}
 return {book:E.emptyBook(),revision:0,migrated:false};
}
function saveBook(native,storage,book,revision){const clean=E.validateBook(book);if(native?.saveBook){const r=JSON.parse(native.saveBook(JSON.stringify(clean),revision));if(!r.ok)throw Error(r.message||'Book save failed; changes not committed.');return {book:clean,revision:r.revision};}const old=storage.getItem('hal_desk_v4');if(old)storage.setItem('hal_previous_v4',old);storage.setItem('hal_desk_v4',JSON.stringify(clean));return {book:clean,revision:revision+1};}
function cache(s){return {version:4,snapshot:s.snapshot,research:s.research,health:s.health,lastSuccess:s.lastSuccess,lastFailure:s.lastFailure,failure:s.failure,integrityHistory:(s.integrityHistory||[]).slice(-25)};}
function restoreCache(raw){if(!raw||typeof raw!=='object')return empty();const s={...empty(),...raw,loading:false,cached:true,stream:null};s.health=object(s.health)?clone(s.health):{};
 s.integrityHistory=Array.isArray(s.integrityHistory)?s.integrityHistory.filter(x=>object(x)&&typeof x.code==='string'&&typeof x.at==='string').slice(-25).map(x=>({at:String(x.at).slice(0,40),code:String(x.code).slice(0,80),instrument:String(x.instrument||'').slice(0,100),detail:String(x.detail||'').slice(0,240)})):[];if(s.snapshot)s.snapshot={...s.snapshot,_cache:true};s.research={...(s.research||{})};for(const [k,p]of Object.entries(s.research))s.research[k]={...p,_cache:true};for(const [k,h]of Object.entries(s.health)){if(object(h))h.pending=null;else delete s.health[k];}return s;}
const api={empty,key,ingest,packet,market,rawCandles,news,message,safeBackup,previewImport,loadBook,saveBook,cache,restoreCache};if(typeof module==='object'&&module.exports)module.exports=api;root.HAL4Data=api;
})(typeof globalThis==='undefined'?this:globalThis);
