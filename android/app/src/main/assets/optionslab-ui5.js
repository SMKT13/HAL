/* HAL Desk 4.4 Options Lab UI. Deliberately isolated from actual portfolio writes. */
(function(root){
'use strict';
root.createHalOptionsLab=function(api){
 const E=root.HALOptionsLab,esc=api.esc,money=api.money,num=api.num,card=api.card,btn=api.btn,row=api.row,empty=api.empty;
 const key='research:optionslab_paper',previous='research:optionslab_previous';
 const state={view:'chain',legs:[],editing:null,editIndex:null,mode:'expiry',fees:0,spot:null,horizon:'',iv:30,rate:6,dividend:0,basis:0,template:'long-call',overlay1:'',overlay2:'',closeId:null,chainSearch:'',minOI:0,maxSpread:100,onlyQuoted:false,source:'No verified option chain loaded',error:''};
 let paper={version:1,drafts:[]},loaded=false,committedPaper={version:1,drafts:[]};
 const copy=x=>JSON.parse(JSON.stringify(x));
 function save(skipPrevious=false){
  const data=E.paperDoc(paper),serialized=JSON.stringify(data),native=root.HALNative;
  let persisted=null;
  try{
   if(native?.cachePut){
    const previousResult=JSON.parse(native.cacheGet(key));
    if(!previousResult.ok)throw Error('Cannot verify current PAPER data; changes withheld.');
    persisted=previousResult.data;
    if(!skipPrevious&&persisted){const backup=JSON.parse(native.cachePut(previous,JSON.stringify(E.paperDoc(persisted))));if(!backup.ok)throw Error('Previous PAPER snapshot could not be preserved.');}
    const result=JSON.parse(native.cachePut(key,serialized));
    if(!result.ok)throw Error('PAPER write failed; no actual positions were changed.');
   }else{
    persisted=JSON.parse(localStorage.getItem('hal_paper_v1')||'null');
    if(!skipPrevious&&persisted)localStorage.setItem('hal_paper_previous_v1',JSON.stringify(E.paperDoc(persisted)));
    localStorage.setItem('hal_paper_v1',serialized);
   }
   paper=data;committedPaper=copy(data);
  }catch(e){
   // Revert to the last verified successful write, even if the latest cache read failed.
   paper=copy(committedPaper);
   throw e;
  }
 }
 function load(){
  if(loaded)return;loaded=true;
  try{const native=root.HALNative,reply=native?.cacheGet?JSON.parse(native.cacheGet(key)):null,raw=reply?(reply.ok?reply.data:null):JSON.parse(localStorage.getItem('hal_paper_v1')||'null');paper=raw?E.paperDoc(raw):{version:1,drafts:[]};committedPaper=copy(paper);}
  catch(e){paper={version:1,drafts:[]};state.error='Paper drafts unavailable: '+e.message+'. Existing actual holdings are unaffected.';}
 }
 const get=()=>api.labContext();
 function context(){
  const x=get(),raw=x.chain?.option_rows?.length?x.chain:x.snapshot?.option_rows?.length&&x.snapshot?.option_expiry===x.expiry?x.snapshot:x.chain||{};
  // A different expiry's cached strikes must never be relabelled as the selected expiry.
  const mismatch=!!(x.expiry&&raw.option_expiry&&raw.option_expiry!==x.expiry);
  const base=mismatch?{}:raw;
  return {...x,chain:E.normalizeChain({...base,option_expiry:x.expiry||base.option_expiry,chain_error:mismatch?'expiry_snapshot_mismatch':base.chain_error})};
 }
 function fmt(x,d=2){return typeof x==='number'&&Number.isFinite(x)?x.toLocaleString('en-IN',{maximumFractionDigits:d}):'—';}
 function tools(){return '<div class="lab-tabs">'+[['chain','Chain'],['builder','Strategy'],['payoff','Payoff'],['oi','OI / IV'],['paper','Paper trades']].map(x=>btn('lab-tab',x[1],'data-id="'+x[0]+'" '+(state.view===x[0]?'class="primary"':''))).join('')+'</div>';}
 function shown(o){const q=E.info(o);return [q.price,q.bid,q.ask,q.volume,q.oi,q.iv,q.delta].map(x=>fmt(x,3));}
 function chain(ctx){
  const c=ctx.chain,spot=ctx.market?.spot?.price||ctx.snapshot?.spot?.last_price||0,a=E.analytics(c,spot);
  const search=String(state.chainSearch||''),minimumOI=Number(state.minOI)||0,maxSpread=Number(state.maxSpread);
  const filter=q=>{
   const spread=Number.isFinite(q.ask)&&q.ask>0&&Number.isFinite(q.bid)&&q.bid>0?(q.ask-q.bid)/q.ask*100:null;
   return !!q.instrumentKey&&Number.isFinite(q.lotSize)&&Number.isFinite(spread)&&spread>=0&&(!Number.isFinite(maxSpread)||spread<=maxSpread);
  };
  const rows=c.rows.filter(r=>{
   const ce=E.info(r.call),pe=E.info(r.put);
   return (!search||String(r.strike).includes(search))&&Math.max(ce.oi||0,pe.oi||0)>=minimumOI&&(!(state.onlyQuoted||Number.isFinite(maxSpread)&&maxSpread<100)||filter(ce)||filter(pe));
  });
  const expiries=(ctx.snapshot?.available_expiries||[]).filter(x=>typeof x==='string');
  const expiry='<label>Expiry<select id="lab-expiry">'+expiries.map(d=>'<option value="'+esc(d)+'" '+(d===ctx.expiry?'selected':'')+'>'+esc(d)+'</option>').join('')+'</select></label>';
  const filters='<div class="form-grid"><label>Search strike<input id="lab-chain-search" type="search" placeholder="e.g. 4500" value="'+esc(state.chainSearch)+'"></label><label>Min OI<input id="lab-chain-minOI" type="number" min="0" value="'+esc(state.minOI)+'"></label><label>Max bid/ask spread (%)<input id="lab-chain-maxSpread" type="number" min="0" max="100" value="'+esc(state.maxSpread)+'"></label><label><input type="checkbox" id="lab-chain-onlyQuoted" '+(state.onlyQuoted?'checked':'')+'>Only quoted contracts with verified lot size</label></div>';
  const headers=['CE Add','CE Bid / Ask','CE OI','CE IV','CE Delta','CE Vol','Strike','PE Vol','PE Delta','PE IV','PE OI','PE Bid / Ask','PE Add'];
  const table='<div class="table-wrap lab-chain"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(0,180).map(r=>{
   const call=E.info(r.call),put=E.info(r.put),highlight=Number.isFinite(spot)&&Math.abs(r.strike-spot)<=Math.max(1,spot*.005);
   const add=(type,side,q)=>q.instrumentKey&&Number.isFinite(q.lotSize)&&Number.isFinite(side==='LONG'?q.ask:q.bid)?btn('lab-add',side==='LONG'?'Buy':'Sell','data-strike="'+r.strike+'" data-type="'+type+'" data-side="'+side+'"'):'';
   const values=[add('CE','LONG',call)+' '+add('CE','SHORT',call),fmt(call.bid)+' / '+fmt(call.ask),fmt(call.oi,0),fmt(call.iv,2),fmt(call.delta,3),fmt(call.volume,0),fmt(r.strike,0),fmt(put.volume,0),fmt(put.delta,3),fmt(put.iv,2),fmt(put.oi,0),fmt(put.bid)+' / '+fmt(put.ask),add('PE','LONG',put)+' '+add('PE','SHORT',put)];
   return '<tr'+(highlight?' class="lab-atm"':'')+'>'+values.map((v,i)=>(i===6?'<th>':'<td>')+v+(i===6?'</th>':'</td>')).join('')+'</tr>';
  }).join('')+'</tbody></table></div>';
  const metrics='<div class="metrics">'+[['Put/call OI ratio',a.pcr],['Derived max pain',a.maxPain],['Call OI',a.callOI],['Put OI',a.putOI]].map(x=>'<div class="metric"><small>'+esc(x[0])+'</small><strong>'+fmt(x[1],2)+'</strong></div>').join('')+'</div>';
  return card('HAL · Options chain',expiry+filters+'<div class="toolbar">'+btn('lab-refresh','Refresh selected chain','class="primary"')+btn('lab-tab','Build hypothetical strategy','data-id="builder"')+'</div><p class="fine">Upstox chain · HTTP retrieval '+esc(c.fetchedAt||ctx.snapshot?.fetched_at_iso||'unknown')+' · expiry '+esc(ctx.expiry||'not selected')+'. Displayed quotes are indicative; filtering never changes the underlying portfolio.</p>'+metrics+'<p class="fine">Showing '+rows.length+' of '+c.rows.length+' strikes; full-chain statistics are unaffected by filters.</p>'+(rows.length?table:empty('No matching listed contracts','Refresh, change expiry, or relax search and liquidity filters.'))+'<p class="fine">Provider IV/Greeks may have different freshness from HTTP retrieval. Verify timestamps before relying on quotes. PAPER buttons cannot place orders.</p>');
 }
 function builder(ctx){
  const snapshot=ctx.snapshot||{},underlying=ctx.market?.spot?.price||snapshot.spot?.last_price||null;
  const opts=E.TEMPLATES.map(t=>'<option value="'+t[0]+'" '+(t[0]===state.template?'selected':'')+'>'+esc(t[1])+'</option>').join('');
  const current=state.legs.map((l,i)=>'<div class="lab-leg"><div><strong>'+esc(l.side)+' '+esc(l.type)+(l.strike?' ₹'+fmt(l.strike,0):'')+'</strong><small>'+esc(l.expiry)+' · '+fmt(l.lots,0)+' × '+fmt(l.lotSize,0)+' units · '+money(l.entry)+' · '+esc(l.origin)+'</small></div>'+btn('lab-edit','Edit','data-id="'+i+'"')+btn('lab-duplicate','Duplicate','data-id="'+i+'"')+btn('lab-remove','Remove','data-id="'+i+'"')+'</div>').join('')||empty('No paper legs','Pick a strategy template, add an option from the chain, or enter a hypothetical contract.');
  const entry='<details><summary>Manually add a paper leg</summary><div class="form-grid"><label>Contract<select id="lab-new-type"><option>CE</option><option>PE</option><option>FUT</option></select></label><label>Direction<select id="lab-new-side"><option value="LONG">Buy / long</option><option value="SHORT">Sell / short</option></select></label><label>Expiry<input id="lab-new-expiry" type="date" value="'+esc(ctx.expiry||'')+'"></label><label>Strike<input id="lab-new-strike" type="number" inputmode="decimal" placeholder="For CE / PE"></label><label>Lots<input id="lab-new-lots" type="number" min="1" value="1"></label><label>Verified units / lot<input id="lab-new-size" type="number" min="1"></label><label>Hypothetical entry price<input id="lab-new-entry" type="number" min="0" step="any"></label></div>'+btn('lab-manual','Add PAPER leg','class="primary"')+'</details>';
  return card('Paper strategy builder','<p class="fine">PAPER ONLY — no real positions or orders are changed. Templates use quoted buy/sell prices and verified lot sizes when available.</p><div class="form-grid"><label>Strategy<select id="lab-template">'+opts+'</select></label></div><div class="toolbar">'+btn('lab-use-template','Build template','class="primary"')+btn('lab-import-actual','Copy my actual position to PAPER')+btn('lab-clear','Clear draft')+'</div><h3>Hypothetical legs</h3>'+current+entry+'<div class="toolbar">'+btn('lab-tab','View payoff','data-id="payoff" class="primary"')+btn('lab-paper-save','Save paper draft')+'</div><p class="fine">Current HAL spot: '+money(underlying)+'. A protective-put template assumes a same-expiry future at spot as a hypothetical example; edit as needed. Imported actual positions are copied, never altered.</p>');
 }
 function linePath(samples,xmin,xmax,ymin,ymax,w,h){
  return samples.map((p,i)=>(i?'L':'M')+((p.spot-xmin)/(xmax-xmin)*w).toFixed(1)+' '+(h-(p.pnl-ymin)/(ymax-ymin)*h).toFixed(1)).join(' ');
 }
 function graph(lines){
  const s=lines.flatMap(l=>l.data),xmin=Math.min(...s.map(x=>x.spot)),xmax=Math.max(...s.map(x=>x.spot)),ymin=Math.min(0,...s.map(x=>x.pnl)),ymax=Math.max(0,...s.map(x=>x.pnl));
  const ySpan=ymax-ymin||1,xSpan=xmax-xmin||1,W=640,H=220,zero=H-(0-ymin)/ySpan*H;
  const colors=['#73d9c5','#f5c27f','#b5a6f4'];
  return '<div class="lab-chart"><svg viewBox="0 0 640 245" role="img" aria-label="Hypothetical HAL strategy profit and loss across underlying prices"><path d="M0 '+zero+' H640" stroke="currentColor" opacity=".45" stroke-dasharray="4 4"/>'+lines.map((l,i)=>'<path d="'+linePath(l.data,xmin,xmax,ymin,ymax,W,H)+'" stroke="'+colors[i%colors.length]+'" fill="none" stroke-width="2.5"/>').join('')+'<text x="5" y="239" fill="currentColor" font-size="12">₹'+fmt(xmin,0)+'</text><text x="565" y="239" fill="currentColor" font-size="12">₹'+fmt(xmax,0)+'</text><text x="5" y="16" fill="currentColor" font-size="11">'+money(ymax)+'</text><text x="5" y="210" fill="currentColor" font-size="11">'+money(ymin)+'</text></svg><p class="fine">'+lines.map((l,i)=>'<span style="color:'+colors[i%colors.length]+'">● '+esc(l.name)+'</span>').join(' · ')+'</p></div>';
 }
 function payoff(ctx){
  const spot=Number(state.spot)||ctx.market?.spot?.price||ctx.snapshot?.spot?.last_price||0,mode=state.mode,opts={mode,fees:Number(state.fees),horizon:state.horizon,iv:Number(state.iv),rate:Number(state.rate),dividend:Number(state.dividend),basis:Number(state.basis)};
  const control='<div class="form-grid"><label>Payoff type<select id="lab-mode"><option value="expiry" '+(mode==='expiry'?'selected':'')+'>Exact shared expiry</option><option value="target" '+(mode==='target'?'selected':'')+'>Modelled target date</option></select></label><label>Scenario HAL price (₹)<input type="number" id="lab-spot" value="'+esc(spot||'')+'" step="any"></label><label>Estimated total charges (₹)<input type="number" id="lab-fees" value="'+esc(state.fees)+'" min="0"></label></div><details '+(mode==='target'?'open':'')+'><summary>Target date / IV and futures basis assumptions</summary><div class="form-grid"><label>Target date (blank = now)<input id="lab-horizon" type="date" value="'+esc(state.horizon)+'"></label><label>Assumed IV (%)<input id="lab-iv" type="number" min="0" max="500" value="'+esc(state.iv)+'"></label><label>Interest (%)<input id="lab-rate" type="number" value="'+esc(state.rate)+'"></label><label>Dividend yield (%)<input id="lab-dividend" type="number" value="'+esc(state.dividend)+'"></label><label>Futures basis in ₹ (assumed)<input id="lab-basis" type="number" value="'+esc(state.basis)+'"></label></div></details>';
  const choices=paper.drafts.filter(d=>d.legs.length).map(d=>'<option value="'+esc(d.id)+'">'+esc(d.name)+'</option>').join('');
  const overlays='<div class="form-grid">'+['overlay1','overlay2'].map(k=>'<label>Overlay PAPER strategy<select id="lab-'+k+'"><option value="">None</option>'+paper.drafts.filter(d=>d.legs.length).map(d=>'<option value="'+esc(d.id)+'" '+(state[k]===d.id?'selected':'')+'>'+esc(d.name)+'</option>').join('')+'</select></label>').join('')+'</div>';
  let output='';
  try{
   const v=E.evaluate(state.legs,opts),summary=E.summary(v,spot),lines=[{name:'Current paper strategy',data:E.plot(v,spot)}],issues=[];
   for(const id of [state.overlay1,state.overlay2])if(id){const draft=paper.drafts.find(d=>d.id===id);if(draft)try{lines.push({name:draft.name,data:E.plot(E.evaluate(draft.legs,{...opts,fees:draft.fees}),spot)});}catch(e){issues.push(draft.name+': '+e.message);}}
   const metric='<div class="metrics">'+[['At scenario spot',money(summary.atSpot)],['Best achievable P&L',v.exact?(summary.maxProfit===Infinity?'Unbounded':money(summary.maxProfit)):'Not established'],['Maximum potential loss',v.exact?(summary.maxLoss===Infinity?'Unbounded':money(summary.maxLoss)):'Not established'],['Exact breakevens',v.exact?(summary.breakevens.map(x=>'₹'+fmt(x)).join(', ')||'None identified'):'Model-only']].map(x=>'<div class="metric"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('')+'</div>';
   output=metric+graph(lines)+(issues.length?'<p class="warning">'+esc(issues.join('; '))+'</p>':'')+'<p class="fine">'+(v.exact?'Exact intrinsic-value payoff at common expiry. Prices assumed nonnegative.':'Black–Scholes theoretical options at target date with user-assumed IV; future mark = HAL scenario spot + user-assumed basis.')+' P&L is relative to hypothetical entry prices, includes entered charges once, and does not include margin funding, physical delivery or market execution.</p>';
  }catch(e){output=empty('Payoff unavailable',e.message);}
  return card('Interactive PAPER payoff',control+overlays+btn('lab-recalc','Recalculate','class="primary"')+output);
 }
 function oi(ctx){
  const a=E.analytics(ctx.chain,ctx.market?.spot?.price||ctx.snapshot?.spot?.last_price||0);
  const cols=['Strike','CE OI','CE ΔOI','CE IV','PE OI','PE ΔOI','PE IV'];
  const rows=a.rows.map(x=>'<tr>'+[fmt(x.strike,0),fmt(x.call.oi,0),x.call.prevOi!==null&&x.call.oi!==null?fmt(x.call.oi-x.call.prevOi,0):'—',fmt(x.call.iv),fmt(x.put.oi,0),x.put.prevOi!==null&&x.put.oi!==null?fmt(x.put.oi-x.put.prevOi,0):'—',fmt(x.put.iv)].map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('');
  return card('HAL derivatives intelligence','<div class="metrics">'+[['Put/call OI ratio',fmt(a.pcr,3)],['Max pain (derived)',a.maxPain===null?'—':'₹'+fmt(a.maxPain,0)],['ATM IV (%)',fmt(a.atmIv,2)],['OI change available?',a.changeAvailable?'Some fields':'No verified baseline']].map(x=>'<div class="metric"><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('')+'</div><div class="table-wrap"><table><thead><tr>'+cols.map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div><p class="fine">Current chain only; previous OI and changes require provider fields. IV percentile and historical OI charts are deliberately not estimated without a validated snapshot series. Max pain is not a trading signal.</p>');
 }
 function paperView(){
  const drafts=paper.drafts.slice().reverse().map(d=>'<div class="lab-leg"><div><strong>'+esc(d.name)+'</strong><small>PAPER · '+esc(d.status.toUpperCase())+' · '+d.legs.length+' legs · created '+esc(d.createdAt||'unknown')+'</small>'+(d.status==='closed'&&d.exits.length===d.legs.length?'<small>Recorded hypothetical P&L '+money(d.legs.reduce((sum,l,i)=>sum+(d.exits[i]-l.entry)*E.unit(l)*(l.side==='LONG'?1:-1),-d.fees))+'</small>':'')+'</div><div class="toolbar">'+btn('lab-load','Open','data-id="'+esc(d.id)+'"')+(d.status==='draft'?btn('lab-open','Mark paper open','data-id="'+esc(d.id)+'"'):'')+(d.status==='open'?btn('lab-close-start','Paper exit','data-id="'+esc(d.id)+'"'):'')+btn('lab-paper-rename','Name / notes','data-id="'+esc(d.id)+'"')+btn('lab-paper-clone','Clone','data-id="'+esc(d.id)+'"')+btn('lab-delete','Delete','data-id="'+esc(d.id)+'"')+'</div></div>').join('')||empty('No paper strategies','Save a draft from the Strategy tab.');
  const closing=paper.drafts.find(d=>d.id===state.closeId),exit=closing?'<div class="card"><h3>Record hypothetical closing prices · '+esc(closing.name)+'</h3><div class="form-grid">'+closing.legs.map((l,i)=>'<label>'+esc(l.side+' '+l.type+' '+(l.strike||''))+' exit price (₹)<input type="number" id="lab-exit-'+i+'" min="0" step="any"></label>').join('')+'<label>Total PAPER trade fees (opening + closing, ₹)<input type="number" id="lab-exit-fees" value="'+closing.fees+'" min="0" step="any"></label></div>'+btn('lab-close-confirm','Record PAPER exit','class="primary"')+'</div>':'';
  return card('Virtual paper trading','<p class="fine">PAPER — NO BROKER ORDERS. Hypothetical prices and exit outcomes are user-entered. This ledger never merges into actual Position or History.</p>'+drafts+exit+'<div class="toolbar">'+btn('lab-paper-save','Save current draft','class="primary"')+btn('lab-export','Export PAPER JSON')+btn('lab-recover','Restore previous PAPER snapshot')+'</div><details><summary>Import separate PAPER JSON (replace drafts)</summary><textarea id="lab-import-json" rows="5" placeholder="Paste exported PAPER JSON"></textarea><label><input id="lab-import-confirm" type="checkbox">Replace my paper drafts only</label>'+btn('lab-import','Import PAPER data')+'</details>');
 }
 function view(){load();const c=context();if(state.spot===null)state.spot=c.market?.spot?.price||c.snapshot?.spot?.last_price||null;
  return '<section class="lab-shell"><p class="eyebrow">HAL OPTIONS LAB · Paper / Analysis only</p><p class="fine">Sensibull-inspired, independently implemented. No order placement. Real positions/history are unchanged.</p>'+tools()+(state.error?'<p class="warning" role="alert">'+esc(state.error)+'</p>':'')+
  ({chain:()=>chain(c),builder:()=>builder(c),payoff:()=>payoff(c),oi:()=>oi(c),paper:paperView}[state.view]||(()=>''))()+'</section>';
 }
 function action(name,element){
  load();state.error='';const c=context(),id=element?.dataset.id;
  try{
   if(name==='lab-tab'){state.view=id;if(id==='chain')api.labRefresh(false);}
   else if(name==='lab-refresh')api.labRefresh(true);
   else if(name==='lab-add'){state.legs.push(E.chainLeg(c.chain,element.dataset.strike,element.dataset.type,element.dataset.side));state.view='builder';state.editing=null;}
   else if(name==='lab-use-template'){state.legs=E.template(state.template,c.chain,c.market?.spot?.price||c.snapshot?.spot?.last_price);state.view='builder';state.editing=null;}
   else if(name==='lab-import-actual'){const legs=E.actualCopy(c.book);if(!legs.length)throw Error('No existing confirmed-book futures or puts available to copy.');state.legs=legs;state.editing=null;}
   else if(name==='lab-clear'){state.legs=[];state.editing=null;}
   else if(name==='lab-remove'){state.legs.splice(Number(id),1);state.editing=null;}
   else if(name==='lab-duplicate'){const x=state.legs[Number(id)];if(!x)throw Error('PAPER leg unavailable.');state.legs.push(E.leg(x));state.editing=null;}
   else if(name==='lab-edit'){
    const n=Number(id),x=state.legs[n];if(!x)throw Error('PAPER leg unavailable.');const val=id=>document.getElementById(id)?.value;
    api.modal('Edit hypothetical PAPER leg','<p class="fine">Edits only the hypothetical strategy, never the broker ledger.</p><div class="form-grid"><label>Type<select id="lab-edit-type">'+['CE','PE','FUT'].map(t=>'<option value="'+t+'" '+(x.type===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Direction<select id="lab-edit-side">'+['LONG','SHORT'].map(t=>'<option value="'+t+'" '+(x.side===t?'selected':'')+'>'+t+'</option>').join('')+'</select></label><label>Exact expiry<input id="lab-edit-expiry" type="date" value="'+esc(x.expiry)+'"></label><label>Strike (₹)<input id="lab-edit-strike" type="number" min="0" value="'+esc(x.strike??'')+'"></label><label>Lots<input id="lab-edit-lots" type="number" min="1" value="'+x.lots+'"></label><label>Units / lot<input id="lab-edit-size" type="number" min="1" value="'+x.lotSize+'"></label><label>Entry premium / price<input id="lab-edit-entry" type="number" min="0" step="any" value="'+x.entry+'"></label></div>','Update PAPER leg',()=>{
     const next=E.leg({type:val('lab-edit-type'),side:val('lab-edit-side'),expiry:val('lab-edit-expiry'),strike:val('lab-edit-strike'),lots:val('lab-edit-lots'),lotSize:val('lab-edit-size'),entry:val('lab-edit-entry'),origin:'manual'});state.legs[n]=next;state.editing=null;api.render();
    });
   }
   else if(name==='lab-manual'){const val=x=>document.getElementById(x)?.value;state.legs.push(E.leg({type:val('lab-new-type'),side:val('lab-new-side'),expiry:val('lab-new-expiry'),strike:val('lab-new-strike'),lots:val('lab-new-lots'),lotSize:val('lab-new-size'),entry:val('lab-new-entry')}));state.editing=null;}
   else if(name==='lab-recalc'){/* Values committed by change handlers. */}
   else if(name==='lab-paper-save'){
    if(!state.legs.length)throw Error('Add a paper leg before saving.');
    const now=new Date().toISOString(),current=paper.drafts.find(d=>d.id===state.editing);
    if(current&&current.status==='closed')throw Error('Closed PAPER trade is immutable. Duplicate it as a new draft.');
    const d={id:current?.id||'paper-'+Date.now(),name:current?.name||'HAL strategy '+now.slice(0,16).replace('T',' '),status:current?.status||'draft',legs:state.legs.map(E.leg),fees:Number(state.fees)||0,createdAt:current?.createdAt||now,closedAt:current?.closedAt||'',exits:current?.exits||[],note:current?.note||''};
    paper.drafts=current?paper.drafts.map(x=>x.id===d.id?d:x):[...paper.drafts,d];save();state.editing=d.id;state.view='paper';
   }
   else if(name==='lab-load'){const d=paper.drafts.find(x=>x.id===id);if(!d)throw Error('Draft not found.');state.legs=d.legs.map(E.leg);state.fees=d.fees;state.editing=d.status==='closed'?null:id;state.view='builder';}
   else if(name==='lab-paper-rename'){
    const d=paper.drafts.find(x=>x.id===id);if(!d)throw Error('PAPER draft not found.');
    api.modal('Rename PAPER strategy','<label>Name<input id="lab-rename" maxlength="100" value="'+esc(d.name)+'"></label><label>Trade notes<textarea id="lab-note" maxlength="500">'+esc(d.note)+'</textarea></label>','Save notes',()=>{
     const name=document.getElementById('lab-rename')?.value.trim(),note=document.getElementById('lab-note')?.value||'';
     if(!name)throw Error('Enter a strategy name.');
     d.name=name.slice(0,100);d.note=note.slice(0,500);save();api.render();
    });
   }
   else if(name==='lab-paper-clone'){
    const original=paper.drafts.find(x=>x.id===id);if(!original)throw Error('Paper strategy not found.');
    state.legs=original.legs.map(E.leg);state.editing=null;state.view='builder';state.fees=original.fees;
   }
   else if(name==='lab-open'){const d=paper.drafts.find(x=>x.id===id);if(d&&d.status==='draft'){d.status='open';save();}}
   else if(name==='lab-close-start'){state.closeId=id;}
   else if(name==='lab-close-confirm'){
    const d=paper.drafts.find(x=>x.id===state.closeId);if(!d||d.status!=='open')throw Error('Select an open PAPER strategy.');
    const vals=d.legs.map((_,i)=>E.num(document.getElementById('lab-exit-'+i)?.value)),fees=E.num(document.getElementById('lab-exit-fees')?.value);
    if(vals.some(x=>x===null||x<0)||fees===null||fees<0)throw Error('Enter a non-negative hypothetical exit for every leg and total charges.');
    d.exits=vals;d.fees=fees;d.closedAt=new Date().toISOString();d.status='closed';save();state.closeId=null;
   }
   else if(name==='lab-delete'){paper.drafts=paper.drafts.filter(x=>x.id!==id);save();if(state.editing===id)state.editing=null;}
   else if(name==='lab-export'){api.native('exportBackup',JSON.stringify({tag:'HAL_PAPER_ONLY',...E.paperDoc(paper)},null,2));}
   else if(name==='lab-recover'){const native=root.HALNative,resp=native?.cacheGet?JSON.parse(native.cacheGet(previous)):null,raw=resp?(resp.ok?resp.data:null):JSON.parse(localStorage.getItem('hal_paper_previous_v1')||'null');if(!raw)throw Error('No previous paper snapshot available.');paper=E.paperDoc(raw);save(true);}
   else if(name==='lab-import'){
    if(!document.getElementById('lab-import-confirm')?.checked)throw Error('Confirm replacement of paper drafts.');
    const raw=JSON.parse(document.getElementById('lab-import-json')?.value||'');if(raw.tag!=='HAL_PAPER_ONLY')throw Error('Only HAL PAPER exports can be imported here.');
    paper=E.paperDoc(raw);save();
   }
   else return false;
  }catch(e){state.error=e.message;}
  api.render();return true;
 }
 function change(el){
  if(!el?.id?.startsWith('lab-'))return false;const k=el.id.slice(4);
  if(k==='expiry'){api.labSetExpiry(el.value);return true;}
  for(const [suffix,field]of [['chain-search','chainSearch'],['chain-minOI','minOI'],['chain-maxSpread','maxSpread']])if(k===suffix){state[field]=el.value;api.render();return true;}
  if(k==='chain-onlyQuoted'){state.onlyQuoted=el.checked;api.render();return true;}
  const fields={template:'template',mode:'mode',spot:'spot',fees:'fees',horizon:'horizon',iv:'iv',rate:'rate',dividend:'dividend',basis:'basis',overlay1:'overlay1',overlay2:'overlay2'};
  if(fields[k]){state[fields[k]]=el.value;api.render();return true;}
  return false;
 }
 const actions={};for(const name of ['tab','refresh','add','use-template','import-actual','clear','remove','edit','duplicate','paper-rename','paper-clone','manual','recalc','paper-save','load','open','close-start','close-confirm','delete','export','recover','import']){const k='lab-'+name;actions[k]=b=>action(k,b);}
 return {view,actions,change,getDraft:()=>({legs:state.legs.map(E.leg),fees:Number(state.fees)||0}),loadStrategy:legs=>{state.legs=legs.map(E.leg);state.editing=null;state.view='builder';api.render();},setView:page=>{if(['chain','builder','payoff','oi','paper'].includes(page))state.view=page;api.render();}};
};
})(typeof globalThis!=='undefined'?globalThis:this);
