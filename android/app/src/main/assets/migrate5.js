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

/* Import is deliberately a full replacement, not a merge. This preview
 * reveals existing records that would be discarded/altered without displaying
 * journal notes or account-specific values in the summary. Never saves. */
function replacement(current,incoming){
 const old=E.validateBook(current),next=E.validateBook(incoming);
 const groups=[
  ['Open positions',old.legs,next.legs],
  ['Completed journal entries',old.journal,next.journal],
  ['Historical broker rows',old.history?.records||[],next.history?.records||[]],
  ['Private notes',old.notes,next.notes],
  ['Bookmarks',old.bookmarks,next.bookmarks],
  ['Checkpoints',old.checkpoints,next.checkpoints]
 ];
 const changes=groups.map(([name,previous,replacement])=>{
  const previousById=new Map(previous.map((x,i)=>[x.id??'row-'+i,x]));
  const nextById=new Map(replacement.map((x,i)=>[x.id??'row-'+i,x]));
  let removed=0,modified=0;
  for(const [id,item]of previousById){
   if(!nextById.has(id))removed++;
   else if(JSON.stringify(item)!==JSON.stringify(nextById.get(id)))modified++;
  }
  return {section:name,before:previous.length,after:replacement.length,removed,modified};
 });
 const oldLedger=E.ledger(old),newLedger=E.ledger(next);
 const oldTotals={gross:oldLedger.realized,fees:oldLedger.charges},
  newTotals={gross:newLedger.realized,fees:newLedger.charges};
 const changedGross=Math.abs(oldTotals.gross-newTotals.gross)>.005;
 const changedFees=Math.abs(oldTotals.fees-newTotals.fees)>.005;
 const oldCumulative=old.history?.charges??null,newCumulative=next.history?.charges??null;
 const chargeStatementChanged=JSON.stringify(oldCumulative)!==JSON.stringify(newCumulative);
 const oldReview=old.riskProfile??{},newReview=next.riskProfile??{};
 const ignoreConfirmation=x=>{const y={...x};delete y.confirmedAt;delete y.confirmedBook;return y;};
 const riskLimitsChanged=JSON.stringify(ignoreConfirmation(oldReview))!==JSON.stringify(ignoreConfirmation(newReview));
 const warnings=[];
 if(changes.some(g=>g.removed||g.modified))warnings.push('Existing saved records would be removed or changed');
 if(changedGross||changedFees)warnings.push('Booked realized P&L or recorded lifetime charges differ');
 if(chargeStatementChanged)warnings.push('Cumulative lifetime charge coverage differs');
 if(riskLimitsChanged)warnings.push('Saved risk limits or risk profile would change');
 if(JSON.stringify(old.funding)!==JSON.stringify(next.funding))warnings.push('Funding snapshot would be replaced');
 if(JSON.stringify(old.migration)!==JSON.stringify(next.migration))warnings.push('Migration references would change');
 const destructive=warnings.length>0;
 return {destructive,requiresTypedConfirmation:destructive,
  current:{legs:old.legs.length,journal:old.journal.length,history:(old.history?.records||[]).length,
    notes:old.notes.length,bookmarks:old.bookmarks.length,
    realizedGross:oldTotals.gross,recordedCharges:oldTotals.fees,bookedNet:oldTotals.gross-oldTotals.fees},
  incoming:{legs:next.legs.length,journal:next.journal.length,history:(next.history?.records||[]).length,
    notes:next.notes.length,bookmarks:next.bookmarks.length,
    realizedGross:newTotals.gross,recordedCharges:newTotals.fees,bookedNet:newTotals.gross-newTotals.fees},
  changes,warnings,
  note:'Preview only. A backup import overwrites the current book, not a merge; the current data remains untouched until the user confirms and storage commits.'};
}

const api={audit,replacement};
if(typeof module==='object'&&module.exports)module.exports=api;
root.HAL5MigrationGuard=api;
})(typeof globalThis!=='undefined'?globalThis:this);
