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
