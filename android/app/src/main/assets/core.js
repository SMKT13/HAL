(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const value=x=>x===''||x===null||x===undefined?null:(Number.isFinite(Number(x))?Number(x):null);
const validDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===s;};
function validate(legs){
 if(!Array.isArray(legs)||!legs.length)throw Error('Add at least one long futures or put position.');
 for(const l of legs){
  if(!['FUT','PE'].includes(l.type)||!validDate(l.expiry))throw Error('Check the contract type and expiry date.');
  if(!Number.isInteger(l.lots)||l.lots<=0||l.lots>10000)throw Error('Lots must be a positive whole number.');
  if(!Number.isInteger(l.lotSize)||l.lotSize<=0||l.lotSize>100000)throw Error('Enter the verified units per lot for every leg.');
  if(!finite(l.entry)||l.entry<=0||l.entry>10000000)throw Error('Enter a positive entry price or premium.');
  if(l.type==='PE'&&(!finite(l.strike)||l.strike<=0))throw Error('Enter a positive put strike.');
  if(l.manual!==null&&(!finite(l.manual)||l.manual<0))throw Error('Manual marks cannot be negative.');
 }
 return legs;
}
function mark(leg,snapshot){
 let quote=null,lot=null,kind='Unavailable',stamp=null,contract=null;
 if(leg.type==='FUT'){
  const c=(snapshot?.futures||[]).find(x=>x.expiry===leg.expiry);contract=c?.quote;quote=c?.quote?.last_price;lot=c?.lot_size;stamp=c?.quote?.quote_as_of;
 }else {
  const chain=snapshot?.option_expiry===leg.expiry?snapshot:snapshot?.chains?.[leg.expiry];
  const c=(chain?.option_rows||[]).find(x=>x.strike===leg.strike)?.put;contract=c?.quote||c;quote=c?.quote?c.quote.last_price:c?.ltp;lot=c?.lot_size;stamp=c?.quote?.quote_as_of??null;
 }
 if(finite(lot)&&lot!==leg.lotSize)return {price:null,source:'Lot size differs from the listed contract',mismatch:true};
 if(finite(leg.manual))return {price:leg.manual,source:'Manual mark',stamp:leg.manualAt||null,contract};
 if(snapshot?.markMode==='bid') {quote=contract?.bid;kind='Indicative bid';}else kind='Upstox LTP';
 if(finite(quote)&&quote>0)return {price:quote,source:kind,stamp,contract};
 return {price:null,source:kind};
}
function mtm(legs,snapshot){
 const rows=legs.map(l=>{const m=mark(l,snapshot);return {...l,...m,pnl:finite(m.price)?(m.price-l.entry)*l.lots*l.lotSize:null};});
 const complete=rows.length>0&&rows.every(x=>finite(x.pnl));
 return {rows,complete,total:complete?rows.reduce((sum,l)=>sum+l.pnl,0):null};
}
function payoff(legs,spot){
 validate(legs);if(!finite(spot)||spot<0)throw Error('Enter a non-negative settlement price.');
 if(new Set(legs.map(l=>l.expiry)).size!==1)throw Error('Mixed expiries: a single-expiry payoff would be misleading.');
 return legs.reduce((sum,l)=>sum+(l.type==='FUT'?spot-l.entry:Math.max(l.strike-spot,0)-l.entry)*l.lots*l.lotSize,0);
}
function lotFor(leg,snapshot){
 if(leg.type==='FUT')return (snapshot?.futures||[]).find(c=>c.expiry===leg.expiry)?.lot_size??null;
 if(snapshot?.option_expiry!==leg.expiry)return null;
 return (snapshot.option_rows||[]).find(c=>c.strike===leg.strike)?.put?.lot_size??null;
}
function freshness(snapshot,now=Date.now()){
 if(!snapshot)return 'No quote yet';
 const times=[snapshot.spot?.quote_as_of,snapshot.spot?.last_trade_at].map(t=>Date.parse(t)).filter(Number.isFinite);
 if(!times.length)return 'Provider time unavailable';
 if(times.some(t=>t>now+60000))return 'Check device/provider clock';
 return now-Math.min(...times)>120000?'Older market quote':'Recent market quote';
}
const api={finite,value,validDate,validate,mark,mtm,payoff,lotFor,freshness};
if(typeof module!=='undefined'&&typeof require==='function')module.exports=api;root.HALCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
