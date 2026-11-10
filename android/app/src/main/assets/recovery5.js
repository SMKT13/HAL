(function Recovery(root) {
  'use strict';
  const E=typeof module!=='undefined'&&module.exports?require('./engine4.js'):root.HAL4Engine;
  const cashTolerance=0.000001;
  function need(ok,message){if(!ok)throw Error(message);}
  function priced(q,now){
    return q&&!/manual|cache|stream|model/i.test(q.source||'')&&
      E.quoteQuality(q,{now,requireFresh:true,requireTrade:true}).valid;
  }
  const FRESH_MS = 120000;
  function freshThrough(quote, clocks) {
    return Math.min(...clocks.map(key => E.time(quote[key]))) + FRESH_MS;
  }
  // Re-read a dated result after the clock advances, even without a network event.
  function asOf(report, now) {
    if (!report) return null;
    if (report.modelDeadline != null && now > report.modelDeadline) return null;
    const spotExpired = report.spotDeadline != null && now > report.spotDeadline;
    const marksExpired = report.marksDeadline != null && now > report.marksDeadline;
    if (!spotExpired && !marksExpired) return report;
    const visible = {...report};
    if (spotExpired) visible.currentSpot = null;
    if (marksExpired) visible.currentOpenGross = null;
    for (const name of ['openGross', 'openNet', 'lifetime']) {
      const view = report[name];
      visible[name] = {...view};
      if (spotExpired) visible[name].roots = view.roots.map(root => ({...root, change:null, changePct:null}));
      if (marksExpired) visible[name].requiredAdditionalPnl = null;
    }
    return visible;
  }
  function unavailable(reason){
    return {available:false,status:'unavailable',roots:[],flatRanges:[],reason,requiredGrossPnl:null,requiredAdditionalPnl:null};
  }
  function minimum(fn,left,right){
    const ratio=(Math.sqrt(5)-1)/2;
    let a=left,b=right,c=b-ratio*(b-a),d=a+ratio*(b-a);
    let fc=fn(c),fd=fn(d);
    for(let i=0;i<80&&b-a>1e-9;i++){
      if(fc<=fd){b=d;d=c;fd=fc;c=b-ratio*(b-a);fc=fn(c);}
      else {a=c;c=d;fc=fd;d=a+ratio*(b-a);fd=fn(d);}
    }
    return (a+b)/2;
  }
  function bisect(fn,a,b){
    const sign=Math.sign(fn(a));
    for(let n=0;n<90;n++){
      const mid=(a+b)/2,y=fn(mid);
      if(Math.abs(y)<cashTolerance||b-a<=1e-10)return mid;
      if(sign===Math.sign(y))a=mid;else b=mid;
    }
    return (a+b)/2;
  }
  function solve(fn,lo,hi,corners,isLinear){
    // A basket of long puts and linear futures is convex. Splitting at its minimum
    // also detects two intersections when a uniform grid would miss both.
    const xs=[lo,...corners.filter(x=>x>lo&&x<hi),hi];
    if(!isLinear)xs.push(minimum(fn,lo,hi));
    xs.sort((a,b)=>a-b);
    const cuts=xs.filter((v,i)=>!i||v-xs[i-1]>1e-10),roots=[],flats=[];
    for(let i=0;i<cuts.length;i++){
      const x=cuts[i],a=fn(x);
      if(Math.abs(a)<=cashTolerance)roots.push(x);
      if(i+1===cuts.length)continue;
      const y=cuts[i+1],b=fn(y);
      if(isLinear&&Math.abs(a)<=cashTolerance&&Math.abs(b)<=cashTolerance){
        const last=flats[flats.length-1];
        if(last&&last.to===x)last.to=y;else flats.push({from:x,to:y});
      }else if(a*b<0&&Math.abs(a)>cashTolerance&&Math.abs(b)>cashTolerance)roots.push(bisect(fn,x,y));
    }
    return {roots:roots.sort((a,b)=>a-b).filter((v,i,all)=>(i===0||v-all[i-1]>1e-7)&&
      !flats.some(r=>v>=r.from&&v<=r.to)),flatRanges:flats};
  }
  function prepare(book,market,p,now,horizon,low,high){
    const earlier=[],active=[],notes=[],deadlines=[];
    for(const leg of book.legs){
      const expiry=E.expiryTime(leg.expiry);
      need(expiry>=now,'Reconcile expired open contract '+leg.id+' before modelling.');
      const match=E.matchContract(leg,market);
      need(!match.mismatch,'Provider lot size conflicts with saved contract '+leg.id+'.');
      if(!match.contract)notes.push(leg.id+' uses the saved contract quantity; provider identity is unverified.');
      if(expiry<horizon){
        const settlement=p.expirySpots?.[leg.expiry];
        need(E.finite(settlement)&&settlement>=0,'Enter the earlier HAL settlement spot for '+leg.expiry+' or select a nearer valuation date.');
        const fixed=leg.type==='FUT'?settlement:Math.max(leg.strike-settlement,0);
        earlier.push({leg,kind:'Assumed earlier expiry settlement',at:leg.expiry,price:()=>fixed,linear:true});
        notes.push('User-assumed HAL settlement spot on '+leg.expiry+': ₹'+settlement+'.');
      }else active.push(leg);
    }
    const basis=p.basis||'carry',rate=p.rate??6,dividend=p.dividend??0;
    const params={horizon,rate,dividend,basis,ivShift:p.ivShift??0,fallbackIV:p.fallbackIV,ivByLeg:p.ivByLeg,baseSpot:p.baseSpot};
    const futuresNeedMarks=active.filter(leg=>leg.type==='FUT'&&horizon<E.expiryTime(leg.expiry)&&basis!=='carry');
    if(futuresNeedMarks.length){
      need(E.finite(p.baseSpot)||priced(market.spot,now),'Current HAL spot or an explicit base spot is required for observed basis.');
      if (!E.finite(p.baseSpot)) deadlines.push(freshThrough(market.spot,['quoteAt','tradeAt']));
      for(const leg of futuresNeedMarks){
        const mark=E.resolveMark(leg,market,{now});
        const manual=mark.source==='Manual'&&E.finite(E.time(mark.quoteAt))&&E.time(mark.quoteAt)<=now;
        need(manual||priced(mark.quote,now),'A timestamped manual futures mark or fresh exact-contract quote is required for '+leg.id+'.');
        if (!manual) deadlines.push(freshThrough(mark.quote,['quoteAt','tradeAt']));
        if(manual)notes.push('Manual futures basis mark for '+leg.id+' at '+mark.quoteAt+'.');
      }
    }
    const start=E.scenario(active,market,{...params,spot:low},now);
    need(start.complete,start.errors.join(' '));
    const finish=E.scenario(active,market,{...params,spot:high},now);
    need(finish.complete,finish.errors.join(' '));
    const rows=start.rows.map((row,i)=>{
      const {leg,iv}=row,T=(E.expiryTime(leg.expiry)-horizon)/E.YEAR;
      if(leg.type==='FUT'){
        const slope=(finish.rows[i].modelPrice-row.modelPrice)/(high-low);
        return {leg,kind:row.kind,linear:true,price:spot=>row.modelPrice+(spot-low)*slope};
      }
      const explicit=E.finite(p.ivByLeg?.[leg.id]??p.fallbackIV);
      if (T > 0 && !explicit) {
        const match = E.matchContract(leg,market);
        const quote = match.contract && market.quotes[match.contract.instrumentKey];
        need(priced(quote,now),'Fresh exact-contract prices and IV are required for '+leg.id+'.');
        deadlines.push(freshThrough(quote,['quoteAt','tradeAt','greeksAt']));
      }
      if(T>0)notes.push(leg.id+' uses '+iv+'% IV ('+(explicit?'user assumption':'provider Greeks')+').');
      return {leg,kind:row.kind,iv,linear:T===0||iv===0,
        corner:T===0?leg.strike:iv===0?leg.strike*Math.exp((dividend-rate)*T/100):null,
        price:spot=>E.putPrice(spot,leg.strike,T,(iv??0)/100,rate/100,dividend/100)};
    }).concat(earlier);
    return {rows,notes,modelDeadline:deadlines.length?Math.min(...deadlines):null,kind:earlier.length?'Conditional expiry path':rows.every(r=>r.kind==='expiry payoff')?'Exact expiry payoff':'Model estimate'};
  }
  function evaluate(bookInput,input={},p={},now=Date.now()){
    const out={complete:false,errors:[],assumptions:[],priceReference:'HAL spot',kind:'Model estimate',horizon:null,range:null,
      calculatedAt:E.iso(now),bookRevision:null,currentSpot:null,quoteAt:null,tradeAt:null,currentOpenGross:null,lifetimeRecordedNet:null,
      curves:[],openGross:unavailable('Calculation unavailable.'),openNet:unavailable('Calculation unavailable.'),lifetime:unavailable('Calculation unavailable.')};
    try{
      const book=E.validateBook(bookInput),market=E.normalizeMarket(input);
      out.bookRevision=book.revision;
      need(book.legs.length,'Record an open position before calculating break-even.');
      now=E.time(now);
      const horizon=E.validDate(p.horizon)?E.expiryTime(p.horizon):E.time(p.horizon);
      need(E.finite(now)&&E.finite(horizon)&&horizon>=now,'Select a valuation date on or after the current time.');
      const lo=p.minSpot,hi=p.maxSpot;
      need(E.finite(lo)&&E.finite(hi)&&lo>=0&&hi>lo&&hi<=1e8,'Enter a non-negative spot range with an upper bound greater than its lower bound (up to ₹10 crore).');
      const rate=p.rate??6,dividend=p.dividend??0,ivShift=p.ivShift??0;
      need(E.finite(rate)&&rate>=-10&&rate<=100&&E.finite(dividend)&&dividend>=0&&dividend<=100&&E.finite(ivShift),'Interest, dividend and IV shift must be valid percentages.');
      need(p.fallbackIV==null||E.finite(p.fallbackIV)&&p.fallbackIV>=0&&p.fallbackIV<=500,'Fallback IV must be between 0% and 500%.');
      for(const v of [p.newCosts,p.openRecordedCharges])need(v==null||E.finite(v)&&v>=0,'Charges and slippage must be non-negative amounts.');
      out.horizon=E.iso(horizon);out.range={min:lo,max:hi};
      const model=prepare(book,market,p,now,horizon,lo,hi);
      out.modelDeadline=model.modelDeadline;
      const ledger=E.ledger(book,input,{now});
      need(E.finite(ledger.realized)&&E.finite(ledger.charges),'Recorded realised P&L or charges are invalid.');
      out.lifetimeRecordedNet=ledger.realized-ledger.charges;
      if(priced(market.spot,now)){out.currentSpot=market.spot.price;out.quoteAt=market.spot.quoteAt;out.tradeAt=market.spot.tradeAt;out.spotDeadline=freshThrough(market.spot,['quoteAt','tradeAt']);}
      if(ledger.complete&&ledger.rows.every(r=>priced(r.mark.quote,now))){
        out.currentOpenGross=ledger.open;
        out.marksDeadline=Math.min(...ledger.rows.map(r=>freshThrough(r.mark.quote,['quoteAt','tradeAt'])));
      }
      const gross=spot=>{
        const total=model.rows.reduce((sum,r)=>sum+(r.price(spot)-r.leg.entry)*E.units(r.leg),0);
        need(Number.isFinite(total),'The assumptions exceed the numeric range of the pricing model.');
        return total;
      };
      const corners=model.rows.map(r=>r.corner).filter(E.finite),isLinear=model.rows.every(r=>r.linear);
      const netTarget=E.finite(p.newCosts)&&E.finite(p.openRecordedCharges)?p.newCosts+p.openRecordedCharges:null;
      const lifetimeTarget=E.finite(p.newCosts)?p.newCosts-out.lifetimeRecordedNet:null;
      function view(target){
        need(E.finite(target),'The combined cost exceeds the supported numeric range.');
        const solution=solve(spot=>gross(spot)-target,lo,hi,corners,isLinear);
        const roots=solution.roots.map(price=>({price,change:out.currentSpot===null?null:price-out.currentSpot,
          changePct:out.currentSpot>0?(price/out.currentSpot-1)*100:null,
          futures:model.rows.filter(r=>r.leg.type==='FUT').map(r=>({id:r.leg.id,expiry:r.leg.expiry,price:r.price(price)}))}));
        const status=solution.flatRanges.length?'flat':roots.length?'roots':'no_crossing';
        return {available:true,status,roots,flatRanges:solution.flatRanges,reason:status==='no_crossing'?'No crossing within the selected price range.':'',
          requiredGrossPnl:target,requiredAdditionalPnl:out.currentOpenGross===null?null:target-out.currentOpenGross};
      }
      const hasStatement=!!book.history?.charges;
      const includedChargeCoverage=p.lifetimeChargesConfirmed===true||hasStatement;
      out.openGross=view(0);
      out.openNet=netTarget===null?unavailable('Enter allocated open charges and additional exit costs.'):view(netTarget);
      out.lifetime=!includedChargeCoverage?unavailable('Confirm lifetime ledger and fee coverage, or import a cumulative charge statement.'):
        lifetimeTarget===null?unavailable('Enter additional exit costs, including slippage.'):view(lifetimeTarget);
      const points=[lo,hi,...corners.filter(x=>x>=lo&&x<=hi)];
      for(let i=1;i<72;i++)points.push(lo+(hi-lo)*i/72);
      for(const v of [out.openGross,out.openNet,out.lifetime])for(const r of v.roots)points.push(r.price);
      out.curves=[...new Set(points)].sort((a,b)=>a-b).map(price=>{
        const g=gross(price);
        return {price,openGross:g,openNet:out.openNet.available?g-netTarget:null,lifetime:out.lifetime.available?g-lifetimeTarget:null};
      });
      out.assumptions=['HAL spot on the selected date. Futures are valued using '+(p.basis||'carry')+' basis.',
        'Annual interest '+rate+'%, dividend yield '+dividend+'%, IV shift '+ivShift+' percentage points. European Black–Scholes, ACT/365.',
        'Each open leg uses remaining units and its recorded entry. Recorded lifetime charges enter the lifetime balance once.',
        'Estimated additional exit costs and slippage: '+(E.finite(p.newCosts)?'₹'+p.newCosts:'unspecified')+'.',
        'Allocated open-book charges: '+(E.finite(p.openRecordedCharges)?'₹'+p.openRecordedCharges:'unknown')+'.',
        ...new Set(model.notes)];
      out.kind=model.kind;out.complete=true;
    }catch(e){out.errors.push(e.message);out.openGross=unavailable(e.message);out.openNet=unavailable(e.message);out.lifetime=unavailable(e.message);}
    return out;
  }
  const api={evaluate,asOf};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.HAL5Recovery=api;
})(typeof globalThis!=='undefined'?globalThis:this);
