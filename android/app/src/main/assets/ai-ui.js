'use strict';
// Gemini requests run in Android. Credentials never enter JavaScript; replies are transient.
const aiState={mode:'copilot',configured:false,model:'',config:null,configId:null,request:null,result:null,error:'',revision:0,sequence:0};
function aiId(){return 'gemini-'+Date.now().toString(36)+'-'+(++aiState.sequence);}
function aiSharedBook(){
 const clean=A.validateBook(book);
 return {...clean,journal:clean.journal.map(entry=>({...entry,note:''})),notes:[],bookmarks:[],...(clean.legacy?{legacy:{...clean.legacy,journal:[]}}:{}),preferences:{theme:'system',auto:false,markMode:clean.preferences.markMode}};
}
function aiFingerprint(){return JSON.stringify(aiSharedBook());}
function invalidateAI(reason){aiState.revision++;aiState.result=null;aiState.error=reason||'';$('ai-consent').checked=false;renderAI();}
function invalidateAIForBook(){
 const submitted=aiState.request||aiState.result;
 if(submitted&&submitted.mode!=='research'&&submitted.fingerprint!==aiFingerprint())invalidateAI('Your saved book changed. Run a new review for the current positions.');
 else renderAI();
}
function aiEvidence(mode){
 const cut=(v,n=160)=>typeof v==='string'?v.slice(0,n):'';
 const selected=allNews.slice(0,8),news=selected.map((n,i)=>({id:'N'+(i+1),title:cut(n.title,220),summary:cut(n.summary,350),published:cut(String(n.published||''),60),source:cut(n.source,60),official:n.official===true}));
 const sources=selected.map((n,i)=>({id:'N'+(i+1),title:cut(n.title,100),url:A.safeURL(n.url)})).filter(n=>n.url&&n.url.length<=400);
 const tech=technical('D'),data=getResearch('fundamentals')?.data,summary=A.financialSummary(data);
 const histories=(rows,categories)=>rows?.filter(r=>categories.includes(r.category)).slice(0,5).map(r=>({category:r.category,history:r.history?.slice(0,6).map(h=>({period:cut(h.period,80),value:C.finite(h.value)?h.value:null,change:cut(h.change,40)}))}))||[];
 const health=Object.fromEntries(['candles','patterns','fundamentals','news','filings'].map(section=>{const p=getResearch(section,'D');return [section,{fetchedAt:p?.fetched_at_iso||null,pending:pending.has(key(section,'D')),failed:failed.has(key(section,'D')),partial:Object.keys(p?.errors||{}).slice(0,10),source:p?.source||null}];}));
 const e={quoteAsOf:snapshot?.spot?.quote_as_of||null,quoteFreshness:C.freshness(snapshot),previousSnapshot:lastFailed,spot:snapshot?.spot?.last_price??null,news,sources,dataHealth:health,
  technical:{ready:!!tech.ready,stale:tech.stale!==false,asOf:tech.asOf?new Date(tech.asOf).toISOString():null,rsi:tech.rsi??null,macd:tech.macd??null,atr:tech.atr??null,sma20:tech.sma20??null,sma50:tech.sma50??null,sma200:tech.sma200??null,support:tech.support??null,resistance:tech.resistance??null,volatility:tech.vol??null,mfi:tech.mfi??null},
  fundamentals:{revenue:summary.revenue||null,profit:summary.profit||null,margin:summary.margin??null,operatingMargin:summary.opMargin??null,cash:summary.cash||null,cashConversion:summary.conversion??null,
   quarterly:histories(data?.income?.income_statement,['revenue','net_profit','operating_profit']),annual:histories(data?.annual?.income_statement,['revenue','net_profit']),
   ratios:Array.isArray(data?.ratios)?data.ratios.slice(0,8).map(r=>({name:cut(r.name,80),company:cut(String(r.company_value??''),40),sector:cut(String(r.sector_value??''),40)})):[],notes:'Provider units and matching periods only. Ratio dates are not supplied.'},
  intelligence:intelligenceEvidence(mode),contextNotes:['App-fetched evidence only. Gemini has no live web-search tools. Cite supplied news IDs when relevant; missing data is unknown.']};
 if(mode!=='research'){
  const effective=effectiveSnapshot(),risk=A.risk(book.legs,effective);
  e.positions=C.mtm(book.legs,effective).rows.map(l=>({type:l.type,expiry:l.expiry,lots:l.lots,lotSize:l.lotSize,entry:l.entry,strike:l.strike,mark:l.price,pnl:l.pnl,markSource:l.source,markTime:l.stamp||null}));
  const desk=deskReview();e.positionDesk={status:desk.status,confirmed:desk.confirmed,dataMode:desk.dataMode,limits:{capital:desk.profile.capital,maxLoss:desk.profile.maxLoss,hedgeBudget:desk.profile.hedgeBudget,reserve:desk.profile.reserve,reviewBelow:desk.profile.reviewBelow,reviewAbove:desk.profile.reviewAbove},triggers:desk.events.slice(0,8),stress:desk.scenarios,stressAssumptions:"Instant price shocks, same time and IV; model-to-model change. Futures cash stress excludes option sale proceeds and additional margin. Not a loss floor."};e.ledger=A.ledger(book,effective);e.funding=book.funding;e.hedgeSettings=book.hedge;
  e.risk={futureUnits:risk.futureUnits,putUnits:risk.putUnits,coverage:risk.coverage,delta:risk.delta,theta:risk.theta,nextExpiry:risk.nextExpiry,warnings:risk.warnings.slice(0,6).map(w=>cut(w.title+': '+w.detail,200))};
  if(hedgeResult?.validUntil>Date.now()&&!hedgeResult.errors.length)e.hedgeComparisons={validUntil:hedgeResult.validUntil,warnings:hedgeResult.warnings,shortlist:hedgeResult.shortlist.map(c=>({expiry:c.expiry,strike:c.strike,lots:c.lots,lotSize:c.lotSize,grossCost:c.grossCost,netOutlay:c.netOutlay,stressLoss:c.stressLoss,expiryGap:c.expiryGap,badges:c.badges})),notes:'Largest sampled scenario loss is not a guaranteed maximum.'};
 }
 if(JSON.stringify(e).length>22000){e.news=e.news.slice(0,4);e.sources=e.sources.slice(0,4);e.contextNotes.push('News reduced to retain position and plan evidence.');}
 if(JSON.stringify(e).length>22000){delete e.fundamentals.quarterly;delete e.fundamentals.annual;e.contextNotes.push('Financial history omitted to fit the request limit.');}
 return e;
}
function loadAIConfig(force=false){
 if(aiState.configId||(!force&&aiState.config))return;
 if(!window.HALNative||typeof HALNative.aiConfig!=='function'){aiState.error='Install the updated Android APK to connect directly to Gemini.';renderAI();return;}
 aiState.configId=aiId();aiState.configStarted=Date.now();native('aiConfig',JSON.stringify({id:aiState.configId}));renderAI();
}
function runAI(){
 if(aiState.request)return;
 if(!aiState.configured||!aiState.config?.aiEnabled||aiState.config.direct!==true){aiState.error='Enter your Gemini API key in AI settings first.';renderAI();return;}
 if(!$('ai-consent').checked){aiState.error='Confirm sharing this question and its evidence with Gemini.';renderAI();return;}
 const message=$('ai-question').value.trim();
 if(message.length>2000||(!message&&aiState.mode!=='deliberate')){aiState.error='Enter a question of up to 2,000 characters.';renderAI();return;}
 const request={id:aiId(),revision:aiState.revision,mode:aiState.mode,fingerprint:aiFingerprint(),started:Date.now()};
 const evidence=aiEvidence(request.mode);
 if(JSON.stringify(evidence).length>24000){aiState.error='The evidence packet is too large. Shorten the saved book before asking.';renderAI();return;}
 aiState.request=request;aiState.result=null;aiState.error='';$('ai-consent').checked=false;
 native('ai',JSON.stringify({id:request.id,mode:request.mode,consent:true,message,evidence}));renderAI();
}
function aiResultHTML(response){
 if(!response||response.success!==true||response.direct!==true||typeof response.reply!=='string'||!response.reply.trim())throw Error('Gemini returned no usable answer. Check your API settings and retry.');
 const sources=(Array.isArray(response.sources)?response.sources:[]).slice(0,5).filter(s=>s&&A.safeURL(s.url));
 let html=`<div class="card ai-provenance"><span class="eyebrow">GEMINI DIRECT · ${esc(String(response.source||'Gemini').slice(0,100))}</span><p class="small">Google API · App evidence · No AI web search</p><p class="small muted">Generated ${esc(when(response.generatedAt))} · App quote ${esc(when(response.dataAsOf))}</p><p class="fine">Snapshot review: the market feed may have changed since this request.</p></div><article class="card"><span class="eyebrow">AI INTERPRETATION</span><p class="ai-answer">${esc(response.reply.slice(0,24000))}</p></article>`;
 if(sources.length)html+=`<article class="card"><h3>App research sources</h3><div class="ai-sources">${sources.map(s=>`<button class="text-button source-link" data-url="${esc(A.safeURL(s.url))}">${esc(String(s.title||s.url).slice(0,300))} ↗</button>`).join('')}</div><p class="fine">Sources supplied by the app, not independently verified model citations.</p></article>`;
 return html;
}
function renderAI(){
 if(!$('view-ai'))return;
 const research=aiState.mode==='research',review=aiState.mode==='deliberate',busy=!!aiState.request;
 document.querySelectorAll('[data-ai-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.aiMode===aiState.mode);b.setAttribute('aria-pressed',b.dataset.aiMode===aiState.mode?'true':'false');});
 $('ai-connection-label').textContent=aiState.configured?'API key saved on this phone · checked when you run':'Add your Gemini API key';
 $('ai-model').textContent=aiState.configId?'Reading saved API settings…':aiState.config?.aiEnabled?`${aiState.config.model} · Direct Google API`:'Enter a Gemini API key in settings. No model download is needed.';
 $('ai-description').textContent=review?'One Gemini model reviews technicals, fundamentals, app news, derivatives, risk and synthesis. These are six perspectives from one model.':research?'Explain the HAL news, fundamentals and technical indicators already fetched by this app. Refresh Research for newer evidence.':'Explain your saved futures, puts, hedge costs and expiry gaps using app-calculated metrics.';
 $('ai-question-label').textContent=research?'Question about app research':review?'Focus for the review · optional':'Your position question';
 $('ai-book-context').textContent=research?'Shared with Gemini: app research and your question. Positions, journal, funding and rollover plans are excluded.':`Shared with Gemini: ${book.legs.length} saved open legs, computed P&L, funding, position limits, review triggers, hedge settings, risk, research and any active rollover or pattern comparison. Private notes and broker tokens are excluded.`;
 $('ai-quick-prompts').hidden=research||review;
 $('ai-run').disabled=busy||!aiState.configured||!aiState.config?.aiEnabled||aiState.config?.direct!==true||!$('ai-consent').checked;
 $('ai-run').textContent=busy?'Waiting for Gemini…':review?'Run six-perspective review':research?'Ask about research':'Ask Copilot';
 $('ai-stop').hidden=!busy;$('ai-check').disabled=!!aiState.configId||busy;
 $('ai-consent').disabled=busy;
 $('ai-status').textContent=aiState.error||(busy?'Sending the selected evidence directly to Google. You can stop waiting at any time.':'');
 $('ai-status').classList.toggle('hidden',!$('ai-status').textContent);
 $('ai-results').innerHTML=aiState.result?.html||'';
}
function receiveAI(event,data){
 if(event==='ai_connection'){
  const connectionKey=JSON.stringify([data?.direct,data?.configured,data?.model,data?.revision]);
  if(aiState.connectionKey===connectionKey){renderAI();return true;}aiState.connectionKey=connectionKey;
  aiState.configured=data?.direct===true&&data?.configured===true;aiState.model=typeof data?.model==='string'?data.model:'';
  aiState.config=null;aiState.configId=null;aiState.request=null;aiState.revision++;aiState.result=null;aiState.error='';$('ai-consent').checked=false;
  if(tab==='ai')loadAIConfig();else renderAI();return true;
 }
 if(event==='ai_config'||event==='ai_config_error'){
  if(data?.id!==aiState.configId)return true;aiState.configId=null;
  if(event==='ai_config_error')aiState.error=data.message||'Could not read API settings.';
  else if(data.data?.direct!==true||typeof data.data?.aiEnabled!=='boolean'){aiState.config=null;aiState.error='Install the updated Android APK for direct Gemini API calls.';}
  else{aiState.config={aiEnabled:data.data.aiEnabled,direct:true,model:String(data.data.model||'Gemini').slice(0,100)};aiState.error='';}
  renderAI();return true;
 }
 if(event==='ai_result'||event==='ai_error'){
  const request=aiState.request;if(!request||data?.id!==request.id)return true;aiState.request=null;
  if(request.revision!==aiState.revision||request.mode!==aiState.mode||(request.mode!=='research'&&request.fingerprint!==aiFingerprint())){aiState.error='Earlier reply discarded because its question, mode or saved book changed.';renderAI();return true;}
  try{if(event==='ai_error')throw Error(data.message||'Gemini API request failed.');aiState.result={mode:request.mode,fingerprint:request.fingerprint,html:aiResultHTML(data.data)};aiState.error='';}
  catch(error){aiState.result=null;aiState.error=error.message;}
  renderAI();return true;
 }
 return false;
}
function bindAI(){
 for(const id of ['ai-connect','settings-ai-connect'])$(id).onclick=()=>{if($('settings-dialog').open)$('settings-dialog').close();native('aiSettings');};
 $('ai-check').onclick=()=>loadAIConfig(true);$('ai-run').onclick=runAI;$('ai-consent').onchange=()=>renderAI();
 $('ai-stop').onclick=()=>{if(aiState.request){aiState.revision++;native('aiCancel',aiState.request.id);aiState.error='Stopping the API request…';renderAI();}};
 $('ai-question').oninput=()=>invalidateAI();
 document.querySelectorAll('[data-ai-mode]').forEach(b=>b.onclick=()=>{if(aiState.mode!==b.dataset.aiMode){aiState.mode=b.dataset.aiMode;invalidateAI();}});
 document.querySelectorAll('[data-ai-prompt]').forEach(b=>b.onclick=()=>{$('ai-question').value=b.dataset.aiPrompt;invalidateAI();});
 setInterval(()=>{
  if(aiState.request&&Date.now()-aiState.request.started>150000){native('aiCancel',aiState.request.id);aiState.request=null;aiState.error='Gemini request timed out. Check your connection and retry.';renderAI();}
  if(aiState.configId&&Date.now()-aiState.configStarted>10000){aiState.configId=null;aiState.error='API settings did not respond. Restart the app.';renderAI();}
 },5000);renderAI();
}

