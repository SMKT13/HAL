'use strict';
const deskFields=['capital','maxLoss','hedgeBudget','reserve','reviewBelow','reviewAbove'];
function deskReview(){return HALDesk.review(book,effectiveSnapshot(),{technical:pending.has(key('candles','D'))?null:technical('D'),refreshing:loading||[...pending.keys()].some(k=>k.startsWith('chain:'))});}
function syncDeskProfile(){for(const k of deskFields)$('desk-'+k).value=book.riskProfile[k]??'';}
function deskPlan(which='scenario'){
 switchTab('plan');
 for(const name of ['scenario','hedge','rollover']){const el=$(name==='rollover'?'rollover-workspace':'position-'+name);el.classList.toggle('active',name===which);el.hidden=name!==which;if(name==='rollover'&&name===which)el.open=true;}
 document.querySelectorAll('[data-plan-panel]').forEach(b=>{b.classList.toggle('selected',b.dataset.planPanel===which);b.setAttribute('aria-pressed',String(b.dataset.planPanel===which));});
}
function deskAction(action){
 if(['profile','funding','book','risk'].includes(action)){switchTab('positions');panel('position',action==='risk'?'risk':'book');const id={profile:'desk-profile',funding:'funding-card',book:'position-editor',risk:'risk-metrics'}[action];if(action==='profile'||action==='book')$(id).open=true;$(id).scrollIntoView({block:'start'});}
 else if(action==='scenario'||action==='plan')deskPlan('scenario');
 else if(action==='technical'){switchTab('research');panel('research','technical');}
 else if(action==='data'){$('desk-health').open=true;$('desk-health').scrollIntoView({block:'start'});}
}
function renderDesk(){
 const d=deskReview(),p=d.profile;
 $('desk-date').textContent=new Date().toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long'});
 $('desk-status').textContent=d.status;
 $('desk-refresh').disabled=loading;
 $('desk-mode').textContent=d.dataMode==='current'?'CURRENT QUOTES':d.dataMode==='saved'?'SAVED PLANNING':'DATA INCOMPLETE';
 $('desk-book-status').textContent=d.confirmed?'Book confirmed '+when(p.confirmedAt):book.legs.length?'Book needs confirmation':'No open position saved';
 $('desk-confirm').disabled=!book.legs.length;
 $('desk-confirm-note').textContent=d.confirmed?'Your confirmation applies to these saved contracts for 24 hours.':book.legs.length?'Check the saved contracts, quantities and entries against your broker, then confirm below.':'Save your actual open contracts first.';
 $('desk-net').textContent=money(d.ledger.net);color($('desk-net'),d.ledger.net);
 $('desk-net-note').textContent='Realised '+money(d.ledger.realized)+' · Recorded costs '+money(d.ledger.charges)+'. '+(C.finite(d.capitalReturnPct)?signed(d.capitalReturnPct)+'% of allocated capital.':'Allocated capital not set.');
 $('desk-exposure').innerHTML=tile('FUTURES NOTIONAL',money(d.futuresNotional),'Exposure, not margin required')+tile('NET DELTA',fmt(d.risk.delta,1),'Indicative share-equivalent units');
 $('desk-protection').innerHTML=d.protection.length?d.protection.map(p=>`<div class="desk-protection-row"><div><b>${fmt(p.strike,0)} PE</b><small>${esc(shortDate(p.expiry))} · ${fmt(p.units,0)} units</small></div><span>${C.finite(p.distancePct)?fmt(Math.abs(p.distancePct),1)+'% '+(p.distancePct>=0?'below':'above')+' spot':'Spot unavailable'}</span></div>`).join(''):empty('No active protective puts recorded.');
 const triggered=d.events.filter(e=>e.level==='review'),setup=d.events.filter(e=>e.level!=='review');
 const card=e=>`<article class="card insight ${e.level==='review'?'warn':''}"><span class="insight-label">${e.level==='review'?'REVIEW TRIGGER':e.level==='data'?'DATA QUALITY':'REVIEW INPUT'}</span><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p><details><summary>Position impact &amp; evidence</summary><p><b>Affected:</b> ${esc(e.affected)}</p><p>${esc(e.evidence)}</p></details><button class="text-button" data-desk-action="${esc(e.action)}">Review this ↗</button></article>`;
 $('desk-triggers').innerHTML=triggered.length?triggered.map(card).join(''):`<div class="card"><h3>${d.missing?'Review inputs are incomplete':'No monitored rule triggered'}</h3><p class="small muted">${d.missing?'Complete the checks below before relying on this review.':esc(d.limitations)}</p></div>`;
 $('desk-setup').innerHTML=setup.map(card).join('');$('desk-setup-count').textContent=setup.length+' input'+(setup.length===1?'':'s')+' to review';
 $('desk-stress').innerHTML=d.scenarios.length?'<div class="table-wrap"><table><thead><tr><th>Spot shock</th><th>Model change</th><th>Futures cash loss</th><th>Cash less reserve</th></tr></thead><tbody>'+d.scenarios.map(s=>`<tr><td>${s.shock}%</td><td>${money(s.modelChange)}</td><td>${money(s.futuresCashLoss)}</td><td class="${s.cashAfterReserve<0?'negative':''}">${money(s.cashAfterReserve)}</td></tr>`).join('')+'</tbody></table></div>':empty(d.scenarioError||'Scenario data unavailable.');
 $('desk-stress-note').textContent=(d.dataMode==='saved'?'Saved-snapshot planning. ':'')+'Instant price shocks at unchanged time and IV; changes compare two Black–Scholes model values, not the quoted premium. Cash loss assumes futures move with spot, no put sale proceeds and no extra margin. Cash headroom requires funding saved within 24 hours. Not a loss cap or forecast.';
 $('desk-health-rows').innerHTML=dataRow('Spot',d.spotCurrent?'Recent quote and trade timestamps':'Older, missing, failed or pending')+dataRow('Quote time',when(snapshot?.spot?.quote_as_of))+dataRow('Last spot trade',when(snapshot?.spot?.last_trade_at))+d.states.map(l=>`<div class="desk-feed-row"><b>${l.type==='PE'?fmt(l.strike,0)+' PE':'Futures'} · ${esc(shortDate(l.expiry))}</b><span class="pill">${esc(l.status.toUpperCase())}</span><p>${esc(l.reason)}</p><p>Quote ${esc(when(l.quoteAt))} · Trade ${esc(when(l.tradeAt))}${l.source==='Manual mark'?' · Manual mark '+esc(when(l.manualAt)):''}</p></div>`).join('')+['candles','fundamentals','news','filings'].map(section=>dataRow(section[0].toUpperCase()+section.slice(1),researchStatus(section))).join('');
 $('desk-plan-context').textContent=book.legs.length?`${book.legs.length} saved legs · ${fmt(d.risk.futureUnits,0)} futures units · Next expiry ${shortDate(d.risk.nextExpiry)}. ${d.dataMode==='current'?'Check each planner’s executable-quote requirements.':'Saved context only; fresh full quotes are required for hedge and rollover comparisons.'}`:'Add your current open book in My Position first.';
 $('desk-limits-summary').textContent='Strategy loss limit '+money(p.maxLoss)+' · New hedge budget '+money(p.hedgeBudget)+' · Cash reserve '+money(p.reserve)+'. Planner values are reviewed separately before comparison.';
}
function bindDesk(){
 // Move the existing tested engines into Plan without duplicating their forms or IDs.
 for(const id of ['position-scenario','position-hedge','rollover-workspace']){$('desk-plan-workspace').appendChild($(id));$(id).classList.remove('subpanel');}
 $('position-scenario').classList.add('active');$('position-hedge').hidden=true;$('rollover-workspace').hidden=true;
 syncDeskProfile();$('desk-refresh').onclick=refresh;
 $('desk-save-profile').onclick=()=>{try{const profile=A.riskProfile({...book.riskProfile,...Object.fromEntries(deskFields.map(k=>[k,C.value($('desk-'+k).value)]))});saveBook({...book,riskProfile:profile});renderDesk();toast('Position limits saved. Planner settings stay explicit.');}catch(e){toast(e.message);}};
 $('desk-confirm').onclick=()=>{try{saveBook({...book,riskProfile:{...book.riskProfile,confirmedAt:new Date().toISOString(),confirmedBook:HALDesk.bookKey(book.legs)}});renderDesk();toast('Saved book confirmed for this review.');}catch(e){toast(e.message);}};
 $('desk-ai').onclick=()=>{switchTab('ai');aiState.mode='copilot';$('ai-question').value='Review my open HAL position first: data gaps, triggered limits, protection strikes and expiry gaps, futures cash stress, then alternatives to compare. Use the desk calculations. Separate facts, assumptions and unknowns. Do not invent a price target or a best trade.';invalidateAI();renderAI();};
 $('desk-use-limits').onclick=()=>{const p=book.riskProfile;if(p.hedgeBudget!==null)$('hedge-budget').value=p.hedgeBudget;if(p.hedgeBudget!==null)$('plan-budget').value=p.hedgeBudget;if(p.reserve!==null)$('plan-cashReserve').value=p.reserve;for(const id of ['hedge-budget','plan-budget','plan-cashReserve'])$(id).dispatchEvent(new Event('input',{bubbles:true}));toast('Budget and reserve copied. Check all planner assumptions before comparing.');};
 document.addEventListener('click',e=>{const action=e.target.closest('[data-desk-action]'),plan=e.target.closest('[data-plan-panel]');if(action)deskAction(action.dataset.deskAction);if(plan)deskPlan(plan.dataset.planPanel);});
}
