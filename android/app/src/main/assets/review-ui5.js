'use strict';
window.createHalReview = function createHalReview(api){
 const {get,render,select,table,row,card,btn,empty,esc,money,num,when,native}=api;
 let selected='since-review';
 function view(){
   const {book,evidence,sessionBaseline}=get(), points=book.checkpoints.slice();
   if(sessionBaseline)points.push(sessionBaseline);
   const {reviewPeriods,reviewSummary}=window.HAL4Workflow;
   const now=Date.now(),choices=reviewPeriods(now).map(r=>[r.id,r.label]),r=reviewSummary(typeof evidence==='function'?evidence():evidence,points,selected,now);
   const period=select('review-period','Review window · IST',choices,selected);
   const range=r.start?row('Period begins',when(r.start))+row(r.toDate?'Through':'Period ends before',when(r.end)):'';
   const rangePanel=card('Review window',period+range+`<div class="toolbar">${btn('checkpoint','Save checkpoint')}${btn('print-review','Print / save PDF')}</div>`);
   const diagnostic=r.warnings.map(w=>'<p class="fine">'+esc(w)+'</p>').join('');
   let financial;
   if(r.ready){
     const values=r.changes;
     const moves=[
       ['HAL spot',money(values.spot)],['Open P&L · comparable holdings',money(values.open)],
       ['Gross realised P&L',money(values.realized)],['Recorded charges',money(values.charges)],
       ['Realised after charges',money(values.bookedNet)],['Strategy net · includes open P&L',money(values.net)],
       ['Futures units',num(values.futureUnits,0)],['Protective put units',num(values.putUnits,0)],
       ['Quantity coverage',Number.isFinite(values.coverage)?num(values.coverage)+' percentage points':'Unavailable'],
       ['RSI 14',num(values.rsi)],['ATR 14',money(values.atr)],
       ['Reported margin',money(values.margin)],['Reported free funds',money(values.free)]
     ];
     financial=card('Changes between observations',
       row('First checkpoint',when(r.from))+row('Last observation',when(r.to))+
       r.summary.map(t=>'<p>'+esc(t)+'</p>').join('')+
       table(['Measure','Change'],moves)+
       `<details><summary>Evidence dates and coverage</summary>${row('First spot quote',when(r.fromQuote))}${row('Last spot quote',when(r.toQuote))}${row('Last technical observation',when(r.technicalAt))}${row('Last funding snapshot',when(r.fundingAt))}${diagnostic}</details>`);
   }else financial=card('Changes between observations',empty('Comparison unavailable',r.reason));
   const stories=r.news.map(n=>`<article class="news-item"><h3>${esc(n.title)}</h3>${row('Published',when(n.publishedAt))}${row('Source',n.source||'Unspecified')}${n.eventDate?row('Event date',n.eventDate):''}${n.official?'<p>Official filing</p>':''}${btn('link','Read source',`data-url="${esc(n.url)}" class="text-button"`)}</article>`).join('');
   const news=card('News published in this period',stories||empty('No dated headlines in the available observations','Coverage depends on the loaded news feed and saved checkpoints.'));
   return rangePanel+financial+news;
 }
 function change(id){if(id==='review-period'){selected=document.getElementById(id).value;render();}}
 return {view,change,actions:{'print-review':()=>native('printReview')}};
};
