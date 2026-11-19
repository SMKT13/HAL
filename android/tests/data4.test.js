'use strict';
const test=require('node:test'),A=require('node:assert/strict'),E=require('../app/src/main/assets/engine4.js'),D=require('../app/src/main/assets/data4.js');
const now=Date.parse('2026-11-01T06:30:00Z'),ts=new Date(now).toISOString(),old=new Date(now-10000).toISOString(),q=(n,t=ts)=>({last_price:n,quote_as_of:t,last_trade_at:t,retrieved_at:t}),snap=(n=5000,t=ts)=>({spot:q(4950,t),futures:[{instrument_key:'SYNTH_F',expiry:'2026-12-29',lot_size:150,quote:q(n,t)}],fetched_at_iso:t}),leg={type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4900,instrumentKey:'SYNTH_F'};
const mem=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)}};
test('partial snapshot without spot retains actual futures',()=>{const x=D.ingest(D.empty(),'snapshot',{...snap(),spot:null},ts),m=D.market(x);A.equal(m.spot.price,null);A.equal(m.quotes.SYNTH_F.price,5000)});
test('invalid snapshot preserves previous observation and failure',()=>{let s=D.ingest(D.empty(),'snapshot',snap(),old);s=D.ingest(s,'snapshot',{spot:4},ts);A.equal(D.market(s).quotes.SYNTH_F.price,5000);A.equal(s.lastFailure,ts);A.equal(s.failure,'bad_response')});
test('cached snapshot disguised as live refresh is refused without rewriting positions or prices',()=>{
 let s=D.ingest(D.empty(),'snapshot',snap(),ts);
 const suspect={...snap(9000,old),_cache:true};
 s=D.ingest(s,'snapshot',suspect,ts);
 A.equal(s.failure,'bad_response');
 A.equal(D.market(s).quotes.SYNTH_F.price,5000);
});
test('cached research cannot promote itself into a live provider result',()=>{
 let s=D.ingest(D.empty(),'snapshot',snap(),ts);
 s=D.ingest(s,'research',{section:'contracts',frame:'D',_cache:true,
  data:{contracts:[{...leg,instrument_key:'SYNTH_F',lot_size:150,verified:true,quote:q(9900,ts)}]}},ts);
 A.equal(s.health['contracts:D'].error,'bad_response');
 A.equal(D.market(s).quotes.SYNTH_F.price,5000);
});
test('research error keys match native section frame type',()=>{const s=D.ingest(D.empty(),'research_error',{key:'contracts:D:consolidated',code:'upstox_permission_denied'},ts);A.equal(s.health['contracts:D'].error,'upstox_permission_denied')});
test('failed refresh retained but later success clears failure status',()=>{let s=D.ingest(D.empty(),'snapshot',snap(),old);s=D.ingest(s,'error',{code:'network_unavailable'},old);s=D.ingest(s,'snapshot',snap(),ts);A.equal(E.quoteQuality(D.market(s).spot,{now}).status,'current')});
test('older held quote cannot replace newer REST quote',()=>{let s=D.ingest(D.empty(),'snapshot',snap(),ts);s=D.ingest(s,'research',{section:'contracts',frame:'D',fetched_at_iso:old,data:{contracts:[{...leg,instrument_key:'SYNTH_F',lot_size:150,verified:true,quote:q(4000,old)}]}},ts);A.equal(D.market(s).quotes.SYNTH_F.price,5000)});
test('restored cached packets remain cached after a new main refresh',()=>{let s=D.ingest(D.empty(),'research',{section:'hedges',frame:'2026-11-23',data:{option_expiry:'2026-11-23',option_rows:[{strike:4500,put:{instrument_key:'SYNTH_P',lot_size:150,quote:q(20)}}]}},ts);s=D.restoreCache(D.cache(s));s=D.ingest(s,'snapshot',snap(),ts);A.equal(D.market(s).quotes.SYNTH_P.source,'CACHE');A.equal(D.market(s).spot.source,'REST')});
test('stream never changes REST valuation observations',()=>{let s=D.ingest(D.empty(),'snapshot',snap(),ts);s=D.ingest(s,'stream',{rows:[{key:'SYNTH_F',price:9000}]},ts);A.equal(D.market(s).quotes.SYNTH_F.price,5000)});
test('Upstox news keyed articles retain publication time and source link',()=>{const s=D.ingest(D.empty(),'research',{section:'news',frame:'D',fetched_at_iso:ts,data:{articles:{articles:{'SYNTH_EQ':[{heading:'HAL contract',article_link:'https://example.com/hal',published_time:now,summary:'Provider text'}]}}}},ts);const n=D.news(s)[0];A.equal(n.title,'HAL contract');A.equal(n.publishedAt,ts);A.equal(n.url,'https://example.com/hal')});
test('legacy storage remains intact after validated migration',()=>{const storage=mem(),b={...E.emptyBook(),version:2,legs:[leg]};storage.setItem('hal_desk_v2',JSON.stringify(b));const v=D.loadBook(null,storage);A.equal(v.book.version,4);A.equal(v.book.legs.length,1);A.equal(v.migrated,true);A.equal(storage.getItem('hal_desk_v2'),JSON.stringify(b))});
test('conflicted native save never returns success',()=>A.throws(()=>D.saveBook({saveBook:()=>JSON.stringify({ok:false,message:'revision conflict'})},mem(),E.emptyBook(),3),/conflict/));
test('corrupt native store cannot fall back to an empty book',()=>A.throws(()=>D.loadBook({loadBook:()=>JSON.stringify({ok:false,message:'checksum invalid'})},mem()),/checksum/));
test('backup invalid schema rejected and zero manual preserved',()=>{A.throws(()=>D.previewImport({schema:999,book:E.emptyBook()}));const b=D.previewImport({schema:4,book:{...E.emptyBook(),legs:[{...leg,manual:0}]}});A.equal(b.legs[0].manual,0)});
test('put Greeks without source time are withheld despite recent REST price',()=>{const q={delta:-.2,theta:-.3,iv:30};A.equal(E.validGreeks(q,now),false);A.equal(E.validGreeks({...q,greeksAt:ts},now),true);A.equal(E.validGreeks({...q,greeksAt:new Date(now+10000).toISOString()},now),false)});
test('failed and cached quote cannot qualify for hedge selection',()=>{const n=E.normQuote(q(10));A.equal(E.quoteQuality({...n,failure:'quota'},{now,requireFresh:true}).valid,false);A.equal(E.quoteQuality({...n,source:'CACHE'},{now,requireFresh:true}).valid,false)});
test('nested credentials removed from every backup subtree',()=>{const b={...E.emptyBook(),migration:{apiKey:'secret',keep:'history'},checkpoints:[{password:'secret',spot:5000}]};const out=D.safeBackup(b);A.equal(out.book.migration.apiKey,undefined);A.equal(out.book.checkpoints[0].password,undefined);A.equal(out.book.migration.keep,'history')});
test('provider lot mismatch still blocks a manual valuation',()=>{let s=D.ingest(D.empty(),'snapshot',snap(),ts);s=D.ingest(s,'research',{section:'contracts',frame:'D',data:{contracts:[{...leg,instrument_key:'SYNTH_F',lot_size:125,lotSize:125,reason:'lot_size_mismatch',verified:false}]}},ts);const mark=E.resolveMark({...leg,manual:5000},D.market(s),{now});A.equal(mark.price,null);A.equal(mark.mismatch,true)});
test('a per-contract refresh rejection prevents silently fresh hedge quotes',()=>{let s=D.ingest(D.empty(),'research',{section:'hedges',frame:'2026-11-23',fetched_at_iso:ts,data:{option_expiry:'2026-11-23',option_rows:[{strike:4500,put:{instrument_key:'SYNTH_P',lot_size:150,quote:q(20)}}]}},ts);s=D.ingest(s,'research_error',{key:'hedges:2026-11-23:consolidated',code:'upstox_rate_limited'},ts);A.equal(E.quoteQuality(D.market(s).quotes.SYNTH_P,{now,requireFresh:true}).valid,false)});
test('partial snapshot errors are never masked by HTTP success',()=>{const s=D.ingest(D.empty(),'snapshot',{...snap(),errors:{quotes:'upstox_permission_denied'}},ts);A.match(s.health.market.error,/cannot access/);A.equal(E.quoteQuality(D.market(s).quotes.SYNTH_F,{now,requireFresh:true}).valid,false)});
test('chain errors propagate to quote eligibility',()=>{const s=D.ingest(D.empty(),'research',{section:'hedges',frame:'2026-11-23',fetched_at_iso:ts,data:{option_expiry:'2026-11-23',chain_error:'upstox_rate_limited',errors:{quotes:'network_unavailable'},option_rows:[{strike:4500,put:{instrument_key:'SYNTH_P',lot_size:150,quote:q(20)}}]}},ts);A.match(s.health['hedges:2026-11-23'].error,/Network/);A.equal(E.quoteQuality(D.market(s).quotes.SYNTH_P,{now,requireFresh:true}).valid,false)});
test('context quote preserves provider and retrieval timestamps',()=>{const s=D.ingest(D.empty(),'research',{section:'context',frame:'D',fetched_at_iso:ts,data:{indices:{'NSE_INDEX|Nifty 50':{...q(25000,old),retrieved_at:ts,symbol:'Nifty 50'}}}},ts);const m=D.market(s);A.equal(m.nifty.price,25000);A.equal(m.nifty.quoteAt,old);A.equal(m.nifty.retrievedAt,ts)});
test('malformed research response preserves previous packet and records failure',()=>{let s=D.ingest(D.empty(),'research',{section:'candles',frame:'D',data:{history:{candles:[]}}},old);s=D.ingest(s,'research',{section:'candles',frame:'D',data:null},ts);A.deepEqual(D.rawCandles(s).raw,[]);A.equal(D.rawCandles(s).error,'bad_response')});
test('malformed candles do not throw and cannot look complete',()=>{const s=D.ingest(D.empty(),'research',{section:'candles',frame:'D',data:{history:{candles:{bad:true}}}},ts);A.deepEqual(D.rawCandles(s).raw,[]);A.equal(D.rawCandles(s).error,'bad_response')});
test('unrepresentable news timestamp is unavailable rather than crashing',()=>{const s=D.ingest(D.empty(),'research',{section:'news',frame:'D',data:{articles:[{heading:'HAL synthetic news',published_time:1e20}]}},ts);A.equal(D.news(s)[0].publishedAt,null)});
test('cached pending status is cleared on restart',()=>{const s=D.restoreCache({health:{market:{pending:ts},invalid:4},research:{},snapshot:null});A.equal(s.health.market.pending,null);A.equal(s.health.invalid,undefined)});

test('backup import requires fresh broker confirmation even for an identical book',()=>{const b=E.emptyBook();b.riskProfile.confirmedAt=ts;b.riskProfile.confirmedBook='prior';const out=D.previewImport({schema:4,book:b});A.equal(out.riskProfile.confirmedAt,null);A.equal(out.riskProfile.confirmedBook,null);A.equal(b.riskProfile.confirmedAt,ts)});

const putLeg=(strike,key=null)=>({id:'p'+strike,type:'PE',expiry:'2026-11-23',strike,lots:1,lotSize:150,entry:30,manual:null,instrumentKey:key});
const putSnapshot=()=>({spot:q(4950),futures:[],fetched_at_iso:ts,option_expiry:'2026-11-23',option_rows:[{strike:4500,put:{instrument_key:'SYNTH_P4500',lot_size:150,quote:q(50)}},{strike:4400,put:{instrument_key:'SYNTH_P4400',lot_size:150,quote:q(35)}}]});
const failedHeld=(reason='instrument_key_mismatch')=>({section:'contracts',frame:'D',fetched_at_iso:ts,data:{contracts:[4500,4400].map(strike=>({type:'PE',expiry:'2026-11-23',strike,requested_lot_size:150,instrument_key:'SYNTH_P'+strike,lot_size:150,verified:false,reason}))}});
test('old null-key verification failure cannot hide either valid listed put',()=>{let s=D.ingest(D.empty(),'snapshot',putSnapshot(),ts);s=D.ingest(s,'research',failedHeld(),ts);const m=D.market(s);A.equal(E.resolveMark(putLeg(4500),m,{now}).price,50);A.equal(E.resolveMark(putLeg(4400),m,{now}).price,35);});
test('cached mismatch recovers with new quotes while a real wrong saved key stays blocked',()=>{let s=D.ingest(D.empty(),'research',failedHeld(),old);s=D.restoreCache(D.cache(s));s=D.ingest(s,'snapshot',putSnapshot(),ts);const m=D.market(s);A.equal(E.resolveMark(putLeg(4500),m,{now}).price,50);A.equal(E.resolveMark(putLeg(4500,'SYNTH_WRONG'),m,{now}).price,null);});
test('a different listed expiry never supplies a saved put price',()=>{const s=D.ingest(D.empty(),'snapshot',putSnapshot(),ts);A.equal(E.resolveMark({...putLeg(4500),expiry:'2026-11-24'},D.market(s),{now}).price,null);});
test('actual not-listed verification is still withheld',()=>{let s=D.ingest(D.empty(),'snapshot',putSnapshot(),ts);s=D.ingest(s,'research',failedHeld('contract_not_listed'),ts);A.equal(E.resolveMark(putLeg(4500),D.market(s),{now}).price,null);});

test('option-chain partial errors cannot poison independently fresh spot/futures prices',()=>{
 const x=D.ingest(D.empty(),'snapshot',{...snap(),chain_error:'expiry_not_listed',errors:{chain:'expiry_not_listed'}},ts);
 const m=D.market(x);A.match(x.health.market.error,/chain/);
 for(const quote of [m.spot,m.quotes.SYNTH_F])A.equal(E.quoteQuality(quote,{now,requireFresh:true,requireTrade:true}).valid,true);
 const failed=D.ingest(x,'error',{code:'network_unavailable'},new Date(now+1000).toISOString());
 A.equal(E.quoteQuality(D.market(failed).spot,{now:now+1000,requireFresh:true,requireTrade:true}).valid,false);
});

test('option quote failure is limited to options and does not taint fresh futures or spot',()=>{
 const s=D.ingest(D.empty(),'snapshot',{...putSnapshot(),futures:snap().futures,errors:{option_quotes:'network_unavailable'}},ts);
 const m=D.market(s);
 A.equal(E.quoteQuality(m.spot,{now,requireFresh:true,requireTrade:true}).valid,true);
 A.equal(E.quoteQuality(m.quotes.SYNTH_F,{now,requireFresh:true,requireTrade:true}).valid,true);
 A.equal(E.quoteQuality(m.quotes.SYNTH_P4500,{now,requireFresh:true,requireTrade:true}).valid,false);
});

test('documented Upstox array of instrument-keyed news retains each genuine article',()=>{
 const article={heading:'HAL delivery update',article_link:'https://example.com/hal-delivery',published_time:now,summary:'Actual report'};
 const arr=[{'NSE_EQ|SYNTH_1':[article]},{'NSE_EQ|SYNTH_2':[{...article,heading:'HAL second source'}]}];
 const s=D.ingest(D.empty(),'research',{section:'news',frame:'D',fetched_at_iso:ts,data:{articles:arr}},ts);
 const news=D.news(s);
 A.equal(news.length,2);
 A.deepEqual(news.map(n=>n.title),['HAL delivery update','HAL second source']);
 A.ok(news.every(n=>n.publishedAt===ts&&n.url==='https://example.com/hal-delivery'));
});
test('news responses with empty nested instrument arrays do not manufacture blank articles',()=>{
 const s=D.ingest(D.empty(),'research',{section:'news',frame:'D',fetched_at_iso:ts,data:{articles:[{'NSE_EQ|SYNTH_1':[]},{metadata:{page:1}}]}},ts);
 A.deepEqual(D.news(s),[]);
});
test('legacy backup history is sanitized during import preview',()=>{
 const history=[{spot:5000,token:'fixture',nested:{apiKey:'fixture',volume:42}}];
 const preview=D.previewImport({book:E.emptyBook(),history});
 A.deepEqual(preview.migration.legacyPriceHistory,[{spot:5000,nested:{volume:42}}]);
});
