/* HAL Desk: source-clocked readiness. Never mark or trade a position from this component. */
(function(root){
  'use strict';
  const valid=n=>typeof n==='number'&&Number.isFinite(n);
  const stamp=value=>typeof value==='string'&&value.trim()&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
  function ageState(t,now,limit=120000){
    const time=stamp(t);
    if(time===null)return 'missing';
    const age=now-time;
    return age < -60000 ? 'invalid-clock' : age <= limit ? 'recent' : 'older';
  }
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const timeText=value=>{
    const ts=stamp(value);
    return ts===null?'Not provided':new Date(ts).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' IST';
  };
  function inspect(input={},now=Date.now()){
    const s=input.snapshot||null, mode=input.mode||'direct';
    const connection=!input.configured?'not-connected':mode==='direct'?'direct-readonly':'legacy-server';
    const clocks={
      retrieved:ageState(s?.fetched_at_iso,now),
      quote:ageState(s?.spot?.quote_as_of,now),
      trade:ageState(s?.spot?.last_trade_at,now)
    };
    const priceOk=valid(s?.spot?.last_price)&&s.spot.last_price>0;
    const spotState=!s||!priceOk?'unavailable':input.lastFailed?'previous-failed':
      Object.values(clocks).every(x=>x==='recent')?'recent':
      Object.values(clocks).some(x=>x==='invalid-clock')?'clock-error':
      Object.values(clocks).some(x=>x==='missing')?'missing-clocks':'older';
    const legs=Array.isArray(input.book?.legs)?input.book.legs:[];
    const states=Array.isArray(input.review?.states)?input.review.states:[];
    const current=states.filter(l=>l?.status==='current').length;
    const saved=states.filter(l=>l?.status==='saved').length;
    const unavailable=states.filter(l=>l?.status==='unavailable').length;
    const verifiedCount=states.length===legs.length?current:0;
    const completeBook=legs.length>0&&states.length===legs.length&&current===legs.length;
    const confirmed=!!input.review?.confirmed;
    // This is a source-quality gate ONLY: a fresh marked quote is not executable.
    const reviewEligible=connection==='direct-readonly'&&spotState==='recent'&&
      completeBook&&confirmed&&input.review?.dataMode==='current';
    const blockers=[];
    if(connection==='not-connected')blockers.push('Connect Upstox Analytics Token');
    else if(connection==='legacy-server')blockers.push('Legacy server mode; source permissions may differ');
    if(spotState!=='recent')blockers.push('Spot needs a verified recent retrieval, quote and trade clock');
    if(!legs.length)blockers.push('Save your actual open book');
    else {
      if(!confirmed)blockers.push('Confirm saved positions against your broker');
      if(!completeBook)blockers.push('Verify every saved leg quote and listed lot size');
    }
    return {connection,clocks,spotState,reviewEligible,blockers,
      legs:legs.length,current:verifiedCount,saved,unavailable,confirmed,
      fetched:s?.fetched_at_iso||null,quoted:s?.spot?.quote_as_of||null,traded:s?.spot?.last_trade_at||null};
  }
  function markup(input={},now=Date.now()){
    const d=inspect(input,now);
    const header=d.reviewEligible?'Price-based review inputs synchronized':
      d.connection==='not-connected'?'Not connected — saved positions remain offline':
      'Saved/partial data — verify before price-based review';
    const stateLabel={recent:'Recent source clocks',older:'Older timestamps',missing:'Clock missing',
      'missing-clocks':'Some clocks missing','clock-error':'Clock mismatch',
      unavailable:'Spot unavailable','previous-failed':'Previous snapshot — latest refresh failed'}[d.spotState]||d.spotState;
    const rows=[
      ['Connection',d.connection==='direct-readonly'?'Upstox direct · read-only':d.connection==='legacy-server'?'Legacy server connection':'Not connected'],
      ['HAL spot',stateLabel],
      ['Saved contract marks',d.legs?d.current+' of '+d.legs+' recent and listed':'No open legs recorded'],
      ['Saved book',d.confirmed?'Confirmed against your broker':'Not confirmed']
    ];
    return '<p class="source-readiness-head">'+esc(header)+'</p>'+
      '<div class="source-readiness-grid">'+rows.map(([label,value])=>
        '<div><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>').join('')+'</div>'+
      '<p class="fine">Source clocks · Retrieved '+esc(timeText(d.fetched))+
      ' · Spot quote '+esc(timeText(d.quoted))+' · Last trade '+esc(timeText(d.traded))+'</p>'+
      (d.blockers.length?'<p class="fine">Check: '+d.blockers.map(esc).join(' · ')+'</p>':
        '<p class="fine">Inputs meet the app’s source-clock checks; this is not a trading approval.</p>')+
      '<p class="fine">WebSocket price preview is deliberately excluded from these marks, hedge valuations and P&amp;L. A recent quote may still be non-executable; review bid/ask depth and funding separately.</p>';
  }
  function renderInto(id,input={},now=Date.now()){
    if(typeof document==='undefined')return;
    const el=document.getElementById(id);
    if(el)el.innerHTML=markup(input,now);
  }
  const api={inspect,markup,renderInto,ageState};
  root.HALSourceReadiness=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
