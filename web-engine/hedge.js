/* Read-only protective-put comparisons. All prices are indicative, never orders. */
(function(root){
'use strict';
const C=typeof module!=='undefined'&&typeof require==='function'?require('./core.js'):root.HALCore;
const A=typeof module!=='undefined'&&typeof require==='function'?require('./analytics.js'):root.HALAnalytics;
const DAY=86400000,units=l=>l.lots*l.lotSize,sum=a=>a.reduce((s,n)=>s+n,0);
const fresh=(stamp,now,limit=120000)=>{const age=now-Date.parse(stamp);return Number.isFinite(age)&&age>=-60000&&age<=limit;};
function quoteIssues(q,now,settings,quantity,side){
 const reasons=[];
 if(!fresh(q?.quote_as_of,now))reasons.push('Quote older than 2 minutes or timestamp missing');
 if(!fresh(q?.last_trade_at,now,900000))reasons.push('No trade within 15 minutes');
 if(!C.finite(q?.bid)||!C.finite(q?.ask)||q.bid<=0||q.ask<q.bid)reasons.push('Missing or crossed bid/ask');
 else if((q.ask-q.bid)/((q.ask+q.bid)/2)*100>settings.maxSpread)reasons.push('Bid/ask spread exceeds limit');
 if(!C.finite(q?.volume)||q.volume<=0)reasons.push('No reported volume');
 if(!C.finite(q?.open_interest)||q.open_interest<=0)reasons.push('No reported open interest');
 const depth=q?.[side+'_quantity'];
 if(!C.finite(depth)||depth<quantity)reasons.push('Insufficient displayed '+side+' quantity');
 return reasons;
}
function optionIssues(o,chain,now,s,qty,side){
 const reasons=quoteIssues(o?.quote,now,s,qty,side);
 if(chain?.chain_error||!fresh(chain?.fetched_at_iso,now)||!fresh(chain?.quotes_fetched_at,now))reasons.push('Chain or full-quote retrieval needs refresh');
 if(!C.finite(o?.iv)||o.iv<=0||o.iv+s.ivShift<=0||o.iv+s.ivShift>500)reasons.push('Valid IV unavailable for the model');
 if(!C.finite(o?.delta)||o.delta< -1||o.delta>0||!C.finite(o?.theta))reasons.push('Put Greeks unavailable or invalid');
 return reasons;
}
function futureValue(l,quote,S,S0,t){return t>=A.expiryTime(l.expiry)?S:quote.last_price+S-S0;}
function optionValue(o,strike,expiry,S,t,s){return A.putPrice(S,strike,Math.max(0,(A.expiryTime(expiry)-t)/DAY/365),(o.iv+s.ivShift)/100,s.rate/100,s.dividend/100);}
function grid(legs,through,now){
 const end=A.expiryTime(through),times=new Map([[now,'Now'],[now+(end-now)/2,'Midpoint'],[end,'Protection date']]);
 for(const l of legs.filter(l=>l.type==='PE')){const t=A.expiryTime(l.expiry);if(t>now&&t<end)times.set(t,'Existing put expiry');}
 return [...times.entries()].sort((a,b)=>a[0]-b[0]).map(([time,label])=>({time,label,shocks:[0,-3,-5,-10]}));
}
function compare(legs,snapshot,chains,settings,now=Date.now(),unavailable=[]){
 const s=A.hedgePreferences(settings,true),warnings=[],errors=[],excluded=[],candidates=[];
 if(!Array.isArray(legs)||!legs.length)throw Error('Save your long HAL futures in the open book first.');
 C.validate(legs);
 const futures=legs.filter(l=>l.type==='FUT'),puts=legs.filter(l=>l.type==='PE');
 if(!futures.length)throw Error('Save at least one long HAL futures leg first.');
 if(legs.some(l=>A.expiryTime(l.expiry)<now))throw Error('Review expired positions before comparing a new hedge.');
 const firstFuture=futures.map(l=>l.expiry).sort()[0],end=A.expiryTime(s.protectThrough);
 if(end<=now)throw Error('Protection date must be later than now.');
 if(s.protectThrough>firstFuture)throw Error('Choose a protection date on or before your earliest futures expiry. Update the book after any rollover.');
 const futureUnits=sum(futures.map(units)),S0=snapshot?.spot?.last_price;
 if(!C.finite(S0)||S0<=0||!fresh(snapshot?.spot?.quote_as_of,now)||!fresh(snapshot?.spot?.last_trade_at,now))errors.push('Refresh HAL spot during the market session; a quote and trade within 2 minutes are required.');
 const futureRows=futures.map(l=>({leg:l,contract:snapshot?.futures?.find(c=>c.expiry===l.expiry)}));
 for(const r of futureRows){const q=r.contract?.quote;if(r.contract?.lot_size!==r.leg.lotSize)errors.push('Saved futures lot size does not match the listed contract: '+r.leg.expiry);if(!C.finite(q?.last_price)||q.last_price<=0||!fresh(q?.quote_as_of,now)||!fresh(q?.last_trade_at,now,900000))errors.push('A recent futures quote and trade are needed: '+r.leg.expiry);}
 const required=(snapshot?.available_expiries||[]).filter(d=>C.validDate(d)&&d>=s.protectThrough&&A.expiryTime(d)>now).sort();
 if(!required.length)errors.push('No listed put expiry covers the requested protection date. Refresh contract discovery or change the date.');
 for(const d of required)if(unavailable.includes(d)||!chains[d]||chains[d].option_expiry!==d||chains[d].chain_error||!fresh(chains[d].fetched_at_iso,now)||!fresh(chains[d].quotes_fetched_at,now)||!Array.isArray(chains[d].option_rows)||!chains[d].option_rows.length)errors.push('Full put quotes are missing or stale for '+d+'. Refresh comparisons.');
 const oldRows=puts.map(l=>({leg:l,chain:chains[l.expiry],option:chains[l.expiry]?.option_rows?.find(r=>r.strike===l.strike)?.put}));
 for(const r of oldRows){
  const quantity=sum(puts.filter(l=>l.expiry===r.leg.expiry&&l.strike===r.leg.strike).map(units));
  const reasons=optionIssues(r.option,r.chain,now,s,quantity,'bid');
  if(unavailable.includes(r.leg.expiry))reasons.push('Latest refresh failed or is pending');
  if(r.option?.lot_size!==r.leg.lotSize)reasons.push('Saved lot size does not match this put contract');
  if(reasons.length)errors.push('Existing '+r.leg.strike+' put ('+r.leg.expiry+'): '+[...new Set(reasons)].join('; '));
 }
 const oldUnits=sum(puts.map(units)),firstPut=puts.map(l=>l.expiry).sort()[0];
 if(firstPut&&firstPut<s.protectThrough)warnings.push('Existing protection expires before your target date. Keep-current P&L stops at the first put expiry; a later spot price cannot determine its earlier settlement.');
 if(s.protectThrough<futures.map(l=>l.expiry).sort().at(-1))warnings.push('Your requested protection ends before a saved futures expiry. Puts expiring earlier than those futures leave a later gap; a future rollover is not assumed.');
 if(oldUnits<futureUnits)warnings.push((futureUnits-oldUnits)+' futures units currently have no matching put units.');
 if(oldUnits>futureUnits)warnings.push('The existing put quantity exceeds futures units; replacement candidates cover the futures quantity exactly.');
 if(s.buyFees===0||(puts.length&&s.exitFees===0))warnings.push('Zero charges entered: relevant brokerage, taxes and settlement charges are excluded unless you enter an estimate.');
 const out={settings:s,errors:[...new Set(errors)],warnings,candidates,excluded,shortlist:[],eligible:[],futureUnits,oldUnits,required,grid:grid(legs,s.protectThrough,now),firstPut,keep:[],now,spot:S0,validUntil:null};
 if(errors.length)return out;
 // Retained comparisons expire with their oldest required input, not two minutes after the button click.
 const quoteDeadlines=(q,tradeAge=900000)=>[Date.parse(q.quote_as_of)+120000,Date.parse(q.last_trade_at)+tradeAge];
 const chainDeadlines=chain=>[Date.parse(chain.fetched_at_iso)+120000,Date.parse(chain.quotes_fetched_at)+120000];
 const deadlines=[end,...legs.map(l=>A.expiryTime(l.expiry)),...quoteDeadlines(snapshot.spot,120000),...futureRows.flatMap(r=>quoteDeadlines(r.contract.quote)),...required.flatMap(d=>chainDeadlines(chains[d])),...oldRows.flatMap(r=>[...quoteDeadlines(r.option.quote),...chainDeadlines(r.chain)])];
 const baseline=sum(oldRows.map(r=>r.option.quote.bid*units(r.leg))),slip=s.slippage/100;
 const sale=baseline*(1-slip),exitFees=puts.length?s.exitFees:0;
 const futureChange=(S,t)=>sum(futureRows.map(r=>(futureValue(r.leg,r.contract.quote,S,S0,t)-r.contract.quote.last_price)*units(r.leg)));
 out.oldBidValue=baseline;out.oldSaleProceeds=sale;out.oldEntryPremium=sum(puts.map(l=>l.entry*units(l)));
 out.futureCurrentPnl=sum(futureRows.map(r=>(r.contract.quote.last_price-r.leg.entry)*units(r.leg)));
 out.keep=out.grid.map(g=>({...g,values:g.shocks.map(shock=>{const price=S0*(1+shock/100),available=!firstPut||g.time<=A.expiryTime(firstPut);return {shock,price,pnl:available?futureChange(price,g.time)+sum(oldRows.map(r=>(optionValue(r.option,r.leg.strike,r.leg.expiry,price,g.time,s)-r.option.quote.bid)*units(r.leg))):null};})}));
 for(const expiry of required){const chain=chains[expiry];for(const row of chain.option_rows){
  const o=row.put;if(!C.finite(row.strike)||row.strike<=0||!o)continue;
  const reasons=[],lot=o.lot_size;
  if(!Number.isInteger(lot)||lot<=0||futureUnits%lot!==0)reasons.push('Whole put lots cannot match futures units exactly');
  reasons.push(...optionIssues(o,chain,now,s,futureUnits,'ask'));
  if(reasons.length){excluded.push({expiry,strike:row.strike,reasons:[...new Set(reasons)]});continue;}
  const premium=o.quote.ask*(1+slip)*futureUnits,grossCost=premium+s.buyFees;
  const scenarios=out.grid.map(g=>({...g,values:g.shocks.map(shock=>{const price=S0*(1+shock/100),pnl=futureChange(price,g.time)+optionValue(o,row.strike,expiry,price,g.time,s)*futureUnits-grossCost+sale-baseline-exitFees;return {shock,price,pnl,entryPnl:pnl+out.futureCurrentPnl+baseline-out.oldEntryPremium};})}));
  if(!C.finite(grossCost)||!scenarios.every(g=>g.values.every(v=>C.finite(v.pnl)&&C.finite(v.entryPnl)))){excluded.push({expiry,strike:row.strike,reasons:['Model cannot produce finite values for these inputs']});continue;}
  const stressLoss=Math.max(0,-Math.min(...scenarios.flatMap(g=>g.values.map(v=>v.pnl))));
  const limits=[];if(grossCost>s.budget)limits.push('Above new-hedge budget');if(stressLoss>s.maxLoss)limits.push('Above loss limit in sampled scenarios');
  deadlines.push(...quoteDeadlines(o.quote));
  candidates.push({id:expiry+':'+row.strike,expiry,strike:row.strike,lots:futureUnits/lot,lotSize:lot,units:futureUnits,grossCost,premium,netOutlay:grossCost+exitFees-sale,exitFees,stressLoss,scenarios,limits,expiryGap:expiry<futures.map(l=>l.expiry).sort().at(-1),quote:o.quote,iv:o.iv,delta:o.delta,theta:o.theta,spread:(o.quote.ask-o.quote.bid)/((o.quote.ask+o.quote.bid)/2)*100,badges:[]});
 }}
 out.validUntil=Math.min(...deadlines);
 const tie=(a,b)=>a.grossCost-b.grossCost||a.spread-b.spread||a.expiry.localeCompare(b.expiry)||a.strike-b.strike;
 out.candidates.sort(tie);out.eligible=out.candidates.filter(c=>!c.limits.length);
 if(out.eligible.length){
  const e=out.eligible,minCost=Math.min(...e.map(c=>c.grossCost)),maxCost=Math.max(...e.map(c=>c.grossCost)),minLoss=Math.min(...e.map(c=>c.stressLoss)),maxLoss=Math.max(...e.map(c=>c.stressLoss));
  const balance=c=>((c.grossCost-minCost)/(maxCost-minCost||1))**2+((c.stressLoss-minLoss)/(maxLoss-minLoss||1))**2;
  const choices=[['Lower cost',[...e].sort(tie)[0]],['Balanced',[...e].sort((a,b)=>balance(a)-balance(b)||tie(a,b))[0]],['Stronger protection',[...e].sort((a,b)=>a.stressLoss-b.stressLoss||tie(a,b))[0]]];
  for(const [label,c]of choices){c.badges.push(label);if(!out.shortlist.includes(c))out.shortlist.push(c);}
 }
 return out;
}
const api={compare,fresh,quoteIssues};if(typeof module!=='undefined'&&typeof require==='function')module.exports=api;root.HALHedge=api;
})(typeof globalThis!=='undefined'?globalThis:this);
