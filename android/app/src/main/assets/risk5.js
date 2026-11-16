/* HAL Desk 5: independent, deterministic risk calculations.
   Read-only. No provider I/O, order routing, storage writes or private data.
   Dates are civil YYYY-MM-DD dates; expiry clock/settlement obligations are handled separately. */
(function(root){
'use strict';
function validDate(x){
 return typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&
  Number.isFinite(Date.parse(x+'T00:00:00Z'))&&
  new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
}
const finite=x=>typeof x==='number'&&Number.isFinite(x);
function nonNegative(x,label){if(!finite(x)||x<0)throw Error('invalid '+label);return x;}
function validateLeg(raw){
 if(!raw||!['FUT','PE','CE'].includes(raw.type))throw Error('unsupported leg');
 if(!validDate(raw.expiry))throw Error('invalid expiry');
 const side=raw.side==null?'long':raw.side;
 if(!['long','short'].includes(side))throw Error('invalid side');
 const quantity=raw.quantity==null?raw.lots*raw.lotSize:raw.quantity;
 if(!Number.isSafeInteger(quantity)||quantity<=0)throw Error('invalid quantity');
 if(raw.quantity!=null&&raw.lots!=null&&raw.lotSize!=null&&raw.lots*raw.lotSize!==quantity)
  throw Error('quantity and lot size mismatch');
 const entry=nonNegative(raw.entry,'entry');
 if(raw.type!=='FUT'&&(!finite(raw.strike)||raw.strike<=0))throw Error('invalid strike');
 return {...raw,quantity,entry,side};
}
function intrinsic(type,strike,spot){
 nonNegative(spot,'spot');
 if(!finite(strike)||strike<=0)throw Error('invalid strike');
 if(type==='PE')return Math.max(strike-spot,0);
 if(type==='CE')return Math.max(spot-strike,0);
 throw Error('invalid option type');
}
function expiryPayoff(legs,settlement,expiry){
 if(!Array.isArray(legs)||!legs.length)throw Error('no legs');
 nonNegative(settlement,'settlement');
 if(!validDate(expiry))throw Error('invalid expiry date');
 return legs.reduce((sum,item)=>{
  const l=validateLeg(item);
  if(l.expiry!==expiry)throw Error('mixed expiry: use explicitly dated settlement scenario');
  const payout=l.type==='FUT'?settlement:intrinsic(l.type,l.strike,settlement);
  return sum+(l.side==='long'?1:-1)*l.quantity*(payout-l.entry);
 },0);
}
function protectionCoverage(legs,throughDate,asOfDate){
 if(!Array.isArray(legs)||!validDate(throughDate)||(asOfDate!=null&&!validDate(asOfDate)))
  throw Error('invalid date or legs');
 if(asOfDate!=null&&throughDate<asOfDate)throw Error('through date is before valuation date');
 let futures=0,puts=0;
 for(const item of legs){
  const l=validateLeg(item);
  if(l.expiry<throughDate)continue;
  if(l.type==='FUT'&&l.side==='long')futures+=l.quantity;
  if(l.type==='PE'&&l.side==='long')puts+=l.quantity;
 }
 return {futures,puts,covered:Math.min(futures,puts),uncovered:Math.max(0,futures-puts),
  ratio:futures?Math.min(1,puts/futures):null};
}
function nextDate(date){
 if(!validDate(date))throw Error('invalid date');
 return new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
}
function protectionTimeline(legs,asOfDate){
 if(!Array.isArray(legs)||!validDate(asOfDate))throw Error('invalid date or legs');
 const checked=legs.map(validateLeg);
 const expiries=[...new Set(checked.map(l=>l.expiry).filter(d=>d>=asOfDate))].sort();
 const dates=[asOfDate,...expiries.map(nextDate)];
 return dates.map((date,i)=>{
  const c=protectionCoverage(checked,date,asOfDate);
  return {...c,onDate:date,afterExpiry:i?expiries[i-1]:null,
   excessPuts:Math.max(0,c.puts-c.futures),protectionGap:c.futures>c.covered};
 });
}
function settlementScenario(legs,inputs={}){
 if(!Array.isArray(legs)||!legs.length)throw Error('no legs');
 const {spotAtExpiry={},futureAtExpiry={},charges=0}=inputs;
 nonNegative(charges,'charges');
 const errors=[],rows=[];
 for(const item of legs){
  const l=validateLeg(item);
  const isFuture=l.type==='FUT';
  const source=isFuture?futureAtExpiry:spotAtExpiry;
  const raw=source&&Object.prototype.hasOwnProperty.call(source,l.expiry)?source[l.expiry]:null;
  if(!finite(raw)||(isFuture?raw<=0:raw<0)){
   errors.push('Missing '+(isFuture?'futures':'underlying')+' settlement for '+l.expiry);
   rows.push({type:l.type,expiry:l.expiry,quantity:l.quantity,settlement:null,pnl:null});
   continue;
  }
  const settlement=isFuture?raw:intrinsic(l.type,l.strike,raw);
  const pnl=(l.side==='long'?1:-1)*l.quantity*(settlement-l.entry);
  rows.push({type:l.type,expiry:l.expiry,quantity:l.quantity,settlement,pnl});
 }
 const complete=errors.length===0;
 return {complete,rows,errors,total:complete?rows.reduce((s,r)=>s+r.pnl,0)-charges:null,
  charges,assumptions:['Each expiry uses a separately specified settlement input.',
   'Futures settlement prices and underlying settlement values are distinct.',
   'Economic P&L includes entry costs, and excludes brokerage unless charges are supplied.',
   'This is a hypothetical expiry outcome, not a future market quote or a margin forecast.']};
}
function lifetimeNet(scenario,realizedGross,recordedCharges){
 if(!scenario||scenario.complete!==true||!finite(scenario.total)||
   !finite(realizedGross)||!finite(recordedCharges)||recordedCharges<0)return null;
 return scenario.total+realizedGross-recordedCharges;
}
function incrementalRisk({currentMarks,scenarioMarks,quantities,sides}){
 if(![currentMarks,scenarioMarks,quantities,sides].every(Array.isArray)||
    !currentMarks.length||![scenarioMarks,quantities,sides].every(x=>x.length===currentMarks.length))
  throw Error('invalid marks');
 return currentMarks.reduce((sum,mark,i)=>{
  if(!finite(mark)||mark<0||!finite(scenarioMarks[i])||scenarioMarks[i]<0||
     !Number.isSafeInteger(quantities[i])||quantities[i]<=0||!['long','short'].includes(sides[i]))
    throw Error('missing or invalid mark');
  return sum+(sides[i]==='long'?1:-1)*quantities[i]*(scenarioMarks[i]-mark);
 },0);
}
const api={validDate,validateLeg,intrinsic,expiryPayoff,protectionCoverage,
 protectionTimeline,settlementScenario,lifetimeNet,incrementalRisk};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Risk=api;
})(typeof globalThis!=='undefined'?globalThis:this);
