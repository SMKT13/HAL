(function historyModule(root) {
  'use strict';
  const limit = 12000;
  const copy = value => JSON.parse(JSON.stringify(value));
  const types = ['FUT', 'PE', 'CE'];
  function check(ok, message) { if (!ok) throw Error(message); }
  function text(value, name, max=240) {
    check(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'Invalid '+name+'.');
    return value.trim();
  }
  function amount(value, name, least=-1e12, greatest=1e12) {
    check(typeof value==='number' && Number.isFinite(value) && value>=least && value<=greatest, 'Invalid '+name+'.');
    return value;
  }
  function day(value) {return typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;}
  function list(v, name) { check(Array.isArray(v)&&v.length<=limit,'Invalid '+name+'.'); return v; }
  function paise(v) {return Math.sign(v)*Math.round((Math.abs(v)+Number.EPSILON)*100);}
  function total(values) { const sum=values.reduce((n,v)=>n+paise(v),0);check(Number.isSafeInteger(sum),'Ledger exceeds the supported accounting range.');return sum/100;}
  function nowDate(){return new Date(Date.now()+19800000).toISOString().slice(0,10);}
  function initial(){return {version:1,records:[],revisions:[],imports:[],excludedJournalIds:[],excludeLegacyRealized:false,charges:null};}
  function validateRecord(r) {
    check(r && types.includes(r.type) && /^\d{4}-(0[1-9]|1[0-2])$/.test(r.contractMonth),'Invalid historical contract type or month.');
    check(r.expiry==null || day(r.expiry)&&r.expiry.slice(0,7)===r.contractMonth,'Invalid historical expiry.');
    check(r.date==null || day(r.date),'Invalid historical close date.');
    check(Number.isSafeInteger(r.units)&&r.units>0&&r.units<=1e9,'Historical units must be a positive whole number.');
    if(r.type==='FUT')check(r.strike==null,'A future cannot have a put or call strike.');else amount(r.strike,'option strike',0.000001,1e7);
    const source={id:text(r.source?.id,'source ID',160),name:text(r.source?.name,'source name'),row:text(r.source?.row,'source row',100)};
    const id=encodeURIComponent(source.id)+'/'+encodeURIComponent(source.row);
    check(r.id===id,'Source row identity mismatch.');
    return {id,type:r.type,contractMonth:r.contractMonth,expiry:r.expiry??null,date:r.date??null,strike:r.strike??null,units:r.units,entry:r.entry==null?null:amount(r.entry,'entry price',0,1e7),exit:r.exit==null?null:amount(r.exit,'exit price',0,1e7),gross:total([amount(r.gross,'gross realised P&L')]),source,note:typeof r.note==='string'?r.note.slice(0,1000):''};
  }
  function chargesRecord(c){
    if(c==null)return null;
    check(day(c.asOf)&&c.coversExisting===true,'A cumulative charge statement requires an inclusive date and coverage confirmation.');
    return {amount:total([amount(c.amount,'lifetime charges',0)]),asOf:c.asOf,source:text(c.source,'charge source'),coversExisting:true};
  }
  function validate(h, book){
    if(h==null)return initial();
    check(h.version===1,'Unsupported history format.');
    const records=list(h.records,'history records').map(validateRecord);
    check(new Set(records.map(r=>r.id)).size===records.length,'Duplicate historical source rows.');
    const closes=new Set((book.journal||[]).filter(j=>j.kind==='close').map(j=>j.id));
    const excluded=list(h.excludedJournalIds??[],'reconciled journal IDs').map(id=>text(id,'journal ID',100));
    check(excluded.every(id=>closes.has(id))&&new Set(excluded).size===excluded.length,'Missing or duplicate reconciled journal close.');
    check(h.excludeLegacyRealized==null||typeof h.excludeLegacyRealized==='boolean','Invalid legacy reconciliation.');
    const revisions=list(h.revisions??[],'history amendments').map(a=>{
      check(day(a.date)&&!!a.record!==!!a.charges,'Invalid history amendment.');
      return {date:a.date,reason:text(a.reason,'amendment reason',500),...(a.record?{record:validateRecord(a.record)}:{charges:chargesRecord(a.charges)})};
    });
    const imports=list(h.imports??[],'history import log').map(a=>{
      check(day(a.date)&&['incremental','cumulative'].includes(a.mode)&&Number.isInteger(a.added)&&a.added>=0&&Number.isInteger(a.replaced)&&a.replaced>=0,'Invalid history import log.');
      check(a.sourceHash==null||/^sha256:[a-f0-9]{64}$/.test(a.sourceHash),'Invalid source content hash.');
      return {date:a.date,mode:a.mode,sourceName:text(a.sourceName,'source name'),sourceId:text(a.sourceId,'source ID',160),added:a.added,replaced:a.replaced,...(a.sourceHash?{sourceHash:a.sourceHash}:{})};
    });
    return {version:1,records,revisions,imports,excludedJournalIds:excluded,excludeLegacyRealized:h.excludeLegacyRealized===true,charges:chargesRecord(h.charges)};
  }
  function totals(book) {
    const h=book.history||initial(),excluded=new Set(h.excludedJournalIds);
    const byType={FUT:0,PE:0,CE:0},journal=book.journal||[];
    const legacyGross=h.excludeLegacyRealized?0:book.legacy?.realized??0;
    const gross=[legacyGross],fees=[h.charges?.amount??book.legacy?.costs??0];
    let count=0;
    function record(type,value){gross.push(value);byType[type]+=paise(value);count++;}
    h.records.forEach(r=>record(r.type,r.gross));
    for(const j of journal){
      if(j.kind==='close'&&!excluded.has(j.id))record(j.leg.type,(j.exit-j.leg.entry)*j.leg.lots*j.leg.lotSize);
      if(!h.charges||j.date>h.charges.asOf){if(j.kind==='close')fees.push(j.fees);if(j.kind==='fee')fees.push(j.amount);}
    }
    types.forEach(t=>byType[t]/=100);
    const realized=total(gross),charges=total(fees);
    return {realized,charges,net:total([realized,-charges]),byType,count,legacyGross,chargesConfirmed:!!h.charges,hasHistory:!!(count||h.charges||book.legacy||charges)};
  }
  function normalized(payload){
    check(payload&&['incremental','cumulative'].includes(payload.mode),'Choose incremental or cumulative source coverage.');
    const sourceId=text(payload.sourceId,'source ID',160),sourceName=text(payload.sourceName,'source name');
    check(payload.sourceHash==null||/^sha256:[a-f0-9]{64}$/.test(payload.sourceHash),'Invalid statement content hash.');
    const records=list(payload.records,'history report').map((r,i)=>{
      const row=String(r.sourceRow??r.source?.row??i+1);
      const source={id:sourceId,name:sourceName,row};
      return validateRecord({...r,id:encodeURIComponent(sourceId)+'/'+encodeURIComponent(row),source});
    });
    check(records.length&&new Set(records.map(r=>r.id)).size===records.length,'A report must have unique source rows.');
    return {sourceId,sourceName,sourceHash:payload.sourceHash??null,mode:payload.mode,records};
  }
  function economic(r){return JSON.stringify([r.type,r.contractMonth,r.expiry,r.strike,r.units,r.entry,r.exit,r.gross,r.date]);}
  function key(r){return [r.type,r.contractMonth,r.strike??''].join('|');}
  function fingerprint(b){return JSON.stringify([b.revision,b.history,b.legacy,b.journal]);}
  function previewImport(book,raw) {
    const payload=normalized(raw),h=book.history||initial(),additions=[],duplicates=[],conflicts=[],warnings=[];
    const index=new Map();
    function indexRow(r,kind){const k=key(r),entries=index.get(k)||[];entries.push({kind,id:r.id,expiry:r.expiry});index.set(k,entries);}
    h.records.forEach(r=>indexRow(r,'history'));
    const excluded=new Set(h.excludedJournalIds),prior=new Map(h.records.map(r=>[r.id,r]));
    const sameNamedRow=new Map();
    for(const old of h.records){const k=old.source.name.trim().toLocaleLowerCase()+'\n'+old.source.row;const group=sameNamedRow.get(k)||[];group.push(old);sameNamedRow.set(k,group);}
    // Earlier versions used the whole-file hash as the source ID. Recognize that
    // identity and an already imported content hash without guessing trade dates.
    const sourceAliases=new Set(h.imports.filter(i=>payload.sourceHash&&i.sourceHash===payload.sourceHash).map(i=>i.sourceId));
    if(payload.sourceHash)sourceAliases.add(payload.sourceHash);
    for(const j of book.journal||[])if(j.kind==='close'&&!excluded.has(j.id))indexRow({...j.leg,id:j.id,contractMonth:j.leg.expiry.slice(0,7)},'journal');
    for(const r of payload.records){
      const named=sameNamedRow.get(r.source.name.trim().toLocaleLowerCase()+'\n'+r.source.row)||[];
      const aliases=h.records.filter(old=>sourceAliases.has(old.source.id)&&old.source.row===r.source.row);
      const previous=prior.get(r.id)||(aliases.length===1?aliases[0]:null)||(named.length===1?named[0]:null);
      if(previous&&economic(previous)===economic(r)){duplicates.push(r);continue;}
      additions.push(r);
      if(previous)conflicts.push({kind:'source-row',incomingId:r.id,id:previous.id});
      for(const other of index.get(key(r))||[]){
        if(other.id===r.id||previous&&other.id===previous.id||r.expiry&&other.expiry&&other.expiry!==r.expiry)continue;
        conflicts.push({kind:other.kind,incomingId:r.id,id:other.id});
        check(conflicts.length<=limit,'Report contains too many ambiguous overlaps. Split it into smaller reviewed batches.');
      }
      indexRow(r,'incoming');
    }
    if(additions.length&&!h.excludeLegacyRealized&&book.legacy&&(book.legacy.realized!==0||book.legacy.journal?.some(j=>j.kind==='close')))conflicts.push({kind:'legacy',id:'legacy',incomingId:null});
    if(payload.mode==='cumulative'&&h.records.some(r=>r.source.id===payload.sourceId&&!payload.records.some(p=>p.id===r.id)))warnings.push('Previously accepted rows omitted from this statement will be retained.');
    return {payload,fingerprint:fingerprint(book),additions,duplicates,conflicts,warnings};
  }
  function applyImport(book,preview,choices={}) {
    check(preview.fingerprint===fingerprint(book),'The ledger changed. Reopen the import preview.');
    const p=previewImport(book,preview.payload),skip=new Set(choices.skipIncomingIds||[]),replace=new Set(),excluded=new Set();
    const pending=p.additions.filter(r=>!skip.has(r.id));
    if(!pending.length)return copy(book);
    for(const c of p.conflicts){
      if(skip.has(c.incomingId)||c.kind==='incoming'&&skip.has(c.id))continue;
      const uid=[c.kind,c.incomingId||'',c.id].join('\n'),choice=choices.byConflict?.[uid];
      if(c.kind==='source-row')check(choice==='replace','Choose whether to correct the changed source row or skip it.');
      else check(choice==='replace'&&c.kind!=='incoming'||choice==='distinct','Resolve each overlapping record.');
      if(choice==='replace'&&['history','source-row'].includes(c.kind))replace.add(c.id);
      if(choice==='replace'&&c.kind==='journal')excluded.add(c.id);
    }
    const next=copy(book),h=next.history||initial();
    for(const r of h.records.filter(r=>replace.has(r.id)))h.revisions.push({date:nowDate(),reason:'Reconciled against '+p.payload.sourceName,record:r});
    h.records=h.records.filter(r=>!replace.has(r.id)).concat(pending);
    h.excludedJournalIds=[...new Set(h.excludedJournalIds.concat([...excluded]))];
    if(choices.byConflict?.['legacy\n\nlegacy']==='replace')h.excludeLegacyRealized=true;
    h.imports.push({date:nowDate(),sourceId:p.payload.sourceId,sourceName:p.payload.sourceName,mode:p.payload.mode,added:pending.length,replaced:replace.size,...(p.payload.sourceHash?{sourceHash:p.payload.sourceHash}:{})});
    next.history=validate(h,next);return next;
  }
  function setCharges(book,statement,confirmed){
    check(confirmed===true,'Confirm that the cumulative amount includes all HAL transaction fees through this date.');
    const c=chargesRecord({...statement,coversExisting:true});
    check(c.asOf<=nowDate(),'The charge statement date is in the future.');
    const current=book.history?.charges;
    if(current)check(c.asOf>=current.asOf,'Use the current or a later coverage date when replacing a cumulative statement.');
    const known=total([book.legacy?.costs??0,...(book.journal||[]).filter(j=>j.date<=c.asOf).map(j=>j.kind==='close'?j.fees:j.kind==='fee'?j.amount:0)]);
    check(c.amount>=known,'The stated total is less than the already itemised charges in its coverage.');
    const next=copy(book),h=next.history||initial();
    if(current&&JSON.stringify(current)===JSON.stringify(c))return next;
    if(current)h.revisions.push({date:nowDate(),reason:'Previous cumulative fee statement',charges:current});
    h.charges=c;next.history=validate(h,next);return next;
  }
  function correct(book,id,patch,reason){
    const next=copy(book),h=next.history,i=h?.records.findIndex(r=>r.id===id);
    check(Number.isInteger(i)&&i>=0,'The historical record is unavailable.');
    const old=h.records[i],updated=validateRecord({...old,...patch,source:old.source,id:old.id});
    h.revisions.push({date:nowDate(),reason:text(reason,'correction reason',500),record:old});h.records[i]=updated;
    next.history=validate(h,next);return next;
  }
  function csv(book){
    const rows=[['Source','Source row','Type','Contract month','Contract expiry','Close date','Units','Strike','Average buy','Average sell','Reported gross P&L']];
    for(const r of book.history?.records||[])rows.push([r.source.name,r.source.row,r.type,r.contractMonth,r.expiry,r.date,r.units,r.strike,r.entry,r.exit,r.gross]);
    const safe=x=>{let s=String(x??'');if(typeof x==='string'&&/^\s*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    return rows.map(row=>row.map(safe).join(',')).join('\r\n');
  }
  const api={validate,totals,previewImport,applyImport,setCharges,correct,csv};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HAL5History=api;
})(this);
