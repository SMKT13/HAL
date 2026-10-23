'use strict';
const I=HALIntelligence;
let intelligenceCheckpoint=null,patternResult=null,patternSignature='';
try{const p=JSON.parse(localStorage.getItem('hal_checkpoint_v1')||'null');if(p?.version===1&&JSON.stringify(p).length<30000)intelligenceCheckpoint=p;}catch(e){}
function currentCheckpoint(){return I.checkpoint(book,effectiveSnapshot(),technical('D'),allNews);}
function currentChanges(){return I.changes(intelligenceCheckpoint,currentCheckpoint(),allNews);}
function renderBriefing(){
 const r=currentChanges();$('briefing-results').innerHTML=r.ready?'<div class="metric-grid">'+tile('SPOT CHANGE',money(r.spot),'Since saved provider quote')+tile('OPEN P&L CHANGE',money(r.open),r.sameBook?'Same saved positions and marks':'Book changed; comparison withheld')+tile('RSI CHANGE',fmt(r.rsi),'Daily completed bars')+tile('NEW IN FEED',String(r.newNews.length),'New URLs observed, not all market news')+'</div>'+r.newNews.slice(0,3).map(n=>'<p class="small">'+esc(n.title)+'</p>').join(''):empty(r.reason);
 $('briefing-status').textContent=(r.ready?'Checkpoint '+when(r.from)+' · Quote '+when(r.toQuote)+'. ':'')+(lastFailed?'Previous snapshot. ':'')+C.freshness(snapshot)+'. Changes can reflect stale/manual marks. Check source timestamps.';
}
function patternData(){const packet=getResearch('patterns')||getResearch('candles','D');return {raw:packet?.data?.history?.candles||[],packet};}
function patternUnavailable(){const d=patternData(),section=d.packet?.section==='patterns'?'patterns':'candles';return pending.has(key('patterns','D'))||pending.has(key(section,'D'))||failed.has(key('patterns','D'))||failed.has(key(section,'D'));}
function usablePattern(){return patternResult&&patternSignature===currentPatternSignature()&&!patternUnavailable()&&Number.isFinite(patternResult.asOf)&&Date.now()-patternResult.asOf<=7*86400000;}
function currentPatternSignature(){const d=patternData();return JSON.stringify([d.packet?.fetched_at_iso,d.raw.length,$('pattern-window').value,$('pattern-horizon').value]);}
function patternChart(r){
 if(!r.matches.length)return '';const lines=[r.query.map(x=>x.c),...r.matches.slice(0,3).map(m=>m.closes)].map(a=>a.map(v=>(v/a[0]-1)*100)),all=lines.flat(),lo=Math.min(...all),range=Math.max(...all)-lo||1;
 const paths=lines.map((a,i)=>'<polyline fill="none" stroke="'+(i===0?'var(--accent)':'var(--muted)')+'" stroke-opacity="'+(i===0?'1':'.45')+'" stroke-width="'+(i===0?'3':'1.5')+'" points="'+a.map((v,j)=>(12+j/(a.length-1)*296).toFixed(2)+','+(150-(v-lo)/range*134).toFixed(2)).join(' ')+'"/>').join('');
 return '<figure class="pattern-figure"><svg viewBox="0 0 320 164" role="img" aria-label="Current pattern in accent colour and up to three historical matches">'+paths+'</svg><figcaption>Current pattern in accent colour; historical matches in grey. Rebased price changes, with no projected future line.</figcaption></figure>';
}
function renderPatterns(){
 if(patternResult&&!usablePattern()){patternResult=null;$('pattern-results').innerHTML='';}
 const r=patternResult,d=patternData(),failedHistory=patternUnavailable();
 $('pattern-refresh').disabled=pending.has(key('patterns','D'));
 $('pattern-status').textContent=r?r.reason+' '+r.bars+' completed bars · Through '+when(r.asOf?new Date(r.asOf).toISOString():null):failedHistory?'History is loading, failed or unavailable. Load history again before comparing.':d.raw.length?d.raw.length+' daily records available · Retrieved '+when(d.packet?.fetched_at_iso)+'.':'Load daily history, then compare completed patterns.';
 if(!r)return;
 $('pattern-results').innerHTML=r.stats?patternChart(r)+'<div class="metric-grid">'+tile('SELECTED MATCHES',String(r.stats.count),'Non-overlapping full windows')+tile('MEDIAN RETURN',fmt(r.stats.median)+'%',r.horizon+' sessions later')+tile('RETURN RANGE',fmt(r.stats.worst)+'% to '+fmt(r.stats.best)+'%','Selected historical closes')+tile('POSITIVE OUTCOMES',fmt(r.stats.positivePct,0)+'%','Historical sample frequency, not probability')+'</div><div class="table-wrap"><table><thead><tr><th>Pattern ended</th><th>Distance ↓</th><th>Later return</th><th>Worst excursion</th><th>Close drawdown</th></tr></thead><tbody>'+r.matches.map(m=>'<tr><td>'+esc(dateText(A.istDate(m.date)))+'</td><td>'+fmt(m.distance,3)+'</td><td>'+fmt(m.returnPct)+'%</td><td>'+fmt(m.adversePct)+'%</td><td>'+fmt(m.drawdownPct)+'%</td></tr>').join('')+'</tbody></table></div><p class="fine">'+esc(r.method)+' No holdout performance or trading win rate is claimed. Drawdown uses daily closes; excursions use daily highs/lows. Corporate actions and regime shifts can distort comparisons.</p>':empty(r.reason);
}
function intelligenceReview(kind){const questions={briefing:'Explain what changed since my saved comparison point. Separate market movement from edits and missing or stale evidence.',patterns:'Explain selected historical pattern matches, limitations and drawdowns; do not turn sample outcomes into forecasts.'};aiState.mode='copilot';$('ai-question').value=questions[kind]||questions.briefing;invalidateAI();switchTab('ai');$('ai-question').scrollIntoView({block:'center'});}
function intelligenceEvidence(mode){
 const e={};if(usablePattern())e.historicalPatterns={ready:patternResult.ready,window:patternResult.window,horizon:patternResult.horizon,asOf:patternResult.asOf,stats:patternResult.stats,reason:patternResult.reason,method:patternResult.method,matches:patternResult.matches.slice(0,5).map(({closes,...m})=>m)};
 if(mode!=='research'){const b=currentChanges();e.changes={...b,newNews:b.newNews?.map(n=>({title:String(n.title).slice(0,160),url:A.safeURL(n.url),published:n.published}))};}
 return e;
}
function renderIntelligence(){renderBriefing();renderPatterns();}
function bindIntelligence(){
 $('briefing-save').onclick=()=>{try{const next=currentCheckpoint();if(!C.finite(next.spot)||!next.quoteAsOf)throw Error('Load a timestamped market snapshot before saving a comparison point.');localStorage.setItem('hal_checkpoint_v1',JSON.stringify(next));intelligenceCheckpoint=next;invalidateAI();renderBriefing();toast('Comparison point saved. AI replies are not saved.');}catch(e){toast(e.message);}};
 $('briefing-ai').onclick=()=>intelligenceReview('briefing');$('pattern-ai').onclick=()=>{if(!usablePattern()||!patternResult?.stats){toast('Compare historical patterns first.');return;}intelligenceReview('patterns');};
 $('pattern-refresh').onclick=()=>{requestResearch('patterns','D',true);invalidateAI();renderPatterns();};$('pattern-scan').onclick=()=>{try{const d=patternData();if(patternUnavailable())throw Error('Wait for a successful history refresh before scanning.');patternResult=I.patterns(d.raw,{window:Number($('pattern-window').value),horizon:Number($('pattern-horizon').value)});patternSignature=currentPatternSignature();invalidateAI();renderPatterns();}catch(e){$('pattern-status').textContent=e.message;}};
 for(const k of ['window','horizon'])$('pattern-'+k).onchange=()=>{patternResult=null;$('pattern-results').innerHTML='';invalidateAI();renderPatterns();};
 setInterval(()=>{if(['insights','ai'].includes(tab))renderIntelligence();},30000);
}

