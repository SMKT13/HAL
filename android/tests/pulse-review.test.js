'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),r=require('../app/src/main/assets/pulse-review.js');
const leg={id:'held',type:'PE',strike:4400,expiry:'2026-11-23',lots:2,lotSize:150,entry:30};
test('last close uses old book for a partial close, an addition and a roll',()=>{
 let log=r.observe([], [leg],1);
 log=r.observe(log,[{...leg,lots:1}],3,[leg]);
 log=r.observe(log,[{...leg,id:'dec',expiry:'2026-12-29',entry:40,lots:1}],4);
 const out=r.compare(log,2,150,()=>32);
 assert.equal(out.delta,-450);assert.equal(out.activity.length,3);assert.match(out.activity.join(' '),/Reduced.*Removed.*Added/);
});
test('missing marks, first run, recovery gaps and unchanged book',()=>{
 const log=r.observe([], [leg],5);assert.equal(r.compare(log,2,10,()=>0).baseline,false);
 assert.equal(r.compare(log,6,10,()=>null).delta,null);
 assert.equal(r.compare(log,6,10,()=>0).delta,9010);
 assert.equal(r.observe(log,[leg],7),log);
 assert.equal(r.observe(log,[],8,[]).length,1);
});
test('same-quarter margin change uses percentage points, including zero and missing',()=>{
 assert.equal(r.marginChange(25,21),4);assert.equal(r.marginChange(0,21),-21);assert.equal(r.marginChange(25,null),null);
});
const group=(category,value)=>({category,history:[{period:'Q',value}]});
test('ownership categories reconcile broad public and avoid counting child rows twice',()=>{
 const groups=[group('Promoter',70),group('DIIs',12),group('Mutual funds',8),group('FIIs',10),group('Public shareholding',30)];
 assert.deepEqual(r.groupOwnership(groups,'Q'),[70,12,10,8]);
 assert.deepEqual(r.groupOwnership(groups,'prior'),[null,null,null,null]);
});
test('ownership handles available component rows and missing values',()=>{
 const groups=[group('mutual funds',4),group('insurance',3),group('FPI',0),group('retail',8)];
 assert.deepEqual(r.groupOwnership(groups,'Q'),[null,7,0,8]);
});
