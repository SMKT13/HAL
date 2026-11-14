/* HAL Options Lab 4.5: advanced research surfaces wrapping the existing paper workbench.
 * No new native permissions, network hosts or broker order endpoints. */
(function(root){
'use strict';
const original=root.createHalOptionsLab;
if(!original)throw Error('Options Lab UI must load before extension.');
root.createHalOptionsLab=function(api){
 const base=original(api),E=root.HALOptionsLab,esc=api.esc,money=api.money,card=api.card,btn=api.btn,empty=api.empty;
 const key='research:optionslab_workspace',prev='research:optionslab_workspace_prev',histKey='research:optionslab_oi_history';
 const st={page:'core',outlook:'all',strategy:'',chartMetric:'pcr',strikeSearch:'',onlyWatch:false,shock:-5,iv:30,rate:6,dividend:0,fee:0,openEvent:false,error:'',message:'',dataReady:false};
 let workspace={version:1,watch:[],events:[],notes:[]},history={version:1,samples:[]},loaded=false,baseRecoverable=false;
 function nativeGet(name){
  const n=root.HALNative;
  if(n?.cacheGet){const r=JSON.parse(n.cacheGet(name));if(!r.ok)throw Error('Cache read error.');return r.data;}
  return JSON.parse(localStorage.getItem('hal_'+name.replace(/[^a-z0-9]/gi,'_'))||'null');
 }
 function nativePut(name,obj){
  const n=root.HALNative,v=JSON.stringify(obj);
  if(n?.cachePut){const r=JSON.parse(n.cachePut(name,v));if(!r.ok)throw Error('Native storage rejected changes.');}
  else localStorage.setItem('hal_'+name.replace(/[^a-z0-9]/gi,'_'),v);
 }
 function cleanWorkspace(x){
  if(!x)return {version:1,watch:[],events:[],notes:[]};
  if(x.version!==1||!Array.isArray(x.watch)||!Array.isArray(x.events)||!Array.isArray(x.notes)||x.watch.length>500||x.events.length>200||x.notes.length>300)throw Error('Invalid Options Lab workspace.');
  return {version:1,watch:[...new Set(x.watch.map(y=>String(y).slice(0,50)))],events:x.events.map(y=>({id:String(y.id||'').slice(0,90),date:String(y.date||'').slice(0,10),title:String(y.title||'').slice(0,140),source:String(y.source||'').slice(0,400)})),notes:x.notes.map(y=>({id:String(y.id||'').slice(0,90),at:String(y.at||'').slice(0,40),text:String(y.text||'').slice(0,1400)}))};
 }
 function load(){
  if(loaded)return;loaded=true;
  try{workspace=cleanWorkspace(nativeGet(key));history=E.history(nativeGet(histKey)||{version:1,samples:[]});st.dataReady=true;}
  catch(e){st.error='Local Options Lab research cache could not be read; it has not been overwritten. '+e.message;st.dataReady=false;}
 }
 function save(){
  if(!st.dataReady)throw Error('Recover workspace cache first; refusing to overwrite unreadable data.');
  const next=cleanWorkspace(workspace),old=nativeGet(key);
  if(old)nativePut(prev,old);nativePut(key,next);workspace=next;
 }
 function info(){const c=api.labContext(),raw=c.chain?.option_rows?.length?c.chain:c.snapshot?.option_rows?.length&&c.snapshot.option_expiry===c.expiry?c.snapshot:c.chain||{};
  const chain=E.normalizeChain({...raw,option_expiry:c.expiry||raw.option_expiry});
  const marketSpot=c.market?.spot?.price??c.snapshot?.spot?.last_price;
  const extra=(c.chains||[]).map(x=>E.normalizeChain(x)).filter(x=>x.rows.length&&x.expiry!==chain.expiry);
  const futures=(c.market?.contracts||[]).filter(x=>x.type==='FUT').map(f=>{const q=c.market?.quotes?.[f.instrumentKey];return {expiry:f.expiry,lotSize:f.lotSize,price:q?.price,instrumentKey:f.instrumentKey};});
  return {...c,chain,extra,futures,spot:marketSpot};
 }
 function nav(){
  const links=[['core','Option chain & builder'],['catalog','38 strategies'],['oi','OI / IV charts'],['greeks','Greeks & risk'],['journal','Watchlist & events']];
  return '<div class="lab-tabs" aria-label="HAL Options Lab workspaces">'+links.map(([id,label])=>btn('lab6-page',label,'data-id="'+id+'" '+(st.page===id?'class="primary"':''))).join('')+'</div>';
 }
 const fmt=(n,places=2)=>Number.isFinite(n)?n.toLocaleString('en-IN',{maximumFractionDigits:places}):'—';
 const rx=t=>esc(t==null?'':String(t));
 const timestamp=x=>x&&Number.isFinite(Date.parse(x))?new Date(x).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'unknown';
 function source(ctx){return '<p class="fine">HAL chain expiry '+rx(ctx.chain.expiry||'unavailable')+' · Upstox HTTP retrieval '+rx(timestamp(ctx.chain.fetchedAt))+' · independently calculated observations. Historical cache is local, not guaranteed continuous.</p>';}
 function catalog(ctx){
  const picks=E.CATALOG.filter(x=>st.outlook==='all'||x.outlook.toLowerCase().includes(st.outlook));
  const select='<label>Filter by outlook<select id="lab6-outlook">'+[['all','All strategy types'],['bullish','Bullish'],['bearish','Bearish'],['range','Range-bound'],['volatile','Volatile'],['time','Time spread'],['manual','Manual']].map(([v,label])=>'<option value="'+v+'" '+(v===st.outlook?'selected':'')+'>'+label+'</option>').join('')+'</select></label>';
  const panel='<div class="lab-catalog-grid">'+picks.map(x=>{
    const kind=x.mode==='manual'?'Manual / ambiguous':x.mode==='two-expiry'?'Two expiry chains':'Listed chain';
    return '<article class="lab-catalog-item"><div><strong>'+rx(x.label)+'</strong><small>'+rx(x.outlook)+' · '+kind+'</small></div>'+btn('lab6-build',x.mode==='manual'?'Build manually':'Load hypothetical legs','data-id="'+x.id+'"')+'</article>';
  }).join('')+'</div>';
  return card('HAL strategy library · 38 reference categories','<p class="fine">These categories were identified in the APK resources. The leg recipes are independent conventional examples, not recovered proprietary Sensibull algorithms. Every strategy is PAPER, and some are unbounded or require physical-delivery margin.</p>'+select+source(ctx)+panel+'<p class="fine">Three ambiguous labels (Batman, double plateau and range forward) intentionally open the manual builder rather than guessing at their composition. Calendar spreads need two separately fetched expiries. Trading is never enabled.</p>');
 }
 function miniPlot(samples,metric){
  const pts=samples.filter(x=>Number.isFinite(x[metric])).slice(-70);
  if(pts.length<2)return empty('Not enough captured observations','Save at least two verified chain snapshots on different provider timestamps.');
  const vals=pts.map(x=>x[metric]),lo=Math.min(...vals),hi=Math.max(...vals),d=hi-lo||1;
  const coords=vals.map((v,i)=>(i*590/(vals.length-1)).toFixed(1)+','+(175-(v-lo)/d*155).toFixed(1)).join(' ');
  return '<div class="lab-chart"><svg viewBox="0 0 620 215" role="img" aria-label="'+rx(metric)+' over saved observations"><line x1="0" x2="590" y1="177" y2="177" stroke="currentColor" opacity=".25"/><polyline fill="none" stroke="#73d9c5" stroke-width="3" points="'+coords+'"/><text x="5" y="12" fill="currentColor" font-size="12">'+fmt(hi,2)+'</text><text x="5" y="190" fill="currentColor" font-size="12">'+fmt(lo,2)+'</text><text x="5" y="210" fill="currentColor" font-size="11">'+rx(timestamp(pts[0].at))+'</text><text x="465" y="210" fill="currentColor" font-size="11">'+rx(timestamp(pts[pts.length-1].at))+'</text></svg></div>';
 }
 function oi(ctx){
  const chain=ctx.chain,spot=ctx.spot,a=E.analytics(chain,spot),saved=history.samples.filter(x=>x.expiry===chain.expiry),ivp=E.ivPercentile(history,chain.expiry);
  const latest=chain.rows.length?chain.rows.reduce((p,q)=>Math.abs(p.strike-spot)<Math.abs(q.strike-spot)?p:q,chain.rows[0]):null;
  const q1=latest?E.info(latest.call):{},q2=latest?E.info(latest.put):{},straddle=Number.isFinite(q1.price)&&Number.isFinite(q2.price)?q1.price+q2.price:null;
  const metrics='<div class="metrics">'+[['Put/call OI ratio',fmt(a.pcr,3)],['Derived max pain',a.maxPain===null?'Unavailable':'₹'+fmt(a.maxPain,0)],['ATM implied vol',a.atmIv===null?'Unavailable':fmt(a.atmIv,2)+'%'],['ATM rolling straddle',straddle===null?'Unavailable':money(straddle)]].map(x=>'<div class="metric"><small>'+rx(x[0])+'</small><strong>'+rx(x[1])+'</strong></div>').join('')+'</div>';
  const controls='<div class="form-grid"><label>Historical indicator<select id="lab6-chartMetric">'+[['pcr','Put/call OI ratio'],['iv','ATM IV'],['callOI','Call OI'],['putOI','Put OI'],['rollingStraddle','Rolling ATM straddle'],['maxPain','Max pain'],['spot','HAL spot']].map(([v,t])=>'<option value="'+v+'" '+(st.chartMetric===v?'selected':'')+'>'+rx(t)+'</option>').join('')+'</select></label></div><div class="toolbar">'+btn('lab6-capture','Save timestamped observation','class="primary"')+btn('lab6-refresh','Refresh listed HAL option chain')+'</div>';
  const oiBars='<div class="lab-chain-bars">'+a.rows.slice(0,70).map(x=>{
   const ce=x.call.oi||0,pe=x.put.oi||0,max=Math.max(ce,pe,1);
   return '<div class="lab-bar-row"><small>₹'+fmt(x.strike,0)+'</small><span title="CE open interest '+ce+'"><i style="width:'+(ce/max*100).toFixed(1)+'%;background:#a397e5"></i></span><span title="PE open interest '+pe+'"><i style="width:'+(pe/max*100).toFixed(1)+'%;background:var(--accent)"></i></span></div>';
  }).join('')+'</div>';
  return card('HAL OI · IV · PCR · option positioning',source(ctx)+metrics+controls+'<div class="metrics"><div class="metric"><small>Captured sessions (selected expiry)</small><strong>'+new Set(saved.map(s=>s.day)).size+'</strong></div><div class="metric"><small>IV percentile</small><strong>'+(Number.isFinite(ivp.value)?fmt(ivp.value,1)+'%':'Unavailable')+'</strong><small>'+rx(ivp.reason||ivp.method||'')+'</small></div></div>'+miniPlot(saved,st.chartMetric)+'<h3>Call OI / Put OI by strike</h3><p class="fine">Purple: call OI. Green: put OI. Each row is scaled independently; use values from Chain to compare absolute quantities. Missing values are not assumed tradable.</p>'+oiBars+'<p class="fine">No provider historical OI or IV is invented. Saved snapshots only accumulate when you explicitly open this feature and capture data, or when you refresh it. PCR and max pain are descriptive—not predictive. IVP requires at least 20 distinct saved sessions for the *same expiry*, so it is frequently unavailable.</p>');
 }
 function risk(ctx){
  const draft=base.getDraft(),legs=draft.legs,spot=Number.isFinite(st.spot)?st.spot:ctx.spot,px=spot*(1+Number(st.shock)/100);
  const controls='<div class="form-grid"><label>Assumed HAL IV (%)<input id="lab6-iv" type="number" value="'+rx(st.iv)+'" min="0.01" max="500" step="0.1"></label><label>Rate (%)<input id="lab6-rate" type="number" value="'+rx(st.rate)+'" step="0.25"></label><label>Dividend yield (%)<input id="lab6-dividend" type="number" value="'+rx(st.dividend)+'" step="0.25"></label><label>Estimated fees (₹)<input id="lab6-fee" type="number" min="0" value="'+rx(st.fee)+'"></label></div><label>HAL scenario shock: '+rx(st.shock)+'% <input id="lab6-shock" type="range" min="-30" max="30" step="1" value="'+rx(st.shock)+'"></label>';
  let computed='';
  try{
   if(!legs.length)throw Error('Create a PAPER strategy in the main builder, or copy your actual positions first.');
   const g=E.greeks(legs,{spot:px,iv:Number(st.iv),rate:Number(st.rate),dividend:Number(st.dividend)}),risk=E.riskSummary(legs,px,Number(st.fee)),net=g.net;
   let pText='Unavailable';
   try{const p=E.pop(legs,px,Number(st.iv),Number(st.rate),Number(st.dividend));pText=fmt(p.probability*100,1)+'% (theoretical)';}catch(_){}
   const metrics='<div class="metrics">'+[['Model net delta',fmt(net.delta,2)],['Model gamma',fmt(net.gamma,3)],['Theta / calendar day',money(net.thetaDay)],['Vega / IV point',money(net.vegaPoint)],['Probability of profit',pText],['Price shock',rx(st.shock)+'%']].map(x=>'<div class="metric"><small>'+rx(x[0])+'</small><strong>'+rx(x[1])+'</strong></div>').join('')+'</div>';
   const table='<div class="table-wrap"><table><thead><tr><th>Paper leg</th><th>Model price</th><th>Δ</th><th>Γ</th><th>Θ/day</th><th>Vega/pt</th></tr></thead><tbody>'+g.rows.map(r=>'<tr>'+[r.leg.side+' '+r.leg.type+' '+(r.leg.strike||''),money(r.modelPrice),fmt(r.delta,2),fmt(r.gamma,3),money(r.thetaDay),money(r.vegaPoint)].map(x=>'<td>'+rx(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
   const worst=risk.exact?'At common expiry: max gain '+(risk.maxProfit===Infinity?'unbounded':money(risk.maxProfit))+'; max loss '+(risk.maxLoss===Infinity?'unbounded':money(risk.maxLoss)):'No exact common-expiry risk bound is available.';
   computed=metrics+table+'<p class="warning fine">'+rx(worst)+'</p>'+risk.issues.map(x=>'<p class="warning fine">'+rx(x)+'</p>').join('');
  }catch(e){computed=empty('Calculation withheld',e.message);}
  return card('Strategy model Greeks, risk and hypothetical POP','<p class="fine">Independent theoretical model—never substitute this for Upstox provider Greeks, risk-margin requirements or actual position values.</p>'+source(ctx)+controls+btn('lab6-recalc','Update scenario','class="primary"')+computed+'<p class="fine">Model assumes European Black–Scholes, constant IV and rates and lognormal price distribution; probability is risk-neutral, not a real-world success rate. Short stock options can have delivery obligations and changing margin. Exercise/settlement, funding, slippage and capital requirements are not forecast.</p>');
 }
 function journal(ctx){
  const s=st.strikeSearch.trim(),ws=workspace.watch;
  const strikes=ctx.chain.rows.filter(r=>(!s||String(r.strike).includes(s))&&(!st.onlyWatch||ws.includes(String(r.strike)))).slice(0,120);
  const listed='<div class="form-grid"><label>Find strike<input id="lab6-strikeSearch" type="search" value="'+rx(st.strikeSearch)+'" placeholder="4500"></label><label><input id="lab6-onlyWatch" type="checkbox" '+(st.onlyWatch?'checked':'')+'>Only watched strikes</label></div>';
  const rows=strikes.map(r=>{
   const ce=E.info(r.call),pe=E.info(r.put),ca=E.quoteSafety(r.call),pa=E.quoteSafety(r.put),watched=ws.includes(String(r.strike));
   return '<div class="lab-watch-row"><div><strong>₹'+fmt(r.strike,0)+'</strong><small>CE '+money(ce.price)+' · PE '+money(pe.price)+'</small><small>Spread CE '+fmt(ca.spread)+'% / PE '+fmt(pa.spread)+'% · '+(ca.issues.length?'CE review':'CE timestamps valid')+' · '+(pa.issues.length?'PE review':'PE timestamps valid')+'</small></div>'+btn('lab6-watch',watched?'Unwatch':'Watch','data-id="'+r.strike+'"')+'</div>';
  }).join('')||empty('No matching listed strikes');
  const events=workspace.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(n=>'<div class="lab-watch-row"><div><strong>'+rx(n.date)+' · '+rx(n.title)+'</strong><small>Manually entered event · '+rx(n.source||'source not recorded')+'</small></div>'+btn('lab6-event-delete','Delete','data-id="'+rx(n.id)+'"')+'</div>').join('')||empty('No HAL events recorded');
  const notes=workspace.notes.slice(-25).reverse().map(n=>'<div class="lab-watch-row"><div><small>'+rx(timestamp(n.at))+'</small><p>'+rx(n.text)+'</p></div>'+btn('lab6-note-delete','Delete','data-id="'+rx(n.id)+'"')+'</div>').join('')||empty('No discipline notes');
  const inputs='<div class="form-grid"><label>Event date<input type="date" id="lab6-event-date"></label><label>Event title<input id="lab6-event-title" placeholder="HAL earnings / order review"></label><label>Source note or URL<input id="lab6-event-source" placeholder="User-entered source"></label></div>'+btn('lab6-event-add','Save event','class="primary"');
  const journalInput='<label>Trading discipline note<textarea id="lab6-note-text" maxlength="1400" rows="3" placeholder="Write your plan, invalidation, what changed or emotional state"></textarea></label>'+btn('lab6-note-add','Save private note','class="primary"');
  return card('Watchlist, HAL events and trading discipline',source(ctx)+'<h3>Watched option strikes</h3>'+listed+rows+'<h3>HAL event calendar (manual)</h3>'+inputs+events+'<h3>Trading discipline journal</h3>'+journalInput+notes+'<p class="fine">Separate local research cache. Events are reminders to review, not verified exchange announcements; no background notifications are promised. For official filings, use HAL Desk → Fundamentals & news.</p>');
 }
 function render(){load();const ctx=info();return '<section class="lab-advanced"><p class="eyebrow">HAL OPTIONS LAB · Advanced research (PAPER)</p>'+nav()+(st.error?'<p class="warning" role="alert">'+rx(st.error)+'</p>':'')+(st.message?'<p class="fine" role="status">'+rx(st.message)+'</p>':'')+(st.page==='core'?base.view():st.page==='catalog'?catalog(ctx):st.page==='oi'?oi(ctx):st.page==='greeks'?risk(ctx):journal(ctx))+'</section>';}
 function setPage(next){if(!['core','catalog','oi','greeks','journal'].includes(next))throw Error('Unknown workspace');st.page=next;if(next==='oi'&&info().chain.expiry)api.labRefresh(false);}
 function action(name,el){
  load();st.error='';st.message='';const id=el?.dataset.id,ctx=info();
  try{
   if(name==='lab6-page'){setPage(id);}
   else if(name==='lab6-build'){
    const def=E.CATALOG.find(x=>x.id===id);if(!def)throw Error('Unknown template');
    if(def.mode==='manual'){st.page='core';base.setView('builder');st.message='This category requires a manually specified contract recipe; no proprietary strategy details were inferred.';}
    else{
     const legs=E.template(id,ctx.chain,ctx.spot,{otherChains:ctx.extra,futures:ctx.futures});
     base.loadStrategy(legs);st.page='core';st.message='Illustrative PAPER recipe: '+def.label+'. Verify contract quantities and liquidity before interpreting any results.';
    }
   }
   else if(name==='lab6-refresh')api.labRefresh(true);
   else if(name==='lab6-capture'){
    const s=E.snapshot(ctx.chain,ctx.spot);
    const next=E.appendHistory(history,s);nativePut(histKey,next);history=next;st.message='Saved '+s.expiry+' option observation retrieved '+timestamp(s.at)+'.';
   }
   else if(name==='lab6-watch'){
    if(!st.dataReady)throw Error('Workspace cache unavailable.');
    const found=ctx.chain.rows.some(r=>String(r.strike)===id);if(!found)throw Error('Strike is no longer listed.');
    workspace.watch=workspace.watch.includes(id)?workspace.watch.filter(x=>x!==id):[...workspace.watch,id];save();
   }
   else if(name==='lab6-event-add'){
    const value=id=>document.getElementById(id)?.value||'',date=value('lab6-event-date'),title=value('lab6-event-title').trim(),source=value('lab6-event-source').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||!title||title.length>140||source.length>400)throw Error('Enter an event date and concise title.');
    workspace.events.push({id:'event-'+Date.now(),date,title,source});save();
   }
   else if(name==='lab6-event-delete'){workspace.events=workspace.events.filter(x=>x.id!==id);save();}
   else if(name==='lab6-note-add'){
    const text=document.getElementById('lab6-note-text')?.value.trim()||'';if(!text||text.length>1400)throw Error('Write a note (up to 1400 characters).');
    workspace.notes.push({id:'note-'+Date.now(),at:new Date().toISOString(),text});save();
   }
   else if(name==='lab6-note-delete'){workspace.notes=workspace.notes.filter(x=>x.id!==id);save();}
   else if(name==='lab6-recalc'){}
   else return false;
  }catch(e){st.error=e.message;}api.render();return true;
 }
 function change(el){
  const id=el?.id;if(!id?.startsWith('lab6-'))return base.change(el);
  const k=id.slice(5),fields=['outlook','chartMetric','strikeSearch','shock','iv','rate','dividend','fee'];
  if(k==='onlyWatch')st.onlyWatch=el.checked;
  else if(fields.includes(k))st[k]=['shock','iv','rate','dividend','fee'].includes(k)?Number(el.value):el.value;
  else return false;
  api.render();return true;
 }
 const actions={...base.actions};for(const n of ['page','build','refresh','capture','watch','event-add','event-delete','note-add','note-delete','recalc'])actions['lab6-'+n]=b=>action('lab6-'+n,b);
 return {view:render,actions,change};
};
})(typeof globalThis!=='undefined'?globalThis:this);
