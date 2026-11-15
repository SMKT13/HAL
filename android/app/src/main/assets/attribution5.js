/* HAL Desk 5 — read-only per-contract mark-to-mark attribution.
   No causal claims, broker fills, order routing, position mutation or fees.
   Only compares identical books with complete REST marks and valid quote clocks. */
(function(root){'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const time=x=>typeof x==='string'&&x?Date.parse(x):NaN;
const validTime=x=>Number.isFinite(time(x));
const cleanSource=x=>x==='REST LTP'||x==='REST bid';
const EPS=.011;
function comparableMark(row,at){
 if(!row||typeof row!=='object'||!finite(row.price)||row.price<0||
  row.type==='FUT'&&row.price<=0||!cleanSource(row.source)||row.status!=='current'||
  !validTime(row.quoteAt)||!validTime(row.tradeAt)||!validTime(row.retrievedAt)||!validTime(at))return false;
 const saved=time(at),q=time(row.quoteAt),t=time(row.tradeAt),retrieved=time(row.retrievedAt);
 return q<=saved+5000&&t<=saved+5000&&retrieved<=saved+5000&&
  saved-q<=120000&&saved-t<=120000&&saved-retrieved<=120000&&q<=retrieved+5000;
}
function rowsUnique(rows){
 if(!Array.isArray(rows)||rows.length>100)return false;
 const keys=new Set();
 for(const x of rows){
  if(!x||typeof x.id!=='string'||!x.id||keys.has(x.id))return false;
  keys.add(x.id);
 }
 return true;
}
function compare(before,after){
 const fallback={available:false,reason:'Complete, timely REST position marks are required at both checkpoints.',items:[],total:null,bookedNetChange:null,
  openChange:null,scope:'Only observed market-price movement of unchanged open contracts; not realised P&L, fees or causation.'};
 if(!before||!after||before.version!==4||after.version!==4||
    !validTime(before.savedAt)||!validTime(after.savedAt)||time(after.savedAt)<time(before.savedAt))
  return {...fallback,reason:'Two dated saved observations are required.'};
 if(!before.bookRevision||before.bookRevision!==after.bookRevision||before.markMode!==after.markMode)
  return {...fallback,reason:'The position book or valuation mode changed. No like-for-like attribution is possible.'};
 if(before.complete!==true||after.complete!==true||!finite(before.open)||!finite(after.open)||
  !finite(before.realized)||!finite(after.realized)||!finite(before.charges)||!finite(after.charges))
  return {...fallback,reason:'At least one portfolio value or completed-trade total is unavailable.'};
 if(Math.abs(before.realized-after.realized)>EPS||Math.abs(before.charges-after.charges)>EPS)
  return {...fallback,reason:'Booked gross P&L or recorded charges changed; this is not a pure mark-to-mark comparison.'};
 if(!rowsUnique(before.positionMarks)||!rowsUnique(after.positionMarks)||!before.positionMarks.length||
  before.positionMarks.length!==after.positionMarks.length)
  return {...fallback,reason:'Per-contract observations were not captured in both checkpoints.'};
 const earlier=new Map(before.positionMarks.map(r=>[r.id,r])),later=new Map(after.positionMarks.map(r=>[r.id,r]));
 const items=[];let sum=0;
 for(const [id,a] of earlier){
  const b=later.get(id);
  if(!b||!comparableMark(a,before.savedAt)||!comparableMark(b,after.savedAt))
   return {...fallback,reason:'A required exact REST contract mark is missing, stale, manual, or incompatible.'};
  for(const k of ['type','expiry','strike','instrumentKey','units','entry']){
   if(a[k]!==b[k])return {...fallback,reason:'Contract identity, quantity, or entry changed; no like-for-like attribution.'};
  }
  if(!['FUT','PE'].includes(a.type)||!Number.isSafeInteger(a.units)||a.units<=0||
     !finite(a.entry)||a.entry<0||typeof a.expiry!=='string'||!a.instrumentKey)
   return {...fallback,reason:'A contract has incomplete verified identity or whole-lot units.'};
  const pnl=(b.price-a.price)*a.units;
  if(!finite(pnl))return {...fallback,reason:'Non-finite mark difference.'};
  sum+=pnl;
  items.push({id,type:a.type,expiry:a.expiry,strike:a.type==='PE'?a.strike:null,
   units:a.units,from:a.price,to:b.price,pnl,
   earlierQuoteAt:a.quoteAt,laterQuoteAt:b.quoteAt,earlierTradeAt:a.tradeAt,laterTradeAt:b.tradeAt});
 }
 if(Math.abs(sum-(after.open-before.open))>EPS)
  return {...fallback,reason:'Per-leg mark changes do not reconcile with the basket open P&L change.'};
 if(!finite(before.net)||!finite(after.net)||Math.abs((after.net-before.net)-sum)>EPS)
  return {...fallback,reason:'Net strategy change does not reconcile with unchanged booked totals.'};
 return {available:true,reason:null,items,total:sum,openChange:after.open-before.open,bookedNetChange:0,
  scope:fallback.scope,from:before.savedAt,to:after.savedAt};
}
const api={comparableMark,compare};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Attribution=api;
})(typeof globalThis!=='undefined'?globalThis:this);
