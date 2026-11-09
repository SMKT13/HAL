'use strict';
window.createHalRecovery = function createHalRecovery(api){
  'use strict';
  const {get,esc,money,num,pct,date,when,input,select,btn,card,row,table,empty,navigate,render}=api;
  const E=window.HAL4Engine,R=window.HAL5Recovery;
  let draft=null,result=null,selectedPoint=0;
  const value=id=>document.getElementById(id)?.value;
  const numOrNull=raw=>E.value(raw);
  const day=()=>E.istDate(Date.now());
  function initialize(){
    if(draft)return;
    const {book,market}=get();
    const q=E.normalizeMarket(market).spot;
    const fresh=E.quoteQuality(q,{requireFresh:true,requireTrade:true}).valid;
    const anchor=fresh?q.price:book.legs.find(l=>l.type==='FUT')?.entry??book.legs[0]?.strike;
    const expiries=book.legs.map(l=>l.expiry).filter(d=>E.expiryTime(d)>=Date.now()).sort();
    draft={date:expiries[0]||day(),low:anchor>0?Math.floor(anchor*.5):'',high:anchor>0?Math.ceil(anchor*2):'',
      basis:'carry',rate:'6',dividend:'0',iv:'',shift:'0',baseSpot:'',enter:'',exit:'',slippage:'',paths:{}};
  }
  function invalidate(){
    result=null;
    const output=document.getElementById('be-results');
    if(output)output.remove();
  }
  function currentResult(){
    if(result&&(result.bookRevision!==get().book.revision||E.time(result.horizon)<Date.now()))invalidate();
    if(result&&result.currentSpot!==null){
      const q=E.normalizeMarket(get().market).spot;
      if(!E.quoteQuality(q,{requireFresh:true,requireTrade:true}).valid)invalidate();
    }
    return result;
  }
  function prices(view){
    if(!view?.available)return 'Unavailable';
    const roots=view.roots.map(r=>money(r.price));
    const ranges=view.flatRanges.map(r=>money(r.from)+' – '+money(r.to));
    return [...roots,...ranges].join(' · ')||'No crossing in range';
  }
  function cards(lifetimeOnly=false){
    const report=currentResult(),book=get().book;
    const open=report?.openNet.available?report.openNet:report?.openGross;
    const summary=(label,v,scope)=>card(label,
      report?`<div class="hero-value">${esc(prices(v))}</div><p class="fine">${esc(v?.reason||scope)} · ${esc(report.priceReference)} · ${esc(when(report.horizon))}</p>`:
      `<p class="fine">${esc(book.legs.length?'Select a scenario date and costs to calculate the HAL spot price.':'An open book is required to calculate a HAL price.')}</p>`,
      btn('go-breakeven',report?'Inspect':'Calculate','class="text-button"'));
    return (lifetimeOnly?'':summary('Open position break-even',open,report?.openNet.available?'After costs':'Gross open P&L'))+
      summary('Lifetime recovery break-even',report?.lifetime,'After recorded and additional costs');
  }
  function field(key,label,type='number'){return input('be-'+key,label,draft[key],type);}
  function earlierDates(book){return [...new Set(book.legs.map(l=>l.expiry).filter(d=>d<draft.date))].sort();}
  function chart(report){
    const points=report.curves;
    if(points.length<2)return '';
    const series=[['openGross','Open gross','#799aba'],['openNet','Open net','#d39536'],['lifetime','Lifetime net','#36a894']].filter(([key])=>points.some(p=>E.finite(p[key])));
    const ys=[0];for(const point of points)for(const [k] of series)ys.push(point[k]);
    const minY=Math.min(...ys),maxY=Math.max(...ys);
    const x=v=>20+(v-report.range.min)/(report.range.max-report.range.min)*284;
    const y=v=>20+(maxY-v)/(maxY-minY||1)*122;
    const curves=series.map(([key,,color])=>{
      const d=points.map((point,i)=>(i===0?'M':'L')+x(point.price).toFixed(2)+' '+y(point[key]).toFixed(2)).join(' ');
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
    }).join('');
    selectedPoint=Math.min(selectedPoint,points.length-1);
    return `<figure style="margin:14px 0"><figcaption>Scenario P&amp;L against HAL spot</figcaption><p class="fine">${series.map(([,name,col])=>`<span style="border-bottom:2px solid ${col}">${esc(name)}</span>`).join('　')}</p>
      <svg width="100%" viewBox="0 0 324 172" role="img" aria-label="Break-even chart with zero P and L axis"><g font-family="sans-serif" font-size="10" fill="currentColor">
      <line x1="16" x2="308" y1="${y(0)}" y2="${y(0)}" stroke="currentColor" stroke-opacity=".45" stroke-dasharray="3 4"/><text x="17" y="${Math.max(12,y(0)-3)}">₹0</text>
      ${curves}<text x="20" y="164">${esc(money(report.range.min))}</text><text text-anchor="end" x="304" y="164">${esc(money(report.range.max))}</text></g></svg>
      <label>Inspect scenario spot<input id="be-chart-point" type="range" min="0" max="${points.length-1}" value="${selectedPoint}" step="1"></label>
      <output id="be-point-output">${esc(pointText(points[selectedPoint]))}</output></figure>`;
  }
  function pointText(point){
    return 'Spot '+money(point.price)+' · Open gross '+money(point.openGross)+(E.finite(point.openNet)?' · Open net '+money(point.openNet):'')+(E.finite(point.lifetime)?' · Lifetime '+money(point.lifetime):'');
  }
  function details(report){
    if(!report.complete)return card('Calculation unavailable',report.errors.map(e=>'<p class="warning">'+esc(e)+'</p>').join(''));
    const views=[['Open gross',report.openGross],['Open after costs',report.openNet],['Lifetime recovery',report.lifetime]];
    const body=views.map(([label,v])=>{
      const text=v.available?prices(v):v.reason;
      const distances=v.roots.map(r=>E.finite(r.change)?money(r.change)+' / '+pct(r.changePct):'Current spot unavailable');
      return [label,text,distances.join(' · ')||'—'];
    });
    const futures=views.filter(([,v])=>v.available).flatMap(([label,v])=>v.roots.flatMap(r=>r.futures.map(f=>[label,money(r.price),date(f.expiry),money(f.price)])));
    const facts=report.assumptions.map(t=>'<p class="fine">'+esc(t)+'</p>').join('');
    return card('Estimated HAL spot at break-even',
      `<p>${esc(report.kind)} · ${esc(when(report.horizon))}</p>${table(['Scope','HAL spot','Move from current spot'],body)}${chart(report)}
       ${row('Recorded lifetime P&L after charges',money(report.lifetimeRecordedNet))}
       ${row('Required open gross P&L since entry',money(report.lifetime.requiredGrossPnl))}
       ${row('Additional P&L from fresh current marks',money(report.lifetime.requiredAdditionalPnl))}
       <details><summary>Calculation details</summary>${row('Calculated',when(report.calculatedAt))}${row('Book revision',String(report.bookRevision))}
       ${row('Current HAL spot',money(report.currentSpot))}${row('Provider quote',when(report.quoteAt))}${row('Last spot trade',when(report.tradeAt))}
       ${futures.length?table(['Scope','HAL spot','Futures expiry','Model futures price'],futures):''}${facts}</details>`);
  }
  function form(){
    initialize();
    const {book}=get();
    if(!book.legs.length)return card('Break-even',empty('No open position','Use Book to record the exact long futures or protective puts to model.'));
    const paths=earlierDates(book);
    const form=card('Break-even assumptions',
      `<div class="form-grid">${field('date','Valuation date · IST','date')}${select('be-basis','Futures basis',[['carry','Cost of carry'],['constant','Constant observed basis'],['decay','Decay observed basis']],draft.basis)}
       ${field('low','Lower HAL spot (₹)')}${field('high','Upper HAL spot (₹)')}${field('iv','Put IV override (%)')}${field('shift','IV shift (percentage points)')}
       ${field('rate','Annual interest rate (%)')}${field('dividend','Annual dividend yield (%)')}${draft.basis==='carry'?'':field('baseSpot','Manual basis reference spot (₹)')}</div>
       <div class="form-grid">${field('enter','Allocated entry charges already recorded (₹)')}${field('exit','Additional exit charges (₹)')}${field('slippage','Additional slippage (₹)')}</div>
       <p class="fine">Enter zero for a known zero cost. Leave an unknown allocation blank to use the gross open calculation. Include only slippage still to be incurred.</p>
       ${paths.length?'<h3>Earlier expiry assumptions</h3><p class="fine">Supply a separate settlement spot at each earlier expiry to model the later date.</p><div class="form-grid">'+paths.map(d=>input('be-path-'+d,date(d)+' assumed HAL settlement (₹)',draft.paths[d]??'')).join('')+'</div>':''}
       ${btn('be-calculate','Calculate break-even','class="primary"')}`);
    const report=currentResult();return form+(report?'<div id="be-results" data-calculation-output>'+details(report)+'</div>':'');
  }
  function remember(id){
    if(!id.startsWith('be-'))return;
    if(id==='be-chart-point'){
      const point=result?.curves?.[Number(value(id))];
      if(point){selectedPoint=Number(value(id));const el=document.getElementById('be-point-output');if(el)el.textContent=pointText(point);}
      return;
    }
    initialize();const key=id.slice(3);
    if(key.startsWith('path-'))draft.paths[key.slice(5)]=value(id);
    else if(Object.prototype.hasOwnProperty.call(draft,key))draft[key]=value(id);
    invalidate();
  }
  function change(id){if(id==='be-date'||id==='be-basis'){remember(id);render();}}
  function calculate(){
    initialize();const {book,market}=get();
    const exit=numOrNull(draft.exit),slippage=numOrNull(draft.slippage);
    if([exit,slippage].some(x=>x!==null&&x<0))throw Error('Exit charges and slippage must be non-negative.');
    const paths={};for(const d of earlierDates(book))if(draft.paths[d]!==undefined&&draft.paths[d]!=='')paths[d]=numOrNull(draft.paths[d]);
    const params={minSpot:numOrNull(draft.low),maxSpot:numOrNull(draft.high),horizon:draft.date,basis:draft.basis,ivShift:numOrNull(draft.shift),rate:numOrNull(draft.rate),dividend:numOrNull(draft.dividend),
      newCosts:exit!==null&&slippage!==null?exit+slippage:null,openRecordedCharges:numOrNull(draft.enter),fallbackIV:numOrNull(draft.iv),baseSpot:numOrNull(draft.baseSpot),expirySpots:paths};
    if(![params.rate,params.dividend,params.ivShift].every(E.finite))throw Error('Enter interest, dividend yield and IV shift. Zero is valid.');
    result=R.evaluate(book,market,params,Date.now());selectedPoint=0;render();
  }
  return {form,cards,invalidate,remember,change,actions:{'be-calculate':calculate,'go-breakeven':()=>navigate('position','break-even')}};
};
