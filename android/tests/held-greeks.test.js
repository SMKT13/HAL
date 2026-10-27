const assert=require('node:assert/strict');
const H=require('../app/src/main/assets/held-greeks.js');
const now=Date.parse('2026-10-27T05:10:00Z');
const book=[
  {type:'FUT',expiry:'2026-12-29',lots:2,lotSize:100},
  {type:'PE',expiry:'2026-11-24',lots:1,lotSize:100,strike:4500},
  {type:'PE',expiry:'2026-10-26',lots:1,lotSize:100,strike:4300},
  {type:'PE',expiry:'2026-11-24',lots:1,lotSize:100,strike:4300}
];
const p={'2026-11-24':{fetched_at_iso:'2026-10-27T05:09:30Z',data:{expiry:'2026-11-24',contracts:[
{strike:4500,has_greeks:true,iv:0.335,delta:-0.22,theta:-0.21,gamma:0.001,vega:1.2,oi:1000},
{strike:4300,has_greeks:false}
]}}};
const s=H.inspect(book,p,now);
assert.equal(s.rows.length,2);
assert.equal(s.allUnits,200);
assert.equal(s.rows[0].iv,33.5);
assert.equal(s.rows[0].deltaShares,-22);
assert.equal(s.putDeltaShares,null);
assert.equal(s.missing,1);
assert.equal(s.rows[0].feedState,'recent-fetch');
assert.match(H.markup(book,p,{},now),/incomplete/);
assert.match(H.markup(book,p,{},now),/No per-contract Greek quote timestamp/);
assert.equal(H.inspect(book,{},now).rows[0].feedState,'not-fetched');
assert.equal(H.inspect(book,{'2026-11-24':{...p['2026-11-24'],fetched_at_iso:'2026-10-26T05:00:00Z'}},now).rows[0].feedState,'older-fetch');
const complete={'2026-11-24':{...p['2026-11-24'],data:{...p['2026-11-24'].data,contracts:[...p['2026-11-24'].data.contracts.slice(0,1),{strike:4300,delta:-0.1,iv:0.5,has_greeks:true}]}}};
assert.equal(H.inspect(book,complete,now).putDeltaShares,-32);
assert.equal(H.inspect(book,{'2026-11-24':{...p['2026-11-24'],data:{expiry:'2026-11-24',contracts:[{strike:4500,delta:-4,iv:0.2,has_greeks:true}]}}},now).rows[0].available,false);
assert.ok(!H.markup(book,p,{'2026-11-24':'<img>'},now).includes('<img>'));
assert.match(H.markup([],{}, {},now),/No currently active/);
console.log('Held-put Greeks unit tests passed');
