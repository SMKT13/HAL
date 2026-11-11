(function historyViewsModule(root){
'use strict';
function csvRows(raw){
 const s=raw.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 function endField(){row.push(field.trim());field='';closed=false;}
 for(let i=0;i<s.length;i++){const c=s[i];
   if(quoted){if(c!=='"')field+=c;else if(s[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}continue;}
   if(c===',')endField();
   else if(c==='\r'||c==='\n'){if(c==='\r'&&s[i+1]==='\n')i++;endField();rows.push(row);row=[];}
   else if(c==='"'&&!field&&!closed)quoted=true;
   else if(c==='"'||closed&&c.trim())throw Error('Invalid quoted CSV field.');
   else field+=c;
 }
 if(quoted)throw Error('Unclosed CSV field.');
 if(field||closed||row.length){endField();rows.push(row);}
 return rows;
}
function numeric(x){
 const s=String(x??'').trim().replace(/^₹/,'').replace(/,/g,'');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)||!Number.isFinite(Number(s)))throw Error('Missing or invalid statement amount.');
 return Number(s);
}
function statementRows(rows){
 const result=[];let columns=null;const months='JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC'.split(' ');
 rows.forEach((r,i)=>{
   const fields=r.map(x=>String(x??'').trim());
   if(!fields.some(x=>x)||fields.slice(1).every(x=>!x)&&/^(Futures|Options)$/i.test(fields[0]))return;
   // Skip only recognizable broker summary footers, not unknown contract rows.
   if(/^(?:(?:grand|sub)\s+)?totals?(?:\s+(?:futures|options|realized|realised|p&l|profit|loss))?\s*:?$/i.test(fields[0])||/^net\s+(?:realized|realised)\s+(?:p&l|profit|loss)\s*:?$/i.test(fields[0]))return;
   if(/^scrip name$/i.test(fields[0])){
     columns=['scrip name','quantity','avg buy price','avg sell price','realized p&l'].map(c=>fields.findIndex(v=>v.toLowerCase().replace('realised','realized')===c));
     if(columns.includes(-1))throw Error('Expected Scrip Name, Quantity, Avg Buy Price, Avg Sell Price and Realized P&L.');
     return;
   }
   if(!columns)throw Error('HAL summary column headers are missing.');
   const [name,units,buy,sell,gross]=columns.map(c=>fields[c]);
   const m=/^HAL\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2}|\d{4})\s+(?:(\d+(?:\.\d+)?)\s+)?(Fut|Future|Futures|Put|Call|PE|CE)$/i.exec(name);
   if(!m)throw Error('Unrecognised HAL contract in row '+(i+1)+'.');
   const type=/^FUT/i.test(m[5])?'FUT':/^(PE|Put)$/i.test(m[5])?'PE':'CE';
   const expiry=(m[3].length===2?'20':'')+m[3]+'-'+String(months.indexOf(m[2].toUpperCase())+1).padStart(2,'0')+'-'+m[1].padStart(2,'0');
   result.push({sourceRow:String(i+1),type,contractMonth:expiry.slice(0,7),expiry,strike:m[4]?numeric(m[4]):null,units:numeric(units),entry:numeric(buy),exit:numeric(sell),gross:numeric(gross)});
 });
 return result;
}
function makeView(api){
 const {getBook,commit,render,modal,esc,money,num,date,row,table,card,btn,input,select,empty,native}=api;
 const H=root.HAL5History;
 const get=id=>document.getElementById(id);
 const field=id=>get(id)?.value??'';
 const number=id=>field(id).trim()===''?null:Number(field(id));
 let pending=null,type='all',year='all',page=0;
 function filters(){
   const records=getBook().history?.records||[];
   return records.filter(r=>(type==='all'||type===r.type)&&(year==='all'||year===r.contractMonth.slice(0,4))).slice().sort((a,b)=>b.contractMonth.localeCompare(a.contractMonth));
 }
 function view(){
   const book=getBook(),h=H.totals(book),years=[...new Set((book.history?.records||[]).map(r=>r.contractMonth.slice(0,4)))].sort().reverse();
   const filtered=filters(),last=Math.max(0,Math.ceil(filtered.length/25)-1);page=Math.min(Math.max(0,page),last);
   const records=filtered.slice(page*25,page*25+25);
   let totals=h.hasHistory?`<div class="hero-value ${h.net<0?'negative':'positive'}">${money(h.net)}</div><p class="fine">Realised result after recorded charges</p>`+row('Gross realised P&L',money(h.realized))+row('Recorded charges',money(h.charges))+row('Closed contract records',String(h.count))+
     (h.chargesConfirmed?row('Charge coverage through',date(book.history.charges.asOf)):'<p class="fine">Cumulative lifetime charge coverage is unconfirmed.</p>'):empty('No closed history','Import a HAL statement or record a completed close.');
   const list=records.map(r=>`<details><summary>${esc(r.contractMonth)} · ${esc(r.type==='FUT'?'Future':num(r.strike)+' '+r.type)} · ${money(r.gross)}</summary>${row('Units',num(r.units,0))}${row('Average buy / sell',money(r.entry)+' / '+money(r.exit))}${row('Execution date',r.date?date(r.date):'Not supplied')}${row('Source',r.source.name+' · '+r.source.row)}${btn('history-correct','Correct gross amount',`data-id="${esc(r.id)}" class="text-button"`)}</details>`).join('');
   return card('Lifetime history',totals)+card('History sources',`<div class="toolbar">${btn('history-import','Import statement','class="primary"')}${btn('history-charges','Lifetime charges')}${btn('history-csv','Export summaries CSV')}</div><p class="fine">Open one HAL contract-summary XLSX or CSV, or a HAL history JSON. Check overlaps and resulting totals before saving.</p>`)+
   (h.hasHistory?card('Gross result by instrument',table(['Futures','Puts','Calls'],[[money(h.byType.FUT),money(h.byType.PE),money(h.byType.CE)]])+(h.legacyGross?row('Unclassified legacy result',money(h.legacyGross)):'')):'')+
   card('Contract summaries',`<div class="form-grid">${select('history-type','Instrument',[['all','All'],['FUT','Futures'],['PE','Puts'],['CE','Calls']],type)}${select('history-year','Contract expiry year',[['all','All'],...years.map(y=>[y,y])],year)}</div>`+
     (list||empty('No matching imported summaries'))+(filtered.length>25?`<div class="toolbar">${btn('history-prev','Previous',page?'':'disabled')} ${page+1} / ${last+1} ${btn('history-next','Next',page<last?'':'disabled')}</div>`:''))+
   card('Reconciliation log',(book.history?.imports||[]).slice(-10).reverse().map(i=>row(date(i.date)+' · '+i.sourceName,i.added+' accepted, '+i.replaced+' replaced')).join('')+
     (book.history?.revisions||[]).slice(-10).reverse().map(r=>row(date(r.date)+' · '+r.reason,r.record?money(r.record.gross):money(r.charges.amount))).join('')+
     row('Detailed journal entries',String(book.journal.length))+btn('history-journal','Open journal & funding','class="text-button"'));
 }
 function charges(){
   const b=getBook(),c=b.history?.charges||{};
   modal('Lifetime HAL charges',input('history-fee','Cumulative expense (₹)',c.amount)+input('history-asof','Coverage through',c.asOf||root.HAL4Engine.istDate(Date.now()),'date')+input('history-source','Source',c.source||'User statement','text')+'<label><input type="checkbox" id="history-covers">This includes the legacy charges and all recorded HAL fees through the coverage date.</label>','Save cumulative charges',()=>{if(getBook()!==b)throw Error('The book changed. Reopen this form.');commit(H.setCharges(b,{amount:number('history-fee'),asOf:field('history-asof'),source:field('history-source')},get('history-covers').checked));});
 }
 function correct(button){
   const b=getBook(),r=b.history?.records.find(r=>r.id===button.dataset.id);
   if(!r)throw Error('The record is unavailable.');
   modal('Correct gross realised amount',row('Source',r.source.name+' · '+r.source.row)+input('history-gross','New reported gross P&L (₹)',r.gross)+input('history-reason','Reason for amendment','','text'),'Save amendment',()=>{if(getBook()!==b)throw Error('The ledger changed. Reopen this form.');commit(H.correct(b,r.id,{gross:number('history-gross')},field('history-reason')));});
 }
 function propose(){
   const {p,charges,legs}=pending;
   const choices={skipIncomingIds:[],byConflict:{}};
   p.conflicts.forEach((c,i)=>{const decision=field('his-conf-'+i);
     if(decision==='skip')choices.skipIncomingIds.push(c.incomingId);
     choices.byConflict[[c.kind,c.incomingId||'',c.id].join('\n')]=decision;
   });
   let next=H.applyImport(getBook(),p,choices);
   if(charges&&get('history-include-charges')?.checked)next=H.setCharges(next,charges,true);
   if(legs.length&&get('history-include-legs')?.checked){
     if(getBook().legs.length)throw Error('Open holdings already exist. Review them in Book.');
     next.legs=legs.map((l,i)=>{
       const expiry=field('history-expiry-'+i);
       if(!expiry||!expiry.startsWith(l.contractMonth+'-'))throw Error('Verify each exact open-contract expiry against your broker.');
       return root.HAL4Engine.validateLeg({id:'reviewed-'+i,type:l.type,lots:l.lots,lotSize:l.lotSize,entry:l.entry,strike:l.strike,expiry,manual:null,instrumentKey:null},i);
     });
     next.riskProfile.confirmedBook=null;next.riskProfile.confirmedAt=null;
   }
   return root.HAL4Engine.validateBook(next);
 }
 function effect(){
   const el=get('history-effect');if(!el||!pending)return;
   try{const before=H.totals(getBook()),after=H.totals(propose());el.innerHTML=row('Current → reviewed gross',money(before.realized)+' → '+money(after.realized))+row('Reviewed charges',money(after.charges))+row('Current → reviewed net',money(before.net)+' → '+money(after.net));}
   catch(e){el.textContent=e.message;}
 }
 function preview(data){
   const b=getBook();const packet=data.format==='HALDeskHistory';
   const payload=packet?data.payload:{sourceId:data.sourceId,sourceName:data.sourceName,sourceHash:data.sourceHash,mode:'incremental',records:statementRows(data.rows||csvRows(data.csv||''))};
   const p=H.previewImport(b,payload),charges=packet?data.charges:null,legs=packet?(data.openCandidates||[]):[];
   if(!Array.isArray(legs)||legs.length>100)throw Error('Invalid proposed open positions.');
   for(const l of legs){if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(l.contractMonth))throw Error('Invalid open contract month.');root.HAL4Engine.validateLeg({...l,expiry:l.contractMonth+'-01'});}
   pending={p,charges,legs};
   const conflicts=p.conflicts.map((c,i)=>{
     const incoming=p.additions.find(r=>r.id===c.incomingId);
     const options=[['','Choose how to reconcile']];
     if(c.incomingId)options.push(['skip','Skip incoming record']);
     if(c.kind!=='incoming')options.push(['replace','Count incoming result in place of existing result']);
     if(c.kind!=='source-row')options.push(['distinct','I verified separate trading activity']);
     return select('his-conf-'+i,(incoming?incoming.contractMonth+' '+incoming.type+' '+(incoming.strike??'')+' · ':'')+c.kind+' '+c.id,options,'');
   }).join('');
   const display=p.payload.records.map(r=>[r.contractMonth,r.type,r.strike??'—',r.units,money(r.gross),r.source.row]);
   const mode=select('history-mode','Report coverage',[['incremental','Incremental'],['cumulative','Cumulative']],payload.mode);
   modal('Review HAL history',row('Source',p.payload.sourceName)+mode+row('New or changed summaries',String(p.additions.length))+row('Already imported',String(p.duplicates.length))+
     (conflicts?'<h3>Review overlaps</h3>'+conflicts:'')+(p.warnings||[]).map(t=>'<p class="fine">'+esc(t)+'</p>').join('')+
     `<details><summary>Inspect ${display.length} contract summaries</summary>${table(['Month','Type','Strike','Units','Gross P&L','Source row'],display)}</details>`+
     (charges?`<label><input type="checkbox" id="history-include-charges">Apply ${esc(money(charges.amount))} cumulative HAL charges covering all recorded fees through ${esc(date(charges.asOf))}.</label>`:'')+
     (legs.length?`<details><summary>Review ${legs.length} proposed open positions</summary>${table(['Contract month','Contract','Lots × units','Entry'],legs.map(l=>[l.contractMonth,l.type==='FUT'?'Future':l.strike+' PE',l.lots+' × '+l.lotSize,money(l.entry)]))}${b.legs.length?'<p>Open holdings are already recorded in Book.</p>':legs.map((l,i)=>input('history-expiry-'+i,'Verified expiry · '+l.contractMonth+' '+(l.strike||'')+' '+l.type,'','date')).join('')+'<label><input id="history-include-legs" type="checkbox">I verified these open positions and dates against my broker. Add them to the empty book.</label>'}</details>`:'')+
     '<div id="history-effect" aria-live="polite"></div><label><input type="checkbox" id="history-reviewed">I reviewed the source and the resulting totals.</label>',
     'Save reviewed history',()=>{if(!get('history-reviewed').checked)throw Error('Review and confirm the totals.');const next=propose();commit(next);pending=null;});
   effect();
 }
 function change(id){
   if(id==='history-mode'&&pending){pending.p=H.previewImport(getBook(),{...pending.p.payload,mode:field(id)});effect();}
   if(id.startsWith('his-conf-')||id.startsWith('history-include-')||id.startsWith('history-expiry-'))effect();
   if(id==='history-type'||id==='history-year'){if(id==='history-type')type=field(id);else year=field(id);page=0;render();}
 }
 return {view,preview,change,actions:{'history-import':()=>native('importHistory'),'history-charges':charges,'history-correct':correct,'history-csv':()=>native('exportCSV',H.csv(getBook())),'history-prev':()=>{page--;render();},'history-next':()=>{page++;render();},'history-journal':()=>api.navigate('position','journal')}};
}
root.HALHistoryViews=makeView;
if(typeof module!=='undefined'&&module.exports)module.exports={csvRows,statementRows,makeView};
})(this);
