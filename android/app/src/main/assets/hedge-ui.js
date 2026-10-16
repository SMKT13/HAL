'use strict';
let hedgeSelected=null,hedgeDateIndex=0,hedgeResult=null;
const hedgeFields=['budget','maxLoss','protectThrough','buyFees','exitFees','slippage','maxSpread','ivShift','rate','dividend'];
function syncHedgeForm(){
 const s=book.hedge||A.hedgePreferences();for(const k of hedgeFields)$('hedge-'+k).value=s[k]??'';
 if(!$('hedge-protectThrough').value)$('hedge-protectThrough').value=book.legs.filter(l=>l.type==='FUT'&&A.daysLeft(l.expiry)>=0).map(l=>l.expiry).sort()[0]||'';
 hedgeSelected=null;hedgeDateIndex=0;
}
function readHedgeForm(){return A.hedgePreferences(Object.fromEntries(hedgeFields.map(k=>[k,k==='protectThrough'?$('hedge-'+k).value||null:C.value($('hedge-'+k).value)])),true);}
function hedgeDates(s){return [...new Set([...(snapshot?.available_expiries||[]).filter(d=>d>=s.protectThrough),...book.legs.filter(l=>l.type==='PE').map(l=>l.expiry)])].filter(d=>C.validDate(d)&&A.daysLeft(d)>=0).sort();}
function refreshHedges(){
 try{const settings=readHedgeForm();if(!book.legs.some(l=>l.type==='FUT'))throw Error('Save your long futures in the open book first.');
  if(!configured){native('settings');return;}if(!snapshot){refresh();throw Error('Load the market snapshot first, then refresh comparisons.');}
  // Validate dates and the book before issuing any new data requests.
  HALHedge.compare(book.legs,snapshot,{},settings);
  saveBook({...book,hedge:settings});const dates=hedgeDates(settings);if(!dates.length)throw Error('No active expiry available. Refresh the market snapshot.');
  for(const d of dates)requestResearch('hedges',d,true);renderHedge();
 }catch(e){$('hedge-status').textContent=e.message;}
}
function hedgeCard(c){return `<article class="card hedge-card"><div class="hedge-badges">${c.badges.map(b=>`<span>${esc(b)}</span>`).join('')}</div><div class="hedge-contract"><h3>${fmt(c.strike,0)} PE</h3><span>${esc(dateText(c.expiry))}</span></div><p class="small muted">${c.lots} lots × ${c.lotSize} units · ${fmt(c.units,0)} matched units</p><div class="hedge-card-metrics"><div><small>NEW HEDGE COST</small><b>${money(c.grossCost)}</b></div><div><small>LARGEST SAMPLED LOSS</small><b>${money(c.stressLoss)}</b></div></div><p class="fine">${esc(c.badges.includes('Balanced')?'Closest balance of cost and sampled loss within your limits.':c.badges.includes('Lower cost')?'Lowest new-hedge cost among qualifying puts.':'Smallest loss across the tested scenarios among qualifying puts.')}</p><button class="secondary full" data-hedge-select="${esc(c.id)}">${hedgeSelected===c.id?'Viewing comparison':'Compare with current hedge'}</button></article>`;}
function renderHedge(){
 if(!$('hedge-status'))return;
 const out=$('hedge-results');let settings;
 try{settings=readHedgeForm();}catch(e){$('hedge-status').textContent=e.message;out.innerHTML=empty('Set your budget and loss limit to compare listed puts against your saved book.');hedgeResult=null;return;}
 const dates=hedgeDates(settings),waiting=dates.filter(d=>pending.has(key('hedges',d))),unavailable=dates.filter(d=>pending.has(key('hedges',d))||failed.has(key('hedges',d)));
 $('hedge-refresh').disabled=waiting.length>0;
 const packets=dates.map(d=>getResearch('hedges',d)?.data).filter(d=>d?.spot&&!unavailable.includes(d.option_expiry));
 const base=[snapshot,...packets].filter(Boolean).sort((a,b)=>Date.parse(b.spot?.quote_as_of)-Date.parse(a.spot?.quote_as_of)||Date.parse(b.fetched_at_iso)-Date.parse(a.fetched_at_iso))[0];
 const chains=Object.fromEntries(dates.map(d=>[d,getResearch('hedges',d)?.data]));
 try{
  const r=HALHedge.compare(book.legs,base,chains,settings,Date.now(),unavailable);hedgeResult=r;
  $('hedge-status').textContent=waiting.length?'Refreshing full quotes for '+waiting.length+' expiries…':!configured?'Connect Upstox, then refresh comparisons.':r.errors.length?'Comparison paused until the required inputs pass the quote checks.':`${r.eligible.length} within your limits · ${r.candidates.length} liquid contracts modelled · ${r.excluded.length} excluded by data / quantity checks`;
  const structure=`<div class="hedge-summary"><span>${fmt(r.futureUnits,0)} futures units</span><span>Through ${esc(shortDate(settings.protectThrough))}</span><span>${r.required.length} eligible expiries</span></div>`;
  const warnings=r.warnings.map(w=>`<p class="hedge-warning">${esc(w)}</p>`).join('');
  if(r.errors.length||!configured){out.innerHTML=structure+warnings+`<div class="card"><h3>${waiting.length?'Checking the option chain':'Fresh quotes needed'}</h3><p class="small muted">Rankings require recent underlying, futures and full put quotes. After market hours, saved prices remain useful for monitoring but cannot qualify a new hedge.</p><details><summary>Review missing inputs (${r.errors.length})</summary>${r.errors.map(e=>`<p class="small muted hedge-reason">${esc(e)}</p>`).join('')}${unavailable.filter(d=>failed.has(key('hedges',d))).map(d=>`<p class="small warning">${esc(d+': '+(issues[failed.get(key('hedges',d))]||'Feed unavailable.'))}</p>`).join('')}</details></div>`;return;}
  if(!r.candidates.some(c=>c.id===hedgeSelected))hedgeSelected=(r.shortlist.find(c=>c.badges.includes('Balanced'))||r.shortlist[0]||r.candidates[0])?.id||null;
  const selected=r.candidates.find(c=>c.id===hedgeSelected);
  out.innerHTML=structure+warnings+`<div class="section-heading"><h2>Your hedge shortlist</h2><span class="pill">MODEL COMPARISON</span></div><p class="footnote">Every shortlisted put meets your budget, sampled-loss limit, dates, liquidity and exact quantity checks. One contract may win more than one category.</p>`+(r.shortlist.length?`<div class="hedge-shortlist">${r.shortlist.map(hedgeCard).join('')}</div>`:empty('No put meets all your limits. Review the costs and exclusions below; no hedge has been selected as suitable.'))+
   (selected?hedgeDetail(r,selected):'')+
   `<details class="card"><summary>All modelled puts (${r.candidates.length})</summary><p class="fine">Sorted by new-hedge cost. Contracts outside your limits are comparison-only.</p><div class="table-wrap"><table><thead><tr><th>HAL put</th><th>Cost</th><th>Sampled loss</th><th>Limits</th></tr></thead><tbody>${r.candidates.map(c=>`<tr><td><button class="text-button" data-hedge-select="${esc(c.id)}">${fmt(c.strike,0)} PE · ${esc(shortDate(c.expiry))}</button></td><td>${money(c.grossCost)}</td><td>${money(c.stressLoss)}</td><td>${esc(c.limits.join('; ')||'Within limits')}</td></tr>`).join('')}</tbody></table></div></details>`+
   `<details class="card"><summary>Excluded contracts (${r.excluded.length})</summary>${r.excluded.map(c=>`<p class="small muted hedge-reason"><b>${fmt(c.strike,0)} PE · ${esc(shortDate(c.expiry))}</b><br>${esc(c.reasons.join('; '))}</p>`).join('')||'<p class="small muted">None excluded by quote or quantity checks.</p>'}</details>`;
 }catch(e){hedgeResult=null;$('hedge-status').textContent=e.message;out.innerHTML=empty('Review the open book, protection date and comparison settings.');}
}
function hedgeDetail(r,c){
 hedgeDateIndex=Math.min(hedgeDateIndex,r.grid.length-1);const g=c.scenarios[hedgeDateIndex],keep=r.keep[hedgeDateIndex];
 return `<section id="hedge-detail" class="card hedge-detail"><span class="eyebrow">KEEP CURRENT VS ${r.oldUnits?'REPLACE ALL PUTS':'ADD PUTS'}</span><h2>${fmt(c.strike,0)} PE · ${esc(dateText(c.expiry))}</h2>${c.limits.length?`<p class="hedge-warning">Outside your limits: ${esc(c.limits.join('; '))}. Comparison only.</p>`:''}<p class="small muted">${c.expiryGap?'This put expires before a saved futures contract and leaves a later protection gap. ':''}Futures stay unchanged. This models ${c.lots} new put lots covering ${fmt(c.units,0)} units; your saved positions are unchanged.</p>
  <div class="hedge-cash">${dataRow('New ask premium + slippage',money(c.premium))}${dataRow('New-put charges entered',money(r.settings.buyFees))}${dataRow('New hedge cost · tested against budget',money(c.grossCost))}${dataRow('Existing-put bid sale less slippage',money(r.oldSaleProceeds))}${dataRow('Existing-put exit charges entered',money(c.exitFees))}${dataRow(c.netOutlay<0?'Estimated net cash credit':'Estimated net cash needed',money(Math.abs(c.netOutlay)))}</div><p class="fine">Sale proceeds reduce cash needed, but selling an asset is not new profit. The budget applies before those proceeds. Displayed depth can change; fills are not guaranteed.</p>
  <div class="section-heading"><h3>Additional P&amp;L from now</h3></div><label>Scenario horizon<select id="hedge-horizon">${r.grid.map((x,i)=>`<option value="${i}" ${i===hedgeDateIndex?'selected':''}>${esc(x.label+' · '+when(new Date(x.time).toISOString()))}</option>`).join('')}</select></label>
  <div class="table-wrap hedge-payoff"><table><caption>Hypothetical HAL changes · ₹ after entered costs</caption><thead><tr><th>HAL move</th><th>Keep current</th><th>${r.oldUnits?'Replace puts':'Add puts'}</th><th>Difference</th></tr></thead><tbody>${g.values.map((v,i)=>{const k=keep.values[i].pnl;return `<tr><th scope="row">${v.shock===0?'Unchanged':v.shock+'%'}<br><small>${money(v.price)}</small></th><td class="${k===null?'muted':k<0?'negative':'positive'}">${money(k)}</td><td class="${v.pnl<0?'negative':'positive'}">${money(v.pnl)}</td><td>${k===null?'—':money(v.pnl-k)}</td></tr>`;}).join('')}</tbody></table></div>
  <p class="fine">Largest sampled loss ${money(c.stressLoss)} is the largest model loss across all shown dates and 0%, −3%, −5%, −10% moves. It is not a guaranteed maximum loss. ${keep.values[0].pnl===null?'Keep-current values are unavailable beyond an existing put expiry.':''}</p>
  <details><summary>Price evidence &amp; entry-based P&amp;L</summary>${dataRow('Bid / ask',money(c.quote.bid)+' / '+money(c.quote.ask))}${dataRow('Spread / limit',fmt(c.spread,2)+'% / '+fmt(r.settings.maxSpread,1)+'%')}${dataRow('Top bid / ask units',fmt(c.quote.bid_quantity,0)+' / '+fmt(c.quote.ask_quantity,0))}${dataRow('Volume / open interest',fmt(c.quote.volume,0)+' / '+fmt(c.quote.open_interest,0))}${dataRow('Provider IV / scenario change',fmt(c.iv,2)+'% / '+signed(r.settings.ivShift)+' pp')}${dataRow('Provider delta / theta per unit',fmt(c.delta,4)+' / '+fmt(c.theta,4))}${dataRow('Put quote / last trade',when(c.quote.quote_as_of)+' / '+when(c.quote.last_trade_at))}${dataRow('Spot used for comparison',money(r.spot))}<p class="fine">Current futures LTPs and existing-put bids define the starting value. Manual marks are not used. Entry-based estimates below include the original cost of saved open positions and the proposed replacement costs; historical closed trades and previously recorded journal charges are excluded.</p>${g.values.map(v=>dataRow((v.shock===0?'Unchanged HAL':v.shock+'% HAL')+' · P&L vs saved entries',money(v.entryPnl))).join('')}</details>
 </section>`;
}
function bindHedge(){
 $('hedge-refresh').onclick=refreshHedges;
 $('hedge-controls').addEventListener('input',()=>{hedgeSelected=null;renderHedge();});
 $('hedge-results').addEventListener('click',e=>{const b=e.target.closest('[data-hedge-select]');if(b){hedgeSelected=b.dataset.hedgeSelect;renderHedge();$('hedge-detail')?.scrollIntoView({block:'start'});}});
 $('hedge-results').addEventListener('change',e=>{if(e.target.id==='hedge-horizon'){hedgeDateIndex=Number(e.target.value);renderHedge();$('hedge-horizon')?.focus({preventScroll:true});}});
}
