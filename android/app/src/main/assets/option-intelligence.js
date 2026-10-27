/* HAL chain positioning: a dated read-only interpretation of returned strikes, never a hedge valuation. */
(function(root){
  'use strict';
  const finite=n=>typeof n==='number'&&Number.isFinite(n);
  const nonnegative=n=>finite(n)&&n>=0?n:null;
  const positive=n=>finite(n)&&n>0?n:null;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const nfmt=(n,d=0)=>n===null?'—':n.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
  const ms=x=>x&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
  const stamp=x=>x===null?'Unavailable':new Date(x).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' IST';
  const isExpiry=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
  function todayIST(now){
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    const get=t=>parts.find(p=>p.type===t)?.value||'';
    return get('year')+'-'+get('month')+'-'+get('day');
  }
  function rowStatus(packet,now){
    const fetched=ms(packet?.fetched_at_iso),chainError=packet?.chain_error||null;
    if(chainError)return {fetched,status:'unavailable',chainError};
    if(fetched===null)return {fetched,status:'unknown-retrieval',chainError};
    if(fetched>now+60000)return {fetched,status:'invalid-clock',chainError};
    return {fetched,status:now-fetched<=120000?'recent-fetch':'older-fetch',chainError};
  }
  function analyze(packet,book=[],now=Date.now()){
    const expiry=isExpiry(packet?.option_expiry)?packet.option_expiry:null;
    const validRows=Array.isArray(packet?.option_rows)&&!packet.chain_error?packet.option_rows.filter(r=>positive(r?.strike)!==null):[];
    const chain=validRows.slice().sort((a,b)=>a.strike-b.strike);
    let paired=0,putTotal=0,callTotal=0,putVolume=0,callVolume=0,volumePairs=0;
    let putTop=null,callTop=null,putsCompared=0,callsCompared=0,putChange=0,callChange=0;
    for(const r of chain){
      const p=nonnegative(r.put?.oi),c=nonnegative(r.call?.oi);
      if(p!==null&&(putTop===null||p>putTop.oi))putTop={strike:r.strike,oi:p};
      if(c!==null&&(callTop===null||c>callTop.oi))callTop={strike:r.strike,oi:c};
      if(p!==null&&c!==null){paired++;putTotal+=p;callTotal+=c;}
      const pv=nonnegative(r.put?.volume),cv=nonnegative(r.call?.volume);
      if(pv!==null&&cv!==null){volumePairs++;putVolume+=pv;callVolume+=cv;}
      const prevPut=nonnegative(r.put?.prev_oi),prevCall=nonnegative(r.call?.prev_oi);
      if(p!==null&&prevPut!==null){putsCompared++;putChange+=p-prevPut;}
      if(c!==null&&prevCall!==null){callsCompared++;callChange+=c-prevCall;}
    }
    const spot=positive(packet?.spot?.last_price),atm=spot===null||!chain.length?null:chain.reduce((a,b)=>!a||Math.abs(b.strike-spot)<Math.abs(a.strike-spot)?b:a,null);
    const putIV=atm?nonnegative(atm.put?.iv):null,callIV=atm?nonnegative(atm.call?.iv):null;
    const day=todayIST(now);
    const futures=(Array.isArray(book)?book:[]).filter(l=>l?.type==='FUT'&&isExpiry(l.expiry)&&l.expiry>=day&&positive(l.lots)!==null&&positive(l.lotSize)!==null);
    const puts=(Array.isArray(book)?book:[]).filter(l=>l?.type==='PE'&&isExpiry(l.expiry)&&l.expiry>=day&&positive(l.lots)!==null&&positive(l.lotSize)!==null);
    const futUnits=futures.reduce((s,l)=>s+l.lots*l.lotSize,0);
    const putUnits=puts.reduce((s,l)=>s+l.lots*l.lotSize,0);
    const chosen=puts.filter(l=>l.expiry===expiry);
    const selectedUnits=chosen.reduce((s,l)=>s+l.lots*l.lotSize,0);
    const savedExpiries=[...new Set(puts.map(l=>l.expiry))].sort();
    const futLast=futures.reduce((acc,l)=>acc>l.expiry?acc:l.expiry,'');
    const putLast=savedExpiries.at(-1)||'';
    const gap=futLast&&putLast&&futLast>putLast?Math.round((Date.parse(futLast+'T00:00:00Z')-Date.parse(putLast+'T00:00:00Z'))/86400000):null;
    return {
      expiry,rows:chain.length,paired,putTotal:paired?putTotal:null,callTotal:paired?callTotal:null,
      pcr:paired&&callTotal>0?putTotal/callTotal:null,putTop,callTop,
      volumePairs,putVolume:volumePairs?putVolume:null,callVolume:volumePairs?callVolume:null,
      putsCompared,callsCompared,putChange:putsCompared?putChange:null,callChange:callsCompared?callChange:null,
      atm:atm?.strike??null,putIV,callIV,ivSkew:putIV!==null&&callIV!==null?putIV-callIV:null,
      futUnits,putUnits,selectedUnits,puts,chosen,savedExpiries,futLast,putLast,gap,clock:rowStatus(packet,now)
    };
  }
  function markup(packet,book=[],now=Date.now(),compact=false){
    const m=analyze(packet,book,now);
    if(!m.expiry||!m.rows){
      return '<p class="small muted">'+esc(m.clock.chainError?'Chain failed: '+m.clock.chainError:'No option-chain strikes loaded. Connect or select an active expiry.')+'</p>';
    }
    const coverage=m.paired+'/'+m.rows;
    const state=m.clock.status==='recent-fetch'?'Recently retrieved':m.clock.status==='older-fetch'?'Older retrieval':m.clock.status==='unknown-retrieval'?'Unknown retrieval time':m.clock.status==='invalid-clock'?'Invalid device/quote clock':'Unavailable';
    const line='<p class="fine">Upstox option chain · '+esc(m.expiry)+' · '+esc(state)+' '+esc(stamp(m.clock.fetched))+'. Individual option trade and quote clocks are not supplied by this chain. OI/IV are not trading signals.</p>';
    const warnings=[
      m.gap!==null?'<p class="small warning">Your latest recorded put expires '+esc(String(m.gap))+' calendar days before the latest saved futures expiry ('+esc(m.putLast)+' vs '+esc(m.futLast)+'). Earlier protection cannot establish a later expiry loss floor.</p>':'',
      m.puts.length&&m.selectedUnits===0?'<p class="small muted">Your '+esc(String(m.puts.length))+' recorded active put leg(s) are for other expiries. Change the chain expiry to inspect their strikes.</p>':''
    ].join('');
    const overview='<div class="option-intel-metrics">'+
      '<div><small>OI PUT/CALL RATIO</small><strong>'+esc(nfmt(m.pcr,2))+'</strong><small>'+esc(coverage)+' paired strikes</small></div>'+
      '<div><small>LARGEST PUT OI</small><strong>'+esc(nfmt(m.putTop?.strike??null))+'</strong><small>Highest displayed put OI</small></div>'+
      '<div><small>LARGEST CALL OI</small><strong>'+esc(nfmt(m.callTop?.strike??null))+'</strong><small>Highest displayed call OI</small></div>'+
      '<div><small>ATM PUT − CALL IV</small><strong>'+esc(m.ivSkew===null?'—':nfmt(m.ivSkew,2)+' pp')+'</strong><small>Strike '+esc(nfmt(m.atm))+'</small></div>'+
      '</div>';
    const flags='<p class="fine">Put OI '+esc(nfmt(m.putTotal))+' · Call OI '+esc(nfmt(m.callTotal))+' (only '+esc(String(m.paired))+' matched strikes). '+
      'Change since previous session: put '+esc(m.putChange===null?'—':nfmt(m.putChange))+' ('+esc(String(m.putsCompared))+' strikes), call '+esc(m.callChange===null?'—':nfmt(m.callChange))+' ('+esc(String(m.callsCompared))+' strikes). Differences cover only contracts with both OI values.</p>';
    const saved=m.puts.length?'<p class="fine">Recorded active protection '+esc(nfmt(m.putUnits))+' put units across '+esc(String(m.savedExpiries.length))+' expiry date(s); '+esc(nfmt(m.selectedUnits))+' units in the displayed expiry. Futures '+esc(nfmt(m.futUnits))+' units. Matching quantities do not guarantee protection beyond put expiry.</p>':'<p class="fine">No active protective puts in the saved book, or contracts need confirmation.</p>';
    const details=compact?'':flags+'<p class="fine">Matched-strike put volume '+esc(nfmt(m.putVolume))+' · call volume '+esc(nfmt(m.callVolume))+' ('+esc(String(m.volumePairs))+' pairs). Largest OI strikes reflect only the selected chain snapshot and are not guaranteed support/resistance.</p>';
    return overview+saved+warnings+details+line;
  }
  function renderInto(id,packet,book,now=Date.now()){
    if(typeof document==='undefined')return;
    const el=document.getElementById(id);
    if(el)el.innerHTML=markup(packet,book,now,id==='option-intel-home');
  }
  const api={analyze,markup,renderInto};
  root.HALOptionIntel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
