'use strict';

const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../app/src/main/assets/history5.js');
const E=require('../app/src/main/assets/engine4.js');
const D=require('../app/src/main/assets/data4.js');
const U=require('../app/src/main/assets/history-ui5.js');

const source={sourceId:'synthetic-report',sourceName:'Synthetic statement',mode:'cumulative'};
const summary={type:'FUT',contractMonth:'2025-02',units:7,entry:102.35,exit:98.62,gross:-26.12,sourceRow:'S1:8'};
const close={id:'partial',kind:'close',date:'2025-02-10',leg:{type:'FUT',id:'f',lots:1,lotSize:7,entry:102.35,expiry:'2025-02-25'},exit:98.62,fees:2.5};
const payload=(records)=>({...source,records});
const accept=(book,data,choices={})=>H.applyImport(book,H.previewImport(book,data),choices);
const choiceKey=c=>[c.kind,c.incomingId||'',c.id].join('\n');

test('reported aggregate P&L survives persistence without inventing a trade date',()=>{
  const open={id:'open',type:'FUT',lots:2,lotSize:6,expiry:'2099-02-25',entry:120,manual:0};
  const before={...E.emptyBook(),legs:[open]};
  const statement=payload([summary,{type:'CE',contractMonth:'2025-03',strike:135,units:7,gross:16.2}]);
  let b=accept(before,statement);
  assert.equal(H.totals(b).realized,-9.92);
  assert.deepEqual(b.legs,before.legs);
  assert.equal(b.history.records[0].date,null);
  assert.equal(b.history.records[0].expiry,null);
  assert.equal(b.history.records[1].type,'CE');
  assert.equal(before.history?.records?.length??0,0);
  b=D.previewImport(D.safeBackup(b));
  assert.equal(H.totals(b).realized,-9.92);
  assert.equal(E.ledger(b).realized,-9.92);
  assert.equal(b.legs[0].manual,0);
  assert.equal(b.history.records[0].gross,-26.12);
});

test('reimport is idempotent and changed source rows require a reviewed replacement',()=>{
  const b=accept(E.emptyBook(),payload([summary]));
  const duplicate=H.previewImport(b,payload([summary]));
  assert.equal(duplicate.duplicates.length,1);
  assert.deepEqual(H.applyImport(b,duplicate),b);
  const corrected=H.previewImport(b,payload([{...summary,gross:-27}]));
  assert.throws(()=>H.applyImport(b,corrected),/correct|skip/);
  const next=H.applyImport(b,corrected,{byConflict:{[choiceKey(corrected.conflicts[0])]:'replace'}});
  assert.equal(next.history.records.length,1);
  assert.equal(next.history.revisions[0].record.gross,-26.12);
  assert.equal(H.totals(next).realized,-27);
  assert.throws(()=>H.applyImport(next,corrected),/ledger changed/);
});

test('overlap with detailed close retains journal, fee and its alternate source',()=>{
  const b={...E.emptyBook(),journal:[close]};
  const preview=H.previewImport(b,payload([summary]));
  assert.deepEqual(preview.conflicts.map(x=>x.kind),['journal']);
  assert.throws(()=>H.applyImport(b,preview),/overlapping/);
  const next=H.applyImport(b,preview,{byConflict:{[choiceKey(preview.conflicts[0])]:'replace'}});
  assert.equal(next.journal.length,1);assert.equal(next.history.records.length,1);
  assert.deepEqual(next.history.excludedJournalIds,['partial']);
  assert.equal(H.totals(next).realized,-26.12);
  assert.equal(H.totals(next).charges,2.5);
  assert.deepEqual(H.applyImport(b,preview,{skipIncomingIds:[preview.additions[0].id]}),b);
});

test('charges use an inclusive date and partial-close fees exactly once',()=>{
  let b={...E.emptyBook(),journal:[close,{kind:'fee',id:'later',date:'2025-02-11',amount:1.25},{kind:'settlement',id:'m',date:'2025-02-12',amount:500}]};
  assert.throws(()=>H.setCharges(b,{amount:2,asOf:'2025-02-10',source:'Synthetic'},true),/less than/);
  b=H.setCharges(b,{amount:10,asOf:'2025-02-10',source:'Synthetic'},true);
  assert.equal(H.totals(b).charges,11.25);
  const newer={amount:12,asOf:'2025-02-11',source:'Updated synthetic statement'};
  b=H.setCharges(b,newer,true);assert.equal(H.totals(b).charges,12);
  assert.equal(b.history.revisions[0].charges.amount,10);
  assert.deepEqual(H.setCharges(b,newer,true),b);
  assert.equal(E.ledger(b).settlements,500);
});

test('legacy realised totals must be reconciled explicitly',()=>{
  const b={...E.emptyBook(),legacy:{realized:55,costs:5,journal:[]}};
  const p=H.previewImport(b,payload([summary]));
  assert.throws(()=>H.applyImport(b,p),/overlapping/);
  const next=H.applyImport(b,p,{byConflict:{[choiceKey(p.conflicts[0])]:'replace'}});
  assert.equal(next.legacy.realized,55);
  assert.equal(H.totals(next).realized,-26.12);
  assert.equal(H.totals(next).charges,5);
});

test('revised cumulative source cannot silently remove older missing rows',()=>{
  const extra={...summary,contractMonth:'2025-04',sourceRow:'S1:9',gross:12};
  const b=accept(E.emptyBook(),payload([summary,extra]));
  const p=H.previewImport(b,payload([summary]));
  assert.equal(p.warnings.length,1);
  assert.deepEqual(H.applyImport(b,p),b);
});

test('source CSV accepts explicit zero and rejects an absent or malformed amount',()=>{
  const csv='Scrip Name,Quantity,Avg Buy Price,Avg Sell Price,Realized P&L\r\nHAL 13 FEB 25 90 Put,7,2,0,-14';
  const rows=U.statementRows(U.csvRows(csv));
  assert.equal(rows[0].exit,0);assert.equal(rows[0].expiry,'2025-02-13');assert.equal(rows[0].sourceRow,'2');
  assert.equal(H.totals(accept(E.emptyBook(),payload(rows))).realized,-14);
  assert.throws(()=>U.statementRows(U.csvRows(csv.replace('2,0','2,'))),/amount/);
  assert.throws(()=>U.csvRows('"unterminated'),/Unclosed/);
  assert.throws(()=>accept(E.emptyBook(),payload(U.statementRows(U.csvRows(csv.replace('13 FEB','31 FEB'))))),/expiry/);
});

test('corrections preserve provenance and protect spreadsheet exports from formula injection',()=>{
  const b=accept(E.emptyBook(),{...payload([summary]),sourceName:'=synthetic'});
  const next=H.correct(b,b.history.records[0].id,{gross:0},'Rechecked amount');
  assert.equal(next.history.records[0].gross,0);
  assert.equal(next.history.revisions[0].record.gross,-26.12);
  assert.match(H.csv(next),/"'=synthetic"/);
  assert.throws(()=>H.validate({...next.history,records:[next.history.records[0],next.history.records[0]]},next),/Duplicate/);
});

test('revised broker report retains row identity and independent file-content hash',()=>{
 const first={...payload([summary]),sourceId:'document-name-sha256:abc',sourceName:'HAL.xlsx',sourceHash:'sha256:'+'a'.repeat(64)};
 let b=accept(E.emptyBook(),first),corrected={...first,sourceHash:'sha256:'+'b'.repeat(64),records:[{...summary,gross:-30}]};
 const preview=H.previewImport(b,corrected);assert.equal(preview.additions.length,1);
 assert.equal(preview.conflicts.filter(c=>c.kind==='source-row').length,1);
 assert.throws(()=>H.applyImport(b,preview),/correct|skip/);
 b=H.applyImport(b,preview,{byConflict:{[choiceKey(preview.conflicts.find(c=>c.kind==='source-row'))]:'replace'}});
 assert.equal(b.history.records.length,1);assert.equal(H.totals(b).realized,-30);
 assert.equal(b.history.imports.at(-1).sourceHash,corrected.sourceHash);
 const unchanged={...corrected,sourceId:'document-name-sha256:renamed',sourceName:'HAL revised.xlsx'};
 assert.equal(H.previewImport(b,unchanged).duplicates.length,1);
});
test('legacy content-addressed source IDs remain recognized after an upgrade',()=>{
 const hash='sha256:'+'c'.repeat(64),first={...payload([summary]),sourceId:hash,sourceName:'Old.xlsx'};
 const b=accept(E.emptyBook(),first),updated={...first,sourceId:'document-name-sha256:old',sourceHash:hash,sourceName:'Renamed.xlsx'};
 assert.equal(H.previewImport(b,updated).duplicates.length,1);
});
test('recognized broker total footers do not block HAL summaries',()=>{
 const csv='Scrip Name,Quantity,Avg Buy Price,Avg Sell Price,Realized P&L\nHAL 13 FEB 25 90 Put,7,2,0,-14\nGrand Total,,,,-14\nNet Realised P&L,,,,-14';
 const rows=U.statementRows(U.csvRows(csv));assert.equal(rows.length,1);
 assert.equal(H.totals(accept(E.emptyBook(),payload(rows))).realized,-14);
 assert.throws(()=>U.statementRows(U.csvRows(csv.replace('Grand Total','Unidentified contract'))),/Unrecognised/);
});
