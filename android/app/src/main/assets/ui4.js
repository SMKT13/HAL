/* HAL Desk 4 presentation. Finance, persistence, transport and AI policy are separate modules. */
(function(){'use strict';
const V5=HAL5Risk,Q5=HAL5Quant,B5=HAL5Backtest,H5=HAL5Hedge,L5=HAL5Lenses,P5=HAL5Portfolio,X5=HAL5Expiry,C5=HAL5Reconcile,Z5=HAL5ScenarioPath,M5=HAL5MigrationGuard,R5=HAL5Rollover;
const E=HAL4Engine,D=HAL4Data,I=HAL4Insights,A5=HAL5Attribution,W=HAL4Workflow,N=window.HALNative,$=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>E.finite(v)?v.toLocaleString('en-IN',{maximumFractionDigits:d}):'—',money=v=>E.finite(v)?(v<0?'−':'')+'₹'+Math.abs(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'Unavailable',pct=v=>E.finite(v)?num(v)+'%':'—';
const when=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' IST':'Time unavailable',date=v=>E.validDate(v)?new Date(v+'T00:00:00Z').toLocaleDateString('en-IN',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}):'—',stamp=()=>new Date().toISOString(),clone=v=>JSON.parse(JSON.stringify(v)),color=v=>E.finite(v)?v<0?'negative':'positive':'muted';
const btn=(a,t,x='')=>`<button data-action="${a}" ${x}>${t}</button>`,badge=(t,c='')=>`<span class="badge ${esc(c)}">${esc(t)}</span>`,row=(a,b)=>`<div class="row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`,tile=(a,b,c='')=>`<div class="metric"><small>${esc(a)}</small><strong>${esc(b)}</strong><span>${esc(c)}</span></div>`,empty=(a,b='')=>`<div class="empty"><strong>${esc(a)}</strong>${esc(b)}</div>`,card=(a,b,c='')=>`<section class="card"><div class="section-heading"><h2>${esc(a)}</h2>${c}</div>${b}</section>`;
const table=(h,rs)=>`<div class="table-wrap"><table><thead><tr>${h.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead><tbody>${rs.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`,input=(id,label,v='',type='number')=>`<label>${esc(label)}<input id="${id}" type="${type}" ${type==='number'?'step="any" inputmode="decimal"':''} value="${esc(v??'')}"></label>`,select=(id,label,opts,v)=>`<label>${esc(label)}<select id="${id}">${opts.map(([k,t])=>`<option value="${esc(k)}" ${k===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`,value=id=>E.value($(id)?.value),text=id=>$(id)?.value||'';
let book=E.emptyBook(),revision=0,s=D.empty(),configured=false,started=false,storageError='',chart=null,saveModal=null,returnFocus=null,toastTimer;
const ui={screen:'position',position:'overview',plan:'stress',research:'company',technicals:'markets',aiPage:'assistant',reviewOpen:false,frame:'D',expiry:'',side:'PE',filter:'all',search:'',statement:'consolidated',scenario:{spot:'',horizon:'',iv:'',shift:0,rate:6,dividend:0,basis:'constant',base:''},result:null,resultAt:null,settlementResult:null,settlementPath:null,settlementAt:null,mcResult:null,mcAt:null,mcVol:'',mcDrift:0,btParams:{fast:20,slow:50,fee:0,slip:0},btReport:null,btRegime:null,btAt:null,btSource:null,reduction:null,compare:{leg:'',lots:1,costs:0},advanced:false,hedges:null,hedgesAt:null,hedgeDraft:null,closePreview:null,rollPreview:null,pattern:null,patternWindow:20,patternForward:5,aiMode:'copilot',question:'Explain the position, expiry gaps, quote reliability and evidence that needs review.',share:false,ai:null,pendingAI:null,aiError:'',aiConfigured:false,model:'',finbert:{state:'not_installed'},sentiments:{}};
function native(name,...args){
 if(name==='exportBackup'&&new Blob([args[0]]).size>2000000)throw Error('This JSON backup exceeds the 2 MB restore limit. Export cancelled.');
 if(typeof N?.[name]==='function')return N[name](...args);if(!['ready','finbertStatus'].includes(name))toast('Available in the installed Android app.');return null;}
function toast(msg){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6000);}
function isBookConfirmed(){return I.isBookConfirmed(book);}
function clearCalculationOutput(){document.querySelectorAll('[data-calculation-output]').forEach(el=>el.remove());}
function invalidateCalculations(){recoveryView.invalidate();clearCalculationOutput();ui.reduction=null;ui.result=null;ui.resultAt=null;ui.settlementResult=null;ui.settlementPath=null;ui.settlementAt=null;ui.mcResult=null;ui.mcAt=null;ui.hedges=null;ui.hedgesAt=null;ui.closePreview=null;ui.rollPreview=null;}
function theme(){document.body.classList.toggle('light',book.preferences.theme==='light'||book.preferences.theme==='system'&&matchMedia('(prefers-color-scheme: light)').matches);}
function commit(b){if(upgradeReview?.exists)throw Error('Review the installed book before editing.');if(storageError)throw Error('Recover the saved book before editing.');const next=E.validateBook(b);const changed=I.materialFingerprint(next)!==I.materialFingerprint(book);if(changed&&I.confirmationFingerprint(next)!==I.confirmationFingerprint(book)){next.riskProfile.confirmedAt=null;next.riskProfile.confirmedBook=null;}const r=D.saveBook(N,localStorage,next,revision);if(changed){ui.ai=null;invalidateCalculations();if(ui.pendingAI)native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;}rememberHoldings(r.book.legs,book.legs);book=r.book;revision=r.revision;book.revision=revision;theme();render();}
function cache(){try{const x=JSON.stringify(D.cache(s));if(N?.cachePut){const r=JSON.parse(N.cachePut('snapshot',x));if(!r.ok)throw Error();}else localStorage.setItem('hal_cache_v4',x);}catch(_){toast('Market cache could not be saved; your portfolio is stored separately.');}}

// The comparison point is written only when the user marks Today as reviewed.
let reviewBaseline=null,reviewReadError=false;
function beginReview(){
 try{
  let data;
  if(N?.cacheGet){
   const r=JSON.parse(N.cacheGet('snapshot:review'));
   if(!r.ok)throw Error();
   data=r.data;
  }else data=JSON.parse(localStorage.getItem('hal_review_v4')||'null');
  if(data&&(![1,2].includes(data.version)||!W.latestReview([data.current])))throw Error();
  reviewBaseline=data?.version===2?data.current:W.latestReview([data?.current,...book.checkpoints]);
  reviewReadError=false;
 }catch(_){reviewReadError=true;}
}
function markReviewed(){
 if(reviewReadError)beginReview();
 if(reviewReadError)throw Error('Could not read the saved review. Reopen Today and retry.');
 const input=evidence();
 if(storageError||s.cached||s.failure||!W.canCaptureReview(input))throw Error('Refresh HAL spot and all open contracts before marking reviewed.');
 const current=I.checkpoint(input),payload=JSON.stringify({version:2,current});
 try{
  if(N?.cachePut){
   if(!JSON.parse(N.cachePut('snapshot:review',payload)).ok)throw Error();
  }else localStorage.setItem('hal_review_v4',payload);
 }catch(_){throw Error('Review could not be saved. Retry Mark reviewed.');}
 reviewBaseline=current;render();toast('Marked reviewed at '+when(current.savedAt));
}
const market=()=>D.market(s),ledger=()=>E.ledger(book,market()),risk=()=>{const r=E.risk(book,market());if(book.legs.length&&!isBookConfirmed()&&!r.warnings.some(w=>w.code==='unconfirmed'))r.warnings.push({code:'unconfirmed',title:'Confirm your book',detail:'Check these positions against your broker records.'});return r;},news=()=>I.newsGroups(D.news(s));
function technical(frame='D'){const p=D.rawCandles(s,frame),t=E.technicals(p.raw,frame,Date.now(),p.retrievedAt);if(p.error){t.stale=true;t.bias='Refresh failed';}return t;}
function evidence(){return {book,valuation:ledger(),risk:risk(),market:market(),technical:technical(),fundamentals:I.providerFundamentals(D.packet(s,'fundamentals','D',ui.statement)),news:news(),scenarios:ui.result&&!Array.isArray(ui.result)?[ui.result]:[],funding:book.funding};}
const checkpoint=()=>I.checkpoint(evidence()),changes=()=>I.changes(reviewBaseline,checkpoint(),news());
function request(section,frame='D',force=false){if(!configured&&section!=='filings')return;const k=D.key(section,frame,ui.statement),h=s.health[k]||{},ttl=section==='fundamentals'?21600000:['candles','patterns','news','filings'].includes(section)?900000:60000;if(h.pending||!force&&h.lastSuccess&&Date.now()-Date.parse(h.lastSuccess)<ttl)return;if(h.lastAttempt&&Date.now()-Date.parse(h.lastAttempt)<10000)return;s.health[k]={...h,pending:stamp(),lastAttempt:stamp()};native('research',JSON.stringify({section,frame,type:ui.statement,...(section==='contracts'?{legs:book.legs.map(l=>({type:l.type,expiry:l.expiry,strike:l.strike,lotSize:l.lotSize,...(l.instrumentKey?{instrument_key:l.instrumentKey}:{})}))}:{})}));}
function refresh(force=true){if(s.loading)return;if(!configured){native('settings');return;}native('refresh',ui.expiry||'');request('status','D',force);request('context','D',force);if(book.legs.length)request('contracts','D',force);for(const d of [...new Set(book.legs.filter(l=>l.type==='PE'&&E.expiryTime(l.expiry)>Date.now()).map(l=>l.expiry))])request('hedges',d,force);}
const navigationTrail=[];
function navigate(screen,sub,back=false){
 const current=[ui.screen,ui[ui.screen==='ai'?'aiPage':ui.screen]||''];
 if(!back&&(current[0]!==screen||current[1]!==sub)){navigationTrail.push(current);if(navigationTrail.length>32)navigationTrail.shift();}

  if(screen==='today'){screen='position';sub='overview';}
  if(screen==='plan'){screen='position';sub=sub||'stress';}
  if(screen==='research'&&['markets','indicators','insights'].includes(sub)){screen='technicals';}
  if(screen==='research'&&sub==='ai'){screen='ai';sub='assistant';}
  if(screen==='technicals'&&sub==='chain'){ui.side='PE';ui.fullChain=false;const first=(s.snapshot?.available_expiries||[]).filter(d=>d>=E.istDate()).sort()[0];if(first)ui.expiry=first;}
  if(screen==='technicals'&&sub==='markets')ui.frame='D';
  if(screen==='research'&&sub==='events'){request('news');request('fundamentals');}
  if(screen==='position'&&sub==='hedge'){ui.testRoll=null;ui.testPrice=null;const held=book.legs.find(l=>l.id===ui.hedgeHeld)||book.legs.find(l=>l.type==='PE');const end=ui.rollTarget||book.legs.filter(l=>l.type==='FUT'&&held&&l.expiry>held.expiry).map(l=>l.expiry).sort()[0];if(end)request('hedges',end);}
  if(screen==='position'&&sub==='overview')request('filings');
  if(screen==='position'&&['brief','analysis'].includes(sub)){request('candles','D');request('news');request('filings');request('fundamentals');request('context');}
  if(screen==='position'&&['snapshot','brief'].includes(sub)){request('candles','D');request('context');request('filings');if(sub==='snapshot'){request('contracts');if(ui.expiry)request('hedges',ui.expiry);}}
  ui.reviewOpen=false;
  ui.screen=screen;
  if(sub)ui[screen==='ai'?'aiPage':screen]=sub;
  if(screen==='position'&&ui.position==='agenda')request('filings');
  if(screen==='position'&&ui.position==='risk')request('candles','D');
  if(screen==='technicals'){if(['lab','chain'].includes(ui.technicals)&&ui.expiry)request('hedges',ui.expiry);else request('candles',ui.technicals==='backtest'?'D':ui.frame);}
  if(screen==='research'){
    if(!['news','events','calendar'].includes(ui.research))request('fundamentals');
    if(['events','calendar','orders','deliveries'].includes(ui.research))request('filings');
    if(ui.research==='news'){request('news');request('filings');}
  }
  render();window.scrollTo(0,0);
}
const intro=(t,n)=>`<div class="page-intro"><div class="eyebrow">Hindustan Aeronautics · NSE</div><h1>${esc(t)}</h1><p>${esc(n)}</p></div>`,reviews=items=>items.map(w=>`<article class="review-item"><strong>${esc(w.title)}</strong><p>${esc(w.detail)}</p></article>`).join('');
function clocks(q){const z=E.quoteQuality(q);return row('Provider quote',when(q?.quoteAt))+row('Last exchange trade',when(q?.tradeAt))+row('HTTP retrieved',when(q?.retrievedAt))+row('Last successful refresh',when(s.lastSuccess))+row('Last failed refresh',when(s.lastFailure))+`<p class="fine">${esc([...z.reasons,...z.warnings].join(' · ')||'A recent HTTP retrieval does not establish a recent exchange trade.')}</p>`;}

function changeView(){
 const input=evidence(),current=I.checkpoint(input),c=I.changes(reviewBaseline,current,news());
 const ready=!storageError&&!s.cached&&!s.failure&&W.canCaptureReview(input);
 const controls='<div class="toolbar">'+btn('mark-reviewed','Mark reviewed',ready?'class="primary"':'disabled')+'</div>';
 const hint=reviewReadError?'The saved review could not be read. Retry when fresh marks are available.':
  ready?'Mark reviewed to compare future observations with these prices.':
  !book.legs.length?'Record your open positions to begin a position review.':'Fresh HAL spot and a current REST mark for every open leg are required to mark reviewed.';
 const blocked=input.valuation.rows.filter(r=>r.mark?.source==='Manual'||r.mark?.status!=='current'||
  !E.quoteQuality(r.mark?.quote,{requireFresh:true,requireTrade:true}).valid);
 const needsPrices=blocked.length?'<details><summary>Contracts needing fresh prices ('+blocked.length+')</summary>'+
  blocked.map(({leg,mark})=>row(leg.type==='PE'?num(leg.strike,0)+' PE · '+date(leg.expiry):'Future · '+date(leg.expiry),
   mark?.source==='Manual'?'Manual mark':(mark?.warnings||[]).join(' · ')||'Fresh provider quote and trade time required')).join('')+
  btn('go-book','Inspect contract marks','class="text-button"')+'</details>':'';
 const footer='<p class="fine">'+esc(hint)+'</p>'+needsPrices+controls;
 if(!c.ready)return footer;
 const attribution=A5.compare(reviewBaseline,current);
 return `<p class="fine">Compared with ${esc(when(c.from))}</p><div class="metrics">${tile('HAL spot difference',money(c.spot))}${tile('Open P&L change',money(c.open),attribution.available?'Reconciled exact REST marks':c.sameBook?'Indicative · attribution unavailable':'Position changed')}</div><p class="fine">${esc(c.reason)}</p>`+
  (attribution.available?'<details><summary>Per-leg P&amp;L change from verified market marks</summary>'+
   table(['Contract','Earlier mark','Latest mark','Change'],attribution.items.map(r=>[
    r.type+' '+date(r.expiry)+(r.type==='PE'?' '+num(r.strike,0)+' PE':'')+' · '+num(r.units,0)+' units',
    money(r.from),money(r.to),money(r.pnl)]))+
   row('Reconciled change in open P&L',money(attribution.total))+
   '<p class="fine">'+esc(attribution.scope)+' Quote timestamps are checked for each open contract. This comparison excludes transaction fees and cannot explain why a price moved.</p></details>':
   '<p class="fine">Per-leg change withheld: '+esc(attribution.reason)+' Older review checkpoints remain readable but need a second complete observation for a reliable contract-level comparison.</p>')+footer;
}
function articleCards(list,limit=30){return list.slice(0,limit).map(n=>`<article class="news-item"><div class="news-meta"><span>${esc(n.source||'Unknown source')}${n.official?' · Official filing':''}</span><span>${esc(when(n.publishedAt))}</span></div><h3>${esc(n.title)}</h3>${n.summary?'<p>'+esc(n.summary)+'</p>':''}${n.duplicates?.length?'<details><summary>Related coverage ('+n.duplicates.length+')</summary>'+n.duplicates.map(d=>btn('link',d.title,'data-url="'+esc(d.url)+'"')).join('')+'</details>':''}${ui.sentiments[n.url]?badge('FinBERT '+ui.sentiments[n.url].label+' '+pct(ui.sentiments[n.url].confidence*100)):''}<div class="toolbar">${n.url?(n.official?btn('filing-evidence','Disclosure details',`data-url="${esc(n.url)}"`):'')+btn('link','Read source',`data-url="${esc(n.url)}" class="text-button"`)+(n.official&&!n.eventDate?btn('agenda-file','Add event date',`data-url="${esc(n.url)}" class="text-button"`):'')+btn('story-detail','Story briefing',`data-url="${esc(n.url)}"`)+btn('explain-news',n.official?'What changed?':'Explain',`data-url="${esc(n.url)}" class="text-button"`):badge('Link unavailable')}</div></article>`).join('')||empty('No verified news loaded','Refresh when connected. Absence from a feed does not prove that no event occurred.');}

function strategySummary(m,compact=false){
 const x=W.strategy(book,m),r=x.risk,l=x.valuation;
 return `<p class="strategy-sentence">${esc(x.explanation)}</p>`+
 `<div class="metrics">${tile('Protection entry cost',money(l.openPutPremium),'Premium paid for open puts')}${tile('Next put expiry',date(x.nextPutExpiry),x.afterProtection?num(x.afterProtection.uncoveredUnits,0)+' futures units uncovered after expiry':'No active put protection')}</div>`+
 (compact?'':`<div class="protection-list">${x.puts.map(p=>`<div class="owned-put"><div><b>₹${num(p.strike,0)} put</b><small>Until ${date(p.expiry)}</small></div><span>${num(p.units,0)} units</span></div>`).join('')}</div>`)+
 `<p class="fine">${esc(x.caveat)}</p>`;
}
function v5BrokerPreviewModal(){
 if(!book.legs.length)throw Error('Record an actual HAL contract before reviewing a completed broker close.');
 const list=book.legs;
 const fields='<p class="fine">PREVIEW ONLY. Use the actual executed close or settlement from a broker contract note. A zero put expiry price is allowed only if the broker reports that outcome; never infer settlement from a HAL spot quote. Nothing is recorded.</p>'+
 select('rc-leg','Open recorded contract',list.map(l=>[l.id,(l.type==='FUT'?'HAL Future':l.strike+' PE')+' · '+date(l.expiry)+' · '+l.lots+' lots']),list[0].id)+
 '<div class="form-grid">'+input('rc-lots','Lots actually closed',list[0].lots)+
 input('rc-price','Broker-reported close or settlement price (₹)','')+
 input('rc-fees','Transaction charges (₹)',0)+
 input('rc-date','Completed trade/settlement date',E.istDate(),'date')+
 input('rc-source','Broker statement or contract-note reference','','text')+'</div>'+
 '<label><input type="checkbox" id="rc-confirm">I have independently verified the actual completed transaction and charges against my broker records.</label>'+
 '<p class="fine">This does NOT write a journal entry. After reviewing, use Book → Record completed close to record the transaction separately and verify its outcome.</p>';
 modal('Preview a broker-confirmed close',fields,'Calculate read-only preview',()=>{
  const d={legId:text('rc-leg'),lots:value('rc-lots'),exitPrice:value('rc-price'),
   fees:value('rc-fees'),closeDate:text('rc-date'),source:text('rc-source'),
   confirmed:$('rc-confirm').checked};
  ui.closePreview=C5.preview(book,d,Date.now());
  render();
 });
 $('rc-leg').onchange=()=>{
  const chosen=list.find(l=>l.id===text('rc-leg'));
  if(chosen)$('rc-lots').value=chosen.lots;
 };
}
function v5BrokerPreviewResult(){
 const p=ui.closePreview;
 if(!p)return '';
 return '<div data-calculation-output><h3>Read-only broker close preview · NOT recorded</h3>'+
  row('Contract and completed date',esc(p.kind)+' · '+date(p.expiry)+' · '+date(p.closeDate))+
  row('Closed quantity',num(p.lots,0)+' lots / '+num(p.units,0)+' underlying units')+
  row('Remaining open quantity',num(p.remainingLots,0)+' lots')+
  row('Recorded gross P&L change if entered',money(p.recordedGrossChange))+
  row('Incremental recorded charges',money(p.recordedChargeChange))+
  row('Booked net P&L change if entered',money(p.recordedNetChange))+
  row('Previous booked net',money(p.priorBookedNet))+
  row('Hypothetical booked net after recording',money(p.previewBookedNet))+
  '<p class="fine">'+esc(p.warnings.join(' · '))+'</p>'+
  btn('go-book','Go to Book to record separately','class="text-button"')+'</div>';
}
const reminderCategory='Personal reminder';
function agendaView(){
 const todayDate=E.istDate(),days=new Map();
 const add=(day,html)=>{if(!days.has(day))days.set(day,[]);days.get(day).push(html);};
 const item=(kind,title,actions)=>'<article class="agenda-item"><small>'+esc(kind)+'</small><strong>'+esc(title)+'</strong><div class="toolbar">'+actions+'</div></article>';
 const expiries=[...new Set(book.legs.map(l=>l.expiry))];
 for(const expiry of expiries){
  const legs=book.legs.filter(l=>l.expiry===expiry);
  add(expiry,item(expiry<todayDate?'Past expiry · reconcile':'Contract expiry',legs.length+' open contract'+(legs.length===1?'':'s'),
   btn('agenda-expiry','Inspect legs',`data-id="${esc(expiry)}" class="text-button"`)));
 }
 for(const n of book.notes){
  if(!E.validDate(n.eventDate))continue;
  const reminder=n.category===reminderCategory;
  if(!reminder&&n.eventDate<todayDate)continue;
  const id='data-id="'+esc(n.id)+'" class="text-button"';
  const buttons=reminder?btn('agenda-reminder','Edit',id)+btn('agenda-done','Mark done',id):
   btn('note-edit','View note',id)+(n.url?btn('link','Open source','data-url="'+esc(n.url)+'" class="text-button"'):'');
  add(n.eventDate,item(reminder?(n.eventDate<todayDate?'Overdue personal reminder':'Personal reminder'):'Company event · user-entered',n.title,buttons));
 }
 const seen=new Set();
 for(const n of I.normalizeNews(D.news(s))){
  if(!n.official||!n.url||!n.eventDate||n.eventDate<todayDate)continue;
  const key=n.eventDate+'|'+n.url;if(seen.has(key))continue;seen.add(key);
  add(n.eventDate,item('Official disclosure · '+n.source,n.title,btn('link','Read disclosure','data-url="'+esc(n.url)+'" class="text-button"')));
 }
 const dates=[...days.keys()].sort();
 return card('HAL Agenda','<div class="toolbar">'+btn('agenda-reminder','Add reminder','class="primary"')+btn('note','Add company note')+'</div>'+
  (dates.length?dates.map(day=>'<section class="agenda-day"><h3>'+esc(date(day))+(day===todayDate?' · Today':'')+'</h3>'+days.get(day).join('')+'</section>').join(''):
  empty('No dated items','Add a reminder or give a company note an event date. Open positions appear here by expiry.')));
}
function agendaExpiry(day){
 const legs=book.legs.filter(l=>l.expiry===day);
 if(!legs.length)throw Error('This expiry has no open contracts.');
 modal('Expiry · '+date(day),legs.map(l=>row(l.type==='PE'?num(l.strike,0)+' PE':'HAL future',l.lots+' × '+l.lotSize+' = '+num(E.units(l),0)+' units')).join(''));
}
function agendaReminder(id){
 const existing=id?book.notes.find(n=>n.category===reminderCategory&&n.id===id):null;
 if(id&&!existing)throw Error('This reminder is no longer in the agenda.');
 modal(existing?'Edit personal reminder':'Add personal reminder',
  input('agenda-title','Reminder',existing?.title||'','text')+input('agenda-date','Due date',existing?.eventDate||E.istDate(),'date'),
  'Save reminder',()=>{
   const title=text('agenda-title').trim(),day=text('agenda-date');
   if(!title||title.length>180||!E.validDate(day))throw Error('Enter a reminder of up to 180 characters and a valid due date.');
   const b=clone(book),next={id:existing?.id||'rem-'+Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-'),
    category:reminderCategory,title,text:'',eventDate:day,date:E.istDate(),url:''};
   if(existing)b.notes=b.notes.map(n=>n.id===existing.id&&n.category===reminderCategory?next:n);else b.notes.push(next);
   commit(b);
  });
}
function finishReminder(id){
 const note=book.notes.find(n=>n.id===id&&n.category===reminderCategory);if(!note)return;
 modal('Complete reminder?',row('Remove from agenda',note.title),'Mark done',()=>{
  const b=clone(book);b.notes=b.notes.filter(n=>!(n.id===id&&n.category===reminderCategory));commit(b);
 });
}
function v5ExpiryPanel(large=false){
 if(!book.legs.length)return '';
 const x=X5.agenda(book,E.istDate()),items=large?x.alerts:x.alerts.slice(0,4);
 return card('Expiry & settlement review',
  row('Next recorded expiry',date(x.nextExpiry))+
  row('Active futures / put units',num(x.futureUnits,0)+' / '+num(x.putUnits,0))+
  row('Futures units without put quantity',num(x.uncovered,0))+
  (items.length?reviews(items.map(a=>({title:(a.severity==='critical'?'Urgent review · ':'')+a.title,detail:a.detail}))):
   '<p class="fine">No outstanding dated alerts in the saved position book.</p>')+
  (!large&&x.alerts.length>items.length?'<p class="fine">'+num(x.alerts.length-items.length,0)+' more alerts on the Risk screen.</p>':'')+
  '<div class="toolbar">'+btn('go-risk','Review expiry risks','class="text-button"')+
  (x.futureUnits?btn('go-hedge','Compare put protection','class="text-button"'):'')+
  btn('v5-broker-preview','Preview completed broker close','class="text-button"')+'</div>'+
  v5BrokerPreviewResult()+
  '<p class="fine">Calendar-date review, not confirmed NSE sessions or broker cutoff times. Broker settlement and physical delivery requirements must be checked separately. No trades are placed.</p>');
}
function protectionSummary(r){return (r.futureUnits?card('Current put protection',
  row('Covered futures units',num(r.coveredUnits,0)+' of '+num(r.futureUnits,0))+
  r.distribution.map(p=>row(money(p.strike)+' put · through '+date(p.expiry),num(p.units,0)+' units')).join('')+
  r.timeline.filter(t=>t.uncoveredUnits>0).map(t=>row('After '+date(t.date),num(t.uncoveredUnits,0)+' futures units uncovered')).join('')+
  '<p class="fine">Coverage counts units. Each strike sets a different level of downside protection.</p>'):'');}
function markLabel(mark){
 return mark.status==='current'?'':mark.source==='Manual'?'Manual mark':mark.status==='stale'?'Stale mark':'Mark unavailable';
}
function qualityDetails(l){
 const issues=l.rows.filter(x=>markLabel(x.mark));
 return issues.length?'<details class="mark-note"><summary>'+esc([...new Set(issues.map(x=>markLabel(x.mark)))].join(' · '))+'</summary>'+issues.map(x=>row(x.leg.type+' · '+date(x.leg.expiry),markLabel(x.mark)+' · '+when(x.mark.quoteAt))).join('')+'</details>':'';
}
const chartPrefs={months:1,average:false,bands:false};
function pulseChart(){
 const bars=researchBars().filter(b=>b.c>0&&E.expiryTime(E.istDate(b.t))<=Date.now());
 if(!bars.length)return empty('Completed daily closes unavailable');
 const end=new Date(bars.at(-1).t),start=new Date(end);start.setUTCMonth(start.getUTCMonth()-chartPrefs.months);
 const first=bars.findIndex(b=>b.t>=start.getTime()),visible=bars.slice(first);
 const series=[{values:visible.map(b=>b.c),color:'var(--accent)'}];
 function overlay(period,mult,color){
  series.push({color,values:visible.map((b,i)=>{const k=first+i;if(k<period-1)return null;
   const w=bars.slice(k-period+1,k+1),avg=w.reduce((sum,x)=>sum+x.c,0)/period;
   return avg+mult*Math.sqrt(w.reduce((sum,x)=>sum+(x.c-avg)**2,0)/period);})});
 }
 if(chartPrefs.average){overlay(20,0,'#d89928');overlay(50,0,'#a882ed');}
 if(chartPrefs.bands){overlay(20,2,'#8193a2');overlay(20,-2,'#8193a2');}
 const vals=series.flatMap(l=>l.values.filter(E.finite)),lo=Math.min(...vals),hi=Math.max(...vals);
 const svg=series.map(l=>'<path fill="none" stroke="'+l.color+'" stroke-width="2" d="'+l.values.map((v,i)=>E.finite(v)?((i&&E.finite(l.values[i-1]))?'L':'M')+(4+292*i/Math.max(1,visible.length-1))+','+(91-84*(v-lo)/(hi-lo||1)):'').join(' ')+'"/>').join('');
 return '<div class="toolbar">'+[1,3,12].map(n=>'<button data-month="'+n+'" aria-pressed="'+(n===chartPrefs.months)+'">'+(n===12?'1Y':n+'M')+'</button>').join('')+'</div><details><summary>Indicators</summary>'+['average','bands'].map((k,i)=>'<label><input type="checkbox" data-overlay="'+k+'" '+(chartPrefs[k]?'checked':'')+'> '+['SMA 20 / 50','Bollinger bands (20, 2)'][i]+'</label>').join('')+'</details><div class="pulse-plot"><svg role="img" aria-label="HAL completed daily closes" viewBox="0 0 300 100">'+svg+'</svg></div>'+row(date(E.istDate(visible[0].t))+' – '+date(E.istDate(end.getTime())),money(visible.at(-1).c))+row('Plotted range',money(lo)+' – '+money(hi));
}
document.addEventListener('click',e=>{if(!e.target.dataset.month)return;chartPrefs.months=Number(e.target.dataset.month);$('pulse-chart').innerHTML=pulseChart();});
document.addEventListener('change',e=>{const key=e.target.dataset.overlay;if(!['average','bands'].includes(key))return;chartPrefs[key]=e.target.checked;$('pulse-chart').innerHTML=pulseChart();$('pulse-chart').querySelector('details').open=true;});
const reviewMath=window.AtlasPulseReview;
let closingLog=[];
try{const raw=JSON.parse(localStorage.getItem('atlas.closingHoldings.v1')||'[]');if(Array.isArray(raw)&&raw.every((r,i)=>E.finite(r.at)&&r.at<=Date.now()&&(!i||raw[i-1].at<=r.at)&&Array.isArray(r.legs)&&r.legs.every(l=>E.validateLeg(l))))closingLog=raw;}catch(_){}
function rememberHoldings(legs,expected){
 const next=reviewMath.observe(closingLog,legs,Date.now(),expected);
 if(next===closingLog)return;
 closingLog=next;
 try{localStorage.setItem('atlas.closingHoldings.v1',JSON.stringify(next));}catch(_){/* In-memory history remains usable this session. */}
}
function sinceClose(m,l,numberOnly=false){
 const q=m.spot,trade=q.tradeAt&&E.istDate(Date.parse(q.tradeAt)),sessions=researchSessions(),prev=sessions.filter(x=>trade&&x[0]<trade).at(-1);
 const aligned=prev&&E.quoteQuality(q).valid&&q.previousClose>0&&Math.abs(q.previousClose-prev[4])<.011;
 const marksAligned=l.complete&&l.rows.every(x=>x.mark.source!=='Manual'&&x.mark.tradeAt&&E.istDate(Date.parse(x.mark.tradeAt))===trade);
 const result=aligned?reviewMath.compare(closingLog,E.expiryTime(prev[0]),marksAligned?l.open:null,leg=>{
  const match=E.matchContract(leg,m);if(match.error)return null;
  const quote=m.quotes[match.contract.instrumentKey];
  return quote?.tradeAt&&E.istDate(Date.parse(quote.tradeAt))===trade&&E.quoteQuality(quote).valid?quote.previousClose:null;
 }):{delta:null,activity:[],baseline:false};
 if(numberOnly){
  if(!E.finite(result.delta))return null;
  const sessionJournal=book.journal.filter(j=>j.date>prev[0]&&j.date<=trade);
  return result.delta+sessionJournal.reduce((net,j)=>j.kind==='close'?net+(j.exit-j.leg.entry)*E.units(j.leg)-(j.fees||0):j.kind==='fee'?net-j.amount:net,0);
 }
 return card('Since last close',row('Reference session',aligned?date(prev[0]):'Unavailable')+row('HAL price move',money(aligned?q.price-q.previousClose:null))+row('Change in open P&L',money(result.delta))+
 (result.activity.length?row('Book activity',result.activity.join(' · ')):'')+
 (!result.baseline?'<p class="fine">A recorded book at the reference close is required.</p>':!E.finite(result.delta)?'<p class="fine">Comparable contract marks are unavailable.</p>':''));
}
function portfolioHeader(m,l){
 const q=m.spot,a=P5.audit(book,l);
 return '<div class="bp-ticker"><div><b>HAL · NSE</b> '+money(q.price)+' '+pct(sessionMove(q))+'<small>'+esc(q.source||'Price unavailable')+' · '+when(q.quoteAt)+'</small></div><svg aria-hidden="true" viewBox="0 0 100 48"><path d="M4 26 L34 21 49 4 55 4 49 20 75 18 88 9 93 9 87 22 96 25 85 28 49 28 59 43 53 44 34 29 4 27Z"/></svg></div>'+
 '<section class="bp-hero"><h1>Open P&L</h1><strong class="hero-price '+color(a.open)+'">'+money(a.open)+'</strong>'+ (l.manual?badge('Includes manual price'):'')+qualityDetails(l)+
 '<div class="bp-pair">'+row('Latest session P&L',money(sinceClose(m,l,true)))+row('Lifetime net P&L',money(a.net))+'</div></section>'+
 '<nav class="bp-segments" aria-label="Portfolio views">'+[['overview','Overview'],['plot','Chart'],['book','Position Book']].map(([key,label])=>'<button data-route="position" data-sub="'+key+'" aria-current="'+(ui.position===key?'page':'false')+'">'+label+'</button>').join('')+'</nav>';
}
function today(m,l,r){
 const active=book.legs.filter(x=>E.expiryTime(x.expiry)>Date.now());
 const puts=active.filter(x=>x.type==='PE'),futures=active.filter(x=>x.type==='FUT');
 const nearest=puts.map(x=>x.expiry).sort()[0];
 const sum=legs=>legs.reduce((n,x)=>n+E.units(x),0);
 const f=sum(futures),covered=Math.min(f,sum(puts));
 const remaining=nearest?sum(futures.filter(x=>x.expiry>nearest)):0;
 const lost=Math.min(remaining,sum(puts))-Math.min(remaining,sum(puts.filter(x=>x.expiry>nearest)));
 return card('Put protection',row('Units covered',covered+' of '+f)+'<progress max="'+(f||1)+'" value="'+covered+'"></progress>'+
 row('Next put expiry',nearest?date(nearest)+' · '+Math.round((Date.parse(nearest)-Date.parse(E.istDate()))/86400000)+' days':'No active puts')+
 row('Futures expiry',[...new Set(futures.map(x=>x.expiry))].sort().map(date).join(' · ')||'No active futures')+
 (nearest?row('Units losing coverage at next expiry',String(lost)):'')+routeButton('position','risk','Coverage details')+routeButton('position','hedge','Compare hedges'))+
 routeButton('position','stress','Downside scenarios');
}
let observations=[];
try{const list=JSON.parse(localStorage.getItem('atlas.portfolio.observations.v1')||'[]');if(Array.isArray(list))observations=list;}catch(_){}
function captureObservation(){
 if(storageError||s.cached||s.failure||!book.legs.length)return;
 const m=market(),q=m.spot,l=ledger(),at=Date.parse(q.quoteAt);
 if(!E.quoteQuality(q).fresh||!Number.isFinite(at)||!l.complete||l.manual||l.stale||
    !l.rows.every(r=>Math.abs(Date.parse(r.mark.quoteAt)-at)<=60000))return;
 const previous=observations.at(-1),fingerprint=I.materialFingerprint(book);
 if(previous&&Date.parse(previous.savedAt)>=at)return;
 if(previous&&previous.bookRevision===fingerprint&&at-Date.parse(previous.savedAt)<60000)return;
 observations=[...observations,{version:4,savedAt:q.quoteAt,quoteAsOf:q.quoteAt,bookRevision:fingerprint,spot:q.price,open:l.open,complete:true}].slice(-3000);
 try{localStorage.setItem('atlas.portfolio.observations.v1',JSON.stringify(observations));}catch(_){}
}
function portfolioPlot(){
 const combined=[...observations,...book.checkpoints,reviewBaseline].filter(x=>x?.version===4&&Number.isFinite(Date.parse(x.savedAt))&&Date.parse(x.savedAt)<=Date.now());
 const points=[...new Map(combined.map(x=>[Date.parse(x.savedAt),x])).values()].sort((a,b)=>Date.parse(a.savedAt)-Date.parse(b.savedAt));
 if(!points.length)return card('Portfolio chart',empty('No saved observations yet','Observations start when fresh prices are available for the whole book.'));
 const first=Date.parse(points[0].savedAt),span=Date.parse(points.at(-1).savedAt)-first||1;
 function panel(title,read,height){
  const values=points.map(read).filter(E.finite),low=Math.min(...values),high=Math.max(...values);
  const dots=points.map((p,i)=>{const value=read(p);if(!E.finite(value))return '';
   const x=8+284*(Date.parse(p.savedAt)-first)/span,y=height-8-(height-16)*(high===low?.5:(value-low)/(high-low));
   return '<circle cx="'+x+'" cy="'+y+'" r="3"><title>'+esc(when(p.savedAt)+' · '+money(value))+'</title></circle>';}).join('');
  return '<h3>'+title+'</h3>'+(dots?'<svg class="bp-plot" style="touch-action:pan-y" viewBox="0 0 300 '+height+'" aria-label="'+title+'">'+dots+'<line class="bp-cross" stroke="currentColor" x1="292" x2="292" y1="0" y2="100%"/></svg>':empty('Reliable marks unavailable'));
 }
 const readOpen=p=>p.complete&&!p.marksStale&&!p.marksManual?p.open:null;
 const readSpot=p=>p.quoteAsOf&&E.istDate(Date.parse(p.quoteAsOf))===E.istDate(Date.parse(p.savedAt))?p.spot:null;
 const labels=points.map(p=>when(p.savedAt)+' · Open '+money(readOpen(p))+' · HAL '+money(readSpot(p)));
 return card('Portfolio observations',panel('Open P&L',readOpen,96)+panel('HAL spot',readSpot,54)+
 '<label>Observation <input id="bp-cursor" type="range" min="0" max="'+(points.length-1)+'" value="'+(points.length-1)+'"></label><output id="bp-reading">'+esc(labels.at(-1))+'</output>'+
 '<p class="fine">Drag either chart to inspect both values. Each point uses the book held at the time. Missing observations are left blank.</p>')+
 '<template id="bp-labels">'+esc(JSON.stringify({labels,times:points.map(p=>Date.parse(p.savedAt))}))+'</template>';
}
function inspectObservation(evt){
 const plot=evt.target.closest?.('.bp-plot'),slider=$('bp-cursor');if(!slider||(!plot&&evt.target!==slider))return;
 const {labels,times}=JSON.parse($('bp-labels').content.textContent),start=times[0],duration=times.at(-1)-start;
 if(plot){const box=plot.getBoundingClientRect(),t=start+duration*Math.max(0,Math.min(1,((evt.clientX-box.left)/box.width*300-8)/284));slider.value=times.reduce((best,v,i)=>Math.abs(v-t)<Math.abs(times[best]-t)?i:best,0);}
 const i=Number(slider.value),x=8+284*(times[i]-start)/(duration||1);
 document.querySelectorAll('.bp-cross').forEach(l=>{l.setAttribute('x1',x);l.setAttribute('x2',x);});$('bp-reading').textContent=labels[i];
}
document.addEventListener('pointerdown',inspectObservation);
document.addEventListener('pointermove',e=>{if(e.buttons)inspectObservation(e);});
document.addEventListener('input',inspectObservation);
function marketSnapshot(m){
 const futures=m.contracts.filter(c=>c.type==='FUT'&&c.expiry>=E.istDate()).sort((a,b)=>a.expiry.localeCompare(b.expiry));
 const expiries=[...new Set([...(s.snapshot?.available_expiries||[]),...m.contracts.filter(c=>c.type==='PE').map(c=>c.expiry)])].filter(d=>E.validDate(d)&&d>=E.istDate()).sort();
 const expiry=expiries.includes(ui.expiry)?ui.expiry:expiries[0];
 const puts=m.contracts.filter(c=>c.type==='PE'&&c.expiry===expiry).sort((a,b)=>a.strike-b.strike);
 const rows=puts.map(c=>{const q=m.quotes[c.instrumentKey]||{},spread=q.ask>=q.bid&&q.bid>0?q.ask-q.bid:null;
 return '<tr><td>'+btn('market-put',money(c.strike),'data-id="'+esc(c.instrumentKey)+'"')+'</td>'+[q.bid,q.ask,spread].map(v=>'<td>'+esc(money(v))+'</td>').join('')+'</tr>';}).join('');
 const summaries=(futures.length?table(['Future expiry','Price','Basis'],futures.map(c=>{const q=m.quotes[c.instrumentKey];return [date(c.expiry),money(q?.price),money(q?.price>0&&m.spot.price>0?q.price-m.spot.price:null)];})):empty('No futures quotes loaded'))+
 (expiry?select('blueprint-expiry','Put expiry',expiries.map(d=>[d,date(d)]),expiry):'')+
 (rows?'<div class="table-wrap"><table><thead><tr><th>Put strike</th><th>Bid</th><th>Ask</th><th>Spread</th></tr></thead><tbody>'+rows+'</tbody></table></div>':empty('No put quotes loaded'));

 return card('HAL price','<div id="pulse-chart">'+pulseChart()+'</div>'+routeButton('technicals','markets','Open detailed chart'))+
 '<div class="bp-pair">'+card('NIFTY 50',money(m.nifty?.price))+card('India VIX',num(m.vix?.price))+'</div>'+
 card('Futures and puts',summaries+routeButton('position','carry','Futures and basis')+routeButton('technicals','chain','Put quotes'));
}
function historyNotes(book){return book.notes.filter(n=>n.category==='Journal'||n.category==='Margin snapshot');}
function historyCount(book){return book.journal.length+historyNotes(book).length;}
function accountHistory(){
 const kind=ui.historyFilter||'all';
 const categories=[['all','All entries'],['close','Closed trades'],['fee','Charges'],['funding','Funding'],['notes','Notes']];
 const matches=j=>kind==='all'||kind==='notes'&&j.note||kind==='funding'&&['funding','settlement'].includes(j.kind)||kind===j.kind;
 const entries=book.journal.filter(matches).map(j=>({date:j.date,html:'<details class="contract-row"><summary>'+esc(date(j.date)+' · '+(j.kind==='close'?(j.leg.type==='FUT'?'Future':num(j.leg.strike,0)+' put')+' close':j.kind))+'</summary>'+row('Amount',money(j.kind==='close'?(j.exit-j.leg.entry)*E.units(j.leg):j.amount))+esc(j.note||'')+btn('journal-edit','Edit trade','data-id="'+esc(j.id)+'"')+'</details>'}));
 for(const n of historyNotes(book).filter(n=>kind==='all'||kind==='notes'&&n.category==='Journal'||kind==='funding'&&n.category==='Margin snapshot'))entries.push({date:n.date,html:row(date(n.date)+' · '+n.category,n.text)});
 entries.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
 const label=categories.find(x=>x[0]===kind)[1];
 return select('history-kind','Show',categories,kind)+btn('history-export','Export '+label.toLowerCase())+
 '<details><summary>Add entry</summary>'+btn('funding','Margin snapshot')+btn('cash','Charges or funding')+btn('trade-note','Journal note')+'</details>'+
 entries.map(e=>e.html).join('')+
 '<details><summary>Broker statements and lifetime history</summary>'+historyView.view()+'</details>';
}
function positionsHome(l){
 const a=P5.audit(book,l);
 function group(type,title){
  const rows=l.rows.filter(x=>x.leg.type===type);
  return card(title,rows.map(x=>{const leg=x.leg,id='data-id="'+esc(leg.id)+'"';
   return '<details class="contract-row"><summary><strong>'+esc(type==='FUT'?'HAL futures':money(leg.strike)+' put')+'</strong> · '+date(leg.expiry)+'<small>'+x.units+' shares · '+money(x.pnl)+' '+esc(markLabel(x.mark))+'</small></summary>'+row('Entry price',money(leg.entry))+row('Latest mark',money(x.mark.price))+row(x.mark.source,when(x.mark.quoteAt))+btn('edit','Edit leg',id)+btn('close','Record close',id)+btn('record-roll','Record rollover',id)+(type==='PE'?btn('pick-hedge','Compare replacements',id):'')+'</details>';}).join('')||empty('No '+title.toLowerCase()));
 }
 return routeButton('position','performance','P&L breakdown')+'<div class="hub-links">'+routeButton('history','','History')+btn('add','Add position')+'</div>'+group('FUT','Futures')+group('PE','Protective puts')+'<details><summary>Book details</summary>'+btn('verify','Verify contracts')+btn('confirm','Confirm book')+btn('context-ai','Ask AI')+'</details>';
}

function marketBrief(m){
 const t=technical('D'),last=t.rows.at(-1);
 return card('Market context',row('NIFTY 50',money(m.nifty?.price))+row('India VIX',num(m.vix?.price))+
   row('Daily RSI 14',num(t.rsi))+row('50-session SMA',money(t.sma50))+row('200-session SMA',money(t.sma200))+
   row('20-session support',money(t.support))+row('20-session resistance',money(t.resistance))+
   (last?row('Latest completed session',date(E.istDate(last.t)))+row('Volume',num(last.v,0)):'')+
   '<details><summary>Data details</summary>'+clocks(m.spot)+row('Candle history retrieved',when(t.fetchedAt))+'</details>');
}
function contractHelp(leg,m){const candidates=m.contracts.filter(c=>c.type===leg.type&&(leg.type!=='PE'||c.strike===leg.strike));return '<p class="fine">Saved expiry '+esc(date(leg.expiry))+' · '+esc(leg.lotSize)+' units per lot. '+(candidates.length?'Provider lists '+candidates.slice(0,8).map(c=>esc(date(c.expiry))+' (lot '+esc(E.finite(c.lotSize)?c.lotSize:'unavailable')+')').join(', ')+'.':'No same-strike contract metadata is currently available.')+' Use Verify contracts, then review Edit / manual mark → Fill from listed contract against your broker record. Entries and expiry dates are never changed automatically.</p>';}
function carryDesk(m){
 const active=book.legs.filter(l=>l.type==='FUT'&&E.expiryTime(l.expiry)>Date.now());
 const held=active.find(l=>l.id===ui.carryLeg)||active[0],match=held&&E.matchContract(held,m);
 const current=m.quotes[match?.contract?.instrumentKey],valid=q=>E.quoteQuality(q,{requireFresh:true,requireTrade:true}).fresh;
 const rows=m.contracts.filter(c=>c.type==='FUT'&&E.expiryTime(c.expiry)>Date.now()).sort((a,b)=>a.expiry.localeCompare(b.expiry)).map(c=>{
  const q=m.quotes[c.instrumentKey],gap=valid(current)&&valid(q)?q.price-current.price:null;
  return '<details class="contract-row"><summary>'+esc(date(c.expiry)+' · '+money(q?.price)+' · Gap '+money(gap)+'/share')+'</summary>'+
   row('Difference from HAL spot',money(valid(q)&&valid(m.spot)?q.price-m.spot.price:null))+
   (held?row('Spread for '+held.lots+' lots',money(E.finite(gap)?gap*E.units(held):null)):'')+'</details>';
 });
 return card('Listed futures',(active.length>1?select('carry-leg','Compare with',active.map(l=>[l.id,date(l.expiry)]),held.id):'')+(rows.join('')||empty('Refresh futures quotes'))+(held?btn('v5-rollover','Compare rollover fills','data-id="'+esc(held.id)+'"'):''))+v5RollResult();
}
function v5RollModal(button){
 const m=market();
 const current=book.legs.filter(l=>l.type==='FUT'&&E.expiryTime(l.expiry)>Date.now());
 if(!current.length)throw Error('Record an unexpired HAL futures leg before planning a rollover.');
 const futures=m.contracts.filter(c=>c.type==='FUT'&&E.validDate(c.expiry)&&
  E.expiryTime(c.expiry)>Date.now()&&c.instrumentKey);
 if(!futures.some(c=>current.some(l=>c.expiry>l.expiry&&c.lotSize===l.lotSize)))
  throw Error('No eligible later listed futures contract loaded. Refresh Upstox futures and verify exact contracts.');
 const fields='<p class="fine">READ-ONLY. Uses the current contract best bid and a later listed contract best ask. Quotes are not executable guarantees. Futures notional and price spread are not spendable cash or a margin estimate.</p>'+
 select('ro-current','Saved open future',current.map(l=>[l.id,date(l.expiry)+' · '+l.lots+' lots / '+l.lotSize+' units']),current.find(l=>l.id===button?.dataset?.id)?.id||current[0].id)+
 select('ro-next','Listed later future',futures.map(c=>[c.instrumentKey,date(c.expiry)+' · '+c.lotSize+' units/lot']),futures.find(c=>c.expiry>current[0].expiry&&c.lotSize===current[0].lotSize)?.instrumentKey||'')+
 '<div class="form-grid">'+input('ro-exit','Additional estimated close charges (₹)',0)+
 input('ro-entry','Additional estimated new-entry charges (₹)',0)+
 input('ro-slip','Slippage per unit on each leg (₹)',0)+'</div>'+
 '<p class="fine">Earlier protective puts do not automatically roll. This only previews estimated economics: no orders, fills, cash transfer, or journal changes.</p>';
 modal('Inspect hypothetical HAL futures rollover',fields,'Calculate read-only comparison',()=>{
  const exitFees=value('ro-exit'),newFees=value('ro-entry'),slippagePerUnit=value('ro-slip');
  if([exitFees,newFees,slippagePerUnit].some(x=>x===null))throw Error('Specify all fees and slippage; enter zero explicitly when appropriate.');
  ui.rollPreview=R5.compare(book,market(),{legId:text('ro-current'),
   targetInstrumentKey:text('ro-next'),exitFees,newFees,slippagePerUnit},Date.now());
  render();
 });
}
function v5RollResult(){
 const r=ui.rollPreview;
 if(!r)return '';
 return '<div data-calculation-output><h3>Hypothetical futures rollover · no trade recorded</h3>'+
  row('Saved future / later listed expiry',date(r.current.expiry)+' / '+date(r.replacement.expiry))+
  row('Exact replacement quantity',num(r.lots,0)+' lots / '+num(r.units,0)+' underlying units')+
  row('Assumed sell at bid minus slippage',money(r.assumedClosePrice))+
  row('Assumed buy at ask plus slippage',money(r.assumedNewEntryPrice))+
  row('Gross close P&L if that sale were executed',money(r.conditionalCloseGross))+
  row('Conditional close P&L after exit fee',money(r.conditionalCloseNetBeforePriorFees))+
  row('Combined additional assumed fees',money(r.totalAdditionalFees))+
  row('Entry / exit futures price difference per unit',money(r.assumedExecutableSpreadPerUnit))+
  row('Spread per lot',money(r.assumedExecutableSpreadPerUnit*r.units/r.lots))+row('Spread across units (NOT roll cash debit)',money(r.rollSpreadAcrossUnits))+
  row('New futures notional (exposure, NOT cash)',money(r.newFuturesNotionalReference))+
  row('Put units recorded through later expiry',num(r.putUnitsHeldThroughNewExpiry,0))+
  row('Minimum unmatched newly dated futures units',num(r.minimumUncoveredNewUnits,0))+
  row('Actual margin / physical-settlement cash','Unknown · check broker')+
  (r.warnings.length?reviews(r.warnings.map(detail=>({title:'Conditional assumption',detail}))):'')+
  '<p class="fine">'+esc(r.assumptions.join(' · '))+'</p></div>';
}
function v5SettleModal(){
 if(!book.legs.length)throw Error('Record your actual book first.');
 if(book.legs.some(l=>l.expiry<E.istDate()))throw Error('Reconcile expired contracts before modelling multiple settlements.');
 const optDates=[...new Set(book.legs.filter(l=>l.type!=='FUT').map(l=>l.expiry))].sort();
 const futDates=[...new Set(book.legs.filter(l=>l.type==='FUT').map(l=>l.expiry))].sort();
 const fields='<p class="fine">Provide an independent hypothetical settlement for each expiry. Blank prices are unavailable, not zero. These values are not live quotes, projected broker fills or recorded transactions.</p>'+
 optDates.map(d=>input('v5-opt-'+d,'Underlying settlement on '+date(d)+' (₹)')).join('')+
 futDates.map(d=>input('v5-fut-'+d,'Futures settlement on '+date(d)+' (₹)')).join('')+
 input('v5-charges','Additional hypothetical costs not already recorded (₹)',0)+
 '<p class="fine">This models full-expiry outcomes, not the value of selling a hedge before expiry. Physical settlement and broker margin requirements are not calculated.</p>';
 modal('Model each expiry separately',fields,'Calculate hypothetical P&L',()=>{
  const opt={},fut={};
  for(const d of optDates)opt[d]=value('v5-opt-'+d);
  for(const d of futDates)fut[d]=value('v5-fut-'+d);
  const fees=value('v5-charges');
  if(fees===null||fees<0)throw Error('Enter valid non-negative additional costs.');
  ui.settlementResult=V5.settlementScenario(book.legs,{spotAtExpiry:opt,futureAtExpiry:fut,charges:fees});
  ui.settlementPath=Z5.path(book.legs,{spotAtExpiry:opt,futureAtExpiry:fut,charges:fees},E.istDate());
  ui.settlementAt=stamp();render();
 });
}
function v5RiskPanel(savedBook,valuation){
 const now=E.istDate(),timeline=V5.protectionTimeline(savedBook.legs,now);
 const relevant=timeline.filter(x=>x.futures>0);
 const gap=relevant.find(x=>x.afterExpiry&&x.uncovered>0);
 const expiryDetail=gap?'After '+date(gap.afterExpiry)+', '+num(gap.uncovered,0)+' futures units lack put quantity protection.':'No additional uncovered futures shown in the dated expiry ladder.';
 const settle=ui.settlementResult,path=ui.settlementPath;
 const lifetimeScenario=V5.lifetimeNet(settle,valuation.realized,valuation.charges);
 return card('Protection by date',
  '<p class="fine">Read-only expiry ladder · dates use IST. It does not change your recorded book.</p>'+
  (relevant.length?table(['From date','Futures units','Put units','Uncovered'],relevant.map(x=>[date(x.onDate),x.futures,x.puts,x.uncovered])):empty('No unexpired futures','Any expired contracts still require broker reconciliation.'))+
  (gap?'<p class="warning fine">'+esc(expiryDetail)+'</p>':'<p class="fine">'+esc(expiryDetail)+'</p>')+
  '<p class="fine">Quantity is not delta-equivalent protection or a guaranteed loss floor. Day-level expiry does not determine broker square-off, margin or physical settlement requirements.</p>'+btn('v5-settlement','Model separate expiries','class="text-button"')+
  (settle?'<div data-calculation-output><p class="fine">Hypothetical model · calculated '+esc(when(ui.settlementAt))+'</p>'+
   row('Open legs · hypothetical expiry P&L',money(settle.total))+
   row('Lifetime net under scenario',money(lifetimeScenario))+
   '<p class="fine">Lifetime result combines actual recorded closed gross P&L with hypothetical open-leg P&L, deducting recorded and entered additional charges once. Funding cash is excluded. Different expiries do not have one universal break-even price.</p>'+
   (path?'<details><summary>Expiry-by-expiry economic outcome (not a cash forecast)</summary>'+
     table(['Contract expiry','Put P&L','Futures P&L','Cumulative gross','Uncovered after'],path.events.map(e=>[
      date(e.expiry),money(e.grossPutPnl),money(e.grossFuturePnl),
      money(e.cumulativeGrossEconomicPnl),num(e.uncoveredFutureUnitsAfter,0)]))+
     (path.events.some(e=>e.expiringPutUnits>0)?
      table(['Put expiry','Intrinsic value (NOT guaranteed cash)','Premium paid at entry'],
       path.events.filter(e=>e.expiringPutUnits>0).map(e=>[
        date(e.expiry),money(e.putIntrinsicEconomicValue),money(e.putEntryPremiumPreviouslyPaid)])):'')+
     row('Gross modeled P&L (all expiries)',money(path.totalGrossEconomicPnl))+
     row('Additional hypothetical costs, deducted only once',money(path.assumedAdditionalCosts))+
     row('Net modeled P&L (all expiries)',money(path.totalNetEconomicPnl))+
     row('Broker cash / physical-delivery requirement','Not calculated · requires broker confirmation')+
     row('Futures daily variation-margin path','Unavailable · settlement history needed')+
     '<p class="fine">Earlier option exercise value and entry premiums are economic inputs, not spendable cash at expiry. They cannot be used as an inferred funding balance. No trade or ledger entry is recorded.</p>'+
     '<p class="fine">'+esc(path.assumptions.join(' · '))+'</p></details>':'')+
   (settle.complete?table(['Leg','Expiry','Settlement value','P&L'],settle.rows.map(r=>[r.type,date(r.expiry),money(r.settlement),money(r.pnl)])):
    reviews(settle.errors.map(detail=>({title:'Missing settlement input',detail}))))+
   '<p class="fine">'+esc(settle.assumptions.join(' · '))+'</p></div>':'')
  );
}
function v5PortfolioPanel(savedBook,valuation){
 const a=P5.audit(savedBook,valuation);
 if(!a.consistent)return card('Lifetime accounting audit',
  '<p class="warning">Recorded and calculated portfolio totals do not reconcile. Financial summaries are withheld in this audit panel.</p>'+
  reviews(a.errors.map(detail=>({title:'Accounting conflict',detail})))+
  '<p class="fine">Preserve the saved book and review completed trades, costs and contract marks against your broker before drawing conclusions.</p>');
 return card('Lifetime accounting',
  '<div class="metrics wide">'+
   tile('Open P&L',money(a.open),a.complete?'All open legs priced':'Incomplete · one or more marks unavailable')+
   tile('Realised gross',money(a.realizedGross))+
   tile('Recorded lifetime charges',money(a.recordedCharges))+
   tile('Lifetime net',money(a.net),a.complete?'Indicative, not broker-settled':'Withheld until all marks are valid')+
  '</div>'+
  btn('atlas-history','View completed trade history','class="text-button"')+row('Booked realised net after charges',money(a.bookedNet))+
  row('Open-trade P&L needed to offset booked loss',money(a.bookedRecoveryRequirement))+
  row('Indicative remaining lifetime shortfall',money(a.indicativeShortfall))+
  row('Open valuation quality',a.markQuality)+
  row('Completed journal closes',num(a.completedCloseRecords,0))+
  row('Imported historical records',num(a.historyRecordCount,0))+
  row('Closed lots recorded in journal',num(a.completedLots,0))+
  (a.chargesAsOf?row('Cumulative charge statement through',date(a.chargesAsOf)):'<p class="fine">No cumulative charge statement has been confirmed in the imported history.</p>')+
  (!a.complete?'<p class="warning fine">Some open contracts cannot be valued. Recovery estimates using a complete lifetime basket are unavailable until those marks or expired legs are reconciled.</p>':'')+
  (a.expiredUnreconciled.length?'<p class="warning fine">Expired contracts need broker-confirmed close/settlement: '+esc(a.expiredUnreconciled.join(', '))+'</p>':'')+
  '<details><summary>Realised P&L classification</summary>'+
   table(['Recorded type','Realised gross'],Object.entries(a.realizedByType).map(([k,v])=>[k,money(v)]))+
   row('Unallocated legacy realised gross',money(a.unallocatedLegacyGross))+
   '<p class="fine">The imported history may group transactions across several sources. These type subtotals do not reclassify unallocated legacy amounts.</p></details>'+
  '<details><summary>Accounting assumptions and cash separation</summary>'+
   row('Settlement cash movements (not P&L)',money(a.settlementCash))+
   row('Funding movements (not P&L)',money(a.fundingCash))+
   a.notes.map(x=>'<p class="fine">'+esc(x)+'</p>').join('')+'</details>');
}
function openFuturesSizing(){
 modal('Size a hypothetical HAL futures trade',
  '<div class="form-grid">'+input('sizing-budget','Risk budget for this trade (₹)')+
  input('sizing-distance','Entry-to-stop distance (₹ per unit)')+
  input('sizing-lot','Units per lot · check your broker')+'</div>'+
  '<p class="fine">Uses the distance from your proposed futures entry to your stop. Excludes fees, slippage, gaps and margin. A stop can fill beyond its trigger price.</p>'+
  btn('calculate-futures-sizing','Calculate whole lots','class="primary"')+
  '<div id="sizing-result" role="status" aria-live="polite"></div>');
}
function calculateFuturesSizing(){
 const output=$('sizing-result');
 try{
  const result=E.futuresSizing(text('sizing-budget'),text('sizing-distance'),text('sizing-lot'));
  output.innerHTML=row('Whole lots within budget',num(result.lots,0))+
   row('Futures units',num(result.units,0))+row('Estimated loss per lot at stop',money(result.lossPerLot))+
   row('Estimated loss at stop',money(result.estimatedLoss))+row('Unused risk budget',money(result.unusedBudget));
 }catch(error){output.textContent=error.message;}
}
function reviewTriggerCard(r){
 const daily=technical('D'),p=book.riskProfile;
 const alerts=E.marketReviewTriggers(p,daily,r.nextExpiry);
 return card('Review alerts',row('Daily RSI 14',daily.stale?'Needs fresh completed candles':num(daily.rsi))+
  row('RSI review levels',num(p.rsiBelow)+' / '+num(p.rsiAbove))+
  row('Held expiry reminder',p.expiryReviewDays==null?'Off':p.expiryReviewDays+' calendar days')+
  (alerts.length?reviews(alerts):'<p class="fine">No RSI or expiry review threshold is active.</p>')+
  '<p class="fine">Alerts are evaluated in the app using completed daily candles and your recorded expiries.</p>',
  btn('limits','Edit review thresholds','class="text-button"'));
}
function position(m,l,r){let body='';if(ui.position==='book')body=`<div class="toolbar">${btn('add','Add position','class="primary"')}${btn('verify','Verify contracts')}${btn('confirm','Confirm book')}</div><p class="fine">${isBookConfirmed()?'Confirmed '+when(book.riskProfile.confirmedAt):'Not confirmed against broker records.'} These controls record trades; they never place orders.</p>`+([...l.rows].sort((a,b)=>a.leg.expiry.localeCompare(b.leg.expiry)||a.leg.type.localeCompare(b.leg.type)||(a.leg.strike||0)-(b.leg.strike||0)).map(x=>card('HAL '+(x.leg.type==='FUT'?'Future':num(x.leg.strike,0)+' PE'),`<p class="contract-meta">${date(x.leg.expiry)} · ${x.leg.lots} lots × ${x.leg.lotSize} units</p>${row('Indicative P&L',money(x.pnl))}${row('Entry / mark',money(x.leg.entry)+' / '+money(x.mark.price))}${badge(x.mark.source,x.mark.status)}<p class="fine">${esc(x.mark.warnings.join(' · '))}</p>${!E.finite(x.mark.price)?contractHelp(x.leg,m):''}<details><summary>Exact contract & clocks</summary>${row('Instrument',x.leg.instrumentKey||x.mark.contract?.instrumentKey||'Unverified')}${row('Quote',when(x.mark.quoteAt))}${row('Trade',when(x.mark.tradeAt))}${row('Retrieved',when(x.mark.retrievedAt))}</details><div class="toolbar">${btn('edit','Edit / manual mark',`data-id="${esc(x.leg.id)}"`)}${x.leg.type==='PE'?btn('one-start','Replace one lot',`data-id="${esc(x.leg.id)}"`):''}${btn('close','Record completed close',`data-id="${esc(x.leg.id)}"`)}</div>`)).join('')||empty('Your book is empty','Add exact HAL futures and protective puts, then confirm with your broker.'));
if(ui.position==='performance')body=v5PortfolioPanel(book,l)+card('Leg performance',table(['Contract','Expiry','Units','Entry','Mark','P&L'],l.rows.map(x=>[x.leg.type==='FUT'?'Future':num(x.leg.strike)+' PE',date(x.leg.expiry),x.units,money(x.leg.entry),money(x.mark.price),money(x.pnl)])))+card('Premium & cash',row('Open put entry premium',money(l.openPutPremium))+row('Settlement cash',money(l.settlements))+row('Funding cash',money(l.fundingMovements))+'<p class="fine">Settlement and funding cash are separate from P&L and are never added twice.</p>')+card('Price & review observations',table(['Saved at','Spot','Open P&L','Coverage'],book.checkpoints.slice(-30).reverse().map(c=>[when(c.savedAt),money(c.spot),money(c.open),pct(c.coverage)])),btn('checkpoint','Save checkpoint','class="text-button"'));
if(ui.position==='risk'){const c=E.carryComparison(m);body=protectionSummary(r)+card('Futures position sizing','<p>Estimate how many whole lots fit a hypothetical risk budget.</p>',btn('open-futures-sizing','Open calculator','class="text-button"'))+reviewTriggerCard(r)+v5ExpiryPanel(true)+v5RiskPanel(book,l)+`<div class="metrics">${tile('Uncovered futures',num(r.uncoveredUnits,0)+' units')}${tile('Net delta',num(r.delta))}${tile('Net theta',num(r.theta),'Unavailable if convention is unverified')}${tile('Put quantity',num(r.putUnits,0))}</div>`+card('Position risks',reviews(r.warnings),btn('limits','Risk limits','class="text-button"'))+card('Protection timeline',table(['After expiry','Futures units','Put units','Uncovered'],r.timeline.map(t=>[date(t.date),t.futureUnits,t.putUnits,t.uncoveredUnits]))+'<p class="fine">Coverage at one time does not guarantee a downside floor through a later futures expiry.</p>')+card('Futures carry',table(['Near / far expiry','Spread','Annualised'],(Array.isArray(c)?c:c.rows||[]).map(x=>[date(x.nearExpiry||x.near?.expiry)+' / '+date(x.farExpiry||x.far?.expiry),money(x.spread),pct(x.annualized)]))+'<p class="fine">Observed spread, not a rollover plan or funding projection.</p>'+btn('v5-rollover','Inspect hypothetical futures rollover','class="text-button"')+v5RollResult());}
if(ui.position==='journal')body=card('Funding snapshot',row('Recorded margin',money(book.funding.margin))+row('Recorded available funds',money(book.funding.free))+row('Time',when(book.funding.at))+'<p class="fine">Manual snapshot; broker margin can change. No account-fund access.</p>',btn('funding','Update','class="text-button"'))+`<div class="toolbar">${btn('cash','Record fee / cash','class="primary"')}${btn('csv','Journal CSV')}${btn('export','JSON backup')}${btn('import','Import')}${btn('recovery','Previous book')}</div>`+card('Completed history',book.journal.slice().reverse().map(j=>`<article class="news-item"><strong>${esc(j.kind==='close'?'Completed '+j.leg.type+' close':j.kind)}</strong><small> · ${date(j.date)}</small>${j.kind==='close'?row(j.leg.lots+' × '+j.leg.lotSize+' · '+date(j.leg.expiry),money((j.exit-j.leg.entry)*E.units(j.leg)))+row('Exit / charges',money(j.exit)+' / '+money(j.fees)):row('Amount',money(j.amount))}<p class="fine">${esc(j.note)}</p>${btn('journal-edit','Correct record',`data-id="${esc(j.id)}" class="text-button"`)}</article>`).join('')||empty('No recorded closes'))+(book.legacy?card('Preserved legacy history',row('Realised',money(book.legacy.realized))+row('Costs',money(book.legacy.costs))+table(['Date','Kind','Amount','Note'],book.legacy.journal.map(j=>[j.date,j.kind,money(j.amount),j.note]))):'');
if(ui.position==='book'){
 const manual=l.rows.filter(x=>x.mark.source==='Manual').length;
 const broker=l.rows.filter(x=>E.finite(x.mark.price)&&x.mark.source!=='Manual');
 const older=broker.filter(x=>x.mark.status==='stale').length;
 body=card('Portfolio mark status',row('Broker marks',num(broker.length,0))+row('Older broker marks',num(older,0))+row('Manual marks',num(manual,0))+
  row('Marks unavailable',num(l.rows.length-manual-broker.length,0))+row('Indicative open P&L',money(l.rows.length&&l.complete?l.open:null)))+body;
}
if(ui.position==='book'&&book.legs.length)body=card('Your strategy together',strategySummary(m)+`<div class="toolbar">${btn('atlas-paper','Try in Paper','class="primary"')}${btn('go-compare','Compare an adjustment')}${btn('explain-position','Explain protection','class="text-button"')}</div>`)+body;
return body;}
function scenarioView(r){if(Array.isArray(r))return card('Sampled scenarios',table(['Shock','Spot','P&L','Quality'],r.map(x=>[pct(x.shock*100),money(x.spot),money(x.total),x.complete?x.kind:x.errors.join('; ')])));return card(r.complete?'Scenario results':'Scenario unavailable',`<div class="hero-value ${color(r.total)}">${money(r.total)}</div><p class="fine">${esc(r.kind)} · ${when(r.horizon)}</p>${r.complete?table(['Contract','Model price','Units','P&L','Valuation'],r.rows.map(x=>[x.leg.type==='FUT'?'Future':num(x.leg.strike)+' PE',money(x.modelPrice),x.units,money(x.pnl),x.kind])):reviews(r.errors.map(e=>({title:'Input needs review',detail:e})))}<details><summary>Assumptions</summary>${r.assumptions.map(a=>'<p class="fine">'+esc(a)+'</p>').join('')}</details>`);}

function advancedAssumptions(p){return `<details id="scenario-advanced" ${ui.advanced?'open':''}><summary>Advanced assumptions</summary><p class="fine">Interest is the annual rate used to model option prices. Dividend yield is the annual payout as a percentage of the share price. IV shift changes the assumed volatility by percentage points.</p><div class="form-grid">${input('sc-iv','Explicit IV assumption (%) · optional',p.iv)}${input('sc-shift','IV shift (percentage points)',p.shift)}${input('sc-rate','Interest rate (% annual)',p.rate)}${input('sc-dividend','Dividend yield (% annual)',p.dividend)}${select('sc-basis','Futures basis',[['constant','Observed constant basis'],['decay','Basis decays to expiry'],['carry','Theoretical cost of carry']],p.basis)}${input('sc-base','Manual base spot · optional',p.base)}</div></details>`;}
function scenarioInputs(m){const p=ui.scenario;return `<div class="form-grid">${input('sc-spot','HAL price to explore (₹)',E.value(p.spot)??m.spot.price)}${input('sc-horizon','On date · blank means now',p.horizon,'date')}</div>${advancedAssumptions(p)}<p class="fine">Uses observed futures basis and valid provider IV when available. Rate ${esc(p.rate)}%, dividend ${esc(p.dividend)}%, IV shift ${esc(p.shift)} points. Open Advanced assumptions to review or supply missing IV.</p>`;}
function v5MonteCarloPanel(){
 const r=ui.mcResult;
 return card('Monte Carlo risk',
  '<p>Illustrative distribution of additional P&L from current marks. Select a horizon above and enter assumptions; no historical volatility is inferred.</p>'+
  '<div class="form-grid">'+input('mc-vol','Assumed annual HAL share volatility (%)',ui.mcVol)+
  input('mc-drift','Assumed annual return (%) · 0 = neutral',ui.mcDrift)+'</div>'+
  btn('mc-run','Simulate 250 scenarios','class="primary"')+
  '<p class="fine">Requires a selected horizon before the first open-leg expiry, complete current leg marks and valid option-model assumptions. Results are not backtests or real-world probabilities.</p>')+
  (r?'<div data-calculation-output>'+card('Conditional model distribution',
  '<p class="fine">Calculated '+esc(when(ui.mcAt))+' · '+num(r.count,0)+' reproducible simulated prices · assumes '+num(r.assumptions.annualVolPct)+'% annual volatility.</p>'+
  '<div class="metrics">'+tile('5th percentile additional P&L',money(r.pnl.p05))+
  tile('Median additional P&L',money(r.pnl.median))+
  tile('Worst 5% mean',money(r.pnl.worstFivePctMean))+
  tile('Simulated losing outcomes',pct(100*r.pnl.fractionBelowZero))+'</div>'+
  '<p class="fine">'+esc(r.caveat)+' Current market marks may be older or manual; review quote timestamps before acting.</p>')+'</div>':'');
}
function stressPlanner(m){
 const expiry=book.legs.map(l=>l.expiry).sort()[0],horizon=ui.scenario.horizon||expiry;
 const chosen=ui.testRoll,price=E.value(ui.testPrice);
 if(chosen){
  const held=book.legs.find(l=>l.id===chosen.id&&l.type==='PE');
  if(!held||book.legs.some(l=>E.expiryTime(l.expiry)<=Date.now()))return empty('Review expired or changed holdings')+btn('end-roll','Current position');
  const comparison=H5.compareBasket(book,m,held.id,chosen.target,chosen.strike,false,E.hedgePreferences(book.hedge),Date.now(),price>0?[price]:[],{oneLot:true,horizon,details:true});
  const prices=[0,-3,-5,-10].map(x=>({label:x+'%',price:m.spot.price*(1+x/100)}));if(price>0)prices.push({label:money(price),price});
  return card('Keep current / Switch',row('Replacement',money(chosen.strike)+' put · '+date(chosen.target))+input('stress-date','Scenario date',horizon,'date')+
   prices.map(p=>{
    const r=comparison.scenarios.find(x=>Math.abs(x.price-p.price)<.001);
    const title=esc(p.label+' · Keep '+money(r?.keep)+' · Switch '+money(r?.roll));
    if(!r?.breakdown?.length)return '<p>'+title+'</p>';
    return '<details class="contract-row"><summary>'+title+'</summary>'+table(['Contract','Keep current','Switch'],r.breakdown.map(x=>[x.type==='fees'?'Switching charges':(x.type==='FUT'?'HAL future':money(x.strike)+' put')+' · '+date(x.expiry),money(x.keep),money(x.roll)]))+'</details>';
   }).join('')+
   '<p class="fine">Estimated change from current marks, including switching costs.</p><details><summary>Test a price</summary>'+input('roll-price','HAL price (₹)',price)+'</details>'+btn('save-stress-roll','Save comparison')+btn('end-roll','Current position'));
 }
 const current=E.ledger(book,m),calculate=price=>E.scenario(book.legs,m,{...scenarioParams(),spot:price,horizon});
 const cases=[0,-3,-5,-10].map(shock=>({label:shock+'%',price:m.spot.price>0?m.spot.price*(1+shock/100):null}));
 if(price>0)cases.push({label:'Custom price',price});
 const outcomes=cases.map(({label,price})=>{
 if(!price||!horizon)return row(label,'Unavailable');
 const v=calculate(price);return '<details class="contract-row"><summary>'+esc(label+' · '+money(price)+' · '+(v.complete&&current.complete?money(v.total-current.open):'Unavailable'))+'</summary>'+
 (v.complete?table(['Contract','Change from current mark'],v.rows.map(x=>{const base=current.rows.find(r=>r.leg.id===x.leg.id)?.pnl;return [x.leg.type==='FUT'?'Future':num(x.leg.strike,0)+' put',money(E.finite(base)?x.pnl-base:null)]})):esc(v.errors.join(' · ')))+'</details>';}).join('');
 return card('Estimated change from current marks',input('stress-date','Scenario date',horizon,'date')+outcomes)+
 '<details><summary>Test a price</summary>'+input('roll-price','HAL price (₹)',price)+'</details>'+advancedAssumptions(ui.scenario);
}
function comparisonPlanner(m){
 const futures=book.legs.filter(l=>l.type==='FUT'),chosen=futures.find(l=>l.id===ui.compare.leg)||futures[0],c=ui.reduction;
 return card('Keep my position or reduce exposure?',`<p>Compare the change from current marks at the same HAL price and date. Existing puts remain held.</p>${scenarioInputs(m)}<div class="form-grid">${select('compare-leg','Future to reduce',futures.map(l=>[l.id,date(l.expiry)+' · '+l.lots+' lots']),chosen?.id)}${input('compare-lots','Lots to reduce',ui.compare.lots)}${input('compare-costs','Exit charges + slippage (₹)',ui.compare.costs)}</div>${btn('compare-reduction','Compare outcomes','class="primary"')}<p class="fine">The exit reference is the current mark. Add your estimated execution costs; a zero estimate excludes them.</p>`)+
 (c?'<div data-calculation-output>'+card('Additional P&L from now',`<div class="comparison-results">${tile('Keep current position',money(c.current.additional),num(c.current.futureUnits,0)+' futures units')}${tile('Reduce by '+num(c.removedUnits,0)+' units',money(c.alternative.additional),num(c.alternative.futureUnits,0)+' futures units · '+num(c.alternative.putUnits,0)+' put units retained')}</div>${c.complete?row('Difference with reduction',money(c.difference)):reviews([...new Set([...c.current.errors,...c.alternative.errors])].map(detail=>({title:'Comparison needs an input',detail})))}<p class="fine">Horizon ${when(c.current.horizon)} · ${c.current.manual||c.alternative.manual?'Manual marks included. ':''}${c.current.stale||c.alternative.stale?'Older marks included. ':''}Estimated exit costs ${money(c.exitCosts)}.</p><details><summary>How to read this comparison</summary>${c.assumptions.map(a=>'<p class="fine">'+esc(a)+'</p>').join('')}</details>` )+'</div>':'')+
 card('Compare a different protective put',`<p>Use listed contracts to compare your current hedge with replacement protection, including premium, sale proceeds and liquidity.</p>${btn('go-hedge','Find replacement protection →','class="text-button"')}`);
}
const oneLot={owned:'',expiry:'',candidate:'',iv:'',savedSettings:null};
const rollArchiveKey='research:atlas_rolls_v1';
const rollSelection={first:'',second:''};
let displayedRoll=null;
function readRolls(){
 let data;
 if(N?.cacheGet){
  const r=JSON.parse(N.cacheGet(rollArchiveKey));
  if(!r.ok)throw Error('Saved comparisons could not be read.');
  data=r.data;
 }else data=JSON.parse(localStorage.getItem(rollArchiveKey)||'null');
 if(data===null)return [];
 if(data?.version!==1||!Array.isArray(data.records)||data.records.some(r=>
  !r||typeof r.id!=='string'||typeof r.name!=='string'||!r.owned||!r.candidate||!r.settings||!r.spot||
  !r.result?.sell||!r.result?.buy||!E.finite(r.result.netCash)||!Array.isArray(r.result.coverage)||!Array.isArray(r.result.scenarios)))
  throw Error('Saved comparison data needs review. The existing records have been preserved.');
 return data.records;
}
function writeRolls(records){
 const data=JSON.stringify({version:1,records});
 if(N?.cachePut){
  if(!JSON.parse(N.cachePut(rollArchiveKey,data)).ok)throw Error('Could not save comparisons on this device.');
 }else localStorage.setItem(rollArchiveKey,data);
}
function saveRoll(){
 if(!displayedRoll)throw Error('Choose a priced rollover first.');
 const copy=clone(displayedRoll);
 modal('Save hedge comparison',input('roll-name','Comparison name',num(copy.candidate.strike,0)+' PE · '+date(copy.candidate.expiry),'text')+
  '<label>Review note<textarea id="roll-note" maxlength="500"></textarea></label>'+
  row('Quote comparison captured',when(copy.at)),'Save comparison',()=>{
   const name=text('roll-name').trim();
   if(!name||name.length>80)throw Error('Enter a name of 1–80 characters.');
   const records=readRolls();
   const id=Array.from(crypto.getRandomValues(new Uint32Array(4))).join('-');
   records.push({...copy,id,name,note:text('roll-note').trim().slice(0,500)});
   writeRolls(records);rollSelection.second=rollSelection.first;rollSelection.first=id;
   navigate('position','saved-rolls');
  });
}
function savedRollsView(){
 try{
  const records=readRolls().reverse();
  if(!records.length)return card('Saved hedge comparisons',empty('No saved comparisons','Open Replace one lot and save a priced comparison.'));
  const first=records.find(r=>r.id===rollSelection.first)||records[0];
  const second=records.find(r=>r.id===rollSelection.second&&r.id!==first.id);
  const selected=second?[first,second]:[first];
  const opts=records.map(r=>[r.id,r.name+' · '+when(r.at)]);
  const metric=(label,fn)=>[label,...selected.map(fn)];
  const results=[
   metric('Owned put',r=>num(r.owned.strike,0)+' PE · '+date(r.owned.expiry)),
   metric('Replacement put',r=>num(r.candidate.strike,0)+' PE · '+date(r.candidate.expiry)),
   metric('Units rolled',r=>r.result.units),metric('Sale proceeds',r=>money(r.result.sale)),
   metric('Purchase cost',r=>money(r.result.purchase)),metric('Charges',r=>money(r.result.fees)),
   metric('Net cash (+ pay / − receive)',r=>money(r.result.netCash)),
   metric('HAL spot used',r=>money(r.spot.price)),metric('Spot quote time',r=>when(r.spot.quoteAt)),
   metric('Owned bid / quote time',r=>money(r.result.sell.bid)+' · '+when(r.result.sell.quoteAt)),
   metric('Replacement ask / quote time',r=>money(r.result.buy.ask)+' · '+when(r.result.buy.quoteAt)),
   metric('IV before shift',r=>r.settings.fallbackIV==null?(pct(r.result.buy.iv)+' provider'):pct(r.settings.fallbackIV)+' assumed'),
   metric('Slippage per side',r=>pct(r.settings.slippage)),metric('Interest / dividend',r=>pct(r.settings.rate)+' / '+pct(r.settings.dividend)),
   metric('IV shift (points)',r=>num(r.settings.ivShift)),metric('Review note',r=>r.note||'—')
  ];
  const headers=['',...selected.map(r=>r.name)];
  const shocks=first.result.scenarios.map(s=>metric(pct(s.shock*100),r=>{
   const v=r.result.scenarios.find(item=>item.shock===s.shock);
   return v?.error||money(v?.difference);
  }));
  return card('Saved hedge comparisons',select('roll-first','First saved version',opts,first.id)+
   select('roll-second','Compare with',[['','Choose another version'],...opts.filter(([id])=>id!==first.id)],second?.id||'')+
   '<p class="fine">Each column uses its saved quotes, assumptions and owned-put expiry. Reopen Replace one lot to price a new version.</p>'+
   table(headers,results))+card('Roll advantage at owned-put expiry',table(headers,[metric('Scenario date',r=>date(r.owned.expiry)),...shocks]))+
   selected.map(r=>card(r.name+' · protection after expiry',table(['After expiry','Futures','Covered if kept','Covered if rolled'],r.result.coverage.map(c=>[date(c.expiry),c.futures,c.keep,c.rolled])))).join('')+
   btn('record-plan','Record rollover',`data-id="${esc(first.id)}"`)+btn('roll-reprice','Reprice first version',`data-id="${esc(first.id)}"`)+
   btn('roll-delete','Delete first saved version',`data-id="${esc(first.id)}"`);
 }catch(e){return card('Saved hedge comparisons',empty('Unavailable',e.message));}
}
function repriceRoll(id){
 const saved=readRolls().find(r=>r.id===id);
 if(!saved)return;
 const leg=book.legs.find(l=>l.type==='PE'&&l.id===saved.owned.id&&l.expiry===saved.owned.expiry&&
  l.strike===saved.owned.strike&&l.lotSize===saved.result.units&&(!saved.owned.instrumentKey||l.instrumentKey===saved.owned.instrumentKey));
 if(!leg)throw Error('The original owned put is no longer in this book with the same contract and lot size.');
 Object.assign(oneLot,{baseline:saved,owned:leg.id,expiry:saved.candidate.expiry,candidate:saved.candidate.instrumentKey,iv:'',savedSettings:saved.settings});
 navigate('position','one-lot');
 request('hedges',oneLot.expiry,true);request('contracts','D',true);
}
function deleteRoll(id){
 const r=readRolls().find(r=>r.id===id);
 if(!r)return;
 modal('Delete saved comparison?',row('Saved version',r.name),'Delete comparison',()=>{
  writeRolls(readRolls().filter(item=>item.id!==id));render();
 });
}
function oneLotView(m){
 displayedRoll=null;
 const puts=book.legs.filter(l=>l.type==='PE');
 const label=l=>num(l.strike,0)+' PE · '+date(l.expiry)+' · '+l.lots+' × '+l.lotSize;
 const owned=puts.find(l=>l.id===oneLot.owned);
 const dates=owned?[...new Set([...(s.snapshot?.available_expiries||[]),...m.contracts.filter(c=>c.type==='PE').map(c=>c.expiry)])].filter(d=>E.validDate(d)&&d>owned.expiry).sort():[];
 const listed=m.contracts.filter(c=>c.type==='PE'&&dates.includes(oneLot.expiry)&&c.expiry===oneLot.expiry).sort((a,b)=>a.strike-b.strike);
 const candidate=listed.find(c=>c.instrumentKey===oneLot.candidate);
 const settings=E.hedgePreferences(oneLot.savedSettings||book.hedge);
 let form=select('one-owned','Owned put to replace',[['','Choose an owned put'],...puts.map(l=>[l.id,label(l)])],owned?.id);
 if(owned)form+=select('one-expiry','Later listed expiry',[['','Choose expiry'],...dates.map(d=>[d,date(d)])],oneLot.expiry);
 if(owned&&dates.includes(oneLot.expiry))form+=select('one-candidate','Replacement strike',[['','Choose put'],...listed.map(c=>[c.instrumentKey,num(c.strike,0)+' PE · '+c.lotSize+' units/lot'])],candidate?.instrumentKey);
 let output='';
 if(owned&&!dates.length)output=empty('No later expiry loaded','Refresh market data to discover listed expiries.');
 else if(owned&&oneLot.expiry&&!listed.length)output=empty('No contracts loaded for this expiry','Fetch the selected option chain using your read-only connection.');
 if(owned&&candidate){
  try{
   if(oneLot.iv!==''){settings.fallbackIV=Number(oneLot.iv);if(!Number.isFinite(settings.fallbackIV))throw Error('Enter a numeric IV assumption.');}
   const result=H5.compareOneLot(book,m,owned.id,candidate.instrumentKey,settings);
   displayedRoll={at:stamp(),owned:{id:owned.id,strike:owned.strike,expiry:owned.expiry,instrumentKey:owned.instrumentKey},candidate,settings,spot:m.spot,result};
   output=(oneLot.baseline?.candidate.instrumentKey===candidate.instrumentKey&&oneLot.baseline?.owned.id===owned.id?card('Saved and refreshed estimates',row('Saved · '+when(oneLot.baseline.at),money(oneLot.baseline.result.netCash))+row('Updated net cash',money(result.netCash))):'')+card('Estimated cash for one lot',
    row('Sell '+label({...owned,lots:1})+' · bid '+money(result.sell.bid),money(result.sale))+
    row('Buy '+num(candidate.strike,0)+' PE · '+date(candidate.expiry)+' · ask '+money(result.buy.ask),money(result.purchase))+
    row('Buy and exit charges',money(result.fees))+row(result.netCash<0?'Estimated credit':'Estimated net cash required',money(Math.abs(result.netCash)))+
    row('Owned put quote',when(result.sell.quoteAt))+row('Replacement quote',when(result.buy.quoteAt))+btn('roll-save','Save comparison','class="primary"')+btn('record-displayed','Record rollover'))+
    card('Protection after each expiry',table(['After expiry','Futures units','Covered if kept','Covered if rolled'],result.coverage.map(r=>[date(r.expiry),r.futures,r.keep,r.rolled]))+
    '<p class="fine">Quantity coverage assumes all other legs stay in the book through expiry. Strike levels determine the payoff.</p>')+
    card('Roll versus keep at '+date(owned.expiry),table(['HAL shock','Roll advantage (₹)'],result.scenarios.map(r=>[pct(r.shock*100),r.error||money(r.difference)]))+
    '<p class="fine">Difference for the selected lot only. The old put settles at intrinsic value. The later put uses model value. Cash paid for the switch is deducted once. All common legs cancel in this comparison.</p>');
  }catch(e){output=empty('Comparison unavailable',e.message);}
 }
 return card('Replace one lot',puts.length?
  '<p>Compare selling one lot of an owned put and buying one lot with a later expiry.</p><div class="form-grid">'+form+'</div>'+
  (dates.includes(oneLot.expiry)?btn('one-fetch','Fetch expiry quotes'):'')+
  (oneLot.savedSettings?'<p class="fine">Using the saved version’s cost and model assumptions.</p>':'')+
  (candidate?input('one-iv','Scenario IV assumption (%) · optional',oneLot.iv)+
  row('IV when field is blank',settings.fallbackIV==null?'Timestamped provider IV':pct(settings.fallbackIV)+' saved assumption')+
  row('Slippage per side',pct(settings.slippage))+row('Buy / exit fees',money(settings.buyFees)+' / '+money(settings.exitFees))+
  row('Interest / dividend / IV shift',pct(settings.rate)+' / '+pct(settings.dividend)+' / '+num(settings.ivShift)+' points'):''):
  empty('No owned puts','Record your HAL futures and protective puts in Portfolio.'))+output;
}
function plan(m){let body;const p=ui.scenario,h=ui.hedgeDraft||book.hedge;
if(ui.plan==='one-lot')body=oneLotView(m);
else if(ui.plan==='saved-rolls')body=savedRollsView();
else if(ui.plan==='stress')body=stressPlanner(m);
else if(ui.plan==='compare')body=comparisonPlanner(m);
else if(ui.plan==='hedge')body=card('Find a protective put',`<p class="fine">Compare actual listed HAL puts as replacements for existing puts. Whole lots must exactly cover current futures units. A comparison never changes your saved positions.</p><div class="form-grid">${input('hg-through','Protect through which date?',h.protectThrough,'date')}${input('hg-budget','Additional hedge budget (₹)',h.budget)}${input('hg-loss','Loss limit in the tested scenarios (₹)',h.maxLoss)}</div><details id="hedge-advanced" ${ui.hedgeAdvanced?'open':''}><summary>Advanced assumptions</summary><p class="fine">Interest is the annual rate used to model option prices. Dividend yield is the annual payout as a percentage of the share price. IV shift changes the assumed volatility by percentage points.</p><p class="fine">Slippage is the estimated difference between the quoted price and your fill. Spread is the gap between the best bid and ask.</p><div class="form-grid">${input('hg-spread','Maximum bid/ask spread (%)',h.maxSpread)}${input('hg-buy','Buy charges (₹)',h.buyFees)}${input('hg-exit','Exit charges (₹)',h.exitFees)}${input('hg-slip','Slippage each side (%)',h.slippage)}${input('hg-iv','IV shift (percentage points)',h.ivShift)}${input('hg-iv-assumption','Explicit IV assumption (%) · optional',h.fallbackIV)}${input('hg-rate','Interest (% annual)',h.rate)}${input('hg-dividend','Dividend (% annual)',h.dividend)}${input('hg-volume','Minimum volume (units)',h.minVolume??1)}${input('hg-oi','Minimum OI (units)',h.minOI??1)}</div></details><div class="toolbar">${btn('hedge-fetch','Save & fetch puts','class="primary"')}${btn('hedge-rank','Compare available quotes')}</div><p class="fine">Fresh quote/trade clocks, contract specifications and liquidity are always required. Missing provider Greek timestamps require an explicitly entered IV assumption for model-only comparisons; no Greeks are invented. No qualifying contract is a valid result.</p>`)+(ui.hedges?`<p class="fine">Compared ${esc(when(ui.hedgesAt))}. Refresh or edit assumptions to recalculate.</p><div class="columns">${[['lowerCost','Lower Cost'],['balanced','Balanced'],['strongerProtection','Stronger Protection']].map(([k,title])=>{const c=ui.hedges.rankings[k];return card(title,c?`<h3>₹${num(c.contract.strike,0)} PE · ${date(c.contract.expiry)}</h3>${row('Gross purchase',money(c.grossCost))}${row('Sampled worst loss',money(c.worstLoss))}${row('Net cash required',money(c.netCashRequired))}${row('Model IV source',c.ivSource==='user-assumed'?'User-assumed '+num(c.ivAssumption)+'% · not verified Greeks':'Timestamp-verified provider IV')}${c.expiryGap?'<p class="warning fine">Protection ends before the last futures expiry.</p>':''}${btn('hedge-detail','Inspect comparison',`data-id="${esc(c.contract.instrumentKey)}" class="text-button"`)}`:empty('No qualifying candidate'));}).join('')}</div>${card('Eligibility & ranking',reviews(ui.hedges.errors.map(e=>({title:'No forced recommendation',detail:e})))+`<details><summary>Excluded contracts (${ui.hedges.excluded.length})</summary>${table(['Strike','Expiry','Reason'],ui.hedges.excluded.map(c=>[c.contract.strike,date(c.contract.expiry),c.reasons.join('; ')]))}</details><details><summary>Ranking method</summary>${ui.hedges.assumptions.map(x=>'<p class="fine">'+esc(x)+'</p>').join('')}</details>`)}`:empty('No comparison requested','Sampled worst loss is not a guaranteed maximum loss.'));

return body;
}
function businessBoard(){
 const b=W.businessReview(book.notes.filter(n=>n.category!==reminderCategory),news());
 const note=n=>`<article class="business-note"><div class="news-meta"><span>User-entered evidence</span><span>${date(n.date)}</span></div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><div class="toolbar">${n.url?btn('link','Source',`data-url="${esc(n.url)}" class="text-button"`):badge('Source link needed')}${btn('note-edit','Edit note',`data-id="${esc(n.id)}" class="text-button"`)}</div></article>`;
 return card('HAL business review',`<p>Track the evidence behind your thesis. Headlines and your notes are grouped by topic; these groups do not establish a business trend.</p>${btn('note','Add sourced evidence','class="primary"')}`)+
 card('Upcoming events',b.events.length?b.events.map(n=>`<div class="event-row"><span>${date(n.eventDate)}</span><div><strong>${esc(n.title)}</strong><small>User-entered event</small></div>${btn('note-edit','Review',`data-id="${esc(n.id)}" class="text-button"`)}</div>`).join(''):empty('No upcoming events recorded','Add a source and event date when a results release or delivery milestone is confirmed.'))+
 `<div class="business-grid">${b.drivers.map(d=>card(d.title,`<p class="driver-question">${esc(d.question)}</p>${d.notes.map(note).join('')}${d.articles.length?articleCards(d.articles,2):''}${!d.notes.length&&!d.articles.length?empty('Evidence to collect','Save a filing or add a sourced note for this business driver.'):''}`)).join('')}</div>`;
}
function facts(v,path='',out=[]){if(out.length>=120)return out;if(Array.isArray(v))v.slice(0,30).forEach((x,i)=>facts(x,path+' ['+(i+1)+']',out));else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))facts(x,path?path+' / '+k:k,out);else if(v!=null)out.push([path,String(v)]);return out;}
function v5BacktestPanel(){
 const p=ui.btParams,r=ui.btReport,g=ui.btRegime,src=ui.btSource;
 return card('Historical strategy research',
 '<p>Long-only SMA crossover on completed HAL cash-equity daily candles. Signals from a daily close are filled at the next completed daily bar open. This is PAPER research, not a HAL futures/options strategy or live entry signal.</p>'+
 '<div class="form-grid">'+input('bt-fast','Fast SMA (2–199)',p.fast)+
 input('bt-slow','Slow SMA (3–200)',p.slow)+
 input('bt-fee','Estimated cost per trade side (bps)',p.fee)+
 input('bt-slip','Estimated slippage per side (bps)',p.slip)+'</div>'+
 '<div class="toolbar">'+btn('bt-load','Refresh daily candles')+btn('bt-run','Run historical backtest','class="primary"')+'</div>'+
 '<p class="fine">Requires at least slow+3 validated completed daily bars (maximum 2,000 used). Sources are cached or retrieved via your read-only provider. No API call submits an order or modifies your book.</p>')+
 (r?'<div data-calculation-output>'+card('Simulated 1-share results',
 '<p class="fine">Recomputed '+esc(when(ui.btAt))+' · '+num(r.sample.bars,0)+' completed daily bars · '+esc(when(new Date(r.sample.from).toISOString()))+' to '+esc(when(new Date(r.sample.to).toISOString()))+'</p>'+
 table(['Same-period return','Strategy','Hold HAL'],[['After costs',pct(r.metrics.netPctOfReferencePrice),pct(r.benchmark.returnPct)]])+'<details><summary>Details</summary>'+table(['Risk and trading','Strategy','Hold HAL'],[['Max drawdown / starting price',pct(r.metrics.maxDrawdownPctOfReferencePrice),pct(r.benchmark.drawdownPct)],['Entries',num(r.events.filter(e=>e.side==='BUY').length,0),'1']])+'<div class="metrics">'+tile('Model net P&L/share',money(r.metrics.netPerShare))+
 tile('Closed paper trades',num(r.metrics.closedTrades,0))+
 tile('Max drawdown/share',money(r.metrics.maxDrawdownPerShare))+
 tile('Closed-trade win rate',r.metrics.winRate==null?'Unavailable':pct(r.metrics.winRate*100))+'</div>'+
 row('Recorded model costs/share',money(r.metrics.modeledFeesPerShare))+
 row('Unrealised paper P&L/share',money(r.metrics.unrealizedPerShare))+
 row('Daily observation source',src?.retrievedAt?'NSE history and loaded provider candles':'Saved NSE Bhavcopy research history')+
 row('Last bar ended',when(src?.lastBar))+
 (g?.ready?row('Historical regime',g.trend+' · '+g.volatilityRegime)+
 row('20-session realised volatility',pct(g.volatility20AnnualPct)):
 row('Historical regime',g?.reason||'Unavailable'))+
 table(['Entry (next open)','Exit (next open)','Net/share'],r.closedTrades.slice(-15).reverse().map(x=>[when(new Date(x.entryAt).toISOString()),when(new Date(x.exitAt).toISOString()),money(x.netPerShare)]))+
 (r.openPosition?'<p class="fine">One PAPER position still open and valued at the last completed candle close; no future exit price inferred.</p>':'')+
 '<p class="fine">'+esc(r.caveats.join(' · '))+'</p></details>')+'</div>':
 empty('No backtest calculated','Load daily HAL candles and run the local simulator.'));
}
function v5EvidencePanel(){
 const r=L5.build(evidence(),Date.now(),isBookConfirmed());
 return card('Six-Perspective Evidence Map',
  '<p class="fine">Calculated locally on this phone; opening this panel does not call Gemini or send portfolio data. The map checks evidence readiness, not whether a trade should be taken.</p>'+
  row('Perspectives with available evidence',num(r.available,0)+' of 6')+
  table(['Perspective','Status','Source review'],
   r.lenses.map(x=>[x.title,x.status,x.summary]))+
  '<details><summary>What each perspective still needs</summary>'+
   r.lenses.map(x=>'<p class="fine"><strong>'+esc(x.title)+'</strong> · '+esc(x.check)+(x.asOf?' · Evidence '+esc(when(x.asOf)):'')+'</p>').join('')+
  '</details><p class="fine">'+esc(r.caveat)+'</p>');
}
function optionChain(base){
 const packet=D.packet(s,'hedges',ui.expiry)||D.packet(s,'chain',ui.expiry);
 const chain=packet?.data||(base.option_expiry===ui.expiry?base:{});
 const rows=chain.option_rows||[];
 const retrieved=packet?.fetched_at_iso||chain.fetched_at_iso;
 const age=Date.now()-Date.parse(retrieved);
 const lastKnown=packet?packet._cache:base._cache;
 const held=new Set(book.legs.filter(l=>l.type==='PE'&&l.expiry===ui.expiry).map(l=>l.strike));
 const quote=(option,field,fallback)=>option?.quote?.[field]??option?.[fallback??field];
 const price=(option,field,fallback)=>money(quote(option,field,fallback));
 const oi=option=>num(quote(option,'open_interest','oi')??option?.open_interest,0);
 const dates=[...new Set([...(base.available_expiries||[]),ui.expiry].filter(E.validDate))].sort();
 const spot=market().spot?.price;
 const near=new Set(E.nearbyStrikes(rows.map(r=>r.strike),spot));
 const pinned=r=>ui.side==='PE'&&held.has(r.strike)&&!near.has(r.strike);
 const selected=rows.filter(r=>ui.fullChain||near.has(r.strike)||pinned(r)).sort((a,b)=>Number(pinned(b))-Number(pinned(a))||a.strike-b.strike);
 return card('Option chain',select('chain-expiry','Expiry',dates.map(d=>[d,date(d)+(book.legs.some(l=>l.type==='PE'&&l.expiry===d)?' · held':'')]),ui.expiry)+
 select('chain-side','Side',[['PE','Puts'],['CE','Calls']],ui.side)+
 (rows.length&&(!Number.isFinite(age)||age>900000||lastKnown||s.failure)?'<p>Last-known chain</p>':'')+
 (!near.size&&rows.length?'<p>Spot unavailable. View all strikes to browse the chain.</p>':'')+
 (selected.map(r=>{const o=ui.side==='PE'?r.put:r.call;return '<details class="contract-row"><summary>'+esc(money(r.strike)+(held.has(r.strike)&&ui.side==='PE'?' · held':'')+' · Bid '+price(o,'bid')+' · Ask '+price(o,'ask'))+'</summary>'+row('Last trade',price(o,'last_price','ltp'))+row('Volume / OI',num(quote(o,'volume'),0)+' / '+oi(o))+row('IV / delta / theta',pct(o?.iv)+' / '+num(o?.delta,3)+' / '+num(o?.theta,3))+'</details>';}).join('')||empty('No quotes for this expiry'))+
 (rows.length&&(rows.length>5||!near.size)?btn('full-chain',ui.fullChain?'Show nearby strikes':'View all strikes'):'')+btn('chain','Refresh quotes'));

}
function research(m,section){let body='';const t=researchTechnical(ui.frame),p=D.packet(s,'fundamentals','D',ui.statement),fund=p?.data||{},base=s.snapshot||{};
if(section==='markets')body=card('HAL price & volume',select('interval','Interval',[['D','Daily'],['1h','Hourly'],['15m','15 minutes']],ui.frame)+
 '<div class="toolbar">'+btn('entry-overlay','My levels')+btn('chart-display','Company events','data-id="showFilings"')+'</div>'+
 '<details><summary>Indicators</summary>'+[['hideSma','Moving averages',!ui.hideSma],['showRsi','RSI',ui.showRsi],['showMacd','MACD',ui.showMacd],['showBands','Bollinger Bands',ui.showBands],['hideVolume','Volume',!ui.hideVolume]].map(([key,label,on])=>btn('chart-display',label+(on?' · On':' · Off'),'data-id="'+key+'"')).join('')+
 routeButton('technicals','indicators','More indicators')+'</details>'+chartInspector(t.rows)+(t.rows.length?'':empty('Chart unavailable'))+'<a href="https://www.tradingview.com/">Lightweight Charts™ by TradingView</a>');
if(section==='chain')body=optionChain(base);
if(section==='indicators'){const a=researchTechnical('D'),close=a.rows.at(-1)?.c;body=card('Daily readings',row('Close / 50-day average',money(close)+' / '+money(a.sma50))+row('RSI (14)',num(a.rsi))+row('ATR (14)',money(a.atr)+' · '+pct(E.finite(a.atr)&&close>0?a.atr/close*100:null))+row('Trend',close>0&&a.sma50>0?(close>=a.sma50?'Above':'Below')+' the 50-session average':'—')+row('Momentum',E.finite(a.rsi)?(a.rsi>=70?'Upper RSI range':a.rsi<=30?'Lower RSI range':'Middle RSI range'):'—')+'<p class="fine">ATR measures the typical daily price range over 14 sessions.</p>')+card('Trend by timeframe',table(['Timeframe','Completed bars','Evidence'],[['D','Daily'],['1h','Hourly'],['15m','15 minute']].map(([f,n])=>{const t=technical(f);return [n,t.completedCount,t.bias||'Insufficient history'];})))+card('Technical evidence · '+ui.frame,`${badge(a.bias||'Insufficient history',a.stale?'stale':'')}<p class="fine">${a.rows.length} completed bars · ${when(a.asOf?new Date(a.asOf).toISOString():null)}</p>${table(['Indicator','Value'],[['SMA20 / 50 / 200',money(a.sma20)+' / '+money(a.sma50)+' / '+money(a.sma200)],['EMA12 / 26',money(a.ema12)+' / '+money(a.ema26)],['RSI14',num(a.rsi)],['MACD / signal / histogram',num(a.macd)+' / '+num(a.signal)+' / '+num(a.hist)],['ATR14',money(a.atr)],['MFI14',num(a.mfi)],['Bollinger lower / upper',money(a.bbLow)+' / '+money(a.bbHigh)],['Support / resistance',money(a.support)+' / '+money(a.resistance)],['Pivot / S1 / R1',money(a.pivot)+' / '+money(a.s1)+' / '+money(a.r1)],['Historical volatility',pct(a.vol)],['Volume trend',a.volumeTrend]])}<p class="fine">Locally derived indicators. Recent extremes and pivots are observations, not instructions. Incomplete or stale history withholds directional conclusions.</p>`,btn('candles','Refresh selected timeframe','class="text-button"'));}
if(section==='company'){body=card('Company fundamentals',`${select('statement','Reporting basis',[['consolidated','Consolidated'],['standalone','Standalone']],ui.statement)}${btn('fundamentals','Refresh fundamentals')}<p class="fine">Provider-reported facts · retrieved ${when(p?.fetched_at_iso)}. Reporting-period and unit fields remain as returned; missing information is not estimated.</p>${Object.entries({profile:'Profile',income:'Quarterly income',annual:'Annual income',ratios:'Valuation ratios',balance:'Balance sheet',cash:'Cash flow',shareholding:'Shareholding',actions:'Corporate actions',peers:'Competitors'}).map(([k,v])=>`<details><summary>${v}${fund[k]?'':' · unavailable'}</summary>${fund[k]?table(['Provider field / period','Reported value'],facts(fund[k])):empty('Unavailable',D.message(p?.errors?.[k]||'No verified data loaded'))}</details>`).join('')}<a href="https://upstox.com/developer/api-documentation/fundamentals/">Source documentation</a>`)+card('Business notes & events',book.notes.filter(n=>n.category!==reminderCategory).map(n=>`<article class="news-item">${badge('User-entered note')}<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><p class="fine">${esc(n.category)} · ${date(n.date)} · Event ${date(n.eventDate)}</p>${n.url?btn('link','Source',`data-url="${esc(n.url)}" class="text-button"`):''}${btn('note-edit','Edit',`data-id="${esc(n.id)}" class="text-button"`)}</article>`).join('')||empty('No business notes','Record verified order backlog, execution progress and guidance with source links.'),btn('note','Add note','class="text-button"'));}
if(section==='company')body=businessBoard()+'<details class="card disclosure"><summary>Financial statements and business notes</summary>'+body+'</details>';
if(section==='news'){let list=ui.filter==='saved'?book.bookmarks.map(n=>({...n,publishedAt:n.published})):news();if(ui.filter==='official')list=list.filter(n=>n.official);const re={orders:/order|contract|defence|defense/i,results:/profit|revenue|earnings|results|dividend/i,delivery:/deliver|production|engine|tejas|helicopter/i}[ui.filter];if(re)list=list.filter(n=>re.test(n.title+' '+n.summary));if(ui.filter==='all')list.sort((a,b)=>Number(/deliver|order|contract|engine|procure|execution/i.test(b.title))-Number(/deliver|order|contract|engine|procure|execution/i.test(a.title)));if(ui.search)list=list.filter(n=>n.title.toLowerCase().includes(ui.search.toLowerCase()));body=card('HAL newsroom',`<div class="form-grid">${select('news-filter','Topic',[['all','All news'],['official','Official filings'],['orders','Orders'],['results','Results'],['delivery','Delivery / execution'],['saved','Bookmarks']],ui.filter)}${input('news-search','Headline search',ui.search,'search')}</div>${btn('news','Refresh news')}${articleCards(list,60)}`)+card('Offline financial sentiment',`<p class="fine">Opt-in English FinBERT classification. Sentiment is text classification, not a HAL price prediction. Model/tokenizer are pinned and checksum verified; excluded from backups.</p>${row('Model status',ui.finbert.state)}${ui.finbert.progress!=null?row('Progress',pct(ui.finbert.progress)):''}<p class="fine">${esc(ui.finbert.message)}</p><div class="toolbar">${ui.finbert.state==='ready'?btn('sentiment','Classify headlines')+btn('model-remove','Remove model'):btn('model-install','Download ~111 MB')}${ui.finbert.state==='downloading'?btn('model-cancel','Cancel download'):''}</div>`);}
if(section==='backtest')body=v5BacktestPanel();
if(section==='insights')body=analogView()+card('Historical pattern scanner',`<p class="fine">Normalized return-distance comparison of completed, non-overlapping windows. Sample outcomes are descriptive, not predictive probabilities or backtested trading signals.</p><div class="form-grid">${input('pattern-window','Pattern window (sessions)',ui.patternWindow)}${input('pattern-forward','Outcome horizon (sessions)',ui.patternForward)}</div><div class="toolbar">${btn('patterns-load','Load history')}${btn('patterns','Compare','class="primary"')}</div>${ui.pattern?'<p class="fine">'+esc(ui.pattern.reason||ui.pattern.metric)+'</p>'+table(['Pattern ended','Distance ↓','Later return'],(ui.pattern.matches||[]).map(x=>[when(x.to),num(x.distance,4),pct(x.outcome)]))+(ui.pattern.summary?table(['Samples','Median','Worst / best'],[[ui.pattern.sampleCount,pct(ui.pattern.summary.median),pct(ui.pattern.summary.min)+' / '+pct(ui.pattern.summary.max)]]):''):empty('No scan requested')}`);
if(section==='ai')body=v5EvidencePanel()+card('Evidence-grounded AI Desk',`<p class="fine">Optional Gemini directly from Android. Your own API key and Google quota apply. Local deterministic calculations remain authoritative.</p>${row('Connection',ui.aiConfigured?'Configured · '+ui.model:'Disabled / no API key')}${btn('ai-settings','Manage key')}${select('ai-mode','Workspace',[['copilot','Position Copilot'],['deliberate','Six-Perspective Research'],['research','Research Assistant']],ui.aiMode)}<label><input id="ai-share" type="checkbox" ${ui.share?'checked':''} ${ui.aiMode==='research'?'disabled':''}>Include position evidence</label><label>Question<textarea id="ai-question" maxlength="2000">${esc(ui.question)}</textarea></label><p class="fine">Research Assistant always excludes your portfolio. Credentials, private journal memos and business-note text are excluded.</p><div class="toolbar">${btn('ai-review','Review exact evidence','class="primary"'+(ui.pendingAI?' disabled':''))}${ui.pendingAI?btn('ai-cancel','Cancel request'):''}</div><p class="warning">${esc(ui.aiError|| (ui.pendingAI?'Waiting for Gemini…':''))}</p>`)+(ui.ai?card(I.canUseAnswer(ui.ai,book)?'AI interpretation':'Previous conclusion invalidated',I.canUseAnswer(ui.ai,book)?`<p class="fine">Evidence ${when(ui.ai.evidenceAt)} · ${ui.ai.portfolioIncluded?'Position '+esc(ui.ai.bookRevision):'Portfolio excluded'}</p><div class="ai-output">${esc(ui.ai.reply||ui.ai.text||ui.ai.answer||ui.ai.content||'No text returned')}</div>`:empty('The position changed','Review updated evidence and request a new answer.')):'');
return body;}
function streamView(){const x=s.stream;return x?row('State',String(x.state).replace(/_/g,' '))+row('Decoded frames',num(x.frames,0))+table(['Instrument','Preview price','Feed time'],(x.rows||[]).map(q=>[q.key||q.instrument_key||q.instrumentKey,money(q.price??q.last_price),when(x.feed_ts?new Date(x.feed_ts).toISOString():null)])):empty('Preview stopped');}
const chartPages={};
let activeChartPage=null,chartCandles=null;
function chartPage(){
 return chartPages[ui.frame]||(chartPages[ui.frame]={time:null,mode:'chart',range:null});
}
function chartInspector(rows){
 if(!rows.length)return '';
 const page=chartPage(),selected=rows.some(r=>r.t===page.time)?page.time:rows[rows.length-1].t;
 page.time=selected;
 const options=rows.slice().reverse().map(r=>[String(r.t),ui.frame==='D'?date(E.istDate(r.t)):when(new Date(r.t).toISOString())]);
 return '<div class="toolbar">'+['chart','table'].map(mode=>btn('chart-mode',mode==='chart'?'Chart':'Table',
  `data-id="${mode}" aria-pressed="${page.mode===mode}" ${page.mode===mode?'class="primary"':''}`)).join('')+'</div>'+
  select('atlas-candle','Completed candle · IST',options,String(selected))+
  '<div id="market-chart" class="chart"'+(page.mode==='table'?' hidden':'')+'></div>'+
  '<div class="toolbar">'+btn('chart-step','Earlier','data-id="-1"')+btn('chart-step','Later','data-id="1"')+'</div>'+
  '<div id="atlas-candle-detail"></div>';
}
let inspectCandle=null;
function prepareCursor(rows){
 const page=chartPage(),frame=ui.frame,byTime=new Map(rows.map((r,i)=>[r.t,i]));
 const dayRows=new Map(rows.map(r=>[E.istDate(r.t),r.t])),marks=new Map(),dayCloses=new Map();
 for(const snapshot of [...book.checkpoints,reviewBaseline]){
  if(!snapshot||snapshot.version!==4||!Array.isArray(snapshot.positionMarks)||Date.parse(snapshot.savedAt)>Date.now())continue;
  for(const m of snapshot.positionMarks){
   if(!m||typeof m.instrumentKey!=='string'||!m.instrumentKey||!['PE','FUT'].includes(m.type)||!E.validDate(m.expiry)||!A5.comparableMark(m,snapshot.savedAt))continue;
   const t=Date.parse(m.quoteAt);
   let start;
   if(frame==='D')start=dayRows.get(E.istDate(t));
   else{
    // Provider candles can start at 09:15 IST. Match their actual bounds.
    let left=0,right=rows.length;
    while(left<right){const mid=(left+right)>>>1;if(rows[mid].t<=t)left=mid+1;else right=mid;}
    if(left&&t<rows[left-1].t+(frame==='15m'?900000:3600000))start=rows[left-1].t;
   }
   if(start==null)continue;
   if(!marks.has(start))marks.set(start,new Map());
   const bucket=marks.get(start),prior=bucket.get(m.instrumentKey);
   if(!prior||t>Date.parse(prior.quoteAt))bucket.set(m.instrumentKey,m);
   else if(t===Date.parse(prior.quoteAt)&&(m.price!==prior.price||m.source!==prior.source))bucket.set(m.instrumentKey,{quoteAt:m.quoteAt,conflict:true});
  }
 }
 for(const j of book.journal){
  if(j.kind!=='close'||!j.leg)continue;
  if(!dayCloses.has(j.date))dayCloses.set(j.date,[]);
  dayCloses.get(j.date).push(j);
 }
 let lastTime=null;
 inspectCandle=(t,step=0,fromChart=false)=>{
  const index=(byTime.get(t)??-1)+step;
  if(index<0||index>=rows.length)return;
  const r=rows[index];
  if(lastTime===r.t)return;
  lastTime=r.t;page.time=r.t;
  $('atlas-candle').value=String(r.t);
  if(!fromChart&&chart&&chartCandles){
   const scale=chart.timeScale(),range=scale.getVisibleLogicalRange();
   if(range&&(index<range.from||index>range.to)){
    const width=range.to-range.from;
    scale.setVisibleLogicalRange({from:index-width/2,to:index+width/2});
   }
   chart.setCrosshairPosition(r.c,r.t/1000,chartCandles);
  }
  for(const b of document.querySelectorAll('[data-action="chart-step"]'))b.disabled=Number(b.dataset.id)<0?index===0:index===rows.length-1;
  const observed=Array.from(marks.get(r.t)?.values()||[]).filter(m=>!m.conflict);
  const label=l=>l.type==='FUT'?'HAL future':num(l.strike,0)+' PE';
  const closeItems=dayCloses.get(E.istDate(r.t))||[];
  const detail=page.mode==='table'?table(['Candle · IST','Open','High','Low','Close','Volume'],
   rows.slice(Math.max(0,index-3),index+4).map(bar=>[(bar.t===r.t?'● ':'')+(frame==='D'?date(E.istDate(bar.t)):when(new Date(bar.t).toISOString())),
    ...[bar.o,bar.h,bar.l,bar.c].map(v=>money(v)),num(bar.v,0)])):
   table(['Open','High','Low','Close'],[[r.o,r.h,r.l,r.c].map(v=>money(v))])+row('HAL volume',num(r.v,0));
  $('atlas-candle-detail').innerHTML=detail+
   (observed.length?table(['Latest saved mark in candle','₹ per unit','Quote time'],observed.map(m=>[label(m)+' · '+date(m.expiry),money(m.price)+' · '+m.source,when(m.quoteAt)])):
   '<p class="fine">No saved contract quotes in this candle.</p>')+
   (closeItems.length?'<details><summary>Recorded closes on this date ('+closeItems.length+')</summary>'+
    table(['Contract','Expiry','Exit / unit'],closeItems.map(j=>[label(j.leg),date(j.leg.expiry),money(j.exit)]))+
    '<p class="fine">Journal closes record the date only.</p></details>':'');
 };
 inspectCandle(page.time);
}
function drawChart(){const el=$('market-chart'),t=researchTechnical(ui.frame);if(!el||!t.rows.length)return;prepareCursor(t.rows);if(chartPage().mode==='table'||!window.LightweightCharts)return;activeChartPage=chartPage();const c=getComputedStyle(document.body);chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:300,layout:{background:{color:c.getPropertyValue('--surface').trim()},textColor:c.getPropertyValue('--muted').trim()},grid:{vertLines:{color:c.getPropertyValue('--line').trim()},horzLines:{color:c.getPropertyValue('--line').trim()}},timeScale:{timeVisible:ui.frame!=='D'},handleScroll:{vertTouchDrag:false},localization:{locale:'en-IN',timeFormatter:v=>when(new Date(v*1000).toISOString())}});const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#49b9a3',downColor:'#e88b93',borderVisible:false,wickUpColor:'#49b9a3',wickDownColor:'#e88b93'});chartCandles=cs;cs.setData(t.rows.map(r=>({time:r.t/1000,open:r.o,high:r.h,low:r.l,close:r.c})));if(ui.frame==='D'&&window.LightweightCharts.createSeriesMarkers){
 const events=new Map();
 if(ui.showFilings)for(const n of news().filter(n=>n.official&&/result|order|contract/i.test(n.title))){const day=E.istDate(Date.parse(n.publishedAt)),bar=t.rows.find(r=>E.istDate(r.t)===day);if(bar)events.set(bar.t,n);}
 const times=[...new Set([...events.keys(),...(ui.filingMarker?[ui.filingMarker]:[])])].sort((a,b)=>a-b);
 window.LightweightCharts.createSeriesMarkers(cs,times.map(time=>({time:time/1000,position:'aboveBar',color:'#e2be78',shape:'arrowDown',text:'Filing'})));
 chart.subscribeClick(p=>{const n=events.get(p.time*1000);if(n)modal(n.title,companyEvidence(n),'',null);});
}if(!ui.hideVolume){const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume'});vol.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});vol.setData(t.rows.map(r=>({time:r.t/1000,value:r.v,color:r.c>=r.o?'#38786b':'#75424d'})));}if(ui.showRsi&&t.series?.rsi){const line=chart.addSeries(LightweightCharts.LineSeries,{priceScaleId:'rsi',color:'#bcb4fb',title:'RSI'});line.priceScale().applyOptions({scaleMargins:{top:.73,bottom:.05}});line.setData(t.rows.map((r,i)=>({time:r.t/1000,value:t.series.rsi[i]})).filter(p=>E.finite(p.value)));}if(ui.showMacd){
 for(const [key,color] of [['macd','#49b9a3'],['signal','#edc78a']]){
  const line=chart.addSeries(LightweightCharts.LineSeries,{priceScaleId:'macd',color,title:key});
  line.priceScale().applyOptions({scaleMargins:{top:.68,bottom:.07}});
  line.setData(t.rows.map((r,i)=>({time:r.t/1000,value:t.series?.[key]?.[i]})).filter(x=>E.finite(x.value)));
 }
}
if(ui.showBands)for(const side of [-1,1]){
 const points=t.rows.flatMap((r,i)=>{const mean=t.series?.sma20?.[i];if(!E.finite(mean)||i<19)return [];
 const variance=t.rows.slice(i-19,i+1).reduce((sum,b)=>sum+(b.c-mean)**2,0)/20;
 return [{time:r.t/1000,value:mean+side*2*Math.sqrt(variance)}];});
 chart.addSeries(LightweightCharts.LineSeries,{color:'#80abbf',lineWidth:1,priceLineVisible:false,lastValueVisible:false}).setData(points);
}
if(!ui.hideSma)for(const [k,color]of [['sma20','#bcb4fb'],['sma50','#e2be78'],['sma200','#70c8be']])if(t.series?.[k])chart.addSeries(LightweightCharts.LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false}).setData(t.rows.map((r,i)=>({time:r.t/1000,value:t.series[k][i]})).filter(x=>E.finite(x.value)));for(const l of (ui.futureOverlay?book.legs:[]))cs.createPriceLine({price:l.type==='FUT'?l.entry:l.strike,color:'#edc78a',lineWidth:1,lineStyle:2,title:l.type==='FUT'?'Futures entry':'Owned put strike'});const scale=chart.timeScale();
 if(activeChartPage.range){try{scale.setVisibleRange(activeChartPage.range);}catch(_){scale.fitContent();}}else scale.fitContent();
 const selected=t.rows.find(r=>r.t===activeChartPage.time);
 if(selected)chart.setCrosshairPosition(selected.c,selected.t/1000,cs);
 chart.subscribeCrosshairMove(point=>{if(typeof point.time==='number'&&inspectCandle)inspectCandle(point.time*1000,0,true);});
}
const desk={id:'',all:false,snapshot:null,selected:null,pending:null,message:'',baseline:null,target:'',buffer:0,custom:[]};
const deskArchive='research:atlas_baskets_v1';
function deskHistory(){
 const r=N?.cacheGet?JSON.parse(N.cacheGet(deskArchive)):{ok:true,data:JSON.parse(localStorage.getItem(deskArchive)||'null')};
 if(!r.ok||r.data!=null&&(r.data.version!==1||!Array.isArray(r.data.records)))throw Error('Saved comparisons unavailable.');
 return r.data?.records||[];
}
function deskBuild(){
 const m=market(),now=Date.now(),held=book.legs.find(l=>l.id===desk.id);
 if(!held)throw Error('Choose a held put.');
 const target=desk.baseline?.target||desk.target||book.legs.filter(l=>l.type==='FUT'&&l.expiry>held.expiry).map(l=>l.expiry).sort()[0];
 if(!target)throw Error('A later held futures expiry is required.');
 const strikes=[...new Set(m.contracts.filter(c=>c.type==='PE'&&c.expiry===target&&c.lotSize===held.lotSize).map(c=>c.strike))].sort((a,b)=>a-b);
 const choices=desk.baseline?.rows.map(r=>r.strike)||[strikes.filter(x=>x<held.strike).pop(),held.strike,strikes.find(x=>x>held.strike)].filter(E.finite);
 const settings=desk.baseline?.settings||{...E.hedgePreferences(book.hedge),slippage:desk.buffer};
 const custom=desk.baseline?.custom||desk.custom;
 const rows=choices.map(k=>H5.compareBasket(book,m,held.id,target,k,desk.all,settings,now,custom,{oneLot:desk.baseline?.oneLot,horizon:desk.baseline?.horizon}));
 const quotes={};
 for(const row of rows)for(const order of row.orders)quotes[order.key]=m.quotes[order.key];
 return {id:held.id,oneLot:desk.baseline?.oneLot,horizon:desk.baseline?.horizon,custom,all:desk.all,target,expiry:held.expiry,strike:held.strike,at:stamp(),settings,rows,quotes,spot:m.spot,legs:clone(book.legs),bookKey:I.confirmationFingerprint(book)};
}
function deskComplete(v){return v.rows.length>0&&v.rows.every(r=>r.cash!==null);}
function deskCapture(){
 const fresh=deskBuild(),old=desk.snapshot;
 if(old&&deskComplete(old)&&(!deskComplete(fresh)||old.rows.some(r=>!fresh.rows.some(x=>x.strike===r.strike)))){
  desk.message='Refresh incomplete · showing previous comparison';return;
 }
 desk.snapshot=fresh;desk.message='';desk.selected=fresh.rows.some(r=>r.strike===desk.selected)?desk.selected:fresh.strike;
}
function deskRefresh(){
 if(!configured){desk.message='Connect Upstox to refresh prices.';render();return;}
 const target=desk.snapshot?.target||desk.baseline?.target;
 if(!target)return;
 desk.pending={target,sections:new Set(['snapshot','contracts','hedges']),start:Date.now()};
 desk.message='Refreshing prices…';refresh(true);request('hedges',target,true);render();
}
function deskReceive(event,data){
 const p=desk.pending;
 if(!p||!['snapshot','error','research','research_error'].includes(event))return;
 const [keySection,keyFrame]=String(data?.key||'').split(':');
 const section=event==='snapshot'||event==='error'?'snapshot':data?.section||keySection;
 if(!p.sections.has(section)||section==='hedges'&&(data?.frame||keyFrame)!==p.target)return;
 if(event==='error'||event==='research_error'){desk.pending=null;desk.message='Refresh incomplete · showing previous comparison';return;}
 p.sections.delete(section);
 if(!p.sections.size){desk.pending=null;try{deskCapture();}catch(e){desk.message=e.message;}}
}
function deskStart(id){
 Object.assign(desk,{id,all:false,snapshot:null,baseline:null,selected:null,pending:null,message:'',target:'',buffer:0,custom:[]});
 try{deskCapture();}catch(e){desk.message=e.message;}
 navigate('position','fno');
 if(desk.snapshot&&!deskComplete(desk.snapshot))deskRefresh();
}
document.addEventListener('change',e=>{if(e.target.id==='pulse-strike'){ui.pulseStrike=Number(e.target.value);render();}});
function hedgeHome(m){
 const puts=book.legs.filter(l=>l.type==='PE'&&l.expiry>=E.istDate());
 const held=puts.find(l=>l.id===ui.hedgeHeld)||puts[0];
 const links='<div class="hub-links">'+btn('desk-history','Saved')+routeButton('position','stress','Stress Test')+'</div>';
 if(book.legs.some(l=>E.expiryTime(l.expiry)<=Date.now()))return links+empty('Reconcile expired holdings in Positions before comparing replacements.');
 if(!held)return links+empty('No open protective put','Add your held put in Positions to compare replacements.');
 const dates=[...new Set([...book.legs.filter(l=>l.type==='FUT').map(l=>l.expiry),...(s.snapshot?.available_expiries||[]),...m.contracts.filter(c=>c.type==='PE').map(c=>c.expiry)])].filter(d=>d>held.expiry).sort();
 const target=dates.includes(ui.rollTarget)?ui.rollTarget:dates.find(d=>book.legs.some(l=>l.type==='FUT'&&l.expiry===d))||dates[0];
 const strikes=[...new Set(m.contracts.filter(c=>c.type==='PE'&&c.expiry===target&&c.lotSize===held.lotSize).map(c=>c.strike))];
 const rank=ui.rollSort||'balanced',spot=m.spot.price,horizon=book.legs.map(l=>l.expiry).sort()[0];
 const budget=E.value(ui.maxRollSpend);
 const ranked=strikes.map(strike=>{const r=H5.compareBasket(book,m,held.id,target,strike,false,E.hedgePreferences(book.hedge),Date.now(),[],{oneLot:true,horizon});return {...r,delta:r.scenarios.find(x=>Math.abs(x.price-spot*.95)<.001)?.difference};}).filter(r=>r.cash!==null&&E.finite(r.delta)&&(budget===null||r.cash<=budget));
 const costs=ranked.map(r=>r.cash),gains=ranked.map(r=>r.delta);
 const norm=(v,arr)=>(v-Math.min(...arr))/(Math.max(...arr)-Math.min(...arr)||1);
 const score=r=>rank==='cost'?r.cash:rank==='protection'?-r.delta:norm(r.cash,costs)-norm(r.delta,gains);
 ranked.sort((a,b)=>score(a)-score(b)||a.cash-b.cash||a.strike-b.strike);
 const selected=ranked.find(r=>r.strike===ui.pulseStrike)||ranked[0];
 const protectedUnits=risk().coveredUnits;
 const comparison=selected?table(['','Keep current puts','Roll to selected put'],[
 ['Net roll cost',money(0),money(selected.cash)],['Shares covered now',num(protectedUnits,0),num(protectedUnits,0)],
 ['Expiry of selected lot',date(held.expiry),date(target)],...[-5,-10].map(shock=>{const x=selected.scenarios.find(v=>Math.abs(v.price-spot*(1+shock/100))<.001);return [shock+'% HAL',money(x?.keep),money(x?.roll)];})]):empty('No eligible replacement','Refresh quotes for the selected expiry.');
 return select('roll-held','Replace one lot',puts.map(l=>[l.id,num(l.strike,0)+' put · '+date(l.expiry)]),held.id)+
 select('roll-target','Protect through',dates.map(d=>[d,date(d)]),target)+(selected?select('pulse-strike','Replacement strike',ranked.map(r=>[String(r.strike),money(r.strike)]),String(selected.strike)):'')+card('Keep or roll · '+date(horizon),comparison)+select('roll-sort','Sort',[['balanced','Balanced'],['cost','Lower cost'],['protection','Stronger protection']],rank)+
 '<details><summary>Maximum spend</summary>'+input('roll-budget','Maximum spend (₹)',ui.maxRollSpend)+'</details>'+card('HAL −5% · '+date(horizon),ranked.length?(ui.allRolls?ranked:ranked.slice(0,3)).map(r=>btn('stress-roll',num(r.strike,0)+' put · '+date(target)+' · Net cost '+money(r.cash)+' · P&L difference '+money(r.delta),'data-held="'+esc(held.id)+'" data-expiry="'+esc(target)+'" data-strike="'+esc(r.strike)+'"')).join(''):empty('No eligible comparisons','Refresh quotes for the selected expiry.'))+
 (ranked.length>3?btn('roll-more',ui.allRolls?'Show top three':'View all'):'')+btn('load-roll','Refresh quotes')+btn('pick-details','Comparison details')+links;
}
function deskView(){
 if(desk.pending&&Date.now()-desk.pending.start>30000){desk.pending=null;desk.message='Refresh incomplete · showing previous comparison';}
 if(desk.snapshot&&desk.snapshot.bookKey!==I.confirmationFingerprint(book)&&!desk.baseline){
  Object.assign(desk,{id:'',snapshot:null,pending:null,message:'Positions changed. Select a put again.'});
 }
 if(!desk.id)return card('My contracts',book.legs.map(l=>row(l.type==='PE'?money(l.strike)+' PE':'HAL future',date(l.expiry)+' · '+E.units(l)+' units')+
  (l.type==='PE'?btn('desk-start','Compare rollover','data-id="'+esc(l.id)+'"'):routeButton('position','carry','Carry & rollover'))).join('')||empty('No held contracts'),btn('atlas-performance','Performance'))+
  browseDesk('fno')+btn('desk-history','Saved comparisons');
 const v=desk.snapshot;
 const header=btn('desk-home','My contracts')+(desk.message?'<p role="status">'+esc(desk.message)+'</p>':'');
 if(!v)return header;
 const r=v.rows.find(x=>x.strike===desk.selected)||v.rows[0];
 const down=row=>row?.scenarios.find(x=>Math.abs(x.price-(row===r?v.spot.price:desk.baseline?.spot.price)*.9)<.001)?.roll;
 const original=desk.baseline?.rows.find(x=>x.strike===r.strike);
 const owned=v.legs.find(l=>l.id===v.id),sell=r.orders.find(o=>o.side==='bid'&&o.strike===owned?.strike),buy=r.orders.find(o=>o.side==='ask'&&o.strike===r.strike);
 function iv(o){const q=v.quotes[o?.key],age=Date.parse(v.at)-Date.parse(q?.greeksAt);return age>=-5000&&age<=120000&&E.finite(q?.iv)&&q.iv>0?q.iv:null;}
 const oldIv=iv(sell),newIv=iv(buy);
 const amount=r.cash===null?'Unavailable':money(Math.abs(r.cash));
 const snapshotLabel='Snapshot · '+when(v.at);
 return header+card(r.cash<0?'Estimated cash received':'Estimated total cash needed',
  '<strong class="hero-value">'+esc(amount)+'</strong>'+row('Replacement expiry',date(v.target))+
  row('Held / replacement IV',pct(oldIv)+' / '+pct(newIv))+row('IV difference',E.finite(oldIv)&&E.finite(newIv)?num(newIv-oldIv)+' pp':'—')+
  row('Extra protection',Math.round((E.expiryTime(v.target)-E.expiryTime(v.expiry))/86400000)+' days')+
  (original&&original.cash!==null&&r.cash!==null?row('Cash cost change from saved',money(r.cash-original.cash)):'')+
  (original&&E.finite(down(r))&&E.finite(down(original))?row('Change in −10% scenario P&L',money(down(r)-down(original))):'')+
  (r.errors.length?'<p>'+esc(r.errors.join(' · '))+'</p>':'')+
  r.orders.map(o=>row(money(o.strike)+' '+o.side,o.fill?o.fill.filled+' / '+o.units+' units · '+money(o.fill.value):'Unavailable')).join('')+
  (v.legs.some(l=>l.id!==v.id&&l.type==='PE'&&l.expiry===v.expiry)?btn('desk-all',v.all?'Selected put only':'Include other puts at this expiry'):'')+
  btn('desk-refresh','Refresh')+(r.cash!==null?btn('desk-save','Save comparison'):'')+
  '<details><summary>Assumptions and quote details</summary>'+row('Snapshot',snapshotLabel)+row('Charges',money(r.fees))+row('Extra slippage',pct(v.settings.slippage))+row('Annual rate / dividend',pct(v.settings.rate)+' / '+pct(v.settings.dividend))+'<p>Constant futures basis. Later puts use their own observed IV.</p>'+(!desk.baseline?btn('desk-options','Edit assumptions or target expiry'):'')+'</details>')+
  card('Compare strikes',v.rows.map(x=>{const down=x.scenarios.find(t=>t.price===v.spot.price*.9);return btn('desk-strike',esc(money(x.strike)),'data-id="'+x.strike+'" aria-pressed="'+(x===r)+'"')+row('Net cost / −10% P&L',money(x.cash)+' / '+money(down?.roll));}).join(''))+
  card('At '+date(v.horizon||v.expiry),r.scenarios.length?table(['HAL spot','Keep','Roll','Roll − Keep'],r.scenarios.map(x=>[money(x.price),money(x.keep),money(x.roll),money(x.difference)])):empty('Fresh HAL spot unavailable'));
}
function deskSave(v=desk.snapshot,selected=desk.selected){
 if(!v)return;
 const list=deskHistory(),record={...v,selected,savedId:Date.now()+'-'+Math.random().toString(36).slice(2,8)};
 const data=JSON.stringify({version:1,records:[record,...list]});
 if(N?.cachePut){if(!JSON.parse(N.cachePut(deskArchive,data)).ok)throw Error('Comparison could not be saved.');}
 else localStorage.setItem(deskArchive,data);
 toast('Comparison saved.');
}
function deskSaved(){
 modal('Saved comparisons',deskHistory().map(v=>btn('desk-open',esc(money(v.strike)+' PE · '+when(v.at)),'data-id="'+esc(v.savedId)+'"')).join('')||empty('No saved comparisons'),'',null);
}

function filingQuarter(n){
 const text=n.title+' '+(n.summary||'');
 const m=text.match(/(?:quarter|three months|period)\s+(?:and\s+[^.;]{1,35}?\s+)?end(?:ed|ing)\s+(?:on\s+)?(?:\d{1,2}(?:st|nd|rd|th)?[ .,/–-]+)?(Mar(?:ch)?|Jun(?:e)?|Sep(?:t(?:ember)?)?|Dec(?:ember)?)[ .,/–-]+(?:\d{1,2}(?:st|nd|rd|th)?[ ,.-]+)?(20\d{2})/i);
 return m?m[1].slice(0,1).toUpperCase()+m[1].slice(1,3).toLowerCase()+' '+m[2]:null;
}
function companyEvidence(n){
 const passage=(n.title||'')+' '+(n.summary||'');
 const field=(regex)=>passage.match(regex)?.[1]?.trim()||'Not disclosed in feed excerpt';
 const order=/order|contract|award/i.test(passage);
 const context=order?row('Status',/signed|awarded|received an order/i.test(passage)?'Award or signing reported':'Status needs source review')+
  row('Customer',field(/(?:customer|client)\s*[:–-]\s*([^.;]{2,85})/i))+
  row('HAL share',field(/(?:HAL.s share|attributable to HAL)\s*(?:is|of|:)?\s*((?:₹|Rs\.?)\s*[\d.,]+\s*crore)/i))+
  row('Delivery period',field(/(?:delivery period|delivery schedule)\s*[:–-]\s*([^.;]{2,90})/i)):'';
 const fund=D.packet(s,'fundamentals','D',ui.statement)?.data||{},quarter=filingQuarter(n);
 let results='';
 if(/result|financial statement/i.test(passage)){
  results=quarter?financialView(fund,quarter):row('Reporting period','Open the filing to confirm the quarter');
  results+=routeButton('research','financials','Financial history');
 }
 if(/shareholding|ownership pattern/i.test(passage)){
  const available=historyArray(fund.shareholding).some(g=>historyArray(g.history).some(h=>h.period===quarter));
  results+=available?table(['Category',quarter,'Quarter change'],historyArray(fund.shareholding).map(g=>{const h=series(fund.shareholding,g.category),i=periodIndex(quarter),v=atPeriod(h,i),prior=atPeriod(h,i-3);return [g.category,pct(v),E.finite(v)&&E.finite(prior)?num(v-prior)+' pp':'—'];})):row('Ownership breakdown','Open original disclosure for the reported period');
  results+=routeButton('research','ownership','View ownership history');
 }
 return results+context+btn('compare-filings','Compare with previous','data-url="'+esc(n.url)+'"')+reactionView(n);
}
function reactionView(n){
 const t=Date.parse(n.publishedAt);if(!Number.isFinite(t))return empty('Filing time unavailable');
 const d=E.istDate(t),after=t>=Date.parse(d+'T15:30:00+05:30');
 // Use the next observed trading session for holidays and after-close announcements.
 const sessions=researchSessions(),first=sessions[0],session=first&&d>=first[0]?sessions.find(r=>r[0]>d||r[0]===d&&!after):null;
 if(!session){
  const marketData=market(),bars=researchBars(),currentDay=E.istDate();
  const liveClock=marketData.spot?.tradeAt;
  const current=liveClock&&E.istDate(Date.parse(liveClock))===currentDay&&Date.now()<Date.parse(currentDay+'T15:30:00+05:30');
  const next=bars.filter(b=>E.istDate(b.t)>d||E.istDate(b.t)===d&&!after)[0];
  if(next&&d>=E.istDate(bars[0].t)){
   const i=bars.indexOf(next),prev=bars[i-1];if(prev)return row('Reaction session',date(E.istDate(next.t)))+row('HAL',pct((next.c/prev.c-1)*100))+row('Benchmark history','Unavailable for that session')+btn('filing-chart','Show on daily chart','data-id="'+E.istDate(next.t)+'"');
  }
  if(current&&d===currentDay&&!after&&t<=Date.now()){
   const liveReturn=q=>{const stamp=q?.tradeAt||q?.quoteAt;return stamp&&E.istDate(Date.parse(stamp))===currentDay?pct(sessionMove(q)):'—';};
   return row('Reaction so far · '+date(currentDay),liveReturn(marketData.spot))+row('NIFTY 50 / Defence',liveReturn(marketData.nifty)+' / '+liveReturn(marketData.defence));
  }
  return empty('Comparable session unavailable');
 }
 return row(after?'Next observed session after publication':'Reaction session',date(session[0]))+row('HAL open / close',money(session[1])+' / '+money(session[4]))+row('Session volume',num(session[5],0))+row('HAL / NIFTY 50 / Defence',pct((session[4]/session[6]-1)*100)+' / '+pct(session[7])+' / '+pct(session[8]))+
 btn('filing-chart','Show on daily chart','data-id="'+session[0]+'"');
}
const closingIndexKey='hal_atlas_closing_indices_v1';
let indexCloses={};
try{const raw=JSON.parse(localStorage.getItem(closingIndexKey)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))indexCloses=raw;}catch(_){}
function rememberIndexClose(){
 const m=market(),day=E.istDate(),end=Date.parse(day+'T15:30:00+05:30');
 if(Date.now()<end||Date.now()>end+8*3600000)return;
 const capture=q=>{
  const clock=Date.parse(q?.quoteAt),value=sessionMove(q);
  return value!==null&&clock>=end&&E.istDate(clock)===day?value:null;
 };
 const row=[capture(m.nifty),capture(m.defence)],previous=indexCloses[day]||[null,null];
 const next=row.map((v,i)=>v??previous[i]);if(next.every((v,i)=>v===previous[i]))return;
 indexCloses[day]=next;try{localStorage.setItem(closingIndexKey,JSON.stringify(indexCloses));}catch(_){}
}
function researchSessions(){
 const bundled=HALResearchHistory.filter(x=>Date.parse(x[0]+'T15:30:00+05:30')<=Date.now());
 const sessions=new Map(bundled.map(r=>[r[0],r]));
 let previous=null;
 for(const bar of technical('D').rows){
  const day=E.istDate(bar.t),saved=sessions.get(day),indices=indexCloses[day]||[];
  if(!saved&&previous)sessions.set(day,[day,bar.o,bar.h,bar.l,bar.c,bar.v,previous.c,indices[0]??null,indices[1]??null]);
  previous=bar;
 }
 return [...sessions.values()].sort((a,b)=>a[0].localeCompare(b[0]));
}
function researchBars(){
 const saved=researchSessions().map(r=>({t:Date.parse(r[0]+'T09:15:00+05:30'),o:r[1],h:r[2],l:r[3],c:r[4],v:r[5]}));
 const byDate=new Map(saved.map(r=>[E.istDate(r.t),r]));
 for(const r of technical('D').rows)byDate.set(E.istDate(r.t),r);
 return [...byDate.values()].sort((a,b)=>a.t-b.t);
}
function researchTechnical(frame){
 if(frame!=='D')return technical(frame);
 const raw=researchBars().map(r=>[new Date(r.t).toISOString(),r.o,r.h,r.l,r.c,r.v]);
 return E.technicals(raw,'D',Date.now(),D.rawCandles(s,'D').retrievedAt||null);
}
function analogView(){
 const bars=researchBars(),n=bars.length;
 function state(i){
  const prices=bars.slice(i-49,i+1).map(r=>r.c);
  const avg=prices.reduce((a,b)=>a+b,0)/50,close=prices.at(-1),momentum=close/prices.at(-15)-1;
  const returns=prices.slice(-21).slice(1).map((p,j)=>Math.log(p/prices[prices.length-21+j]));
  const mean=returns.reduce((a,b)=>a+b,0)/20;
  const volatility=Math.sqrt(returns.reduce((a,b)=>a+(b-mean)**2,0)/19);
  return [Math.sign(close-avg),Math.sign(momentum),volatility];
 }
 if(n<105)return empty('More completed daily sessions needed');
 const target=state(n-1),samples=[];
 for(let i=n-7;i>=49;i--){const x=state(i);if(x[0]!==target[0]||x[1]!==target[1]||Math.abs(x[2]-target[2])>Math.max(.001,target[2]*.25))continue;
  samples.push(100*(bars[i+5].c/bars[i].c-1));i-=5;}
 samples.sort((a,b)=>a-b);const mid=Math.floor(samples.length/2);
 return card('Sessions like the latest close',row('Matches',String(samples.length))+(samples.length>=5?
 row('Median five-session return',pct(samples.length%2?samples[mid]:(samples[mid]+samples[mid-1])/2))+row('Observed range',pct(samples[0])+' to '+pct(samples.at(-1))):'<p>At least five comparable outcomes needed.</p>')+
 '<details><summary>Match rules</summary>Same side of the 50-session average, same 14-session momentum direction and similar 20-session volatility. Outcome windows do not overlap.</details>');
}

const researchDesks={
 brief:[['position','brief','Market Brief'],['position','analysis','Daily Analysis'],['technicals','markets','Chart'],['technicals','indicators','Technical indicators'],['technicals','insights','Historical patterns'],['technicals','backtest','Backtests']],
 fno:[['position','fno','F&O Desk'],['technicals','chain','Option chain'],['position','carry','Futures carry & rollover'],['position','risk','Current protection']],
 company:[['research','events','Company & Events'],['research','financials','Company Financials'],['research','orders','Order book & awards'],['research','deliveries','Deliveries'],['research','ownership','Shareholding'],['research','valuation','Valuation'],['research','calendar','Confirmed events'],['research','news','News'],['research','company','Provider statements']]
};
function routeButton(screen,key,title){return '<button data-route="'+esc(screen)+'" data-sub="'+esc(key)+'">'+esc(title)+'</button>';}
function browseDesk(key){return btn('browse-desk','Browse '+({brief:'market tools',fno:'F&O tools',company:'company research'})[key],'data-id="'+key+'"');}
function showDeskTools(key){modal('Browse','<nav class="atlas-directory"><section><div>'+researchDesks[key].slice(1).map(r=>routeButton(...r)).join('')+'</div></section></nav>','',null);}
function sessionMove(q){return q?.previousClose>0&&q.price>0&&E.quoteQuality(q).valid?(q.price/q.previousClose-1)*100:null;}
function marketDigest(m){
 const moves=[],missing=[],saved=researchSessions().at(-1);
 const live=sessionMove(m.spot),tradeDay=m.spot?.tradeAt?E.istDate(Date.parse(m.spot.tradeAt)):null;
 const useSaved=saved&&(live===null||!tradeDay||tradeDay<saved[0]);
 const asof=useSaved?saved[0]+'T15:30:00+05:30':m.spot?.tradeAt,day=asof?E.istDate(Date.parse(asof)):null;
 const spot=useSaved?(saved[4]/saved[6]-1)*100:live;
 const aligned=researchSessions().find(x=>x[0]===day);
 const closed=aligned&&Date.now()>=Date.parse(day+'T15:30:00+05:30');

 const bars=researchBars().filter(b=>day&&E.istDate(b.t)<day),prior=bars.at(-1);
 const portfolio=book.legs.filter(l=>E.expiryTime(l.expiry)>=Date.now());
 function add(score,title,detail,screen,key){moves.push({score,title,detail,screen,key});}
 if(spot===null||!day)missing.push('HAL quote');else if(Math.abs(spot)>=1)add(Math.abs(spot)*(portfolio.length?2:1),'HAL '+pct(spot)+' since previous close',portfolio.length?'Moves the underlying for your held contracts.':'Daily cash-market move.','technicals','markets');
 for(const leg of portfolio){
  const match=E.matchContract(leg,m),q=match.contract&&m.quotes[match.contract.instrumentKey],change=sessionMove(q);
  if(change===null||!day||!q?.tradeAt||E.istDate(Date.parse(q.tradeAt))!==day){missing.push('held contract marks');continue;}
  if(Math.abs(change)>=(leg.type==='PE'?8:1))add(2+Math.min(6,Math.abs(change)/(leg.type==='PE'?6:1)),(leg.type==='PE'?money(leg.strike)+' put':'Held future')+' '+pct(change),date(leg.expiry)+' · '+money((q.price-q.previousClose)*E.units(leg))+' change across held units.','position','fno');
 }
 const start=prior?Date.parse(E.istDate(prior.t)+'T15:30:00+05:30'):null;
 const filingPacket=D.packet(s,'filings');
 if(!start||!filingPacket||filingPacket._cache||Object.keys(filingPacket.errors||{}).length)missing.push('filing coverage');
 if(start)for(const n of news().filter(n=>n.official&&Date.parse(n.publishedAt)>start&&Date.parse(n.publishedAt)<=Date.now())){
  if(/result|deliver|order|guidance|contract|production/i.test(n.title))add(portfolio.length?5:3,n.title,'Official disclosure during this review period.','research','events');
 }
 function benchmark(q,index){
  if(closed&&E.finite(aligned[index]))return aligned[index];
  const clock=q?.tradeAt||q?.quoteAt;
  return clock&&day&&E.istDate(Date.parse(clock))===day?sessionMove(q):null;
 }
 const readings=[['HAL',spot],['Nifty 50',benchmark(m.nifty,7)],['Nifty India Defence',benchmark(m.defence,8)]];
 const maximum=Math.max(1,...readings.map(x=>Math.abs(x[1]||0)));
 return card('HAL · NSE',routeButton('technicals','markets',money(useSaved?saved[4]:m.spot?.price))+
 (day?'<small>'+esc(date(day))+'</small>':''))+
 card('Since previous close',readings.map(([name,value])=>'<div class="benchmark-row"><span>'+esc(name)+'</span><i aria-hidden="true"><b style="width:'+Math.round(Math.abs(value||0)/maximum*100)+'%"></b></i><strong>'+esc(pct(value))+'</strong></div>').join(''))+
 (moves.length?'<details><summary>Market moves</summary>'+moves.sort((a,b)=>b.score-a.score).slice(0,3).map(x=>row(x.title,x.detail)).join('')+'</details>':'');

}
const historyArray=x=>Array.isArray(x)?x:[];
function periodIndex(label){
 const m=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i.exec(label||'');
 return m?Number(m[2])*12+'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').indexOf(m[1].toLowerCase()):null;
}
function series(items,key){
 const item=historyArray(items).find(i=>String(i.category||i.particular||'').toLowerCase()===key);
 return historyArray(item?.history).filter(h=>E.finite(h.value)&&periodIndex(h.period)!==null).sort((a,b)=>periodIndex(b.period)-periodIndex(a.period));
}
const atPeriod=(rows,index)=>rows.find(x=>periodIndex(x.period)===index)?.value??null;
function financialView(fund,quarter){
 const yearly=!quarter&&ui.finYears===true,src=yearly?fund.annual:fund.income;
 const same=x=>x?.type===ui.statement&&String(x.units_in).toLowerCase()==='crore';
 const inc=same(src)?src.income_statement:null,rev=series(inc,'revenue'),profit=series(inc,'net_profit'),op=series(inc,'operating_profit');
 const margin=i=>{const r=atPeriod(rev,i),p=atPeriod(op,i);return r>0&&E.finite(p)?100*p/r:null;};
 const period=periodIndex(quarter||rev[0]?.period),last=period===null?null:period-12;
 function snapshot(label,rows){return [label,num(atPeriod(rows,period)),num(atPeriod(rows,last))];}
 if(quarter)return card('Quarterly results · '+quarter,rev.some(x=>periodIndex(x.period)===period)?table(['₹ crore',quarter,'Year earlier'],[snapshot('Revenue',rev),snapshot('Net profit',profit),['Operating margin',pct(margin(period)),pct(margin(last))]]):empty('Comparable data unavailable for this quarter'));
 const income=rev.length?table(['₹ crore',rev[0].period,'Year earlier'],[snapshot('Revenue',rev),snapshot('Net profit',profit),['Operating margin',pct(margin(period)),pct(margin(last))]])+
  row('Margin change',E.finite(margin(period))&&E.finite(margin(last))?num(margin(period)-margin(last))+' pp':'—')+
  '<details><summary>Period history</summary>'+table(['Period','Revenue','Operating margin','Net profit'],rev.slice(0,yearly?5:8).map(h=>[h.period,num(h.value),pct(margin(periodIndex(h.period))),num(atPeriod(profit,periodIndex(h.period)))]))+'</details>':empty('Comparable income statements unavailable');
 const cash=same(fund.cash)?series(fund.cash.cash_flow,'operating'):[],annual=same(fund.annual)?series(fund.annual.income_statement,'net_profit'):[];
 const bal=same(fund.balance)?fund.balance.full_statement:[],cashEq=series(bal,'cash and cash equivalents'),borrow=series(bal,'total borrowings');
 const balPeriod=cashEq[0]?.period||borrow[0]?.period,idx=periodIndex(balPeriod),cashVal=atPeriod(cashEq,idx),borrowVal=atPeriod(borrow,idx);
 return card('Results · '+ui.statement,btn('fin-years',yearly?'Show eight quarters':'Show five years')+income)+
 card('Operating cash flow and net profit',cash.length?row(cash[0].period+' · operating cash flow (₹ cr)',num(cash[0].value))+row('Same-period net profit (₹ cr)',num(fund.cash.time_period==='yearly'?atPeriod(annual,periodIndex(cash[0].period)):null)):empty('Operating cash flow unavailable'))+
 card('Cash and borrowings'+(balPeriod?' · '+balPeriod:''),row('Cash and cash equivalents (₹ cr)',num(cashVal))+row('Total borrowings (₹ cr)',num(borrowVal))+row('Difference (₹ cr)',num(E.finite(cashVal)&&E.finite(borrowVal)?cashVal-borrowVal:null)))+
 routeButton('research','valuation','Valuation')+routeButton('research','company','Source statements and reporting basis');
}
function pulseQuarter(fund){
 const inc=fund.income,items=inc?.type===ui.statement&&String(inc.units_in).toLowerCase()==='crore'?inc.income_statement:[],revs=series(items,'revenue'),profits=series(items,'net_profit');
 if(!revs.length)return empty('Comparable quarterly figures unavailable')+routeButton('research','company','Financial data sources');
 const latest=periodIndex(revs[0].period),rows=revs.filter(r=>periodIndex(r.period)>=latest-12).slice(0,5).reverse();
 const mode=ui.pulseMargin,peak=Math.max(1,...rows.map(r=>Math.max(r.value,Math.abs(atPeriod(profits,periodIndex(r.period))||0))));
 const margin=i=>{const p=atPeriod(profits,i),rev=atPeriod(revs,i);return E.finite(p)&&rev>0?100*p/rev:null;};
 const hist=rows.map(r=>{const i=periodIndex(r.period),p=atPeriod(profits,i),m=margin(i);
 const bar=(v,den,c)=>E.finite(v)?'<i style="width:'+Math.min(100,Math.abs(v)/den*100)+'%;background:'+c+'"></i>':'';
 return '<div class="quarter"><span>'+esc(r.period)+'</span><div>'+ (mode?bar(m,100,'var(--accent)'):bar(r.value,peak,'var(--accent)')+bar(p,peak,'var(--gain)'))+'</div><small>'+esc(mode?pct(m):num(r.value)+' / '+num(p))+'</small></div>';}).join('');
 function yoy(arr){const curr=atPeriod(arr,latest),prior=atPeriod(arr,latest-12);return E.finite(curr)&&prior>0?pct(100*(curr/prior-1)):'Unavailable';}
 return '<button id="pulse-margin">'+(mode?'Revenue & net profit':'Net margin %')+'</button><p class="fine">'+(mode?'Net profit / revenue':'Revenue (blue) and net profit (green) · ₹ crore')+'</p>'+hist+row(revs[0].period+' revenue (₹ crore)',num(revs[0].value)+' · YoY '+yoy(revs))+row('Net profit (₹ crore)',num(atPeriod(profits,latest))+' · YoY '+yoy(profits))+row('Net margin',pct(margin(latest)))+row('Net margin change YoY',signedPoints(reviewMath.marginChange(margin(latest),margin(latest-12))));
}
function signedPoints(v){return E.finite(v)?(v>0?'+':'')+num(v)+' pp':'Unavailable';}
function pulseOwnership(fund){
 const groups=historyArray(fund.shareholding),periods=new Map();
 for(const g of groups)for(const h of historyArray(g.history)){const index=periodIndex(h.period);if(E.finite(index))periods.set(index,h.period);}
 const latest=periods.size?Math.max(...periods.keys()):null;
 const now=reviewMath.groupOwnership(groups,periods.get(latest)),prior=reviewMath.groupOwnership(groups,periods.get(latest-3));
 return '<p class="fine">'+esc(periods.get(latest)||'Reporting quarter unavailable')+'</p>'+reviewMath.labels.map((name,i)=>row(name,pct(now[i])+' · QoQ '+signedPoints(reviewMath.marginChange(now[i],prior[i])))+(E.finite(now[i])?'<progress max="100" value="'+now[i]+'"></progress>':'')).join('');
}
function valuationCard(backlog){
 return row('Reported order book · '+date(backlog.day),num(backlog.value)+' crore')+btn('link','Reporting source','data-url="'+esc(backlog.url)+'"')+
 '<details><summary>Model a scenario</summary><div id="pulse-value" data-book="'+backlog.value+'">'+[['Execution',10,22,14.5,'Annual execution (%)'],['Margin',20,34,27,'Net margin (%)'],['PE',22,45,34,'Forward P/E']].map(([id,min,max,v,label])=>'<label>'+label+' <strong id="v-'+id+'">'+v+'</strong><input id="slider-'+id+'" type="range" min="'+min+'" max="'+max+'" value="'+v+'" step=".5"></label>').join('')+'<p>Assumed share count · 66.88 crore</p><output id="model-out">Model estimate · '+money(backlog.value*.145*.27/66.88*34)+'</output></div></details>';
}
document.addEventListener('input',e=>{if(!e.target.id.startsWith('slider-')||!$('pulse-value'))return;const [execution,margin,pe]=['Execution','Margin','PE'].map(k=>{const v=+$('slider-'+k).value;$('v-'+k).textContent=v;return v;});$('model-out').textContent='Model estimate · '+money(Number($('pulse-value').dataset.book)*execution/100*margin/100/66.88*pe);});
const briefingCacheKey='atlas.story.briefings.v1';
let briefingCache=[];
try{const parsed=JSON.parse(localStorage.getItem(briefingCacheKey)||'[]');if(Array.isArray(parsed))briefingCache=parsed;}catch(_){}
let pendingBrief=null;
const leadStory=()=>news().filter(n=>n.url&&Date.parse(n.publishedAt)<=Date.now()).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt))[0];
const storyKey=n=>JSON.stringify([n.url,n.publishedAt,n.title]);
function briefingPanel(n){
 const saved=briefingCache.find(x=>x.key===storyKey(n));
 return card('AI analysis',saved?.reply?'<p>'+esc(saved.reply)+'</p>'+row('Generated',when(saved.at)):row('Gemini',saved?'No completed briefing':ui.autoBrief?'Awaiting analysis':'Automatic briefings disabled'));
}
function maybeBrief(){
 if(!ui.autoBrief||!ui.aiConfigured||pendingBrief||ui.pendingAI||!N?.autoBrief||document.visibilityState!=='visible')return;
 const story=leadStory();if(!story)return;
 const key=storyKey(story);if(briefingCache.some(x=>x.key===key))return;
 const packet=I.evidencePacket({news:[story],market:{spot:market().spot}},{mode:'research',includePortfolio:false});
 const bar=researchBars().at(-1);
 if(bar)packet.technical={asOf:new Date(bar.t).toISOString(),volume:bar.v};
 const id='brief-'+Date.now();
 briefingCache=[...briefingCache,{key,at:stamp()}].slice(-100);
 try{localStorage.setItem(briefingCacheKey,JSON.stringify(briefingCache));}catch(_){return;}
 pendingBrief={id,key};native('autoBrief',JSON.stringify({id,mode:'research',message:'Explain this HAL publication. Separate facts and interpretation.',evidence:packet,consent:true}));
}
function developments(){
 const fund=D.packet(s,'fundamentals','D',ui.statement)?.data||{},panel=(title,body)=>'<details class="card"><summary>'+title+'</summary>'+body+'</details>';
 const items=news().slice().sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 return card('Lead story',items.length?articleCards(items,1):empty('No recent story available'))+(items.length>1?card('Timeline',articleCards(items.slice(1),8)):'')+panel('Quarterly results','<div id="pulse-quarter">'+pulseQuarter(fund)+'</div>')+panel('Order-book valuation',companyLanding('pulse-model'))+panel('Shareholding',pulseOwnership(fund));
}
document.addEventListener('click',e=>{if(e.target.id==='pulse-margin'){ui.pulseMargin=!ui.pulseMargin;$('pulse-quarter').innerHTML=pulseQuarter(D.packet(s,'fundamentals','D',ui.statement)?.data||{});}});

function companyLanding(section){
 const disclosures=news().filter(n=>n.official),fund=D.packet(s,'fundamentals','D',ui.statement)?.data||{};
 if(section==='events'){
  const dated=disclosures.filter(x=>x.eventDate>=E.istDate()).sort((a,b)=>a.eventDate.localeCompare(b.eventDate));
  return (dated.length?card('Next scheduled event',row(date(dated[0].eventDate),dated[0].title)):'')+
   select('timeline-filter','Show',[['all','All events'],['orders','Orders & deliveries']],ui.ordersOnly?'orders':'all')+
   (ui.ordersOnly?companyLanding('orders')+'<details><summary>Deliveries</summary>'+companyLanding('deliveries')+'</details>':card('Company timeline',articleCards(news(),30)))+
   routeButton('research','financials','Financial history');
 }
 if(section==='financials')return financialView(fund);
 if(section==='ownership'){
  const groups=historyArray(fund.shareholding),periods=[...new Set(groups.flatMap(g=>historyArray(g.history).map(h=>h.period)))].sort((a,b)=>periodIndex(b)-periodIndex(a)),latest=periodIndex(ui.ownershipPeriod||periods[0]);
  return card('Ownership change',select('ownership-period','Quarter',periods.map(p=>[p,p]),ui.ownershipPeriod||periods[0])+(groups.length?table(['Category','Stake','Quarter change'],groups.map(g=>{const h=series(groups,g.category),a=atPeriod(h,latest),b=atPeriod(h,latest-3);return [g.category.replace(/_/g,' '),pct(a),a!==null&&b!==null?num(a-b)+' pp':'—'];})):empty('Shareholding data unavailable')));
 }
 if(section==='valuation'){const ratio=historyArray(fund.ratios).find(x=>x.name==='P/E');return card('HAL valuation',row('Reported P/E',ratio?.company_value??'Unavailable')+row('Five fiscal year-end observations · FY22–FY26','Median 25.58× · range 9.77–33.40×')+btn('link','Historical P/E source','data-url="https://stockanalysis.com/quote/nse/HAL/financials/ratios/"'));}
 if(section==='calendar'){
  const cutoff=risk().nextExpiry,today=E.istDate(),events=[...disclosures.filter(n=>n.eventDate>=today),...book.notes.filter(n=>n.eventDate>=today&&n.url&&disclosures.some(f=>f.url===n.url)&&!disclosures.some(f=>f.url===n.url&&f.eventDate===n.eventDate)).map(n=>({...n,title:n.title+' · date recorded from filing'}))].sort((a,b)=>a.eventDate.localeCompare(b.eventDate));
  const before=events.filter(n=>cutoff&&n.eventDate<=cutoff),featured=before.find(n=>/result|deliver|guidance|order/i.test(n.title))||before[0];
  return card('Through '+(cutoff?date(cutoff):'next expiry'),featured?row('Key event',featured.title)+'<p>Confirmed within the current protection window.</p>':empty('No confirmed event in this window'))+card('Confirmed calendar',events.length?table(['Date','Disclosure'],events.map(n=>[date(n.eventDate),n.title])):empty('No dated disclosures loaded'));
 }
 const observed=disclosures.map(n=>({n,text:n.title+' '+n.summary}));
 const backlogs=observed.map(({n,text})=>{
  const amount=/order book(?: position)?[^.;]{0,60}?(?:stood at|stands at|was|is at|of)\s*(?:Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*crore/i.exec(text);
  const asof=/as (?:on|at|of)\s+([A-Za-z]+\s+\d{1,2},?\s+20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i.exec(text);
  if(!amount||!asof)return null;
  const time=Date.parse(asof[1]+' 12:00:00 GMT+0530'),value=Number(amount[1].replace(/,/g,''));
  return Number.isFinite(time)&&time<=Date.now()&&value>0?{day:E.istDate(time),value,url:n.url}:null;
 }).filter(Boolean).sort((a,b)=>b.day.localeCompare(a.day));
 const known=[...backlogs,{day:'2026-03-31',value:254538.48,url:'https://hal-india.co.in/backend/eechoogn/2026/07/HAL_AR-2025-26.pdf'},{day:'2025-03-31',value:189302,url:'https://www.bseindia.com/xml-data/corpfiling/Attachhis/425a7379-6556-41a7-8edf-41b26574a53e.pdf'}].sort((a,b)=>b.day.localeCompare(a.day));
 const latest=known[0],prior=known.find(v=>v.day<latest.day);
 if(section==="pulse-model")return valuationCard(latest);
 const deliveries=observed.flatMap(({n,text})=>{
  const m=/(?:delivered|handed over)\s+(\d+)\s+(?:out of|of)\s+(\d+)\s+([^.;]{2,78})/i.exec(text),period=/\bFY\s*20\d{2}[-–]\d{2,4}/i.exec(text);
  return m&&period&&Number(m[2])>0?[[m[3],period[0],m[1]+' / '+m[2],pct(100*Number(m[1])/Number(m[2]))]]:[];
 });
 const delivery=section==='deliveries',re=delivery?/deliver|handover|production/i:/order|contract|backlog/i;
 return card(delivery?'Programme deliveries':'Reported order book',delivery?(deliveries.length?table(['Programme','Period','Delivered / target','Progress'],deliveries):'')+table(['Confirmed handover · 18 Sep 2026','Units'],[['Tejas FOC twin-seat trainer · IAF','2'],['HTT-40 · IAF','3'],['Dhruv NG · Pawan Hans','4']])+row('FY 2026–27 delivery targets','Not stated in this handover release')+btn('link','Official handover release','data-url="https://www.pib.gov.in/PressReleasePage.aspx?PRID=2312215"'):row(date(latest.day)+' · ₹ crore',num(latest.value))+row(date(prior.day)+' · ₹ crore',num(prior.value))+row('Change · ₹ crore',num(latest.value-prior.value))+btn('link','Latest reporting source','data-url="'+esc(latest.url)+'"')+btn('link','Prior reporting source','data-url="'+esc(prior.url)+'"'))+
 card(delivery?'Delivery disclosures':'Order awards and disclosures',articleCards(disclosures.filter(n=>re.test(n.title+' '+n.summary)),8));
}

const atlasTabs={
 today:[['position','overview','Overview'],['position','agenda','Agenda'],['position','changes','Since last review'],],
 portfolio:[['position','book','Open book'],['position','performance','Performance'],['position','break-even','Break-even'],['position','journal','Journal & funding'],['history','','Lifetime history']],
 plan:[['position','risk','Current protection'],['position','hedge','Find a hedge'],['position','one-lot','Replace one lot'],['position','saved-rolls','Saved comparisons'],['position','stress','Stress test'],['position','compare','Compare'],['technicals','lab','Options Lab']],
 research:[['position','brief','Market Brief'],['position','analysis','Daily Analysis'],['position','fno','F&O Desk'],['research','events','Company & Events'],['position','carry','Futures carry & rollover'],...researchDesks.company.slice(1,-2),['technicals','chain','Option chain'],['technicals','markets','Chart'],['technicals','indicators','Indicators'],['technicals','insights','Patterns'],['technicals','backtest','Backtest'],['research','news','News & filings'],['research','company','Company'],['ai','assistant','AI Desk'],['ai','coach','Skills coach']],
 settings:[['settings','','Settings']]
};
const atlasNames={today:'Today',portfolio:'Positions',plan:'Risk & Hedge',research:'Market & Research',settings:'Settings & Data'};
function blueprintDestination(){
 if(ui.screen==='technicals'||ui.screen==='position'&&['snapshot','carry','fno'].includes(ui.position))return 'market';
 if(['research','ai'].includes(ui.screen)||ui.screen==='position'&&['brief','analysis'].includes(ui.position))return 'research';
 return ui.screen==='settings'?'settings':'portfolio';
}
function currentAtlasRoute(){
 const sub=ui[ui.screen==='ai'?'aiPage':ui.screen];
 for(const [tab,routes] of Object.entries(atlasTabs)){
  const route=routes.find(([screen,key])=>screen===ui.screen&&(!key||key===sub));
  if(route)return {tab,route};
 }
 return null;
}
function atlasTab(){return currentAtlasRoute()?.tab||'today';}
function workspace(m,l,r){
 if(upgradeReview?.exists)return card('Installed portfolio',btn('review-installed','Review installed book'));
 const tab=atlasTab(),routes=atlasTabs[tab];
 const current=routes.find(([screen,key])=>screen===ui.screen&&(!key||key===ui[screen==='ai'?'aiPage':screen]));
 const name=ui.screen==='position'&&ui.position==='analysis'?'Daily Analysis':ui.screen==='position'&&ui.position==='snapshot'?'Market':ui.screen==='position'&&ui.position==='brief'?'Research':ui.screen==='position'&&ui.position==='book'?'Positions':ui.screen==='technicals'&&ui.technicals==='chain'?'F&O Desk':current?.[2]==='Overview'?'Today':current?.[2]||(ui.position==='risk'&&ui.screen==='position'?'Protection details':atlasNames[tab]);
 const heading='<div class="desk-heading"><h1>'+esc(name)+'</h1></div>';
 let view;
 if(ui.screen==='history')view=accountHistory();
 else if(ui.screen==='settings')view=settingsPage();
 else if(ui.screen==='position'){
   if(ui.position==='snapshot')view=marketSnapshot(m);
   else if(ui.position==='plot')view=portfolioPlot();
   else if(ui.position==='overview')view=analysisView.preview()+today(m,l,r);
   else if(ui.position==='analysis')view=analysisView.view();
   else if(ui.position==='book')view=positionsHome(l);
   else if(ui.position==='hedge')view=hedgeHome(m);
   else if(ui.position==='fno')view=deskView();
   else if(ui.position==='brief')view=analysisView.view()+'<details class="card"><summary>Company updates & source timeline</summary>'+developments()+'</details>'+'<details class="card"><summary>Market summary</summary>'+marketDigest(m)+'</details>';
   else if(ui.position==='carry')view=carryDesk(m);
   else if(ui.position==='changes')view=card('Since last review',changeView());
   else if(ui.position==='agenda')view=agendaView();
   else if(ui.position==='break-even')view=recoveryView.form();
   else if(tab==='plan'&&ui.position!=='risk'){ui.plan=ui.position;view=plan(m);}
   else view=position(m,l,r);
 }else if(ui.screen==='technicals')view=ui.technicals==='lab'?optionsLab.view():research(m,ui.technicals);
 else if(ui.screen==='ai')view=ui.aiPage==='coach'?card('Position review',reviews(I.coach(evidence()))):research(m,'ai');
 else view=researchDesks.company.some(([screen,key])=>screen==='research'&&key===ui.research)&&!['news','company'].includes(ui.research)?companyLanding(ui.research):research(m,ui.research);
 const links=[];
 if(ui.screen==='position'&&ui.position==='brief')links.push(['position','analysis','Daily Analysis'],['technicals','markets','Chart'],['technicals','chain','F&O Desk'],['research','events','Company & Events']);
 if(ui.screen==='position'&&ui.position==='performance')links.push(['position','break-even','Break-even estimates']);
 if(ui.screen==='technicals'&&ui.technicals==='markets')links.push(['technicals','insights','Explore history']);
 if(ui.screen==='technicals'&&ui.technicals==='insights')links.push(['technicals','backtest','Backtest']);
 if(ui.screen==='technicals'&&ui.technicals==='chain')links.push(['position','carry','Futures']);
 if(ui.screen==='position'&&ui.position==='carry')links.push(['technicals','chain','Options']);
 if(ui.screen==='position'&&ui.position==='risk')view=card('Manual margin',row('Latest snapshot',money(book.funding?.margin)))+view;
 
 const shortcuts='<div class="hub-links">'+links.map(x=>routeButton(...x)).join('')+'</div>';
 const brief=ui.screen==='position'&&ui.position==='brief';
 const home=ui.screen==='position'&&['overview','book','plot'].includes(ui.position);
 const directory=home||brief||ui.position==='snapshot'&&ui.screen==='position'?'<details class="card"><summary>More tools</summary>'+Object.entries(atlasTabs).filter(([k])=>home?['today','portfolio','plan'].includes(k):k==='research').flatMap(([,entries])=>entries.map(x=>routeButton(...x))).join('')+'</details>':'';
 return (home?portfolioHeader(m,l):heading)+(brief?'':shortcuts)+(ui.screen==='technicals'&&ui.technicals==='markets'?'<div id="nse-market-slot"></div>' :'')+view+directory+(brief?shortcuts:'')+(tab==='research'&&ui.screen!=='ai'?btn('context-ai','Ask AI · Explain this concept'):'');
}
function render(){if(!storageError){const previous=closingLog.at(-1);if(previous&&JSON.stringify(previous.legs)!==JSON.stringify(reviewMath.holdings(book.legs)))closingLog=[];rememberHoldings(book.legs);}inspectCandle=null;$('theme-toggle').textContent=document.body.classList.contains('light')?'☾':'☀︎';$('theme-toggle').setAttribute('aria-pressed',String(!document.body.classList.contains('light')));if(chart){const range=chart.timeScale().getVisibleRange();if(range&&activeChartPage)activeChartPage.range=range;chart.remove();chart=null;chartCandles=null;activeChartPage=null;}const m=market(),l=ledger(),r=risk();$('connection-state').textContent=configured?(s.loading?'Refreshing…':s.failure?'Check data':s.cached?'Cached':E.quoteQuality(m.spot).fresh?'Live':'Check data'):'Offline';$('session-state').textContent=m.status?.status?String(m.status.status).replace(/_/g,' '):'Market status unavailable';$('refresh').disabled=s.loading;$('notice').textContent=storageError?'Saved book could not be loaded. Existing records preserved. Open Settings → Recovery.':s.failure?D.message(s.failure)+' Previous observations remain visible.':'';$('notice').hidden=!$('notice').textContent;document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-current',b.dataset.screen===blueprintDestination()?'page':'false'));$('main').innerHTML=storageError&&['position','history'].includes(ui.screen)?intro('Saved book needs recovery','Existing records are preserved.')+card('Financial values withheld',empty('The saved book could not be validated','Recover the previous book before editing or valuing the portfolio.'),btn('recovery','Review recovery','class="text-button"')):workspace(m,l,r);if(ui.screen==='technicals'&&ui.technicals==='markets'&&!ui.reviewOpen)drawChart();}
function modal(title,html,label,fn){returnFocus=document.activeElement;$('modal-title').textContent=title;$('modal-body').innerHTML=html;$('modal-error').textContent='';$('modal-save').textContent=label||'Save';$('modal-save').hidden=!fn;saveModal=fn;$('modal').hidden=false;document.body.style.overflow='hidden';(title==='Menu'?$('modal-close'):($('modal-body').querySelector('input,select,textarea,button')||$('modal-close'))).focus();}
function closeModal(){$('modal-error').textContent='';$('modal').hidden=true;document.body.style.overflow='';saveModal=null;if(returnFocus?.isConnected)returnFocus.focus();}
function pickContract(){
 const contracts=market().contracts.filter(c=>['FUT','PE'].includes(c.type)&&c.instrumentKey&&c.lotSize>0);
 let type='FUT',expiry='';
 function fields(){
  const dates=[...new Set(contracts.filter(c=>c.type===type).map(c=>c.expiry))].sort();
  if(!dates.includes(expiry))expiry=dates[0]||'';
  const matches=contracts.filter(c=>c.type===type&&c.expiry===expiry).sort((a,b)=>a.strike-b.strike);
  return select('pick-type','Contract type',[['FUT','Future'],['PE','Put']],type)+
   (dates.length?select('pick-expiry','Expiry',dates.map(d=>[d,date(d)]),expiry):empty('No listed contracts available'))+
   (type==='PE'&&matches.length?select('pick-key','Strike',matches.map(c=>[c.instrumentKey,money(c.strike)]),matches[0].instrumentKey):'')+
   (matches.length?btn('contract-next','Continue'):'')+btn('contract-manual','Enter from broker records');
 }
 modal('Add position',fields(),'',null);
 function bind(){
  $('pick-type').onchange=e=>{type=e.target.value;expiry='';update();};
  if($('pick-expiry'))$('pick-expiry').onchange=e=>{expiry=e.target.value;update();};
 }
 function update(){$('modal-body').innerHTML=fields();bind();}
 bind();
}
function legEditor(id,selected){
 const old=book.legs.find(leg=>leg.id===id);
 const leg=old||{...selected,type:selected?.type||'FUT',lots:1};
 const listed=market().contracts.filter(contract=>['FUT','PE'].includes(contract.type));
 const savedOnly=leg.instrumentKey&&!listed.some(contract=>contract.instrumentKey===leg.instrumentKey);
 const choices=[
  ['',listed.length?'Enter contract manually':'Enter from broker records'],
  ...(savedOnly?[[leg.instrumentKey,'Saved contract · '+(leg.type==='FUT'?'HAL future':num(leg.strike,0)+' PE')+' · '+date(leg.expiry)]]:[]),
  ...listed.map(c=>[c.instrumentKey,(c.type==='FUT'?'Future':c.strike+' PE')+' · '+date(c.expiry)+' · '+c.lotSize+' units/lot'])
 ];
 const fields=(selected?row('Contract',(leg.type==='PE'?money(leg.strike)+' put':'HAL future')+' · '+date(leg.expiry))+row('Units per lot',num(leg.lotSize,0))+'<input type="hidden" id="leg-listed" value="'+esc(leg.instrumentKey)+'">':select('leg-listed','Contract',choices,leg.instrumentKey||''))+
  '<div id="leg-details">'+select('leg-type','Position type',[['FUT','Long future'],['PE','Long protective put']],leg.type)+
  input('leg-expiry','Expiry on broker record',leg.expiry,'date')+input('leg-strike','Put strike (₹)',leg.strike)+
  input('leg-size','Units per lot',leg.lotSize)+'</div>'+
  input('leg-lots','Number of lots',leg.lots)+input('leg-entry','Price paid per share (₹)',leg.entry)+
  input('leg-date','Trade date',old?(leg.tradeDate||''):E.istDate(),'date')+
  '<p id="leg-preview" aria-live="polite"></p><details><summary>More details</summary>'+
  input('entry-fee','Entry charges (₹)',old?.entryFee||0)+'<label>Trade note<textarea id="entry-note" maxlength="1000">'+esc(old?.tradeNote||'')+'</textarea></label></details>'+
  '<details '+(leg.manual!=null?'open':'')+'><summary>Manual price override</summary>'+
  input('leg-manual','Current price per share (₹)',leg.manual)+'<p>Leave blank to use a market quote when available.</p></details>';
 let priceEdited=false;
 modal(old?'Edit recorded position':'Record HAL position',fields,'Review position',()=>{
  const manual=value('leg-manual');
  const next={...leg,id:old?.id||'leg-'+Date.now(),type:text('leg-type'),expiry:text('leg-expiry'),
   strike:text('leg-type')==='PE'?value('leg-strike'):null,lots:value('leg-lots'),lotSize:value('leg-size'),
   entry:value('leg-entry'),manual,manualAt:manual==null?null:priceEdited||manual!==old?.manual?stamp():old.manualAt,
   instrumentKey:text('leg-listed')||null};
  if(next.type==='FUT'&&manual===0)throw Error('Futures price must be greater than zero. Clear the field to use a market quote.');
  next.tradeDate=text('leg-date')||null;
  if((!old&&!next.tradeDate)||(next.tradeDate&&(!E.validDate(next.tradeDate)||next.tradeDate>E.istDate()||next.tradeDate>next.expiry)))throw Error('Check the trade date against today and contract expiry.');
  next.entryFee=value('entry-fee')??0;next.tradeNote=text('entry-note').trim();
  if(next.entryFee<0)throw Error('Use non-negative entry charges.');
  E.validateLeg(next);
  const updated=clone(book);
  const feeId='entry-fee-'+next.id;
  if(next.entryFee!==old?.entryFee||next.tradeDate!==old?.tradeDate){
   updated.journal=updated.journal.filter(x=>x.id!==feeId);
   if(next.entryFee>0)updated.journal.push({id:feeId,kind:'fee',amount:next.entryFee,date:next.tradeDate,note:'Entry charges'});
  }
  const noteId='entry-note-'+next.id;updated.notes=updated.notes.filter(n=>n.id!==noteId);
  if(next.tradeNote)updated.notes.push({id:noteId,category:'Journal',title:'Trade note',date:next.tradeDate,text:next.tradeNote});
  if(old)updated.legs[updated.legs.findIndex(item=>item.id===old.id)]=next;
  else updated.legs.push(next);
  const expected=revision;
  modal('Review position',table(['Contract','Expiry','Lots × units','Total units','Entry'],[[next.type==='FUT'?'HAL future':money(next.strike)+' put',date(next.expiry),next.lots+' × '+next.lotSize,E.units(next),money(next.entry)]]),'Confirm position',()=>{
   if(revision!==expected)throw Error('Book changed. Reopen this position.');
   commit(updated);request('contracts','D',true);
  });
 });
 function clearPrice(){$('leg-manual').value='';priceEdited=true;}
 function showFields(){
  const quantity=value('leg-lots')*value('leg-size'),price=value('leg-entry');
  $('leg-preview').textContent=Number.isSafeInteger(quantity)&&quantity>0?num(quantity,0)+' units'+(text('leg-type')==='PE'&&price!=null?' · Total entry premium '+money(quantity*price):''):'';
  if(old&&price!==null){const mark=ledger().rows.find(x=>x.leg.id===old.id)?.mark.price;if(E.finite(mark))$('leg-preview').textContent+=' · Revised open P&L '+money((mark-price)*quantity);}
  $('leg-details').hidden=Boolean(text('leg-listed'));
  $('leg-strike').closest('label').hidden=text('leg-type')!=='PE';
 }
 $('leg-entry').oninput=$('leg-lots').oninput=showFields;
 $('leg-manual').oninput=()=>{priceEdited=true;};
 $('leg-listed').onchange=()=>{
  clearPrice();
  const contract=listed.find(c=>c.instrumentKey===text('leg-listed'))||(text('leg-listed')===leg.instrumentKey?leg:null);
  if(contract){
   $('leg-type').value=contract.type;
   $('leg-expiry').value=contract.expiry;
   $('leg-strike').value=contract.strike??'';
   $('leg-size').value=contract.lotSize;
  }
  showFields();
 };
 for(const field of ['leg-type','leg-expiry','leg-strike','leg-size']){
  $(field).oninput=()=>{clearPrice();showFields();};
 }
 showFields();
}
function recordRollover(id,target){
 const held=book.legs.find(x=>x.id===id),revisionAtOpen=revision;
 if(!held)throw Error('The original holding is no longer open.');
 const contracts=market().contracts.filter(c=>c.type===held.type&&c.expiry>held.expiry&&c.lotSize>0&&c.instrumentKey);
 if(target&&!contracts.some(c=>c.instrumentKey===target.instrumentKey)&&target.lotSize>0)contracts.push(target);
 if(!contracts.length)throw Error('Refresh the listed contracts or open a saved comparison with verified contract details.');
 const options=contracts.map(c=>[c.instrumentKey,date(c.expiry)+' · '+(c.type==='PE'?money(c.strike)+' put':'Future')+' · '+c.lotSize+' units/lot']);
 modal('Record completed rollover',select('roll-listed','Replacement contract',options,target?.instrumentKey||options[0][0])+input('roll-out','Old lots closed',1)+input('roll-in','New lots opened',1)+input('roll-exit','Actual exit per unit')+input('roll-entry','Actual entry per unit')+input('roll-fees','Combined charges',0)+input('roll-date','Fill date',E.istDate(),'date'),'Review fills',()=>{
  if(revision!==revisionAtOpen)throw Error('Book changed. Reopen the rollover.');
  const c=contracts.find(x=>x.instrumentKey===text('roll-listed')),day=text('roll-date'),out=value('roll-out'),fees=value('roll-fees');
  if(!c||day>held.expiry||held.tradeDate&&day<held.tradeDate)throw Error('Check fill date against the original holding.');
  const link='roll-'+Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-');
  const next=E.validateLeg({id:link+'-open',instrumentKey:c.instrumentKey,type:c.type,expiry:c.expiry,strike:c.strike,lots:value('roll-in'),lotSize:c.lotSize,entry:value('roll-entry'),tradeDate:day,tradeNote:link});
  const exit=value('roll-exit'),result=E.closeLeg(book,id,out,exit,fees,day,{id:link+'-close',note:'Rollover to '+next.id});
  result.legs.push(next);
  modal('Confirm actual fills',table(['','Closed','Opened'],[['Expiry',date(held.expiry),date(next.expiry)],['Strike',money(held.strike),money(next.strike)],['Lots',out,next.lots],['Units',out*held.lotSize,E.units(next)],['Actual price',money(exit),money(next.entry)]])+row('Old lots remaining',held.lots-out)+row('Combined charges',money(fees)),'Record rollover',()=>{
   if(revision!==revisionAtOpen)throw Error('Book changed. Review the rollover again.');
   commit(result);toast('Rollover recorded.');
  });
 });
}
function closeLeg(id){const l=book.legs.find(l=>l.id===id);modal('Record completed close',`<p>Record a trade or settlement already completed with your broker. This updates your local journal only.</p><div class="form-grid">${input('close-lots','Lots closed',l.lots)}${input('close-exit','Actual exit price (₹)','')}${input('close-fees','Total charges (₹)',0)}${input('close-date','Completed trade date',E.istDate(),'date')}</div><label>Private memo<textarea id="close-note" maxlength="1000"></textarea></label>`,'Record close',()=>commit(E.closeLeg(book,id,value('close-lots'),value('close-exit'),value('close-fees'),text('close-date'),{note:text('close-note')})));}
function confirmBook(){if(!book.legs.length)throw Error('Record your actual holdings first.');modal('Confirm against your broker',table(['Contract','Expiry','Lots × units','Entry'],book.legs.map(l=>[l.type==='FUT'?'Future':l.strike+' PE',date(l.expiry),l.lots+' × '+l.lotSize,money(l.entry)]))+`<label><input type="checkbox" id="confirm-check">I have checked every open leg and completed close against my broker records.</label>`,'Confirm',()=>{if(!$('confirm-check').checked)throw Error('Check the broker confirmation before saving.');const b=clone(book);b.riskProfile.confirmedAt=stamp();b.riskProfile.confirmedBook=I.confirmationFingerprint(b);if(b.migration)b.migration.reviewRequired=false;commit(b);});}
function cashEntry(){modal('Record cost or cash',select('cash-kind','Record type',[['fee','Additional transaction / funding cost'],['settlement','Futures settlement cash'],['funding','Funding deposit / withdrawal']],'fee')+input('cash-amount','Amount · cash credits + / debits −')+input('cash-date','Completed date',E.istDate(),'date')+'<label>Private memo<textarea id="cash-note" maxlength="1000"></textarea></label><p class="fine">Costs are deducted once. Settlement and funding cash are separate from investment profit.</p>','Save',()=>commit(E.recordCash(book,text('cash-kind'),value('cash-amount'),text('cash-date'),text('cash-note'))));}
function editJournal(id){const j=book.journal.find(j=>j.id===id);modal('Correct a journal record','<p class="fine">Correct price, charges or memo. Contract quantities and the open book are not silently reversed.</p>'+input('journal-date','Date',j.date,'date')+(j.kind==='close'?input('journal-exit','Actual exit',j.exit)+input('journal-fees','Charges',j.fees):input('journal-amount','Amount',j.amount))+`<label>Private memo<textarea id="journal-note" maxlength="1000">${esc(j.note)}</textarea></label><output id="correction-preview"></output>`,'Save correction',()=>{const b=clone(book),x=b.journal.find(x=>x.id===id);x.date=text('journal-date');if(x.date>E.istDate())throw Error('Completed date cannot be in the future.');x.note=text('journal-note');if(x.kind==='close'){x.exit=value('journal-exit');x.fees=value('journal-fees');if(x.leg.type==='FUT'&&x.exit===0)throw Error('A futures broker execution price must be positive.');}else x.amount=value('journal-amount');commit(b);});
 if(j.kind==='close'){const preview=()=>{const exit=value('journal-exit'),fees=value('journal-fees');$('correction-preview').textContent='Revised realised P&L after close charges · '+money(exit!==null&&fees!==null?(exit-j.leg.entry)*E.units(j.leg)-fees:null);};
 $('journal-exit').oninput=$('journal-fees').oninput=preview;preview();}}
function funding(){modal('Manual funding snapshot',input('fund-margin','Current margin recorded (₹)',book.funding.margin)+input('fund-free','Available funds recorded (₹)',book.funding.free)+'<p class="fine">Timestamped now. This is your manual observation; the app does not access broker funds.</p>','Save snapshot',()=>{const margin=value('fund-margin'),free=value('fund-free');if(margin===null||free===null||margin<0||free<0)throw Error('Enter both non-negative balances.');commit({...book,funding:{margin,free,at:stamp()},notes:[...book.notes,{id:'margin-'+Date.now(),category:'Margin snapshot',title:'Margin snapshot',date:E.istDate(),text:'Margin '+money(margin)+' · Available '+money(free)}]});});}
function limits(){const fields={coverageBelow:'Alert below put coverage (%)',capital:'Allocated capital',maxLoss:'Strategy loss review threshold',hedgeBudget:'Hedge budget',reserve:'Minimum cash reserve',reviewBelow:'Review below spot',reviewAbove:'Review above spot',rsiBelow:'Review below daily RSI',rsiAbove:'Review above daily RSI',expiryReviewDays:'Review held expiry within (days)'};modal('Personal risk limits','<div class="form-grid">'+Object.entries(fields).map(([k,v])=>input('limit-'+k,k.startsWith('rsi')||k==='expiryReviewDays'||k==='coverageBelow'?v:v+' (₹)',book.riskProfile[k])).join('')+'</div><p class="fine">Review thresholds, not automatic stops or guaranteed loss limits.</p>','Save',()=>{const b=clone(book);for(const k of Object.keys(fields))b.riskProfile[k]=value('limit-'+k);commit(b);});}
function noteEditor(id,filing){const n=book.notes.find(n=>n.id===id)||{title:filing?.title||'',text:'',date:E.istDate(),category:'Other',url:filing?.url||'',eventDate:''};modal(filing?'Add filing date to agenda':'Business note',input('note-title','Title',n.title,'text')+`<label>Private business note<textarea id="note-text" maxlength="3000">${esc(n.text)}</textarea></label>`+select('note-category','Category',['Order book','Deliveries','Guidance','Results','Operations','Other'].map(x=>[x,x]),n.category)+input('note-url','Verified source HTTPS URL',n.url,'url')+input('note-event',filing?'Event date in disclosure':'Event date · optional',n.eventDate,'date'),'Save note',()=>{if(filing&&!E.validDate(text('note-event')))throw Error('Enter the event date stated in the disclosure.');if(!text('note-title').trim())throw Error('Enter a title.');if(text('note-url')&&!E.safeURL(text('note-url')))throw Error('Use a valid HTTPS source link.');const next={...n,id:n.id||'note-'+Date.now(),date:E.istDate(),title:text('note-title'),text:text('note-text'),category:text('note-category'),url:text('note-url'),eventDate:text('note-event')||null},b=clone(book);if(n.id)b.notes=b.notes.map(x=>x.id===n.id?next:x);else b.notes.push(next);commit(b);});}
function importPreview(raw){
 if(storageError)throw Error('Recover the current saved book before importing a replacement.');
 const b=D.previewImport(raw),impact=M5.replacement(book,b),reviewedRevision=revision;
 const diff=impact.changes.filter(x=>x.removed||x.modified);
 const notice=impact.destructive?
  '<p class="warning">This replacement would remove or change existing records. Review the lost or modified entries before replacing the book.</p>':
  '<p class="fine">No existing records are identified as removed or modified. This still replaces the complete book.</p>';
 modal('Confirm restore',row('Backup date',when(raw?.exportedAt))+table(['Records','Current','Backup'],[['Open contracts',book.legs.length,b.legs.length],['History entries',historyCount(book),historyCount(b)]])+'<details><summary>Full comparison</summary>'+
  '<p class="fine">BACKUP REPLACEMENT · not a merge. The saved book is unchanged until storage confirms your replacement. A previous-book recovery copy is retained.</p>'+
  table(['Record category','Current','Backup','Removed','Changed'],impact.changes.map(x=>[
    x.section,num(x.before,0),num(x.after,0),num(x.removed,0),num(x.modified,0)]))+
  row('Current booked gross P&L',money(impact.current.realizedGross))+
  row('Incoming booked gross P&L',money(impact.incoming.realizedGross))+
  row('Current recorded charges',money(impact.current.recordedCharges))+
  row('Incoming recorded charges',money(impact.incoming.recordedCharges))+
  row('Current booked net',money(impact.current.bookedNet))+
  row('Incoming booked net',money(impact.incoming.bookedNet))+
  notice+'</details>'+
  (impact.warnings.length?reviews(impact.warnings.map(detail=>({title:'Replacement impact',detail}))):'')+
  '<p class="fine">Credentials are never imported. Any prior book confirmation must be reverified against the broker after import. A previous-book recovery copy is not a substitute for your own backup.</p>'+
  (impact.requiresTypedConfirmation?'<label>Type REPLACE to authorize loss of existing records<input id="import-phrase" type="text" autocomplete="off" autocapitalize="characters"></label>':'')+
  '<label><input id="import-confirm" type="checkbox">I have reviewed the changes and authorize replacing the saved book.</label>',
  'Replace book',()=>{
   if(revision!==reviewedRevision)throw Error('The saved book changed while this import was open. Review the backup again.');
   if(!$('import-confirm').checked)throw Error('Confirm the reviewed replacement.');
   if(impact.requiresTypedConfirmation&&text('import-phrase').trim()!=='REPLACE')
    throw Error('Type REPLACE exactly to confirm loss or changes to existing records.');
   commit(b);ui.hedgeDraft=null;toast('Backup imported. Reconcile restored entries against broker records.');
  });
}
function recovery(){let r;const reviewedRevision=revision;if(N?.previousBook){r=JSON.parse(N.previousBook());if(!r.ok)throw Error(r.message);if(!r.book)throw Error('No previous-book recovery copy exists.');}else{const raw=localStorage.getItem('hal_previous_v4')||localStorage.getItem('hal_before_import_v2');if(!raw)throw Error('No recovery copy exists.');r={book:JSON.parse(raw)};}const b=E.validateBook(r.book);modal('Previous-book recovery',`<p>Restore ${b.legs.length} open legs and ${b.journal.length} journal records from the previous saved book.</p><p>The current native bytes are retained in a recovery quarantine when supported. Legacy WebView storage is not erased.</p>`,'Restore previous book',()=>{if(N?.restorePreviousBook){const x=JSON.parse(N.restorePreviousBook(reviewedRevision));if(!x.ok)throw Error(x.message);book=E.validateBook(x.book);revision=x.revision;storageError='';ui.ai=null;invalidateCalculations();ui.hedgeDraft=null;ui.pattern=null;if(ui.pendingAI)native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;theme();render();}else{storageError='';commit(b);}});}
function settings(){navigate('settings');}
function settingsPage(){
 const prefs=ui.settingsDraft||book.preferences;
 const connections=card('Data connections',row('Upstox',configured?'Connected · read-only':'Analytics token required')+
  row('Gemini',ui.aiConfigured?'Configured':'Optional · disabled')+
  '<div class="toolbar">'+btn('connection','Upstox connection')+btn('token-page','Get Analytics Token')+btn('ai-settings','Gemini settings')+(N?.briefingSettings?btn('briefing-settings','Automatic story briefings'):'')+btn('health','Data health')+'</div>');
 const appearance=card('Preferences','<div class="form-grid">'+select('theme','Appearance',[['dark','Dark'],['light','Light'],['system','Follow device']],prefs.theme)+
  select('mark-mode','Put valuation marks',[['ltp','Last traded price'],['bid','Quoted bid']],prefs.markMode)+'</div>'+
  `<label><input id="auto-refresh" type="checkbox" ${prefs.auto?'checked':''}>Refresh about once a minute while the app is open</label>`+
  btn('save-workspace-preferences','Save preferences','class="primary"'));
 const backups=card('Backup & recovery','<div class="toolbar">'+btn('export','Back up')+btn('import','Restore')+btn('recovery','Previous book')+'</div>');
 return connections+appearance+backups;
}
function readWorkspacePreferences(){
 return {theme:text('theme'),markMode:text('mark-mode'),auto:$('auto-refresh').checked};
}
function saveWorkspacePreferences(){
 const preferences=readWorkspacePreferences();
 ui.settingsDraft=null;
 commit({...book,preferences});
 toast('Preferences saved');
}
function toggleWorkspaceTheme(){
 const theme=document.body.classList.contains('light')?'dark':'light';
 if(ui.settingsDraft)ui.settingsDraft.theme=theme;
 commit({...book,preferences:{...book.preferences,theme}});
}
function v5DataQualityPanel(a){
 if(!a)return '<p class="fine">No normalized market quality report available.</p>';
 const warnings=a.problems||[];
 return '<h3>Market data integrity</h3>'+
  '<p class="fine">Independent provider and exchange clocks are never replaced by HTTP retrieval time. Cache observations cannot become streaming valuation marks. Quality counts overlap and are not a number of affected positions.</p>'+
  row('Quotes observed (including HAL spot)',num(a.total,0))+
  row('Missing or invalid prices',num(a.missingPrice,0))+
  row('Provider quote clocks missing',num(a.missingProviderTime,0))+
  row('Exchange trade clocks missing',num(a.missingTradeTime,0))+
  row('Cached quotes',num(a.cached,0))+
  row('Quotes older than 2 minutes',num(a.stale,0))+
  row('Future-dated clocks',num(a.futureClock,0))+
  row('Provider/provenance failures',num(a.provenanceFailures,0))+
  row('Conflicting contract identities',num(a.contractConflicts,0))+
  (warnings.length?table(['Instrument','Reason'],warnings.map(x=>[x.instrument,x.issue])):
    '<p class="fine">No explicit provider conflicts detected in loaded observations; quote quality still requires individual inspection.</p>')+
  '<p class="fine">A contradictory contract or same-clock traded price is unavailable for portfolio valuation until a valid subsequent observation resolves it.</p>';
}
function health(){
 const m=market(),quality=v5DataQualityPanel(m.dataQuality),warnings=s.health.market?.integrityWarnings||[];
 modal('Connection details',row('Market session',market().status?.status||'Unavailable')+row('Last successful refresh',when(s.lastSuccess))+btn('retry-data','Retry')+quality+
  (warnings.length?'<h3>Latest refresh continuity notices</h3>'+table(['Instrument','Issue'],warnings.map(x=>[x.instrument,x.detail])):'')+
  ((s.integrityHistory||[]).length?'<h3>Recent integrity incidents (up to 25)</h3>'+table(['Observed','Instrument','Issue'],s.integrityHistory.slice().reverse().map(x=>[when(x.at),x.instrument,x.detail])):'')+
  Object.entries(s.health).map(([k,h])=>
   `<div class="health-row"><div><strong>${esc(k)}</strong><small>Success ${when(h.lastSuccess)}<br>Failure ${when(h.lastFailure)}</small><small>${esc(h.error?D.message(h.error):'')}</small></div>${badge(h.pending?'Loading':h.error?'Needs review':h.lastSuccess?'Retrieved':'Unavailable',h.error?'stale':'')}</div>`).join(''),null,null);
}
function scenarioParams(){const p=ui.scenario;return {spot:E.value(p.spot)??market().spot.price,horizon:p.horizon||undefined,fallbackIV:E.value(p.iv),ivShift:E.value(p.shift),rate:E.value(p.rate),dividend:E.value(p.dividend),basis:p.basis,baseSpot:E.value(p.base)};}
function readScenario(){for(const [k,id]of Object.entries({spot:'spot',horizon:'horizon',iv:'iv',shift:'shift',rate:'rate',dividend:'dividend',basis:'basis',base:'base'}))if($('sc-'+id))ui.scenario[k]=text('sc-'+id);}
function hedgeSettings(){return E.hedgePreferences({budget:value('hg-budget'),maxLoss:value('hg-loss'),protectThrough:text('hg-through')||null,maxSpread:value('hg-spread'),buyFees:value('hg-buy'),exitFees:value('hg-exit'),slippage:value('hg-slip'),ivShift:value('hg-iv'),fallbackIV:value('hg-iv-assumption'),rate:value('hg-rate'),dividend:value('hg-dividend'),minVolume:value('hg-volume'),minOI:value('hg-oi')});}
function compareHedge(id){
 const c=ui.hedges?.candidates?.find(c=>c.contract.instrumentKey===id);if(!c)return;
 const audit=H5.auditHedge(book,ui.hedges,id,book.hedge.protectThrough);
 modal('Current protection vs replacement',
  '<h3>'+esc(c.contract.strike)+' PE · '+date(c.contract.expiry)+' · '+esc(c.lots)+' lots</h3>'+
  row('Futures quantity covered',num(audit.contract.units,0)+' shares · '+num(audit.contract.lots,0)+' candidate lots')+
  row('Candidate put expires',date(audit.contract.expiry))+
  row('Latest futures expiry',date(audit.latestFutureExpiry))+
  (audit.coverageGapAfter?'<p class="warning fine">Replacement protection ends on '+esc(date(audit.coverageGapAfter))+' before the latest futures expiry. A hedge gap remains.</p>':'')+
  (audit.putContinuesAfterFutures?'<p class="warning fine">The replacement put lasts beyond the latest futures expiry and may become a separate unhedged position.</p>':'')+
  row('Gross new purchase incl. buy fees',money(audit.accounting.grossPurchase))+
  row('Old-put sale proceeds',money(audit.accounting.oldPutSaleProceeds))+
  row('Old-put exit fees',money(audit.accounting.additionalExitFees))+
  row('Indicative net cash required (+) / released (−)',money(audit.accounting.netCashRequired))+
  row('Old-put sale slippage',money(audit.accounting.existingExitSlippage))+
  row('Worst additional loss in sampled shocks',money(audit.accounting.sampledWorstLoss))+
  row('Scenario IV source',audit.accounting.modelIVSource==='user-assumed'?'Explicit user-assumed IV · not verified Greeks':audit.accounting.modelIVSource)+
  row('Comparable scenarios',audit.comparable+' of '+audit.comparisons.length)+
  table(['Horizon','Shock','Current ΔP&L','Replacement ΔP&L','Difference'],
   audit.comparisons.map(x=>[when(x.horizon),pct(x.shock*100),money(x.existingAdditionalPnl),
    money(x.replacementAdditionalPnl),money(x.replacementMinusExisting)]))+
  (audit.unavailable?'<details><summary>Why some comparisons are unavailable</summary>'+
    table(['Horizon','Reason'],audit.comparisons.filter(x=>x.reason).map(x=>[when(x.horizon),x.reason]))+'</details>':'')+
  '<details><summary>Pricing and settlement limitations</summary>'+
   audit.assumptions.map(x=>'<p class="fine">'+esc(x)+'</p>').join('')+'</details>',
  null,null);
}
function aiReview(context){if(storageError&&(context?.mode||ui.aiMode)!=='research')throw Error('Recover the saved book before sharing position evidence.');if(context?.question){ui.question=context.question;ui.aiMode=context.mode;ui.share=context.mode!=='research';}else{ui.question=text('ai-question');ui.share=$('ai-share').checked;}const input=evidence();
 if(!context&&ui.aiSelection?.technical)input.technical=ui.aiSelection.technical;
 if(context?.news)input.news=context.news;const packet=I.evidencePacket(input,{mode:ui.aiMode,includePortfolio:ui.share}),question=ui.question;
 if(!context&&packet.portfolioIncluded&&ui.aiSelection?.id){
  const l=book.legs.find(x=>x.id===ui.aiSelection.id);if(!l)throw Error('The selected contract has changed. Reopen it from Positions.');
  packet.selectedContract={type:l.type,expiry:l.expiry,strike:l.strike,lots:l.lots,lotSize:l.lotSize,entry:l.entry,instrumentKey:l.instrumentKey};
 }
 if(!question.trim())throw Error('Enter a question.');modal('Review evidence sent to Gemini',`<p>${packet.portfolioIncluded?'Includes the shown positions, valuations, risk and funding snapshot.':'Your portfolio is excluded.'} Private journal memos, credentials and private notes are excluded.</p><p class="fine">Provider API charges or quota limits may apply. Evidence timestamp ${when(packet.generatedAt)}.</p><pre>${esc(JSON.stringify({question,evidence:packet},null,2))}</pre><label><input id="ai-consent" type="checkbox">Send this question and exact evidence to Google Gemini.</label>`,'Send to Gemini',()=>{if(!$('ai-consent').checked)throw Error('Explicit evidence-sharing consent is required.');const id='review-'+Date.now();ui.aiError='';ui.ai=null;ui.pendingAI={id,evidence:packet};native('ai',JSON.stringify({id,mode:ui.aiMode,message:question,evidence:packet,consent:true}));ui.screen='ai';ui.aiPage='assistant';render();});}

function quickScenario(kind){
 if(!book.legs.length)throw Error('Record your actual open position before modelling.');
 const m=market();if(!E.finite(m.spot.price))throw Error('Refresh HAL prices or enter a scenario price in Plan.');
 readScenario();ui.scenario.spot=m.spot.price*(kind==='fall'?.95:1);ui.scenario.horizon='';
 if(kind==='expiry'){
  const puts=book.legs.filter(l=>l.type==='PE'&&E.expiryTime(l.expiry)>=Date.now()).sort((a,b)=>a.expiry.localeCompare(b.expiry));
  if(!puts.length)throw Error('No active put expiry to explore. Add your actual protection first.');
  ui.scenario.horizon=puts[0].expiry;
 }
 ui.screen='position';ui.position='stress';ui.plan='stress';ui.result=E.scenario(book,m,scenarioParams());ui.resultAt=stamp();ui.reduction=null;
 if(!ui.result.complete)ui.advanced=true;render();window.scrollTo(0,0);
}
function tryInPaper(){
 const legs=window.HALOptionsLab.actualCopy(book);
 if(!legs.length)throw Error('Record a futures or put position before making a paper copy.');
 function openCopy(){
   optionsLab.loadStrategy(legs,{fresh:true});
   navigate('technicals','lab');
 }
 if(optionsLab.getDraft().legs.length){
   modal('Replace current PAPER workspace?',
    '<p>The copied holdings will replace the legs in the builder. Saved paper strategies remain available in the journal.</p>',
    'Use portfolio copy',openCopy);
 }else openCopy();
}
function reviewInstalled(){
 if(!upgradeReview?.exists)return;
 modal('Review installed HAL book',table(['Holding','Expiry','Units'],book.legs.map(l=>[l.type==='FUT'?'Future':money(l.strike)+' put',date(l.expiry),E.units(l)]))+row('Completed closes',book.journal.filter(j=>j.kind==='close').length)+row('Journal entries',book.journal.length),'Use installed book',()=>{
  const saved=D.saveBook(N,localStorage,book,revision);book=saved.book;revision=saved.revision;
  localStorage.setItem('atlas.blueprint.reviewed.v1','1');upgradeReview=null;render();
 });
}
document.addEventListener('change',e=>{if(e.target.id==='blueprint-expiry'){ui.expiry=e.target.value;request('hedges',ui.expiry,true);render();}});
const actions={
 'market-put':b=>{const c=market().contracts.find(x=>x.instrumentKey===b.dataset.id);if(!c)return;
 const owned=book.legs.find(x=>x.type==='PE'&&x.expiry<c.expiry);
 if(!owned){toast('A saved put with an earlier expiry is needed for a rollover comparison.');return;}
 Object.assign(oneLot,{owned:owned.id,expiry:c.expiry,candidate:c.instrumentKey,savedSettings:null});navigate('position','one-lot');},
 'record-displayed':()=>{if(displayedRoll)recordRollover(displayedRoll.owned.id,displayedRoll.candidate);},

 'review-installed':reviewInstalled,
 'record-roll':b=>recordRollover(b.dataset.id),
 'record-plan':b=>{const plan=readRolls().find(r=>r.id===b.dataset.id);if(plan)recordRollover(plan.owned.id,{...plan.candidate,type:'PE',lotSize:plan.candidate.lotSize||plan.result.buy.lotSize});},
 'story-detail':b=>{const n=news().find(x=>x.url===b.dataset.url);if(n)modal(n.title,card('Reported facts',row('Published',when(n.publishedAt))+'<p>'+esc(n.summary||n.title)+'</p>'+btn('link','Original source','data-url="'+esc(n.url)+'"'))+card('Observed market reaction',reactionView(n))+briefingPanel(n)+btn('story-position','Explain for my position','data-url="'+esc(n.url)+'"'),'',null);},
 'story-position':b=>{const n=news().find(x=>x.url===b.dataset.url);if(n)aiReview({mode:'copilot',question:'Explain how this publication relates to my current HAL position. Separate reported facts from interpretation.',news:[n]});},
 'briefing-settings':()=>native('briefingSettings'),

 'compare-filings':b=>{
  const n=news().find(x=>x.url===b.dataset.url);if(!n)return;
  const topic=t=>/shareholding/i.test(t)?'ownership':/results|earnings/i.test(t)?'results':/contract|order|award/i.test(t)?'orders':/deliver|handover/i.test(t)?'deliveries':null;
  const group=topic(n.title),prior=group&&news().find(x=>x.official&&topic(x.title)===group&&Date.parse(x.publishedAt)<Date.parse(n.publishedAt)&&x.url!==n.url);
  modal('Compare filings',prior?table(['Disclosure','Current','Previous'],[['Published',date(E.istDate(Date.parse(n.publishedAt))),date(E.istDate(Date.parse(prior.publishedAt)))],['Period',filingQuarter(n)||'Unspecified',filingQuarter(prior)||'Unspecified'],['Title',n.title,prior.title],['Excerpt',n.summary||'Unavailable',prior.summary||'Unavailable']])+btn('explain-news','Ask AI about the changes','data-url="'+esc(n.url)+'"'):empty('No comparable prior filing in the loaded timeline'),'',null);
 },

 'contract-manual':()=>{closeModal();legEditor();},
 'contract-next':()=>{const type=text('pick-type'),expiry=text('pick-expiry'),key=type==='PE'?text('pick-key'):null;
 const matches=market().contracts.filter(c=>c.type===type&&c.expiry===expiry&&(!key||c.instrumentKey===key));
 if(matches.length!==1)throw Error('Select an unambiguous listed contract.');closeModal();legEditor(null,matches[0]);},
 'stress-roll':b=>{ui.testRoll={id:b.dataset.held,target:b.dataset.expiry,strike:Number(b.dataset.strike)};ui.scenario.horizon=book.legs.map(l=>l.expiry).sort()[0];ui.result=null;navigate('position','stress');},
 'save-stress-roll':()=>{
  const c=ui.testRoll;if(!c)return;const m=market(),leg=book.legs.find(l=>l.id===c.id),horizon=ui.scenario.horizon||book.legs.map(l=>l.expiry).sort()[0];
  const settings=E.hedgePreferences(book.hedge),r=H5.compareBasket(book,m,c.id,c.target,c.strike,false,settings,Date.now(),[],{oneLot:true,horizon});
  if(r.cash===null)throw Error('Refresh the contract quotes before saving.');
  const quotes={};for(const o of r.orders)quotes[o.key]=m.quotes[o.key];
  deskSave({id:c.id,all:false,target:c.target,expiry:leg.expiry,horizon,oneLot:true,strike:leg.strike,at:stamp(),settings,rows:[r],quotes,spot:m.spot,legs:clone(book.legs),bookKey:I.confirmationFingerprint(book),custom:[]},c.strike);
 },
 'end-roll':()=>{ui.testRoll=null;render();},
 'chart-display':b=>{ui[b.dataset.id]=!ui[b.dataset.id];render();},

 'trade-note':()=>modal('Journal note',input('trade-note-date','Date',E.istDate(),'date')+'<label>Note<textarea id="trade-note-body"></textarea></label>','Save',()=>{const note=text('trade-note-body').trim(),day=text('trade-note-date');if(!note||!E.validDate(day))throw Error('Enter a note and date.');commit({...book,notes:[...book.notes,{id:'journal-'+Date.now(),category:'Journal',title:'Journal note',date:day,text:note}]});}),
 'history-export':()=>{const k=ui.historyFilter||'all',match=j=>k==='all'||k==='notes'&&j.note||k==='funding'&&['settlement','funding'].includes(j.kind)||j.kind===k;let csv=E.journalCSV({...book,journal:book.journal.filter(match),legacy:null});
 for(const n of book.notes.filter(n=>n.category==='Journal'&&(k==='notes'||k==='all')||n.category==='Margin snapshot'&&(k==='funding'||k==='all')))csv+='\r\n'+[n.id,n.category,n.date,...Array(10).fill(''),n.text].map(E.csvCell).join(',');
 native('exportCSV',csv);},

 'full-chain':()=>{ui.fullChain=!ui.fullChain;render();}, 'retry-data':()=>{closeModal();refresh();},
 'pick-hedge':b=>{ui.hedgeHeld=b.dataset.id;ui.rollTarget='';navigate('position','hedge');},
 'roll-more':()=>{ui.allRolls=!ui.allRolls;render();},
 'load-roll':()=>{refresh();if(text('roll-target'))request('hedges',text('roll-target'),true);},
 'pick-details':()=>{const id=text('roll-held'),target=text('roll-target');if(id){deskStart(id);if(target&&desk.target!==target){desk.target=target;deskCapture();render();}}},

 'filing-chart':b=>{ui.frame='D';const bar=researchBars().find(x=>E.istDate(x.t)===b.dataset.id);if(bar){chartPage().time=bar.t;ui.filingMarker=bar.t;}navigate('technicals','markets');},
 'filing-evidence':b=>{const n=news().find(x=>x.url===b.dataset.url);if(n)modal(n.title,companyEvidence(n),'',null);},

 'browse-desk':b=>showDeskTools(b.dataset.id),'fin-years':()=>{ui.finYears=!ui.finYears;render();},
 'entry-overlay':()=>{ui.futureOverlay=!ui.futureOverlay;render();},
 'context-ai':b=>{
  const leg=b.dataset.id&&book.legs.find(l=>l.id===b.dataset.id);
  const position=!!leg||ui.screen==='position'&&ui.position==='book';
  ui.aiMode=position?'copilot':'research';ui.share=position;ui.aiSelection=null;
  if(leg){ui.aiSelection={id:leg.id};ui.question='Explain this selected HAL contract and its contribution to my position.';}
  else if(position)ui.question='Explain my open HAL position and its protection.';
  else if(ui.screen==='technicals'&&['markets','indicators','insights','backtest'].includes(ui.technicals)){
   const frame=ui.technicals==='markets'?ui.frame:'D',t=researchTechnical(frame);
   const bar=t.rows.find(r=>r.t===chartPage().time)||t.rows.at(-1);
   ui.aiSelection={technical:t};
   ui.question='Explain the HAL '+ui.technicals+' view on the '+frame+' interval.'+(bar?' Selected candle '+when(new Date(bar.t).toISOString())+' IST: open '+money(bar.o)+', high '+money(bar.h)+', low '+money(bar.l)+', close '+money(bar.c)+', volume '+num(bar.v,0)+'.':' No completed candle is available.');
  }else if(ui.screen==='technicals'&&ui.technicals==='chain'){
   ui.question='Explain HAL '+(ui.side==='PE'?'puts':'calls')+' for expiry '+ui.expiry+' and how to interpret their bid and ask.';
  }else{
   const sub=ui[ui.screen==='ai'?'aiPage':ui.screen],item=currentAtlasRoute()?.route;
   ui.question='Explain '+(item?.[2]||sub||'HAL research')+' for HAL using the available evidence.';
  }
  navigate('ai','assistant');
 },

 'desk-options':()=>{
  const v=desk.snapshot;
  const dates=[...new Set([v.target,...(s.snapshot?.available_expiries||[]),...market().contracts.filter(c=>c.type==='PE').map(c=>c.expiry)])].filter(d=>E.validDate(d)&&d>v.expiry).sort();
  modal('Rollover assumptions',select('basket-date','Replacement expiry',dates.map(d=>[d,date(d)]),v.target)+
   input('basket-buffer','Extra slippage per side (%)',desk.buffer)+input('basket-prices','Additional HAL prices (₹, comma-separated)',desk.custom.join(', '),'text'),'Apply',()=>{
   const raw=text('basket-prices').trim(),prices=raw?raw.split(',').map(x=>Number(x.trim())):[];
   const buffer=value('basket-buffer');
   if(buffer==null||buffer<0||buffer>10||prices.length>8||prices.some(x=>!Number.isFinite(x)||x<=0))throw Error('Use up to eight positive prices and a buffer from 0 to 10%.');
   desk.target=text('basket-date');desk.buffer=buffer;desk.custom=prices;desk.snapshot=null;desk.pending=null;deskCapture();render();if(!deskComplete(desk.snapshot))deskRefresh();
  });
 },
 'desk-home':()=>{desk.id='';desk.pending=null;desk.snapshot=null;desk.baseline=null;desk.message='';render();},
 'desk-start':b=>deskStart(b.dataset.id),'desk-chain':()=>navigate('technicals','chain'),
 'desk-refresh':()=>{if(desk.baseline&&desk.baseline.bookKey!==I.confirmationFingerprint(book))throw Error('The recorded book changed since this comparison.');deskRefresh();},
 'desk-save':()=>deskSave(),'desk-history':deskSaved,
 'desk-open':b=>{const v=deskHistory().find(x=>x.savedId===b.dataset.id);if(!v)return;closeModal();ui.screen='position';ui.position='fno';Object.assign(desk,{id:v.id,all:v.all,selected:v.selected,snapshot:v,baseline:v,pending:null,message:'Saved comparison · Refresh to compare with latest'});render();},
 'desk-all':()=>{const id=desk.id;if(!book.legs.some(l=>l.id===id))throw Error('Original holding unavailable.');desk.all=!desk.all;desk.baseline=null;desk.pending=null;desk.snapshot=null;deskCapture();render();},
 'desk-strike':b=>{desk.selected=Number(b.dataset.id);render();},
'save-workspace-preferences':saveWorkspacePreferences,'go-history':()=>navigate('history'),'go-ai':()=>navigate('ai','assistant'),'open-futures-sizing':openFuturesSizing,'calculate-futures-sizing':calculateFuturesSizing,'chart-mode':b=>{chartPage().mode=b.dataset.id;render();},'chart-step':b=>inspectCandle?.(chartPage().time,Number(b.dataset.id)),'agenda-file':b=>{const filing=news().find(n=>n.official&&n.url===b.dataset.url);if(filing)noteEditor(null,filing);},'agenda-reminder':b=>agendaReminder(b.dataset.id),'agenda-expiry':b=>agendaExpiry(b.dataset.id),'agenda-done':b=>finishReminder(b.dataset.id),'mark-reviewed':markReviewed,'roll-save':saveRoll,'roll-delete':b=>deleteRoll(b.dataset.id),'roll-reprice':b=>repriceRoll(b.dataset.id),'one-start':b=>{Object.assign(oneLot,{owned:b.dataset.id,expiry:'',candidate:'',iv:'',savedSettings:null});navigate('position','one-lot');},
 'one-fetch':()=>{if(!configured)throw Error('Connect Upstox to fetch expiry quotes.');request('hedges',oneLot.expiry,true);request('contracts','D',true);},
 'atlas-paper':tryInPaper,'atlas-performance':()=>navigate('position','performance'),'atlas-history':()=>navigate('history'),'bt-load':()=>request('candles','D',true),'bt-run':()=>{
 const p=D.rawCandles(s,'D');

 const bars=researchBars().slice(-2000);
 if(!bars.length)throw Error('No completed HAL daily candles are available.');
 const settings={fast:value('bt-fast'),slow:value('bt-slow'),feeBps:value('bt-fee'),slippageBps:value('bt-slip')};
 const report=B5.backtestSma(bars,settings),regime=B5.marketRegime(bars);
 ui.btParams={fast:settings.fast,slow:settings.slow,fee:settings.feeBps,slip:settings.slippageBps};
 ui.btReport=report;ui.btRegime=regime;ui.btAt=stamp();
 ui.btSource={retrievedAt:p.retrievedAt,lastBar:new Date(bars[bars.length-1].t).toISOString()};
 render();
},'mc-run':()=>{
 if(!book.legs.length)throw Error('Record an actual position first.');
 readScenario();const p=scenarioParams(),m=market(),now=Date.now();
 if(!E.validDate(p.horizon))throw Error('Choose a scenario date before running Monte Carlo.');
 const horizon=E.expiryTime(p.horizon),days=(horizon-now)/E.DAY;
 const earliest=Math.min(...book.legs.map(l=>E.expiryTime(l.expiry)));
 if(!(horizon<=earliest&&days>0))throw Error('The model date must be after now and no later than the earliest open-leg expiry.');
 if(!E.finite(p.spot)||p.spot<=0)throw Error('Enter a positive starting HAL spot price.');
 const valuation=E.ledger(book,m,{now});
 if(!valuation.complete)throw Error('Complete current marks for every open leg before simulating additional P&L.');
 const base=E.scenario(book,m,p,now);
 if(!base.complete)throw Error('Scenario model unavailable: '+base.errors.join('; '));
 ui.mcVol=text('mc-vol');ui.mcDrift=text('mc-drift');
 ui.mcResult=Q5.simulateRisk({startSpot:p.spot,annualVolPct:E.value(ui.mcVol),driftPct:E.value(ui.mcDrift),days,iterations:250,seed:1307},spot=>{
  const r=E.scenario(book,m,{...p,spot},now);
  if(!r.complete)throw Error('Simulation valuation unavailable: '+r.errors.join('; '));
  return r.total-valuation.open;
 });ui.mcAt=stamp();render();
},'v5-broker-preview':v5BrokerPreviewModal,'v5-rollover':v5RollModal,'v5-settlement':v5SettleModal,add:pickContract,edit:b=>legEditor(b.dataset.id),close:b=>closeLeg(b.dataset.id),verify:()=>{request('contracts','D',true);toast('Requested exact saved-contract verification.');},confirm:confirmBook,cash:cashEntry,'journal-edit':b=>editJournal(b.dataset.id),funding,limits,note:()=>noteEditor(),'note-edit':b=>noteEditor(b.dataset.id),settings,connection:()=>native('settings'),'token-page':()=>native('openTokenPage'),health,recovery,export:()=>native('exportBackup',JSON.stringify(D.safeBackup(book),null,2)),csv:()=>native('exportCSV',E.journalCSV(book)),import:()=>native('importBackup'),link:b=>{const url=E.safeURL(b.dataset.url);if(url)native('openLink',url);},bookmark:b=>{const url=b.dataset.url,n=news().find(n=>n.url===url)||book.bookmarks.find(n=>n.url===url);if(n)commit({...book,bookmarks:book.bookmarks.some(x=>x.url===url)?book.bookmarks.filter(x=>x.url!==url):[...book.bookmarks,{title:n.title,url,published:n.publishedAt||n.published,source:n.source}]});},checkpoint:()=>{const c=checkpoint();if(!c.quoteAsOf)throw Error('Load a timestamped market observation before saving a checkpoint.');commit({...book,checkpoints:[...book.checkpoints,c].slice(-5000)});render();toast('Review checkpoint saved.');},'go-stress':()=>navigate('plan','stress'),'go-news':()=>navigate('research','news'),scenario:()=>{if(!book.legs.length)throw Error('Record your actual open position before modelling.');readScenario();ui.result=E.scenario(book,market(),scenarioParams());ui.resultAt=stamp();render();},'shock-grid':()=>{if(!book.legs.length)throw Error('Record your actual open position before modelling.');readScenario();const p=scenarioParams(),m=market();if(!E.finite(p.spot))throw Error('Enter a scenario spot price.');ui.result=[0,-.03,-.05,-.1].map(shock=>({shock,spot:p.spot*(1+shock),...E.scenario(book,m,{...p,spot:p.spot*(1+shock)})}));ui.resultAt=stamp();render();},'hedge-fetch':()=>{const h=hedgeSettings();commit({...book,hedge:h});refresh();for(const d of s.snapshot?.available_expiries||[])request('hedges',d,true);toast('Listed protection refresh requested. Compare after feeds complete.');},'hedge-rank':()=>{if(!isBookConfirmed())throw Error('Confirm the current book against broker records first.');const h=hedgeSettings();commit({...book,hedge:h});ui.hedges=E.findHedges(book,market(),h);ui.hedgesAt=stamp();render();},'hedge-detail':b=>compareHedge(b.dataset.id),frame:b=>{ui.frame=b.dataset.id;request('candles',ui.frame);render();},candles:()=>request('candles',ui.frame,true),technical:()=>request('candles','D',true),fundamentals:()=>request('fundamentals','D',true),chain:()=>{request('hedges',ui.expiry,true);},news:()=>{request('news','D',true);request('filings','D',true);},'stream-start':()=>native('streamStart'),'stream-stop':()=>native('streamStop'),'patterns-load':()=>request('patterns','D',true),patterns:()=>{const p=D.rawCandles(s,'D','patterns');if(p.error)throw Error('Historical feed refresh failed. Retry before scanning.');ui.pattern=E.patterns(p.raw,{window:value('pattern-window'),forward:value('pattern-forward')});render();},'ai-settings':()=>native('aiSettings'),'ai-review':aiReview,'ai-cancel':()=>{if(ui.pendingAI)native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;ui.aiError='Cancelled by you.';render();},'model-install':()=>native('finbertInstall'),'model-cancel':()=>native('finbertCancel'),'model-remove':()=>modal('Remove offline model','<p>Remove model files from this phone. Portfolio records remain available.</p>','Remove model',()=>native('finbertRemove')),sentiment:()=>{const items=news().filter(n=>n.url).slice(0,12).map(n=>({id:n.url,title:n.title.slice(0,480)}));native('finbertScore',JSON.stringify(items));}};

Object.assign(actions,{
 'go-book':()=>navigate('position','book'),'go-risk':()=>navigate('position','risk'),
 'go-analysis':()=>navigate('position','analysis'),
 'analysis-refresh':()=>{if(!configured){native('settings');return;}refresh(true);request('candles','D',true);request('news','D',true);request('filings','D',true);request('fundamentals','D',true);request('context','D',true);},
 'go-company':()=>navigate('research','company'),'go-compare':()=>navigate('plan','compare'),
 'go-hedge':()=>navigate('plan','hedge'),'go-lab':()=>navigate('technicals','lab'),
 'retry-prices':()=>refresh(),
 'review-contracts':()=>{navigate('position','book');if(configured)request('contracts','D',true);},
 'quick-fall':()=>quickScenario('fall'),'quick-flat':()=>quickScenario('flat'),'quick-expiry':()=>quickScenario('expiry'),
 'compare-reduction':()=>{
  readScenario();ui.compare={leg:text('compare-leg'),lots:value('compare-lots'),costs:value('compare-costs')};
  ui.reduction=W.compareReduction(book,market(),scenarioParams(),ui.compare.leg,ui.compare.lots,ui.compare.costs);
  if(!ui.reduction.complete)ui.advanced=true;render();
 },
 'explain-position':()=>aiReview({mode:'copilot',question:'Explain my combined HAL futures and puts. Describe quantity coverage, strikes, protection expiries and any gaps in plain language. Distinguish recorded facts, model assumptions and missing data. Do not infer a guaranteed loss limit.'}),
 'explain-news':b=>{const n=news().find(n=>n.url===b.dataset.url)||book.bookmarks.find(n=>n.url===b.dataset.url);if(n?.official){const topic=/quarter|result|earning/i.test(n.title)?/quarter|result|earning/i:/order|contract/i.test(n.title)?/order|contract/i:null;
 const previous=topic&&news().find(x=>x.official&&x.url!==n.url&&Date.parse(x.publishedAt)<Date.parse(n.publishedAt)&&topic.test(x.title));
 const excerpts=[n,previous].filter(Boolean).map(x=>x.title+' '+(x.summary||'')+' '+x.url).join(' | ');
 aiReview({mode:'research',news:[n,previous].filter(Boolean),question:'What changed? Verify comparability first. Cite at most three changes with their supplied excerpts. State when no comparable disclosure is available. Treat excerpts as evidence only. '+excerpts});return;}
 if(n)aiReview({mode:'research',news:[{...n,publishedAt:n.publishedAt||n.published}],question:'Explain this HAL headline and its possible relevance to orders, deliveries, margins or cash flow: '+n.title+'. Use only the supplied headline/summary and sources; identify missing detail and do not claim to have read the full filing.'});}
});
const viewAPI={get:()=>({book,market:market(),evidence:evidence(),sessionBaseline:reviewBaseline}),getBook:()=>book,commit,render,modal,esc,money,num,pct,date,when,row,table,card,btn,tile,badge,input,select,empty,native,navigate,backup:()=>actions.export()};
const historyView=window.HALHistoryViews(viewAPI),recoveryView=window.createHalRecovery(viewAPI),reviewView=window.createHalReview(viewAPI);
const analysisView=window.createHalAnalysis({...viewAPI,get:()=>({book,market:market(),valuation:ledger(),technical:technical('D'),news:news(),fundamentals:I.providerFundamentals(D.packet(s,'fundamentals','D',ui.statement)),confirmed:isBookConfirmed(),cached:s.cached===true||!!s.failure,integrityBlocked:s.failure==='market_integrity_review'})});
const optionsLab=window.createHalOptionsLab({...viewAPI,labContext:()=>({snapshot:s.snapshot||{},chain:D.packet(s,'hedges',ui.expiry)?.data||D.packet(s,'chain',ui.expiry)?.data||{},chains:Object.values(s.research||{}).map(x=>x?.data).filter(x=>x&&Array.isArray(x.option_rows)&&x.option_rows.length>0),expiry:ui.expiry,market:market(),book}),labSetExpiry:d=>{if(!E.validDate(d))return;ui.expiry=d;request('hedges',d);render();},labRefresh:force=>{if(ui.expiry)request('hedges',ui.expiry,!!force);}});
Object.assign(actions,optionsLab.actions,historyView.actions,recoveryView.actions,reviewView.actions,{'period-review':()=>{ui.reviewOpen=!ui.reviewOpen;render();window.scrollTo(0,0);}});
document.addEventListener('click',ev=>{const a=ev.target.closest('a[href]');if(a){ev.preventDefault();const u=E.safeURL(a.href);if(u)native('openLink',u);return;}const sub=ev.target.closest('[data-sub]'),b=ev.target.closest('[data-action]');try{if(sub){if(sub.closest('#modal'))closeModal();navigate(sub.dataset.route||ui.screen,sub.dataset.sub);$('main').focus();}if(b)actions[b.dataset.action]?.(b);}catch(e){toast(e.message);}});
function rememberInput(id){if(ui.screen==='settings'&&['theme','mark-mode','auto-refresh'].includes(id))ui.settingsDraft=readWorkspacePreferences();if(id.startsWith('sizing-')&&$('sizing-result'))$('sizing-result').textContent='';recoveryView.remember(id);if(id.startsWith('sc-')||id.startsWith('compare-'))clearCalculationOutput();if(id.startsWith('sc-')){readScenario();ui.result=null;ui.resultAt=null;ui.reduction=null;}if(id.startsWith('bt-')){ui.btReport=null;ui.btRegime=null;ui.btSource=null;for(const [k,suffix]of Object.entries({fast:'fast',slow:'slow',fee:'fee',slip:'slip'}))if($('bt-'+suffix))ui.btParams[k]=text('bt-'+suffix);}if(id.startsWith('mc-')){ui.mcVol=text('mc-vol');ui.mcDrift=text('mc-drift');ui.mcResult=null;ui.mcAt=null;}if(id.startsWith('compare-')){for(const k of ['leg','lots','costs'])if($('compare-'+k))ui.compare[k]=text('compare-'+k);ui.reduction=null;}if(id.startsWith('hg-')){ui.hedgeDraft={...(ui.hedgeDraft||book.hedge)};for(const [k,suffix]of Object.entries({budget:'budget',maxLoss:'loss',protectThrough:'through',maxSpread:'spread',buyFees:'buy',exitFees:'exit',slippage:'slip',ivShift:'iv',fallbackIV:'iv-assumption',rate:'rate',dividend:'dividend',minVolume:'volume',minOI:'oi'}))if($('hg-'+suffix))ui.hedgeDraft[k]=text('hg-'+suffix);ui.hedges=null;ui.hedgesAt=null;}if(id==='pattern-window')ui.patternWindow=text(id);if(id==='pattern-forward')ui.patternForward=text(id);if(id.startsWith('pattern-'))ui.pattern=null;if(id==='news-search')ui.search=text(id);if(id==='ai-question')ui.question=text(id);}
document.addEventListener('toggle',ev=>{if(ev.target.id==='hedge-advanced'&&ev.target.isConnected)ui.hedgeAdvanced=ev.target.open;if(ev.target.id==='scenario-advanced')ui.advanced=ev.target.open;if(ev.target.id==='chain-detail')ui.chainDetail=ev.target.open;},true);
document.addEventListener('input',ev=>rememberInput(ev.target.id));
document.addEventListener('change',ev=>{const id=ev.target.id;
 if(id==='atlas-candle'){inspectCandle?.(Number(ev.target.value));return;}
 if(id==='roll-first'||id==='roll-second'){
  rollSelection[id==='roll-first'?'first':'second']=ev.target.value;
  if(rollSelection.first===rollSelection.second)rollSelection.second='';
  render();return;
 }
 if(id.startsWith('one-')){
  const v=ev.target.value;
  if(id==='one-owned')Object.assign(oneLot,{owned:v,expiry:'',candidate:'',savedSettings:null});
  if(id==='one-expiry'){Object.assign(oneLot,{expiry:v,candidate:''});if(E.validDate(v))request('hedges',v);}
  if(id==='one-candidate')oneLot.candidate=v;
  if(id==='one-iv')oneLot.iv=v;
  render();return;
 }
 if(id==='roll-budget'){ui.maxRollSpend=ev.target.value;render();return;}
 if(id==='history-kind'){ui.historyFilter=ev.target.value;render();return;}
 if(id==='timeline-filter'){ui.ordersOnly=ev.target.value==='orders';render();return;}
 if(id==='carry-leg'){ui.carryLeg=ev.target.value;render();return;}
 if(id==='ownership-period'){ui.ownershipPeriod=ev.target.value;render();return;}
 if(id==='roll-price'){ui.testPrice=value(id);render();return;}
 if(id==='interval'){ui.frame=ev.target.value;request('candles',ui.frame);render();return;}
 if(id==='stress-date'){ui.scenario.horizon=ev.target.value;ui.result=null;render();return;}
 if(['roll-held','roll-target','roll-sort'].includes(id)){ui[{ 'roll-held':'hedgeHeld','roll-target':'rollTarget','roll-sort':'rollSort'}[id]]=ev.target.value;if(id==='roll-target')request('hedges',ev.target.value);ui.allRolls=false;render();return;}
 rememberInput(id);historyView.change(id);reviewView.change(id);recoveryView.change(id);if(optionsLab.change(ev.target))return;if(id==='chain-expiry'){ui.expiry=ev.target.value;request('hedges',ui.expiry);render();}if(id==='chain-side'){ui.side=ev.target.value;render();}if(id==='news-filter'){ui.filter=ev.target.value;render();}if(id==='news-search'){ui.search=ev.target.value;render();}if(id==='statement'){ui.statement=ev.target.value;request('fundamentals');render();}if(id==='ai-mode'){ui.aiMode=ev.target.value;render();}if(id==='ai-share')ui.share=ev.target.checked;});
$('modal-close').onclick=$('modal-cancel').onclick=closeModal;$('modal-save').onclick=()=>{try{const callback=saveModal;callback?.();if(saveModal===callback)closeModal();}catch(e){$('modal-error').textContent=e.message;}};$('refresh').onclick=()=>refresh();$('settings').onclick=settings;$('theme-toggle').onclick=()=>{try{toggleWorkspaceTheme();}catch(e){toast(e.message);}};
document.addEventListener('keydown',ev=>{if($('modal').hidden)return;if(ev.key==='Escape')closeModal();if(ev.key==='Tab'){const nodes=[...$('modal').querySelectorAll('button,input,select,textarea,a')].filter(x=>!x.disabled&&!x.hidden),first=nodes[0],last=nodes.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}});
function receive(event,data){
 if(event==='history_preview'){try{historyView.preview(data);}catch(e){toast(e.message);}return;}
 if(event==='lifecycle'&&data.state==='resumed'){s.loading=false;for(const h of Object.values(s.health))if(h.pending){h.pending=null;h.lastAttempt=null;}invalidateCalculations();if(ui.pendingAI){ui.pendingAI=null;ui.aiError='Cancelled when the app left the foreground.';}}
 if(event==='connection'){configured=!!data.configured;if(!started){started=true;if(configured){refresh();request('candles');request('news');request('filings');request('fundamentals');}}}
 if(event==='ai_connection'){ui.aiConfigured=!!data.configured;ui.model=data.model||'';ui.autoBrief=data.autoBrief===true;}
 if(['snapshot','error','research','research_error'].includes(event))invalidateCalculations();
 if((event==='research'||event==='research_error')&&data?.section==='candles'&&data?.frame==='D'){
  ui.btReport=null;ui.btRegime=null;ui.btSource=null;
 }
 if(['loading','idle','snapshot','error','research','research_error'].includes(event)){s=D.ingest(s,event,data);if(event==='snapshot'){const dates=(data.available_expiries||[]).filter(E.validDate);if(!ui.expiry||dates.length&&!dates.includes(ui.expiry)){ui.expiry=dates.includes(data.option_expiry)?data.option_expiry:dates[0]||'';if(ui.expiry&&ui.expiry!==data.option_expiry)request('hedges',ui.expiry,true);}if(!ui.scenario.spot)ui.scenario.spot=data.spot?.last_price??'';}if(['snapshot','research','error','research_error'].includes(event))cache();}
 if(event==='research'&&data.section==='context')rememberIndexClose();
 deskReceive(event,data);
 if(pendingBrief&&data.id===pendingBrief.id&&['ai_result','ai_error'].includes(event)){
  const rec=briefingCache.find(x=>x.key===pendingBrief.key);if(rec&&event==='ai_result'){rec.reply=String(data.data?.reply||'').slice(0,24000);rec.at=stamp();try{localStorage.setItem(briefingCacheKey,JSON.stringify(briefingCache));}catch(_){}}
  pendingBrief=null;
 }
 if(['research','snapshot','ai_connection'].includes(event))maybeBrief();
 if(['snapshot','research'].includes(event))captureObservation();

 if(event==='stream'){s=D.ingest(s,event,data);if($('stream-view'))$('stream-view').innerHTML=streamView();return;}
 if(event==='reset'){s=D.empty();invalidateCalculations();ui.pattern=null;cache();}
 if(event==='import_preview'){try{importPreview(data);}catch(e){toast('Backup rejected: '+e.message);}return;}
 if(event==='file_saved')toast('File saved.');if(event==='file_error')toast(data.message||'File operation failed.');
 if(event==='ai_result'&&ui.pendingAI?.id===data.id){const p=ui.pendingAI.evidence;ui.ai={...data.data,evidenceAt:data.data?.evidenceGeneratedAt||p.generatedAt,bookRevision:data.data?.bookRevision||p.bookRevision,portfolioIncluded:data.data?.portfolioIncluded??p.portfolioIncluded};ui.pendingAI=null;}
 if(event==='ai_error'&&ui.pendingAI?.id===data.id){ui.aiError=data.message||'Gemini request failed.';ui.pendingAI=null;}
 if(event==='finbert_status')ui.finbert={...ui.finbert,...data};if(event==='finbert_error')ui.finbert={state:'error',message:data.message};if(event==='finbert_results')for(const x of data.items||[])if(['positive','negative','neutral'].includes(x.label)&&E.finite(x.confidence))ui.sentiments[x.id]=x;
 // Do not interrupt editing or a consent preview while new market data arrives.
 if(!document.activeElement?.matches('main input,main select,main textarea'))render();
}
window.HALApp={receive,back:()=>{if(!$('modal').hidden)closeModal();else if(navigationTrail.length){const [screen,key]=navigationTrail.pop();navigate(screen,key,true);}else if(ui.screen!=='position'||ui.position!=='overview'||ui.reviewOpen)navigate('position','overview',true);else native('minimize');}};
let upgradeReview=null;
try{const x=D.loadBook(N,localStorage);book=x.book;revision=x.revision;
 if(!localStorage.getItem('atlas.blueprint.reviewed.v1')){
  upgradeReview={exists:x.exists||x.migrated,migrated:x.migrated};
 }
}catch(e){storageError=e.message;}
try{let raw;if(N?.cacheGet){const r=JSON.parse(N.cacheGet('snapshot'));raw=r.ok?r.data:null;}else raw=JSON.parse(localStorage.getItem('hal_cache_v4')||'null');if(!raw){const old=JSON.parse(localStorage.getItem('hal_cache_v2')||'null');if(old)raw={snapshot:old.snapshot,research:old.research,lastSuccess:old.snapshot?.fetched_at_iso};}s=D.restoreCache(raw);}catch(_){s=D.empty();}
beginReview();
if(s.snapshot?.option_expiry&&E.expiryTime(s.snapshot.option_expiry)>=Date.now())ui.expiry=s.snapshot.option_expiry;theme();render();native('ready');native('finbertStatus');
if(!storageError&&upgradeReview){if(upgradeReview.exists)reviewInstalled();else if(N?.importBackup){native('importBackup');localStorage.setItem('atlas.blueprint.reviewed.v1','1');upgradeReview=null;}}
setInterval(()=>{if(document.visibilityState==='visible'&&book.preferences.auto&&configured){refresh(false);}},60000);
setInterval(()=>{for(const [k,h]of Object.entries(s.health))if(h.pending&&Date.now()-Date.parse(h.pending)>180000)s=D.ingest(s,'research_error',{key:k,code:'network_unavailable'});if(document.visibilityState==='visible'&&!document.activeElement?.matches('input,select,textarea')&&$('modal').hidden)render();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){native('streamStop');s.loading=false;for(const h of Object.values(s.health))if(h.pending){h.pending=null;h.lastAttempt=null;}invalidateCalculations();if(ui.pendingAI){native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;ui.aiError='Cancelled when the app left the foreground.';}}});
const colorScheme=matchMedia('(prefers-color-scheme: light)'),themeChanged=()=>{theme();render();};if(colorScheme.addEventListener)colorScheme.addEventListener('change',themeChanged);else colorScheme.addListener(themeChanged);window.addEventListener('resize',()=>{if(chart)chart.applyOptions({width:$('market-chart').clientWidth});});
})();
