/* HAL Desk 4 deterministic finance engine. No network, storage, credentials or trading. */
(function (root) {
'use strict';
const H = typeof module === 'object' && module.exports ? require('./history5.js') : root.HAL5History;
const DAY = 86400000, IST = 19800000, YEAR = 365 * DAY;
const finite = x => typeof x === 'number' && Number.isFinite(x);
const value = x => x === '' || x == null || typeof x === 'boolean' ? null : (Number.isFinite(Number(x)) ? Number(x) : null);
const sum = a => a.reduce((s,x) => s+x,0);
const mean = a => a.length ? sum(a)/a.length : null;
const clone = x => JSON.parse(JSON.stringify(x));
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const num = (...xs) => xs.find(finite) ?? null;
const time = x => finite(x) ? x : (typeof x === 'string' && x.trim() ? (/^\d{13}$/.test(x) ? Number(x) : Date.parse(x)) : NaN);
const iso = x => Number.isFinite(time(x)) && Math.abs(time(x))<=8640000000000000 ? new Date(time(x)).toISOString() : null;
const validDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s+'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10) === s;
const istDate = t => new Date((t == null ? Date.now() : time(t))+IST).toISOString().slice(0,10);
const expiryTime = d => validDate(d) ? Date.parse(d+'T15:30:00+05:30') : NaN;
const units = l => l.lots*l.lotSize;
const safeText = (v,n=1000) => typeof v === 'string' ? v.slice(0,n) : '';
function safeURL(s) { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password && u.hostname.includes('.') && !/^(localhost|127\.|0\.|192\.168\.|10\.|169\.254\.)/.test(u.hostname) ? u.href : null; } catch (_) { return null; } }
function fail(message) { throw new Error(message); }
function cleanJSON(x,depth=0){
 if(depth>30)fail('Backup nesting exceeds supported depth.');
 if(Array.isArray(x))return x.map(v=>cleanJSON(v,depth+1));
 if(x&&typeof x==='object'){const out={};for(const [k,v]of Object.entries(x)){if(/^(?:__proto__|prototype|constructor|api[_-]?key|gemini[_-]?(?:api[_-]?)?key|upstox[_-]?(?:access[_-]?)?token|access[_-]?token|refresh[_-]?token|token|viewer[_-]?key|authorization|password|secret|secrets|credentials|private[_-]?key|keystore|signing[_-]?password)$/i.test(k))continue;out[k]=cleanJSON(v,depth+1);}return out;}
 return x;
}
function validateLeg(input, index=0) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid leg record.');
  const l = clone(input);
  if (!['FUT','PE'].includes(l.type) || !validDate(l.expiry)) fail('Use a long HAL future or put with an exact expiry date.');
  if (!Number.isInteger(l.lots) || l.lots < 1 || l.lots > 10000) fail('Lots must be a positive whole number, at most 10,000.');
  if (!Number.isInteger(l.lotSize) || l.lotSize < 1 || l.lotSize > 100000) fail('Units per lot must be a positive verified whole number.');
  if (!finite(l.entry) || l.entry < 0 || l.entry > 1e7 || (l.type === 'FUT' && l.entry === 0)) fail('Entry price must be a valid non-negative premium or positive futures price.');
  if (l.type === 'PE' && (!finite(l.strike) || l.strike <= 0 || l.strike > 1e7)) fail('Put strike must be positive.');
  if (l.manual != null && (!finite(l.manual) || l.manual < 0 || l.manual > 1e7)) fail('Manual mark must be non-negative; zero is allowed.');
  if (l.manualAt != null && !Number.isFinite(time(l.manualAt))) fail('Invalid manual mark timestamp.');
  l.id = safeText(l.id,100) || 'leg-'+index;
  l.strike = l.type === 'PE' ? l.strike : null;
  l.manual = l.manual == null ? null : l.manual;
  l.manualAt = l.manualAt == null ? null : iso(l.manualAt);
  l.instrumentKey = safeText(l.instrumentKey || l.instrument_key,180) || null;
  return l;
}
function emptyBook() {
 return {version:4,revision:0,legs:[],journal:[],notes:[],bookmarks:[],checkpoints:[],riskProfile:{capital:null,maxLoss:null,hedgeBudget:null,reserve:null,reviewBelow:null,reviewAbove:null,confirmedAt:null,confirmedBook:null},funding:{margin:null,free:null,at:null},preferences:{theme:'dark',auto:true,markMode:'ltp'},hedge:{budget:null,maxLoss:null,protectThrough:null,buyFees:0,exitFees:0,slippage:0.5,maxSpread:10,ivShift:0,rate:6,dividend:0}};
}
function validateBook(input) {
 input=cleanJSON(input);
 if (!input || typeof input !== 'object' || Array.isArray(input) || ![2,4].includes(input.version)) fail('A HAL Desk schema 2 or 4 backup is required.');
 for (const [k,n] of [['legs',100],['journal',50000],['notes',10000],['bookmarks',5000],['checkpoints',5000]]) if (input[k] != null && (!Array.isArray(input[k]) || input[k].length > n)) fail('Invalid or excessive '+k+' records.');
 if (!Array.isArray(input.legs) || !Array.isArray(input.journal)) fail('Backup book and journal are required.');
 const out = emptyBook(); out.revision = Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 0;
 out.legs = input.legs.map(validateLeg);
 if (new Set(out.legs.map(l=>l.id)).size !== out.legs.length) fail('Duplicate leg identifiers in backup.');
 out.journal = input.journal.map((j,i) => {
  if (!j || !['close','fee','settlement','funding'].includes(j.kind) || !validDate(j.date)) fail('Invalid journal entry '+(i+1)+'.');
  const r = {id:safeText(j.id,100)||'journal-'+i,kind:j.kind,date:j.date,note:safeText(j.note,10000)};
  if (j.kind === 'close') {
   r.leg = validateLeg(j.leg,i); if (!finite(j.exit) || j.exit < 0 || !finite(j.fees) || j.fees < 0) fail('Invalid close price or charges.');
   Object.assign(r,{exit:j.exit,fees:j.fees,gross:(j.exit-r.leg.entry)*units(r.leg)});
  } else { if (!finite(j.amount) || (j.kind === 'fee' && j.amount < 0)) fail('Invalid journal cash amount.'); r.amount=j.amount; }
  return r;
 });
 if (new Set(out.journal.map(j=>j.id)).size !== out.journal.length) fail('Duplicate journal identifiers in backup.');
 out.notes = (input.notes||[]).map(n=>({id:safeText(n.id,100),date:validDate(n.date)?n.date:null,title:safeText(n.title,500),text:safeText(n.text,20000),url:safeURL(n.url)||'',category:safeText(n.category,100)||'Other',eventDate:validDate(n.eventDate)?n.eventDate:null}));
 out.bookmarks = (input.bookmarks||[]).map(n=>({title:safeText(n.title,1000),url:safeURL(n.url),published:safeText(n.published,100),source:safeText(n.source,200)})).filter(n=>n.url);
 // Checkpoints contain user-owned historical observations: preserve as JSON, never treat as live marks.
 out.checkpoints = clone(input.checkpoints||[]);
 if (input.legacy != null) {
  const l=input.legacy; if (!finite(l.realized)||!finite(l.costs)||l.costs<0||!Array.isArray(l.journal)||l.journal.length>50000) fail('Invalid legacy realised ledger.');
  out.legacy={realized:l.realized,costs:l.costs,journal:l.journal.map((j,i)=>{if(!validDate(j.date)||!['close','fee','settlement'].includes(j.kind)||!finite(j.amount))fail('Invalid legacy historical record.');return {id:safeText(j.id,100)||'legacy-'+i,kind:j.kind,date:j.date,amount:j.amount,note:safeText(j.note,10000)};})};
 }
 const f=input.funding||{}; for(const k of ['margin','free']) {if(f[k]!=null&&(!finite(f[k])||f[k]<0))fail('Invalid funding snapshot.');out.funding[k]=f[k]??null;} out.funding.at=f.at==null?null:iso(f.at);
 const p=input.preferences||{}; out.preferences={theme:['dark','light','system'].includes(p.theme)?p.theme:'dark',auto:p.auto!==false,markMode:p.markMode==='bid'?'bid':'ltp'};
 for(const k of ['capital','maxLoss','hedgeBudget','reserve','reviewBelow','reviewAbove']) {const v=input.riskProfile?.[k];if(v!=null&&(!finite(v)||v<0))fail('Invalid risk limit '+k+'.');out.riskProfile[k]=v??null;}
 if(finite(out.riskProfile.reviewBelow)&&finite(out.riskProfile.reviewAbove)&&out.riskProfile.reviewBelow>=out.riskProfile.reviewAbove)fail('Lower review trigger must be below the upper trigger.');
 out.riskProfile.confirmedAt=iso(input.riskProfile?.confirmedAt);out.riskProfile.confirmedBook=safeText(input.riskProfile?.confirmedBook,50000)||null;
 out.hedge=hedgePreferences(input.hedge||{});
 // Removed rollover UI settings are archived losslessly, never interpreted as pending trades.
 if(input.rollover!=null)out.legacyRolloverPreferences=clone(input.rollover);
 if(input.legacyRolloverPreferences!=null)out.legacyRolloverPreferences=clone(input.legacyRolloverPreferences);
 if(input.migration!=null)out.migration=clone(input.migration);
 if(input.history!=null)out.history=H.validate(input.history,out);
 if(input.version===2)out.migration={fromVersion:2,reviewRequired:true};
 return out;
}
function contractKey(c) { return c.instrumentKey || c.instrument_key || c.key || null; }
function normContract(c) {
 return {instrumentKey:contractKey(c),type:c.type||c.instrument_type,expiry:c.expiry,strike:num(c.strike,c.strike_price),lotSize:num(c.lotSize,c.lot_size),symbol:c.symbol||c.trading_symbol||null};
}
function normQuote(q={}, fallback={}) {
 const depth=q.depth||{};const buy=depth.buy?.[0]||{},sell=depth.sell?.[0]||{};
 const g=q.greeks||q.option_greeks||{};
 return {price:num(q.price,q.last_price,q.ltp),bid:num(q.bid,q.bid_price,buy.price),ask:num(q.ask,q.ask_price,sell.price),bidQty:num(q.bidQty,q.bid_qty,q.bid_quantity,buy.quantity),askQty:num(q.askQty,q.ask_qty,q.ask_quantity,sell.quantity),quoteAt:iso(q.quoteAt??q.quote_as_of??q.timestamp??fallback.quoteAt),tradeAt:iso(q.tradeAt??q.last_trade_at??q.last_trade_time??q.ltt),retrievedAt:iso(q.retrievedAt??q.retrieved_at??q.fetched_at_iso??fallback.retrievedAt),source:q.source||fallback.source||'REST',delta:num(q.delta,g.delta),theta:num(q.theta,g.theta),iv:num(q.iv,g.iv),greeksAt:iso(q.greeksAt??q.greeks_timestamp),thetaPerDayVerified:q.thetaPerDayVerified===true||q.theta_unit_verified===true,volume:num(q.volume,q.volume_traded),oi:num(q.oi,q.open_interest),previousOi:num(q.previousOi,q.previous_oi),previousClose:num(q.previousClose,q.prev_close,q.prev_close_price,q.ohlc?.close),lastSuccess:iso(q.lastSuccess??fallback.lastSuccess),lastFailure:iso(q.lastFailure??fallback.lastFailure),failure:safeText(q.failure||fallback.failure,500)||null};
}
function normalizeMarket(input={}) {
 const out={contracts:[],quotes:{},spot:normQuote(input.spot||{}, {retrievedAt:input.fetched_at_iso}),marketOpen:input.marketOpen??null,lastSuccess:iso(input.lastSuccess??input.fetched_at_iso),lastFailure:iso(input.lastFailure),failure:input.failure||null};
 const seen=new Set(); const add=(raw,quote) => {const c=normContract(raw);if(!c.instrumentKey)c.instrumentKey=[c.type,c.expiry,c.strike??''].join('|');if(!seen.has(c.instrumentKey)){out.contracts.push(c);seen.add(c.instrumentKey);}if(quote)out.quotes[c.instrumentKey]=normQuote(quote,{retrievedAt:input.fetched_at_iso,lastSuccess:out.lastSuccess,lastFailure:out.lastFailure,failure:out.failure});};
 for(const c of input.contracts||[])add(c,input.quotes?.[contractKey(c)]||c.quote);
 for(const [key,q] of Object.entries(input.quotes||{}))out.quotes[key]=normQuote(q,{retrievedAt:input.fetched_at_iso,lastSuccess:out.lastSuccess,lastFailure:out.lastFailure,failure:out.failure});
 for(const f of input.futures||[])add({...f,type:'FUT'},f.quote||f);
 const chains={};if(input.option_expiry)chains[input.option_expiry]=input;Object.assign(chains,input.chains||{});
 for(const [expiry,chain] of Object.entries(chains))for(const row of chain.option_rows||[])if(row.put)add({...row.put,type:'PE',expiry,strike:row.strike}, {...row.put,...(row.put.quote||{})});
 const held=input.held_contracts||input.heldContracts||[];
 for(const h of Array.isArray(held)?held:Object.values(held))add(h,h.quote||h);
 return out;
}
function quoteQuality(q, opts={}) {
 const now=opts.now==null?Date.now():time(opts.now),maxAge=opts.maxAge??120000,maxTradeAge=opts.maxTradeAge??120000,futureTolerance=opts.futureTolerance??5000;
 const reasons=[],warnings=[];const quoteAt=time(q?.quoteAt),tradeAt=time(q?.tradeAt),retrievedAt=time(q?.retrievedAt);
 if(!q)reasons.push('Quote unavailable');
 if(!finite(q?.price)||q.price<0)reasons.push('Price unavailable or invalid');
 if(q?.source==='STREAM')reasons.push('Streaming preview cannot be used as a valuation mark');
 if(!Number.isFinite(quoteAt))reasons.push('Provider quote timestamp unavailable');
 for(const [label,t] of [['Provider quote',quoteAt],['Last trade',tradeAt],['Retrieval',retrievedAt]])if(Number.isFinite(t)&&t>now+futureTolerance)reasons.push(label+' timestamp is in the future');
 if(!Number.isFinite(retrievedAt))warnings.push('HTTP retrieval timestamp unavailable');
 if(!Number.isFinite(tradeAt)) (opts.requireTrade?reasons:warnings).push('Last exchange trade timestamp unavailable');
 const quoteStale=Number.isFinite(quoteAt)&&now-quoteAt>maxAge,tradeStale=Number.isFinite(tradeAt)&&now-tradeAt>maxTradeAge;
 if(quoteStale)warnings.push('Provider quote is older than '+maxAge/1000+' seconds');
 if(tradeStale)warnings.push('Last trade is older than '+maxTradeAge/1000+' seconds');
 if(opts.requireFresh&&quoteStale)reasons.push('Stale provider quote');
 if(opts.requireTrade&&tradeStale)reasons.push('Stale last exchange trade');
 if(q?.source==='CACHE')warnings.push('Cached observation');
 const failed=!!q?.failure||Number.isFinite(time(q?.lastFailure))&&(!Number.isFinite(time(q?.lastSuccess))||time(q.lastFailure)>time(q.lastSuccess));if(failed)warnings.push('Refresh failed; previous observation retained');if(opts.requireFresh&&(failed||q?.source==='CACHE'))reasons.push('A successful fresh REST refresh is required');
 return {valid:reasons.length===0,fresh:reasons.length===0&&!quoteStale&&!tradeStale&&Number.isFinite(tradeAt),status:reasons.length?'unavailable':quoteStale||tradeStale||q?.source==='CACHE'||failed?'stale':'current',reasons,warnings,quoteAge:Number.isFinite(quoteAt)?now-quoteAt:null,tradeAge:Number.isFinite(tradeAt)?now-tradeAt:null,quoteAt:iso(quoteAt),tradeAt:iso(tradeAt),retrievedAt:iso(retrievedAt)};
}
function matchContract(leg, market) {
 const m=market?.contracts?market:normalizeMarket(market),exact=m.contracts.filter(c=>c.type===leg.type&&c.expiry===leg.expiry&&(leg.type!=='PE'||c.strike===leg.strike));
 const chosen=leg.instrumentKey?exact.find(c=>c.instrumentKey===leg.instrumentKey):exact.length===1?exact[0]:null;
 if(!chosen)return {contract:null,error:leg.instrumentKey?'Saved instrument key does not match an exact listed contract':exact.length>1?'Ambiguous contract; save its exact instrument key':'Exact listed contract unavailable',mismatch:false};
 if(chosen.lotSize!==leg.lotSize)return {contract:chosen,error:'Saved lot size differs from the provider contract',mismatch:true};
 return {contract:chosen,error:null,mismatch:false};
}
function resolveMark(leg, input={}, opts={}) {
 const market=normalizeMarket(input),match=matchContract(leg,market),now=opts.now==null?Date.now():time(opts.now),warnings=[];
 const base={price:null,source:'Unavailable',status:'unavailable',quoteAt:null,tradeAt:null,retrievedAt:null,warnings,contract:match.contract,mismatch:match.mismatch};
 if(match.mismatch)return {...base,warnings:[match.error]};
 if(finite(leg.manual)) {
  const t=time(leg.manualAt);if(Number.isFinite(t)&&t>now+5000)return {...base,warnings:['Manual mark timestamp is in the future']};
  if(!Number.isFinite(t))warnings.push('Manual mark timestamp unavailable');
  if(match.error)warnings.push(match.error+'; manual valuation uses the saved quantity');
  return {...base,price:leg.manual,source:'Manual',status:'manual',quoteAt:iso(t),warnings};
 }
 if(match.error)return {...base,warnings:[match.error]};
 const q=market.quotes[match.contract.instrumentKey],quality=quoteQuality(q,{now});
 if(!quality.valid)return {...base,...quality,warnings:[...quality.reasons,...quality.warnings],source:q?.source||'Unavailable'};
 const price=opts.markMode==='bid'&&leg.type==='PE'?q.bid:q.price;
 if(!finite(price)||price<0)return {...base,warnings:['Required mark price unavailable']};
 if(expiryTime(leg.expiry)<now)warnings.push('Expired open leg needs actual close or settlement reconciliation');
 return {...base,...quality,price,source:q.source==='CACHE'?'Cached REST':opts.markMode==='bid'&&leg.type==='PE'?'REST bid':'REST LTP',warnings:[...warnings,...quality.warnings],quote:q};
}
function ledger(book,input={},opts={}) {
 const b=validateBook(book);const rows=b.legs.map(leg=>{const mark=resolveMark(leg,input,{...opts,markMode:opts.markMode||b.preferences.markMode});return {leg,mark,units:units(leg),pnl:finite(mark.price)?(mark.price-leg.entry)*units(leg):null};});
 const complete=rows.every(r=>finite(r.pnl)),open=complete?sum(rows.map(r=>r.pnl)):null;
 const {realized, charges} = H.totals(b);
 return {rows,open,realized,charges,net:complete?realized+open-charges:null,complete,openPutPremium:sum(b.legs.filter(l=>l.type==='PE').map(l=>l.entry*units(l))),settlements:sum(b.journal.filter(j=>j.kind==='settlement').map(j=>j.amount)),fundingMovements:sum(b.journal.filter(j=>j.kind==='funding').map(j=>j.amount)),unavailableLegs:rows.filter(r=>r.pnl===null).map(r=>r.leg.id),manual:rows.some(r=>r.mark.source==='Manual'),stale:rows.some(r=>r.mark.status==='stale')};
}
function closeLeg(book, idOrIndex, lots, exit, fees, date, options={}) {
 const b=validateBook(book),index=typeof idOrIndex==='number'?idOrIndex:b.legs.findIndex(l=>l.id===idOrIndex),leg=b.legs[index],now=options.now==null?Date.now():time(options.now);
 if(!leg||!Number.isInteger(lots)||lots<1||lots>leg.lots||!finite(exit)||exit<0||!finite(fees)||fees<0||!validDate(date)||date>istDate(now))fail('Check closed lots, actual exit price, charges and completed trade date.');
 const id=options.id||'close-'+now+'-'+b.journal.length;if(b.journal.some(j=>j.id===id))fail('Duplicate close transaction identifier.');
 const record={id,kind:'close',date,note:safeText(options.note,10000),leg:{...leg,lots},exit,fees,gross:(exit-leg.entry)*lots*leg.lotSize};
 b.journal.push(record);if(lots===leg.lots)b.legs.splice(index,1);else b.legs[index].lots-=lots;
 b.revision++;b.riskProfile.confirmedAt=null;b.riskProfile.confirmedBook=null;return b;
}
function recordCash(book,kind,amount,date,note='',opts={}) {
 const b=validateBook(book),now=opts.now==null?Date.now():time(opts.now);
 if(!['fee','settlement','funding'].includes(kind)||!finite(amount)||(kind==='fee'&&amount<0)||!validDate(date)||date>istDate(now))fail('Invalid completed cash journal movement.');
 const id=opts.id||kind+'-'+now+'-'+b.journal.length;if(b.journal.some(j=>j.id===id))fail('Duplicate journal transaction identifier.');
 b.journal.push({id,kind,amount,date,note:safeText(note,10000)});b.revision++;return b;
}
function validGreeks(q,now=Date.now()) {return !!q&&Number.isFinite(time(q.greeksAt))&&time(q.greeksAt)<=time(now)+5000&&time(now)-time(q.greeksAt)<=120000&&finite(q.delta)&&q.delta>=-1&&q.delta<=0&&finite(q.theta)&&finite(q.iv)&&q.iv>0&&q.iv<=500;}
function risk(legsOrBook, input={}, now=Date.now()) {
 now=time(now);const book=Array.isArray(legsOrBook)?{...emptyBook(),legs:legsOrBook}:validateBook(legsOrBook),legs=book.legs.map(validateLeg),market=normalizeMarket(input),active=legs.filter(l=>expiryTime(l.expiry)>=now),futures=active.filter(l=>l.type==='FUT'),puts=active.filter(l=>l.type==='PE');
 const futureUnits=sum(futures.map(units)),putUnits=sum(puts.map(units)),coveredUnits=Math.min(futureUnits,putUnits),warnings=[],mismatches=[];
 let delta=futureUnits,theta=0,greeksComplete=true,thetaComplete=true;
 for(const leg of active) {
  const match=matchContract(leg,market);if(match.error){mismatches.push({legId:leg.id,reason:match.error});greeksComplete=false;continue;}
  if(leg.type==='PE') {const q=market.quotes[match.contract.instrumentKey],quality=quoteQuality(q,{now,requireFresh:true,requireTrade:true});if(!quality.valid||!validGreeks(q,now)){greeksComplete=false;continue;}delta+=q.delta*units(leg);if(q.thetaPerDayVerified)theta+=q.theta*units(leg);else thetaComplete=false;}
 }
 if(!futureUnits&&!putUnits){delta=0;theta=0;greeksComplete=true;}
 const dates=[...new Set(active.map(l=>l.expiry))].sort(),timeline=dates.map(date=>{const f=sum(futures.filter(l=>l.expiry>date).map(units)),p=sum(puts.filter(l=>l.expiry>date).map(units));return {date,futureUnits:f,putUnits:p,coveredUnits:Math.min(f,p),uncoveredUnits:Math.max(0,f-p),expiring:active.filter(l=>l.expiry===date).map(l=>l.id)};});
 const add=(code,title,detail)=>warnings.push({code,title,detail});
 if(legs.some(l=>expiryTime(l.expiry)<now))add('expired','Expired leg needs reconciliation','Record the actual close or settlement; expired legs are excluded from active quantity and Greeks.');
 if(futureUnits>putUnits)add('quantity_gap','Incomplete quantity coverage',(futureUnits-putUnits)+' futures units have no corresponding active put quantity.');
 if(putUnits>futureUnits)add('overhedged','Put quantity exceeds futures quantity',(putUnits-futureUnits)+' additional put units are a separate directional exposure.');
 const gap=timeline.find(t=>t.uncoveredUnits>0);if(gap)add('expiry_gap','Protection expires before futures','After '+gap.date+', '+gap.uncoveredUnits+' futures units remain without matching active put quantity.');
 if(new Set(puts.map(l=>l.strike)).size>1)add('strike_distribution','Protection spans several strikes','Equal quantity does not mean equal downside protection: review each strike.');
 if(mismatches.length)add('contract_mismatch','Contract specifications need verification',mismatches.map(m=>m.reason).join('; '));
 if(!greeksComplete||!thetaComplete)add('greeks_missing','Aggregate Greeks unavailable','Every active contract must match and every put needs valid, recent contract Greeks with their own timestamps. Theta also needs a verified per-day unit convention.');
 if(active.some(l=>expiryTime(l.expiry)-now<=7*DAY))add('near_expiry','Contract expiry within seven days','Review margin, exercise, delivery obligations and broker deadlines. No automatic rollover is assumed.');
 if(futureUnits)add('margin','Futures margin and physical settlement','Mark-to-market cash calls can occur before expiry. Stock derivatives may require physical delivery; confirm broker obligations and deadlines.');
 const rp=book.riskProfile||{},spot=market.spot.price;if(finite(spot)&&finite(rp.reviewBelow)&&spot<=rp.reviewBelow)add('lower_review','Lower review threshold crossed','Observed spot is at or below your saved review level. This is a review prompt, not an order.');if(finite(spot)&&finite(rp.reviewAbove)&&spot>=rp.reviewAbove)add('upper_review','Upper review threshold crossed','Observed spot is at or above your saved review level.');
 const valuation=ledger(book,market,{now});if(finite(rp.maxLoss)&&rp.maxLoss>0&&finite(valuation.net)&&valuation.net<=-rp.maxLoss)add('loss_limit','Recorded strategy loss review threshold crossed','Indicative strategy net P&L has reached your review threshold. This is not a guaranteed loss limit.');if(finite(rp.reserve)&&finite(book.funding.free)&&book.funding.free<rp.reserve)add('reserve','Recorded cash reserve below threshold','Review the age of your manual funding snapshot and current broker cash requirements.');if(legs.length&&!rp.confirmedAt)add('unconfirmed','Book not confirmed against broker','Confirm exact lots, entries, expiries and completed closes against your broker records.');
 const distribution=puts.map(l=>({legId:l.id,strike:l.strike,expiry:l.expiry,lots:l.lots,lotSize:l.lotSize,units:units(l)}));
 return {futureUnits,futureLots:sum(futures.map(l=>l.lots)),putUnits,putLots:sum(puts.map(l=>l.lots)),coveredUnits,uncoveredUnits:Math.max(0,futureUnits-putUnits),coverage:futureUnits?putUnits/futureUnits*100:null,delta:greeksComplete?delta:null,theta:greeksComplete&&thetaComplete?theta:null,greeksComplete:greeksComplete&&thetaComplete,deltaComplete:greeksComplete,thetaComplete:greeksComplete&&thetaComplete,nextExpiry:dates[0]||null,timeline,warnings,distribution,mismatches,openPutPremium:sum(puts.map(l=>l.entry*units(l))),coverageMeaning:'Quantity overlap at this time only; strike, basis and expiry still affect protection.'};
}
function cdf(x) {const t=1/(1+0.2316419*Math.abs(x)),d=0.3989422804014327*Math.exp(-x*x/2),p=1-d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p;}
function putPrice(S,K,T,vol,r=0.06,q=0) {
 if(![S,K,T,vol,r,q].every(finite)||S<0||K<=0||T<0||vol<0)fail('Invalid Black–Scholes inputs.');
 if(T===0)return Math.max(K-S,0);if(S===0)return K*Math.exp(-r*T);if(vol===0)return Math.max(K*Math.exp(-r*T)-S*Math.exp(-q*T),0);
 const d1=(Math.log(S/K)+(r-q+vol*vol/2)*T)/(vol*Math.sqrt(T)),d2=d1-vol*Math.sqrt(T);
 return Math.max(0,K*Math.exp(-r*T)*cdf(-d2)-S*Math.exp(-q*T)*cdf(-d1));
}
function scenario(legsOrBook,input={},params={},now=Date.now()) {
 const result={rows:[],total:null,horizon:null,complete:false,errors:[],assumptions:[],kind:'model'};
 try {
  now=time(now);if(!finite(now))fail('Invalid calculation time.');const legs=(Array.isArray(legsOrBook)?legsOrBook:legsOrBook.legs).map(validateLeg),market=normalizeMarket(input),spot=params.spot,rate=params.rate??6,dividend=params.dividend??0,ivShift=params.ivShift??0,basis=params.basis||'constant';
  const horizon=params.horizon!=null?(validDate(params.horizon)?expiryTime(params.horizon):time(params.horizon)):now+(params.days??0)*DAY;result.horizon=iso(horizon);
  if(!finite(spot)||spot<0||!finite(horizon)||horizon<now||![rate,dividend,ivShift].every(finite)||rate< -10||rate>100||dividend<0||dividend>100||!['constant','decay','carry'].includes(basis))fail('Check scenario spot, horizon, interest, dividend, IV and basis assumptions.');
  if(legs.some(l=>expiryTime(l.expiry)<now))fail('Reconcile expired open legs before modelling.');
  if(legs.some(l=>horizon>expiryTime(l.expiry)))fail('Horizon exceeds an open-leg expiry. A later hypothetical price cannot determine an earlier settlement.');
  const needsBase=basis!=='carry'&&legs.some(l=>l.type==='FUT'&&horizon<expiryTime(l.expiry)),baseSpot=finite(params.baseSpot)?params.baseSpot:market.spot.price;
  if(needsBase&&(!finite(baseSpot)||baseSpot<=0))fail('A valid separately observed base spot is required for futures basis modelling.');
  result.assumptions=['European Black–Scholes put model; ACT/365 time; interest and dividend are explicit annual percentage assumptions.','Scenario P&L is measured from saved entry prices; historical realised P&L and charges are separate.','Futures basis: '+basis+'. No future rollover, path-dependent settlement, margin cash flow or execution guarantee is inferred.'];
  if(needsBase&&finite(params.baseSpot))result.assumptions.push('Base spot is a user-supplied model input.');else if(needsBase&&market.spot.price!=null){const sq=quoteQuality(market.spot,{now});if(!sq.valid)fail('Base spot source is invalid: '+sq.reasons.join('; '));if(sq.status==='stale')result.assumptions.push('Base spot is stale; model output is based on the labelled cached observation.');}
  for(const leg of legs) {
   const expiry=expiryTime(leg.expiry),T=Math.max(0,(expiry-horizon)/YEAR),match=matchContract(leg,market);if(match.mismatch)fail('Lot size mismatch for '+leg.id+'.');
   let modelPrice,iv=null;
   if(leg.type==='FUT') {
    if(T===0)modelPrice=spot;
    else if(basis==='carry')modelPrice=spot*Math.exp((rate-dividend)/100*T);
    else {const mark=resolveMark(leg,market,{now});if(!finite(mark.price))fail('Current futures mark required for '+leg.id+'.');const initialBasis=mark.price-baseSpot;modelPrice=spot+initialBasis*(basis==='decay'?(expiry-horizon)/(expiry-now):1);if(modelPrice<0)fail('Futures basis assumption produced a negative price.');}
   } else {
    if(T===0)modelPrice=Math.max(leg.strike-spot,0);
    else {const q=match.contract?market.quotes[match.contract.instrumentKey]:null;const explicit=params.ivByLeg?.[leg.id]??params.fallbackIV;
     if(finite(explicit))iv=explicit;else if(q&&quoteQuality(q,{now,requireFresh:true,requireTrade:true}).valid&&finite(q.iv)&&q.iv>0&&q.iv<=500&&Number.isFinite(time(q.greeksAt))&&time(q.greeksAt)<=now+5000&&now-time(q.greeksAt)<=120000)iv=q.iv;
     if(!finite(iv))fail('Valid put IV unavailable for '+leg.id+'; enter an explicit IV assumption.');iv+=ivShift;if(iv<0||iv>500)fail('Scenario IV must be from 0% to 500%.');
     modelPrice=putPrice(spot,leg.strike,T,iv/100,rate/100,dividend/100);
    }
   }
   result.rows.push({leg,modelPrice,iv,units:units(leg),pnl:(modelPrice-leg.entry)*units(leg),kind:T===0?'expiry payoff':'model estimate'});
  }
  result.total=sum(result.rows.map(r=>r.pnl));result.complete=true;result.kind=result.rows.every(r=>r.kind==='expiry payoff')?'exact expiry payoff':'model estimate';
  return result;
 } catch(e) {result.errors.push(e.message);result.total=null;return result;}
}
function payoff(legs,spot) {if(new Set(legs.map(l=>l.expiry)).size!==1)fail('A direct combined expiry payoff requires one common expiry.');if(!finite(spot)||spot<0)fail('Invalid settlement spot.');return sum(legs.map((l,i)=>{validateLeg(l,i);return ((l.type==='FUT'?spot:Math.max(l.strike-spot,0))-l.entry)*units(l);}));}
function hedgePreferences(input={}) {
 const out={budget:null,maxLoss:null,protectThrough:null,buyFees:0,exitFees:0,slippage:0.5,maxSpread:10,ivShift:0,fallbackIV:null,rate:6,dividend:0,minVolume:1,minOI:1,maxAge:120000,maxTradeAge:120000};
 const ranges={budget:[0,1e12],maxLoss:[0,1e12],buyFees:[0,1e9],exitFees:[0,1e9],slippage:[0,10],maxSpread:[0,100],ivShift:[-500,500],fallbackIV:[0,500],rate:[-10,100],dividend:[0,100],minVolume:[0,1e12],minOI:[0,1e12],maxAge:[1000,86400000],maxTradeAge:[1000,86400000]};
 for(const [k,[lo,hi]]of Object.entries(ranges))if(input[k]!=null){if(!finite(input[k])||input[k]<lo||input[k]>hi)fail('Invalid hedge setting '+k+'.');out[k]=input[k];}
 if(input.protectThrough!=null){if(!validDate(input.protectThrough))fail('Invalid protection-through date.');out.protectThrough=input.protectThrough;}
 if(input.shocks!=null){if(!Array.isArray(input.shocks)||!input.shocks.length||input.shocks.length>30||input.shocks.some(x=>!finite(x)||x< -1||x>2))fail('Invalid shock grid.');out.shocks=[...input.shocks];}
 if(input.horizons!=null){if(!Array.isArray(input.horizons)||!input.horizons.length||input.horizons.length>20)fail('Invalid horizon grid.');out.horizons=[...input.horizons];}
 return out;
}
function findHedges(book,input={},settings={},now=Date.now()) {
 const result={candidates:[],excluded:[],rankings:{lowerCost:null,balanced:null,strongerProtection:null},errors:[],assumptions:[],current:[],currentErrors:[]};
 try {
  now=time(now);const b=validateBook(book),market=normalizeMarket(input),p=hedgePreferences(settings),futures=b.legs.filter(l=>l.type==='FUT'),puts=b.legs.filter(l=>l.type==='PE'),futureUnits=sum(futures.map(units));
  if(!futureUnits)fail('Record and confirm a long futures position before comparing protective puts.');
  if(b.legs.some(l=>expiryTime(l.expiry)<now))fail('Reconcile expired legs before hedge comparison.');
  if(!validDate(p.protectThrough)||expiryTime(p.protectThrough)<now)fail('Choose a current or future protection-through date.');
  if(!finite(p.budget)||!finite(p.maxLoss))fail('Enter a new-purchase budget and maximum acceptable sampled additional loss.');
  const spot=market.spot.price,sq=quoteQuality(market.spot,{now,requireFresh:true,requireTrade:true,maxAge:p.maxAge,maxTradeAge:p.maxTradeAge});if(!sq.valid||!finite(spot)||spot<=0)fail('Spot quote fails freshness/source checks: '+sq.reasons.join('; '));
  const startingFutures=[];for(const leg of futures){const match=matchContract(leg,market),q=match.contract?market.quotes[match.contract.instrumentKey]:null;if(match.error||!quoteQuality(q,{now,requireFresh:true,requireTrade:true,maxAge:p.maxAge,maxTradeAge:p.maxTradeAge}).valid)fail('Exact current futures quote/specification unavailable for '+leg.id+'.');startingFutures.push({...leg,entry:q.price,manual:null});}
  let saleProceeds=0,oldBidValue=0;const sales=new Map();
  for(const leg of puts){const match=matchContract(leg,market);if(match.error)fail('Existing-put sale price or sufficient displayed bid quantity unavailable for '+leg.id+'.');const key=match.contract.instrumentKey;sales.set(key,(sales.get(key)||0)+units(leg));}
  for(const [key,quantity]of sales){const q=market.quotes[key];if(!quoteQuality(q,{now,requireFresh:true,requireTrade:true,maxAge:p.maxAge,maxTradeAge:p.maxTradeAge}).valid||!finite(q.bid)||q.bid<0||!finite(q.bidQty)||q.bidQty<quantity)fail('Existing-put sale price or sufficient combined displayed bid quantity unavailable for '+key+'.');oldBidValue+=q.bid*quantity;saleProceeds+=q.bid*(1-p.slippage/100)*quantity;}
  const shocks=p.shocks||[0,-0.03,-0.05,-0.10],earliestFutures=Math.min(...futures.map(l=>expiryTime(l.expiry))),target=expiryTime(p.protectThrough),defaultHorizon=Math.min(target,earliestFutures),horizons=p.horizons||[now,defaultHorizon];
  const times=[...new Set(horizons.map(h=>validDate(h)?expiryTime(h):time(h)))].sort((a,b)=>a-b);
  if(times.some(t=>!finite(t)||t<now||t>earliestFutures))fail('Each scenario horizon must be current/future and no later than the earliest futures expiry.');
  result.assumptions=['Candidates replace all recorded existing puts; exact whole-lot coverage of all current futures units.','New purchase uses ask plus '+p.slippage+'% slippage; old-put proceeds use bid less the same percentage. Displayed depth is a screen, not a fill guarantee.','Budget applies to gross new premium plus buy charges before any sale proceeds.','Sampled additional loss is measured from current futures marks and pays new premium plus buy/exit charges. Existing-put sale proceeds reduce cash needed, not model profit.','Balanced score = 50% normalized gross purchase cost + 50% normalized sampled worst loss among eligible candidates.','Sampled worst loss is not a guaranteed maximum loss; no future rollover is assumed.',
   finite(p.fallbackIV)?'All candidate and existing puts use an explicit user-assumed '+p.fallbackIV+'% IV. Provider Greeks and their timestamps are not treated as verified.':'Without an explicit IV assumption, provider put IV and Greeks require their own verified source timestamps.'];
  const currentBasis=[...startingFutures,...puts.map(l=>{const match=matchContract(l,market),q=market.quotes[match.contract.instrumentKey];return {...l,entry:q.bid,manual:null};})];
  for(const t of times)for(const shock of shocks){const s=scenario(currentBasis,market,{spot:spot*(1+shock),horizon:t,ivShift:p.ivShift,fallbackIV:p.fallbackIV,rate:p.rate,dividend:p.dividend},now);if(s.complete)result.current.push({horizon:s.horizon,shock,spot:spot*(1+shock),additionalPnl:s.total});else result.currentErrors.push({horizon:iso(t),shock,reason:s.errors.join('; ')});}
  for(const contract of market.contracts.filter(c=>c.type==='PE')) {
   const reasons=[],q=market.quotes[contract.instrumentKey],quality=quoteQuality(q,{now,requireFresh:true,requireTrade:true,maxAge:p.maxAge,maxTradeAge:p.maxTradeAge});
   if(!validDate(contract.expiry)||expiryTime(contract.expiry)<target)reasons.push('Expiry precedes protection-through date');
   if(!Number.isInteger(contract.lotSize)||contract.lotSize<=0||futureUnits%contract.lotSize!==0)reasons.push('Whole lots cannot exactly cover futures units');
   if(!finite(contract.strike)||contract.strike<=0)reasons.push('Invalid strike');
   reasons.push(...quality.reasons);
   if(!finite(q?.bid)||!finite(q?.ask)||q.bid<0||q.ask<=0||q.ask<q.bid)reasons.push('Invalid two-sided bid/ask');
   const spread=finite(q?.ask)&&finite(q?.bid)&&q.ask>0?(q.ask-q.bid)/((q.ask+q.bid)/2)*100:null;
   if(!finite(spread)||spread>p.maxSpread)reasons.push('Bid/ask spread exceeds limit');
   if(!finite(q?.askQty)||q.askQty<futureUnits||!finite(q?.bidQty)||q.bidQty<=0)reasons.push('Displayed depth is missing or insufficient');
   if(!finite(q?.volume)||q.volume<p.minVolume)reasons.push('Volume unavailable or below minimum');
   if(!finite(q?.oi)||q.oi<p.minOI)reasons.push('Open interest unavailable or below minimum');
   if(!validGreeks(q,now)&&!finite(p.fallbackIV))reasons.push('Verified put Greeks unavailable; enter an explicit IV assumption (%) to compare model scenarios');
   const lots=Number.isInteger(contract.lotSize)&&contract.lotSize>0?futureUnits/contract.lotSize:null,purchasePrice=finite(q?.ask)?q.ask*(1+p.slippage/100):null,newPremium=finite(purchasePrice)?purchasePrice*futureUnits:null,grossCost=finite(newPremium)?newPremium+p.buyFees:null;
   if(finite(grossCost)&&grossCost>p.budget)reasons.push('Gross new-hedge cost exceeds budget');
   if(times.some(t=>t>expiryTime(contract.expiry)))reasons.push('Scenario horizon exceeds candidate expiry');
   if(reasons.length){result.excluded.push({contract,reasons:[...new Set(reasons)]});continue;}
   const candidateLeg={id:'candidate-'+contract.instrumentKey,type:'PE',expiry:contract.expiry,strike:contract.strike,lots,lotSize:contract.lotSize,entry:purchasePrice,manual:null,instrumentKey:contract.instrumentKey},scenarios=[];
   for(const t of times)for(const shock of shocks){const s=scenario([...startingFutures,candidateLeg],market,{spot:spot*(1+shock),horizon:t,ivShift:p.ivShift,fallbackIV:p.fallbackIV,rate:p.rate,dividend:p.dividend},now);if(!s.complete)reasons.push(...s.errors);else scenarios.push({horizon:s.horizon,shock,spot:spot*(1+shock),additionalPnl:s.total-p.buyFees-p.exitFees-(oldBidValue-saleProceeds),rows:s.rows});}
   const worstLoss=scenarios.length?Math.max(0,-Math.min(...scenarios.map(s=>s.additionalPnl))):null;if(finite(worstLoss)&&worstLoss>p.maxLoss)reasons.push('Sampled additional loss exceeds limit');
   if(reasons.length){result.excluded.push({contract,reasons:[...new Set(reasons)]});continue;}
   result.candidates.push({contract,lots,units:futureUnits,ivSource:finite(p.fallbackIV)?'user-assumed':'verified-provider',ivAssumption:finite(p.fallbackIV)?p.fallbackIV:null,newPremium,grossCost,saleProceeds,netCashRequired:grossCost+p.exitFees-saleProceeds,buyFees:p.buyFees,exitFees:p.exitFees,existingExitSlippage:oldBidValue-saleProceeds,slippage:p.slippage,spread,worstLoss,scenarios,quoteQuality:quality,expiryGap:contract.expiry<futures.map(l=>l.expiry).sort().at(-1),selectionChangesBook:false});
  }
  const cs=result.candidates;if(cs.length){const minCost=Math.min(...cs.map(c=>c.grossCost)),maxCost=Math.max(...cs.map(c=>c.grossCost)),minLoss=Math.min(...cs.map(c=>c.worstLoss)),maxLoss=Math.max(...cs.map(c=>c.worstLoss));for(const c of cs)c.balancedScore=0.5*(maxCost===minCost?0:(c.grossCost-minCost)/(maxCost-minCost))+0.5*(maxLoss===minLoss?0:(c.worstLoss-minLoss)/(maxLoss-minLoss));const tie=(a,b)=>a.contract.instrumentKey.localeCompare(b.contract.instrumentKey);result.rankings.lowerCost=[...cs].sort((a,b)=>a.grossCost-b.grossCost||a.worstLoss-b.worstLoss||tie(a,b))[0];result.rankings.strongerProtection=[...cs].sort((a,b)=>a.worstLoss-b.worstLoss||a.grossCost-b.grossCost||tie(a,b))[0];result.rankings.balanced=[...cs].sort((a,b)=>a.balancedScore-b.balancedScore||a.grossCost-b.grossCost||tie(a,b))[0];}
  if(!cs.length)result.errors.push('No listed put passes all chosen checks. Review the excluded reasons; no recommendation was forced.');return result;
 } catch(e) {result.errors.push(e.message);return result;}
}
function candles(raw) {
 const map=new Map(),conflicts=new Set();
 for(const x of Array.isArray(raw)?raw:[]) {
  if(!x||typeof x!=='object')continue;
  const r=Array.isArray(x)?{t:time(x[0]),o:x[1],h:x[2],l:x[3],c:x[4],v:x[5],oi:num(x[6])}:{t:time(x.t??x.time??x.timestamp),o:num(x.o,x.open),h:num(x.h,x.high),l:num(x.l,x.low),c:num(x.c,x.close),v:num(x.v,x.volume),oi:num(x.oi)};
  if(!finite(r.t)||![r.o,r.h,r.l,r.c,r.v].every(finite)||Math.min(r.o,r.h,r.l,r.c)<=0||r.v<0||r.h<Math.max(r.o,r.c,r.l)||r.l>Math.min(r.o,r.c,r.h))continue;
  if(map.has(r.t)&&JSON.stringify(map.get(r.t))!==JSON.stringify(r)){conflicts.add(r.t);continue;}map.set(r.t,r);
 }
 return [...map.values()].filter(r=>!conflicts.has(r.t)).sort((a,b)=>a.t-b.t);
}
function completed(rows,frame='D',now=Date.now()) {
 now=time(now);const daily=['D','daily','day'].includes(frame),duration=['15m','15minute','15minutes'].includes(frame)?900000:3600000;
 return rows.filter(r=>finite(r?.t)&&r.t<=now&&(daily?now>=Date.parse(istDate(r.t)+'T15:30:00+05:30'):r.t+duration<=now));
}
function sma(values,n) {
 if(!Number.isInteger(n)||n<1)fail('Invalid moving-average period.');const out=[];let acc=0,bad=0;
 for(let i=0;i<values.length;i++){if(finite(values[i]))acc+=values[i];else bad++;if(i>=n){if(finite(values[i-n]))acc-=values[i-n];else bad--;}out.push(i>=n-1&&!bad?acc/n:null);}return out;
}
function ema(values,n) {
 if(!Number.isInteger(n)||n<1)fail('Invalid exponential-average period.');let previous=null,window=[];return values.map(v=>{if(!finite(v)){previous=null;window=[];return null;}if(previous===null){window.push(v);if(window.length===n)previous=mean(window);}else previous=v*2/(n+1)+previous*(1-2/(n+1));return previous;});
}
function rsi(values,n=14) {
 const out=values.map(()=>null);if(values.length<=n||values.some(x=>!finite(x)))return out;let gain=0,loss=0;for(let i=1;i<=n;i++){gain+=Math.max(0,values[i]-values[i-1]);loss+=Math.max(0,values[i-1]-values[i]);}gain/=n;loss/=n;
 const score=()=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);out[n]=score();for(let i=n+1;i<values.length;i++){gain=(gain*(n-1)+Math.max(0,values[i]-values[i-1]))/n;loss=(loss*(n-1)+Math.max(0,values[i-1]-values[i]))/n;out[i]=score();}return out;
}
function atr(rows,n=14) {
 if(rows.length<=n)return null;const tr=rows.slice(1).map((r,i)=>Math.max(r.h-r.l,Math.abs(r.h-rows[i].c),Math.abs(r.l-rows[i].c)));let a=mean(tr.slice(0,n));for(const v of tr.slice(n))a=(a*(n-1)+v)/n;return a;
}
function technicals(raw,frame='D',now=Date.now(),fetchedAt=null) {
 if(frame&&typeof frame==='object'){const opts=frame;frame=opts.frame||'D';now=opts.now??Date.now();fetchedAt=opts.fetchedAt??null;}now=time(now);
 const all=candles(raw),rows=completed(all,frame,now),prices=rows.map(r=>r.c),n=prices.length,last=rows[n-1],daily=['D','daily','day'].includes(frame);
 const result={ready:false,stale:true,reason:null,rows,all,frame,asOf:last?iso(last.t):null,fetchedAt:iso(fetchedAt),completedCount:n,incompleteCount:all.length-rows.length,close:last?.c??null,sma20:null,sma50:null,sma200:null,ema12:null,ema26:null,rsi:null,macd:null,signal:null,hist:null,atr:null,mfi:null,bbLow:null,bbMid:null,bbHigh:null,vol:null,historicalVolatility:null,pivot:null,s1:null,s2:null,r1:null,r2:null,support:null,resistance:null,volumeRatio:null,volumeTrend:'Unavailable',bias:'Insufficient history',evidence:[],series:{}};
 if(!last){result.reason='No valid completed provider candles.';return result;}
 const s20=sma(prices,20),s50=sma(prices,50),s200=sma(prices,200),e12=ema(prices,12),e26=ema(prices,26),macd=prices.map((_,i)=>finite(e12[i])&&finite(e26[i])?e12[i]-e26[i]:null),signal=ema(macd,9),rs=rsi(prices),hist=finite(signal[n-1])?macd[n-1]-signal[n-1]:null;
 Object.assign(result,{sma20:s20[n-1],sma50:s50[n-1],sma200:s200[n-1],ema12:e12[n-1],ema26:e26[n-1],rsi:rs[n-1],macd:macd[n-1],signal:signal[n-1],hist,atr:atr(rows),series:{sma20:s20,sma50:s50,sma200:s200,ema12:e12,ema26:e26,rsi:rs,macd,signal}});
 if(n>=20){const m=mean(prices.slice(-20)),sd=Math.sqrt(mean(prices.slice(-20).map(v=>(v-m)**2)));Object.assign(result,{bbMid:m,bbLow:m-2*sd,bbHigh:m+2*sd,support:Math.min(...rows.slice(-20).map(r=>r.l)),resistance:Math.max(...rows.slice(-20).map(r=>r.h))});}
 if(n>=15){let positive=0,negative=0;for(let i=n-14;i<n;i++){const r=rows[i],p=rows[i-1],tp=(r.h+r.l+r.c)/3,previous=(p.h+p.l+p.c)/3;if(tp>previous)positive+=tp*r.v;else if(tp<previous)negative+=tp*r.v;}result.mfi=positive===0&&negative===0?50:negative===0?100:100-100/(1+positive/negative);}
 const pivot=(last.h+last.l+last.c)/3;Object.assign(result,{pivot,s1:2*pivot-last.h,r1:2*pivot-last.l,s2:pivot-(last.h-last.l),r2:pivot+(last.h-last.l),pivotMeaning:'Next-bar classic pivots based on the last completed bar.'});
 if(n>=21){const previousVolume=mean(rows.slice(-21,-1).map(r=>r.v));if(previousVolume>0)result.volumeRatio=last.v/previousVolume;result.volumeTrend=result.volumeRatio===null?'Unavailable':result.volumeRatio>=1.5?'Above 20-bar average':result.volumeRatio<=0.5?'Below 20-bar average':'Near 20-bar average';}
 if(n>=21){const tail=prices.slice(-21),returns=tail.slice(1).map((p,i)=>Math.log(p/tail[i])),mu=mean(returns),sd=Math.sqrt(sum(returns.map(v=>(v-mu)**2))/(returns.length-1));result.historicalVolatility={perBar:sd*100,annualized:daily?sd*Math.sqrt(252)*100:null,observations:returns.length,annualization:daily?'252 trading sessions; daily log returns':'Intraday annualization unavailable without a verified exchange/session calendar'};result.vol=result.historicalVolatility.annualized;}
 const retrieval=time(fetchedAt),lastAge=now-last.t;result.stale=!finite(retrieval)||retrieval>now+5000||now-retrieval>30*60000||lastAge>(daily?5*DAY:['15m','15minute','15minutes'].includes(frame)?30*60000:2*3600000);
 result.ready=n>=50;result.reason=!result.ready?'At least 50 completed bars are required for the trend conclusion.':result.stale?'Candle retrieval or latest completed bar needs refresh.':null;
 let score=0;for(const [label,v]of [['SMA 20',result.sma20],['SMA 50',result.sma50]])if(finite(v)){const direction=Math.sign(last.c-v);score+=direction;result.evidence.push({label,value:v,reading:direction>0?'Close above':direction<0?'Close below':'Close equal'});}
 if(finite(hist)){score+=Math.sign(hist);result.evidence.push({label:'MACD histogram',value:hist,reading:hist>0?'Positive momentum':hist<0?'Negative momentum':'Flat'});}
 if(finite(result.rsi)){score+=result.rsi>55?1:result.rsi<45?-1:0;result.evidence.push({label:'RSI 14',value:result.rsi,reading:result.rsi>70?'Overbought range':result.rsi<30?'Oversold range':'Middle range'});}
 result.bias=!result.ready?'Insufficient history':result.stale?'Data needs refresh':score>=2?'Bullish evidence':score<=-2?'Bearish evidence':'Mixed evidence';return result;
}
function patterns(raw,options={}) {
 const now=options.now??Date.now(),frame=options.frame||'D',window=options.window??10,forward=options.forward??5,limit=options.limit??12,rows=completed(candles(raw),frame,now);
 const result={matches:[],sampleCount:0,observations:rows.length,window,forward,metric:'Root mean square distance between normalized cumulative log-return paths, in percentage points; lower is closer.',summary:null,reason:null,warning:'Historical similarity and sample outcomes are descriptive, not a forecast or independent probability estimate.'};
 if(!Number.isInteger(window)||window<3||window>100||!Number.isInteger(forward)||forward<1||forward>100||!Number.isInteger(limit)||limit<1||limit>100){result.reason='Invalid pattern window, outcome horizon or sample limit.';return result;}
 if(rows.length<window*2+forward){result.reason='Insufficient completed history for a non-overlapping past sample.';return result;}
 const path=bars=>bars.map(b=>Math.log(b.c/bars[0].c)*100),targetStart=rows.length-window,target=path(rows.slice(targetStart)),candidates=[];
 for(let start=0;start+window+forward<=targetStart;start++) {const values=path(rows.slice(start,start+window)),distance=Math.sqrt(mean(values.map((v,i)=>(v-target[i])**2))),end=start+window-1,outcome=(rows[end+forward].c/rows[end].c-1)*100;candidates.push({start,end,outcomeEnd:end+forward,from:iso(rows[start].t),to:iso(rows[end].t),outcomeTo:iso(rows[end+forward].t),distance,outcome});}
 candidates.sort((a,b)=>a.distance-b.distance||a.start-b.start);
 for(const c of candidates){if(result.matches.some(m=>!(c.outcomeEnd<m.start||c.start>m.outcomeEnd)))continue;result.matches.push(c);if(result.matches.length>=limit)break;}
 result.sampleCount=result.matches.length;if(!result.sampleCount){result.reason='No historical samples with completed, non-overlapping outcomes.';return result;}
 const outcomes=result.matches.map(m=>m.outcome).sort((a,b)=>a-b),mid=Math.floor(outcomes.length/2);result.summary={mean:mean(outcomes),median:outcomes.length%2?outcomes[mid]:(outcomes[mid-1]+outcomes[mid])/2,min:outcomes[0],max:outcomes.at(-1),positiveCount:outcomes.filter(x=>x>0).length,negativeCount:outcomes.filter(x=>x<0).length,flatCount:outcomes.filter(x=>x===0).length};return result;
}
function carryComparison(input={},now=Date.now()) {
 const m=normalizeMarket(input),rows=m.contracts.filter(c=>c.type==='FUT'&&expiryTime(c.expiry)>=time(now)).sort((a,b)=>a.expiry.localeCompare(b.expiry)),out=[];
 for(let i=0;i<rows.length-1;i++){const near=rows[i],far=rows[i+1],n=m.quotes[near.instrumentKey],f=m.quotes[far.instrumentKey],nq=quoteQuality(n,{now}),fq=quoteQuality(f,{now});const days=(expiryTime(far.expiry)-expiryTime(near.expiry))/DAY,spread=nq.valid&&fq.valid?f.price-n.price:null;out.push({near,far,spread,percent:finite(spread)&&n.price>0?spread/n.price*100:null,annualized:finite(spread)&&n.price>0&&days>0?spread/n.price*365/days*100:null,days,stale:nq.status==='stale'||fq.status==='stale',warnings:[...nq.reasons,...nq.warnings,...fq.reasons,...fq.warnings],meaning:'Observed futures price spread, not guaranteed financing cost or a rollover instruction.'});}return out;
}
function streamFrame(previous={},frame={},opts={}) {
 const now=time(opts.now??Date.now()),feedAt=time(frame.feedAt??frame.currentTs??frame.current_ts),instrumentKey=frame.instrumentKey||frame.instrument_key,tradeAt=time(frame.tradeAt??frame.ltt),price=num(frame.price,frame.ltp),old=previous[instrumentKey];
 const reject=reason=>({accepted:false,reason,state:previous,observation:null});
 if(!instrumentKey||!finite(feedAt)||!finite(price)||price<0)return reject('Missing instrument, feed timestamp or price');
 if(feedAt>now+5000||Number.isFinite(tradeAt)&&tradeAt>now+5000)return reject('Future-dated streaming frame');
 if(now-feedAt>(opts.maxAge??120000))return reject('Old streaming frame');
 if(old&&feedAt<=time(old.feedAt))return reject('Duplicate or out-of-order streaming frame');
 if(old&&Number.isFinite(tradeAt)&&Number.isFinite(time(old.tradeAt))&&tradeAt<time(old.tradeAt))return reject('Regressed last-trade timestamp');
 const observation={instrumentKey,feedAt:iso(feedAt),tradeAt:iso(tradeAt),price,source:'STREAM',purpose:'Live observation only; excluded from portfolio valuation'};return {accepted:true,reason:null,state:{...previous,[instrumentKey]:observation},observation};
}
function cacheRefresh(previous, result, now=Date.now()) {
 const stamp=iso(now);if(result?.ok===true&&result.data&&typeof result.data==='object')return {data:clone(result.data),lastSuccess:stamp,lastFailure:previous?.lastFailure||null,failure:null,source:'REST'};
 return {data:previous?.data?clone(previous.data):null,lastSuccess:previous?.lastSuccess||null,lastFailure:stamp,failure:safeText(result?.error||'Refresh failed',500),source:previous?.data?'CACHE':'UNAVAILABLE'};
}
function journalCSV(book) {
 const b=validateBook(book),columns=['id','kind','date','type','expiry','strike','lots','units_per_lot','entry','exit','gross_realized','charges','cash_movement','note'],rows=[columns];
 for(const j of b.journal)rows.push([j.id,j.kind,j.date,j.leg?.type,j.leg?.expiry,j.leg?.strike,j.leg?.lots,j.leg?.lotSize,j.leg?.entry,j.exit,j.kind==='close'?(j.exit-j.leg.entry)*units(j.leg):null,j.kind==='close'?j.fees:j.kind==='fee'?j.amount:null,['settlement','funding'].includes(j.kind)?j.amount:null,j.note]);
 for(const j of b.legacy?.journal||[])rows.push([j.id,'legacy_'+j.kind,j.date,null,null,null,null,null,null,null,j.kind==='close'?j.amount:null,j.kind==='fee'?j.amount:null,j.kind==='settlement'?j.amount:null,j.note]);
 const cell=v=>{if(v==null)return '""';let s=String(v);if(typeof v==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};return '\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n');
}
const api={DAY,YEAR,finite,value,time,iso,validDate,istDate,expiryTime,units,safeURL,validateLeg,emptyBook,validateBook,normalizeMarket,normQuote,quoteQuality,matchContract,resolveMark,ledger,closeLeg,recordCash,validGreeks,risk,cdf,putPrice,scenario,payoff,hedgePreferences,findHedges,candles,completed,sma,ema,rsi,atr,technicals,patterns,carryComparison,streamFrame,cacheRefresh,journalCSV};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HAL4Engine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
