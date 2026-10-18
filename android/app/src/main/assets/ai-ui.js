'use strict';
// Local inference only. Evidence and replies are transient and never uploaded.
const aiState={mode:'copilot',configured:false,model:'',config:null,configId:null,request:null,result:null,error:'',modelMessage:'',modelBusy:false,revision:0,sequence:0};
function aiId(){return 'local-'+Date.now().toString(36)+'-'+(++aiState.sequence);}
function aiSharedBook(){
 const clean=A.validateBook(book);
 return {...clean,journal:clean.journal.map(entry=>({...entry,note:''})),notes:[],bookmarks:[],...(clean.legacy?{legacy:{...clean.legacy,journal:[]}}:{}),preferences:{theme:'system',auto:false,markMode:clean.preferences.markMode}};
}
function aiFingerprint(){return JSON.stringify(aiSharedBook());}
function invalidateAI(reason){aiState.revision++;aiState.result=null;aiState.error=reason||'';renderAI();}
function invalidateAIForBook(){
 const submitted=aiState.request||aiState.result;
 if(submitted&&submitted.mode!=='research'&&submitted.fingerprint!==aiFingerprint())invalidateAI('Your saved book changed. Run a new local review for the current positions.');
 else renderAI();
}
function aiEvidence(mode){
 const cut=(value,n=160)=>typeof value==='string'?value.slice(0,n):'';
 const news=allNews.slice(0,3).map(n=>({title:cut(n.title),summary:cut(n.summary,180),published:cut(String(n.published||''),60),source:cut(n.source,60)}));
 const sources=allNews.slice(0,3).filter(n=>A.safeURL(n.url)&&n.url.length<=400).map(n=>({title:cut(n.title,100),url:A.safeURL(n.url)}));
 const tech=technical('D'),summary=A.financialSummary(getResearch('fundamentals')?.data);
 const e={quoteAsOf:snapshot?.spot?.quote_as_of||null,quoteFreshness:C.freshness(snapshot),previousSnapshot:lastFailed,spot:snapshot?.spot?.last_price??null,news,sources,
  technical:{ready:!!tech.ready,stale:tech.stale!==false,asOf:tech.asOf?new Date(tech.asOf).toISOString():null,rsi:tech.rsi??null,macd:tech.macd??null,atr:tech.atr??null,sma20:tech.sma20??null,sma50:tech.sma50??null,support:tech.support??null,resistance:tech.resistance??null},
  fundamentals:{revenue:summary.revenue||null,profit:summary.profit||null,margin:summary.margin??null,notes:'Provider units and matching periods only.'},contextNotes:['Saved app evidence only. No live web search.']};
 if(mode!=='research'){
  const effective=effectiveSnapshot(),risk=A.risk(book.legs,effective);
  e.positions=C.mtm(book.legs,effective).rows.map(l=>({type:l.type,expiry:l.expiry,lots:l.lots,lotSize:l.lotSize,entry:l.entry,strike:l.strike,mark:l.price,pnl:l.pnl,markSource:l.source,markTime:l.stamp||null}));
  e.ledger=A.ledger(book,effective);e.funding=book.funding;e.hedgeSettings=book.hedge;
  e.risk={futureUnits:risk.futureUnits,putUnits:risk.putUnits,coverage:risk.coverage,delta:risk.delta,theta:risk.theta,nextExpiry:risk.nextExpiry,warnings:risk.warnings.slice(0,3).map(w=>cut(w.title+': '+w.detail,200))};
 }
 if(JSON.stringify(e).length>7500){e.news=[];e.sources=[];e.contextNotes.push('News omitted to fit the local context window.');}
 if(JSON.stringify(e).length>7500){delete e.technical;delete e.fundamentals;e.contextNotes.push('Research indicators omitted to retain the complete position metrics.');}
 return e;
}
function loadAIConfig(force=false){
 if(aiState.configId||(!force&&aiState.config))return;
 if(!window.HALNative||typeof HALNative.aiConfig!=='function'){aiState.error='Install the on-device AI APK to load a local model.';renderAI();return;}
 aiState.configId=aiId();aiState.configStarted=Date.now();native('aiConfig',JSON.stringify({id:aiState.configId}));renderAI();
}
function runAI(){
 if(aiState.request||aiState.modelBusy)return;
 if(!aiState.configured||!aiState.config?.aiEnabled||aiState.config.offline!==true){aiState.error='Download or import a local AI model first.';renderAI();return;}
 const message=$('ai-question').value.trim();
 if(message.length>2000||(!message&&aiState.mode!=='deliberate')){aiState.error='Enter a question of up to 2,000 characters.';renderAI();return;}
 const request={id:aiId(),revision:aiState.revision,mode:aiState.mode,fingerprint:aiFingerprint(),started:Date.now()};
 const evidence=aiEvidence(request.mode);
 if(JSON.stringify(evidence).length>8000){aiState.error='The local evidence packet is too large. Shorten the saved book before asking.';renderAI();return;}
 aiState.request=request;aiState.result=null;aiState.error='';aiState.modelMessage='';
 native('ai',JSON.stringify({id:request.id,mode:request.mode,local:true,message,evidence}));renderAI();
}
function aiResultHTML(response){
 if(!response||response.success!==true||response.local!==true||typeof response.reply!=='string'||!response.reply.trim())throw Error('The local model returned no usable answer. No remote fallback is used.');
 const sources=(Array.isArray(response.sources)?response.sources:[]).slice(0,5).filter(s=>s&&A.safeURL(s.url));
 let html=`<div class="card ai-provenance"><span class="eyebrow">${esc(String(response.source||'On-device AI').slice(0,120))}</span><p class="small">Processed on this phone · No web search</p><p class="small muted">Generated ${esc(when(response.generatedAt))} · App quote ${esc(when(response.dataAsOf))}</p><p class="fine">Snapshot review: the market feed may have changed since this request.</p></div><article class="card"><span class="eyebrow">LOCAL MODEL INTERPRETATION</span><p class="ai-answer">${esc(response.reply.slice(0,24000))}</p></article>`;
 if(sources.length)html+=`<article class="card"><h3>Saved app sources</h3><div class="ai-sources">${sources.map(s=>`<button class="text-button source-link" data-url="${esc(A.safeURL(s.url))}">${esc(String(s.title||s.url).slice(0,300))} ↗</button>`).join('')}</div><p class="fine">These are saved app sources, not verified citations from the model. Open an original only if you want to check it online.</p></article>`;
 return html;
}
function renderAI(){
 if(!$('view-ai'))return;
 const research=aiState.mode==='research',review=aiState.mode==='deliberate',busy=!!aiState.request;
 document.querySelectorAll('[data-ai-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.aiMode===aiState.mode);b.setAttribute('aria-pressed',b.dataset.aiMode===aiState.mode?'true':'false');});
 $('ai-connection-label').textContent=aiState.modelBusy?'Transferring model to this phone…':aiState.configured?aiState.model:'No local AI model installed';
 $('ai-model').textContent=aiState.configId?'Checking local model…':aiState.config?.aiEnabled?`${aiState.config.model} · CPU · On-device`:'Download the 345 MB CPU model once, or import a .litertlm file.';
 $('ai-description').textContent=review?'One local model reviews technicals, fundamentals, saved news, derivatives, risk and synthesis. These are perspectives from one model.':research?'Summarize research already saved in the app. This model cannot search the internet or know newer news.':'Explain your saved futures, puts, hedge costs and expiry gaps using app-calculated metrics. Your question and positions stay on this phone.';
 $('ai-question-label').textContent=research?'Question about saved research':review?'Focus for the local review · optional':'Your position question';
 $('ai-book-context').textContent=research?'Saved research evidence only; your positions and journal are not included.':`${book.legs.length} saved open legs · computed P&L and risk · private notes excluded · processed locally`;
 $('ai-quick-prompts').hidden=research||review;
 $('ai-run').disabled=busy||aiState.modelBusy||!aiState.configured||!aiState.config?.aiEnabled||aiState.config?.offline!==true;
 $('ai-run').textContent=busy?'Running on your phone…':review?'Run local review':research?'Review saved research':'Ask local Copilot';
 $('ai-stop').hidden=!busy;$('ai-cancel-model').hidden=!aiState.modelBusy;$('ai-check').disabled=!!aiState.configId||busy||aiState.modelBusy;
 $('ai-status').textContent=aiState.error||aiState.modelMessage||(busy?'Local models may take time to load and answer. Stop the review at any time.':'');
 $('ai-status').classList.toggle('hidden',!$('ai-status').textContent);
 $('ai-results').innerHTML=aiState.result?.html||'';
}
function receiveAI(event,data){
 if(event==='ai_connection'){
  const connectionKey=JSON.stringify([data?.offline,data?.configured,data?.busy,data?.model,data?.revision]);
  if(aiState.connectionKey===connectionKey){renderAI();return true;}aiState.connectionKey=connectionKey;
  aiState.configured=data?.offline===true&&data?.configured===true;aiState.model=typeof data?.model==='string'?data.model:'';aiState.modelBusy=data?.busy===true;
  aiState.config=null;aiState.configId=null;aiState.request=null;aiState.revision++;aiState.result=null;aiState.error='';
  if(tab==='ai')loadAIConfig();else renderAI();return true;
 }
 if(event==='ai_model_progress'){
  aiState.modelBusy=true;aiState.modelMessage=data?.total>0?`Saving model · ${Math.min(100,Math.floor(data.bytes/data.total*100))}%`:'Saving model to this phone…';renderAI();return true;
 }
 if(event==='ai_model_done'||event==='ai_model_error'){aiState.modelMessage=typeof data?.message==='string'?data.message:'Model operation finished.';aiState.error='';renderAI();return true;}
 if(event==='ai_config'||event==='ai_config_error'){
  if(data?.id!==aiState.configId)return true;aiState.configId=null;
  if(event==='ai_config_error')aiState.error=data.message||'Could not check the local model.';
  else if(data.data?.offline!==true||typeof data.data?.aiEnabled!=='boolean'){aiState.config=null;aiState.error='Install the on-device AI APK. Remote AI is not enabled here.';}
  else{aiState.config={aiEnabled:data.data.aiEnabled,offline:true,model:String(data.data.model||'Local model').slice(0,100)};aiState.error='';}
  renderAI();return true;
 }
 if(event==='ai_result'||event==='ai_error'){
  const request=aiState.request;if(!request||data?.id!==request.id)return true;aiState.request=null;
  if(request.revision!==aiState.revision||request.mode!==aiState.mode||(request.mode!=='research'&&request.fingerprint!==aiFingerprint())){aiState.error='Earlier reply discarded because its question, mode or saved book changed.';renderAI();return true;}
  try{if(event==='ai_error')throw Error(data.message||'Local inference failed. No remote fallback is used.');aiState.result={mode:request.mode,fingerprint:request.fingerprint,html:aiResultHTML(data.data)};aiState.error='';}
  catch(error){aiState.result=null;aiState.error=error.message;}
  renderAI();return true;
 }
 return false;
}
function bindAI(){
 for(const id of ['ai-connect','settings-ai-connect'])$(id).onclick=()=>{if($('settings-dialog').open)$('settings-dialog').close();native('aiSettings');};
 $('ai-check').onclick=()=>loadAIConfig(true);$('ai-run').onclick=runAI;
 $('ai-stop').onclick=()=>{if(aiState.request){aiState.revision++;native('aiCancel',aiState.request.id);aiState.error='Stopping the local review…';renderAI();}};
 $('ai-cancel-model').onclick=()=>{native('aiCancelModel');aiState.modelMessage='Stopping model transfer…';renderAI();};
 $('ai-question').oninput=()=>invalidateAI();
 document.querySelectorAll('[data-ai-mode]').forEach(b=>b.onclick=()=>{if(aiState.mode!==b.dataset.aiMode){aiState.mode=b.dataset.aiMode;invalidateAI();}});
 document.querySelectorAll('[data-ai-prompt]').forEach(b=>b.onclick=()=>{$('ai-question').value=b.dataset.aiPrompt;invalidateAI();});
 setInterval(()=>{
  if(aiState.request&&Date.now()-aiState.request.started>300000){native('aiCancel',aiState.request.id);aiState.request=null;aiState.error='Local review timed out. Try a shorter question or a smaller model.';renderAI();}
  if(aiState.configId&&Date.now()-aiState.configStarted>10000){aiState.configId=null;aiState.error='Local model status did not respond. Restart the app.';renderAI();}
 },5000);renderAI();
}
