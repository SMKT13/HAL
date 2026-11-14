'use strict';
const test=require('node:test'),A=require('node:assert/strict'),E=require('../app/src/main/assets/optionslab5.js');
const NOW=Date.parse('2026-11-14T05:00:00Z'),EXP='2026-12-29';
const near=(a,b,tol=1e-4)=>A.ok(Math.abs(a-b)<=tol,'Expected '+a+' ≈ '+b);
const L=(type,side,strike,entry,patch={})=>({type,side,strike,entry,expiry:EXP,lots:1,lotSize:150,...patch});
function chain(){
 const strikes=[90,95,100,105,110];
 return E.normalizeChain({option_expiry:EXP,source:'unit-test fixture',fetched_at_iso:'2026-11-14T05:00:00Z',option_rows:strikes.map(k=>({strike:k,call:{instrument_key:'C'+k,lot_size:150,quote:{last_price:5,bid:4,ask:6,open_interest:200,previous_oi:180,volume:100,last_trade_at:'2026-11-14T05:00:00Z'},iv:25,delta:.5},put:{instrument_key:'P'+k,lot_size:150,quote:{last_price:5,bid:4,ask:6,open_interest:400,previous_oi:360,volume:100},iv:30,delta:-.5}}))});
}
const payoff=(legs,s,fees=0)=>E.evaluate(legs,{now:NOW,mode:'expiry',fees}).price(s);
test('independent PAPER validator accepts calls, puts, futures and shorts',()=>{
 for(const type of ['CE','PE','FUT'])for(const side of ['LONG','SHORT'])A.equal(E.leg(L(type,side,type==='FUT'?null:100,10)).type,type);
});
test('rejects missing strike, bad quantity, invalid side and negative entry',()=>{
 for(const x of [{strike:null},{lots:0},{lotSize:0},{side:'BOTH'},{entry:-1}])A.throws(()=>E.leg({...L('PE','LONG',100,5),...x}));
});
test('long put expiry P&L and fees',()=>near(payoff([L('PE','LONG',100,5)],80,25),(100-80-5)*150-25));
test('short put bounded loss for S>=0',()=>{
 const l=[L('PE','SHORT',100,5)],v=E.evaluate(l,{now:NOW}),s=E.summary(v,100);
 near(v.price(0),(-100+5)*150);A.equal(s.maxProfit,750);A.equal(s.maxLoss,14250);
});
test('short naked call is unbounded loss, no misleading sampled cap',()=>{
 const v=E.evaluate([L('CE','SHORT',100,5)],{now:NOW}),s=E.summary(v,100);
 A.equal(s.maxLoss,Infinity);near(s.maxProfit,750);
});
test('bull call debit spread has finite exact limits and one breakeven',()=>{
 const ls=[L('CE','LONG',95,6),L('CE','SHORT',105,4)],v=E.evaluate(ls,{now:NOW,fees:0}),s=E.summary(v,100);
 near(s.maxLoss,300);near(s.maxProfit,1200);A.deepEqual(s.breakevens,[97]);
});
test('long straddle two roots and unbounded upside',()=>{
 const v=E.evaluate([L('CE','LONG',100,5),L('PE','LONG',100,5)],{now:NOW}),s=E.summary(v,100);
 A.deepEqual(s.breakevens,[90,110]);A.equal(s.maxProfit,Infinity);near(s.maxLoss,1500);
});
test('fees charged once for basket not once per leg',()=>{
 const ls=[L('CE','LONG',95,6),L('CE','SHORT',105,4)];near(payoff(ls,100,15),payoff(ls,100)-15);
});
test('all ten strategy templates build independent whole lots',()=>{
 const c=chain();for(const [id]of E.TEMPLATES){const ls=E.template(id,c,100);A.ok(ls.length>=1,id);for(const l of ls){E.leg(l);A.equal(l.lotSize,150);} }
});
test('templates use buy asks and short bids, not unverified LTP',()=>{
 const ls=E.template('bull-call',chain(),100);A.deepEqual(ls.map(l=>l.entry),[6,4]);
});
test('template fails closed when quote absent',()=>{
 const c=chain();c.rows.find(r=>r.strike===95).call.quote.ask=null;A.throws(()=>E.template('bull-call',c,100),/quote required/);
});
test('full chain analytics uses known OI, PCR and previous OI fields',()=>{
 const a=E.analytics(chain(),100);near(a.pcr,2);A.equal(a.callOI,1000);A.equal(a.putOI,2000);A.equal(a.changeAvailable,true);near(a.atmIv,27.5);A.ok(a.maxPain!==null);
});
test('missing historic OI is not fabricated as change',()=>{
 const c=chain();for(const r of c.rows)for(const o of [r.call,r.put])delete o.quote.previous_oi;
 const a=E.analytics(c,100);A.equal(a.changeAvailable,false);A.ok(a.rows.every(r=>r.call.prevOi===null&&r.put.prevOi===null));
});
test('expiry payoff refuses mixed expiries',()=>{
 const a=L('PE','LONG',100,5),b=L('FUT','LONG',null,98,{expiry:'2026-12-31'});
 A.throws(()=>E.evaluate([a,b],{now:NOW,mode:'expiry'}),/Mixed expiries/);
});
test('target scenario requires explicit IV, costs and future basis',()=>{
 const v=E.evaluate([L('CE','LONG',100,5),L('FUT','LONG',null,100)],{now:NOW,mode:'target',iv:30,rate:6,dividend:0,basis:2,fees:10});
 A.ok(Number.isFinite(v.price(102)));A.equal(v.exact,false);
 A.throws(()=>E.evaluate([L('PE','LONG',100,5)],{now:NOW,mode:'target',iv:null,rate:6,dividend:0,basis:0}),/assumptions/);
});
test('mixed expiry valid intermediate date, later settlement withheld',()=>{
 const ls=[L('PE','LONG',100,5,{expiry:'2026-11-25'}),L('FUT','LONG',null,100)];
 A.ok(E.evaluate(ls,{now:NOW,mode:'target',horizon:'2026-11-24',iv:30,rate:6,dividend:0,basis:0}).price(100));
 A.throws(()=>E.evaluate(ls,{now:NOW,mode:'target',horizon:'2026-12-01',iv:30,rate:6,dividend:0,basis:0}),/first expiry/);
});
test('expired paper contract cannot be shown as active',()=>A.throws(()=>E.evaluate([L('PE','LONG',100,5,{expiry:'2026-10-01'})],{now:NOW}),/expired/));
test('Black Scholes European call and put reference',()=>{
 near(E.bs('CE',100,100,1,.2,.05,0),10.450584,1e-4);near(E.bs('PE',100,100,1,.2,.05,0),5.573526,1e-4);
});
test('payoff plot finite for high/low sample and does not imply maximum',()=>{
 const v=E.evaluate([L('CE','SHORT',100,5)],{now:NOW}),pts=E.plot(v,100);A.equal(pts.length,71);A.ok(pts.every(p=>Number.isFinite(p.pnl)));A.equal(E.summary(v,100).maxLoss,Infinity);
});
test('paper store is separate and copied actual book not mutated',()=>{
 const b={legs:[{type:'FUT',expiry:EXP,lots:2,lotSize:150,entry:4927.35,manual:null},{type:'PE',expiry:EXP,strike:4500,lots:1,lotSize:150,entry:38.9}]},before=JSON.stringify(b);
 const draft=E.actualCopy(b);draft[0].entry=1;A.equal(JSON.stringify(b),before);A.equal(draft[0].origin,'actual-copy');
});
test('valid PAPER export schema retained independently',()=>{
 const d=E.paperDoc({version:1,drafts:[{id:'p',name:'trial',status:'draft',legs:[L('PE','LONG',100,5)],fees:23}]});A.equal(d.drafts.length,1);A.equal(d.drafts[0].fees,23);
 A.throws(()=>E.paperDoc({version:2,drafts:[]}),/Invalid PAPER/);
});
