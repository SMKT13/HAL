/* HAL Desk 5 — six-perspective evidence readiness, computed locally.
   Does not call Gemini, make market predictions, access credentials or modify holdings.
   The six perspectives record source readiness and contradictions, not consensus votes. */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const arr=x=>Array.isArray(x)?x:[];
const validTime=x=>typeof x==='string'&&x.length>0&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const state=(id,title,status,summary,check,asOf=null)=>({id,title,status,summary,check,asOf});
function build(input={},now=Date.now(),confirmed=false){
 if(!finite(now)||now<0)throw Error('Invalid evidence review time');
 const t=input.technical||{},m=input.market||{},b=input.book||{},v=input.valuation||{},
  r=input.risk||{},f=input.fundamentals||{},news=arr(input.news);
 const at=(ts,maxAgeMs)=>{const ms=validTime(ts);return ms!==null&&ms<=now+60000&&now-ms<=maxAgeMs;};
 const dated=ts=>{const ms=validTime(ts);return ms!==null&&ms<=now+60000?new Date(ms).toISOString():null;};
 const spot=m.spot||{},quoteOkay=finite(spot.price)&&spot.price>0&&at(spot.quoteAt,120000),
  tradeOkay=at(spot.tradeAt,120000);
 const techOkay=t.ready===true&&t.stale===false&&dated(t.asOf)!=null;
 const technical=state('technical','Technical',techOkay?'available':'review',
  techOkay?'Completed-candle evidence: '+String(t.bias||'No directional classification'):
   'Current completed-candle technical evidence is missing, stale, or insufficient.',
  'Verify bar completion, timestamp and data source before interpreting indicators.',dated(t.asOf));
 const legs=arr(b.legs),hasFutures=legs.some(x=>x.type==='FUT'),
  derivativeComplete=hasFutures&&v.complete===true&&r.greeksComplete===true&&quoteOkay&&tradeOkay;
 const derivatives=state('derivatives','F&O',derivativeComplete?'available':hasFutures?'review':'unavailable',
  !hasFutures?'No recorded long HAL futures; do not assume a position.':
  derivativeComplete?'Verified marked portfolio and aggregate Greeks are available.':
  'Futures/put entries exist, but current marks, source clocks or net Greeks need review.',
  'Check contract identifiers, bid/ask quality, quantity and expiry mismatch.',dated(spot.quoteAt));
 const metrics=arr(f.metrics).filter(x=>finite(x?.value)&&typeof x.label==='string'&&x.label.length&&x.kind==='provider');
 const financeDated=dated(f.profile?.retrievedAt)!=null;
 const fundamentals=state('fundamentals','Fundamentals',metrics.length?(financeDated?'available':'review'):'unavailable',
  metrics.length?metrics.length+' provider-reported numerical metrics loaded; periods/units and retrieval timestamp require review.':
  'No verified numerical financial statement metrics loaded.',
  'Compare reported periods, standalone/consolidated basis and original HAL filings.',
  dated(f.profile?.retrievedAt));
 const verifiedNews=news.filter(x=>typeof x?.title==='string'&&/^https:\/\/[^/\s]+/i.test(x.url||'')&&
    dated(x.publishedAt)!=null);
 const recent=verifiedNews.filter(x=>now-Date.parse(x.publishedAt)>=0&&now-Date.parse(x.publishedAt)<=30*86400000);
 const newsLens=state('news','News',recent.length?'available':'review',
  recent.length?recent.length+' dated, source-linked item(s) in the last 30 days.':
  'No recent source-linked headline in the loaded feed; this does not imply that no HAL event occurred.',
  'Review official filings and distinguish announcements from commentary.',
  recent.length?recent.map(x=>dated(x.publishedAt)).sort().slice(-1)[0]:null);
 const idx=m.nifty||{},vix=m.vix||{};
 const macroReady=finite(idx.price)&&finite(vix.price)&&vix.price>=0&&
  at(idx.quoteAt,120000)&&at(vix.quoteAt,120000);
 const macro=state('market','Market context',macroReady?'available':'review',
  macroReady?'Time-stamped NIFTY 50 and India VIX observations loaded.':
  'NIFTY 50 or India VIX observation is unavailable or stale.',
  'Index correlation and causality cannot be inferred from a single snapshot.',
  macroReady?dated(idx.quoteAt):null);
 const warnings=arr(r.warnings).filter(x=>x&&typeof x==='object');
 const risk=state('risk','Position risk',!legs.length?'unavailable':confirmed&&v.complete&&warnings.length===0?'available':'review',
  !legs.length?'No saved real positions.':
  'Recorded book '+(confirmed?'confirmed':'not confirmed')+'; '+warnings.length+' risk review notice(s).',
  'Review cash reserve, lot/strike/expiry coverage, mixed expiries and physical settlement separately.',
  null);
 const lenses=[technical,derivatives,fundamentals,newsLens,macro,risk];
 return {createdAt:new Date(now).toISOString(),lenses,
  available:lenses.filter(x=>x.status==='available').length,
  review:lenses.filter(x=>x.status==='review').length,
  missing:lenses.filter(x=>x.status==='unavailable').length,
  caveat:'Evidence readiness is not a buy/sell signal or AI consensus. Source presence does not certify correctness.'};
}
const api={build};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Lenses=api;
})(typeof globalThis!=='undefined'?globalThis:this);
