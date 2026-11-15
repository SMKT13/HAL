'use strict';
const test=require('node:test'),A=require('node:assert/strict'),E=require('../app/src/main/assets/engine4.js');
const NOW=Date.parse('2026-10-28T07:00:00Z'),STAMP=new Date(NOW-1000).toISOString(),opts={now:NOW};
const near=(a,b,t=1e-8)=>A.ok(Math.abs(a-b)<=t,`${a} != ${b}`),copy=x=>JSON.parse(JSON.stringify(x));
const F=(x={})=>({id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35,manual:null,instrumentKey:'F',...x});
const P=(x={})=>({id:'p',type:'PE',expiry:'2026-11-24',strike:4500,lots:1,lotSize:150,entry:38.9,manual:null,instrumentKey:'P',...x});
const B=(legs=[F(),P()])=>({...E.emptyBook(),legs});
const Q=(price,x={})=>({price,bid:Math.max(0,price-.5),ask:price+.5,bidQty:5000,askQty:5000,quoteAt:STAMP,tradeAt:STAMP,retrievedAt:STAMP,source:'REST',greeksAt:STAMP,thetaPerDayVerified:true,volume:1000,oi:5000,iv:30,delta:-.3,theta:-.2,...x});
const M=()=>({contracts:[{instrumentKey:'F',type:'FUT',expiry:'2026-12-29',lotSize:150},{instrumentKey:'P',type:'PE',expiry:'2026-11-24',strike:4500,lotSize:150},{instrumentKey:'P2',type:'PE',expiry:'2026-11-24',strike:4400,lotSize:150}],quotes:{F:Q(5000),P:Q(50),P2:Q(30)},spot:Q(4950)});
const HM=()=>{const m=M();m.contracts.push({instrumentKey:'D1',type:'PE',expiry:'2026-12-29',strike:4500,lotSize:150},{instrumentKey:'D2',type:'PE',expiry:'2026-12-29',strike:4800,lotSize:150});m.quotes.D1=Q(100,{bid:99,ask:100});m.quotes.D2=Q(200,{bid:199,ask:200,delta:-.5});return m;};
const HP={budget:100000,maxLoss:1000000,protectThrough:'2026-12-29',buyFees:10,exitFees:20,slippage:.5,maxSpread:10};
const bars=(n=240)=>Array.from({length:n},(_,i)=>{const c=4000+i*2+Math.sin(i/5)*8;return [new Date(NOW-(n-i)*E.DAY).toISOString(),c-2,c+10,c-10,c,1000+i,500];});

test('fresh book contains no automatic holdings',()=>{const b=E.emptyBook(),v=E.ledger(b,{},opts);A.equal(b.legs.length,0);A.equal(v.complete,true);A.equal(v.net,0);});
test('explicit historical fixture multi-contract quantity accounting',()=>{const l=E.ledger(B([F(),P(),P({id:'p2',strike:4400,entry:24.1,instrumentKey:'P2'})]),M(),opts);near(l.open,(5000-4927.35)*300+(50-38.9)*150+(30-24.1)*150);near(l.openPutPremium,(38.9+24.1)*150);});
test('new futures close must have a strictly positive broker execution price',()=>{
 const before=B(),snapshot=JSON.stringify(before);
 A.throws(()=>E.closeLeg(before,'f',1,0,0,'2026-10-27',{now:NOW,id:'zero-future'}),/Check closed lots/);
 A.equal(JSON.stringify(before),snapshot);
 const zeroPut=E.closeLeg(before,'p',1,0,0,'2026-10-27',{now:NOW,id:'zero-put'});
 A.equal(zeroPut.journal[0].exit,0);
});
test('partial close immutable ledger and charges',()=>{const b=B(),c=E.closeLeg(b,'f',1,5100,100,'2026-10-27',{now:NOW,id:'close1'}),v=E.ledger(c,M(),opts);A.equal(b.legs[0].lots,2);A.equal(c.legs[0].lots,1);A.equal(c.journal[0].leg.lots,1);near(v.realized,(5100-4927.35)*150);near(v.net,v.realized+v.open-100);A.equal(c.riskProfile.confirmedAt,null);});
test('complete close preserved as completed trade',()=>{const b=E.closeLeg(B([F()]),0,2,5100,120,'2026-10-27',opts);A.equal(b.legs.length,0);A.equal(b.journal.length,1);near(E.ledger(b,{},opts).net,(5100-4927.35)*300-120);});
for(const [name,args]of [['overclose',[0,3,5000,0,'2026-10-27']],['future close',[0,1,5000,0,'2026-10-29']],['negative exit',[0,1,-1,0,'2026-10-27']],['fractional lots',[0,1.2,5000,0,'2026-10-27']]])test(name+' rejected',()=>A.throws(()=>E.closeLeg(B(),...args,opts)));
test('duplicate transaction ID rejected',()=>{const b=E.closeLeg(B(),0,1,5000,0,'2026-10-27',{now:NOW,id:'x'});A.throws(()=>E.closeLeg(b,0,1,5000,0,'2026-10-27',{now:NOW,id:'x'}));});
test('funding and settlement separated from net profit',()=>{let b=E.recordCash(B(),'fee',25,'2026-10-27','fee',opts);b=E.recordCash(b,'settlement',5000,'2026-10-27','MTM',opts);b=E.recordCash(b,'funding',20000,'2026-10-27','deposit',opts);const v=E.ledger(b,M(),opts);near(v.net,v.open-25);A.equal(v.settlements,5000);A.equal(v.fundingMovements,20000);});
test('zero manual premium is numeric zero and labelled manual',()=>{const l=E.ledger(B([P({manual:0,manualAt:STAMP})]),M(),opts);near(l.open,-38.9*150);A.equal(l.rows[0].mark.source,'Manual');A.equal(l.manual,true);});
test('manual valuation unknown provider quantity disclosed',()=>{const r=E.resolveMark(P({manual:0}),{},opts);A.equal(r.price,0);A.match(r.warnings.join(' '),/saved quantity/);});
test('manual mark cannot bypass verified lot mismatch',()=>{const m=M();m.contracts[1].lotSize=125;A.equal(E.resolveMark(P({manual:0}),m,opts).price,null);});
test('future manual clock rejected',()=>A.equal(E.resolveMark(P({manual:0,manualAt:new Date(NOW+10000).toISOString()}),M(),opts).price,null));
test('missing one mark blocks complete basket and net P&L',()=>{const m=M();delete m.quotes.P;const v=E.ledger(B(),m,opts);A.equal(v.open,null);A.equal(v.net,null);A.equal(v.complete,false);A.deepEqual(v.unavailableLegs,['p']);A.ok(v.rows[0].pnl>0);});
for(const [name,patch]of [['strike',{strike:4550}],['expiry',{expiry:'2026-12-29'}],['key',{instrumentKey:'wrong'}]])test('exact contract '+name+' required',()=>A.equal(E.resolveMark(P(patch),M(),opts).price,null));
test('ambiguous contract does not choose first',()=>{const m=M();m.contracts.push({...m.contracts[1],instrumentKey:'other'});A.equal(E.resolveMark(P({instrumentKey:null}),m,opts).price,null);});
test('schema 2 migration retains realised history, notes and retired settings',()=>{const b=B();b.version=2;b.legs=b.legs.map(({id,instrumentKey,...l})=>l);b.journal=[{id:'old',kind:'close',date:'2026-10-20',leg:P({expiry:'2026-10-27'}),exit:0,fees:20,note:'completed'}];b.legacy={realized:-1000,costs:50,journal:[{id:'legacy',kind:'close',date:'2026-10-01',amount:-1000,note:'actual'}]};b.rollover={from:'2026-10-27'};b.notes=[{id:'n',date:'2026-10-20',title:'note',text:'personal',url:''}];const v=E.validateBook(b);A.equal(v.version,4);A.equal(v.journal[0].leg.expiry,'2026-10-27');A.deepEqual(v.legacy,b.legacy);A.deepEqual(v.legacyRolloverPreferences,b.rollover);A.equal(v.notes[0].text,'personal');near(E.ledger(v,{},opts).realized,-1000-38.9*150);});
test('backup corruption and unknown version rejected',()=>{A.throws(()=>E.validateBook({...B(),version:999}));A.throws(()=>E.validateBook(B([F({lots:0})])));A.throws(()=>E.validateBook({...B(),journal:[{id:'x',kind:'fee',date:'bad',amount:1}]}));});
test('top-level credentials excluded from ordinary backup',()=>{const b={...B(),token:'private',geminiKey:'secret'},v=E.validateBook(b);A.equal(v.token,undefined);A.equal(v.geminiKey,undefined);});
test('CSV escapes text and neutralizes formula injection',()=>{const b=B();b.journal=[{id:'a',kind:'fee',date:'2026-10-20',amount:3,note:'=HYPERLINK("danger")\nline'}];const csv=E.journalCSV(b);A.ok(csv.includes("'=HYPERLINK"));A.ok(csv.includes('""danger""'));});

test('recent HTTP retrieval is not provider time',()=>A.equal(E.quoteQuality(Q(1,{quoteAt:null}),opts).valid,false));
test('provider future clock rejected',()=>A.equal(E.quoteQuality(Q(1,{quoteAt:new Date(NOW+10000).toISOString()}),opts).valid,false));
test('stale REST retained labelled for indicative P&L but not hedge eligibility',()=>{const m=M();m.quotes.P.quoteAt=new Date(NOW-600000).toISOString();const r=E.resolveMark(P(),m,opts);A.equal(r.price,50);A.equal(r.status,'stale');A.equal(E.quoteQuality(m.quotes.P,{...opts,requireFresh:true}).valid,false);});
test('old exchange trade distinguished from recent response',()=>{const q=Q(10,{tradeAt:new Date(NOW-600000).toISOString()}),r=E.quoteQuality(q,{...opts,requireTrade:true});A.equal(r.valid,false);A.equal(r.quoteAge,1000);A.equal(r.tradeAge,600000);});
test('missing exchange time permits flagged indicative quote only',()=>{const q=Q(10,{tradeAt:null});A.equal(E.quoteQuality(q,opts).valid,true);A.equal(E.quoteQuality(q,{...opts,requireTrade:true}).valid,false);});
test('failed refresh retains old cache and both result clocks',()=>{const p=E.cacheRefresh(null,{ok:true,data:M()},NOW-5000),r=E.cacheRefresh(p,{ok:false,error:'permission denied'},NOW);A.equal(r.lastSuccess,new Date(NOW-5000).toISOString());A.equal(r.lastFailure,new Date(NOW).toISOString());A.equal(r.source,'CACHE');A.equal(r.failure,'permission denied');A.deepEqual(r.data,p.data);A.equal(E.cacheRefresh(null,{ok:false},NOW).data,null);});
test('stream observations never become portfolio marks',()=>{const m=M();m.quotes.P.source='STREAM';A.equal(E.resolveMark(P(),m,opts).price,null);});
for(const [label,t]of [['duplicate',NOW-1000],['out-of-order',NOW-2000],['future',NOW+10000],['old',NOW-600000]])test('reject '+label+' streaming frame',()=>{const a=E.streamFrame({},{instrumentKey:'P',feedAt:NOW-1000,tradeAt:NOW-2000,price:50},opts);A.equal(a.accepted,true);A.equal(E.streamFrame(a.state,{instrumentKey:'P',feedAt:t,price:99},opts).accepted,false);A.equal(a.state.P.price,50);});
test('regressed stream trade timestamp rejected',()=>{const a=E.streamFrame({},{instrumentKey:'P',feedAt:NOW-1000,tradeAt:NOW-2000,price:50},opts);A.equal(E.streamFrame(a.state,{instrumentKey:'P',feedAt:NOW,tradeAt:NOW-3000,price:51},opts).accepted,false);});
test('native schema aliases and nested option quote joined accurately',()=>{const raw={fetched_at_iso:STAMP,spot:{last_price:4950,quote_as_of:STAMP,last_trade_at:STAMP,prev_close:4900},futures:[{instrument_key:'F',expiry:'2026-12-29',lot_size:150,quote:{last_price:5000,quote_as_of:STAMP,last_trade_at:STAMP,retrieved_at:STAMP,bid_quantity:900,ask_quantity:800}}],option_expiry:'2026-11-24',option_rows:[{strike:4500,put:{instrument_key:'P',lot_size:150,iv:30,delta:-.3,theta:-.2,quote:{last_price:50,bid:49,ask:51,quote_as_of:STAMP,last_trade_at:STAMP}}}]};const m=E.normalizeMarket(raw);A.equal(m.spot.previousClose,4900);A.equal(m.quotes.F.bidQty,900);A.equal(m.quotes.F.askQty,800);A.equal(m.quotes.F.retrievedAt,STAMP);A.equal(E.ledger(B(),raw,opts).complete,true);});

test('risk exposure quantities, coverage and later expiry gap',()=>{const r=E.risk(B(),M(),NOW);A.equal(r.futureUnits,300);A.equal(r.putUnits,150);A.equal(r.coverage,50);A.equal(r.uncoveredUnits,150);A.equal(r.timeline[0].uncoveredUnits,300);A.ok(r.warnings.some(w=>w.code==='expiry_gap'));});
test('net Greeks scaled by underlying contract units',()=>{const r=E.risk(B(),M(),NOW);A.equal(r.greeksComplete,true);near(r.delta,255);near(r.theta,-30);});
for(const [label,x]of [['missing delta',{delta:null}],['wrong put delta',{delta:.2}],['zero IV',{iv:0}],['excessive IV',{iv:501}],['missing theta',{theta:null}]])test('aggregate Greeks unavailable for '+label,()=>{const m=M();Object.assign(m.quotes.P,x);const r=E.risk(B(),m,NOW);A.equal(r.delta,null);A.equal(r.theta,null);});
test('expired leg retained but excluded from active coverage',()=>{const b=B([F(),P({expiry:'2026-10-27'})]),r=E.risk(b,M(),NOW);A.equal(b.legs.length,2);A.equal(r.putUnits,0);A.ok(r.warnings.some(w=>w.code==='expired'));});
test('100 percent November quantity still has December protection gap',()=>{const r=E.risk(B([F(),P({lots:2})]),M(),NOW);A.equal(r.coverage,100);A.ok(r.warnings.some(w=>w.code==='expiry_gap'));});
test('lot mismatch invalidates Greeks and valuation',()=>{const m=M();m.contracts[0].lotSize=125;const r=E.risk(B(),m,NOW);A.equal(r.delta,null);A.ok(r.warnings.some(w=>w.code==='contract_mismatch'));A.equal(E.ledger(B(),m,opts).complete,false);});
test('overhedging and multiple strikes disclosed separately',()=>{const r=E.risk(B([F({lots:1}),P(),P({id:'p2',strike:4400,instrumentKey:'P2'})]),M(),NOW);A.equal(r.coverage,200);A.ok(r.warnings.some(w=>w.code==='overhedged'));A.ok(r.warnings.some(w=>w.code==='strike_distribution'));});

test('Black Scholes known reference and zero volatility',()=>{near(E.putPrice(100,100,1,.2,.05,0),5.573526,1e-4);near(E.putPrice(80,100,1,0,.05,0),100*Math.exp(-.05)-80);A.equal(E.putPrice(90,100,0,.2),10);near(E.putPrice(0,100,1,.2,.05),100*Math.exp(-.05));});
for(const [label,args]of [['negative spot',[-1,100,1,.2]],['zero strike',[100,0,1,.2]],['negative time',[100,100,-1,.2]],['negative IV',[100,100,1,-.2]]])test('BS rejects '+label,()=>A.throws(()=>E.putPrice(...args)));
test('mixed expiry later horizon does not fabricate past settlement',()=>{const r=E.scenario(B(),M(),{spot:4000,horizon:'2026-12-29',fallbackIV:30},NOW);A.equal(r.complete,false);A.equal(r.total,null);A.match(r.errors.join(' '),/earlier settlement/);});
test('first expiry horizon combines exact put and model futures',()=>{const r=E.scenario(B(),M(),{spot:4200,horizon:'2026-11-24'},NOW);A.equal(r.complete,true);A.equal(r.rows[1].modelPrice,300);A.equal(r.rows[1].iv,null);A.equal(r.rows[0].modelPrice,4250);A.equal(r.kind,'model estimate');});
test('common expiry payoff exact without IV or current marks',()=>{const legs=[F({expiry:'2026-11-24'}),P()],r=E.scenario(legs,{}, {spot:4200,horizon:'2026-11-24'},NOW);A.equal(r.complete,true);A.equal(r.kind,'exact expiry payoff');near(r.total,E.payoff(legs,4200));});
test('direct mixed-expiry payoff rejected',()=>A.throws(()=>E.payoff(B().legs,4200)));
test('missing or stale IV requires explicit user assumption',()=>{for(const patch of [{iv:null},{quoteAt:new Date(NOW-600000).toISOString()}]){const m=M();Object.assign(m.quotes.P,patch);A.equal(E.scenario(B(),m,{spot:4800,days:1},NOW).complete,false);A.equal(E.scenario(B(),m,{spot:4800,days:1,fallbackIV:30},NOW).complete,true);}});
test('futures constant, decaying and theoretical carry basis',()=>{const b=B([F()]),m=M(),params={spot:4800,days:5},a=E.scenario(b,m,params,NOW),d=E.scenario(b,m,{...params,basis:'decay'},NOW),c=E.scenario(b,m,{...params,basis:'carry'},NOW);A.equal(a.rows[0].modelPrice,4850);A.ok(d.rows[0].modelPrice<4850);A.ok(c.rows[0].modelPrice>4800);});
test('hedges rank actual listed alternatives and do not mutate book',()=>{const b=B(),before=copy(b),r=E.findHedges(b,HM(),HP,NOW);A.deepEqual(b,before);A.equal(r.errors.length,0);A.equal(r.candidates.length,2);A.equal(r.rankings.lowerCost.contract.instrumentKey,'D1');A.equal(r.rankings.strongerProtection.contract.instrumentKey,'D2');A.ok(r.candidates.every(c=>c.units===300&&c.lots===2));});
test('sale proceeds reduce cash requirement, old sale slippage counted as loss',()=>{const r=E.findHedges(B(),HM(),HP,NOW),c=r.rankings.lowerCost;near(c.saleProceeds,49.5*.995*150);near(c.netCashRequired,c.grossCost+20-c.saleProceeds);near(c.existingExitSlippage,49.5*.005*150);A.ok(c.scenarios.every(s=>Number.isFinite(s.additionalPnl)));});
test('current hedge earlier expiry explains unavailable later comparison',()=>{const r=E.findHedges(B(),HM(),HP,NOW);A.ok(r.current.length);A.ok(r.currentErrors.some(e=>/expiry/.test(e.reason)));});
for(const [label,mutate]of [['lot size',m=>m.contracts.find(c=>c.instrumentKey==='D1').lotSize=125],['depth',m=>m.quotes.D1.askQty=null],['timestamp',m=>m.quotes.D1.quoteAt=null],['IV',m=>m.quotes.D1.iv=null],['trade time',m=>m.quotes.D1.tradeAt=new Date(NOW-900000).toISOString()],['OI',m=>m.quotes.D1.oi=null],['volume',m=>m.quotes.D1.volume=0]])test('hedge excludes bad '+label,()=>{const m=HM();mutate(m);const r=E.findHedges(B(),m,HP,NOW);A.ok(r.excluded.some(e=>e.contract.instrumentKey==='D1'));A.equal(r.candidates.some(c=>c.contract.instrumentKey==='D1'),false);});
test('hedge budget applies before any sale proceeds',()=>{const r=E.findHedges(B(),HM(),{...HP,budget:25000},NOW);A.equal(r.candidates.length,0);A.ok(r.excluded.some(e=>e.reasons.includes('Gross new-hedge cost exceeds budget')));});
test('sampled loss constraint can produce honest no-match result',()=>{const r=E.findHedges(B(),HM(),{...HP,maxLoss:0},NOW);A.equal(r.candidates.length,0);A.ok(r.errors.length);A.ok(r.assumptions.some(s=>s.includes('not a guaranteed maximum')));});
test('existing-put missing bid prevents fabricated sale proceeds',()=>{const m=HM();m.quotes.P.bid=null;const r=E.findHedges(B(),m,HP,NOW);A.equal(r.candidates.length,0);A.match(r.errors[0],/sale price/);});

test('invalid OHLC removed and conflicting duplicate bar excluded',()=>{const b=bars(3),bad=[...b[0]];bad[2]=1;A.equal(E.candles([...b,bad]).length,3);const conflict=[...b[0]];conflict[4]+=1;A.equal(E.candles([...b,conflict]).length,2);});
test('unfinished daily, hourly and 15 minute bars excluded',()=>{const p=E.candles([['2026-10-28T03:45:00Z',100,110,90,100,10],['2026-10-28T06:50:00Z',100,110,90,101,10]]);A.equal(E.completed(p,'D',NOW).length,0);A.equal(E.completed(p,'15m',NOW).length,1);A.equal(E.completed(p,'1h',NOW).length,1);A.equal(E.completed(p,'D',Date.parse('2026-10-28T10:00:00Z')).length,2);});
test('full technical suite available with sufficient completed history',()=>{const r=E.technicals(bars(),'D',NOW,STAMP);A.equal(r.ready,true);A.equal(r.stale,false);for(const k of ['sma20','sma50','sma200','ema12','ema26','rsi','macd','signal','hist','atr','mfi','bbLow','bbMid','bbHigh','vol','pivot','s1','s2','r1','r2','support','resistance','volumeRatio'])A.ok(Number.isFinite(r[k]),k);A.equal(r.series.sma200.filter(Number.isFinite).length,41);});
test('indicator numerical reference monotonic and flat RSI, seeded EMA',()=>{A.equal(E.rsi(Array(20).fill(100)).at(-1),50);A.equal(E.rsi(Array.from({length:20},(_,i)=>100+i)).at(-1),100);A.equal(E.rsi(Array.from({length:20},(_,i)=>100-i)).at(-1),0);A.deepEqual(E.sma([1,2,3,4],3),[null,null,2,3]);A.deepEqual(E.ema([1,2,3,4],3),[null,null,2,3]);});
test('short or stale history never gives directional conclusion',()=>{A.equal(E.technicals(bars(20),'D',NOW,STAMP).bias,'Insufficient history');A.equal(E.technicals(bars(),'D',NOW,null).bias,'Data needs refresh');A.equal(E.technicals(bars(),'D',NOW,new Date(NOW+10000).toISOString()).bias,'Data needs refresh');});
test('intraday HV avoids invented annualization',()=>{const r=E.technicals(bars(),'15m',NOW,STAMP);A.equal(r.vol,null);A.ok(Number.isFinite(r.historicalVolatility.perBar));});
test('pattern samples exclude target and overlapping outcomes',()=>{const r=E.patterns(bars(),{now:NOW,window:10,forward:5,limit:12});A.ok(r.sampleCount>0);for(const m of r.matches)A.ok(m.outcomeEnd<230);for(let i=0;i<r.matches.length;i++)for(let j=i+1;j<r.matches.length;j++){const a=r.matches[i],b=r.matches[j];A.ok(a.outcomeEnd<b.start||b.outcomeEnd<a.start);}A.match(r.warning,/not a forecast/);A.ok(Number.isFinite(r.summary.mean));});
test('insufficient pattern history honest unavailable result',()=>{const r=E.patterns(bars(20),{now:NOW});A.equal(r.sampleCount,0);A.equal(r.summary,null);A.ok(r.reason);});
test('carry uses listed expiries and never fills missing mark',()=>{const m=M();m.contracts.push({instrumentKey:'F2',type:'FUT',expiry:'2027-01-26',lotSize:150});m.quotes.F2=Q(5050);const r=E.carryComparison(m,NOW);A.equal(r[0].spread,50);A.equal(r[0].days,28);delete m.quotes.F2;A.equal(E.carryComparison(m,NOW)[0].spread,null);});


test('replacement aggregates displayed sale depth across same-contract saved puts',()=>{const m=HM();m.quotes.P.bidQty=150;const b=B([F(),P(),P({id:'p-split'})]);const result=E.findHedges(b,m,HP,NOW);A.equal(result.candidates.length,0);A.match(result.errors.join(' '),/combined displayed bid quantity/);});
test('combined sale depth sufficient preserves whole-position proceeds',()=>{const m=HM();m.quotes.P.bidQty=300;const result=E.findHedges(B([F(),P(),P({id:'p-split'})]),m,HP,NOW);A.equal(result.errors.length,0);near(result.rankings.lowerCost.saleProceeds,49.5*.995*300);});
for(const [label,stamp]of [['missing',null],['stale',new Date(NOW-120001).toISOString()],['future',new Date(NOW+10000).toISOString()]])test('scenario rejects '+label+' separate provider IV clock but allows explicit offline assumption',()=>{const m=M();m.quotes.P.greeksAt=stamp;A.equal(E.scenario(B(),m,{spot:4800,days:1},NOW).complete,false);A.equal(E.scenario(B(),m,{spot:4800,days:1,fallbackIV:30},NOW).complete,true);});
test('exact expiry payoff ignores irrelevant invalid current spot clock',()=>{const legs=[F({expiry:P().expiry}),P()],m=M();m.spot.quoteAt=null;const r=E.scenario(legs,m,{spot:4200,horizon:P().expiry},NOW);A.equal(r.complete,true);near(r.total,E.payoff(legs,4200));});
test('theoretical carry works without an unused current base spot',()=>{const r=E.scenario([F()],{}, {spot:4800,days:5,basis:'carry'},NOW);A.equal(r.complete,true);A.ok(r.rows[0].modelPrice>4800);});
test('old intraday bars cannot give fresh directional conclusions after retrieval',()=>{for(const [frame,duration,maxAge]of [['15m',900000,30*60000],['1h',3600000,2*3600000]]){const recent=Array.from({length:60},(_,i)=>[new Date(NOW-(60-i)*duration).toISOString(),100+i,102+i,99+i,101+i,1000]);A.equal(E.technicals(recent,frame,NOW,STAMP).stale,false);const old=recent.map(x=>[new Date(Date.parse(x[0])-maxAge).toISOString(),...x.slice(1)]);const r=E.technicals(old,frame,NOW,STAMP);A.equal(r.stale,true);A.equal(r.bias,'Data needs refresh');}});
test('malformed candle entries do not crash technicals or historical scanning',()=>{const input=[null,undefined,false,2,'bad',...bars()];A.equal(E.candles(input).length,240);A.equal(E.technicals(input,'D',NOW,STAMP).completedCount,240);A.ok(E.patterns(input,{now:NOW}).sampleCount>0);});

test('daily completion never accepts a later source timestamp on the same date',()=>{const afterClose=Date.parse('2026-10-28T11:00:00Z'),input=E.candles([['2026-10-28T03:45:00Z',100,110,90,100,10],['2026-10-28T12:00:00Z',100,110,90,101,10]]);A.equal(E.completed(input,'D',afterClose).length,1);});

test('hedge model permits explicit IV when provider Greek timestamps are unavailable',()=>{
 const m=HM();for(const key of ['P','P2','D1','D2'])m.quotes[key].greeksAt=null;
 const denied=E.findHedges(B(),m,HP,NOW);A.equal(denied.candidates.length,0);
 A.ok(denied.excluded.some(c=>c.reasons.some(r=>r.includes('explicit IV assumption'))));
 const allowed=E.findHedges(B(),m,{...HP,fallbackIV:28},NOW);
 A.equal(allowed.errors.length,0);A.equal(allowed.candidates.length,2);
 A.ok(allowed.candidates.every(c=>c.ivSource==='user-assumed'&&c.ivAssumption===28));
 A.ok(allowed.assumptions.some(x=>x.includes('user-assumed')));
 const stale=HM();for(const key of ['P','P2','D1','D2'])stale.quotes[key].greeksAt=null;
 stale.quotes.D1.tradeAt=new Date(NOW-600000).toISOString();
 A.equal(E.findHedges(B(),stale,{...HP,fallbackIV:28},NOW).candidates.some(c=>c.contract.instrumentKey==='D1'),false);
});

test('NSE single-stock derivative expiry session is date-effective, not cash close',()=>{
 const at=d=>E.expiryTime(d);
 A.equal(at('2026-07-28'),Date.parse('2026-07-28T15:30:00+05:30'));
 A.equal(at('2026-11-23'),Date.parse('2026-11-23T15:40:00+05:30'));
 A.equal(at('2026-12-29'),Date.parse('2026-12-29T15:45:00+05:30'));
 for(const [date,minute] of [['2026-11-23','15:35'],['2026-12-29','15:42']]){
  const start=Date.parse(date+'T'+minute+':00+05:30'),b=B([F({expiry:date})]);
  A.equal(E.risk(b,{},start).futureUnits,300);
  A.equal(E.scenario(b,{}, {spot:4900,horizon:start,basis:'carry'},start).complete,true);
  A.equal(E.risk(b,{},at(date)+1000).futureUnits,0);
 }
});
test('provider zero futures and put prices fail closed, while manual zero put remains valid',()=>{
 const m=M();m.quotes.F=Q(0);m.quotes.P=Q(0);
 A.equal(E.quoteQuality(m.quotes.F,{now:NOW,requireFresh:true,requireTrade:true}).valid,false);
 A.equal(E.quoteQuality(m.quotes.P,{now:NOW,requireFresh:true,requireTrade:true}).valid,false);
 A.equal(E.ledger(B(),m,opts).complete,false);
 A.equal(E.ledger(B([P({manual:0,manualAt:STAMP})]),m,opts).open,-38.9*150);
});
test('cached or stale HAL spot does not trigger directional price review warnings',()=>{
 const b=B();b.riskProfile.reviewBelow=4500;b.riskProfile.reviewAbove=5400;
 const m=M();m.spot=Q(4300,{source:'CACHE',quoteAt:new Date(NOW-86400000).toISOString()});
 A.equal(E.risk(b,m,NOW).warnings.some(w=>w.code==='lower_review'),false);
 m.spot=Q(4300,{source:'REST'});
 A.equal(E.risk(b,m,NOW).warnings.some(w=>w.code==='lower_review'),true);
 m.spot=Q(5500,{quoteAt:new Date(NOW-86400000).toISOString()});
 A.equal(E.risk(b,m,NOW).warnings.some(w=>w.code==='upper_review'),false);
});
test('stale marked loss never fires a live maximum-loss warning',()=>{
 const b=B();b.riskProfile.maxLoss=100;
 const m=M();m.quotes.F=Q(4500,{source:'CACHE',quoteAt:new Date(NOW-86400000).toISOString()});
 A.equal(E.risk(b,m,NOW).warnings.some(w=>w.code==='loss_limit'),false);
 m.quotes.F=Q(4500);
 A.equal(E.risk(b,m,NOW).warnings.some(w=>w.code==='loss_limit'),true);
});

test('expired unreconciled puts never contribute historical last quotes to live open or net P&L',()=>{
 const expired=P({expiry:'2026-10-27'}),b=B([F(),expired]),m=M();
 m.contracts.push({instrumentKey:'P',type:'PE',expiry:'2026-10-27',strike:4500,lotSize:150});
 const v=E.ledger(b,m,opts),row=v.rows.find(x=>x.leg.id==='p');
 A.equal(row.mark.price,null);A.equal(row.mark.status,'expired_unreconciled');A.match(row.mark.warnings.join(' '),/settlement/);
 A.equal(row.pnl,null);A.equal(v.open,null);A.equal(v.net,null);A.equal(v.complete,false);
 A.equal(E.risk(b,m,NOW).putUnits,0);
 const saved=E.closeLeg(b,'p',1,15,2,'2026-10-28',{now:NOW});
 const after=E.ledger(saved,m,opts);
 A.equal(after.complete,true);near(after.realized,(15-38.9)*150);near(after.charges,2);
});
test('expired open legs cannot be valued through manual marks, even manually entered zero',()=>{
 const b=B([P({expiry:'2026-10-27',manual:0,manualAt:STAMP})]);
 const value=E.ledger(b,M(),opts);
 A.equal(value.open,null);A.equal(value.complete,false);A.equal(value.rows[0].mark.status,'expired_unreconciled');
});
test('legacy manual zero futures marks stay recoverable but cannot manufacture huge losses',()=>{
 const b=B([F({manual:0,manualAt:STAMP})]),validated=E.validateBook(b),v=E.ledger(validated,M(),opts);
 A.equal(validated.legs[0].manual,0);
 A.equal(v.open,null);A.equal(v.net,null);A.equal(v.complete,false);
 A.match(v.rows[0].mark.warnings.join(' '),/Manual futures mark must be positive/);
 const corrected=B([F({manual:5000,manualAt:STAMP})]);near(E.ledger(corrected,M(),opts).open,(5000-4927.35)*300);
 const cleared=B([F({manual:null})]);near(E.ledger(cleared,M(),opts).open,(5000-4927.35)*300);
});

test('strict risk and hedge screening reject quotes without an HTTP retrieval clock',()=>{
 const source=Q(4900,{retrievedAt:null});
 A.equal(E.quoteQuality(source,{now:NOW}).valid,true);
 const strict=E.quoteQuality(source,{now:NOW,requireFresh:true,requireTrade:true});
 A.equal(strict.valid,false);A.match(strict.reasons.join('; '),/retrieval timestamp/);
 const m=HM();m.spot={...m.spot,retrievedAt:null};
 A.equal(E.findHedges(B(),m,{...HP,fallbackIV:25},NOW).candidates.length,0);
});
test('strict risk and hedge checks reject a fabricated source or an old retrieval',()=>{
 for(const patch of [{source:'unverified-feed'},{retrievedAt:new Date(NOW-600000).toISOString()}]){
  const q=Q(4900,patch),r=E.quoteQuality(q,{now:NOW,requireFresh:true,requireTrade:true});
  A.equal(r.valid,false,r.reasons.join('; '));
 }
 const q=Q(4900,{retrievedAt:new Date(NOW-500).toISOString()});
 A.equal(E.quoteQuality(q,{now:NOW,requireFresh:true,requireTrade:true}).valid,true);
 const m=M();m.spot={...m.spot,source:'unverified-feed'};const b=B();
 b.riskProfile.reviewBelow=5000;
 A.equal(E.risk(b,m,NOW).warnings.some(w=>w.code==='lower_review'),false);
});
test('strict quote source accepts explicit provider REST v3 provenance',()=>{
 A.equal(E.quoteQuality(Q(4900,{source:'upstox_rest_v3'}),{now:NOW,requireFresh:true,requireTrade:true}).valid,true);
});
