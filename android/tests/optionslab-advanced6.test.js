'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/optionslab5.js');
require('../app/src/main/assets/optionslab-advanced6.js');
const NOW=Date.parse('2026-11-14T05:00:00Z'),DATE='2026-12-29',near=(a,b,eps=1e-5)=>A.ok(Math.abs(a-b)<eps, a+' versus '+b);
const chain=(date=DATE)=>E.normalizeChain({option_expiry:date,fetched_at_iso:'2026-11-14T05:00:00Z',source:'synthetic Upstox data',option_rows:[90,95,100,105,110,115].map(strike=>({
 strike,call:{instrument_key:'C'+date+strike,lot_size:150,quote:{last_price:6,bid:5,ask:7,open_interest:1000,previous_oi:850,volume:1200,quote_as_of:'2026-11-14T04:59:59Z',last_trade_at:'2026-11-14T04:59:59Z',retrieved_at:'2026-11-14T05:00:00Z'},iv:25},
 put:{instrument_key:'P'+date+strike,lot_size:150,quote:{last_price:8,bid:7,ask:9,open_interest:1500,previous_oi:1450,volume:1000,quote_as_of:'2026-11-14T04:59:59Z',last_trade_at:'2026-11-14T04:59:59Z',retrieved_at:'2026-11-14T05:00:00Z'},iv:31}
}))});
test('all 38 APK-named strategy categories are catalogued without proprietary assets',()=>{
 A.equal(E.CATALOG.length,38);A.equal(new Set(E.CATALOG.map(x=>x.id)).size,38);
 for(const x of E.CATALOG)A.ok(x.label&&x.mode&&x.outlook);
});
test('31 listed-chain recipes form validated whole-lot paper contracts',()=>{
 let count=0;for(const x of E.CATALOG){if(x.mode!=='single-expiry'||['buy_future','sell_future'].includes(x.id))continue;
 const legs=E.template(x.id,chain(),100);count++;A.ok(legs.length>0,x.id);
 for(const l of legs){A.deepEqual(E.leg(l),l);A.equal(l.lotSize,150);}
 }A.equal(count,31);
});
test('future templates never invent a spot-derived executable futures quote',()=>{
 A.throws(()=>E.template('buy_future',chain(),100),/verified lot size and quote/);
 const ls=E.template('buy_future',chain(),100,{futures:[{expiry:DATE,lotSize:150,price:101,instrumentKey:'F1'}]});
 A.equal(ls[0].type,'FUT');A.equal(ls[0].entry,101);
});
test('calendars require both listed expiries with exact strikes and quantity',()=>{
 A.throws(()=>E.template('long_calendar_with_calls',chain(),100),/Both option-expiry chains/);
 const b=chain('2027-01-28');const legs=E.template('long_calendar_with_calls',chain(),100,{otherChains:[b]});
 A.equal(legs.length,2);A.equal(legs[0].expiry,DATE);A.equal(legs[1].expiry,'2027-01-28');A.deepEqual(legs.map(x=>x.side),['SHORT','LONG']);
 A.equal(E.evaluate(legs,{now:NOW,mode:'target',iv:20,rate:6,dividend:0,basis:0}).exact,false);
});
test('unverified ambiguous strategy labels are manual, never guessed',()=>{
 for(const id of ['batman','double_plateau','range_forward'])A.throws(()=>E.template(id,chain(),100),/no unambiguous verified/);
});
test('risk summary identifies unlimited naked short-call exposure',()=>{
 const l=E.template('sell_call',chain(),100),r=E.riskSummary(l,100,0,NOW);
 A.equal(r.maxLoss,Infinity);A.ok(Number.isFinite(r.maxProfit));A.equal(r.exact,true);
});
test('risk summary with multiple expiries withholds fake risk bound',()=>{
 const ls=E.template('long_calendar_with_puts',chain(),100,{otherChains:[chain('2027-01-28')]}),r=E.riskSummary(ls,100,0,NOW);
 A.equal(r.exact,false);A.equal(r.expiryGap,true);A.ok(r.issues.some(x=>x.includes('Mixed expiries')));
});
test('model Greeks are signed, in share units, theta per day and vega per vol point',()=>{
 const long=E.greeks(E.template('buy_call',chain(),100),{spot:100,iv:25,rate:6,dividend:0,now:NOW}),
 short=E.greeks(E.template('sell_call',chain(),100),{spot:100,iv:25,rate:6,dividend:0,now:NOW});
 for(const k of ['delta','gamma','thetaDay','vegaPoint']){A.ok(Number.isFinite(long.net[k]));near(long.net[k],-short.net[k]);}
 A.ok(long.net.vegaPoint>0);A.ok(long.net.gamma>0);
});
test('quote safety flags wide spread and absent/stale clocks, not false freshness',()=>{
 const q=chain().rows[0].call;
 const good=E.quoteSafety(q,NOW);A.equal(good.issues.length,0);
 const bad=JSON.parse(JSON.stringify(q));bad.quote.bid=1;bad.quote.ask=100;bad.quote.last_trade_at='2026-11-01T00:00:00Z';
 const result=E.quoteSafety(bad,NOW);A.ok(result.issues.some(x=>/Wide spread/.test(x)));A.ok(result.issues.some(x=>/stale/.test(x)));
});
test('historical snapshot stores only HTTP-dated evidence and derived ATM straddle',()=>{
 const s=E.snapshot(chain(),100,NOW);A.equal(s.expiry,DATE);A.equal(s.rollingStraddle,14);A.equal(s.day,'2026-11-14');
 A.throws(()=>E.snapshot({...chain(),fetched_at_iso:null},100,NOW),/retrieval/);
});
test('OI/IV history is date and expiry scoped, stable sorted and deduplicated',()=>{
 const sample=E.snapshot(chain(),100,NOW),other={...sample,at:'2026-11-15T05:00:00Z',day:'2026-11-15'};
 const h=E.appendHistory(E.appendHistory(null,sample),sample);A.equal(h.samples.length,1);
 const h2=E.appendHistory(h,other);A.equal(h2.samples.length,2);
 A.equal(E.ivPercentile(h2,DATE).value,null);
});
test('IV percentile is withheld before 20 captured distinct trading sessions',()=>{
 let h={version:1,samples:[]};const d=Date.parse('2026-11-01T10:00:00Z');
 for(let i=0;i<19;i++){const at=new Date(d+i*86400000).toISOString(),day=at.slice(0,10);
 h=E.appendHistory(h,{at,day,expiry:DATE,iv:15+i});}
 A.equal(E.ivPercentile(h,DATE).value,null);A.equal(E.ivPercentile(h,DATE).count,19);
 const at=new Date(d+19*86400000).toISOString();h=E.appendHistory(h,{at,day:at.slice(0,10),expiry:DATE,iv:34});
 near(E.ivPercentile(h,DATE).value,97.5);
});
test('model POP stays in 0..1 and rejects mixed expiries / invalid IV',()=>{
 const ls=E.template('long_straddle',chain(),100),p=E.pop(ls,100,25,6,0,NOW);
 A.ok(p.probability>=0&&p.probability<=1);A.match(p.model,/risk-neutral/i);
 A.throws(()=>E.pop(ls,100,0,6,0,NOW),/IV and time/);
});
test('notes and PAPER engine do not mutate saved actual holdings',()=>{
 const book={legs:[{type:'FUT',expiry:DATE,lots:2,lotSize:150,entry:4900}]},before=JSON.stringify(book);
 E.template('short_strangle',chain(),100);E.riskSummary(E.actualCopy(book),100,0,NOW);A.equal(JSON.stringify(book),before);
});
