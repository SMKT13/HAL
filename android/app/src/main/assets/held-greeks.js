/* V3 Greeks for saved HAL puts. Provider retrieval time != exchange quote time. */
(function(root){
  'use strict';
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const goodExpiry=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T00:00:00Z'));
  const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const num=(x,d=2)=>finite(x)?x.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
  const signed=(x,d=2)=>finite(x)?(x>0?'+':'')+num(x,d):'—';
  const time=x=>x&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
  const at=x=>x===null?'Not available':new Date(x).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',hour12:false})+' IST';
  function todayIST(now){
    const p=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    const v=k=>p.find(x=>x.type===k)?.value||'';
    return v('year')+'-'+v('month')+'-'+v('day');
  }
  const legUnits=x=>finite(x?.lots)&&x.lots>0&&finite(x?.lotSize)&&x.lotSize>0?x.lots*x.lotSize:null;
  function inspect(book,packets={},now=Date.now()){
    const day=todayIST(now);
    const active=(Array.isArray(book)?book:[]).filter(l=>l?.type==='PE'&&goodExpiry(l.expiry)&&l.expiry>=day&&finite(l.strike)&&l.strike>0&&legUnits(l)!==null);
    const rows=active.map(l=>{
      const packet=packets[l.expiry],fetched=time(packet?.fetched_at_iso);
      const contract=(packet?.data?.contracts||[]).find(c=>c&&c.strike===l.strike&&c.has_greeks===true&&goodExpiry(packet?.data?.expiry)&&packet.data.expiry===l.expiry);
      const validated=contract&&finite(contract.delta)&&contract.delta>=-1&&contract.delta<=1?contract:null;
      const units=legUnits(l),rawIV=validated?.iv,iv=finite(rawIV)&&rawIV>=0&&rawIV<=10?rawIV*100:null;
      const delta=validated?.delta??null;
      return {expiry:l.expiry,strike:l.strike,units,delta,deltaShares:delta===null?null:delta*units,
        theta:finite(validated?.theta)?validated.theta:null,
        gamma:finite(validated?.gamma)?validated.gamma:null,
        vega:finite(validated?.vega)?validated.vega:null,
        iv,oi:finite(validated?.oi)?validated.oi:null,volume:finite(validated?.volume)?validated.volume:null,
        fetched,feedState:!packet?'not-fetched':fetched===null?'time-unknown':fetched>now+60000?'clock-error':now-fetched>120000?'older-fetch':'recent-fetch',
        available:!!validated};
    });
    const deltaComplete=rows.length>0&&rows.every(r=>r.deltaShares!==null);
    const rawDelta=deltaComplete?rows.reduce((sum,r)=>sum+r.deltaShares,0):null;
    return {rows,deltaComplete,putDeltaShares:rawDelta,allUnits:rows.reduce((s,r)=>s+r.units,0),missing:rows.filter(r=>!r.available).length};
  }
  function markup(book,packets={},status={},now=Date.now(),compact=false){
    const state=inspect(book,packets,now);
    if(!state.rows.length)return '<p class="small muted">No currently active protective put contracts in the local book. Expired puts remain in the trade journal.</p>';
    const selected=compact?state.rows.slice(0,3):state.rows;
    const cards=selected.map(r=>{
      const badge=r.feedState==='recent-fetch'?'Recently fetched':r.feedState==='older-fetch'?'Older fetch':r.feedState==='clock-error'?'Clock error':r.feedState==='not-fetched'?'Not fetched':'Unknown fetch time';
      const failure=status[r.expiry]||'';
      return '<div class="held-greek-leg"><div class="held-greek-title"><b>'+e(num(r.strike,0))+' PE · '+e(r.expiry)+'</b><span>'+e(badge)+'</span></div>'+
        '<div class="held-greek-stats">'+
        '<div><small>DELTA / UNIT</small><strong>'+e(signed(r.delta,4))+'</strong></div>'+
        '<div><small>DELTA × UNITS</small><strong>'+e(signed(r.deltaShares,1))+'</strong></div>'+
        '<div><small>IV</small><strong>'+e(finite(r.iv)?num(r.iv,2)+'%':'—')+'</strong></div>'+
        '<div><small>THETA (RAW)</small><strong>'+e(signed(r.theta,3))+'</strong></div>'+
        (compact?'':'<div><small>GAMMA (RAW)</small><strong>'+e(num(r.gamma,5))+'</strong></div><div><small>VEGA (RAW)</small><strong>'+e(num(r.vega,3))+'</strong></div>')+
        '</div><p class="fine">Upstox V3 · Retrieved '+e(at(r.fetched))+' · '+e(num(r.units,0))+' put units'+(failure?' · '+e(failure):'')+'. No per-contract Greek quote timestamp.</p></div>';
    }).join('');
    const extra=compact&&state.rows.length>selected.length?'<p class="small muted">Additional saved put legs are displayed under My Position → Risk.</p>':'';
    const summary='<p class="small"><b>Put delta exposure:</b> '+e(signed(state.putDeltaShares,1))+' share-equivalent units'+(state.deltaComplete?'':'; incomplete — some active puts lack valid Greeks')+'.</p>';
    return summary+cards+extra+'<p class="fine">Illustrative first-order delta only, not guaranteed hedge coverage. V3 IV is reported as a decimal fraction and shown here as percent. Theta, gamma and vega are raw provider values with provider-defined units; no INR/day or volatility-shock P&L is inferred. Existing verified full quotes still determine strategy P&L.</p>';
  }
  function renderInto(id,book,packets={},status={},now=Date.now()){
    if(typeof document==='undefined')return;
    const el=document.getElementById(id);
    if(el)el.innerHTML=markup(book,packets,status,now,id==='held-greeks-home');
  }
  root.HALHeldGreeks={inspect,markup,renderInto};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.HALHeldGreeks;
})(typeof window!=='undefined'?window:globalThis);
