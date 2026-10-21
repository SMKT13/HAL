'use strict';
/*
 * HAL skills pre-check: adapted workflow concepts from TraderMonty's MIT-licensed
 * Claude Trading Skills, fork dr-pabs/Agent-claude-trading-skills.
 * See android/TRADING_SKILLS_ATTRIBUTION.md. No upstream Python is bundled.
 * This is an evidence checklist, not permission to place a trade.
 */
(function(root){
 const valid=n=>typeof n==='number'&&Number.isFinite(n);
 const units=l=>valid(l?.lots)&&valid(l?.lotSize)?l.lots*l.lotSize:null;
 function review(book,desk){
  const legs=Array.isArray(book?.legs)?book.legs:[];
  const profile=desk?.profile||{};
  const future=legs.filter(l=>l.type==='FUT');
  const puts=legs.filter(l=>l.type==='PE');
  const futureUnits=future.reduce((s,l)=>s+(units(l)||0),0);
  const putUnits=puts.reduce((s,l)=>s+(units(l)||0),0);
  const validUnits=legs.every(l=>valid(units(l))&&units(l)>0);
  const expiryGap=future.some(f=>puts.some(p=>p.expiry<f.expiry));
  const flags=new Set((desk?.events||[]).map(e=>e.id));
  const checks=[];
  function add(id,label,status,detail){checks.push({id,label,status,detail});}
  add('book','Position verified',!legs.length||!desk?.confirmed?'REVIEW':'CHECKED',
   !legs.length?'Save your actual open contracts in My Position first.':desk?.confirmed?'Saved contracts were confirmed for the current review window.':'Confirm futures and put contracts against your broker; edits invalidate confirmation.');
  add('quotes','Data quality',desk?.dataMode==='current'?'CHECKED':'REVIEW',
   desk?.dataMode==='current'?'App currently reports contract-level usable quotes; inspect each timestamp.':'Prices are saved, incomplete or stale. Do not use stale quotes to make a new-risk decision.');
  add('risk','Strategy loss limit',flags.has('loss-breach')?'LIMIT':valid(profile.maxLoss)?'CHECKED':'REVIEW',
   flags.has('loss-breach')?'Saved strategy-loss review limit has been reached; review before adding risk.':valid(profile.maxLoss)?'A strategy loss limit exists. It is not a stop order or a guaranteed loss floor.':'Set your maximum strategy-loss review threshold in My Position.');
  add('funding','Margin and liquidity',flags.has('cash-stress')?'LIMIT':desk?.fundingCurrent&&valid(profile.reserve)?'CHECKED':'REVIEW',
   flags.has('cash-stress')?'Modelled futures cash stress exceeds free funds less your reserve. No option proceeds or extra margin assumed.':desk?.fundingCurrent&&valid(profile.reserve)?'A recent manually-entered funding snapshot and reserve exist. Broker margin changes remain unknown.':'Update free funds, margin and cash reserve; these are not automatically verified with your broker.');
  add('hedge','Put protection and expiry',!validUnits||futureUnits===0?'REVIEW':putUnits<futureUnits||expiryGap?'REVIEW':'CHECKED',
   !validUnits?'Quantities or lot sizes are missing.':futureUnits===0?'No open futures recorded; this pre-check is for long HAL futures.':putUnits<futureUnits?'Put units ('+putUnits+') are fewer than futures units ('+futureUnits+'); compare a hedge.':expiryGap?'At least one owned put expires before a saved futures contract; examine the unprotected expiry gap.':'Put units cover recorded futures units; verify strikes and expiries. Equal units do not guarantee a strategy loss floor.');
  const nextExpiry=desk?.risk?.nextExpiry;
  const days=typeof nextExpiry==='string'&&typeof desk?.asOf==='string'?
    Math.ceil((Date.parse(nextExpiry+'T10:00:00Z')-Date.parse(desk.asOf))/86400000):null;
  add('plan','Rollover and discipline',!legs.length||days===null||!Number.isFinite(days)||days<=5?'REVIEW':'CHECKED',
   !legs.length?'Create a written strategy plan before adding futures risk.':
   days===null||!Number.isFinite(days)?'Expiry date unverified.':'Next recorded expiry is '+days+' calendar day(s) away. Compare carry, put expiry, cash and broker settlement terms before rolling.');
  const priority=checks.some(c=>c.status==='LIMIT')?'LIMIT_ALERT':
    checks.some(c=>c.status==='REVIEW')?'REVIEW_REQUIRED':'STRUCTURAL_CHECKS_ONLY';
  return {framework:'trading-skills-mit-adaptation',status:priority,checks,
   futuresUnits:validUnits?futureUnits:null,putUnits:validUnits?putUnits:null,
   nextExpiry:typeof nextExpiry==='string'?nextExpiry:null,
   note:'Local structural review only. CHECKED never authorises a trade. Losses, slippage, future margin and physical settlement are not guaranteed by this checklist.'};
 }
 const api={review};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.HALTradeSkills=api;
})(typeof globalThis!=='undefined'?globalThis:this);
