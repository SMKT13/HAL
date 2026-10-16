/* HAL Desk research and risk calculations. Pure functions; no network or credentials. */
(function(root){
'use strict';
const C=typeof module!=='undefined'?require('./core.js'):root.HALCore;
const {finite,value,validDate}=C,DAY=86400000;
const istDate=(t=Date.now())=>new Date(t+19800000).toISOString().slice(0,10);
const expiryTime=d=>validDate(d)?Date.parse(d+'T15:30:00+05:30'):NaN;
const daysLeft=(d,now=Date.now())=>(expiryTime(d)-now)/DAY;
const sum=a=>a.reduce((s,x)=>s+x,0),mean=a=>a.length?sum(a)/a.length:null;
function safeURL(s){try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&!/^(localhost|127\.|0\.|192\.168\.|10\.)/.test(u.hostname)?u.href:null;}catch(e){return null;}}
function candles(raw){
 const map=new Map();for(const a of (Array.isArray(raw)?raw:[])){
  if(!Array.isArray(a)||a.length<6)continue;const t=Date.parse(a[0]),[o,h,l,c,v]=a.slice(1,6);
  if(!finite(t)||![o,h,l,c,v].every(finite)||Math.min(o,h,l,c)<=0||v<0||h<Math.max(o,c,l)||l>Math.min(o,c,h))continue;
  map.set(t,{t,o,h,l,c,v,oi:finite(a[6])?a[6]:null});
 }return [...map.values()].sort((a,b)=>a.t-b.t);
}
function completed(rows,frame='D',now=Date.now()){
 const interval=frame==='15m'?900000:3600000;
 return rows.filter(r=>frame==='D'?istDate(r.t)<istDate(now)||(istDate(r.t)===istDate(now)&&now>=Date.parse(istDate(now)+'T16:00:00+05:30')):r.t+interval<=now);
}
function sma(a,n){return a.map((_,i)=>i<n-1?null:mean(a.slice(i-n+1,i+1)));}
function ema(a,n){const out=a.map(()=>null);let e=null,window=[];for(let i=0;i<a.length;i++){if(!finite(a[i])){window=[];e=null;continue;}if(e===null){window.push(a[i]);if(window.length===n)e=mean(window);}else e=a[i]*2/(n+1)+e*(1-2/(n+1));out[i]=e;}return out;}
function rsi(a,n=14){const out=a.map(()=>null);if(a.length<=n)return out;let gain=0,loss=0;for(let i=1;i<=n;i++){gain+=Math.max(0,a[i]-a[i-1]);loss+=Math.max(0,a[i-1]-a[i]);}gain/=n;loss/=n;const calc=()=>gain===0&&loss===0?50:loss===0?100:100-100/(1+gain/loss);out[n]=calc();for(let i=n+1;i<a.length;i++){gain=(gain*(n-1)+Math.max(0,a[i]-a[i-1]))/n;loss=(loss*(n-1)+Math.max(0,a[i-1]-a[i]))/n;out[i]=calc();}return out;}
function atr(rows,n=14){if(rows.length<=n)return null;const tr=rows.slice(1).map((r,i)=>Math.max(r.h-r.l,Math.abs(r.h-rows[i].c),Math.abs(r.l-rows[i].c)));let x=mean(tr.slice(0,n));for(const y of tr.slice(n))x=(x*(n-1)+y)/n;return x;}
function technicals(raw,frame='D',now=Date.now(),fetchedAt=null){
 const all=candles(raw),rows=completed(all,frame,now),cl=rows.map(r=>r.c),last=rows.at(-1),n=cl.length;
 if(!last)return {ready:false,reason:'No completed candles available.',rows,all};
 const s20=sma(cl,20),s50=sma(cl,50),s200=sma(cl,200),e12=ema(cl,12),e26=ema(cl,26),macd=cl.map((_,i)=>finite(e12[i])&&finite(e26[i])?e12[i]-e26[i]:null),signal=ema(macd,9),rs=rsi(cl),hist=finite(signal.at(-1))?macd.at(-1)-signal.at(-1):null;
 const bbMean=mean(cl.slice(-20)),sd=n>=20?Math.sqrt(mean(cl.slice(-20).map(x=>(x-bbMean)**2))):null;
 const p=(last.h+last.l+last.c)/3,returns=cl.slice(-21).map((x,i,a)=>i?Math.log(x/a[i-1]):null).slice(1);
 const vol=frame==='D'&&returns.length===20?Math.sqrt(sum(returns.map(x=>(x-mean(returns))**2))/19)*Math.sqrt(252)*100:null;
 let mfi=null;if(n>=15){let pos=0,neg=0;for(let i=n-14;i<n;i++){const a=rows[i],b=rows[i-1],tp=(a.h+a.l+a.c)/3,prev=(b.h+b.l+b.c)/3;if(tp>prev)pos+=tp*a.v;else if(tp<prev)neg+=tp*a.v;}mfi=pos===0&&neg===0?50:neg===0?100:100-100/(1+pos/neg);}
 const age=now-Date.parse(fetchedAt||''),stale=!finite(age)||age< -60000||age>1800000||now-last.t>(frame==='D'?5*DAY:4*DAY);
 let score=0;const evidence=[];for(const [label,v] of [['SMA 20',s20.at(-1)],['SMA 50',s50.at(-1)]])if(finite(v)){score+=last.c>v?1:last.c<v?-1:0;evidence.push({label,value:v,reading:last.c>v?'Close above':last.c<v?'Close below':'At average'});}
 if(finite(hist)){score+=Math.sign(hist);evidence.push({label:'MACD histogram',value:hist,reading:hist>0?'Positive':'Negative'});}if(finite(rs.at(-1))){score+=rs.at(-1)>55?1:rs.at(-1)<45?-1:0;evidence.push({label:'RSI 14',value:rs.at(-1),reading:rs.at(-1)>70?'Overbought range':rs.at(-1)<30?'Oversold range':'Momentum range'});}
 return {ready:n>=50,stale,rows,all,frame,asOf:last.t,provisional:all.length>rows.length,close:last.c,sma20:s20.at(-1),sma50:s50.at(-1),sma200:s200.at(-1),rsi:rs.at(-1),macd:macd.at(-1),signal:signal.at(-1),hist,atr:atr(rows),mfi,bbLow:finite(sd)?bbMean-2*sd:null,bbHigh:finite(sd)?bbMean+2*sd:null,vol,pivot:p,s1:2*p-last.h,r1:2*p-last.l,support:Math.min(...rows.slice(-20).map(r=>r.l)),resistance:Math.max(...rows.slice(-20).map(r=>r.h)),bias:n<50?'Insufficient history':stale?'Data needs refresh':score>=2?'Bullish':score<=-2?'Bearish':'Neutral',evidence,series:{sma20:s20,sma50:s50,rsi:rs,macd,signal}};
}
function chainFor(l,s){return s?.option_expiry===l.expiry?s:s?.chains?.[l.expiry];}
function optionFor(l,s){return (chainFor(l,s)?.option_rows||[]).find(x=>x.strike===l.strike)?.put||null;}
function risk(legs,s,now=Date.now()){
 const active=legs.filter(l=>expiryTime(l.expiry)>=now),futs=active.filter(l=>l.type==='FUT'),puts=active.filter(l=>l.type==='PE');
 const units=l=>l.lots*l.lotSize,futureUnits=sum(futs.map(units)),putUnits=sum(puts.map(units));
 let delta=futureUnits,theta=0,greeksComplete=true;const warnings=[];
 for(const l of puts){const q=optionFor(l,s),chain=chainFor(l,s),age=now-Date.parse(chain?.fetched_at_iso);if(s?.researchUnavailable||s?.failedExpiries?.includes(l.expiry)||chain?.chain_error||!finite(age)||age< -60000||age>120000||q?.lot_size!==l.lotSize||!finite(q?.delta)||q.delta>0||q.delta< -1||!finite(q?.theta)){greeksComplete=false;continue;}delta+=q.delta*units(l);theta+=q.theta*units(l);}
 const dates=[...new Set(active.map(l=>l.expiry))].sort();
 const timeline=dates.map(d=>{const f=sum(futs.filter(l=>l.expiry>d).map(units)),p=sum(puts.filter(l=>l.expiry>d).map(units));return {date:d,futureUnits:f,putUnits:p,uncovered:Math.max(0,f-p),expiring:active.filter(l=>l.expiry===d)};});
 if(legs.some(l=>expiryTime(l.expiry)<now))warnings.push({level:'warn',title:'Expired leg needs review',detail:'Record the actual close or settlement, then update the open book. It is excluded from active exposure.'});
 if(futureUnits>putUnits)warnings.push({level:'warn',title:'Partial quantity coverage',detail:`${futureUnits-putUnits} futures units have no corresponding active put units. Protection also depends on strikes and expiry.`});
 const gap=timeline.find(t=>t.uncovered>0);if(gap)warnings.push({level:'warn',title:'Protection ends before futures',detail:`After ${gap.date}, ${gap.uncovered} futures units have no matching put quantity. Compare extending the hedge or changing exposure.`});
 const near=active.filter(l=>daysLeft(l.expiry,now)<=7);if(near.length)warnings.push({level:'warn',title:'Expiry within seven days',detail:'Review your rollover, funding and broker settlement requirements for the expiring legs.'});
 if(!greeksComplete)warnings.push({level:'muted',title:'Greeks incomplete',detail:'Refresh each put expiry and verify its lot size. Basket delta and theta require complete Greeks retrieved within two minutes; option trade timestamps are unavailable.'});
 return {futureUnits,putUnits,coverage:futureUnits?putUnits/futureUnits*100:null,delta:greeksComplete?delta:null,theta:greeksComplete?theta:null,greeksComplete,timeline,warnings,nextExpiry:dates[0]||null,premiumAtEntry:sum(puts.map(l=>l.entry*units(l)))};
}
function cdf(x){const t=1/(1+0.2316419*Math.abs(x)),d=0.3989422804014327*Math.exp(-x*x/2),p=1-d*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));return x>=0?p:1-p;}
function putPrice(S,K,T,iv,r=0.06,q=0){
 if(![S,K,T,iv,r,q].every(finite)||S<=0||K<=0||iv<0||T<0)throw Error('Invalid option-model inputs.');
 if(T===0)return Math.max(K-S,0);if(iv===0)return Math.max(K*Math.exp(-r*T)-S*Math.exp(-q*T),0);
 const d1=(Math.log(S/K)+(r-q+iv*iv/2)*T)/(iv*Math.sqrt(T)),d2=d1-iv*Math.sqrt(T);
 return Math.max(0,K*Math.exp(-r*T)*cdf(-d2)-S*Math.exp(-q*T)*cdf(-d1));
}
function scenario(legs,s,{spot,days=0,ivShift=0,fallbackIV=null,rate=6,dividend=0},now=Date.now()){
 C.validate(legs);if(!finite(spot)||spot<=0||!finite(days)||days<0||!finite(ivShift)||![rate,dividend].every(finite))throw Error('Enter valid price, time and model assumptions.');
 const base=s?.spot?.last_price;if(!finite(base)||base<=0)throw Error('A HAL spot quote is required.');
 const horizon=now+days*DAY;if(legs.some(l=>expiryTime(l.expiry)<now))throw Error('Review expired legs before modelling the open basket.');
 if(legs.some(l=>horizon>expiryTime(l.expiry)+1000))throw Error('Choose a horizon on or before the earliest expiry. A later price cannot determine an earlier settlement payoff.');
 const rows=legs.map(l=>{let mark,iv=null;const T=Math.max(0,(expiryTime(l.expiry)-horizon)/DAY/365);if(l.type==='FUT'){const m=C.mark(l,s);if(!finite(m.price))throw Error('A current futures mark is required.');mark=T===0?spot:m.price+(spot-base);}else{const option=optionFor(l,s);if(finite(option?.lot_size)&&option.lot_size!==l.lotSize)throw Error('Put lot size differs from the listed contract.');const provider=option?.iv;iv=finite(provider)&&provider>0?provider:fallbackIV;if(!finite(iv)||iv<=0)throw Error('Put IV missing. Load its chain or enter an explicit IV assumption.');iv+=ivShift;if(iv<=0||iv>500)throw Error('Scenario IV must be above 0% and at most 500%.');mark=putPrice(spot,l.strike,T,iv/100,rate/100,dividend/100);}return {...l,modelPrice:mark,iv,pnl:(mark-l.entry)*l.lots*l.lotSize};});
 return {total:sum(rows.map(l=>l.pnl)),rows,horizon,assumptions:'European Black–Scholes puts; futures move one-for-one with spot at constant basis before expiry. No path, margin, fees or execution-price guarantee.'};
}
function closeLeg(book,index,lots,exit,fees,date){
 const leg=book.legs[index];if(!leg||!Number.isInteger(lots)||lots<1||lots>leg.lots||!finite(exit)||exit<0||!finite(fees)||fees<0||!validDate(date)||date>istDate())throw Error('Check closed lots, price, charges and date.');
 const next=JSON.parse(JSON.stringify(book)),record={id:'j-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),kind:'close',date,leg:{...leg,lots},exit,fees,gross:(exit-leg.entry)*lots*leg.lotSize};
 next.journal.push(record);if(lots===leg.lots)next.legs.splice(index,1);else next.legs[index].lots-=lots;return next;
}
function ledger(book,s){const journal=book.journal||[],closed=journal.filter(j=>j.kind==='close');const realized=sum(closed.map(j=>(j.exit-j.leg.entry)*j.leg.lots*j.leg.lotSize)),charges=sum(journal.filter(j=>j.kind==='fee').map(j=>j.amount))+sum(closed.map(j=>j.fees));const open=C.mtm(book.legs||[],s);return {realized,charges,open:open.total,net:open.complete||!book.legs.length?realized+(open.total||0)-charges:null,settlements:sum(journal.filter(j=>j.kind==='settlement').map(j=>j.amount)),netPutPremium:sum(closed.filter(j=>j.leg.type==='PE').map(j=>(j.leg.entry-j.exit)*j.leg.lots*j.leg.lotSize))+sum(book.legs.filter(l=>l.type==='PE').map(l=>l.entry*l.lots*l.lotSize))};}
function emptyBook(){return {version:2,legs:[],journal:[],notes:[],bookmarks:[],funding:{margin:null,free:null,at:null},preferences:{theme:'dark',auto:true,markMode:'ltp'}};}
function validateBook(b){
 if(!b||b.version!==2||!Array.isArray(b.legs)||b.legs.length>12)throw Error('Not a HAL Desk version 2 backup.');
 if(b.legs.length)C.validate(b.legs);const clean=emptyBook();clean.legs=b.legs.map(l=>({type:l.type,expiry:l.expiry,lots:l.lots,lotSize:l.lotSize,entry:l.entry,strike:l.type==='PE'?l.strike:null,manual:l.manual??null,manualAt:typeof l.manualAt==='string'?l.manualAt:null}));
 if(!Array.isArray(b.journal)||b.journal.length>2000||!Array.isArray(b.notes)||b.notes.length>500||!Array.isArray(b.bookmarks)||b.bookmarks.length>200)throw Error('Backup exceeds supported record limits.');
 clean.journal=b.journal.map(j=>{if(!j||!['close','fee','settlement'].includes(j.kind)||!validDate(j.date))throw Error('Invalid journal record.');const x={id:String(j.id||'').slice(0,100),kind:j.kind,date:j.date,note:String(j.note||'').slice(0,1000)};if(j.kind==='close'){C.validate([j.leg]);if(!finite(j.exit)||j.exit<0||!finite(j.fees)||j.fees<0)throw Error('Invalid close record.');Object.assign(x,{leg:{type:j.leg.type,expiry:j.leg.expiry,lots:j.leg.lots,lotSize:j.leg.lotSize,entry:j.leg.entry,strike:j.leg.type==='PE'?j.leg.strike:null,manual:j.leg.manual??null},exit:j.exit,fees:j.fees});}else{if(!finite(j.amount)||(j.kind==='fee'&&j.amount<0))throw Error('Invalid cash record.');x.amount=j.amount;}return x;});
 clean.notes=b.notes.map(n=>({id:String(n.id||'').slice(0,100),date:validDate(n.date)?n.date:istDate(),title:String(n.title||'').slice(0,200),text:String(n.text||'').slice(0,3000),url:safeURL(n.url)||'',category:['Order book','Deliveries','Guidance','Results','Other'].includes(n.category)?n.category:'Other',eventDate:validDate(n.eventDate)?n.eventDate:null}));
 clean.bookmarks=b.bookmarks.filter(n=>safeURL(n.url)).map(n=>({title:String(n.title||'').slice(0,300),url:safeURL(n.url),published:String(n.published||'').slice(0,60),source:String(n.source||'').slice(0,100)}));
 const f=b.funding||{};clean.funding={margin:finite(f.margin)&&f.margin>=0?f.margin:null,free:finite(f.free)&&f.free>=0?f.free:null,at:typeof f.at==='string'?f.at:null};
 const p=b.preferences||{};clean.preferences={theme:['dark','light','system'].includes(p.theme)?p.theme:'dark',auto:p.auto!==false,markMode:p.markMode==='bid'?'bid':'ltp'};return clean;
}
function topic(text){const s=text.toLowerCase();if(/\bmou\b|memorandum/.test(s))return 'MoU';if(/result|profit|revenue|earning|dividend/.test(s))return 'Results';if(/order|contract|procurement/.test(s))return 'Orders';if(/deliver|production|engine|supply|tejas/.test(s))return 'Operations';if(/government|defence|defense|policy|budget/.test(s))return 'Sector';return 'Market';}
function newsItems(data){const out=[];for(const list of Object.values(data||{})){if(!Array.isArray(list))continue;for(const n of list){if(typeof n.heading!=='string'||!safeURL(n.article_link))continue;const t=Number(n.published_time);out.push({title:n.heading.slice(0,500),summary:String(n.summary||'').slice(0,1800),url:safeURL(n.article_link),published:finite(t)&&t>0&&t<=8640000000000000?new Date(t).toISOString():null,source:'Upstox News',official:false,topic:topic(n.heading+' '+(n.summary||''))});}}return out.sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));}
function groupNews(items){
 const groups=[];for(const n of items){const tokens=new Set(n.title.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(x=>x.length>2&&!['hal','the','and','for','with','from','hindustan','aeronautics'].includes(x))),numbers=(n.title.match(/\d+(?:\.\d+)?/g)||[]).join('|');
 const match=groups.find(g=>g.item.url===n.url||(Math.abs(Date.parse(g.item.published)-Date.parse(n.published))<DAY&&g.numbers===numbers&&tokens.size>=4&&[...tokens].filter(t=>g.tokens.has(t)).length/Math.max(tokens.size,g.tokens.size)>=0.8));
 if(match){if(!match.related.some(x=>x.url===n.url)&&match.item.url!==n.url)match.related.push(n);}else groups.push({item:n,related:[],tokens,numbers});
 }return groups;
}
function financialSummary(payload){
 const data=payload?.income,rows=data?.income_statement||[],latest=cat=>rows.find(r=>r.category===cat)?.history?.[0];const revenue=latest('revenue'),profit=latest('net_profit'),op=latest('operating_profit');
 const margin=finite(revenue?.value)&&revenue.value>0&&profit?.period===revenue.period&&finite(profit.value)?profit.value/revenue.value*100:null;
 const opMargin=finite(revenue?.value)&&revenue.value>0&&op?.period===revenue.period&&finite(op.value)?op.value/revenue.value*100:null;
 const cash=payload?.cash?.cash_flow?.find(r=>r.category==='operating')?.history?.[0];
 const annualProfit=payload?.annual?.income_statement?.find(r=>r.category==='net_profit')?.history?.find(p=>p.period===cash?.period);
 return {revenue,profit,margin,opMargin,cash,conversion:finite(annualProfit?.value)&&annualProfit.value>0&&finite(cash?.value)?cash.value/annualProfit.value:null};
}
const api={istDate,expiryTime,daysLeft,safeURL,candles,completed,sma,ema,rsi,atr,technicals,optionFor,risk,cdf,putPrice,scenario,closeLeg,ledger,emptyBook,validateBook,topic,newsItems,groupNews,financialSummary};
if(typeof module!=='undefined')module.exports=api;root.HALAnalytics=api;
})(typeof globalThis!=='undefined'?globalThis:this);
