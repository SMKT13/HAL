/* HAL Atlas presentation (HAL Desk schema compatibility preserved). Finance, persistence, transport and AI policy are separate modules. */
(function(){'use strict';
const V5=HAL5Risk,Q5=HAL5Quant,B5=HAL5Backtest,H5=HAL5Hedge,L5=HAL5Lenses,P5=HAL5Portfolio,X5=HAL5Expiry,C5=HAL5Reconcile,Z5=HAL5ScenarioPath,M5=HAL5MigrationGuard,R5=HAL5Rollover;
const E=HAL4Engine,D=HAL4Data,I=HAL4Insights,AI=window.HALAIIntelligence,A5=HAL5Attribution,W=HAL4Workflow,N=window.HALNative,$=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>E.finite(v)?v.toLocaleString('en-IN',{maximumFractionDigits:d}):'—',money=v=>E.finite(v)?(v<0?'−':'')+'₹'+Math.abs(v).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}):'Unavailable',pct=v=>E.finite(v)?num(v)+'%':'—';
const when=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' IST':'Time unavailable',date=v=>E.validDate(v)?new Date(v+'T00:00:00Z').toLocaleDateString('en-IN',{timeZone:'UTC',day:'2-digit',month:'short',year:'numeric'}):'—',stamp=()=>new Date().toISOString(),clone=v=>JSON.parse(JSON.stringify(v)),color=v=>E.finite(v)?v<0?'negative':'positive':'muted';
const btn=(a,t,x='')=>`<button data-action="${a}" ${x}>${t}</button>`,badge=(t,c='')=>`<span class="badge ${esc(c)}">${esc(t)}</span>`,row=(a,b)=>`<div class="row"><span>${esc(a)}</span><strong>${esc(b)}</strong></div>`,tile=(a,b,c='')=>`<div class="metric"><small>${esc(a)}</small><strong>${esc(b)}</strong><span>${esc(c)}</span></div>`,empty=(a,b='')=>`<div class="empty"><strong>${esc(a)}</strong>${esc(b)}</div>`,card=(a,b,c='')=>`<section class="card"><div class="section-heading"><h2>${esc(a)}</h2>${c}</div>${b}</section>`;
const table=(h,rs)=>`<div class="table-wrap"><table><thead><tr>${h.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead><tbody>${rs.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`,input=(id,label,v='',type='number')=>`<label>${esc(label)}<input id="${id}" type="${type}" ${type==='number'?'step="any" inputmode="decimal"':''} value="${esc(v??'')}"></label>`,select=(id,label,opts,v)=>`<label>${esc(label)}<select id="${id}">${opts.map(([k,t])=>`<option value="${esc(k)}" ${k===v?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`,value=id=>E.value($(id)?.value),text=id=>$(id)?.value||'';
let book=E.emptyBook(),revision=0,s=D.empty(),configured=false,started=false,storageError='',chart=null,saveModal=null,returnFocus=null,toastTimer;
const ui={screen:'position',position:'overview',plan:'stress',research:'company',technicals:'analysis',aiPage:'brief',reviewOpen:false,frame:'D',expiry:'',side:'PE',filter:'all',search:'',statement:'consolidated',scenario:{spot:'',horizon:'',iv:'',shift:0,rate:6,dividend:0,basis:'constant',base:''},result:null,resultAt:null,settlementResult:null,settlementPath:null,settlementAt:null,mcResult:null,mcAt:null,mcVol:'',mcDrift:0,btParams:{fast:20,slow:50,fee:0,slip:0},btReport:null,btRegime:null,btAt:null,btSource:null,reduction:null,compare:{leg:'',lots:1,costs:0},advanced:false,hedges:null,hedgesAt:null,hedgeDraft:null,closePreview:null,rollPreview:null,pattern:null,patternWindow:20,patternForward:10,aiMode:'copilot',aiConversationId:'',includeChat:false,question:'Explain the position, expiry gaps, quote reliability and evidence that needs review.',share:true,ai:null,pendingAI:null,aiError:'',aiStage:null,aiConfigured:false,model:'',finbert:{state:'not_installed'},sentiments:{}};
function native(name,...args){if(typeof N?.[name]==='function')return N[name](...args);if(!['ready','finbertStatus'].includes(name))toast('Available in the installed Android app.');return null;}
function toast(msg){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,6000);}
function isBookConfirmed(){return I.isBookConfirmed(book);}
function clearCalculationOutput(){document.querySelectorAll('[data-calculation-output]').forEach(el=>el.remove());}
function invalidateCalculations(){recoveryView.invalidate();clearCalculationOutput();ui.reduction=null;ui.result=null;ui.resultAt=null;ui.settlementResult=null;ui.settlementPath=null;ui.settlementAt=null;ui.mcResult=null;ui.mcAt=null;ui.hedges=null;ui.hedgesAt=null;ui.closePreview=null;ui.rollPreview=null;}
function theme(){document.body.classList.toggle('light',book.preferences.theme==='light'||book.preferences.theme==='system'&&matchMedia('(prefers-color-scheme: light)').matches);}
function commit(b){if(storageError)throw Error('Recover the saved book before editing.');const next=E.validateBook(b);const changed=I.materialFingerprint(next)!==I.materialFingerprint(book);if(changed&&I.confirmationFingerprint(next)!==I.confirmationFingerprint(book)){next.riskProfile.confirmedAt=null;next.riskProfile.confirmedBook=null;}const r=D.saveBook(N,localStorage,next,revision);if(changed){ui.ai=null;invalidateCalculations();if(ui.pendingAI)native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;}book=r.book;revision=r.revision;book.revision=revision;theme();render();}
function cache(){try{const x=JSON.stringify(D.cache(s));if(N?.cachePut){const r=JSON.parse(N.cachePut('snapshot',x));if(!r.ok)throw Error();}else localStorage.setItem('hal_cache_v4',x);}catch(_){toast('Market cache could not be saved; your portfolio is stored separately.');}}

// Review observations live in a separate cache, never in the book transaction or
// its recovery slot. The baseline stays fixed throughout a foreground session.
let reviewBaseline=null,reviewCurrent=null,reviewCaptured=false,reviewSaveFailed=false,hiddenAt=null;
function beginReview(){
 let cached=null;
 try{if(N?.cacheGet){const r=JSON.parse(N.cacheGet('snapshot:review'));cached=r.ok?r.data?.current:null;}
 else cached=JSON.parse(localStorage.getItem('hal_review_v4')||'null')?.current;}catch(_){}
 reviewCurrent=W.latestReview([cached]);
 reviewBaseline=W.latestReview([reviewCurrent,...book.checkpoints]);
 reviewCaptured=false;reviewSaveFailed=false;
}
function captureReview(){
 if(reviewCaptured||reviewSaveFailed||storageError||(ui.screen!=='position'||ui.position!=='overview')||document.visibilityState==='hidden'||s.cached)return;
 const input=evidence();if(!W.canCaptureReview(input))return;
 const current=I.checkpoint(input),payload=JSON.stringify({version:1,current});
 try{if(N?.cachePut){const r=JSON.parse(N.cachePut('snapshot:review',payload));if(!r.ok)throw Error();}
 else localStorage.setItem('hal_review_v4',payload);
 reviewCurrent=current;reviewCaptured=true;
 }catch(_){reviewSaveFailed=true;toast('This review could not be saved. Your positions are unaffected.');}
}
function resumeReview(awayMs){if(E.finite(awayMs)&&awayMs>=300000||hiddenAt!==null&&Date.now()-hiddenAt>=300000)beginReview();hiddenAt=null;}
const market=()=>D.market(s),ledger=()=>E.ledger(book,market()),risk=()=>{const r=E.risk(book,market());if(book.legs.length&&!isBookConfirmed()&&!r.warnings.some(w=>w.code==='unconfirmed'))r.warnings.push({code:'unconfirmed',title:'Confirm your book',detail:'Check these positions against your broker records.'});return r;},news=()=>I.newsGroups(D.news(s));
function technical(frame='D'){const p=D.rawCandles(s,frame),t=E.technicals(p.raw,frame,Date.now(),p.retrievedAt);if(p.error){t.stale=true;t.bias='Refresh failed';}return t;}
function evidence(){return {book,valuation:ledger(),risk:risk(),market:market(),technical:technical(),fundamentals:I.providerFundamentals(D.packet(s,'fundamentals','D',ui.statement)),news:news(),scenarios:ui.result&&!Array.isArray(ui.result)?[ui.result]:[],funding:book.funding};}
const checkpoint=()=>I.checkpoint(evidence()),changes=()=>I.changes(reviewBaseline,checkpoint(),news());
function request(section,frame='D',force=false){if(!configured&&section!=='filings')return;const k=D.key(section,frame,ui.statement),h=s.health[k]||{},ttl=section==='fundamentals'?21600000:['candles','patterns','news','filings'].includes(section)?900000:60000;if(h.pending||!force&&h.lastSuccess&&Date.now()-Date.parse(h.lastSuccess)<ttl)return;if(h.lastAttempt&&Date.now()-Date.parse(h.lastAttempt)<10000)return;s.health[k]={...h,pending:stamp(),lastAttempt:stamp()};native('research',JSON.stringify({section,frame,type:ui.statement,...(section==='contracts'?{legs:book.legs.map(l=>({type:l.type,expiry:l.expiry,strike:l.strike,lotSize:l.lotSize,...(l.instrumentKey?{instrument_key:l.instrumentKey}:{})}))}:{})}));}
function refresh(force=true){if(s.loading)return;if(!configured){native('settings');return;}native('refresh',ui.expiry||'');request('status','D',force);request('context','D',force);if(book.legs.length)request('contracts','D',force);for(const d of [...new Set(book.legs.filter(l=>l.type==='PE'&&E.expiryTime(l.expiry)>Date.now()).map(l=>l.expiry))])request('hedges',d,force);}
function navigate(screen,sub){
  if(screen==='today'){screen='position';sub='overview';}
  if(screen==='plan'){screen='position';sub=sub||'stress';}
  if(screen==='research'&&['markets','indicators','insights'].includes(sub)){screen='technicals';}
  if(screen==='research'&&sub==='ai'){screen='ai';sub='assistant';}
  ui.reviewOpen=false;
  ui.screen=screen;
  if(sub)ui[screen==='ai'?'aiPage':screen]=sub;
  if(screen==='position'&&ui.position==='overview')captureReview();
  if(screen==='technicals'){if(ui.technicals==='lab'&&ui.expiry)request('hedges',ui.expiry);else request('candles',ui.technicals==='backtest'||ui.technicals==='analysis'?'D':ui.frame);if(ui.technicals==='analysis'){request('news');request('filings');request('fundamentals');request('context');}}
  if(screen==='research'){
    if(ui.research==='company')request('fundamentals');
    if(ui.research==='news'){request('news');request('filings');}
  }
  render();window.scrollTo(0,0);
}
const subnav=(group,items)=>`<div class="subnav">${items.map(([k,t])=>`<button data-sub="${k}" class="${ui[group]===k?'active':''}" aria-pressed="${ui[group]===k}">${esc(t)}</button>`).join('')}</div>`,intro=(t,n)=>`<div class="page-intro"><div class="eyebrow">Hindustan Aeronautics · NSE</div><h1>${esc(t)}</h1><p>${esc(n)}</p></div>`,reviews=items=>items.map(w=>`<article class="review-item"><strong>${esc(w.title)}</strong><p>${esc(w.detail)}</p></article>`).join('');
function clocks(q){const z=E.quoteQuality(q);return row('Provider quote',when(q?.quoteAt))+row('Last exchange trade',when(q?.tradeAt))+row('HTTP retrieved',when(q?.retrievedAt))+row('Last successful refresh',when(s.lastSuccess))+row('Last failed refresh',when(s.lastFailure))+`<p class="fine">${esc([...z.reasons,...z.warnings].join(' · ')||'A recent HTTP retrieval does not establish a recent exchange trade.')}</p>`;}

function changeView(){
 const current=checkpoint(),c=I.changes(reviewBaseline,current,news());
 if(!c.ready)return `<p class="fine">${reviewCaptured?'Your first review is saved. Your next visit will compare with this observation.':'Load current prices for every leg to begin. Reviews save automatically while Today is open.'}</p>`;
 const attribution=A5.compare(reviewBaseline,current);
 return `<p class="fine">Compared with ${esc(when(c.from))}</p><div class="metrics">${tile('HAL spot difference',money(c.spot))}${tile('Open P&L change',money(c.open),attribution.available?'Reconciled exact REST marks':c.sameBook?'Indicative · attribution unavailable':'Position changed')}</div><p class="fine">${esc(c.reason)}</p>`+
  (attribution.available?'<details><summary>Per-leg P&amp;L change from verified market marks</summary>'+
   table(['Contract','Earlier mark','Latest mark','Change'],attribution.items.map(r=>[
    r.type+' '+date(r.expiry)+(r.type==='PE'?' '+num(r.strike,0)+' PE':'')+' · '+num(r.units,0)+' units',
    money(r.from),money(r.to),money(r.pnl)]))+
   row('Reconciled change in open P&L',money(attribution.total))+
   '<p class="fine">'+esc(attribution.scope)+' Quote timestamps are checked for each open contract. This comparison excludes transaction fees and cannot explain why a price moved.</p></details>':
   '<p class="fine">Per-leg change withheld: '+esc(attribution.reason)+' Older review checkpoints remain readable but need a second complete observation for a reliable contract-level comparison.</p>');
}
function articleCards(list,limit=30){return list.slice(0,limit).map(n=>`<article class="news-item"><div class="news-meta"><span>${esc(n.source||'Unknown source')}${n.official?' · Official filing':''}</span><span>${esc(when(n.publishedAt))}</span></div><h3>${esc(n.title)}</h3>${n.summary?'<p>'+esc(n.summary)+'</p>':''}${n.duplicates?.length?badge(n.duplicates.length+' duplicates grouped'):''}${ui.sentiments[n.url]?badge('FinBERT '+ui.sentiments[n.url].label+' '+pct(ui.sentiments[n.url].confidence*100)):''}<div class="toolbar">${n.url?btn('link','Read source',`data-url="${esc(n.url)}" class="text-button"`)+btn('explain-news','Explain',`data-url="${esc(n.url)}" class="text-button"`)+btn('bookmark',book.bookmarks.some(b=>b.url===n.url)?'Saved':'Save',`data-url="${esc(n.url)}" class="text-button"`):badge('Link unavailable')}</div><p class="fine">Retrieved ${esc(when(n.retrievedAt))}</p></article>`).join('')||empty('No verified news loaded','Refresh when connected. Absence from a feed does not prove that no event occurred.');}

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
function v5ExpiryPanel(large=false){
 if(!book.legs.length)return '';
 const x=X5.agenda(book,E.istDate()),items=large?x.alerts:x.alerts.slice(0,4);
 return card('HAL Atlas · Expiry & settlement review',
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
function today(m,l,r){
 const audit=P5.audit(book,l),verifiedOpen=audit.consistent?audit.open:null,verifiedNet=audit.consistent?audit.net:null,bookedNet=audit.consistent?audit.bookedNet:null;
 const q=E.quoteQuality(m.spot),integrityBlocked=s.failure==='market_integrity_review',daily=!integrityBlocked&&q.valid&&E.finite(m.spot.price)&&E.finite(m.spot.previousClose)?m.spot.price-m.spot.previousClose:null;
 const dailyLabel=integrityBlocked?'withheld pending price integrity review':q.status==='current'&&!s.failure?'today':'last recorded change · not live';
 const next=W.priority(evidence(),configured),c=changes(),recent=(c.ready?c.newNews:news()).slice(0,1);
 return ''+
 `<div class="price-ribbon"><div><span class="eyebrow">HAL · NSE</span><strong>${money(m.spot.price)}</strong></div><div class="price-change ${color(daily)}">${money(daily)} ${esc(dailyLabel)}${badge(q.status,q.status)}</div></div>`+
 (!book.legs.length?card('Start with your actual position',`<p>Connect prices, record your futures and puts, then review them together.</p><ol class="setup-steps"><li>${configured?'Prices connected':btn('connection','Connect Upstox')}</li><li>${btn('add','Add first position','class="primary"')}</li><li>Confirm the entries against your broker.</li></ol><p class="fine">You can record positions offline. No example holdings are added.</p>`):'')+
 `<div class="daily-grid"><section class="card hero daily-position"><span class="eyebrow">Your combined position</span><div class="hero-value ${color(verifiedOpen)}">${book.legs.length?money(verifiedOpen):'No open book'}</div><p class="fine">Indicative open P&L · ${l.manual?'manual marks included':l.stale?'older prices':l.complete?'all marks available':'missing contract prices'}</p><p class="fine">Strategy net <strong>${money(verifiedNet)}</strong> · includes recorded realised P&amp;L and charges</p>${btn('go-book','View my position →','class="text-button"')}</section>`+
 `<section class="card next-review"><span class="eyebrow">Next review</span><h2>${esc(next.title)}</h2><p>${esc(next.detail)}</p>${btn(next.action,next.label,'class="primary"')}${book.legs.length?btn('explain-position','Explain my protection','class="text-button"'):''}</section></div>`+
 (audit.consistent?'':card('P&L integrity needs review',reviews(audit.errors.map(detail=>({title:'Accounting mismatch',detail})))))+
 analysisView.preview()+
 v5ExpiryPanel()+
 card('Since your last visit',changeView())+
 card('Exposure and protection',row('Futures',num(r.futureUnits,0)+' units · '+num(r.futureLots,0)+' lots')+row('Put quantity coverage',pct(r.coverage))+row('Nearest expiry',date(r.nextExpiry))+row('Recorded realised after charges',money(bookedNet)))+recoveryView.cards(false)+
 card(c.ready?'New evidence to review':'Latest HAL evidence',(c.ready&&!recent.length?empty('No new items in the loaded feed','Open Business review for existing evidence and upcoming events.'):articleCards(recent,1)),btn('go-company','Business review →','class="text-button"'))+
 `<details class="card disclosure"><summary>Protection, market context & source times</summary>${strategySummary(m,true)}${row('Futures exposure',num(r.futureUnits,0)+' units')}${row('Net delta',num(r.delta))}${row('NIFTY 50',money(m.nifty?.price))}${row('India VIX',num(m.vix?.price))}${clocks(m.spot)}${btn('health','Check all feeds','class="text-button"')}</details>`;
}
function contractHelp(leg,m){const candidates=m.contracts.filter(c=>c.type===leg.type&&(leg.type!=='PE'||c.strike===leg.strike));return '<p class="fine">Saved expiry '+esc(date(leg.expiry))+' · '+esc(leg.lotSize)+' units per lot. '+(candidates.length?'Provider lists '+candidates.slice(0,8).map(c=>esc(date(c.expiry))+' (lot '+esc(E.finite(c.lotSize)?c.lotSize:'unavailable')+')').join(', ')+'.':'No same-strike contract metadata is currently available.')+' Use Verify contracts, then review Edit / manual mark → Fill from listed contract against your broker record. Entries and expiry dates are never changed automatically.</p>';}
function v5RollModal(){
 const m=market();
 const current=book.legs.filter(l=>l.type==='FUT'&&E.expiryTime(l.expiry)>Date.now());
 if(!current.length)throw Error('Record an unexpired HAL futures leg before planning a rollover.');
 const futures=m.contracts.filter(c=>c.type==='FUT'&&E.validDate(c.expiry)&&
  E.expiryTime(c.expiry)>Date.now()&&c.instrumentKey);
 if(!futures.some(c=>current.some(l=>c.expiry>l.expiry&&c.lotSize===l.lotSize)))
  throw Error('No eligible later listed futures contract loaded. Refresh Upstox futures and verify exact contracts.');
 const fields='<p class="fine">READ-ONLY. Uses the current contract best bid and a later listed contract best ask. Quotes are not executable guarantees. Futures notional and price spread are not spendable cash or a margin estimate.</p>'+
 select('ro-current','Saved open future',current.map(l=>[l.id,date(l.expiry)+' · '+l.lots+' lots / '+l.lotSize+' units']),current[0].id)+
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
  row('Spread across units (NOT roll cash debit)',money(r.rollSpreadAcrossUnits))+
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
 return card('HAL Atlas · Protection by date',
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
 if(!a.consistent)return card('HAL Atlas · Lifetime accounting audit',
  '<p class="warning">Recorded and calculated portfolio totals do not reconcile. Financial summaries are withheld in this audit panel.</p>'+
  reviews(a.errors.map(detail=>({title:'Accounting conflict',detail})))+
  '<p class="fine">Preserve the saved book and review completed trades, costs and contract marks against your broker before drawing conclusions.</p>');
 return card('HAL Atlas · Lifetime accounting',
  '<div class="metrics wide">'+
   tile('Open P&L',money(a.open),a.complete?'All open legs priced':'Incomplete · one or more marks unavailable')+
   tile('Realised gross',money(a.realizedGross))+
   tile('Recorded lifetime charges',money(a.recordedCharges))+
   tile('Lifetime net',money(a.net),a.complete?'Indicative, not broker-settled':'Withheld until all marks are valid')+
  '</div>'+
  row('Booked realised net after charges',money(a.bookedNet))+
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
function position(m,l,r){let body='';if(ui.position==='book')body=`<div class="toolbar">${btn('add','Add position','class="primary"')}${btn('verify','Verify contracts')}${btn('confirm','Confirm book')}</div><p class="fine">${isBookConfirmed()?'Confirmed '+when(book.riskProfile.confirmedAt):'Not confirmed against broker records.'} These controls record trades; they never place orders.</p>`+(l.rows.map(x=>card('HAL '+(x.leg.type==='FUT'?'Future':num(x.leg.strike,0)+' PE'),`<p class="contract-meta">${date(x.leg.expiry)} · ${x.leg.lots} lots × ${x.leg.lotSize} units</p>${row('Indicative P&L',money(x.pnl))}${row('Entry / mark',money(x.leg.entry)+' / '+money(x.mark.price))}${badge(x.mark.source,x.mark.status)}<p class="fine">${esc(x.mark.warnings.join(' · '))}</p>${!E.finite(x.mark.price)?contractHelp(x.leg,m):''}<details><summary>Exact contract & clocks</summary>${row('Instrument',x.leg.instrumentKey||x.mark.contract?.instrumentKey||'Unverified')}${row('Quote',when(x.mark.quoteAt))}${row('Trade',when(x.mark.tradeAt))}${row('Retrieved',when(x.mark.retrievedAt))}</details><div class="toolbar">${btn('edit','Edit / manual mark',`data-id="${esc(x.leg.id)}"`)}${btn('close','Record completed close',`data-id="${esc(x.leg.id)}"`)}</div>`)).join('')||empty('Your book is empty','Add exact HAL futures and protective puts, then confirm with your broker.'));
if(ui.position==='performance')body=v5PortfolioPanel(book,l)+card('Leg performance',table(['Contract','Expiry','Units','Entry','Mark','P&L'],l.rows.map(x=>[x.leg.type==='FUT'?'Future':num(x.leg.strike)+' PE',date(x.leg.expiry),x.units,money(x.leg.entry),money(x.mark.price),money(x.pnl)])))+card('Premium & cash',row('Open put entry premium',money(l.openPutPremium))+row('Settlement cash',money(l.settlements))+row('Funding cash',money(l.fundingMovements))+'<p class="fine">Settlement and funding cash are separate from P&L and are never added twice.</p>')+card('Price & review observations',table(['Saved at','Spot','Open P&L','Coverage'],book.checkpoints.slice(-30).reverse().map(c=>[when(c.savedAt),money(c.spot),money(c.open),pct(c.coverage)])),btn('checkpoint','Save checkpoint','class="text-button"'));
if(ui.position==='risk'){const c=E.carryComparison(m);body=v5ExpiryPanel(true)+v5RiskPanel(book,l)+`<div class="metrics">${tile('Uncovered futures',num(r.uncoveredUnits,0)+' units')}${tile('Net delta',num(r.delta))}${tile('Net theta',num(r.theta),'Unavailable if convention is unverified')}${tile('Put quantity',num(r.putUnits,0))}</div>`+card('Position risks',reviews(r.warnings),btn('limits','Risk limits','class="text-button"'))+card('Protection timeline',table(['After expiry','Futures units','Put units','Uncovered'],r.timeline.map(t=>[date(t.date),t.futureUnits,t.putUnits,t.uncoveredUnits]))+'<p class="fine">Coverage at one time does not guarantee a downside floor through a later futures expiry.</p>')+card('Futures carry',table(['Near / far expiry','Spread','Annualised'],(Array.isArray(c)?c:c.rows||[]).map(x=>[date(x.nearExpiry||x.near?.expiry)+' / '+date(x.farExpiry||x.far?.expiry),money(x.spread),pct(x.annualized)]))+'<p class="fine">Observed spread, not a rollover plan or funding projection.</p>'+btn('v5-rollover','Inspect hypothetical futures rollover','class="text-button"')+v5RollResult());}
if(ui.position==='journal')body=card('Funding snapshot',row('Recorded margin',money(book.funding.margin))+row('Recorded available funds',money(book.funding.free))+row('Time',when(book.funding.at))+'<p class="fine">Manual snapshot; broker margin can change. No account-fund access.</p>',btn('funding','Update','class="text-button"'))+`<div class="toolbar">${btn('cash','Record fee / cash','class="primary"')}${btn('csv','Journal CSV')}${btn('export','JSON backup')}${btn('import','Import')}${btn('recovery','Previous book')}</div>`+card('Completed history',book.journal.slice().reverse().map(j=>`<article class="news-item"><strong>${esc(j.kind==='close'?'Completed '+j.leg.type+' close':j.kind)}</strong><small> · ${date(j.date)}</small>${j.kind==='close'?row(j.leg.lots+' × '+j.leg.lotSize+' · '+date(j.leg.expiry),money((j.exit-j.leg.entry)*E.units(j.leg)))+row('Exit / charges',money(j.exit)+' / '+money(j.fees)):row('Amount',money(j.amount))}<p class="fine">${esc(j.note)}</p>${btn('journal-edit','Correct record',`data-id="${esc(j.id)}" class="text-button"`)}</article>`).join('')||empty('No recorded closes'))+(book.legacy?card('Preserved legacy history',row('Realised',money(book.legacy.realized))+row('Costs',money(book.legacy.costs))+table(['Date','Kind','Amount','Note'],book.legacy.journal.map(j=>[j.date,j.kind,money(j.amount),j.note]))):'');
if(ui.position==='book'&&book.legs.length)body=card('Your strategy together',strategySummary(m)+`<div class="toolbar">${btn('go-compare','Compare an adjustment','class="primary"')}${btn('explain-position','Explain protection','class="text-button"')}</div>`)+body;
return body;}
function scenarioView(r){if(Array.isArray(r))return card('Sampled scenarios',table(['Shock','Spot','P&L','Quality'],r.map(x=>[pct(x.shock*100),money(x.spot),money(x.total),x.complete?x.kind:x.errors.join('; ')])));return card(r.complete?'Scenario results':'Scenario unavailable',`<div class="hero-value ${color(r.total)}">${money(r.total)}</div><p class="fine">${esc(r.kind)} · ${when(r.horizon)}</p>${r.complete?table(['Contract','Model price','Units','P&L','Valuation'],r.rows.map(x=>[x.leg.type==='FUT'?'Future':num(x.leg.strike)+' PE',money(x.modelPrice),x.units,money(x.pnl),x.kind])):reviews(r.errors.map(e=>({title:'Input needs review',detail:e})))}<details><summary>Assumptions</summary>${r.assumptions.map(a=>'<p class="fine">'+esc(a)+'</p>').join('')}</details>`);}

function advancedAssumptions(p){return `<details id="scenario-advanced" ${ui.advanced?'open':''}><summary>Advanced assumptions</summary><div class="form-grid">${input('sc-iv','Explicit IV assumption (%) · optional',p.iv)}${input('sc-shift','IV shift (percentage points)',p.shift)}${input('sc-rate','Interest rate (% annual)',p.rate)}${input('sc-dividend','Dividend yield (% annual)',p.dividend)}${select('sc-basis','Futures basis',[['constant','Observed constant basis'],['decay','Basis decays to expiry'],['carry','Theoretical cost of carry']],p.basis)}${input('sc-base','Manual base spot · optional',p.base)}</div></details>`;}
function scenarioInputs(m){const p=ui.scenario;return `<div class="form-grid">${input('sc-spot','HAL price to explore (₹)',E.value(p.spot)??m.spot.price)}${input('sc-horizon','On date · blank means now',p.horizon,'date')}</div>${advancedAssumptions(p)}<p class="fine">Uses observed futures basis and valid provider IV when available. Rate ${esc(p.rate)}%, dividend ${esc(p.dividend)}%, IV shift ${esc(p.shift)} points. Open Advanced assumptions to review or supply missing IV.</p>`;}
function v5MonteCarloPanel(){
 const r=ui.mcResult;
 return card('HAL Atlas · Monte Carlo risk',
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
function stressPlanner(m){return card('What would this mean for me?',`<div class="question-grid">${btn('quick-fall','HAL falls 5%')}${btn('quick-expiry','My first put expires')}${btn('quick-flat','HAL stays at today’s price')}</div>${scenarioInputs(m)}<div class="toolbar">${btn('scenario','Calculate outcome','class="primary"')}${btn('shock-grid','Compare 0 / −3 / −5 / −10%')}</div><p class="fine">The date must be on or before the earliest open-leg expiry. Model estimates use your saved entries; realised history and charges remain separate.</p>`)+(ui.result?'<div data-calculation-output><p class="fine">Calculated '+esc(when(ui.resultAt))+' with these assumptions.</p>'+scenarioView(ui.result)+'</div>':empty('Choose a question to begin','You can adjust the price and date before calculating.'))+v5MonteCarloPanel();}
function comparisonPlanner(m){
 const futures=book.legs.filter(l=>l.type==='FUT'),chosen=futures.find(l=>l.id===ui.compare.leg)||futures[0],c=ui.reduction;
 return card('Keep my position or reduce exposure?',`<p>Compare the change from current marks at the same HAL price and date. Existing puts remain held.</p>${scenarioInputs(m)}<div class="form-grid">${select('compare-leg','Future to reduce',futures.map(l=>[l.id,date(l.expiry)+' · '+l.lots+' lots']),chosen?.id)}${input('compare-lots','Lots to reduce',ui.compare.lots)}${input('compare-costs','Exit charges + slippage (₹)',ui.compare.costs)}</div>${btn('compare-reduction','Compare outcomes','class="primary"')}<p class="fine">The exit reference is the current mark. Add your estimated execution costs; a zero estimate excludes them.</p>`)+
 (c?'<div data-calculation-output>'+card('Additional P&L from now',`<div class="comparison-results">${tile('Keep current position',money(c.current.additional),num(c.current.futureUnits,0)+' futures units')}${tile('Reduce by '+num(c.removedUnits,0)+' units',money(c.alternative.additional),num(c.alternative.futureUnits,0)+' futures units · '+num(c.alternative.putUnits,0)+' put units retained')}</div>${c.complete?row('Difference with reduction',money(c.difference)):reviews([...new Set([...c.current.errors,...c.alternative.errors])].map(detail=>({title:'Comparison needs an input',detail})))}<p class="fine">Horizon ${when(c.current.horizon)} · ${c.current.manual||c.alternative.manual?'Manual marks included. ':''}${c.current.stale||c.alternative.stale?'Older marks included. ':''}Estimated exit costs ${money(c.exitCosts)}.</p><details><summary>How to read this comparison</summary>${c.assumptions.map(a=>'<p class="fine">'+esc(a)+'</p>').join('')}</details>` )+'</div>':'')+
 card('Compare a different protective put',`<p>Use listed contracts to compare your current hedge with replacement protection, including premium, sale proceeds and liquidity.</p>${btn('go-hedge','Find replacement protection →','class="text-button"')}`);
}
function plan(m){let body;const p=ui.scenario,h=ui.hedgeDraft||book.hedge;
if(ui.plan==='stress')body=stressPlanner(m);
else if(ui.plan==='compare')body=comparisonPlanner(m);
else if(ui.plan==='hedge')body=card('Find a protective put',`<p class="fine">Compare actual listed HAL puts as replacements for existing puts. Whole lots must exactly cover current futures units. A comparison never changes your saved positions.</p><div class="form-grid">${input('hg-budget','Gross purchase budget (₹)',h.budget)}${input('hg-loss','Sampled additional-loss limit (₹)',h.maxLoss)}${input('hg-through','Protection-through date',h.protectThrough,'date')}${input('hg-spread','Maximum bid/ask spread (%)',h.maxSpread)}</div><details><summary>Costs, liquidity & model assumptions</summary><div class="form-grid">${input('hg-buy','Buy charges (₹)',h.buyFees)}${input('hg-exit','Exit charges (₹)',h.exitFees)}${input('hg-slip','Slippage each side (%)',h.slippage)}${input('hg-iv','IV shift (percentage points)',h.ivShift)}${input('hg-iv-assumption','Explicit IV assumption (%) · optional',h.fallbackIV)}${input('hg-rate','Interest (% annual)',h.rate)}${input('hg-dividend','Dividend (% annual)',h.dividend)}${input('hg-volume','Minimum volume (units)',h.minVolume??1)}${input('hg-oi','Minimum OI (units)',h.minOI??1)}</div></details><div class="toolbar">${btn('hedge-fetch','Save & fetch puts','class="primary"')}${btn('hedge-rank','Compare available quotes')}</div><p class="fine">Fresh quote/trade clocks, contract specifications and liquidity are always required. Missing provider Greek timestamps require an explicitly entered IV assumption for model-only comparisons; no Greeks are invented. No qualifying contract is a valid result.</p>`)+(ui.hedges?`<p class="fine">Compared ${esc(when(ui.hedgesAt))}. Refresh or edit assumptions to recalculate.</p><div class="columns">${[['lowerCost','Lower Cost'],['balanced','Balanced'],['strongerProtection','Stronger Protection']].map(([k,title])=>{const c=ui.hedges.rankings[k];return card(title,c?`<h3>₹${num(c.contract.strike,0)} PE · ${date(c.contract.expiry)}</h3>${row('Gross purchase',money(c.grossCost))}${row('Sampled worst loss',money(c.worstLoss))}${row('Net cash required',money(c.netCashRequired))}${row('Model IV source',c.ivSource==='user-assumed'?'User-assumed '+num(c.ivAssumption)+'% · not verified Greeks':'Timestamp-verified provider IV')}${c.expiryGap?'<p class="warning fine">Protection ends before the last futures expiry.</p>':''}${btn('hedge-detail','Inspect comparison',`data-id="${esc(c.contract.instrumentKey)}" class="text-button"`)}`:empty('No qualifying candidate'));}).join('')}</div>${card('Eligibility & ranking',reviews(ui.hedges.errors.map(e=>({title:'No forced recommendation',detail:e})))+`<details><summary>Excluded contracts (${ui.hedges.excluded.length})</summary>${table(['Strike','Expiry','Reason'],ui.hedges.excluded.map(c=>[c.contract.strike,date(c.contract.expiry),c.reasons.join('; ')]))}</details><details><summary>Ranking method</summary>${ui.hedges.assumptions.map(x=>'<p class="fine">'+esc(x)+'</p>').join('')}</details>`)}`:empty('No comparison requested','Sampled worst loss is not a guaranteed maximum loss.'));

return body;
}
function businessBoard(){
 const b=W.businessReview(book.notes,news());
 const note=n=>`<article class="business-note"><div class="news-meta"><span>User-entered evidence</span><span>${date(n.date)}</span></div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><div class="toolbar">${n.url?btn('link','Source',`data-url="${esc(n.url)}" class="text-button"`):badge('Source link needed')}${btn('note-edit','Edit note',`data-id="${esc(n.id)}" class="text-button"`)}</div></article>`;
 return card('HAL business review',`<p>Track the evidence behind your thesis. Headlines and your notes are grouped by topic; these groups do not establish a business trend.</p>${btn('note','Add sourced evidence','class="primary"')}`)+
 card('Upcoming events',b.events.length?b.events.map(n=>`<div class="event-row"><span>${date(n.eventDate)}</span><div><strong>${esc(n.title)}</strong><small>User-entered event</small></div>${btn('note-edit','Review',`data-id="${esc(n.id)}" class="text-button"`)}</div>`).join(''):empty('No upcoming events recorded','Add a source and event date when a results release or delivery milestone is confirmed.'))+
 `<div class="business-grid">${b.drivers.map(d=>card(d.title,`<p class="driver-question">${esc(d.question)}</p>${d.notes.map(note).join('')}${d.articles.length?articleCards(d.articles,2):''}${!d.notes.length&&!d.articles.length?empty('Evidence to collect','Save a filing or add a sourced note for this business driver.'):''}`)).join('')}</div>`;
}
function facts(v,path='',out=[]){if(out.length>=120)return out;if(Array.isArray(v))v.slice(0,30).forEach((x,i)=>facts(x,path+' ['+(i+1)+']',out));else if(v&&typeof v==='object')for(const [k,x]of Object.entries(v))facts(x,path?path+' / '+k:k,out);else if(v!=null)out.push([path,String(v)]);return out;}
function v5BacktestPanel(){
 const p=ui.btParams,r=ui.btReport,g=ui.btRegime,src=ui.btSource;
 return card('HAL Atlas · Historical strategy research',
 '<p>Long-only SMA crossover on completed HAL cash-equity daily candles. Signals from a daily close are filled at the next completed daily bar open. This is PAPER research, not a HAL futures/options strategy or live entry signal.</p>'+
 '<div class="form-grid">'+input('bt-fast','Fast SMA (2–199)',p.fast)+
 input('bt-slow','Slow SMA (3–200)',p.slow)+
 input('bt-fee','Estimated cost per trade side (bps)',p.fee)+
 input('bt-slip','Estimated slippage per side (bps)',p.slip)+'</div>'+
 '<div class="toolbar">'+btn('bt-load','Refresh daily candles')+btn('bt-run','Run historical backtest','class="primary"')+'</div>'+
 '<p class="fine">Requires at least slow+3 validated completed daily bars (maximum 2,000 used). Sources are cached or retrieved via your read-only provider. No API call submits an order or modifies your book.</p>')+
 (r?'<div data-calculation-output>'+card('Simulated 1-share results',
 '<p class="fine">Recomputed '+esc(when(ui.btAt))+' · '+num(r.sample.bars,0)+' completed daily bars · '+esc(when(new Date(r.sample.from).toISOString()))+' to '+esc(when(new Date(r.sample.to).toISOString()))+'</p>'+
 '<div class="metrics">'+tile('Model net P&L/share',money(r.metrics.netPerShare))+
 tile('Closed paper trades',num(r.metrics.closedTrades,0))+
 tile('Max drawdown/share',money(r.metrics.maxDrawdownPerShare))+
 tile('Closed-trade win rate',r.metrics.winRate==null?'Unavailable':pct(r.metrics.winRate*100))+'</div>'+
 row('Recorded model costs/share',money(r.metrics.modeledFeesPerShare))+
 row('Unrealised paper P&L/share',money(r.metrics.unrealizedPerShare))+
 row('Provider candles retrieved',when(src?.retrievedAt))+
 row('Last bar ended',when(src?.lastBar))+
 (g?.ready?row('Historical regime',g.trend+' · '+g.volatilityRegime)+
 row('20-session realised volatility',pct(g.volatility20AnnualPct)):
 row('Historical regime',g?.reason||'Unavailable'))+
 table(['Entry (next open)','Exit (next open)','Net/share'],r.closedTrades.slice(-15).reverse().map(x=>[when(new Date(x.entryAt).toISOString()),when(new Date(x.exitAt).toISOString()),money(x.netPerShare)]))+
 (r.openPosition?'<p class="fine">One PAPER position still open and valued at the last completed candle close; no future exit price inferred.</p>':'')+
 '<p class="fine">'+esc(r.caveats.join(' · '))+'</p>')+'</div>':
 empty('No backtest calculated','Load daily HAL candles and run the local simulator.'));
}
function v5EvidencePanel(){
 const r=L5.build(evidence(),Date.now(),isBookConfirmed());
 return card('HAL Atlas · Six-Perspective Evidence Map',
  '<p class="fine">Calculated locally on this phone; opening this panel does not call Gemini or send portfolio data. The map checks evidence readiness, not whether a trade should be taken.</p>'+
  row('Perspectives with available evidence',num(r.available,0)+' of 6')+
  table(['Perspective','Status','Source review'],
   r.lenses.map(x=>[x.title,x.status,x.summary]))+
  '<details><summary>What each perspective still needs</summary>'+
   r.lenses.map(x=>'<p class="fine"><strong>'+esc(x.title)+'</strong> · '+esc(x.check)+(x.asOf?' · Evidence '+esc(when(x.asOf)):'')+'</p>').join('')+
  '</details><p class="fine">'+esc(r.caveat)+'</p>');
}
function research(m,section){let body='';const t=technical(ui.frame),p=D.packet(s,'fundamentals','D',ui.statement),fund=p?.data||{},base=s.snapshot||{};
if(section==='markets'){const chain=D.packet(s,'hedges',ui.expiry)?.data||D.packet(s,'chain',ui.expiry)?.data||(base.option_expiry===ui.expiry?base:{});body=card('HAL price & volume',`<div class="hero-header"><strong style="font-size:28px">${money(m.spot.price)}</strong>${badge(E.quoteQuality(m.spot).status)}</div><div class="toolbar">${[['D','Daily'],['1h','Hourly'],['15m','15 minute']].map(([k,v])=>btn('frame',v,`data-id="${k}" ${k===ui.frame?'class="primary"':''}`)).join('')}${btn('candles','Refresh')}</div><div id="market-chart" class="chart"></div>${t.rows.length?'':empty('Chart unavailable','Load completed provider candles.')}<p class="fine">${esc(t.bias||'Insufficient history')} · ${t.rows.length} completed bars · ${when(t.asOf?new Date(t.asOf).toISOString():null)}. SMA20/50/200, volume, saved futures entries and put strikes. <a href="https://www.tradingview.com/">Lightweight Charts™ by TradingView</a>.</p>`)+card('Listed futures',table(['Expiry','Lot','LTP','Volume','OI','Previous OI','Bid / ask'],(base.futures||[]).map(f=>[date(f.expiry),f.lot_size,money(f.quote?.last_price),num(f.quote?.volume,0),num(f.quote?.open_interest,0),num(f.quote?.previous_oi,0),money(f.quote?.bid)+' / '+money(f.quote?.ask)])))+card('Option chain',`<div class="form-grid">${select('chain-expiry','Expiry',(base.available_expiries||[]).map(x=>[x,date(x)]),ui.expiry)}${select('chain-side','Side',[['PE','Puts'],['CE','Calls']],ui.side)}</div>${btn('chain','Refresh chain')}<p class="warning">${esc(D.message(chain.chain_error||s.health[D.key('hedges',ui.expiry)]?.error||'').replace(/^Data unavailable$/,''))}</p>${(chain.option_rows||[]).length?'':empty('No option rows for this expiry','Check Data health or select another listed expiry and refresh.')}<p class="fine">Provider IV is percent. Chain retrieval does not certify recent trades or individual Greek timestamps.</p>${table(['Strike','LTP','Bid','Ask','Volume','OI','IV','Delta','Theta'],(chain?.option_rows||[]).map(r=>{const q=ui.side==='PE'?r.put:r.call;return [(ui.side==='PE'&&book.legs.some(l=>l.type==='PE'&&l.expiry===ui.expiry&&l.strike===r.strike)?String(r.strike)+' · held':r.strike),money(q?.quote?.last_price??q?.ltp),money(q?.quote?.bid??q?.bid),money(q?.quote?.ask??q?.ask),num(q?.quote?.volume??q?.volume,0),num(q?.quote?.open_interest??q?.oi??q?.open_interest,0),pct(q?.iv),num(q?.delta,3),num(q?.theta,3)];}))}`)+card('Foreground stream preview',`<p class="fine">Observation only. Streams stop when Android pauses the app and never overwrite REST marks.</p><div class="toolbar">${btn('stream-start','Start preview')}${btn('stream-stop','Stop')}</div><div id="stream-view">${streamView()}</div>`)+card('Data quality',clocks(m.spot),btn('health','All feeds','class="text-button"'));}
if(section==='indicators'){const a=technical(ui.frame);body=card('Trend by timeframe',table(['Timeframe','Completed bars','Evidence'],[['D','Daily'],['1h','Hourly'],['15m','15 minute']].map(([f,n])=>{const t=technical(f);return [n,t.completedCount,t.bias||'Insufficient history'];})))+card('Technical evidence · '+ui.frame,`${badge(a.bias||'Insufficient history',a.stale?'stale':'')}<p class="fine">${a.rows.length} completed bars · ${when(a.asOf?new Date(a.asOf).toISOString():null)}</p>${table(['Indicator','Value'],[['SMA20 / 50 / 200',money(a.sma20)+' / '+money(a.sma50)+' / '+money(a.sma200)],['EMA12 / 26',money(a.ema12)+' / '+money(a.ema26)],['RSI14',num(a.rsi)],['MACD / signal / histogram',num(a.macd)+' / '+num(a.signal)+' / '+num(a.hist)],['ATR14',money(a.atr)],['MFI14',num(a.mfi)],['Bollinger lower / upper',money(a.bbLow)+' / '+money(a.bbHigh)],['Support / resistance',money(a.support)+' / '+money(a.resistance)],['Pivot / S1 / R1',money(a.pivot)+' / '+money(a.s1)+' / '+money(a.r1)],['Historical volatility',pct(a.vol)],['Volume trend',a.volumeTrend]])}<p class="fine">Locally derived indicators. Recent extremes and pivots are observations, not instructions. Incomplete or stale history withholds directional conclusions.</p>`,btn('candles','Refresh selected timeframe','class="text-button"'));}
if(section==='company'){body=card('Company fundamentals',`${select('statement','Reporting basis',[['consolidated','Consolidated'],['standalone','Standalone']],ui.statement)}${btn('fundamentals','Refresh fundamentals')}<p class="fine">Provider-reported facts · retrieved ${when(p?.fetched_at_iso)}. Reporting-period and unit fields remain as returned; missing information is not estimated.</p>${Object.entries({profile:'Profile',income:'Quarterly income',annual:'Annual income',ratios:'Valuation ratios',balance:'Balance sheet',cash:'Cash flow',shareholding:'Shareholding',actions:'Corporate actions',peers:'Competitors'}).map(([k,v])=>`<details><summary>${v}${fund[k]?'':' · unavailable'}</summary>${fund[k]?table(['Provider field / period','Reported value'],facts(fund[k])):empty('Unavailable',D.message(p?.errors?.[k]||'No verified data loaded'))}</details>`).join('')}<a href="https://upstox.com/developer/api-documentation/fundamentals/">Source documentation</a>`)+card('Business notes & events',book.notes.map(n=>`<article class="news-item">${badge('User-entered note')}<h3>${esc(n.title)}</h3><p>${esc(n.text)}</p><p class="fine">${esc(n.category)} · ${date(n.date)} · Event ${date(n.eventDate)}</p>${n.url?btn('link','Source',`data-url="${esc(n.url)}" class="text-button"`):''}${btn('note-edit','Edit',`data-id="${esc(n.id)}" class="text-button"`)}</article>`).join('')||empty('No business notes','Record verified order backlog, execution progress and guidance with source links.'),btn('note','Add note','class="text-button"'));}
if(section==='company')body=businessBoard()+'<details class="card disclosure"><summary>Financial statements and business notes</summary>'+body+'</details>';
if(section==='news'){let list=ui.filter==='saved'?book.bookmarks.map(n=>({...n,publishedAt:n.published})):news();if(ui.filter==='official')list=list.filter(n=>n.official);const re={orders:/order|contract|defence|defense/i,results:/profit|revenue|earnings|results|dividend/i,delivery:/deliver|production|engine|tejas|helicopter/i}[ui.filter];if(re)list=list.filter(n=>re.test(n.title+' '+n.summary));if(ui.search)list=list.filter(n=>n.title.toLowerCase().includes(ui.search.toLowerCase()));body=card('HAL newsroom',`<div class="form-grid">${select('news-filter','Topic',[['all','All news'],['official','Official filings'],['orders','Orders'],['results','Results'],['delivery','Delivery / execution'],['saved','Bookmarks']],ui.filter)}${input('news-search','Headline search',ui.search,'search')}</div>${btn('news','Refresh news')}${articleCards(list,60)}`)+card('Offline financial sentiment',`<p class="fine">Opt-in English FinBERT classification. Sentiment is text classification, not a HAL price prediction. Model/tokenizer are pinned and checksum verified; excluded from backups.</p>${row('Model status',ui.finbert.state)}${ui.finbert.progress!=null?row('Progress',pct(ui.finbert.progress)):''}<p class="fine">${esc(ui.finbert.message)}</p><div class="toolbar">${ui.finbert.state==='ready'?btn('sentiment','Classify headlines')+btn('model-remove','Remove model'):btn('model-install','Download ~111 MB')}${ui.finbert.state==='downloading'?btn('model-cancel','Cancel download'):''}</div>`);}
if(section==='backtest')body=v5BacktestPanel();
if(section==='insights')body=card('Historical pattern scanner',`<p class="fine">Normalized return-distance comparison of completed, non-overlapping windows. Sample outcomes are descriptive, not predictive probabilities or backtested trading signals.</p><div class="form-grid">${input('pattern-window','Pattern window (sessions)',ui.patternWindow)}${input('pattern-forward','Outcome horizon (sessions)',ui.patternForward)}</div><div class="toolbar">${btn('patterns-load','Load history')}${btn('patterns','Compare','class="primary"')}</div>${ui.pattern?'<p class="fine">'+esc(ui.pattern.reason||ui.pattern.metric)+'</p>'+table(['Pattern ended','Distance ↓','Later return'],(ui.pattern.matches||[]).map(x=>[when(x.to),num(x.distance,4),pct(x.outcome)]))+(ui.pattern.summary?table(['Samples','Median','Worst / best'],[[ui.pattern.sampleCount,pct(ui.pattern.summary.median),pct(ui.pattern.summary.min)+' / '+pct(ui.pattern.summary.max)]]):''):empty('No scan requested')}`);
if(section==='ai')body=v5EvidencePanel()+card('Evidence-grounded AI Desk',`<p class="fine">Optional Gemini directly from Android. Your own API key and Google quota apply. Local deterministic calculations remain authoritative.</p>${row('Connection',ui.aiConfigured?'Configured · '+ui.model:'Disabled / no API key')}${btn('ai-settings','Manage key')}${btn('ai-history','History')}${btn('ai-new-chat','New conversation')}${ui.aiConversationId?'<p class="fine">Continuing a saved conversation · previous text is sent only after separate consent.</p><label><input id="ai-use-history" type="checkbox" '+(ui.includeChat?'checked':'')+'>Include relevant prior messages (revision filtered)</label>':''}${select('ai-mode','Workspace',[['copilot','Position Copilot'],['deliberate','Six-Perspective Research'],['research','Research Assistant']],ui.aiMode)}<label><input id="ai-share" type="checkbox" ${ui.share?'checked':''} ${ui.aiMode==='research'?'disabled':''}>Include position evidence</label><label>Question<textarea id="ai-question" maxlength="2000">${esc(ui.question)}</textarea></label><p class="fine">Research Assistant always excludes your portfolio. Credentials, private journal memos and business-note text are excluded.</p><div class="toolbar">${btn('ai-review','Review exact evidence','class="primary"'+(ui.pendingAI?' disabled':''))}${ui.pendingAI?btn('ai-cancel','Cancel request'):''}</div><p class="warning">${esc(ui.aiError|| (ui.pendingAI?'Waiting for Gemini…':''))}</p>`)+(ui.ai?card(I.canUseAnswer(ui.ai,book)?'AI interpretation':'Previous conclusion invalidated',I.canUseAnswer(ui.ai,book)?`<p class="fine">Evidence ${when(ui.ai.evidenceAt)} · ${ui.ai.portfolioIncluded?'Position '+esc(ui.ai.bookRevision):'Portfolio excluded'}</p>${aiStructuredView(ui.ai)}`:empty('The position changed','Review updated evidence and request a new answer.')):'');
return body;}
function streamView(){const x=s.stream;return x?row('State',String(x.state).replace(/_/g,' '))+row('Decoded frames',num(x.frames,0))+table(['Instrument','Preview price','Feed time'],(x.rows||[]).map(q=>[q.key||q.instrument_key||q.instrumentKey,money(q.price??q.last_price),when(x.feed_ts?new Date(x.feed_ts).toISOString():null)])):empty('Preview stopped');}
function drawChart(){const el=$('market-chart'),t=technical(ui.frame);if(!el||!t.rows.length||!window.LightweightCharts)return;const c=getComputedStyle(document.body);chart=LightweightCharts.createChart(el,{width:el.clientWidth,height:300,layout:{background:{color:c.getPropertyValue('--surface').trim()},textColor:c.getPropertyValue('--muted').trim()},grid:{vertLines:{color:c.getPropertyValue('--line').trim()},horzLines:{color:c.getPropertyValue('--line').trim()}},timeScale:{timeVisible:ui.frame!=='D'},handleScroll:{vertTouchDrag:false},localization:{locale:'en-IN',timeFormatter:v=>when(new Date(v*1000).toISOString())}});const cs=chart.addSeries(LightweightCharts.CandlestickSeries,{upColor:'#49b9a3',downColor:'#e88b93',borderVisible:false,wickUpColor:'#49b9a3',wickDownColor:'#e88b93'});cs.setData(t.rows.map(r=>({time:r.t/1000,open:r.o,high:r.h,low:r.l,close:r.c})));const vol=chart.addSeries(LightweightCharts.HistogramSeries,{priceFormat:{type:'volume'},priceScaleId:'volume'});vol.priceScale().applyOptions({scaleMargins:{top:.82,bottom:0}});vol.setData(t.rows.map(r=>({time:r.t/1000,value:r.v,color:r.c>=r.o?'#38786b':'#75424d'})));for(const [k,color]of [['sma20','#bcb4fb'],['sma50','#e2be78'],['sma200','#70c8be']])if(t.series?.[k])chart.addSeries(LightweightCharts.LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false}).setData(t.rows.map((r,i)=>({time:r.t/1000,value:t.series[k][i]})).filter(x=>E.finite(x.value)));for(const l of book.legs)cs.createPriceLine({price:l.type==='FUT'?l.entry:l.strike,color:'#edc78a',lineWidth:1,lineStyle:2,title:l.type==='FUT'?'Futures entry':'Owned put strike'});chart.timeScale().fitContent();}


function aiHistoryRead(){
 if(!N||typeof N.aiHistoryList!=='function')throw Error('Private AI history is available only in the installed Android app.');
 const reply=JSON.parse(N.aiHistoryList());if(reply.error)throw Error(reply.error);
 return Array.isArray(reply.items)?reply.items:[];
}
function showAiHistory(){
 const records=aiHistoryRead();
 const content=records.length?records.map(item=>{
  const id=esc(item.id),label=item.pinned?'Pinned research':'Ordinary · expires after 90 days';
  return '<section class="ai-history-item"><p class="fine">'+esc(when(item.updatedAt))+' · '+esc(label)+'</p><strong>'+esc(item.question||'AI review')+'</strong><p class="fine">'+esc((item.reply||'').slice(0,130))+'</p><div class="toolbar">'+
    btn('ai-history-open','Read','data-id="'+id+'"')+btn('ai-history-continue','Continue','data-id="'+id+'"')+
    btn('ai-history-pin',item.pinned?'Unpin':'Pin','data-id="'+id+'" data-pinned="'+(item.pinned?'true':'false')+'"')+
    btn('ai-history-delete','Delete','data-id="'+id+'"')+'</div></section>';
 }).join(''):empty('No saved AI reports','Approved AI answers are stored securely on this device.');
 modal('AI history · local only','<p class="fine">Ordinary reports expire 90 days after their last activity. Pinned reports remain until deleted. Deleting these records does not affect the HAL tradebook.</p>'+content+(records.length?'<div class="toolbar">'+btn('ai-history-clear','Delete all AI history')+'</div>':''),null,null);
}
function aiHistoryUpdate(action,id,pin){
 if(!N||typeof N[action]!=='function')throw Error('Android AI history service unavailable.');
 const data=JSON.parse(action==='aiHistoryPin'?N[action](id,pin):N[action](id));
 if(data.error)throw Error(data.error);
 showAiHistory();
}
function continueAI(id){
 const item=aiHistoryRead().find(x=>x.id===id);
 if(!item)throw Error('Saved conversation not found.');
 ui.aiConversationId=item.conversationId||item.id;
 ui.aiMode='copilot';ui.includeChat=false;ui.question='';
 ui.ai=null;ui.aiError='';ui.aiPage='assistant';ui.screen='ai';
 closeModal();render();window.scrollTo(0,0);
}
function showSavedAI(id){
 const item=aiHistoryRead().find(x=>x.id===id);
 if(!item)throw Error('Saved AI report not found.');
 modal('Historical AI report','<p class="fine">'+esc(when(item.generatedAt))+' · '+esc(item.mode||'AI review')+
  ' · '+esc(item.bookRevision||'No portfolio shared')+'</p><h3>'+esc(item.question||'Question')+
  '</h3>'+aiStructuredView(item)+
  (Array.isArray(item.agents)?item.agents.map(a=>'<h3>'+esc(a.role)+'</h3><div class="ai-output">'+esc(a.reply)+'</div>').join(''):'')+
  '<p class="fine">Stored interpretation, not a live verified position calculation.</p>',null,null);
}
function aiBrief(m,l,r){
 const evidenceStatus=E.quoteQuality(m.spot||{}),markState=l&&l.complete===false;
 const p=AI.priority({integrityIssue:storageError,hasOpenPosition:book.legs.length>0,bookConfirmed:isBookConfirmed(),valuation:l,risk:r,market:m,marketVerified:evidenceStatus.status==='fresh'});
 const banner='<div class="ai-brief-hero"><p class="eyebrow">ADAPTIVE INTELLIGENCE · LOCAL ANALYSIS</p><h2>'+esc(p.title)+'</h2><p>'+esc(p.detail)+'</p><p class="fine">Priority P'+p.level+' · HAL quote '+when(m.spot?.quoteAt)+' · '+esc(evidenceStatus.status||'Unverified')+'</p><div class="toolbar">'+btn('ai-brief','Generate AI Brief','class="primary"')+btn('ai-settings','AI settings')+btn('ai-history','History')+'</div><p class="fine">No Gemini request occurs until you review and approve the selected evidence.</p></div>';
 const boxes=[
  ['Market Outlook', 'HAL cash '+money(m.spot?.price)+' · '+esc(m.spot?.changePct==null?'Change unavailable':pct(m.spot.changePct))],
  ['Position & Hedge',book.legs.length?esc(String(book.legs.length))+' recorded open contract(s) · coverage '+esc(E.finite(r.coverage)?pct(r.coverage):'unavailable'):'No saved open contracts'],
  ['Lifetime Recovery','Use the reconciled lifetime recovery report; never infer missing historical charges.'],
  ['News Impact','Review verified sources, dated announcements and any missing filings.']
 ];
 return card('Intelligence Brief',banner)+
  '<div class="ai-card-grid">'+boxes.map((b,i)=>'<section class="ai-mini-card"><h3>'+esc(b[0])+'</h3><p>'+b[1]+'</p><div class="toolbar">'+btn(i===0?'go-analysis':i===1?'explain-position':i===2?'go-history':'go-company',i===1?'Ask Atlas':'Open details')+'</div></section>').join('')+'</div>'+
  card('What changed?','<p class="fine">Compare verified checkpoints; do not treat historical observations as current forecasts.</p>'+btn('period-review','Review checkpoints'))+
  card('Next Review','<p class="fine">'+esc(markState?'Position marks are incomplete.':p.detail)+'</p>');
}
function aiStructuredView(answer){
 if(!answer?.structured)return '<div class="ai-output">'+esc(answer?.reply||'No AI answer returned')+'</div>';
 const data=answer.structured;
 let body='<div class="ai-structured"><p class="fine">Model interpretation · '+esc(data.marketBias||'UNAVAILABLE')+'</p>';
 for(const part of AI.sections(data)){
  const value=part.value;
  if(Array.isArray(value)){
    if(!value.length)continue;
    body+='<section class="ai-answer-section"><h3>'+esc(part.label)+'</h3><ul>'+value.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul></section>';
  }else if(value){
    body+='<section class="ai-answer-section"><h3>'+esc(part.label)+'</h3><p>'+esc(value)+'</p></section>';
  }
 }
 return body+'<p class="fine">AI analysis is not a source of live quotes or guaranteed risk limits. Verify figures against the app calculations.</p></div>';
}
function aiDeep(){
 const stages=['Technical Analyst','Business & News Analyst','F&O Position Analyst','Bull Researcher','Bear Researcher','Risk Chair'];
 let body='<p class="fine">Six sequential Gemini requests from one selected model. Requires consent to the exact portfolio evidence and the displayed request count.</p>'+
  '<p class="fine">Roles: '+esc(stages.join(' · '))+'</p><div class="toolbar">'+btn('ai-deep','Run six-perspective review','class="primary"')+btn('ai-settings','Manage model')+btn('ai-history','History')+'</div>';
 if(ui.pendingAI?.stage)body+='<p class="fine" role="status">Analyst '+esc(ui.pendingAI.stage)+'/6 · '+esc(ui.pendingAI.label||'Review running')+'</p>';
 if(ui.aiError)body+='<p class="warning">'+esc(ui.aiError)+'</p>';
 const agents=Array.isArray(ui.ai?.agents)?ui.ai.agents:[];
 if(agents.length)body+='<h3>Risk-chair conclusion</h3><div class="ai-output">'+esc(ui.ai.reply||'No conclusion')+'</div>';
 return card('Deep Research',body)+agents.map(a=>card(a.role||'Analyst','<div class="ai-output">'+esc(a.reply||'')+'</div>')).join('');
}
function workspace(m,l,r){
 const labels={position:'Current position',history:'Lifetime history',technicals:'Analysis & markets',research:'Fundamentals & news',ai:'AI Desk'};
 const heading=`<div class="desk-heading"><div><small>Hindustan Aeronautics · NSE</small><h1>${esc(labels[ui.screen])}</h1></div>${btn('period-review',ui.reviewOpen?'Close review':'Review periods','class="text-button"')}</div>`;
 if(ui.reviewOpen)return heading+reviewView.view();
 if(ui.screen==='history')return heading+historyView.view()+recoveryView.cards(true);
 if(ui.screen==='position'){
   const items=[['overview','Overview'],['book','Book'],['risk','Risk'],['stress','What-if'],['break-even','Break-even'],['hedge','Find a hedge'],['compare','Compare'],['performance','Performance'],['journal','Journal & funding']];
   const nav=subnav('position',items);
   if(ui.position==='overview')return heading+nav+today(m,l,r)+card('Options Lab',`Build hypothetical HAL option strategies without changing your actual holdings. ${btn('go-lab','Explore HAL Options Lab','class="primary"')}`);
   if(ui.position==='break-even')return heading+nav+recoveryView.form();
   if(['stress','compare','hedge'].includes(ui.position)){ui.plan=ui.position;return heading+nav+plan(m);}
   return heading+nav+position(m,l,r);
 }
 if(ui.screen==='technicals')return heading+subnav('technicals',[['analysis','Daily Analysis'],['markets','Charts & derivatives'],['lab','Options Lab'],['indicators','Indicators'],['insights','Pattern scanner'],['backtest','Backtest']])+(ui.technicals==='analysis'?analysisView.view():ui.technicals==='lab'?optionsLab.view():research(m,ui.technicals));
 if(ui.screen==='ai')return heading+subnav('aiPage',[['brief','Brief'],['assistant','Ask Atlas'],['deep','Deep Research']])+(ui.aiPage==='brief'?aiBrief(m,l,r):ui.aiPage==='deep'?aiDeep():research(m,'ai'));
 return heading+subnav('research',[['company','Business'],['news','News & filings']])+research(m,ui.research);
}
function render(){if(chart){chart.remove();chart=null;}const m=market(),l=ledger(),r=risk();$('connection-state').textContent=configured?(s.loading?'Refreshing…':s.failure?'Connection needs review':'Upstox · read only'):'Offline research · no token';$('session-state').textContent=m.status?.status?String(m.status.status).replace(/_/g,' '):'Market status unavailable';$('refresh').disabled=s.loading;$('notice').textContent=storageError?(storageError.includes('Room tradebook needs a compatibility review')?'Room tradebook review needed. Original data are preserved; editing is disabled. Open Native terminal to review saved contracts.':'Saved book could not be loaded. Existing records preserved. Open Settings → Recovery.'):s.failure?D.message(s.failure)+' Previous observations remain visible.':s.cached?'Showing cached observations. Check source and trade timestamps.':'';$('notice').hidden=!$('notice').textContent;document.querySelectorAll('[data-screen]').forEach(b=>b.setAttribute('aria-current',b.dataset.screen===ui.screen?'page':'false'));$('main').innerHTML=storageError&&['position','history'].includes(ui.screen)?intro('Saved book needs recovery','Existing records are preserved.')+card('Financial values withheld',empty('The saved book could not be validated',(storageError.includes('Room tradebook needs a compatibility review')?'Review Room v2 contracts in the read-only native terminal. Do not replace or restore the existing database.':'Recover the previous book before editing or valuing the portfolio.')),storageError.includes('Room tradebook needs a compatibility review')?btn('open-native-terminal','Open native terminal','class="primary"'):btn('recovery','Review recovery','class="text-button"')):workspace(m,l,r);if(ui.screen==='technicals'&&ui.technicals==='markets'&&!ui.reviewOpen)drawChart();}
function modal(title,html,label,fn){returnFocus=document.activeElement;$('modal-title').textContent=title;$('modal-body').innerHTML=html;$('modal-error').textContent='';$('modal-save').textContent=label||'Save';$('modal-save').hidden=!fn;saveModal=fn;$('modal').hidden=false;document.body.style.overflow='hidden';($('modal-body').querySelector('input,select,textarea,button')||$('modal-close')).focus();}
function closeModal(){$('modal-error').textContent='';$('modal').hidden=true;document.body.style.overflow='';saveModal=null;if(returnFocus?.isConnected)returnFocus.focus();}
function legEditor(id){const old=book.legs.find(l=>l.id===id),l=old||{type:'FUT',expiry:'',strike:null,lots:1,lotSize:null,entry:null,manual:null,instrumentKey:null},listed=market().contracts.filter(c=>['FUT','PE'].includes(c.type));modal(old?'Edit recorded position':'Record HAL position',`<p class="fine">Use exact broker-recorded entries and contract dates. Provider verification is required for automatic valuation. Manual quantities remain labelled unverified until matched.</p>${select('leg-listed','Fill from listed contract',[['','Enter from broker records'],...(l.instrumentKey&&!listed.some(c=>c.instrumentKey===l.instrumentKey)?[[l.instrumentKey,'Saved contract · currently not listed']]:[]),...listed.map(c=>[c.instrumentKey,(c.type==='FUT'?'Future':c.strike+' PE')+' · '+date(c.expiry)+' · lot '+c.lotSize])],l.instrumentKey||'')}<div class="form-grid">${select('leg-type','Position type',[['FUT','Long future'],['PE','Long protective put']],l.type)}${input('leg-expiry','Exact expiry',l.expiry,'date')}${input('leg-strike','Put strike (₹)',l.strike)}${input('leg-lots','Whole lots',l.lots)}${input('leg-size','Units per lot',l.lotSize)}${input('leg-entry','Actual entry / premium (₹)',l.entry)}${input('leg-manual','Manual mark · blank = REST',l.manual)}</div><p class="fine">A manual zero is valid for puts only. Futures marks must be greater than zero. Expired positions require a recorded close or settlement. Changing a position invalidates confirmation and previous AI conclusions.</p>`,'Save position',()=>{const next={...l,id:old?.id||'leg-'+Date.now(),type:text('leg-type'),expiry:text('leg-expiry'),strike:value('leg-strike'),lots:value('leg-lots'),lotSize:value('leg-size'),entry:value('leg-entry'),manual:value('leg-manual'),manualAt:value('leg-manual')==null?null:stamp(),instrumentKey:text('leg-listed')||null};if(next.type==='FUT'&&next.manual===0)throw Error('Futures manual marks must be greater than zero. Clear the field if unavailable.');E.validateLeg(next);const b=clone(book);if(old)b.legs[b.legs.findIndex(x=>x.id===old.id)]=next;else b.legs.push(next);commit(b);request('contracts','D',true);});$('leg-listed').onchange=()=>{const c=listed.find(c=>c.instrumentKey===text('leg-listed'));if(!c)return;$('leg-type').value=c.type;$('leg-expiry').value=c.expiry;$('leg-strike').value=c.strike??'';$('leg-size').value=c.lotSize;};}
function closeLeg(id){const l=book.legs.find(l=>l.id===id);modal('Record completed close',`<p>Record a trade or settlement already completed with your broker. This updates your local journal only.</p><div class="form-grid">${input('close-lots','Lots closed',l.lots)}${input('close-exit','Actual exit price (₹)','')}${input('close-fees','Total charges (₹)',0)}${input('close-date','Completed trade date',E.istDate(),'date')}</div><label>Private memo<textarea id="close-note" maxlength="1000"></textarea></label>`,'Record close',()=>commit(E.closeLeg(book,id,value('close-lots'),value('close-exit'),value('close-fees'),text('close-date'),{note:text('close-note')})));}
function confirmBook(){if(!book.legs.length)throw Error('Record your actual holdings first.');modal('Confirm against your broker',table(['Contract','Expiry','Lots × units','Entry'],book.legs.map(l=>[l.type==='FUT'?'Future':l.strike+' PE',date(l.expiry),l.lots+' × '+l.lotSize,money(l.entry)]))+`<label><input type="checkbox" id="confirm-check">I have checked every open leg and completed close against my broker records.</label>`,'Confirm',()=>{if(!$('confirm-check').checked)throw Error('Check the broker confirmation before saving.');const b=clone(book);b.riskProfile.confirmedAt=stamp();b.riskProfile.confirmedBook=I.confirmationFingerprint(b);if(b.migration)b.migration.reviewRequired=false;commit(b);});}
function cashEntry(){modal('Record cost or cash',select('cash-kind','Record type',[['fee','Additional transaction / funding cost'],['settlement','Futures settlement cash'],['funding','Funding deposit / withdrawal']],'fee')+input('cash-amount','Amount · cash credits + / debits −')+input('cash-date','Completed date',E.istDate(),'date')+'<label>Private memo<textarea id="cash-note" maxlength="1000"></textarea></label><p class="fine">Costs are deducted once. Settlement and funding cash are separate from investment profit.</p>','Save',()=>commit(E.recordCash(book,text('cash-kind'),value('cash-amount'),text('cash-date'),text('cash-note'))));}
function editJournal(id){const j=book.journal.find(j=>j.id===id);modal('Correct a journal record','<p class="fine">Correct price, charges or memo. Contract quantities and the open book are not silently reversed.</p>'+input('journal-date','Date',j.date,'date')+(j.kind==='close'?input('journal-exit','Actual exit',j.exit)+input('journal-fees','Charges',j.fees):input('journal-amount','Amount',j.amount))+`<label>Private memo<textarea id="journal-note" maxlength="1000">${esc(j.note)}</textarea></label>`,'Save correction',()=>{const b=clone(book),x=b.journal.find(x=>x.id===id);x.date=text('journal-date');if(x.date>E.istDate())throw Error('Completed date cannot be in the future.');x.note=text('journal-note');if(x.kind==='close'){x.exit=value('journal-exit');x.fees=value('journal-fees');if(x.leg.type==='FUT'&&x.exit===0)throw Error('A futures broker execution price must be positive.');}else x.amount=value('journal-amount');commit(b);});}
function funding(){modal('Manual funding snapshot',input('fund-margin','Current margin recorded (₹)',book.funding.margin)+input('fund-free','Available funds recorded (₹)',book.funding.free)+'<p class="fine">Timestamped now. This is your manual observation; the app does not access broker funds.</p>','Save snapshot',()=>{const margin=value('fund-margin'),free=value('fund-free');if(margin===null||free===null||margin<0||free<0)throw Error('Enter both non-negative balances.');commit({...book,funding:{margin,free,at:stamp()}});});}
function limits(){const fields={capital:'Allocated capital',maxLoss:'Strategy loss review threshold',hedgeBudget:'Hedge budget',reserve:'Minimum cash reserve',reviewBelow:'Review below spot',reviewAbove:'Review above spot'};modal('Personal risk limits','<div class="form-grid">'+Object.entries(fields).map(([k,v])=>input('limit-'+k,v+' (₹)',book.riskProfile[k])).join('')+'</div><p class="fine">Review thresholds, not automatic stops or guaranteed loss limits.</p>','Save',()=>{const b=clone(book);for(const k of Object.keys(fields))b.riskProfile[k]=value('limit-'+k);commit(b);});}
function noteEditor(id){const n=book.notes.find(n=>n.id===id)||{title:'',text:'',date:E.istDate(),category:'Other',url:'',eventDate:''};modal('Business note',input('note-title','Title',n.title,'text')+`<label>Private business note<textarea id="note-text" maxlength="3000">${esc(n.text)}</textarea></label>`+select('note-category','Category',['Order book','Deliveries','Guidance','Results','Operations','Other'].map(x=>[x,x]),n.category)+input('note-url','Verified source HTTPS URL',n.url,'url')+input('note-event','Event date · optional',n.eventDate,'date'),'Save note',()=>{if(!text('note-title').trim())throw Error('Enter a title.');if(text('note-url')&&!E.safeURL(text('note-url')))throw Error('Use a valid HTTPS source link.');const next={...n,id:n.id||'note-'+Date.now(),date:E.istDate(),title:text('note-title'),text:text('note-text'),category:text('note-category'),url:text('note-url'),eventDate:text('note-event')||null},b=clone(book);if(n.id)b.notes=b.notes.map(x=>x.id===n.id?next:x);else b.notes.push(next);commit(b);});}
function importPreview(raw){
 if(storageError)throw Error('Recover the current saved book before importing a replacement.');
 const b=D.previewImport(raw),impact=M5.replacement(book,b),reviewedRevision=revision;
 const diff=impact.changes.filter(x=>x.removed||x.modified);
 const notice=impact.destructive?
  '<p class="warning">This replacement would remove or change existing records. Review the lost or modified entries before replacing the book.</p>':
  '<p class="fine">No existing records are identified as removed or modified. This still replaces the complete book.</p>';
 modal('Review backup import',
  '<p class="fine">BACKUP REPLACEMENT · not a merge. The saved book is unchanged until storage confirms your replacement. A previous-book recovery copy is retained.</p>'+
  table(['Record category','Current','Backup','Removed','Changed'],impact.changes.map(x=>[
    x.section,num(x.before,0),num(x.after,0),num(x.removed,0),num(x.modified,0)]))+
  row('Current booked gross P&L',money(impact.current.realizedGross))+
  row('Incoming booked gross P&L',money(impact.incoming.realizedGross))+
  row('Current recorded charges',money(impact.current.recordedCharges))+
  row('Incoming recorded charges',money(impact.incoming.recordedCharges))+
  row('Current booked net',money(impact.current.bookedNet))+
  row('Incoming booked net',money(impact.incoming.bookedNet))+
  notice+
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
function settings(){modal('HAL Atlas · Settings',`<p class="fine">Personal read-only research. Android 8+. Credentials stay encrypted natively; market and AI calls use fixed HTTPS destinations.</p><div class="toolbar">${btn('connection','Upstox connection')}${btn('ai-settings','Gemini settings')}${btn('token-page','Get Analytics Token')}</div>${select('theme','Appearance',[['dark','Graphite dark'],['light','Paper light'],['system','Follow device']],book.preferences.theme)}${select('mark-mode','Put valuation marks',[['ltp','Last traded price'],['bid','Quoted bid']],book.preferences.markMode)}<label><input id="auto-refresh" type="checkbox" ${book.preferences.auto?'checked':''}>Refresh roughly every 60 seconds while foreground</label><p class="fine">Android background monitoring is not guaranteed. No automatic paid AI requests occur.</p><div class="toolbar">${btn('export','Export JSON')}${btn('csv','Journal CSV')}${btn('import','Import backup')}${btn('recovery','Recovery')}${btn('health','Data health')}</div>`,'Save preferences',()=>commit({...book,preferences:{theme:text('theme'),markMode:text('mark-mode'),auto:$('auto-refresh').checked}}));}
function v5DataQualityPanel(a){
 if(!a)return '<p class="fine">No normalized market quality report available.</p>';
 const warnings=a.problems||[];
 return '<h3>HAL Atlas · Market data integrity</h3>'+
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
 modal('Data readiness & connection health',quality+
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
function aiReview(context){if(context?.question){ui.question=context.question;ui.aiMode=context.mode;ui.share=context.mode!=='research';}else{ui.question=text('ai-question');ui.share=$('ai-share').checked;}const input=evidence();if(context?.news)input.news=context.news;const question=ui.question;const packet=AI.selectContext(I.evidencePacket(input,{mode:ui.aiMode,includePortfolio:ui.share&&!storageError}),question,{mode:ui.aiMode,includePortfolio:ui.share&&!storageError}).evidence;
if(storageError&&packet.portfolioIncluded)throw Error('Recover the saved book before sharing financial evidence.');
if(!question.trim())throw Error('Enter a question.');
const prior=!!(ui.aiConversationId&&ui.includeChat&&ui.aiMode!=='deliberate');
if(prior){
 if(!N||typeof N.aiHistoryContext!=='function')throw Error('Saved conversation context is unavailable.');
 const selection=JSON.parse(N.aiHistoryContext(ui.aiConversationId,packet.bookRevision||'',packet.portfolioIncluded));
 if(selection.error)throw Error(selection.error);
 if(!Array.isArray(selection.conversation))throw Error('Conversation context is invalid.');
 packet.conversation=selection.conversation;
}modal('Review evidence sent to Gemini',`<p>${packet.portfolioIncluded?'Includes the shown positions, valuations, risk and funding snapshot.':'Your portfolio is excluded.'} Private journal memos, credentials and private notes are excluded.</p><p class="fine">Provider API charges or quota limits may apply. Evidence timestamp ${when(packet.generatedAt)}.</p><pre>${esc(JSON.stringify({question,evidence:packet},null,2))}</pre><label><input id="ai-consent" type="checkbox">Send this question and exact evidence to Google Gemini.</label>`,'Send to Gemini',()=>{if(!$('ai-consent').checked)throw Error('Explicit evidence-sharing consent is required.');const id='review-'+Date.now();const conversationId=ui.aiConversationId||id;ui.aiError='';ui.ai=null;ui.pendingAI={id,conversationId,evidence:packet,stage:null,label:null};native('ai',JSON.stringify({id,conversationId,includeConversation:prior,mode:ui.aiMode,message:question,evidence:packet,consent:true}));ui.screen='ai';ui.aiPage=ui.aiMode==='deliberate'?'deep':'assistant';render();});}

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
const actions={'ai-history':()=>showAiHistory(),'ai-new-chat':()=>{ui.aiConversationId='';ui.includeChat=false;ui.ai=null;ui.question='';ui.aiError='';render();},'ai-history-continue':b=>continueAI(b.dataset.id),'ai-history-open':b=>showSavedAI(b.dataset.id),'ai-history-pin':b=>aiHistoryUpdate('aiHistoryPin',b.dataset.id,b.dataset.pinned!=='true'),'ai-history-delete':b=>aiHistoryUpdate('aiHistoryDelete',b.dataset.id),'ai-history-clear':()=>modal('Delete all AI history?','<p>This permanently deletes saved AI analysis and pinned research, but leaves all financial records unchanged.</p>','Delete',()=>{const out=JSON.parse(N.aiHistoryClear());if(out.error)throw Error(out.error);toast('AI history deleted.');}),'ai-brief':()=>{ui.aiConversationId='';ui.includeChat=false;aiReview({mode:'copilot',question:'Prepare my daily HAL intelligence brief. Explain verified market signals, my position and hedge risks, lifetime recovery implications only when supported, contrary evidence and next review conditions. Do not invent missing financial figures.'})},'ai-deep':()=>{ui.aiConversationId='';ui.includeChat=false;aiReview({mode:'deliberate',question:'Review my HAL position, market evidence, hedge and lifetime recovery from six perspectives. Compare alternatives and highlight invalidation and missing data.'})},'go-history':()=>navigate('history'),'bt-load':()=>request('candles','D',true),'bt-run':()=>{
 const p=D.rawCandles(s,'D');
 if(p.error)throw Error('Daily candle request failed. Refresh provider data before backtesting.');
 const cleaned=E.candles(p.raw),bars=E.completed(cleaned,'D',Date.now()).slice(-2000);
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
},'v5-broker-preview':v5BrokerPreviewModal,'v5-rollover':v5RollModal,'v5-settlement':v5SettleModal,add:()=>legEditor(),edit:b=>legEditor(b.dataset.id),close:b=>closeLeg(b.dataset.id),verify:()=>{request('contracts','D',true);toast('Requested exact saved-contract verification.');},confirm:confirmBook,cash:cashEntry,'journal-edit':b=>editJournal(b.dataset.id),funding,limits,note:()=>noteEditor(),'note-edit':b=>noteEditor(b.dataset.id),settings,connection:()=>native('settings'),'token-page':()=>native('openTokenPage'),health,recovery,export:()=>native('exportBackup',JSON.stringify(D.safeBackup(book),null,2)),csv:()=>native('exportCSV',E.journalCSV(book)),import:()=>native('importBackup'),link:b=>{const url=E.safeURL(b.dataset.url);if(url)native('openLink',url);},bookmark:b=>{const url=b.dataset.url,n=news().find(n=>n.url===url)||book.bookmarks.find(n=>n.url===url);if(n)commit({...book,bookmarks:book.bookmarks.some(x=>x.url===url)?book.bookmarks.filter(x=>x.url!==url):[...book.bookmarks,{title:n.title,url,published:n.publishedAt||n.published,source:n.source}]});},checkpoint:()=>{const c=checkpoint();if(!c.quoteAsOf)throw Error('Load a timestamped market observation before saving a checkpoint.');commit({...book,checkpoints:[...book.checkpoints,c].slice(-5000)});reviewBaseline=c;render();toast('Review checkpoint saved.');},'go-stress':()=>navigate('plan','stress'),'go-news':()=>navigate('research','news'),scenario:()=>{if(!book.legs.length)throw Error('Record your actual open position before modelling.');readScenario();ui.result=E.scenario(book,market(),scenarioParams());ui.resultAt=stamp();render();},'shock-grid':()=>{if(!book.legs.length)throw Error('Record your actual open position before modelling.');readScenario();const p=scenarioParams(),m=market();if(!E.finite(p.spot))throw Error('Enter a scenario spot price.');ui.result=[0,-.03,-.05,-.1].map(shock=>({shock,spot:p.spot*(1+shock),...E.scenario(book,m,{...p,spot:p.spot*(1+shock)})}));ui.resultAt=stamp();render();},'hedge-fetch':()=>{const h=hedgeSettings();commit({...book,hedge:h});refresh();for(const d of s.snapshot?.available_expiries||[])request('hedges',d,true);toast('Listed protection refresh requested. Compare after feeds complete.');},'hedge-rank':()=>{if(!isBookConfirmed())throw Error('Confirm the current book against broker records first.');const h=hedgeSettings();commit({...book,hedge:h});ui.hedges=E.findHedges(book,market(),h);ui.hedgesAt=stamp();render();},'hedge-detail':b=>compareHedge(b.dataset.id),frame:b=>{ui.frame=b.dataset.id;request('candles',ui.frame);render();},candles:()=>request('candles',ui.frame,true),technical:()=>request('candles','D',true),fundamentals:()=>request('fundamentals','D',true),chain:()=>{request('hedges',ui.expiry,true);},news:()=>{request('news','D',true);request('filings','D',true);},'stream-start':()=>native('streamStart'),'stream-stop':()=>native('streamStop'),'patterns-load':()=>request('patterns','D',true),patterns:()=>{const p=D.rawCandles(s,'D','patterns');if(p.error)throw Error('Historical feed refresh failed. Retry before scanning.');ui.pattern=E.patterns(p.raw,{window:value('pattern-window'),forward:value('pattern-forward')});render();},'ai-settings':()=>native('aiSettings'),'ai-review':aiReview,'ai-cancel':()=>{if(ui.pendingAI)native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;ui.aiError='Cancelled by you.';render();},'model-install':()=>native('finbertInstall'),'model-cancel':()=>native('finbertCancel'),'model-remove':()=>modal('Remove offline model','<p>Remove model files from this phone. Portfolio records remain available.</p>','Remove model',()=>native('finbertRemove')),sentiment:()=>{const items=news().filter(n=>n.url).slice(0,12).map(n=>({id:n.url,title:n.title.slice(0,480)}));native('finbertScore',JSON.stringify(items));}};

Object.assign(actions,{
 'go-book':()=>navigate('position','book'),'go-risk':()=>navigate('position','risk'),
 'go-analysis':()=>navigate('technicals','analysis'),
 'open-native-terminal':()=>native('terminal'),
 'analysis-refresh':()=>{request('candles','D',true);request('news','D',true);request('filings','D',true);request('fundamentals','D',true);request('context','D',true);refresh(false);},
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
 'explain-news':b=>{const n=news().find(n=>n.url===b.dataset.url)||book.bookmarks.find(n=>n.url===b.dataset.url);if(n)aiReview({mode:'research',news:[{...n,publishedAt:n.publishedAt||n.published}],question:'Explain this HAL headline and its possible relevance to orders, deliveries, margins or cash flow: '+n.title+'. Use only the supplied headline/summary and sources; identify missing detail and do not claim to have read the full filing.'});}
});
const viewAPI={get:()=>({book,market:market(),evidence:evidence(),sessionBaseline:reviewBaseline}),getBook:()=>book,commit,render,modal,esc,money,num,pct,date,when,row,table,card,btn,tile,badge,input,select,empty,native,navigate,backup:()=>actions.export()};
const historyView=window.HALHistoryViews(viewAPI),recoveryView=window.createHalRecovery(viewAPI),reviewView=window.createHalReview(viewAPI);
 const analysisView=window.createHalAnalysis({...viewAPI,get:()=>({book,market:market(),valuation:ledger(),technical:technical('D'),news:news(),fundamentals:I.providerFundamentals(D.packet(s,'fundamentals','D',ui.statement)),confirmed:isBookConfirmed(),cached:s.cached,integrityBlocked:s.failure==='market_integrity_review'})});
const optionsLab=window.createHalOptionsLab({...viewAPI,labContext:()=>({snapshot:s.snapshot||{},chain:D.packet(s,'hedges',ui.expiry)?.data||D.packet(s,'chain',ui.expiry)?.data||{},chains:Object.values(s.research||{}).map(x=>x?.data).filter(x=>x&&Array.isArray(x.option_rows)&&x.option_rows.length>0),expiry:ui.expiry,market:market(),book}),labSetExpiry:d=>{if(!E.validDate(d))return;ui.expiry=d;request('hedges',d);render();},labRefresh:force=>{if(ui.expiry)request('hedges',ui.expiry,!!force);}});
Object.assign(actions,optionsLab.actions,historyView.actions,recoveryView.actions,reviewView.actions,{'period-review':()=>{ui.reviewOpen=!ui.reviewOpen;render();window.scrollTo(0,0);}});
document.addEventListener('click',ev=>{const a=ev.target.closest('a[href]');if(a){ev.preventDefault();const u=E.safeURL(a.href);if(u)native('openLink',u);return;}const screen=ev.target.closest('[data-screen]'),sub=ev.target.closest('[data-sub]'),b=ev.target.closest('[data-action]');try{if(screen)navigate(screen.dataset.screen);if(sub)navigate(ui.screen,sub.dataset.sub);if(b)actions[b.dataset.action]?.(b);}catch(e){toast(e.message);}});
function rememberInput(id){recoveryView.remember(id);if(id.startsWith('sc-')||id.startsWith('compare-'))clearCalculationOutput();if(id.startsWith('sc-')){readScenario();ui.result=null;ui.resultAt=null;ui.reduction=null;}if(id.startsWith('bt-')){ui.btReport=null;ui.btRegime=null;ui.btSource=null;for(const [k,suffix]of Object.entries({fast:'fast',slow:'slow',fee:'fee',slip:'slip'}))if($('bt-'+suffix))ui.btParams[k]=text('bt-'+suffix);}if(id.startsWith('mc-')){ui.mcVol=text('mc-vol');ui.mcDrift=text('mc-drift');ui.mcResult=null;ui.mcAt=null;}if(id.startsWith('compare-')){for(const k of ['leg','lots','costs'])if($('compare-'+k))ui.compare[k]=text('compare-'+k);ui.reduction=null;}if(id.startsWith('hg-')){ui.hedgeDraft={...(ui.hedgeDraft||book.hedge)};for(const [k,suffix]of Object.entries({budget:'budget',maxLoss:'loss',protectThrough:'through',maxSpread:'spread',buyFees:'buy',exitFees:'exit',slippage:'slip',ivShift:'iv',fallbackIV:'iv-assumption',rate:'rate',dividend:'dividend',minVolume:'volume',minOI:'oi'}))if($('hg-'+suffix))ui.hedgeDraft[k]=text('hg-'+suffix);ui.hedges=null;ui.hedgesAt=null;}if(id==='pattern-window')ui.patternWindow=text(id);if(id==='pattern-forward')ui.patternForward=text(id);if(id.startsWith('pattern-'))ui.pattern=null;if(id==='news-search')ui.search=text(id);if(id==='ai-question')ui.question=text(id);}
document.addEventListener('toggle',ev=>{if(ev.target.id==='scenario-advanced')ui.advanced=ev.target.open;},true);
document.addEventListener('input',ev=>rememberInput(ev.target.id));
document.addEventListener('change',ev=>{const id=ev.target.id;rememberInput(id);historyView.change(id);reviewView.change(id);recoveryView.change(id);if(optionsLab.change(ev.target))return;if(id==='chain-expiry'){ui.expiry=ev.target.value;request('hedges',ui.expiry);render();}if(id==='chain-side'){ui.side=ev.target.value;render();}if(id==='news-filter'){ui.filter=ev.target.value;render();}if(id==='news-search'){ui.search=ev.target.value;render();}if(id==='statement'){ui.statement=ev.target.value;request('fundamentals');render();}if(id==='ai-mode'){ui.aiMode=ev.target.value;render();}if(id==='ai-share')ui.share=ev.target.checked;if(id==='ai-use-history')ui.includeChat=ev.target.checked;});
$('modal-close').onclick=$('modal-cancel').onclick=closeModal;$('modal-save').onclick=()=>{try{saveModal?.();closeModal();}catch(e){$('modal-error').textContent=e.message;}};$('refresh').onclick=()=>refresh();$('settings').onclick=settings;if($('native-terminal'))$('native-terminal').onclick=()=>native('terminal');
document.addEventListener('keydown',ev=>{if($('modal').hidden)return;if(ev.key==='Escape')closeModal();if(ev.key==='Tab'){const nodes=[...$('modal').querySelectorAll('button,input,select,textarea,a')].filter(x=>!x.disabled&&!x.hidden),first=nodes[0],last=nodes.at(-1);if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}});
function receive(event,data){
 if(event==='local_alert'){toast(data.message||'HAL price alert');return;}
 if(event==='history_preview'){try{historyView.preview(data);}catch(e){toast(e.message);}return;}
 if(event==='lifecycle'&&data.state==='resumed'){resumeReview(data.awayMs);s.loading=false;for(const h of Object.values(s.health))if(h.pending){h.pending=null;h.lastAttempt=null;}invalidateCalculations();if(ui.pendingAI){ui.pendingAI=null;ui.aiError='Cancelled when the app left the foreground.';}}
 if(event==='connection'){configured=!!data.configured;if(!started){started=true;if(configured){refresh();request('candles');request('news');request('filings');request('fundamentals');}}}
 if(event==='ai_connection'){ui.aiConfigured=!!data.configured;ui.model=data.model||'';}
 if(['snapshot','error','research','research_error'].includes(event))invalidateCalculations();
 if((event==='research'||event==='research_error')&&data?.section==='candles'&&data?.frame==='D'){
  ui.btReport=null;ui.btRegime=null;ui.btSource=null;
 }
 if(['loading','idle','snapshot','error','research','research_error'].includes(event)){s=D.ingest(s,event,data);if(event==='snapshot'){const dates=(data.available_expiries||[]).filter(E.validDate);if(!ui.expiry||dates.length&&!dates.includes(ui.expiry)){ui.expiry=dates.includes(data.option_expiry)?data.option_expiry:dates[0]||'';if(ui.expiry&&ui.expiry!==data.option_expiry)request('hedges',ui.expiry,true);}if(!ui.scenario.spot)ui.scenario.spot=data.spot?.last_price??'';}if(['snapshot','research','error','research_error'].includes(event))cache();}
 if(event==='stream'){s=D.ingest(s,event,data);if($('stream-view'))$('stream-view').innerHTML=streamView();return;}
 if(event==='reset'){s=D.empty();invalidateCalculations();ui.pattern=null;cache();}
 if(event==='import_preview'){try{importPreview(data);}catch(e){toast('Backup rejected: '+e.message);}return;}
 if(event==='file_saved')toast('File saved.');if(event==='file_error')toast(data.message||'File operation failed.');
 if(event==='ai_result'&&ui.pendingAI?.id===data.id){ui.aiConversationId=ui.pendingAI.conversationId;const p=ui.pendingAI.evidence;ui.ai={...data.data,evidenceAt:data.data?.evidenceGeneratedAt||p.generatedAt,bookRevision:data.data?.bookRevision||p.bookRevision,portfolioIncluded:data.data?.portfolioIncluded??p.portfolioIncluded};ui.pendingAI=null;}
 if(event==='ai_progress'&&ui.pendingAI?.id===data.id){ui.pendingAI.stage=data.data?.stage;ui.pendingAI.label=data.data?.label;}
 if(event==='ai_error'&&ui.pendingAI?.id===data.id){ui.aiError=data.message||'Gemini request failed.';ui.pendingAI=null;}
 if(event==='finbert_status')ui.finbert={...ui.finbert,...data};if(event==='finbert_error')ui.finbert={state:'error',message:data.message};if(event==='finbert_results')for(const x of data.items||[])if(['positive','negative','neutral'].includes(x.label)&&E.finite(x.confidence))ui.sentiments[x.id]=x;
 if(['snapshot','research'].includes(event))captureReview();
 // Do not interrupt editing or a consent preview while new market data arrives.
 if(!document.activeElement?.matches('main input,main select,main textarea'))render();
}
window.HALApp={receive,back:()=>{if(!$('modal').hidden)closeModal();else if(ui.screen!=='position'||ui.position!=='overview'||ui.reviewOpen)navigate('position','overview');else native('minimize');}};
try{const x=D.loadBook(N,localStorage);book=x.book;revision=x.revision;if(x.migrated){const saved=D.saveBook(N,localStorage,book,revision);book=saved.book;revision=saved.revision;}}catch(e){storageError=e.message;}
try{let raw;if(N?.cacheGet){const r=JSON.parse(N.cacheGet('snapshot'));raw=r.ok?r.data:null;}else raw=JSON.parse(localStorage.getItem('hal_cache_v4')||'null');if(!raw){const old=JSON.parse(localStorage.getItem('hal_cache_v2')||'null');if(old)raw={snapshot:old.snapshot,research:old.research,lastSuccess:old.snapshot?.fetched_at_iso};}s=D.restoreCache(raw);}catch(_){s=D.empty();}
beginReview();
if(s.snapshot?.option_expiry&&E.expiryTime(s.snapshot.option_expiry)>=Date.now())ui.expiry=s.snapshot.option_expiry;theme();render();native('ready');native('finbertStatus');
setInterval(()=>{if(document.visibilityState==='visible'&&book.preferences.auto&&configured){refresh(false);}},60000);
setInterval(()=>{for(const [k,h]of Object.entries(s.health))if(h.pending&&Date.now()-Date.parse(h.pending)>180000)s=D.ingest(s,'research_error',{key:k,code:'network_unavailable'});if(document.visibilityState==='visible'&&!document.activeElement?.matches('input,select,textarea')&&$('modal').hidden)render();},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState!=='visible'){hiddenAt=Date.now();native('streamStop');s.loading=false;for(const h of Object.values(s.health))if(h.pending){h.pending=null;h.lastAttempt=null;}invalidateCalculations();if(ui.pendingAI){native('aiCancel',ui.pendingAI.id);ui.pendingAI=null;ui.aiError='Cancelled when the app left the foreground.';}}});
const colorScheme=matchMedia('(prefers-color-scheme: light)'),themeChanged=()=>{theme();render();};if(colorScheme.addEventListener)colorScheme.addEventListener('change',themeChanged);else colorScheme.addListener(themeChanged);window.addEventListener('resize',()=>{if(chart)chart.applyOptions({width:$('market-chart').clientWidth});});
})();
