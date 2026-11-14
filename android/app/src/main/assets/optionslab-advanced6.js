/* HAL Options Lab 4.5 advanced independent modelling and strategy catalogue.
 * APK asset filenames are used only as reference labels; no Sensibull code or artwork. */
(function(root){
'use strict';
const E=root.HALOptionsLab;
if(!E)throw Error('Options Lab engine must be loaded first.');
const YEAR=365*86400000, IST=19800000, finite=x=>typeof x==='number'&&Number.isFinite(x), check=(x,m)=>{if(!x)throw Error(m);};
const CATALOG=[
['buy_call','Buy call','Bullish'],['sell_call','Sell call','Bearish / uncovered'],['buy_put','Buy put','Bearish'],['sell_put','Sell put','Bullish / short option'],
['buy_future','Buy future','Bullish'],['sell_future','Sell future','Bearish'],
['bull_call_spread','Bull call spread','Bullish'],['bear_call_spread','Bear call spread','Bearish'],['bull_put_spread','Bull put spread','Bullish'],['bear_put_spread','Bear put spread','Bearish'],
['long_straddle','Long straddle','Volatile'],['short_straddle','Short straddle','Range / uncovered'],['long_strangle','Long strangle','Volatile'],['short_strangle','Short strangle','Range / uncovered'],
['bull_butterfly','Bull butterfly','Range'],['bear_butterfly','Bear butterfly','Range'],
['bull_condor','Bull condor','Range'],['bear_condor','Bear condor','Range'],
['long_iron_butterfly','Long iron butterfly','Volatile'],['short_iron_butterfly','Short iron butterfly','Range'],
['long_iron_condor','Long iron condor','Volatile'],['short_iron_condor','Short iron condor','Range'],
['call_ratio_spread','Call ratio spread','Bearish / uncovered'],['call_ratio_back_spread','Call ratio backspread','Bullish volatile'],
['put_ratio_spread','Put ratio spread','Bullish / short puts'],['put_ratio_back_spread','Put ratio backspread','Bearish volatile'],
['long_synthetic_future','Long synthetic future','Bullish'],['short_synthetic_future','Short synthetic future','Bearish'],
['risk_reversal','Risk reversal (long call / short put)','Bullish / delivery exposure'],['jade_lizard','Jade lizard','Range / short put'],['reverse_jade_lizard','Reverse jade lizard','Range / short call'],
['strap','Strap','Bullish volatile'],['strip','Strip','Bearish volatile'],
['long_calendar_with_calls','Long call calendar','Time spread'],['long_calendar_with_puts','Long put calendar','Time spread'],
['range_forward','Range forward','Manual construction'],['double_plateau','Double plateau','Manual construction'],['batman','Batman','Manual construction']
].map(([id,label,outlook])=>({id,label,outlook,mode:/^(batman|double_plateau|range_forward)$/.test(id)?'manual':id.startsWith('long_calendar')?'two-expiry':'single-expiry'}));
function catalog(){return CATALOG.map(x=>({...x}));}
function template(id,chain,spot,opts={}){
 check(finite(spot)&&spot>0,'Load a valid HAL spot price.');
 const item=CATALOG.find(x=>x.id===id);check(item,'Unknown strategy.');
 check(item.mode!=='manual','This strategy label has no unambiguous verified leg recipe. Build the legs manually; no composition is invented.');
 const rows=chain?.rows||[];check(rows.length>0,'Load a listed HAL option chain.');
 const sorted=rows.slice().sort((a,b)=>a.strike-b.strike),a=sorted.reduce((p,q)=>Math.abs(q.strike-spot)<Math.abs(p.strike-spot)?q:p,sorted[0]),index=sorted.findIndex(x=>x.strike===a.strike);
 function r(n){check(index+n>=0&&index+n<sorted.length,'Not enough listed strikes for '+item.label+'.');return sorted[index+n];}
 function option(n,type,side,count=1,from=chain){
  const strike=r(n).strike,match=from.rows.find(x=>x.strike===strike);
  check(match,'Other expiry has no exact strike '+strike+'. Manual construction required.');
  const l=E.chainLeg(from,strike,type,side,count);check(finite(l.lotSize)&&l.lotSize>0,'Verified lot size required.');
  return l;
 }
 function future(side){
  const f=(opts.futures||[]).find(x=>x.expiry===chain.expiry && x.lotSize>0 && finite(x.price)&&x.price>0&&x.instrumentKey);
  check(f,'Matching-expiry HAL futures instrument, verified lot size and quote required. Enter a manual PAPER future otherwise.');
  return E.leg({type:'FUT',side,expiry:chain.expiry,lots:1,lotSize:f.lotSize,entry:f.price,instrumentKey:f.instrumentKey,origin:'provider'});
 }
 const join=(...xs)=>{const qty=new Set(xs.map(l=>l.lotSize));check(qty.size===1,'Listed contract lot sizes differ. Manual sizing required.');return xs;};
 switch(id){
  case 'buy_call':return [option(0,'CE','LONG')];
  case 'sell_call':return [option(0,'CE','SHORT')];
  case 'buy_put':return [option(0,'PE','LONG')];
  case 'sell_put':return [option(0,'PE','SHORT')];
  case 'buy_future':return [future('LONG')];
  case 'sell_future':return [future('SHORT')];
  case 'bull_call_spread':return join(option(-1,'CE','LONG'),option(1,'CE','SHORT'));
  case 'bear_call_spread':return join(option(-1,'CE','SHORT'),option(1,'CE','LONG'));
  case 'bull_put_spread':return join(option(1,'PE','SHORT'),option(-1,'PE','LONG'));
  case 'bear_put_spread':return join(option(1,'PE','LONG'),option(-1,'PE','SHORT'));
  case 'long_straddle':return join(option(0,'CE','LONG'),option(0,'PE','LONG'));
  case 'short_straddle':return join(option(0,'CE','SHORT'),option(0,'PE','SHORT'));
  case 'long_strangle':return join(option(1,'CE','LONG'),option(-1,'PE','LONG'));
  case 'short_strangle':return join(option(1,'CE','SHORT'),option(-1,'PE','SHORT'));
  case 'bull_butterfly':return join(option(-1,'CE','LONG'),option(0,'CE','SHORT',2),option(1,'CE','LONG'));
  case 'bear_butterfly':return join(option(-1,'PE','LONG'),option(0,'PE','SHORT',2),option(1,'PE','LONG'));
  case 'bull_condor':return join(option(-2,'CE','LONG'),option(-1,'CE','SHORT'),option(1,'CE','SHORT'),option(2,'CE','LONG'));
  case 'bear_condor':return join(option(-2,'PE','LONG'),option(-1,'PE','SHORT'),option(1,'PE','SHORT'),option(2,'PE','LONG'));
  case 'short_iron_butterfly':return join(option(0,'CE','SHORT'),option(0,'PE','SHORT'),option(2,'CE','LONG'),option(-2,'PE','LONG'));
  case 'long_iron_butterfly':return join(option(0,'CE','LONG'),option(0,'PE','LONG'),option(2,'CE','SHORT'),option(-2,'PE','SHORT'));
  case 'short_iron_condor':return join(option(-2,'PE','LONG'),option(-1,'PE','SHORT'),option(1,'CE','SHORT'),option(2,'CE','LONG'));
  case 'long_iron_condor':return join(option(-2,'PE','SHORT'),option(-1,'PE','LONG'),option(1,'CE','LONG'),option(2,'CE','SHORT'));
  case 'call_ratio_spread':return join(option(-1,'CE','LONG'),option(1,'CE','SHORT',2));
  case 'call_ratio_back_spread':return join(option(-1,'CE','SHORT'),option(1,'CE','LONG',2));
  case 'put_ratio_spread':return join(option(1,'PE','LONG'),option(-1,'PE','SHORT',2));
  case 'put_ratio_back_spread':return join(option(1,'PE','SHORT'),option(-1,'PE','LONG',2));
  case 'long_synthetic_future':return join(option(0,'CE','LONG'),option(0,'PE','SHORT'));
  case 'short_synthetic_future':return join(option(0,'CE','SHORT'),option(0,'PE','LONG'));
  case 'risk_reversal':return join(option(1,'CE','LONG'),option(-1,'PE','SHORT'));
  case 'jade_lizard':return join(option(-1,'PE','SHORT'),option(1,'CE','SHORT'),option(2,'CE','LONG'));
  case 'reverse_jade_lizard':return join(option(1,'CE','SHORT'),option(-1,'PE','SHORT'),option(-2,'PE','LONG'));
  case 'strap':return join(option(0,'CE','LONG',2),option(0,'PE','LONG'));
  case 'strip':return join(option(0,'CE','LONG'),option(0,'PE','LONG',2));
  case 'long_calendar_with_calls':
  case 'long_calendar_with_puts':{
   const further=(opts.otherChains||[]).find(c=>c.expiry>chain.expiry&&c.rows.some(x=>x.strike===a.strike));
   check(further,'Both option-expiry chains must be fetched separately, with an identical strike. You can also add the two paper legs manually.');
   const type=id.endsWith('calls')?'CE':'PE';
   return join(option(0,type,'SHORT'),option(0,type,'LONG',1,further));
  }
 }
 throw Error('Unsupported strategy category.');
}
// Separate clean approximation for all model Greeks; never relabel as provider Greeks.
function N(x){const a=Math.abs(x),t=1/(1+.2316419*a),v=.3989422804014327*Math.exp(-a*a/2);
 const p=1-v*t*(.31938153+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return x>=0?p:1-p;
}
function greeks(legs,inputs){
 const S=Number(inputs.spot),iv=Number(inputs.iv),rate=Number(inputs.rate),div=Number(inputs.dividend),now=finite(inputs.now)?inputs.now:Date.now();
 check(finite(S)&&S>0&&finite(iv)&&iv>0&&iv<=500&&finite(rate)&&rate>=-10&&rate<=100&&finite(div)&&div>=0&&div<=100,'Enter positive spot and model IV, with valid interest/dividend assumptions.');
 const v=iv/100,r=rate/100,q=div/100,rows=[];let net={delta:0,gamma:0,thetaDay:0,vegaPoint:0};
 for(const x of legs){
  const l=E.leg(x),s=l.side==='LONG'?1:-1,Q=E.unit(l)*s,T=Math.max(0,(E.end(l.expiry)-now)/YEAR);
  check(E.end(l.expiry)>=now,'Expired legs cannot receive forward-looking Greeks.');
  let result;
  if(l.type==='FUT')result={delta:Q,gamma:0,thetaDay:0,vegaPoint:0,modelPrice:S};else {
   check(T>0,'At expiry use exact payoff; Greeks are undefined there.');
   const d1=(Math.log(S/l.strike)+(r-q+v*v/2)*T)/(v*Math.sqrt(T)),d2=d1-v*Math.sqrt(T),phi=Math.exp(-d1*d1/2)/Math.sqrt(2*Math.PI),eq=Math.exp(-q*T),er=Math.exp(-r*T);
   const deltaUnit=l.type==='CE'?eq*N(d1):eq*(N(d1)-1),gammaUnit=eq*phi/(S*v*Math.sqrt(T));
   const thetaYear=-S*eq*phi*v/(2*Math.sqrt(T))+(l.type==='CE'?q*S*eq*N(d1)-r*l.strike*er*N(d2):-q*S*eq*N(-d1)+r*l.strike*er*N(-d2));
   result={delta:deltaUnit*Q,gamma:gammaUnit*Q,thetaDay:thetaYear*Q/365,vegaPoint:S*eq*phi*Math.sqrt(T)*Q/100,modelPrice:E.bs(l.type,S,l.strike,T,v,r,q)};
  }
  rows.push({leg:l,...result});for(const k of Object.keys(net))net[k]+=result[k];
 }
 return {net,rows,model:'European Black–Scholes, ACT/365; theta per calendar day, vega per 1 percentage-point IV change. Model assumptions only.'};
}
function riskSummary(legs,spot,fees=0,now=Date.now()){
 const ls=legs.map(E.leg),exp=[...new Set(ls.map(l=>l.expiry))],unitCount=ls.reduce((s,l)=>s+(l.side==='LONG'?1:-1)*E.unit(l),0),grossPremium=ls.filter(l=>l.type!=='FUT').reduce((s,l)=>s+(l.side==='LONG'?-1:1)*l.entry*E.unit(l),0);
 const marketVsEntry=ls.filter(l=>l.type==='FUT').reduce((s,l)=>s-(l.side==='LONG'?1:-1)*l.entry*E.unit(l),0);
 const noExpiry=ls.some(l=>E.end(l.expiry)<now);
 if(exp.length!==1||noExpiry)return {exact:false,expiryGap:exp.length>1,issues:[exp.length>1?'Mixed expiries: exact shared-expiry max P&L is not defined; early exercise/settlement path is not modelled.':'',noExpiry?'Expired PAPER contract requires reconciliation.':''].filter(Boolean),unitCount,grossPremium,marketVsEntry};
 const v=E.evaluate(ls,{mode:'expiry',fees,now}),x=E.summary(v,spot);
 return {...x,unitCount,grossPremium,marketVsEntry,exact:true,expiryGap:false,issues:[]};
}
function quoteSafety(raw,now=Date.now()){
 const q=E.info(raw),issues=[];
 if(!q.instrumentKey||!q.lotSize)issues.push('Contract/lot not verified');
 if(!finite(q.bid)||q.bid<=0||!finite(q.ask)||q.ask<=0)issues.push('Bid/ask missing');
 if(finite(q.bid)&&finite(q.ask)&&q.bid>q.ask)issues.push('Crossed bid/ask');
 const spread=finite(q.bid)&&finite(q.ask)&&q.ask>0?(q.ask-q.bid)/q.ask*100:null;
 if(finite(spread)&&spread>10)issues.push('Wide spread >10%');
 if(!q.tradeAt)issues.push('Last exchange trade time unavailable');
 else {const t=Date.parse(q.tradeAt);if(!finite(t)||t>now+60000||now-t>300000)issues.push('Last exchange trade stale/invalid');}
 if(!q.quoteAt)issues.push('Provider quote time unavailable');
 else {const t=Date.parse(q.quoteAt);if(!finite(t)||t>now+60000||now-t>300000)issues.push('Provider quote stale/invalid');}
 if(!q.retrievedAt)issues.push('HTTP retrieval time unavailable');
 else {const t=Date.parse(q.retrievedAt);if(!finite(t)||t>now+60000||now-t>180000)issues.push('HTTP retrieval stale/invalid');}
 return {issues,spread,available:issues.length===0};
}
function snapshot(chain,spot,now=Date.now()){
 const c=chain&&Array.isArray(chain.rows)?chain:E.normalizeChain(chain),a=E.analytics(c,spot),at=Date.parse(c.fetchedAt);
 check(Number.isFinite(at)&&at<=now+60000&&at>=now-600000,'Recent provider HTTP retrieval time (within 10 minutes) required to save history; refresh chain first.');
 check(c.rows.length>0&&finite(spot)&&spot>0,'Valid HAL price and chain required.');
 check(/^\d{4}-\d{2}-\d{2}$/.test(c.expiry)&&Number.isFinite(E.end(c.expiry))&&E.end(c.expiry)>=at,'Cannot capture an expired or unidentified option chain.');
 const atm=c.rows.reduce((p,q)=>Math.abs(p.strike-spot)<Math.abs(q.strike-spot)?p:q,c.rows[0]),call=E.info(atm.call),put=E.info(atm.put);
 return {at:c.fetchedAt,day:new Date(at+IST).toISOString().slice(0,10),expiry:c.expiry,spot,pcr:a.pcr,maxPain:a.maxPain,callOI:a.callOI,putOI:a.putOI,iv:a.atmIv,atmStrike:atm.strike,rollingStraddle:finite(call.price)&&finite(put.price)?call.price+put.price:null,source:c.source,notes:'Market observation only, not an executable price.'};
}
function history(raw){
 if(!raw||raw.version!==1||!Array.isArray(raw.samples)||raw.samples.length>1200)throw Error('Invalid HAL options history.');
 const seen=new Set(),out=[];
 for(const s of raw.samples){
  if(!s||typeof s.at!=='string'||!Number.isFinite(Date.parse(s.at))||typeof s.expiry!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.expiry)||!/^\d{4}-\d{2}-\d{2}$/.test(s.day))throw Error('Corrupt HAL options history; existing observations have not been silently replaced.');
  const key=s.expiry+'|'+s.at;if(seen.has(key))continue;seen.add(key);
   if(s.at.slice(0,10)!==s.day&&new Date(Date.parse(s.at)+IST).toISOString().slice(0,10)!==s.day)throw Error('Options history trading-date mismatch.');
  const sample={at:s.at,day:String(s.day||''),expiry:String(s.expiry).slice(0,10)};
  for(const name of ['spot','pcr','maxPain','callOI','putOI','iv','atmStrike','rollingStraddle'])sample[name]=finite(s[name])?s[name]:null;
  out.push(sample);
 }
 return {version:1,samples:out.sort((a,b)=>a.at.localeCompare(b.at)).slice(-1000)};
}
function appendHistory(raw,s){
 const h=history(raw||{version:1,samples:[]});h.samples=h.samples.filter(x=>x.at!==s.at||x.expiry!==s.expiry);h.samples.push(s);h.samples.sort((a,b)=>a.at.localeCompare(b.at));h.samples=h.samples.slice(-1000);return history(h);
}
function ivPercentile(raw,expiry,min=20){
 const s=history(raw).samples.filter(x=>x.expiry===expiry&&finite(x.iv)),byDay=new Map();
 for(const x of s)byDay.set(x.day,x.iv);
 const values=[...byDay.values()],latest=values[values.length-1];
 if(values.length<min||!finite(latest))return {value:null,count:values.length,required:min,reason:'At least '+min+' distinct captured trading sessions required for IV percentile of this expiry.'};
 const below=values.filter(v=>v<latest).length,equal=values.filter(v=>v===latest).length;
 return {value:100*(below+0.5*equal)/values.length,count:values.length,required:min,latest,method:'Percentage of saved sessions with lower ATM IV (half credit for ties). Snapshot history only; not exchange historical IV.'};
}
function pop(legs,spot,iv,rate=6,dividend=0,now=Date.now()){
 const risk=riskSummary(legs,spot,0,now);check(risk.exact,'Shared non-expired expiry required for theoretical probability.');
 const expiry=E.end(legs[0].expiry),T=(expiry-now)/YEAR,v=iv/100,r=rate/100,q=dividend/100;
 check(T>0&&finite(spot)&&spot>0&&finite(iv)&&iv>0&&iv<=500,'IV and time to expiry required for theoretical probability.');
 const br=risk.breakevens.slice().sort((a,b)=>a-b),cuts=[0,...br,Infinity],pnl=E.evaluate(legs,{now,mode:'expiry'}).price;
 function dist(s){if(s===Infinity)return 1;if(s<=0)return 0;const z=(Math.log(s/spot)-(r-q-v*v/2)*T)/(v*Math.sqrt(T));return N(z);}
 let probability=0;
 for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1],mid=b===Infinity?Math.max(spot*3,a*2+spot):a+(b-a)/2;if(pnl(mid)>0)probability+=dist(b)-dist(a);}
 return {probability:Math.min(1,Math.max(0,probability)),model:'Risk-neutral lognormal estimate based on user-supplied IV, r, q; excludes fees and physical-settlement outcomes; not a real-world probability.'};
}
const api={CATALOG:catalog(),template,catalog,greeks,riskSummary,quoteSafety,snapshot,history,appendHistory,ivPercentile,pop};
Object.assign(E,api);
if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
