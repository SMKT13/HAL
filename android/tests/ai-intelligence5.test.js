'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),AI=require('../app/src/main/assets/ai-intelligence5.js');
const source={schemaVersion:4,generatedAt:'2026-11-20T10:00:00Z',quoteAsOf:'2026-11-20T09:50:00Z',portfolioIncluded:true,bookRevision:'rev-1234abcd',market:{spot:{price:4900,changePct:2}},technical:{rsi:40},news:[{title:'Public filing'}],fundamentals:{metrics:[]},sources:[],portfolio:{legs:[{type:'FUT'}]},valuation:{net:-1234,complete:true},risk:{futureUnits:300,uncoveredUnits:150},funding:{margin:10},scenarios:[{total:-500}]};
test('market questions exclude finance even when packet includes private financial data',()=>{
 const x=AI.selectContext(source,'What is the HAL technical trend?',{mode:'copilot',includePortfolio:true});
 assert.equal(x.scope,'market');assert.equal(x.evidence.portfolioIncluded,false);
 for(const f of ['portfolio','valuation','risk','bookRevision','funding','scenarios'])assert.equal(x.evidence[f],undefined);
});
test('position question includes only approved financial context',()=>{
 const x=AI.selectContext(source,'Check my position risk',{mode:'copilot',includePortfolio:true});
 assert.equal(x.scope,'position');assert.equal(x.evidence.bookRevision,'rev-1234abcd');assert.equal(x.evidence.risk.uncoveredUnits,150);
 assert.equal(x.evidence.news,undefined);
});
test('research never includes financial records',()=>{
 const x=AI.selectContext(source,'Explain latest results',{mode:'research',includePortfolio:true});
 assert.equal(x.evidence.portfolioIncluded,false);assert.equal(x.evidence.bookRevision,undefined);
 assert.ok(x.evidence.news);
});
test('declined portfolio consent does not send financial records',()=>{
 const x=AI.selectContext(source,'My hedge',{mode:'copilot',includePortfolio:false});
 assert.equal(x.evidence.portfolio,undefined);assert.equal(x.evidence.portfolioIncluded,false);
});
test('invalid revision refuses financial context',()=>{
 assert.throws(()=>AI.selectContext({...source,bookRevision:''},'My hedge',{mode:'copilot',includePortfolio:true}),/revision/);
});
test('recovery intent explicitly notes insufficient baseline',()=>{
 const x=AI.selectContext(source,'How is my lifetime recovery?',{mode:'copilot',includePortfolio:true});
 assert.equal(x.scope,'recovery');assert.match(x.evidence.contextNote,/not contain/);
});
test('data integrity is higher priority than market move',()=>{
 assert.equal(AI.priority({integrityIssue:'room_v2_conflict',market:{spot:{changePct:10}},marketVerified:true}).code,'DATA_INTEGRITY');
});
test('missing valuation marks prevent false portfolio total',()=>{
 assert.equal(AI.priority({hasOpenPosition:true,valuation:{complete:false}}).code,'MISSING_MARKS');
});
test('coverage triggers only on confirmed finite quantities',()=>{
 assert.equal(AI.priority({bookConfirmed:true,risk:{futureUnits:300,uncoveredUnits:75}}).code,'COVERAGE_CRITICAL');
 assert.equal(AI.priority({bookConfirmed:false,risk:{futureUnits:300,uncoveredUnits:75}}).code,'ROUTINE');
});
test('verified expiry sessions needed, not calendar guesses',()=>{
 assert.equal(AI.priority({verifiedExpirySessions:2,hasContinuingFutures:true}).code,'EXPIRY_IMMINENT');
 assert.equal(AI.priority({hasContinuingFutures:true}).code,'ROUTINE');
});
test('market event only with verified input',()=>{
 assert.equal(AI.priority({market:{spot:{changePct:4}}}).code,'ROUTINE');
 assert.equal(AI.priority({market:{spot:{changePct:4}},marketVerified:true}).code,'MARKET_MOVE');
});
test('daily intelligence brief includes all approved relevant evidence',()=>{
 const x=AI.selectContext(source,'Prepare my daily HAL intelligence brief with recovery',{mode:'copilot',includePortfolio:true});
 assert.equal(x.scope,'comprehensive');assert.equal(x.evidence.portfolioIncluded,true);
 assert.ok(x.evidence.news);assert.ok(x.evidence.technical);assert.ok(x.evidence.risk);
});
