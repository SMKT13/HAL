/* HAL Desk 5 — read-only schema-4 upgrade acceptance guard.
   Compares normalized persisted economic records, never replaces SQLite books.
   Intended for release/migration QA; not an app-data writer or import operation. */
(function(root){'use strict';
const E=typeof module==='object'?require('./engine4.js'):root.HAL4Engine;
const groups=['legs','journal','history','legacy','notes','bookmarks',
 'checkpoints','funding','preferences','hedge','migration','legacyRolloverPreferences'];
function normalized(book){
 if(!book||book.version!==4)throw Error('Upgrade audit requires schema-4 books');
 const clean=E.validateBook(book);
 const selected={};
 for(const group of groups)selected[group]=clean[group]===undefined?null:clean[group];
 // Broker confirmation is intentionally reset on reviewed imports; risk limits
 // must remain identical but an old confirmation is never silently carried over.
 const rp={...clean.riskProfile};
 delete rp.confirmedAt;delete rp.confirmedBook;
 selected.riskProfileLimits=rp;
 const valuation=E.ledger(clean);
 const total={realizedGross:valuation.realized,recordedCharges:valuation.charges,
  bookedNet:valuation.realized-valuation.charges};
 return {selected,total,counts:{openLegs:clean.legs.length,
  journalEntries:clean.journal.length,notes:clean.notes.length,
  checkpoints:clean.checkpoints.length,historyRecords:clean.history?.records?.length||0}};
}
function audit(before,after){
 const a=normalized(before),b=normalized(after);
 const changed=[];
 for(const group of Object.keys(a.selected)){
  if(JSON.stringify(a.selected[group])!==JSON.stringify(b.selected[group]))changed.push(group);
 }
 for(const k of Object.keys(a.total)){
  if(!Number.isFinite(a.total[k])||!Number.isFinite(b.total[k])||
      Math.abs(a.total[k]-b.total[k])>0.005)changed.push(k);
 }
 return {safe:changed.length===0,changed:[...new Set(changed)],
  before:a.counts,after:b.counts,
  financialTotalsMatch:Object.keys(a.total).every(k=>
   Number.isFinite(a.total[k])&&Number.isFinite(b.total[k])&&Math.abs(a.total[k]-b.total[k])<=0.005),
  note:'Review-only acceptance check. Never copy, overwrite, merge or auto-confirm a saved book based on this report.'};
}
const api={audit};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5MigrationGuard=api;
})(typeof globalThis!=='undefined'?globalThis:this);
