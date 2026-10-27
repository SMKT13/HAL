/* Read-only NSE benchmark market pulse. No trade actions or position mutation. */
(function(root) {
  'use strict';
  const KEYS = [
    {key:'NSE_INDEX:Nifty 50', label:'NIFTY 50'},
    {key:'NSE_INDEX:India VIX', label:'INDIA VIX'}
  ];
  const valid = n => typeof n === 'number' && Number.isFinite(n);
  function tradeTime(raw) {
    const n=Number(raw);
    return Number.isFinite(n) && n>1000000000000 ? n : null;
  }
  function inspect(packet, now=Date.now()) {
    const source=packet?.data?.indices;
    const quotes=source && typeof source==='object' && !Array.isArray(source)?source:{};
    const rows=KEYS.map(({key,label})=>{
      const q=quotes[key]||{};
      const last=valid(q.last_price)&&q.last_price>0?q.last_price:null;
      const previous=valid(q.prev_close_price)&&q.prev_close_price>0?q.prev_close_price:null;
      const time=tradeTime(q.last_trade_time);
      const age=time===null?null:Math.max(0,now-time);
      const state=last===null?'unavailable':time===null?'unknown-time':age>120000?'older':'recent';
      return {label,last,previous,time,age,state,change:last!==null&&previous!==null?(last/previous-1)*100:null};
    });
    return {rows, fetchedAt:packet?.fetched_at_iso||null, source:packet?.source||'Upstox', error:packet?.errors?.indices||null};
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function number(v,d=2){return v===null?'—':v.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});}
  function at(ms){return ms===null?'Not provided':new Date(ms).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' IST';}
  function fetchAt(raw){return raw&&Number.isFinite(Date.parse(raw))?at(Date.parse(raw)):'Not retrieved';}
  function markup(packet,status,now=Date.now()){
    const m=inspect(packet,now);
    const tiles=m.rows.map(r=>{
      const ch=r.change===null?'Previous close unavailable':(r.change>=0?'+':'')+number(r.change)+'% vs previous close';
      const q=r.state==='recent'?'Recent trade':r.state==='older'?'Older trade':r.state==='unknown-time'?'Trade time unknown':'No quote';
      return '<div class="market-pulse-tile"><span>'+esc(r.label)+'</span><strong>'+esc(number(r.last))+'</strong><small>'+esc(ch)+'</small><small>'+esc(q)+' · '+esc(at(r.time))+'</small></div>';
    }).join('');
    return '<div class="market-pulse-grid">'+tiles+'</div>'+
      '<p class="fine">Upstox V3 full quotes · last retrieved '+esc(fetchAt(m.fetchedAt))+
      '. Trade timestamp is shown separately. Prices can be stale after market hours.</p>'+
      (m.error?'<p class="small warning">Benchmark feed: '+esc(m.error)+'. Do not treat missing data as neutral.</p>':'')+
      '<p class="fine">'+esc(status||'Awaiting Upstox market data.')+
      ' · NIFTY and VIX indicate broad-market conditions, not a forecast for HAL or an instruction to trade.</p>';
  }
  function renderInto(id,packet,status,now=Date.now()){
    const el=typeof document==='undefined'?null:document.getElementById(id);
    if(el)el.innerHTML=markup(packet,status,now);
  }
  const api={inspect,markup,renderInto};
  root.HALMarketPulse=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
