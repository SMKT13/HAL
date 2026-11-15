/* HAL Desk 4.7 Quant Lab presentation.
 * Isolated advisory/what-if UI. Never sends orders or mutates the real book. */
(function(root){
'use strict';
const Q=root.HAL47Quant;
if(!Q)throw Error('Quant module must be loaded before Quant UI');
const state={days:5,volPct:30,fallbackIV:25,fast:20,slow:50,paths:300,fees:10,slippage:5,seed:47};
let context=null;
const esc=s=>String(s===undefined||s===null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=(v,d=2)=>Number.isFinite(v)?v.toLocaleString('en-IN',{maximumFractionDigits:d}):'Unavailable';
const money=v=>Number.isFinite(v)?(v<0?'−':'')+'₹'+Math.abs(v).toLocaleString('en-IN',{maximumFractionDigits:0}):'Unavailable';
const metric=(label,value,detail)=>'<div class="metric"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><span>'+esc(detail||'')+'</span></div>';
const card=(title,body)=>'<section class="card"><div class="section-heading"><h2>'+esc(title)+'</h2></div>'+body+'</section>';
const small=s=>'<p class="fine">'+esc(s)+'</p>';
const warning=s=>'<p class="warning">'+esc(s)+'</p>';
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const btn=(name,label)=>'<button type="button" data-quant-action="'+name+'">'+esc(label)+'</button>';
const field=(key,label,min,max,step)=>'<label>'+esc(label)+'<input data-quant-field="'+key+'" type="number" value="'+esc(state[key])+'" min="'+min+'" max="'+max+'" step="'+step+'" inputmode="decimal"></label>';
function safely(fn){try{return {ok:true,data:fn()};}catch(e){return {ok:false,error:e.message||'Unable to compute'};}}
function view(ctx){
 context=ctx;
 return '<div id="quant47-main">'+body(ctx)+'</div>';
}
function body(ctx){
 if(!ctx)return warning('Quant inputs unavailable');
 const raw=ctx.candles||[],now=ctx.now||Date.now(), market=ctx.market||{},book=ctx.book||{legs:[]};
 const spot=Number(market.spot&&market.spot.price);
 const usableSpot=Number.isFinite(spot)&&spot>0;
 const r=Q.marketRegime(raw,{now}),bt=safely(()=>Q.backtest(raw,{now,fast:state.fast,slow:state.slow,feeBps:state.fees,slippageBps:state.slippage})),
 mc=usableSpot?safely(()=>Q.monteCarlo({spot,volPct:state.volPct,days:state.days,paths:state.paths,seed:state.seed})):null,
 grid=usableSpot&&book.legs&&book.legs.length?safely(()=>Q.stressGrid(book,market,{spot,now,days:state.days,fallbackIV:state.fallbackIV})):null,
 dist=usableSpot&&book.legs&&book.legs.length?safely(()=>Q.portfolioForecast(book,market,{spot,now,days:state.days,volPct:state.volPct,fallbackIV:state.fallbackIV,paths:state.paths,seed:state.seed})):null,
 brief=Q.sixPerspectives({now,book,valuation:ctx.valuation,risk:ctx.risk,technical:ctx.technical,news:ctx.news,fundamentals:ctx.fundamentals});
 let h=card('Simulation assumptions',small('All figures are illustrative. Spot and historical candles come from separately dated research feeds. Simulation values are NOT current executable derivative quotes.')+
 '<div class="form-grid">'+field('days','Horizon (calendar days)',1,365,1)+field('volPct','Assumed annual volatility %',0,300,.5)+field('fallbackIV','Put option IV assumption %',0,500,.5)+field('paths','Simulated paths',100,2000,100)+field('fast','Fast moving average',2,249,1)+field('slow','Slow moving average',3,250,1)+field('fees','Fee assumption (bps / side)',0,1000,1)+field('slippage','Slippage (bps / side)',0,1000,1)+'</div><div class="toolbar">'+btn('recalculate','Recalculate')+btn('hedge','Open hedge comparison')+'</div>');
 {
 h+=card('Market regime',r.ready?'<div class="metrics">'+metric('Trend',r.trend,'Completed daily candles')+metric('Historical volatility',num(r.annualizedVolPct)+'%','Annualised historical estimate')+metric('RSI (14)',num(r.rsi),'Momentum indicator')+metric('ATR (14)',num(r.atr),'Historical volatility in ₹')+'</div>'+small('Latest completed bar '+r.asOf+'; '+(ctx.technical&&ctx.technical.stale?'underlying candle feed stale or unverified. ':'')+r.description):warning(r.reason));
 }
 h+=card('Historical HAL backtest',bt.ok&&bt.data.ready?'<div class="metrics">'+metric('Long/flat result',num(bt.data.totalReturnPct)+'%','Simulated underlying return')+metric('Buy & hold',num(bt.data.benchmarkReturnPct)+'%','Same reference window')+metric('Max drawdown',num(bt.data.maxDrawdownPct)+'%','Peak-to-trough model')+metric('Orders',bt.data.tradeCount,'Assumed next-open executions')+'</div>'+table(['Date','Side','Assumed fill'],bt.data.fills.slice(-12).map(x=>[x.date,x.action,money(x.price)]))+small(bt.data.caveat):warning(bt.ok?bt.data.reason:bt.error));
 h+=card('HAL endpoint price simulations',mc&&mc.ok?'<div class="metrics">'+metric('10th percentile',money(mc.data.stats.p10),'Model scenario price')+metric('Median',money(mc.data.stats.p50),'Model scenario price')+metric('90th percentile',money(mc.data.stats.p90),'Model scenario price')+metric('Below current spot',num(mc.data.probBelowSpot*100,1)+'%','Only within this hypothetical model')+'</div>'+small(mc.data.assumptions):warning(mc?mc.error:'Verified or manually entered spot is required for simulation'));
 h+=card('Actual-book scenario distribution',dist&&dist.ok&&dist.data.ready?'<div class="metrics">'+metric('10th percentile P&L',money(dist.data.openPnL.p10),'Open entry-based model')+metric('Median P&L',money(dist.data.openPnL.p50),'Open entry-based model')+metric('90th percentile P&L',money(dist.data.openPnL.p90),'Open entry-based model')+metric('Lifetime median',money(dist.data.lifetimeNet.p50),'Model + realised − charges')+'</div>'+small(dist.data.caveat):warning(dist?dist.ok?dist.data.reason:dist.error:'Record your real futures and put contracts to simulate portfolio exposure.'));
 h+=card('Spot × IV shock matrix',grid&&grid.ok?table(['Spot change','Model HAL price','IV −5pp','IV baseline','IV +5pp'],grid.data.rows.map(x=>[num(x.shock*100,0)+'%',money(x.spot),...x.cells.map(c=>money(c.openPnL))]))+small(grid.data.assumptions)+(grid.data.rows[0].cells[0].error?warning(grid.data.rows[0].cells[0].error):''):warning(grid?grid.error:'An actual saved position and a positive spot are required'));
 h+=card('Six-perspective research checklist',table(['Perspective','Evidence','State'],brief.perspectives.map(x=>[x.desk,x.evidence,x.confidence]))+
 small(brief.kind+' Headlines: '+(brief.headlines.ready?brief.headlines.count+' distinct dated articles':'no reliable dated sample')+'.')+
 '<div class="toolbar">'+btn('ai','Open AI Desk')+'</div>');
 h+=card('Release and safety gates',small('Read-only Upstox + NSE research. No broker order permissions, no funds transfer, no automatic trading. Actual positions remain in schema-4 SQLite and PAPER trades stay separate. No calculated scenario can infer earlier put settlement from a later HAL price.')+
 warning((ctx.risk&&ctx.risk.warnings||[]).map(w=>w.title).join(' · ')||'Confirm expiry, hedge coverage, fees, quote timestamps and cash settlement obligations before making decisions.'));
 return h;
}
function update(){
 const el=document.getElementById('quant47-main');
 if(el&&context)el.innerHTML=body(context);
}
function readSettings(){
 const inputs=document.querySelectorAll('#quant47-main input[data-quant-field]');const draft={};
 inputs.forEach(input=>{const key=input.getAttribute('data-quant-field'),value=Number(input.value);
  if(!input.value.trim()||!Number.isFinite(value)||!input.checkValidity())throw Error('Invalid '+key+' setting');
  draft[key]=value;
 });
 if(!Number.isInteger(draft.fast)||!Number.isInteger(draft.slow)||draft.fast>=draft.slow)throw Error('Use whole-number moving averages with Fast shorter than Slow');
 if(!Number.isInteger(draft.days)||!Number.isInteger(draft.paths))throw Error('Use whole numbers for days and paths');
 Object.assign(state,draft);
}
document.addEventListener('click',function(event){
 const target=event.target.closest&&event.target.closest('[data-quant-action]');
 if(!target)return;
 const action=target.getAttribute('data-quant-action');event.preventDefault();
 if(action==='recalculate'){try{readSettings();update();}catch(e){const p=document.getElementById('quant47-error');if(p)p.textContent=e.message;else target.insertAdjacentHTML('afterend','<p id="quant47-error" role="alert" class="warning">'+esc(e.message)+'</p>');}}
 if(action==='ai'){const tab=document.querySelector('[data-screen="ai"]');if(tab)tab.click();}
 if(action==='hedge'){const tab=document.querySelector('[data-screen="position"]');if(tab){tab.click();const sub=document.querySelector('[data-sub="hedge"]');if(sub)sub.click();}}
});
root.HAL47Panel={view,update};
})(typeof globalThis!=='undefined'?globalThis:this);
