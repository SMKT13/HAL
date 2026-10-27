'use strict';
const assert=require('node:assert/strict');
const pulse=require('../app/src/main/assets/market-pulse.js');
const now=Date.parse('2026-10-27T05:10:00Z');
const input={source:'Upstox official API',fetched_at_iso:'2026-10-27T05:10:01Z',data:{indices:{
  'NSE_INDEX:Nifty 50':{last_price:24500,prev_close_price:24000,last_trade_time:String(now-30000)},
  'NSE_INDEX:India VIX':{last_price:15,prev_close_price:16,last_trade_time:String(now-600000)}
}}};
const summary=pulse.inspect(input,now);
assert.equal(summary.rows[0].state,'recent');
assert.equal(summary.rows[1].state,'older');
assert.equal(pulse.inspect({data:{indices:{'NSE_INDEX:Nifty 50':{last_price:24500,last_trade_time:String(now+120000)}}}},now).rows[0].state,'clock-error');
assert.match(pulse.markup({data:{indices:{'NSE_INDEX:Nifty 50':{last_price:24500,last_trade_time:String(now+120000)}}}},'',now),/Check provider\/device clock/);
assert.ok(summary.rows[0].change>0);
assert.ok(summary.rows[1].change<0);
assert.equal(pulse.inspect(null,now).rows[0].state,'unavailable');
assert.equal(pulse.inspect({data:{indices:{'NSE_INDEX:Nifty 50':{last_price:1}}}},now).rows[0].state,'unknown-time');
assert.equal(pulse.inspect({data:{indices:{'NSE_INDEX:Nifty 50':{last_price:0,last_trade_time:now}}}},now).rows[0].state,'unavailable');
assert.ok(pulse.markup({errors:{indices:'<untrusted>'}},'Unavailable',now).includes('&lt;untrusted&gt;'));
assert.ok(!pulse.markup(null,'',now).includes('Recent trade'));
console.log('Analytics market pulse checks passed.');
