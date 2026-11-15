/* HAL Desk 5 — read-only snapshot continuity check.
 * Prevents a newer HTTP response from silently rolling provider market clocks
 * backward or accepting different traded prices at identical provider clocks.
 * No broker traffic, credential access, portfolio mutation or order actions. */
(function(root){'use strict';
const E=typeof module==='object'&&module.exports?require('./engine4.js'):root.HAL4Engine;
const Q=typeof module==='object'&&module.exports?require('./quality5.js'):root.HAL5Quality;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const copy=x=>JSON.parse(JSON.stringify(x));
const key=x=>String(x?.instrument_key??x?.instrumentKey??'');
const tag='HAL5 quote integrity: ';
function markUnavailable(raw,reason){
 const data={...raw,price:null,last_price:null,ltp:null,bid:null,bid_price:null,
  ask:null,ask_price:null,depth:{},failure:tag+reason};
 return data;
}
function reconcileQuote(prior,next,instrument,now,issues){
 if(!obj(next))return next;
 if(!obj(prior))return next;
 const old=E.normQuote(prior),incoming=E.normQuote(next);
 const o=Q.clock(old.quoteAt),n=Q.clock(incoming.quoteAt),
  ot=Q.clock(old.tradeAt),nt=Q.clock(incoming.tradeAt);
 const issue=(code,detail,raw)=>{
  issues.push({code,instrument,detail});
  return raw;
 };
 // A quarantined conflicting quote cannot be replaced by a same-clock reread.
 if(typeof old.failure==='string'&&old.failure.startsWith(tag)&&
   (n===null||(o!==null&&n<=o))){
  return issue('unresolved_conflict','A previously quarantined price still needs a strictly newer provider quote.',copy(prior));
 }
 if(n!==null&&finite(now)&&n>now+5000){
  return issue('future_quote','New provider quote timestamp is in the future.',
   markUnavailable(prior,'future-dated provider quote received; last retained source quote quarantined'));
 }
 if(o!==null&&n===null)
  return issue('missing_provider_clock','New observation has no source quote timestamp.',
   {...copy(prior),failure:tag+'source timestamp missing on newer HTTP retrieval'});
 if(o!==null&&n!==null&&n<o)
  return issue('provider_clock_regression','New HTTP response carries an older provider quote.',
   {...copy(prior),failure:tag+'provider quote clock moved backward'});
 if(o!==null&&n!==null&&o===n&&ot!==null&&nt!==null&&ot===nt&&
   finite(old.price)&&finite(incoming.price)&&Math.abs(old.price-incoming.price)>0.01)
  return issue('same_clock_price_conflict','Same provider quote and trade clocks have contradictory traded prices.',
   markUnavailable(next,'same-clock last-traded-price conflict'));
 return next;
}
function reconcile(previous,incoming,now=Date.now()){
 if(!obj(incoming)||!Array.isArray(incoming.futures))throw Error('Invalid incoming market snapshot');
 if(!finite(now))throw Error('Invalid market continuity clock');
 const packet=copy(incoming),issues=[],conflicts=[],specs=[];
 if(!obj(previous))return {packet,issues,contractConflicts:[],contractConflictSpecs:[]};
 if(obj(previous.spot)&&obj(packet.spot))
  packet.spot=reconcileQuote(previous.spot,packet.spot,'HAL spot',now,issues);
 const oldMarket=E.normalizeMarket(previous),newMarket=E.normalizeMarket(incoming);
 const oldContracts=new Map(oldMarket.contracts.map(c=>[c.instrumentKey,c]));
 for(const fresh of newMarket.contracts){
  const prior=oldContracts.get(fresh.instrumentKey);
  if(prior&&!Q.sameContract(prior,fresh)){
   conflicts.push(fresh.instrumentKey);specs.push(prior,fresh);
   issues.push({code:'contract_identity_conflict',instrument:fresh.instrumentKey,
    detail:'Listed contract identity changed under the same instrument key.'});
  }
 }
 const bad=new Set(conflicts);
 const oldFutures=new Map((previous.futures||[]).filter(x=>key(x)).map(x=>[key(x),x]));
 packet.futures=packet.futures.map(f=>{
  const id=key(f),prev=oldFutures.get(id);
  if(!prev)return f;
  if(bad.has(id)){
   const raw=f.quote||f,quarantined=markUnavailable(raw,'contract identity changed');
   return f.quote?{...f,quote:quarantined}:{...f,...quarantined};
  }
  const q=reconcileQuote(prev.quote||prev,f.quote||f,id,now,issues);
  return f.quote?{...f,quote:q}:{...f,...q};
 });
 // The snapshot usually contains one current option expiry. Reconcile only
 // matching listed put instrument keys; never map one expiry's put to another.
 const oldPuts=new Map();
 if(previous.option_expiry===incoming.option_expiry)
  for(const row of previous.option_rows||[]){
   if(obj(row?.put)&&key(row.put))oldPuts.set(key(row.put),row.put);
  }
 if(Array.isArray(packet.option_rows))packet.option_rows=packet.option_rows.map(row=>{
  if(!obj(row?.put))return row;
  const id=key(row.put),prev=oldPuts.get(id);
  if(!prev)return row;
  if(bad.has(id)){
   const raw=row.put.quote||row.put,q=markUnavailable(raw,'contract identity changed');
   return {...row,put:row.put.quote?{...row.put,quote:q}:{...row.put,...q}};
  }
  const q=reconcileQuote(prev.quote||prev,row.put.quote||row.put,id,now,issues);
  return {...row,put:row.put.quote?{...row.put,quote:q}:{...row.put,...q}};
 });
 const carried=Array.isArray(previous._continuityContractConflicts)?previous._continuityContractConflicts:[];
 const carriedSpecs=Array.isArray(previous._continuityContractSpecs)?previous._continuityContractSpecs:[];
 // Identity mismatches remain quarantined until the user re-verifies exact
 // contracts. A later quote alone cannot prove a corrected lot/expiry/strike.
 packet._continuityContractConflicts=[...new Set([...carried,...conflicts])];
 packet._continuityContractSpecs=[...carriedSpecs,...specs];
 packet._continuityIssues=issues;
 return {packet,issues,contractConflicts:packet._continuityContractConflicts,
  contractConflictSpecs:packet._continuityContractSpecs};
}
const api={reconcile};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5Continuity=api;
})(typeof globalThis!=='undefined'?globalThis:this);
