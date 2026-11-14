/* HAL Desk Options Lab 4.4: independent PAPER analysis. No access to actual-book mutations. */
(function(root){
'use strict';
const YEAR=365*24*3600*1000, okay=n=>typeof n==='number'&&Number.isFinite(n);
function err(s){throw Error(s);}
function isoDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
// NSE stock-derivatives close: 15:40 IST before 2026-12-07; 15:45 from 2026-12-07 (NSE CAS 2.0).
function end(s){if(!isoDate(s))err('Valid exact expiry required');return Date.parse(s+'T'+(s>='2026-12-07'?'15:45:00':s>='2026-08-03'?'15:40:00':'15:30:00')+'+05:30');}
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
 // Exact expiry P&L is piecewise linear. The terminal ray must be solved
 // algebraically; sampling at 2x spot/strike misses distant breakevens.
 const price=valuation.price,legs=valuation.legs,points=[...new Set([0,...legs.filter(l=>l.type!=='FUT').map(l=>l.strike)])].sort((a,b)=>a-b);
 const ys=points.map(price),roots=[],flatBreakevenRanges=[],eps=1e-7;
 if(valuation.exact){
  for(let i=0;i<points.length-1;i++){
   const x0=points[i],x1=points[i+1],y0=ys[i],y1=ys[i+1];
   if(Math.abs(y0)<=eps&&Math.abs(y1)<=eps)flatBreakevenRanges.push([x0,x1]);
   if(Math.abs(y0)<=eps)roots.push(x0);
   if(y0*y1<0)roots.push(x0+(x1-x0)*(-y0)/(y1-y0));
  }
  const last=points.length-1,x=points[last],y=ys[last];
  if(Math.abs(y)<=eps)roots.push(x);
  const slope=legs.reduce((sum,l)=>sum+((l.type==='FUT'||l.type==='CE')?sign(l)*unit(l):0),0);
  if(Math.abs(slope)>1e-10&&Math.abs(y)>eps){
   const crossing=x-y/slope;
   if(crossing>x+eps&&Number.isFinite(crossing))roots.push(crossing);
  }
  // Ignore negative underlying prices: stock price domain is [0,+Infinity).
  const result={atSpot:price(spot),estimatedCharges:valuation.fees,breakevens:[...new Set(roots.filter(x=>x>=0&&Number.isFinite(x)).map(x=>Math.round(x*100)/100))].sort((a,b)=>a-b),flatBreakevenRanges,maxProfit:slope>1e-9?Infinity:Math.max(...ys),maxLoss:slope< -1e-9?Infinity:Math.max(0,-Math.min(...ys)),payoffFloor:Math.min(...ys),tailSlope:slope};
  return result;
 }
 return {atSpot:price(spot),estimatedCharges:valuation.fees,breakevens:[],flatBreakevenRanges:[],maxProfit:null,maxLoss:null};
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
 const r=chain.rows,quotes=r.map(x=>({strike:x.strike,call:info(x.call),put:info(x.put)}));
 const completeCall=r.length>0&&quotes.every(x=>x.call.oi!==null&&x.call.oi>=0);
 const completePut=r.length>0&&quotes.every(x=>x.put.oi!==null&&x.put.oi>=0);
 const complete=completeCall&&completePut;
 const callOI=quotes.reduce((s,x)=>s+(x.call.oi||0),0),putOI=quotes.reduce((s,x)=>s+(x.put.oi||0),0);
 const atm=quotes.length&&Number.isFinite(spot)?quotes.reduce((a,b)=>Math.abs(b.strike-spot)<Math.abs(a.strike-spot)?b:a,quotes[0]):null;
 // Max pain / PCR are not identifiable from a partial OI chain. Missing is not zero.
 const pain=complete&&callOI+putOI>0?quotes.map(x=>({strike:x.strike,amount:quotes.reduce((a,z)=>a+z.call.oi*Math.max(0,x.strike-z.strike)+z.put.oi*Math.max(0,z.strike-x.strike),0)})).sort((a,b)=>a.amount-b.amount)[0].strike:null;
 const iv=atm?[atm.call.iv,atm.put.iv].filter(okay):[];
 const changeAvailable=quotes.some(x=>x.call.prevOi!==null||x.put.prevOi!==null);
 return {callOI:completeCall?callOI:null,putOI:completePut?putOI:null,pcr:complete&&callOI>0?putOI/callOI:null,maxPain:pain,atmIv:iv.length?iv.reduce((sum,x)=>sum+x,0)/iv.length:null,changeAvailable,oiCoverage:{complete,callKnown:quotes.filter(x=>x.call.oi!==null).length,putKnown:quotes.filter(x=>x.put.oi!==null).length,total:quotes.length},rows:quotes};
}
function actualCopy(book){return (book?.legs||[]).filter(x=>['FUT','PE'].includes(x.type)).map(x=>leg({type:x.type,side:'LONG',expiry:x.expiry,strike:x.strike,lots:x.lots,lotSize:x.lotSize,entry:x.entry,instrumentKey:x.instrumentKey,origin:'actual-copy'}));}
/* Paper-ledger state machine.  Version 1 is preserved to migrate every saved
 * 4.4/4.5 draft.  A draft may be changed, but OPEN/CLOSED exposure is immutable.
 * Opening and closing are explicit state transitions, never portfolio writes. */
function paperDoc(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.drafts)||raw.drafts.length>100)err('Invalid PAPER draft backup.');
 const seen=new Set();
 const drafts=raw.drafts.map(d=>{
  if(!d||typeof d!=='object'||!Array.isArray(d.legs)||d.legs.length>30)err('Invalid PAPER record.');
  const id=String(d.id||'').slice(0,80),name=String(d.name||'PAPER strategy').slice(0,100),status=d.status;
  if(!id||seen.has(id))err('Missing or duplicate PAPER transaction ID.');seen.add(id);
  if(!['draft','open','closed'].includes(status))err('Unknown PAPER trade state.');
  const legs=d.legs.map(leg),fees=num(d.fees??0),openedFees=num(d.openedFees??d.fees??0);
  if(!okay(fees)||fees<0||fees>1e7||!okay(openedFees)||openedFees<0||openedFees>1e7)err('Invalid PAPER trade fees.');
  if(status!=='draft'&&fees<openedFees-1e-7)err('Total PAPER fees cannot be less than opening charges.');
  const exits=Array.isArray(d.exits)?d.exits.map(num):[];
  if(exits.length>legs.length||exits.some(x=>!okay(x)||x<0||x>1e7))err('Invalid PAPER exit prices.');
  if(status==='closed'&&(!legs.length||exits.length!==legs.length))err('Closed PAPER trade must record an exit for every leg.');
  if(status!=='closed'&&exits.length)err('Only closed PAPER trades may record exits.');
  const openedAt=String(d.openedAt||'').slice(0,35),closedAt=String(d.closedAt||'').slice(0,35),createdAt=String(d.createdAt||'').slice(0,35);
  for(const stamp of [openedAt,closedAt,createdAt])if(stamp&&(!Number.isFinite(Date.parse(stamp))||stamp.length<10))err('Invalid PAPER transaction timestamp.');
  if(status==='closed'&&openedAt&&closedAt&&Date.parse(closedAt)<Date.parse(openedAt))err('PAPER close cannot precede opening.');
  if(status!=='closed'&&closedAt)err('Only closed PAPER trades may have a close timestamp.');
  // Legacy open/closed records were stored without a lock snapshot. Establish
  // their first validated state as immutable without inventing opening times.
  const openedLegs=status==='draft'?[]:(Array.isArray(d.openedLegs)?d.openedLegs.map(leg):legs.map(x=>({...x})));
  if(status!=='draft'&&(!legs.length||JSON.stringify(openedLegs)!==JSON.stringify(legs)))err('Opened PAPER trade exposure cannot be edited retroactively.');
  return {id,name,status,legs,fees,openedFees:status==='draft'?fees:openedFees,openedAt,openedLegs,createdAt,closedAt,exits,note:String(d.note||'').slice(0,500)};
 });
 return {version:1,drafts};
}
function paperStart(raw,id,at){
 const book=paperDoc(raw),d=book.drafts.find(x=>x.id===id);
 if(!d||d.status!=='draft'||!d.legs.length)err('Only nonempty PAPER drafts can be opened.');
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at)))err('Valid PAPER opening timestamp required.');
 d.status='open';d.openedAt=at;d.openedLegs=d.legs.map(leg);d.openedFees=d.fees;
 return paperDoc(book);
}
function paperClose(raw,id,exits,totalFees,at){
 const book=paperDoc(raw),d=book.drafts.find(x=>x.id===id);
 if(!d||d.status!=='open')err('Only open PAPER trades may be closed.');
 if(!Array.isArray(exits)||exits.length!==d.legs.length)err('One PAPER exit required for each open leg.');
 const fees=num(totalFees);
 if(!okay(fees)||fees<d.openedFees||fees>1e7)err('Total charges must include all opening fees and closing fees.');
 const prices=exits.map(num);
 if(prices.some(x=>!okay(x)||x<0||x>1e7))err('Enter a valid nonnegative exit price for every PAPER leg.');
 if(typeof at!=='string'||!Number.isFinite(Date.parse(at))||(d.openedAt&&Date.parse(at)<Date.parse(d.openedAt)))err('Invalid PAPER closing timestamp.');
 d.status='closed';d.exits=prices;d.fees=fees;d.closedAt=at;
 return paperDoc(book);
}
function paperReplaceDraft(raw,id,newLegs,fees){
 const book=paperDoc(raw),d=book.drafts.find(x=>x.id===id);
 if(!d||d.status!=='draft')err('Open or closed PAPER trades are locked. Clone into a new draft instead.');
 d.legs=newLegs.map(leg);
 const v=num(fees);if(!okay(v)||v<0||v>1e7)err('Invalid PAPER draft fees.');
 d.fees=v;d.openedFees=v;
 return paperDoc(book);
}

const api={leg,num,unit,end,bs,evaluate,summary,plot,normalizeChain,info,chainLeg,analytics,TEMPLATES,template,actualCopy,paperDoc,paperStart,paperClose,paperReplaceDraft};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.HALOptionsLab=api;
})(typeof globalThis!=='undefined'?globalThis:this);
