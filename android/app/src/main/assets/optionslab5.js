/* HAL Desk Options Lab 4.4: independent PAPER analysis. No access to actual-book mutations. */
(function(root){
'use strict';
const YEAR=365*24*3600*1000, okay=n=>typeof n==='number'&&Number.isFinite(n);
function err(s){throw Error(s);}
function isoDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function end(s){if(!isoDate(s))err('Valid exact expiry required');return Date.parse(s+'T'+(s>='2026-12-07'?'15:45:00':'15:40:00')+'+05:30');}
function num(v){return v==null||String(v).trim()===''?null:(Number.isFinite(Number(v))?Number(v):null);}
function leg(x){
 if(!x||!['CE','PE','FUT'].includes(x.type)||!['LONG','SHORT'].includes(x.side)||!isoDate(x.expiry))err('Select CE, PE or future, side and exact expiry.');
 const lots=num(x.lots),lotSize=num(x.lotSize),entry=num(x.entry),strike=x.type==='FUT'?null:num(x.strike);
 if(!Number.isInteger(lots)||lots<1||lots>10000||!Number.isInteger(lotSize)||lotSize<1||lotSize>100000)err('Lots and units per lot must be positive whole numbers.');
 if(!okay(entry)||entry<0||entry>1e7||(x.type==='FUT'&&entry===0))err('Enter a valid non-negative option premium or positive futures price.');
 if(x.type!=='FUT'&&(!okay(strike)||strike<=0||strike>1e7))err('Option strike must be positive.');
 return {type:x.type,side:x.side,expiry:x.expiry,strike,lots,lotSize,entry,instrumentKey:String(x.instrumentKey||'').slice(0,180),origin:['provider','actual-copy'].includes(x.origin)?x.origin:'manual'};
}
function sign(l){return l.side==='LONG'?1:-1;}
function unit(l){return l.lots*l.lotSize;}
function intrinsic(l,s){return l.type==='FUT'?s:l.type==='CE'?Math.max(0,s-l.strike):Math.max(0,l.strike-s);}
function exact(legs,s,fees=0){if(!okay(s)||s<0)err('Scenario HAL price must be non-negative.');return legs.reduce((a,l)=>a+sign(l)*(intrinsic(l,s)-l.entry)*unit(l),-fees);}
function normal(x){const t=1/(1+.2316419*Math.abs(x)),d=.3989422804014327*Math.exp(-x*x/2),p=1-d*t*(.31938153+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p;}
function bs(type,S,K,T,v,r,q){
 if(![S,K,T,v,r,q].every(okay)||S<0||K<=0||T<0||v<0)err('Invalid option pricing assumptions.');
 if(T===0)return type==='CE'?Math.max(S-K,0):Math.max(K-S,0);
 if(S===0)return type==='CE'?0:K*Math.exp(-r*T);
 if(v===0)return type==='CE'?Math.max(S*Math.exp(-q*T)-K*Math.exp(-r*T),0):Math.max(K*Math.exp(-r*T)-S*Math.exp(-q*T),0);
 const d1=(Math.log(S/K)+(r-q+v*v/2)*T)/(v*Math.sqrt(T)),d2=d1-v*Math.sqrt(T);
 return type==='CE'?S*Math.exp(-q*T)*normal(d1)-K*Math.exp(-r*T)*normal(d2):K*Math.exp(-r*T)*normal(-d2)-S*Math.exp(-q*T)*normal(-d1);
}
function evaluate(raw,params={}){
 const legs=raw.map(leg),fees=num(params.fees??0);
 if(!legs.length)err('Add at least one PAPER leg.');
 if(!okay(fees)||fees<0||fees>1e7)err('Enter a non-negative estimated total charge.');
 const expires=[...new Set(legs.map(l=>l.expiry))],mode=params.mode||'expiry',at=num(params.at),now=okay(params.now)?params.now:Date.now();
 if(expires.some(d=>end(d)<now))err('One or more paper contracts have expired. Reconcile or remove them before valuation.');
 if(mode==='expiry'){
  if(expires.length!==1)err('Mixed expiries cannot share one exact expiry payoff. Select target date on/before the first expiry.');
  return {mode:'expiry',horizon:expires[0],exact:true,price:spot=>exact(legs,spot,fees),legs,fees};
 }
 if(mode!=='target')err('Unknown payoff mode.');
 const horizon=params.horizon?(isoDate(params.horizon)?end(params.horizon):NaN):now;
 if(!okay(horizon)||horizon<now-1000||horizon>Math.min(...expires.map(end)))err('Target date must be now or a future date no later than the first expiry.');
 const iv=num(params.iv),rate=num(params.rate),dividend=num(params.dividend),basis=num(params.basis);
 if(!okay(iv)||iv<0||iv>500||!okay(rate)||rate< -10||rate>100||!okay(dividend)||dividend<0||dividend>100||!okay(basis)||Math.abs(basis)>100000)err('Enter valid IV, interest, dividend and futures basis assumptions.');
 return {mode:'target',horizon:new Date(horizon).toISOString(),exact:false,legs,fees,price:spot=>{
  if(!okay(spot)||spot<0)err('HAL price must be non-negative.');
  return legs.reduce((a,l)=>{const p=l.type==='FUT'?spot+basis:bs(l.type,spot,l.strike,Math.max(0,(end(l.expiry)-horizon)/YEAR),iv/100,rate/100,dividend/100);return a+sign(l)*(p-l.entry)*unit(l);},-fees);
 }};
}
function summary(valuation,spot){
 const legs=valuation.legs,price=valuation.price,prices=[0,...legs.filter(l=>l.type!=='FUT').map(l=>l.strike)].sort((a,b)=>a-b),points=[...new Set(prices)],values=points.map(price),maxK=Math.max(1,...points),tail=Math.max(maxK*2,spot*2,100);
 const slopes=valuation.exact?((price(tail*2)-price(tail))/(tail)):null;
 const y0=price(0),ys=values,low=Math.min(...ys),high=Math.max(...ys);
 const breakEvens=[];
 if(valuation.exact){
  for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],ya=ys[i],yb=ys[i+1];if(Math.abs(ya)<1e-7)breakEvens.push(a);if(ya*yb<0)breakEvens.push(a+(b-a)*(-ya)/(yb-ya));}
  if(Math.abs(ys[ys.length-1])<1e-7)breakEvens.push(points[points.length-1]);
  const tailVal=price(tail);
  if(ys[ys.length-1]*tailVal<0)breakEvens.push(points[points.length-1]+(tail-points[points.length-1])*(-ys[ys.length-1])/(tailVal-ys[ys.length-1]));
 }
 const result={atSpot:price(spot),estimatedCharges:valuation.fees,breakevens:[...new Set(breakEvens.map(x=>Math.round(x*100)/100))],maxProfit:null,maxLoss:null};
 if(valuation.exact){result.maxProfit=slopes>1e-9?Infinity:Math.max(high,0);result.maxLoss=slopes< -1e-9?Infinity:Math.max(-low,0);result.payoffFloor=Math.min(low,0);result.tailSlope=slopes;}
 return result;
}
function plot(valuation,spot,steps=71){
 if(!okay(spot)||spot<=0)err('Enter a valid HAL reference price.');
 const strikes=valuation.legs.map(l=>l.strike).filter(okay),maxS=Math.max(spot*1.5,...strikes.map(x=>x*1.15)),minS=Math.max(0,Math.min(spot*.5,...strikes.map(x=>x*.85))),step=(maxS-minS)/(steps-1);
 return Array.from({length:steps},(_,i)=>{const s=minS+step*i;return {spot:s,pnl:valuation.price(s)};});
}
function safeQuote(o){if(!o||typeof o!=='object')return {};return o.quote&&typeof o.quote==='object'?o.quote:o;}
function field(o,...names){for(const n of names){const v=num(o?.[n]);if(okay(v))return v;}return null;}
function normalizeChain(payload){
 const data=payload&&typeof payload==='object'?payload:{},rows=Array.isArray(data.option_rows)?data.option_rows:[];
 const cleaned=rows.filter(x=>okay(num(x.strike))&&num(x.strike)>0).slice(0,300).map(x=>({strike:num(x.strike),call:x.call||{},put:x.put||{}})).sort((a,b)=>a.strike-b.strike);
 return {expiry:data.option_expiry||data.expiry||'',rows:cleaned,fetchedAt:data.fetched_at_iso||null,source:data.source||'Upstox chain; check original source times',error:data.chain_error||''};
}
function info(o){
 const q=safeQuote(o);return {price:field(q,'last_price','price','ltp')??field(o,'ltp'),bid:field(q,'bid','bid_price')??field(o,'bid'),ask:field(q,'ask','ask_price')??field(o,'ask'),bidQty:field(q,'bid_quantity','bidQty','bid_qty'),askQty:field(q,'ask_quantity','askQty','ask_qty'),oi:field(q,'open_interest','oi')??field(o,'oi','open_interest'),prevOi:field(q,'previous_oi','prev_oi','previousOi')??field(o,'previous_oi','prev_oi'),volume:field(q,'volume','volume_traded')??field(o,'volume'),iv:field(o,'iv')??field(q,'iv'),delta:field(o,'delta')??field(q,'delta'),gamma:field(o,'gamma')??field(q,'gamma'),theta:field(o,'theta')??field(q,'theta'),vega:field(o,'vega')??field(q,'vega'),tradeAt:q.last_trade_at||q.tradeAt||o.tradeAt||null,quoteAt:q.quote_as_of||q.quoteAt||o.quoteAt||null,retrievedAt:q.retrieved_at||q.retrievedAt||o.retrievedAt||null,lotSize:field(o,'lot_size','lotSize'),instrumentKey:String(o.instrument_key||o.instrumentKey||'')};
}
function chainLeg(chain,strike,type,side,lots=1){
 const row=chain.rows.find(x=>x.strike===num(strike));if(!row)err('Selected strike is no longer listed. Refresh chain.');
 const o=type==='CE'?row.call:type==='PE'?row.put:null;if(!o)err('Only option rows can be added from chain.');
 const q=info(o),price=side==='LONG'?q.ask:q.bid;
 if(!okay(q.lotSize)||!q.instrumentKey||!okay(price)||price<=0)err('Verified lot size, instrument key and buy/sell quote required. Enter this paper leg manually instead.');
 return leg({type,side,expiry:chain.expiry,strike:row.strike,lots,lotSize:q.lotSize,entry:price,instrumentKey:q.instrumentKey,origin:'provider'});
}
const TEMPLATES=[['long-call','Long call'],['long-put','Long put'],['protective-put','Protective put (assumed future)'],['bull-call','Bull call spread'],['bear-put','Bear put spread'],['bull-put','Bull put credit spread'],['bear-call','Bear call credit spread'],['straddle','Long straddle'],['strangle','Long strangle'],['condor','Iron condor']];
function template(id,chain,spot){
 if(!okay(spot)||spot<=0||!chain?.rows?.length)err('Load a current HAL chain and spot before adding a template.');
 const rows=chain.rows,atm=rows.reduce((a,b)=>Math.abs(b.strike-spot)<Math.abs(a.strike-spot)?b:a,rows[0]),idx=rows.indexOf(atm),lo=rows[Math.max(0,idx-1)],hi=rows[Math.min(rows.length-1,idx+1)],lo2=rows[Math.max(0,idx-2)],hi2=rows[Math.min(rows.length-1,idx+2)];
 if(['bull-call','bear-put','bull-put','bear-call','strangle','condor'].includes(id)&&lo.strike===hi.strike)err('Chain has insufficient strike coverage.');
 const add=(r,t,s)=>chainLeg(chain,r.strike,t,s);
 switch(id){
 case 'long-call':return [add(atm,'CE','LONG')];
 case 'long-put':return [add(atm,'PE','LONG')];
 case 'protective-put':return [leg({type:'FUT',side:'LONG',expiry:chain.expiry,lots:1,lotSize:info(atm.put).lotSize,entry:spot}),add(atm,'PE','LONG')];
 case 'bull-call':return [add(lo,'CE','LONG'),add(hi,'CE','SHORT')];
 case 'bear-put':return [add(hi,'PE','LONG'),add(lo,'PE','SHORT')];
 case 'bull-put':return [add(hi,'PE','SHORT'),add(lo,'PE','LONG')];
 case 'bear-call':return [add(lo,'CE','SHORT'),add(hi,'CE','LONG')];
 case 'straddle':return [add(atm,'CE','LONG'),add(atm,'PE','LONG')];
 case 'strangle':return [add(hi,'CE','LONG'),add(lo,'PE','LONG')];
 case 'condor':if(lo2.strike===lo.strike||hi2.strike===hi.strike)err('Iron condor needs at least five listed strikes.');return [add(lo2,'PE','LONG'),add(lo,'PE','SHORT'),add(hi,'CE','SHORT'),add(hi2,'CE','LONG')];
 default:err('Unknown strategy template.');
 }
}
function analytics(chain,spot){
 const r=chain.rows,callOI=r.reduce((s,x)=>s+(info(x.call).oi||0),0),putOI=r.reduce((s,x)=>s+(info(x.put).oi||0),0);
 const ivs=r.map(x=>({strike:x.strike,call:info(x.call).iv,put:info(x.put).iv}));
 const atm=ivs.length?ivs.reduce((a,b)=>Math.abs(b.strike-spot)<Math.abs(a.strike-spot)?b:a,ivs[0]):null;
 const pain=r.length&&callOI+putOI>0?r.map(x=>({strike:x.strike,amount:r.reduce((a,z)=>a+(info(z.call).oi||0)*Math.max(0,x.strike-z.strike)+(info(z.put).oi||0)*Math.max(0,z.strike-x.strike),0)})).sort((a,b)=>a.amount-b.amount)[0].strike:null;
 const changeAvailable=r.some(x=>info(x.call).prevOi!==null||info(x.put).prevOi!==null);
 return {callOI:callOI||null,putOI:putOI||null,pcr:callOI>0?putOI/callOI:null,maxPain:pain,atmIv:atm?[atm.call,atm.put].filter(okay).length?([atm.call,atm.put].filter(okay).reduce((s,x)=>s+x,0)/[atm.call,atm.put].filter(okay).length):null:null,changeAvailable,rows:r.map(x=>({strike:x.strike,call:info(x.call),put:info(x.put)}))};
}
function actualCopy(book){return (book?.legs||[]).filter(x=>['FUT','PE'].includes(x.type)).map(x=>leg({type:x.type,side:'LONG',expiry:x.expiry,strike:x.strike,lots:x.lots,lotSize:x.lotSize,entry:x.entry,instrumentKey:x.instrumentKey,origin:'actual-copy'}));}
function paperDoc(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.drafts)||raw.drafts.length>100)err('Invalid PAPER draft backup.');
 return {version:1,drafts:raw.drafts.map(d=>({id:String(d.id||'').slice(0,80),name:String(d.name||'PAPER strategy').slice(0,100),status:['draft','open','closed'].includes(d.status)?d.status:'draft',legs:(Array.isArray(d.legs)?d.legs:[]).slice(0,30).map(leg),fees:num(d.fees)||0,createdAt:String(d.createdAt||'').slice(0,35),closedAt:String(d.closedAt||'').slice(0,35),exits:Array.isArray(d.exits)?d.exits.map(num):[],note:String(d.note||'').slice(0,500)}))};
}
const api={leg,num,unit,end,bs,evaluate,summary,plot,normalizeChain,info,chainLeg,analytics,TEMPLATES,template,actualCopy,paperDoc};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HALOptionsLab=api;
})(typeof globalThis!=='undefined'?globalThis:this);
