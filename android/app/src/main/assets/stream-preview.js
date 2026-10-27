/* Source-clocked preview of validated V3 LTPC records. NO effect on portfolio valuation. */
(function(root){
  'use strict';
  const valid=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&x<100000000;
  const key=x=>typeof x==='string'&&x.length>0&&x.length<100&&(x.startsWith('NSE_EQ|')||x.startsWith('NSE_FO|')||x.startsWith('NSE_INDEX|'));
  const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const fmt=x=>x.toLocaleString('en-IN',{maximumFractionDigits:2,minimumFractionDigits:2});
  const stamp=x=>typeof x==='number'&&Number.isFinite(x)&&x>946684800000&&x<4102444800000?x:null;
  const at=x=>x===null?'Not supplied':new Date(x).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' IST';
  const display=k=>k==='NSE_INDEX|Nifty 50'?'NIFTY 50':k==='NSE_INDEX|India VIX'?'INDIA VIX':k.startsWith('NSE_EQ|')?'HAL EQUITY':k.startsWith('NSE_FO|')?'HAL FUTURES '+k.slice(7):k;
  function inspect(packet,now=Date.now()){
    if(!packet||packet.state!=='decoded_quotes'||!Array.isArray(packet.rows))return [];
    return packet.rows.slice(0,5).filter(q=>q&&key(q.key)&&valid(q.price)).map(q=>{
      const trade=stamp(q.last_trade_ts),feed=stamp(packet.feed_ts),close=valid(q.prev_close)?q.prev_close:null;
      const fresh=trade!==null&&feed!==null&&trade<=now+60000&&feed<=now+60000&&now-trade<=120000&&now-feed<=120000;
      const clock=trade===null?'Trade time missing':feed===null?'Feed time missing':trade>now+60000||feed>now+60000?'Future clock: verify device/provider':fresh?'Recent trade':'Older trade / after-hours';
      return {key:q.key,name:display(q.key),price:q.price,trade,feed,close,clock,change:close===null?null:(q.price/close-1)*100};
    });
  }
  function markup(packet,now=Date.now()){
    const quotes=inspect(packet,now);
    if(!quotes.length)return '<p class="small muted">No validated LTPC prices yet. HTTP snapshots remain available.</p>';
    return '<div class="stream-quote-grid">'+quotes.map(q=>'<div class="stream-quote">'+
      '<small>'+safe(q.name)+'</small><b>'+(q.key.startsWith('NSE_INDEX|')?'':'₹')+safe(fmt(q.price))+'</b>'+
      '<small>'+safe(q.change===null?'Previous close missing':(q.change>=0?'+':'')+q.change.toFixed(2)+'% vs previous close')+'</small>'+
      '<small>'+safe(q.clock)+'</small>'+
      '<small>Trade '+safe(at(q.trade))+'</small></div>').join('')+'</div>'+
      '<p class="fine">Upstox V3 WebSocket LTPC • Feed time '+safe(at(quotes[0].feed))+'. Preview only: no portfolio P&L, executable bid/ask, option Greeks or hedge valuation is inferred from this feed.</p>';
  }
  function render(packet,now=Date.now()){
    if(typeof document==='undefined')return;
    const box=document.getElementById('stream-prices');
    if(box)box.innerHTML=markup(packet,now);
  }
  root.HALStreamPreview={inspect,markup,render};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.HALStreamPreview;
})(typeof window!=='undefined'?window:globalThis);
