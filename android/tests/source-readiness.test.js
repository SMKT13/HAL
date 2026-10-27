const assert=require('node:assert/strict');
const H=require('../app/src/main/assets/source-readiness.js');
const now=Date.parse('2026-10-27T05:10:00Z');
const at=(secs=30)=>new Date(now-secs*1000).toISOString();
const base={configured:true,mode:'direct',
  snapshot:{fetched_at_iso:at(5),spot:{last_price:5000,quote_as_of:at(30),last_trade_at:at(20)}},
  book:{legs:[{type:'FUT'},{type:'PE'}]},
  review:{confirmed:true,states:[{status:'current'},{status:'current'}],dataMode:'current'}
};
const ready=H.inspect(base,now);
assert.equal(ready.reviewEligible,true);
assert.equal(ready.current,2);
assert.equal(ready.spotState,'recent');
assert.equal(H.inspect({...base,lastFailed:true},now).spotState,'previous-failed');
assert.equal(H.inspect({...base,lastFailed:true},now).reviewEligible,false);
assert.equal(H.inspect({...base,snapshot:{...base.snapshot,spot:{...base.snapshot.spot,last_trade_at:at(300)}}},now).spotState,'older');
assert.equal(H.inspect({...base,snapshot:{...base.snapshot,spot:{...base.snapshot.spot,last_trade_at:null}}},now).spotState,'missing-clocks');
assert.equal(H.inspect({...base,snapshot:{...base.snapshot,spot:{...base.snapshot.spot,quote_as_of:new Date(now+90000).toISOString()}}},now).spotState,'clock-error');
assert.equal(H.inspect({...base,review:{...base.review,confirmed:false}},now).reviewEligible,false);
assert.equal(H.inspect({...base,review:{...base.review,states:[{status:'current'},{status:'saved'}]}},now).current,1);
assert.equal(H.inspect({...base,review:{...base.review,states:[{status:'current'},{status:'saved'}]}},now).reviewEligible,false);
assert.equal(H.inspect({...base,configured:false},now).connection,'not-connected');
assert.equal(H.inspect({...base,mode:'server'},now).reviewEligible,false);
assert.equal(H.inspect({...base,book:{legs:[]},review:{...base.review,states:[]}},now).reviewEligible,false);
assert.match(H.markup({...base,review:{...base.review,states:[{status:'current'},{status:'saved'}]}},now),/1 of 2/);
assert.match(H.markup(base,now),/not a trading approval/);
assert.ok(!H.markup({...base,mode:'<img>'},now).includes('<img>'));
assert.equal(H.ageState('not a date',now),'missing');
console.log('HAL data source readiness checks passed');
