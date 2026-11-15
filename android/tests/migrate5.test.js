'use strict';
const test=require('node:test'),A=require('node:assert/strict');
const E=require('../app/src/main/assets/engine4.js');
const G=require('../app/src/main/assets/migrate5.js');
const book=()=>{
 const b=E.emptyBook();
 b.legs=[{id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:5000,
  instrumentKey:'TEST_F',manual:null},
  {id:'p',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:40,
   instrumentKey:'TEST_P',manual:null}];
 b.journal=[{id:'c',kind:'close',date:'2026-10-27',
  leg:{id:'old',type:'PE',expiry:'2026-10-27',strike:4300,lots:1,lotSize:150,entry:25},
  exit:0.5,fees:80},
  {id:'f2',kind:'fee',date:'2026-10-28',amount:250}];
 b.notes=[{id:'n',date:'2026-10-30',title:'Private note',text:'Test content'}];
 b.riskProfile.maxLoss=100000;
 return b;
};
test('unchanged schema-4 migration retains legs, journal and costs',()=>{
 const before=book(),after=E.validateBook(before);
 const result=G.audit(before,after);
 A.equal(result.safe,true);A.equal(result.before.openLegs,2);
 A.equal(result.before.journalEntries,2);A.equal(result.financialTotalsMatch,true);
});
test('revoking prior broker confirmation does not falsely fail preservation',()=>{
 const before=book();before.riskProfile.confirmedAt='2026-11-01T10:00:00.000Z';
 before.riskProfile.confirmedBook='old-confirmation';
 const after=E.validateBook(before);after.riskProfile.confirmedAt=null;
 after.riskProfile.confirmedBook=null;
 A.equal(G.audit(before,after).safe,true);
});
test('lost futures lot fails acceptance',()=>{
 const before=book(),after=E.validateBook(before);after.legs[0].lots=1;
 A.equal(G.audit(before,after).safe,false);
 A.ok(G.audit(before,after).changed.includes('legs'));
});
test('omitting a closed October put or fees is never accepted',()=>{
 const before=book(),after=E.validateBook(before);after.journal=[];
 const report=G.audit(before,after);
 A.equal(report.safe,false);
 A.ok(report.changed.includes('journal'));A.equal(report.financialTotalsMatch,false);
});
test('changed imported history or risk limit requires review',()=>{
 const before=book(),after=E.validateBook(before);after.riskProfile.maxLoss=5;
 const report=G.audit(before,after);
 A.ok(report.changed.includes('riskProfileLimits'));
});
test('lost private note is detected but its content is never exposed by report',()=>{
 const before=book(),after=E.validateBook(before);after.notes=[];
 const report=G.audit(before,after);
 A.equal(report.safe,false);A.ok(report.changed.includes('notes'));
 A.equal(JSON.stringify(report).includes('Private note'),false);
});
test('bad version and corrupt ledger refuse any migration acceptance',()=>{
 const before=book();
 A.throws(()=>G.audit({...before,version:99},before),/schema-4/);
 A.throws(()=>G.audit(before,{...before,legs:[{bad:true}]}));
});
test('replacement preview exposes lost October journal and changed charges before import',()=>{
 const before=book(),after=E.validateBook(before);
 after.journal=[];after.legs=[after.legs[0]];
 const prior=JSON.stringify(before),incoming=JSON.stringify(after);
 const report=G.replacement(before,after);
 A.equal(report.destructive,true);A.equal(report.requiresTypedConfirmation,true);
 A.ok(report.changes.some(x=>x.section==='Completed journal entries'&&x.removed===2));
 A.ok(report.changes.some(x=>x.section==='Open positions'&&x.removed===1));
 A.ok(report.warnings.some(x=>x.includes('realized P&L')));
 A.equal(JSON.stringify(before),prior);A.equal(JSON.stringify(after),incoming);
});
test('replacement preview reports no loss when records are unchanged',()=>{
 const before=book(),after=E.validateBook(before);
 const report=G.replacement(before,after);
 A.equal(report.destructive,false);
 A.equal(report.requiresTypedConfirmation,false);
 A.ok(report.changes.every(x=>x.removed===0&&x.modified===0));
});
test('reused journal ID with altered closed price is flagged as modified',()=>{
 const before=book(),after=E.validateBook(before);
 after.journal[0].exit=10;
 const report=G.replacement(before,after);
 const journal=report.changes.find(x=>x.section==='Completed journal entries');
 A.equal(journal.removed,0);A.equal(journal.modified,1);
 A.equal(report.destructive,true);
});
test('removed notes are counted, but private content is not exposed in the impact report',()=>{
 const before=book(),after=E.validateBook(before);after.notes=[];
 const impact=G.replacement(before,after);
 A.equal(impact.destructive,true);
 A.equal(impact.changes.find(x=>x.section==='Private notes').removed,1);
 A.equal(JSON.stringify(impact).includes('Test content'),false);
});
test('changed cumulative charge coverage requires destructive-import confirmation',()=>{
 const H=require('../app/src/main/assets/history5.js');
 const before=book(),after=H.setCharges(E.validateBook(before),{asOf:'2026-10-31',amount:100,source:'Broker statement'},true);
 const impact=G.replacement(before,after);
 A.equal(impact.destructive,true);
 A.ok(impact.warnings.some(x=>x.includes('Cumulative')));
});
test('readonly migration report leaves both inputs unchanged',()=>{
 const before=book(),after=E.validateBook(before),payload=JSON.stringify([before,after]);
 G.audit(before,after);A.equal(JSON.stringify([before,after]),payload);
});
