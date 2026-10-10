'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../portfolio.js');

test('a zero quantity remains closed during migration and valuation', () => {
  const p = H.normalize({fq:0, p1q:0, p2q:0, realized:0});
  assert.equal(p.fq, 0);
  const result = H.markBook(p, undefined, undefined, '2026-10-10');
  assert.equal(result.total, 0);
  assert.ok(result.legs.every(leg => leg.pnl === 0));
});

test('zero broker mark is a valid override', () => {
  const p = H.normalize({p1mark:0});
  const result = H.markBook(p, 4655.6, '2026-10-09', '2026-10-10');
  assert.equal(result.legs[1].mark, 0);
  assert.equal(result.legs[1].pnl, -57.4 * 150);
});

test('contracts never roll; models stop on the expiry date', () => {
  const p = H.normalize();
  for (const today of ['2026-10-27','2026-11-01']) {
    const result = H.markBook(p, 4700, '2026-10-26', today);
    assert.ok(result.legs.every(leg => leg.expiry === '2026-10-27' && leg.mark === null));
    assert.equal(result.total, null);
  }
  assert.ok(H.markBook(p, 4700, '2026-10-26', '2026-10-26').total !== null);
});

test('post-expiry settlement overrides work without a current quote', () => {
  const p = H.normalize({fmark:4700, p1mark:0, p2mark:0, costs:100});
  const result = H.markBook(p, undefined, undefined, '2026-11-01');
  assert.equal(result.total, (4700-5124.9)*300 - 57.4*150 - 24.1*150 - 7011 - 100);
});

test('Black–Scholes matches a known European put and handles zero IV', () => {
  assert.ok(Math.abs(H.putPrice(100,100,1,.05,.2) - 5.573526) < 0.0001);
  assert.equal(H.putPrice(90,100,0,.05,.2), 10);
  assert.ok(Math.abs(H.putPrice(90,100,1,0,0) - 10) < 0.0001);
  assert.throws(() => H.putPrice(0,100,1,0,.2));
});

test('expiry scenarios include both put premiums, futures, realized P&L and costs', () => {
  const p = H.normalize({costs:100});
  const outcome = H.expiryPayoff(p, 4000);
  assert.equal(outcome.futures, (4000-5124.9)*300);
  assert.equal(outcome.puts, (500-57.4)*150 + (300-24.1)*150);
  assert.equal(outcome.total, outcome.open - 7011 - 100);
});

test('different active expiries do not yield a misleading payoff', () => {
  const p = H.normalize({fexpiry:'2026-11-24'});
  assert.equal(H.expiryPayoff(p,4500), null);
  p.fq = 0;
  assert.ok(H.expiryPayoff(p,4500));
});

test('invalid stored inputs are rejected without treating zero as missing', () => {
  for (const saved of [{fq:-1},{fq:1.5},{fa:Infinity},{p1expiry:'2026-02-30'},
    {p1strike:0},{p1iv:501},{costs:'50'},{fmarkAt:'unknown'},null,[]]) {
    assert.throws(() => H.normalize(saved));
  }
  assert.equal(H.normalize({costs:0, realized:-500, p1iv:0}).p1iv, 0);
});

test('IST rollover is independent of the browser timezone', () => {
  assert.equal(H.todayIST(new Date('2026-10-09T19:00:00Z')), '2026-10-10');
});
