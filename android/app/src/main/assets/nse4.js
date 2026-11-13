/* HAL Desk 4.3 NSE research lens: read-only, isolated from all portfolio marks. */
(function () {
  'use strict';
  const native=window.HALNative;
  const root=document.getElementById('main');
  let snapshot=null, fromCache=false, pending=false, lastAttempt=0, error='', opened=false;
  const safe=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
  const money=x=>num(x)===null?'—':'₹'+num(x).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
  const count=x=>num(x)===null?'—':Math.round(num(x)).toLocaleString('en-IN');
  const percent=x=>num(x)===null?'—':(num(x)>0?'+':'')+num(x).toFixed(2)+'%';
  const val=(name,value)=>'<div class="row"><span>'+safe(name)+'</span><strong>'+safe(value)+'</strong></div>';
  const when=x=>{
    const d=new Date(x);
    return isNaN(d.getTime())?'Unknown source time':d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true})+' IST';
  };
  const small=x=>'<p class="fine">'+safe(x)+'</p>';
  function miniChart(rows) {
    if(!Array.isArray(rows)||rows.length<2)return '';
    const prices=rows.map(r=>num(r.close));
    if(prices.some(v=>v===null||v<=0))return '';
    let low=Math.min.apply(null,prices),high=Math.max.apply(null,prices);
    if(low===high)high=low+1;
    const span=Math.max(1,high-low),w=300,h=90,pad=7;
    const points=prices.map((p,i)=>(pad+(w-2*pad)*i/(prices.length-1)).toFixed(1)+','+(pad+(h-2*pad)*(high-p)/span).toFixed(1)).join(' ');
    return '<svg role="img" aria-label="Last '+prices.length+' completed HAL closing prices" viewBox="0 0 300 90" style="width:100%;height:110px" preserveAspectRatio="none"><polyline points="'+points+'" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg>'+small('Last '+prices.length+' completed daily closes, NSE Bhavcopy. Range '+money(low)+'–'+money(Math.max.apply(null,prices))+'. Not intraday.');
  }
  function panel() {
    const s=snapshot||{},l=s.live||{},h=s.historical||{},q=l.stock||null,
      sma20=num(h.sma20),sma50=num(h.sma50),sma200=num(h.sma200),
      lev=h.levels||null,vol=h.volume||null,co=h.corporate_actions||null,
      relative=h.relative||null,b=h.breadth||null;
    const status=pending?'Fetching official NSE data…':error?'NSE request failed · last data retained':fromCache?'Saved NSE research snapshot':'NSE research snapshot';
    let html='<div class="section-heading"><div><h2>Official NSE Insights</h2><p class="fine">Independent cash-market research · NSE MCP · no Upstox token required</p></div><button type="button" id="nse-refresh" class="text-button"'+(pending?' disabled':'')+'>Refresh NSE</button></div>';
    html+='<p class="fine" role="status">'+safe(status)+'</p>';
    if(error)html+='<p class="warning fine" role="alert">'+safe(error==='refresh_too_soon'?'Please allow one minute between NSE requests.':'NSE data unavailable. Existing research remains visible; no fallback price is used for positions.')+'</p>';
    if(!snapshot)return html+small('Open this section to fetch HAL EQ, benchmark context and historical signals from NSE. This feature is informational only.');
    html+=small('HTTP retrieved: '+when(s.retrieved_at)+'. Official CM quotes can lag trading by 1–3 minutes. Cash quotes never overwrite Upstox derivatives marks or portfolio P&L.');
    if(q){
      const p=num(q.lastTradedPrice),change=num(q.perChange),direction=change<0?'negative':change>0?'positive':'';
      html+='<div class="metrics"><div class="metric"><small>HAL EQ · last NSE trade</small><strong>'+money(p)+'</strong><span class="'+direction+'">'+percent(change)+' ('+money(q.change)+')</span></div>'+
        '<div class="metric"><small>Exchange quote timestamp</small><strong style="font-size:15px">'+safe(when(q.exchange_time_iso))+'</strong><span>'+(q.quote_stale?'STALE during market hours':q.session_in_progress?'During market hours':'Last published trading session')+'</span></div></div>';
      html+=val('Day open / high / low',money(q.openPrice)+' / '+money(q.highPrice)+' / '+money(q.lowPrice));
      html+=val('Total equity traded',count(q.volume)+' shares');
      if(q.quote_stale)html+='<p class="warning fine">This NSE quote is older than 10 minutes during trading hours. Verify the exchange time before relying on it.</p>';
    } else html+=small('Cash quote unavailable. Historical evidence, if available, is independent of live data.');
    html+='<h3>Moving averages · daily close</h3>';
    html+=val('20-day SMA',money(sma20)+(q&&sma20!==null?(num(q.lastTradedPrice)>=sma20?' · price above':' · price below'):''));
    html+=val('50-day SMA',money(sma50));
    html+=val('200-day SMA',money(sma200));
    if(q&&sma20!==null&&sma50!==null&&sma200!==null){
      const p=num(q.lastTradedPrice);
      html+=small('Price versus averages: '+(p<sma20?'below':'above')+' SMA20, '+(p<sma50?'below':'above')+' SMA50 and '+(p<sma200?'below':'above')+' SMA200. This describes trend location, not a buy/sell instruction.');
    }
    if(lev){
      html+='<h3>Historical price levels · '+safe(lev.as_of)+'</h3>';
      html+=miniChart(lev.recent_closes);
      html+=val('Last 5-session low / high',money(lev.low_5)+' / '+money(lev.high_5));
      html+=val('Last 20-session low / high',money(lev.low_20)+' / '+money(lev.high_20));
      html+=val('Classic daily pivot',money(lev.pivot));
      html+=val('Calculated S1 / R1',money(lev.s1)+' / '+money(lev.r1));
      html+=small('Price reference levels use unadjusted completed NSE OHLC bars; they are not guaranteed support, resistance or trade triggers.');
    }
    if(vol){
      const ratio=num(vol.last_volume)!==null&&num(vol.avg_volume)>0?num(vol.last_volume)/num(vol.avg_volume):null;
      html+='<h3>Volume anomaly · 30 sessions</h3>';
      html+=val('Last session / average',count(vol.last_volume)+' / '+count(vol.avg_volume));
      html+=val('Relative volume',ratio===null?'—':ratio.toFixed(2)+'×');
      if(ratio!==null&&ratio>2)html+='<p class="warning fine">Unusual session volume exceeds twice the 30-day average. Direction and cause require separate confirmation.</p>';
    }
    html+='<h3>Market context</h3>';
    for(const [name,key] of [['NIFTY 50','nifty50'],['India VIX','india_vix']]){
      const v=l[key],ix=v&&v.index;
      html+=val(name,ix?count(ix.last)+(num(ix.percChange)===null?'':' · '+percent(ix.percChange)):'Unavailable');
      if(v&&v.nseTimestamp)html+=small(name+' NSE time: '+v.nseTimestamp);
    }
    if(b)html+=val('NSE market breadth ('+String(b.date||'EOD')+')',
      count(b.advances)+' advancing / '+count(b.declines)+' declining');
    if(relative){
      html+='<h3>HAL versus NIFTY · one month</h3>';
      html+=val('HAL price return',percent(relative.stock&&relative.stock.return_pct));
      html+=val('NIFTY price return',percent(relative.index&&relative.index.return_pct));
      html+=val('Relative outperformance',percent(relative.outperformance_pct_points));
      html+=small('Close-to-close through '+String(relative.date||'unknown')+
        ', base '+String(relative.base_date||'unknown')+'. Dividends excluded; this is backward-looking.');
    }
    if(co&&Array.isArray(co.actions)){
      html+='<h3>Corporate action check · last year</h3>';
      html+=co.actions.length?co.actions.slice(0,5).map(a=>val(a.exDate||'Date not supplied',(a.actionType||'Event')+': '+String(a.purpose||'Details unavailable'))).join(''):
        small('No corporate actions returned for the checked date window.');
      if(co.actions.some(a=>a.actionType==='BONUS'||a.actionType==='SPLIT'))
        html+='<p class="warning fine">Split/bonus history may make unadjusted price levels non-comparable across the event.</p>';
    }
    if(Array.isArray(s.errors)&&s.errors.length)html+=small('Unavailable NSE modules: '+s.errors.length+'. Values are intentionally omitted rather than estimated.');
    return html+'<p class="fine">Source: NSE Market Data MCP (cash equities and Bhavcopy), for personal research only. Not for trade execution or investment advice.</p>';
  }
  function mount(){
    if(!root||document.querySelector('.bottom-nav [data-screen="technicals"][aria-current="page"]')===null)return;
    if(document.getElementById('nse-insights'))return;
    const section=document.createElement('section');
    section.id='nse-insights';section.className='card';section.setAttribute('aria-label','Official NSE market research');
    section.innerHTML=panel();
    const nav=root.querySelector('.subnav');
    if(nav)nav.insertAdjacentElement('afterend',section);else root.appendChild(section);
    if(!opened){opened=true;refresh();}
  }
  function paint(){const section=document.getElementById('nse-insights');if(section)section.innerHTML=panel();}
  function refresh(){
    if(pending)return;
    if(!native||typeof native.nseRefresh!=='function'){
      error='nse_not_supported';paint();return;
    }
    const now=Date.now();
    if(lastAttempt&&now-lastAttempt<60000){error='refresh_too_soon';paint();return;}
    lastAttempt=now;pending=true;error='';paint();
    native.nseRefresh();
  }
  try {
    const raw=native&&typeof native.cacheGet==='function'?JSON.parse(native.cacheGet('nse_insights_v1')):null;
    if(raw&&raw.ok&&raw.data&&raw.data.source==='NSE official MCP (personal research only)'){
      snapshot=raw.data;fromCache=true;
    }
  }catch(_){}
  if(window.HALApp&&typeof window.HALApp.receive==='function'){
    const original=window.HALApp.receive;
    window.HALApp.receive=function(event,data){
      if(event==='nse_loading'){pending=true;error='';paint();return;}
      if(event==='nse_snapshot'){
        pending=false;error='';snapshot=data;fromCache=false;
        try{if(native&&typeof native.cachePut==='function')native.cachePut('nse_insights_v1',JSON.stringify(data));}catch(_){}
        paint();return;
      }
      if(event==='nse_error'){pending=false;error=String(data&&data.code||'nse_unavailable');paint();return;}
      return original.apply(this,arguments);
    };
  }
  document.addEventListener('click',function(e){
    if(e.target.closest('#nse-refresh')){e.preventDefault();refresh();}
  });
  if(root){
    new MutationObserver(mount).observe(root,{childList:true});
    mount();
  }
})();
