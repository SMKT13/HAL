/* Evidence-only HAL futures positioning. Market-wide OI is NOT trader identity or a forecast. */
(function(root){
  'use strict';
  const ok=x=>typeof x==='number'&&Number.isFinite(x);
  const positive=x=>ok(x)&&x>0?x:null;
  const stamp=x=>x&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
  const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=(x,dec=2)=>x===null?'—':x.toLocaleString('en-IN',{minimumFractionDigits:dec,maximumFractionDigits:dec});
  const pct=x=>x===null?'—':(x>0?'+':'')+format(x)+'%';
  const at=x=>x===null?'Not provided':new Date(x).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' IST';
  const pattern=(price,oi)=>{
    if(price===null||oi===null||!price||!oi)return 'Insufficient directional change';
    if(price>0&&oi>0)return 'Rising price + rising OI';
    if(price<0&&oi>0)return 'Falling price + rising OI';
    if(price>0&&oi<0)return 'Rising price + falling OI';
    return 'Falling price + falling OI';
  };
  function inspect(packet,now=Date.now()) {
    const src=Array.isArray(packet?.data?.futures)?packet.data.futures:[];
    const rows=src.slice(0,6).map(f=>{
      const q=f?.quote||{};
      const price=positive(q.last_price),previous=positive(q.prev_close);
      const oi=positive(q.open_interest),previousOi=positive(q.previous_oi);
      const pricePct=price!==null&&previous!==null?(price/previous-1)*100:null;
      const oiPct=oi!==null&&previousOi!==null?(oi/previousOi-1)*100:null;
      const bid=positive(q.bid),ask=positive(q.ask);
      const spread=bid!==null&&ask!==null&&ask>=bid?(ask-bid)/((ask+bid)/2)*100:null;
      const quoteAt=stamp(q.quote_as_of),tradeAt=stamp(q.last_trade_at);
      const current=quoteAt!==null&&tradeAt!==null&&quoteAt<=now+60000&&tradeAt<=now+60000&&now-quoteAt<=120000&&now-tradeAt<=120000;
      const state=price===null?'unavailable':current?'recent':quoteAt===null||tradeAt===null?'clock-incomplete':'older';
      return {expiry:String(f?.expiry||''),lotSize:positive(f?.lot_size),price,previous,oi,previousOi,volume:ok(q.volume)&&q.volume>=0?q.volume:null,
          bid,ask,spread,quoteAt,tradeAt,state,pricePct,oiPct,pattern:pattern(pricePct,oiPct)};
    });
    return {rows,errors:packet?.errors||{},fetched:stamp(packet?.fetched_at_iso)};
  }
  function markup(packet,saved=[],now=Date.now()){
    const info=inspect(packet,now);
    const entries=info.rows.map(r=>{
      const owned=saved.some(x=>x?.type==='FUT'&&x.expiry===r.expiry);
      const detail=r.pricePct===null||r.oiPct===null?'Cannot classify: price or previous-day OI unavailable':r.pattern;
      return '<article class="participation-entry">'+
      '<div class="participation-head"><strong>'+safe(r.expiry)+(owned?' · YOUR FUTURES':'')+'</strong><span>'+safe(r.state==='recent'?'Recent':r.state==='older'?'Older':r.state==='unavailable'?'Unavailable':'Unverified time')+'</span></div>'+
      '<div class="participation-numbers"><div><small>FUTURES LTP</small><b>'+safe(format(r.price))+'</b><small>'+safe(pct(r.pricePct))+' vs previous close</small></div>'+
      '<div><small>OPEN INTEREST</small><b>'+safe(format(r.oi,0))+'</b><small>'+safe(pct(r.oiPct))+' vs previous OI</small></div>'+
      '<div><small>VOLUME</small><b>'+safe(format(r.volume,0))+'</b><small>Units as reported</small></div>'+
      '<div><small>BID / ASK SPREAD</small><b>'+safe(pct(r.spread))+'</b><small>Top-of-book only</small></div></div>'+
      '<p class="fine">'+safe(detail)+' · Quote '+safe(at(r.quoteAt))+' · Trade '+safe(at(r.tradeAt))+'</p></article>';
    });
    const state=info.errors?.participation||'';
    return (entries.join('')||'<p class="small muted">No HAL futures V3 quotes available.</p>')+
      (state?'<p class="small warning">Provider: '+safe(state)+'</p>':'')+
      '<p class="fine">Upstox Full Quotes V3 · HTTP retrieval '+safe(at(info.fetched))+'. Market-wide open interest is not the identity or intent of buyers/sellers. Price/OI directions describe observations, not signals or recommended trades. After-market snapshots may be older.</p>';
  }
  function renderInto(id,packet,saved,now=Date.now()){
    const el=typeof document==='undefined'?null:document.getElementById(id);
    if(el)el.innerHTML=markup(packet,saved,now);
  }
  const API={inspect,markup,renderInto,pattern};
  root.HALParticipation=API;
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
