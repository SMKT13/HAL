const assert=require('node:assert/strict');
const I=require('../app/src/main/assets/option-intelligence.js');
const now=Date.parse('2026-10-27T05:10:00Z');
const book=[
  {type:'FUT',expiry:'2026-12-29',lots:2,lotSize:100},
  {type:'PE',expiry:'2026-11-24',lots:1,lotSize:100,strike:4500},
  {type:'PE',expiry:'2026-10-26',lots:1,lotSize:100,strike:4300}
];
const packet={option_expiry:'2026-11-24',fetched_at_iso:new Date(now-30000).toISOString(),spot:{last_price:4900},option_rows:[
  {strike:4800,call:{oi:200,prev_oi:150,volume:20,iv:30},put:{oi:300,prev_oi:350,volume:30,iv:32}},
  {strike:4900,call:{oi:800,prev_oi:850,volume:80,iv:26},put:{oi:600,prev_oi:550,volume:60,iv:28}},
  {strike:5000,call:{oi:400,prev_oi:420,volume:50,iv:24},put:{oi:100,prev_oi:130,volume:40,iv:27}}
]};
const d=I.analyze(packet,book,now);
assert.equal(d.rows,3);
assert.equal(d.paired,3);
assert.equal(d.putTotal,1000);
assert.equal(d.callTotal,1400);
assert.equal(d.pcr,1000/1400);
assert.equal(d.putTop.strike,4900);
assert.equal(d.callTop.strike,4900);
assert.equal(d.ivSkew,2);
assert.equal(d.selectedUnits,100);
assert.equal(d.futUnits,200);
assert.equal(d.putUnits,100);
assert.equal(d.gap,35);
assert.equal(d.putChange,-30);
assert.equal(d.callChange,-20);
assert.equal(d.clock.status,'recent-fetch');
assert.equal(I.analyze({...packet,fetched_at_iso:'2026-10-26T05:00:00Z'},book,now).clock.status,'older-fetch');
assert.equal(I.analyze({...packet,chain_error:'upstox_rate_limited'},book,now).rows,0);
assert.match(I.markup(packet,book,now),/35 calendar days/);
assert.match(I.markup(packet,book,now),/Individual option trade and quote clocks are not supplied/);
assert.match(I.markup(packet,book,now),/paired strikes/);
assert.ok(!I.markup({...packet,option_expiry:'<script>'},book,now).includes('<script>'));
const partial={...packet,option_rows:[{strike:4900,put:{oi:100,iv:20,prev_oi:10},call:{iv:21}}]};
const p=I.analyze(partial,book,now);
assert.equal(p.pcr,null);
assert.equal(p.paired,0);
assert.equal(p.putChange,90);
assert.equal(p.callChange,null);
assert.equal(p.ivSkew,-1);
assert.equal(I.analyze(null,[],now).rows,0);
console.log('HAL option-chain intelligence checks passed');
