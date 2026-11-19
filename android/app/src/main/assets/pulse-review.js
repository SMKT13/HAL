/* Closing-book comparisons and periodic company measures. */
(function(root){
'use strict';
const finite=Number.isFinite;
function holdings(legs){
 return legs.map(({id,type,expiry,strike,lots,lotSize,entry,instrumentKey})=>({id,type,expiry,strike,lots,lotSize,entry,instrumentKey})).sort((a,b)=>a.id.localeCompare(b.id));
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function observe(log,legs,now,expected){
 const current=holdings(legs),last=log[log.length-1];
 if(last&&(last.at>now||(expected&&!same(last.legs,holdings(expected)))))log=[];
 if(log.length&&same(log[log.length-1].legs,current))return log;
 return [...log,{at:now,legs:current}].slice(-80);
}
function explain(before,after){
 const changes=[];
 for(const id of new Set([...before,...after].map(x=>x.id))){
  const a=before.find(x=>x.id===id),b=after.find(x=>x.id===id),leg=b||a;
  const name=(leg.type==='FUT'?'future':leg.strike+' put')+' '+leg.expiry;
  if(!a)changes.push('Added '+b.lots+' lot(s) '+name);
  else if(!b)changes.push('Removed '+a.lots+' lot(s) '+name);
  else if(b.lots!==a.lots)changes.push((b.lots>a.lots?'Added ':'Reduced ')+Math.abs(b.lots-a.lots)+' lot(s) '+name);
  else if(!same(a,b))changes.push('Edited '+name);
 }
 return changes;
}
function compare(log,cutoff,currentOpen,previousMark){
 const prior=log.filter(x=>x.at<=cutoff).pop();
 if(!prior)return {delta:null,activity:[],baseline:false};
 let oldOpen=0;
 for(const leg of prior.legs){
  const p=previousMark(leg);
  if(!finite(p)||p<0||(leg.type==='FUT'&&p===0)){oldOpen=null;break;}
  oldOpen+=(p-leg.entry)*leg.lotSize*leg.lots;
 }
 let previous=prior.legs,activity=[];
 for(const record of log.filter(x=>x.at>cutoff)){
  activity.push(...explain(previous,record.legs));previous=record.legs;
 }
 return {baseline:true,delta:finite(oldOpen)&&finite(currentOpen)?currentOpen-oldOpen:null,activity};
}
function marginChange(current,prior){return finite(current)&&finite(prior)?current-prior:null;}
const labels=['Promoters','Domestic institutions','Foreign institutions','Public / others'];
function classify(name){
 const n=String(name).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(/^(grand total|total|total shareholding|total shareholders|number of shareholders|non promoter|institutions)$/.test(n))return null;
 if(/promoter/.test(n)&&!/non promoter/.test(n))return [0,true];
 if(/\bdii[s]?\b/.test(n))return [1,true];
 if(/\b(?:fii|fpi)[s]?\b/.test(n)&&!/category|cat [iv]+/.test(n))return [2,true];
 if(/^(domestic institutional investors?|domestic institutions?|dii[s]?|domestic institutional holdings?)$/.test(n))return [1,true];
 if(/mutual fund|insurance|pension|provident|banks?|domestic financial institution/.test(n))return [1,false];
 if(/^(foreign institutional investors?|foreign institutions?|fii[s]?|fpi[s]?|foreign portfolio investors?)$/.test(n))return [2,true];
 if(/foreign portfolio|foreign institution/.test(n))return [2,false];
 if(/^(public|public others|public retail|public shareholding|public and others)$/.test(n))return [3,true];
 if(/retail|individual|others?|bod(y|ies) corporate|non institutional|government|employee|nri/.test(n))return [3,false];
 return null;
}
function groupOwnership(groups,period){
 const buckets=labels.map(()=>({total:[],parts:[]}));
 for(const g of groups){
  const c=classify(g.category);if(!c)continue;
  const history=Array.isArray(g.history)?g.history:[],entry=history.find(h=>h.period===period);
  buckets[c[0]][c[1]?'total':'parts'].push(entry?.value);
 }
 const values=buckets.map(b=>{const v=b.total.length?b.total:b.parts;
  if(!v.length||v.some(x=>!finite(x)||x<0||x>100))return null;
  if(b.total.length)return v.every(x=>x===v[0])?v[0]:null;
  const sum=v.reduce((a,b)=>a+b,0);return sum<=100?sum:null;
 });
 // Public totals sometimes include institutions. Use the residual only when
 // the other three groups are independently reported as complete aggregates.
 if(values.slice(0,3).every(finite)&&buckets.slice(0,3).every(b=>b.total.length)){
  const residual=100-values[0]-values[1]-values[2];
  if(residual>=-.03&&(values[3]===null||Math.abs(values[3]-residual)>.05))values[3]=Math.max(0,Number(residual.toFixed(2)));
 }
 return values;
}
const api={holdings,observe,compare,marginChange,groupOwnership,labels};
if(typeof module==='object')module.exports=api;else root.AtlasPulseReview=api;
})(typeof window==='object'?window:globalThis);
