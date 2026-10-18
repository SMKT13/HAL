'use strict';
// AI replies are transient. They never enter the market cache or a backup.
const aiState={mode:'copilot',configured:false,origin:'',config:null,configId:null,configStarted:0,request:null,result:null,error:'',revision:0,sequence:0};
function aiId(){return 'ai-'+Date.now().toString(36)+'-'+(++aiState.sequence);}
function aiSharedBook(){
 const clean=A.validateBook(book);
 return {...clean,journal:clean.journal.map(entry=>({...entry,note:''})),notes:[],bookmarks:[],...(clean.legacy?{legacy:{...clean.legacy,journal:[]}}:{}),preferences:{theme:'system',auto:false,markMode:clean.preferences.markMode}};
}
function aiFingerprint(){return JSON.stringify(aiSharedBook());}
function invalidateAI(reason){aiState.revision++;aiState.result=null;aiState.error=reason||'';renderAI();}
function invalidateAIForBook(){
 const submitted=aiState.request||aiState.result;
 if(submitted&&submitted.mode!=='research'&&submitted.fingerprint!==aiFingerprint()){
  $('ai-consent').checked=false;invalidateAI('Your saved book changed. Run a new review for the current positions.');
 }else renderAI();
}
function loadAIConfig(force=false){
 if(!aiState.configured||aiState.configId||(!force&&aiState.config))return;
 if(!window.HALNative||typeof HALNative.aiConfig!=='function'){aiState.error='Install the updated Android APK to connect AI.';renderAI();return;}
 aiState.configId=aiId();aiState.configStarted=Date.now();aiState.error='';
 native('aiConfig',JSON.stringify({id:aiState.configId}));renderAI();
}
function runAI(){
 if(aiState.request||!$('ai-consent').checked)return;
 if(!aiState.configured||!aiState.config?.aiEnabled){aiState.error='Connect an AI-enabled HAL server first.';renderAI();return;}
 if(aiState.mode==='research'&&!aiState.config.searchEnabled){aiState.error='Search research is disabled on this server.';renderAI();return;}
 const message=$('ai-question').value.trim();
 if(message.length>2000||(!message&&aiState.mode!=='deliberate')){aiState.error='Enter a question of up to 2,000 characters.';renderAI();return;}
 if(!window.HALNative||typeof HALNative.ai!=='function'){aiState.error='Install the updated Android APK to run AI.';renderAI();return;}
 const request={id:aiId(),revision:aiState.revision,mode:aiState.mode,fingerprint:aiFingerprint(),started:Date.now()};
 const payload={id:request.id,mode:request.mode,consent:true,message};
 if(request.mode!=='research')payload.book=aiSharedBook();
 if(new TextEncoder().encode(JSON.stringify(payload)).length>128000){aiState.error='Your saved book is too large for one AI request.';renderAI();return;}
 aiState.request=request;aiState.result=null;aiState.error='';$('ai-consent').checked=false;
 native('ai',JSON.stringify(payload));renderAI();
}
function aiResultHTML(response,mode){
 if(!response||typeof response!=='object'||response.success!==true)throw Error('The AI server returned an invalid answer. No substitute was generated.');
 const sources=(Array.isArray(response.sources)?response.sources:[]).slice(0,30).filter(s=>s&&A.safeURL(s.url));
 const grounded=mode==='research'&&response.grounded===true&&sources.length>0;
 let html=`<div class="card ai-provenance"><span class="eyebrow">${esc(String(response.source||aiState.config?.model||'Gemini').slice(0,100))}</span><p class="small">${grounded?'Search sources returned':'No live search grounding'} · Generated ${esc(when(response.generatedAt))}</p>${mode!=='research'?`<p class="small muted">Server market quote · ${esc(when(response.dataAsOf))}. Review quote age and missing evidence before using this answer.</p>`:''}</div>`;
 if(mode==='deliberate'){
  if(typeof response.consensus!=='string'||typeof response.consensusSummary!=='string'||!Array.isArray(response.agents)||!response.agents.length||!Array.isArray(response.recommendations)||!response.recommendations.every(s=>typeof s==='string'))throw Error('The AI server returned an incomplete review. Try again.');
  html+=`<article class="card"><span class="eyebrow">SYNTHESIS</span><h2>${esc(response.consensus.slice(0,200))}</h2><p class="ai-answer">${esc(response.consensusSummary.slice(0,6000))}</p></article>`;
  for(const agent of response.agents.slice(0,6)){
   if(!agent||typeof agent.name!=='string'||typeof agent.stance!=='string'||!Array.isArray(agent.keyPoints)||!agent.keyPoints.every(s=>typeof s==='string'))throw Error('The AI server returned an incomplete perspective. Try again.');
   html+=`<article class="card"><span class="eyebrow">${esc(agent.stance.slice(0,100))}</span><h3>${esc(agent.name.slice(0,200))}</h3><ul>${agent.keyPoints.slice(0,12).map(p=>`<li>${esc(p.slice(0,2000))}</li>`).join('')}</ul></article>`;
  }
  html+=`<article class="card"><h3>Questions to monitor</h3><ul>${response.recommendations.slice(0,8).map(p=>`<li>${esc(p.slice(0,2000))}</li>`).join('')}</ul></article>`;
 }else{
  const reply=response.reply||response.report;
  if(typeof reply!=='string'||!reply.trim())throw Error('The AI response was empty. Try again.');
  html+=`<article class="card"><span class="eyebrow">${mode==='research'?'RESEARCH RESPONSE':'POSITION COPILOT'}</span><p class="ai-answer">${esc(reply.slice(0,24000))}</p></article>`;
 }
 if(sources.length)html+=`<article class="card"><h3>Sources returned by Gemini</h3><div class="ai-sources">${sources.map(s=>`<button class="text-button source-link" data-url="${esc(A.safeURL(s.url))}">${esc(String(s.title||s.url).slice(0,300))} ↗</button>`).join('')}</div><p class="fine">Open the originals to verify claims; source links do not establish that every statement is supported.</p></article>`;
 return html;
}
function renderAI(){
 if(!$('view-ai'))return;
 const research=aiState.mode==='research',review=aiState.mode==='deliberate',busy=!!aiState.request;
 document.querySelectorAll('[data-ai-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.aiMode===aiState.mode);b.setAttribute('aria-pressed',b.dataset.aiMode===aiState.mode?'true':'false');});
 $('ai-connection-label').textContent=aiState.configured?aiState.origin:'AI connection not configured';
 $('ai-model').textContent=aiState.configId?'Checking AI availability…':aiState.config?`${aiState.config.model} · ${aiState.config.aiEnabled?'AI enabled':'AI unavailable'} · ${aiState.config.searchEnabled?'Search enabled':'Search disabled'}`:'Connect your HAL AI server to begin.';
 $('ai-description').textContent=review?'One Gemini model reviews technicals, fundamentals, news, derivatives, risk and synthesis. These are six perspectives, not independent agents.':research?'Ask a HAL news or business question. A grounded label appears only when the server returns usable search sources.':'Ask about your saved futures, puts, expiry gaps, hedge costs or rollover scenarios. The server fetches its own evidence and calculates the position context.';
 $('ai-question-label').textContent=research?'HAL research question':review?'Focus for this review · optional':'Your position question';
 $('ai-consent-text').textContent=research?'Send this question to my HAL server, Gemini and Google Search.':'Send this question and my saved position book to my HAL server and Gemini. Notes and bookmarks are excluded.';
 $('ai-book-context').textContent=research?'Your position book is not sent for search research.':`${book.legs.length} saved open legs · manual marks, journal and hedge settings included · no Upstox token shared`;
 $('ai-quick-prompts').hidden=research||review;
 $('ai-run').disabled=busy||!aiState.configured||!aiState.config?.aiEnabled||(research&&!aiState.config?.searchEnabled)||!$('ai-consent').checked;
 $('ai-run').textContent=busy?'Gemini is reviewing…':review?'Run six-perspective review':research?'Research with search':'Ask Copilot';
 $('ai-check').disabled=!!aiState.configId||busy;
 $('ai-status').textContent=aiState.error||(busy?'Review in progress. Changing the question, mode or saved book discards this reply.':research&&aiState.config&&!aiState.config.searchEnabled?'Search research is disabled on this server.':'');
 $('ai-status').classList.toggle('hidden',!$('ai-status').textContent);
 $('ai-results').innerHTML=aiState.result?.html||'';
}
function receiveAI(event,data){
 if(event==='ai_connection'){
  aiState.configured=data?.configured===true;aiState.origin=typeof data?.origin==='string'?data.origin:'';
  aiState.config=null;aiState.configId=null;aiState.request=null;$('ai-consent').checked=false;invalidateAI();
  if(tab==='ai')loadAIConfig();return true;
 }
 if(event==='ai_config'||event==='ai_config_error'){
  if(data?.id!==aiState.configId)return true;
  aiState.configId=null;
  if(event==='ai_config_error')aiState.error=data.message||'Could not check AI availability.';
  else if(typeof data.data?.aiEnabled!=='boolean'||typeof data.data?.model!=='string')aiState.error='This server does not expose the current HAL AI configuration.';
  else{aiState.config={aiEnabled:data.data.aiEnabled,searchEnabled:data.data.searchEnabled===true,model:data.data.model.slice(0,100)};aiState.error=aiState.config.aiEnabled?'':'AI is unavailable. Configure Gemini on your HAL server, then check again.';}
  renderAI();return true;
 }
 if(event==='ai_result'||event==='ai_error'){
  const request=aiState.request;if(!request||data?.id!==request.id)return true;
  aiState.request=null;
  if(request.revision!==aiState.revision||request.mode!==aiState.mode||(request.mode!=='research'&&request.fingerprint!==aiFingerprint())){
   aiState.error='Earlier reply discarded because its question, mode or saved book changed.';renderAI();return true;
  }
  try{
   if(event==='ai_error')throw Error(data.message||'AI request failed. No generated answer was substituted.');
   aiState.result={mode:request.mode,fingerprint:request.fingerprint,html:aiResultHTML(data.data,request.mode)};
   aiState.error='';
  }catch(error){aiState.result=null;aiState.error=error.message;}
  renderAI();return true;
 }
 return false;
}
function bindAI(){
 for(const id of ['ai-connect','settings-ai-connect'])$(id).onclick=()=>{if($('settings-dialog').open)$('settings-dialog').close();native('aiSettings');};
 $('ai-check').onclick=()=>loadAIConfig(true);$('ai-run').onclick=runAI;$('ai-consent').onchange=renderAI;
 $('ai-question').oninput=()=>{$('ai-consent').checked=false;invalidateAI();};
 document.querySelectorAll('[data-ai-mode]').forEach(b=>b.onclick=()=>{if(aiState.mode!==b.dataset.aiMode){aiState.mode=b.dataset.aiMode;$('ai-consent').checked=false;invalidateAI();}});
 document.querySelectorAll('[data-ai-prompt]').forEach(b=>b.onclick=()=>{$('ai-question').value=b.dataset.aiPrompt;$('ai-consent').checked=false;invalidateAI();});
 setInterval(()=>{
  if(aiState.request&&Date.now()-aiState.request.started>150000){aiState.request=null;aiState.error='The AI request timed out. Check your connection and retry.';renderAI();}
  if(aiState.configId&&Date.now()-aiState.configStarted>45000){aiState.configId=null;aiState.error='AI availability check timed out. Check your server connection.';renderAI();}
 },5000);
 renderAI();
}
