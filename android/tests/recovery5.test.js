const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js'),R=require('../app/src/main/assets/recovery5.js'),H=require('../app/src/main/assets/history5.js');
const now=Date.parse('2029-01-02T06:00:00Z'),expiry='2029-03-29',near='2029-02-22';
const future=(fields={})=>({id:'A',type:'FUT',expiry,lots:1,lotSize:10,entry:100,instrumentKey:'TEST_F',...fields});
const put=(fields={})=>({id:'B',type:'PE',expiry,lots:1,lotSize:10,strike:100,entry:5,instrumentKey:'TEST_P',...fields});
const basket=(...legs)=>({...E.emptyBook(),legs});
const params={minSpot:20,maxSpot:200,horizon:expiry,rate:0,dividend:0,basis:'carry',newCosts:0,openRecordedCharges:0};
const quote=(price,fields={})=>({price,source:'REST',quoteAt:E.iso(now-1000),tradeAt:E.iso(now-2000),retrievedAt:E.iso(now-800),...fields});
function nearEqual(actual,expected,precision=0.000001){assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<precision,`${actual} must equal ${expected} (±${precision})`);}
function oneRoot(view,price){assert.equal(view.status,'roots');assert.equal(view.roots.length,1);nearEqual(view.roots[0].price,price);}
function run(b,market={},options={}){return R.evaluate(b,market,{...params,...options},now);}
test('open gross and net recover precisely the included share costs at expiry',()=>{
  const book=basket(future({lots:3}));
  const r=run(book,{}, {openRecordedCharges:30,newCosts:60});
  oneRoot(r.openGross,100);oneRoot(r.openNet,103);
  assert.equal(r.lifetime.available,false);assert.equal(r.openNet.requiredGrossPnl,90);assert.equal(r.priceReference,'HAL spot');
  assert.equal(r.currentSpot,null);assert.equal(r.openGross.roots[0].changePct,null);
  assert.equal(r.kind,'Exact expiry payoff');
});
test('uses cumulative charges once rather than adding them to existing covered fees and the open allocated charges',()=>{
  let b=basket(future());
  b.legacy={realized:-110,costs:5,journal:[]};
  b=E.recordCash(b,'fee',3,'2029-01-01','',{now,id:'FEE-A'});
  b.history={version:1,records:[],revisions:[],imports:[],charges:{amount:20,source:'Synthetic statement',asOf:'2029-01-01',coversExisting:true}};
  b=E.recordCash(b,'fee',2,'2029-01-02','',{now,id:'FEE-B'});
  const r=run(b,{}, {newCosts:8,openRecordedCharges:7});
  assert.equal(r.lifetimeRecordedNet,-132);oneRoot(r.openNet,101.5);oneRoot(r.lifetime,114);
  assert.equal(r.lifetime.requiredGrossPnl,140);
});
test('unknown fee allocation withholds only the cost-dependent view',()=>{
  const b=basket(future());const r=run(b,{}, {newCosts:0,openRecordedCharges:null,lifetimeChargesConfirmed:true});
  oneRoot(r.openGross,100);assert.equal(r.openNet.status,'unavailable');oneRoot(r.lifetime,100);
  const missingExit=run(b,{}, {newCosts:null,lifetimeChargesConfirmed:true});oneRoot(missingExit.openGross,100);
  assert.equal(missingExit.lifetime.available,false);assert.equal(missingExit.openNet.available,false);
});
test('detects two break-even prices for an overhedged expiry book and a single point at the strike',()=>{
  const r=run(basket(future(),put({lots:2})));
  assert.deepEqual(r.openGross.roots.map(x=>Math.round(x.price)),[90,110]);
  oneRoot(run(basket(future(),put({lots:2,entry:0}))).openGross,100);
});
test('reports flat solutions, an endpoint, and no crossing in the specified interval',()=>{
  const flat=run(basket(future(),put({entry:0})));assert.equal(flat.openGross.status,'flat');
  assert.deepEqual(flat.openGross.flatRanges,[{from:20,to:100}]);assert.deepEqual(flat.openGross.roots,[]);
  oneRoot(run(basket(future()),{},{minSpot:100}).openGross,100);
  const none=run(basket(future()),{},{minSpot:130}).openGross;assert.equal(none.status,'no_crossing');assert.deepEqual(none.roots,[]);
});
test('rejects later hypothetical valuation until each earlier put has its own assumed settlement',()=>{
  const b=basket(future(),put({expiry:near}));
  assert.match(run(b).errors.join(' '),/earlier HAL settlement/);
  const first=run(b,{}, {expirySpots:{[near]:80}});oneRoot(first.openGross,85);assert.equal(first.kind,'Conditional expiry path');
  oneRoot(run(b,{}, {expirySpots:{[near]:140}}).openGross,105);
  const earlierHorizon=run(b,{}, {horizon:near});oneRoot(earlierHorizon.openGross,105);assert.equal(earlierHorizon.kind,'Model estimate');
});
test('pre-expiry explicit-IV calculation works offline and identifies multiple non-linear solutions',()=>{
  const b=basket(future(),put({lots:2,entry:14}));const r=run(b,{}, {horizon:near,fallbackIV:15});
  assert.equal(r.complete,true);assert.equal(r.openGross.roots.length,2);
  for(const {price} of r.openGross.roots){
    const scenario=E.scenario(b,{},{...params,horizon:near,spot:price,fallbackIV:15},now);
    nearEqual(scenario.total,0,.00001);
  }
  assert.match(run(b,{}, {horizon:near}).errors.join(' '),/IV unavailable/);
});
test('uses remaining and closed lots after a partial close',()=>{
  const b=E.closeLeg(basket(future({lots:2})), 'A',1,120,5,'2029-01-02',{now,id:'synthetic-close'});
  const r=run(b,{}, {lifetimeChargesConfirmed:true});
  assert.equal(b.legs[0].lots,1);assert.equal(r.lifetimeRecordedNet,195);oneRoot(r.lifetime,80.5);
});
test('fresh spot distance and incremental profit require their own valid market observations',()=>{
  const b=basket(future());const market={spot:quote(91),contracts:[future()],quotes:{TEST_F:quote(92)}};
  const r=run(b,market);oneRoot(r.openGross,100);nearEqual(r.openGross.roots[0].change,9);nearEqual(r.openGross.roots[0].changePct,100*9/91);
  assert.equal(r.currentOpenGross,-80);assert.equal(r.openGross.requiredAdditionalPnl,80);
  for(const q of [quote(100,{tradeAt:null}),quote(100,{quoteAt:E.iso(now-180000)}),quote(100,{tradeAt:E.iso(now+10000)}),quote(100,{source:'CACHE'}),quote(100,{failure:'rejected'})]){
    const result=run(b,{...market,spot:q});oneRoot(result.openGross,100);
    assert.equal(result.currentSpot,null);assert.equal(result.openGross.roots[0].change,null);
  }
  const manual=run(basket(future({manual:90,manualAt:E.iso(now)})),market);assert.equal(manual.currentOpenGross,null);
});
test('observed basis marks and put IV are validated independently of manual scenarios',()=>{
  const b=basket(future());const market={spot:quote(111),contracts:[future()],quotes:{TEST_F:quote(114)}};
  const r=run(b,market,{horizon:near,basis:'constant'});oneRoot(r.openGross,97);
  nearEqual(r.openGross.roots[0].futures[0].price,100);
  assert.match(run(b,{...market,quotes:{TEST_F:quote(114,{source:'CACHE'})}},{horizon:near,basis:'constant'}).errors.join(' '),/fresh exact-contract/);
  const book=basket(put());const input={contracts:[put()],quotes:{TEST_P:quote(5,{iv:22,greeksAt:E.iso(now-160000)})}};
  assert.equal(run(book,input,{horizon:near}).complete,false);
  assert.equal(run(book,input,{horizon:near,fallbackIV:23}).complete,true);
});
test('rejects an invalid lot specification, out-of-order horizon and incomplete model input',()=>{
  const b=basket(future());
  assert.match(run(b,{contracts:[future({lotSize:9})]}).errors.join(' '),/lot size/);
  for(const options of [{minSpot:190,maxSpot:80},{horizon:'2028-12-01'},{newCosts:-1},{rate:Infinity},{fallbackIV:-5}]){
    const r=run(b,{},options);assert.equal(r.complete,false);assert.equal(r.openGross.available,false);
  }
  assert.equal(run(basket()).complete,false);
});

test('expiring optional marks hides distances without losing a manual scenario root',()=>{
  const f=future();
  const market={contracts:[f],quotes:{TEST_F:quote(102)},spot:quote(101)};
  const result=run(basket(f),market);
  const later=R.asOf(result,now+121000);
  oneRoot(later.openGross,100);
  assert.equal(later.currentSpot,null);
  assert.equal(later.currentOpenGross,null);
  assert.equal(later.openGross.roots[0].change,null);
  assert.equal(later.openGross.requiredAdditionalPnl,null);
  assert.equal(result.currentSpot,101);
});
test('an observed basis expires when the first required leg quote ages',()=>{
  const f=future(),market={contracts:[f],quotes:{TEST_F:quote(102,{tradeAt:E.iso(now-119000)})},spot:quote(101)};
  const report=run(basket(f),market,{horizon:near,basis:'constant'});
  assert.ok(report.complete);
  assert.equal(R.asOf(report,now+1001),null);
});
test('overflow in the option or futures valuation fails closed',()=>{
  const result=run(basket(future({expiry:'9999-03-29'})),{}, {horizon:near,rate:100});
  assert.equal(result.complete,false);
  assert.equal(result.openGross.available,false);
});
