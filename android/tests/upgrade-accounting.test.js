const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = require('../app/src/test/resources/mixed-expiry-book.json');
const candidate = path.resolve(__dirname, '../app/src/main/assets');
const now = Date.parse('2029-01-02T06:00:00Z');

function summarize(directory, book) {
  const engine = require(path.join(directory,'engine4.js'));
  const recovery = require(path.join(directory,'recovery5.js'));
  const normalized = engine.validateBook(book);
  const ledger = engine.ledger(normalized, {}, {now});
  const horizon = '2029-03-29';
  const scenario = recovery.evaluate(normalized, {}, {
    minSpot:20,maxSpot:200,horizon,rate:0,dividend:0,basis:'carry',
    newCosts:0,openRecordedCharges:0,expirySpots:{'2029-02-22':90}
  }, now);
  return {open:ledger.open, gross:ledger.realized, charges:ledger.charges,
    net:ledger.net, recordedNet:scenario.lifetimeRecordedNet,
    recoveryRoots:scenario.lifetime.roots.map(root=>Number(root.price.toFixed(3))),
    margin:normalized.funding.margin,free:normalized.funding.free};
}

test('mixed-expiry synthetic book retains accounting and conditional recovery after JSON round-trip', () => {
  // The earlier put settles at 90 (strike 95, premium 5), so the remaining
  // 20 futures units must cover the full 133.50 recorded loss.
  const actual = summarize(candidate, JSON.parse(JSON.stringify(source)));
  assert.deepEqual(actual,{open:140,gross:-120,charges:13.5,net:6.5,
    recordedNet:-133.5,recoveryRoots:[106.675],margin:3000,free:500});
  if (process.env.HAL_PREVIOUS_ASSETS) {
    assert.deepEqual(summarize(path.resolve(process.env.HAL_PREVIOUS_ASSETS),source),actual);
  }
});

test('December protective put matches independently specified rupee and recovery values',()=>{
  const E=require(path.join(candidate,'engine4.js'));
  const R=require(path.join(candidate,'recovery5.js'));
  const expiry='2029-12-27', manualAt=new Date(now).toISOString();
  const common={expiry,lots:2,lotSize:150,manualAt};
  const b={...E.emptyBook(),legs:[
    {...common,id:'f',type:'FUT',entry:4927.35,manual:4805.20},
    {...common,id:'p',type:'PE',strike:4400,entry:29.45,manual:10}
  ],legacy:{realized:-43900,costs:0,journal:[]}};
  const ledger=E.ledger(b,{},{now});
  const paise=n=>Math.round(n*100)/100;
  assert.deepEqual(ledger.rows.map(r=>paise(r.pnl)),[-36645,-5835]);
  assert.deepEqual([ledger.openPutPremium,paise(ledger.open),paise(ledger.net)],[8835,-42480,-86380]);
  assert.equal(E.risk(b,{},now).coverage,100);
  const result=R.evaluate(b,{},{horizon:expiry,minSpot:100,maxSpot:8000,basis:'carry',rate:0,dividend:0,newCosts:0,openRecordedCharges:0,lifetimeChargesConfirmed:true},now);
  assert.equal(paise(result.openNet.roots[0].price),4956.80);
  assert.equal(paise(result.lifetime.roots[0].price),5103.13);
  const floor=Math.min(...result.curves.map(p=>p.openGross));
  assert.equal(paise(floor),-167040);
  assert.equal(paise(ledger.open-floor),124560);
});

test('portable encrypted book authenticates data and rejects a wrong password or modified payload',async()=>{
 const portable=require(path.join(candidate,'portable55.js'));
 const book={schema:4,book:source};
 const password='fixture password only';
 const first=await portable.seal(book,password), second=await portable.seal(book,password);
 assert.notEqual(first.salt,second.salt);
 assert.notEqual(first.iv,second.iv);
 assert.deepEqual(await portable.unlock(first,password),book);
 await assert.rejects(portable.unlock(first,'incorrect'));
 const changed=Buffer.from(first.ciphertext,'base64');
 changed[0]^=1;
 await assert.rejects(portable.unlock({...first,ciphertext:changed.toString('base64')},password));
});
