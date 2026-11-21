'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const I=require('../app/src/main/assets/insights4.js');
const NOW=Date.parse('2026-10-28T10:00:00Z');
const book=()=>({version:4,legs:[{id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35,manual:0,manualAt:'2026-10-28T09:59:00Z'}],journal:[{id:'j',kind:'close',date:'2026-10-20',note:'PRIVATE MEMO',amount:100}],notes:['PRIVATE NOTE'],password:'SECRET',token:'SECRET',confirmedAt:'2026-10-28T09:00:00Z',funding:{margin:200000,free:50000,at:'2026-10-28T09:00:00Z'}});
const input=()=>({book:book(),valuation:{open:0,realized:100,charges:5,net:95,complete:true,rows:[]},risk:{futureUnits:300,putUnits:150,coverage:50,uncoveredUnits:150,greeksComplete:false,warnings:[]},market:{spot:{price:4900,quoteAt:'2026-10-28T09:59:30Z',tradeAt:'2026-10-28T09:59:29Z',source:'REST'}},technical:{rsi:51},news:[{title:'HAL result',url:'https://example.org/filing',publishedAt:'2026-10-28T08:00:00Z',source:'Synthetic source',official:true}]});
test('research evidence never includes positions even with consent flag',()=>{
 const p=I.evidencePacket(input(),{mode:'research',includePortfolio:true,now:NOW});
 assert.equal(p.portfolioIncluded,false);assert.equal(p.portfolio,undefined);assert.equal(p.bookRevision,undefined);assert.equal(p.funding,undefined);assert.equal(p.valuation,undefined);assert.ok(p.market.spot);
});
test('position sharing requires explicit includePortfolio',()=>{
 const p=I.evidencePacket(input(),{mode:'copilot',now:NOW});assert.equal(p.portfolioIncluded,false);assert.equal(p.portfolio,undefined);
});
test('allowlist removes credentials, private notes and journal memos',()=>{
 const data=input();data.book.legs[0].password='LEG SECRET';data.market.spot.token='MARKET SECRET';data.news[0].memo='NEWS PRIVATE';
 const p=I.evidencePacket(data,{mode:'copilot',includePortfolio:true,now:NOW}),s=JSON.stringify(p);
 assert.ok(p.portfolioIncluded);assert.ok(p.bookRevision);assert.ok(!/SECRET|PRIVATE|password|token|notes/.test(s));assert.equal(p.portfolio.legs[0].manual,0);assert.equal(p.valuation.open,0);
});
test('incomplete basket P&L is omitted before first AI consent preview',()=>{
 const x=input();
 x.valuation={open:-111111,net:-222222,realized:20,charges:5,complete:false,
   rows:[{leg:x.book.legs[0],pnl:-333333,mark:{price:4700}}]};
 const p=I.evidencePacket(x,{mode:'copilot',includePortfolio:true,now:NOW});
 assert.equal(p.valuation.complete,false);
 for(const key of ['open','net','realized','charges'])assert.equal(p.valuation[key],undefined);
 assert.deepEqual(p.valuation.rows,[]);
 const body=JSON.stringify(p);
 for(const forbidden of ['111111','222222','333333'])assert.equal(body.includes(forbidden),false);
});
test('incomplete stress scenario is omitted but diagnostic reason retained',()=>{
 const x=input();
 x.scenarios=[{complete:false,total:-444444,horizon:'2026-11-23',spot:4800,
    rows:[{leg:x.book.legs[0],pnl:-555555}],
    errors:['Required option mark missing']}];
 const p=I.evidencePacket(x,{mode:'deliberate',includePortfolio:true,now:NOW});
 assert.equal(p.scenarios[0].complete,false);
 assert.equal(p.scenarios[0].total,undefined);
 assert.deepEqual(p.scenarios[0].rows,[]);
 assert.deepEqual(p.scenarios[0].errors,['Required option mark missing']);
 assert.equal(JSON.stringify(p).includes('555555'),false);
});
test('complete scenario retains validated deterministic totals',()=>{
 const x=input(); x.scenarios=[{complete:true,total:-2500,spot:4800,rows:[]}];
 const p=I.evidencePacket(x,{mode:'copilot',includePortfolio:true,now:NOW});
 assert.equal(p.scenarios[0].total,-2500);
});
test('invalid numeric evidence stays unavailable',()=>{
 const data=input();data.market.spot.price=Infinity;data.valuation.open=NaN;const p=I.evidencePacket(data,{mode:'copilot',includePortfolio:true,now:NOW});assert.equal(p.market.spot.price,undefined);assert.equal(p.valuation.open,undefined);
});
test('all modes other than documented ones rejected',()=>assert.throws(()=>I.evidencePacket({}, {mode:'trade'}),/Unknown/));
test('material fingerprint is stable and ignores private notes',()=>{const b=book(),key=I.materialFingerprint(b);b.notes=['other'];b.journal[0].note='other';assert.equal(I.materialFingerprint(b),key);b.legs[0].entry++;assert.notEqual(I.materialFingerprint(b),key);});
test('journal accounting changes invalidate answer',()=>{const b=book(),revision=I.materialFingerprint(b),answer={portfolioIncluded:true,bookRevision:revision};assert.ok(I.canUseAnswer(answer,b));b.journal[0].amount++;assert.ok(!I.canUseAnswer(answer,b));});
test('research answer not invalidated by a portfolio change',()=>assert.ok(I.canUseAnswer({portfolioIncluded:false},book())));
test('answer with missing revision cannot validate position conclusions',()=>assert.equal(I.canUseAnswer({portfolioIncluded:true},book()),false));
test('manual mark changes invalidate conclusions including zero',()=>{const b=book(),key=I.materialFingerprint(b);b.legs[0].manual=null;assert.notEqual(I.materialFingerprint(b),key);});
test('checkpoint contains observations but no private material',()=>{const c=I.checkpoint(input(),NOW);assert.equal(c.version,4);assert.equal(c.open,0);assert.ok(!JSON.stringify(c).includes('PRIVATE'));});
test('same book checkpoint comparisons retain zero P&L changes',()=>{const a=I.checkpoint(input(),NOW),b=I.checkpoint(input(),NOW+60000),c=I.changes(a,b);assert.equal(c.ready,true);assert.equal(c.open,0);assert.equal(c.spot,0);});
test('book edits suppress like-for-like P&L and risk deltas',()=>{const a=I.checkpoint(input(),NOW),x=input();x.book.legs[0].lots=1;const c=I.changes(a,I.checkpoint(x,NOW+60000));assert.equal(c.sameBook,false);assert.equal(c.open,null);assert.equal(c.coverage,null);});
test('incomplete P&L does not become a complete change',()=>{const x=input();x.valuation.complete=false;assert.equal(I.changes(I.checkpoint(x,NOW),I.checkpoint(input(),NOW+60000)).open,null);});
test('future checkpoint rejected',()=>{const a=I.checkpoint(input(),NOW+60000),b=I.checkpoint(input(),NOW);assert.equal(I.changes(a,b).ready,false);});
test('legacy and missing checkpoints require explicit new checkpoint',()=>{assert.equal(I.changes(null,I.checkpoint(input(),NOW)).ready,false);assert.equal(I.changes({version:1,savedAt:new Date(NOW).toISOString()},I.checkpoint(input(),NOW)).ready,false);});
test('new-news comparison uses safe source links',()=>{const a=I.checkpoint(input(),NOW),b=I.checkpoint(input(),NOW+60000),news=[{title:'new',url:'https://example.org/new'},{title:'script',url:'javascript:alert(1)'}];assert.equal(I.changes(a,b,news).newNews.length,1);});
test('coach remains usable without a book',()=>{const codes=I.coach({},NOW).map(x=>x.code);assert.ok(codes.includes('EMPTY_BOOK'));assert.ok(codes.includes('SOURCE_TIME_MISSING'));});
test('coach identifies coverage and incomplete Greeks',()=>{const codes=I.coach(input(),NOW).map(x=>x.code);assert.ok(codes.includes('QUANTITY_GAP'));assert.ok(codes.includes('GREEKS_INCOMPLETE'));assert.ok(!codes.includes('FUNDING_STALE'));});
test('coach distinguishes failed refresh from old cache',()=>{const x=input();x.market.lastSuccess='2026-10-28T09:57:00Z';x.market.lastFailure='2026-10-28T09:59:00Z';assert.ok(I.coach(x,NOW).some(x=>x.code==='REFRESH_FAILED'));});
test('coach detects future quote and stale funding timestamps',()=>{const x=input();x.market.spot.quoteAt='2026-10-28T11:00:00Z';x.book.funding.at='2026-10-20T10:00:00Z';const codes=I.coach(x,NOW).map(x=>x.code);assert.ok(codes.includes('CLOCK_MISMATCH'));assert.ok(codes.includes('FUNDING_STALE'));});
test('coach stale quote remains distinct from unavailable quote',()=>{const x=input();x.market.spot.quoteAt='2026-10-28T09:00:00Z';const codes=I.coach(x,NOW).map(x=>x.code);assert.ok(codes.includes('QUOTE_STALE'));assert.ok(!codes.includes('SOURCE_TIME_MISSING'));});
test('safe links require HTTPS and no URL credentials',()=>{for(const x of ['javascript:alert(1)','file:///secret','http://example.org','https://user:pass@example.org/'])assert.equal(I.safeURL(x),null);assert.equal(I.safeURL('https://example.org/path'),'https://example.org/path');});
test('duplicate grouping prefers official filing and retains attribution',()=>{const g=I.newsGroups([{title:'HAL Results',source:'Media',url:'https://example.org/1'},{title:'Hindustan Aeronautics results',source:'Exchange',url:'https://example.org/2',official:true}]);assert.equal(g.length,1);assert.equal(g[0].official,true);assert.equal(g[0].duplicates.length,1);assert.equal(g[0].duplicates[0].source,'Media');});
test('nonfinite values never serialize as misleading zero',()=>{const x=input();x.risk.delta=NaN;const p=I.evidencePacket(x,{mode:'deliberate',includePortfolio:true,now:NOW});assert.equal(p.risk.delta,undefined);assert.ok(!JSON.stringify(p).includes('NaN'));});
test('evidence size hard limit refuses excessive contracts',()=>{const x=input();x.book.legs=Array.from({length:30},(_,i)=>({...book().legs[0],id:'x'.repeat(300),instrumentKey:'y'.repeat(300)}));x.valuation.rows=x.book.legs.map(leg=>({leg,mark:{}}));assert.throws(()=>I.evidencePacket(x,{mode:'copilot',includePortfolio:true,now:NOW}),/safe request limit/);});
test('riskProfile confirmation does not invalidate its own fingerprint',()=>{const x=input(),revision=I.materialFingerprint(x.book);x.book.riskProfile={confirmedAt:new Date(NOW).toISOString(),confirmedBook:revision};assert.equal(I.materialFingerprint(x.book),revision);assert.ok(!I.coach(x,NOW).some(x=>x.code==='CONFIRM_BOOK'));x.book.legs[0].lots++;assert.ok(I.coach(x,NOW).some(x=>x.code==='CONFIRM_BOOK'));});
test('research includes sourced fundamentals with exact reporting periods',()=>{const x=input();x.fundamentals={profile:{name:'HAL',apiKey:'SECRET'},metrics:[{label:'Revenue',value:100,unit:'as reported',period:'Synthetic quarter',source:'Synthetic provider',kind:'provider',url:'https://example.org/result',privateMemo:'PRIVATE'},{label:'Unsupported manual fact',value:500,kind:'manual'}]};const p=I.evidencePacket(x,{mode:'research',now:NOW});assert.equal(p.fundamentals.metrics.length,1);assert.equal(p.fundamentals.metrics[0].period,'Synthetic quarter');assert.ok(!/PRIVATE|SECRET/.test(JSON.stringify(p)));assert.equal(p.portfolio,undefined);});
test('fundamentals do not infer a reporting period or units',()=>{const p=I.fundamentalEvidence({metrics:[{label:'Revenue',value:100,kind:'provider'}]});assert.equal(p.metrics[0].period,undefined);assert.equal(p.metrics[0].unit,undefined);});
test('provider packet facts retain explicit period and do not invent units',()=>{const p=I.providerFundamentals({fetched_at_iso:'2026-11-01T06:00:00Z',data:{income:{period:'Synthetic Q1',revenue:120,margin:20}}});assert.equal(p.metrics[0].period,'Synthetic Q1');assert.equal(p.metrics[0].unit,null);assert.equal(p.metrics[0].kind,'provider');});
test('funding, legacy accounting and valuation basis invalidate previous conclusions',()=>{for(const change of [b=>b.funding.free++,b=>b.funding.at='2026-10-28T10:00:00Z',b=>b.legacy={realized:100,costs:3},b=>b.preferences={markMode:'bid'}]){const b=book(),answer={portfolioIncluded:true,bookRevision:I.materialFingerprint(b)};change(b);assert.equal(I.canUseAnswer(answer,b),false);}});
test('book confirmation requires exact revision and nonfuture valid timestamp',()=>{const b=book();b.riskProfile={confirmedAt:new Date(NOW).toISOString()};b.riskProfile.confirmedBook=I.materialFingerprint(b);assert.equal(I.isBookConfirmed(b,NOW),true);b.riskProfile.confirmedAt=new Date(NOW+120000).toISOString();assert.equal(I.isBookConfirmed(b,NOW),false);b.riskProfile.confirmedAt='invalid';assert.equal(I.isBookConfirmed(b,NOW),false);b.riskProfile.confirmedAt=new Date(NOW).toISOString();b.legs[0].lots++;assert.equal(I.isBookConfirmed(b,NOW),false);});
test('AI evidence never calls stale confirmation current',()=>{const x=input();x.book.riskProfile={confirmedAt:new Date(NOW).toISOString(),confirmedBook:'rev-wrong'};const p=I.evidencePacket(x,{mode:'copilot',includePortfolio:true,now:NOW});assert.equal(p.portfolio.confirmedAt,null);assert.ok(p.coach.some(x=>x.code==='CONFIRM_BOOK'));x.book.riskProfile.confirmedBook=I.materialFingerprint(x.book);assert.equal(I.evidencePacket(x,{mode:'copilot',includePortfolio:true,now:NOW}).portfolio.confirmedAt,new Date(NOW).toISOString());});
test('market evidence retains exchange status and actual previous close',()=>{const x=input();x.market.spot.previousClose=4800;x.market.status={status:'CLOSED',exchange:'NSE',retrievedAt:new Date(NOW).toISOString()};const p=I.evidencePacket(x,{mode:'research',now:NOW});assert.equal(p.market.spot.previousClose,4800);assert.equal(p.market.status.status,'CLOSED');assert.equal(p.market.status.retrievedAt,new Date(NOW).toISOString());});

test('lifetime corrections invalidate AI evidence while preserving verified broker holdings',()=>{
 const b=book(),approval=I.confirmationFingerprint(b);
 b.riskProfile={confirmedAt:new Date(NOW).toISOString(),confirmedBook:approval};
 b.history={records:[{id:'sample',type:'FUT',contractMonth:'2024-04',units:20,gross:75}],charges:{amount:4,asOf:'2025-02-01',coversExisting:true}};
 const revision=I.materialFingerprint(b);
 assert.ok(I.isBookConfirmed(b,NOW));assert.notEqual(revision,approval);
 b.history.records[0].note='PRIVATE';assert.equal(revision,I.materialFingerprint(b));
 b.history.charges.amount=8;assert.equal(I.canUseAnswer({bookRevision:revision,portfolioIncluded:true},b),false);assert.ok(I.isBookConfirmed(b,NOW));
 b.legs[0].entry++;assert.equal(I.isBookConfirmed(b,NOW),false);
});

test('checkpoint stores only bounded exact contract mark metadata for later attribution',()=>{
 const x=input();x.valuation.rows=[{
  leg:{id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35,instrumentKey:'NSE_F',secret:'PRIVATE LEG'},
  units:300,mark:{price:5000,source:'REST LTP',status:'current',
   quoteAt:'2026-10-28T09:59:30Z',tradeAt:'2026-10-28T09:59:29Z',
   retrievedAt:'2026-10-28T09:59:40Z',credential:'SECRET',note:'PRIVATE MARK'}
 }];
 const c=I.checkpoint(x,NOW),v=c.positionMarks[0],serialized=JSON.stringify(c);
 assert.equal(v.id,'f');assert.equal(v.units,300);
 assert.equal(v.price,5000);assert.equal(v.source,'REST LTP');
 assert.equal(v.quoteAt,'2026-10-28T09:59:30.000Z');
 assert.ok(!/SECRET|PRIVATE|credential/.test(serialized));
});
test('legacy version-4 checkpoint remains readable with no contract mark data',()=>{
 const x=input(),c=I.checkpoint(x,NOW);
 assert.equal(c.version,4);
 assert.deepEqual(c.positionMarks,[]);
});
