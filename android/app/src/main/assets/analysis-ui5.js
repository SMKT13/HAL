/* HAL Desk 5: read-only analysis UI. Generated prose is escaped before insertion. */
'use strict';
window.createHalAnalysis=function createHalAnalysis(api){
 const {get,esc,when,money,num,card,btn,row,empty}=api;
 function report(){return window.HAL5Analysis.build(get(),Date.now());}
 const resultClass=r=>r.verdict.indexOf('Bearish')===0?'analysis-down':r.verdict.indexOf('Constructive')===0?'analysis-up':'analysis-mixed';
 const mark=s=>'<span class="analysis-tag">'+esc(s)+'</span>';
 const narrate=s=>'<p class="analysis-copy">'+esc(s)+'</p>';
 function preview(){
  const r=report();
  return card('HAL · What the evidence means',
   '<div class="analysis-preview '+resultClass(r)+'"><span class="eyebrow">Daily analysis · '+esc(r.date||'date unavailable')+'</span>'+
   '<h3>'+esc(r.title)+'</h3>'+narrate(r.summary)+
   '<p class="fine">'+esc(r.quality)+' · '+esc(r.verdict)+'</p>'+
   btn('go-analysis','Read the complete analysis →','class="primary"')+'</div>');
 }
 function signalView(s){
  let v=s.value===null||s.value===undefined?'—':s.label.indexOf('SMA')!==-1?money(s.value):s.label.indexOf('Volume')!==-1?num(s.value,2)+'×':num(s.value,2);
  return '<div class="analysis-signal"><div class="analysis-signal-title"><strong>'+esc(s.label)+'</strong><b>'+esc(v)+'</b></div><div>'+mark(s.reading)+'</div><p class="fine">'+esc(s.interpretation)+'</p></div>';
 }
 function levels(title,levels){
  return '<section class="analysis-level-list"><h3>'+esc(title)+'</h3>'+
   (levels.length?levels.map(x=>'<div class="analysis-level"><strong>'+esc(money(x.price))+'</strong><span>'+esc(x.label)+'</span></div>').join(''):empty('Insufficient validated levels'))+'</section>';
 }
 function position(r){
  const p=r.position;
  if(!p.hasBook)return card('Your hedge & exposure',empty('No saved holdings','Connect your own broker book to see expiry risks here. No sample positions are assumed.'));
  return card('Your hedge & exposure',
   (!p.confirmed?'<p class="warning">Saved positions need confirmation against the broker.</p>':'')+
   '<div class="analysis-grid">'+
   '<div class="analysis-stat"><small>Futures shares</small><strong>'+esc(num(p.futureUnits,0))+'</strong></div>'+
   '<div class="analysis-stat"><small>Put shares</small><strong>'+esc(num(p.putUnits,0))+'</strong></div>'+
   '<div class="analysis-stat"><small>Nominal coverage</small><strong>'+esc(p.coverage===null?'Unavailable':num(p.coverage)+'%')+'</strong></div>'+
   '<div class="analysis-stat"><small>Verified open P&L</small><strong>'+esc(p.openPnl===null?'Withheld':money(p.openPnl))+'</strong></div></div>'+
   row('Earliest active put expiry',p.earliestPut||'No active put')+
   row('Nearest active future expiry',p.nextFuture||'No active future')+
   (p.putStrikes.length?'<p class="fine">Recorded puts: '+esc(p.putStrikes.map(x=>(x.strike==null?'Unspecified strike':money(x.strike))+' · '+x.units+' shares · '+x.expiry).join(' | '))+'</p>':'')+
   p.messages.map(x=>'<div class="analysis-review">'+esc(x)+'</div>').join('')+
   '<p class="fine">P&L requires confirmed holdings and complete current, non-manual, non-cached exact-contract marks. No futures P&L is estimated from HAL cash price.</p>'+
   btn('go-hedge','Review replacement hedge','class="text-button"')+
   btn('go-risk','Full position risk','class="text-button"'));
 }
 function view(){
  const r=report();
  const header='<div class="analysis-report-head '+resultClass(r)+'"><span class="eyebrow">Evidence-led daily report · HAL NSE</span>'+
   '<h2>'+esc(r.title)+'</h2><strong>'+esc(r.verdict)+'</strong>'+narrate(r.summary)+
   '<div class="analysis-tags">'+mark(r.quality)+mark('As of '+(r.date||'unavailable'))+'</div>'+
   '<div class="analysis-grid"><div class="analysis-stat"><small>Completed daily close</small><strong>'+esc(money(r.price))+'</strong></div>'+
   '<div class="analysis-stat"><small>Daily change</small><strong>'+esc(r.change===null?'Unavailable':money(r.change))+'</strong></div>'+
   '<div class="analysis-stat"><small>Daily %</small><strong>'+esc(r.changePct===null?'Unavailable':(r.changePct>=0?'+':'')+num(r.changePct)+'%')+'</strong></div>'+
   '<div class="analysis-stat"><small>Volume / 20-day avg</small><strong>'+esc(r.volumeRatio===null?'Unavailable':num(r.volumeRatio)+'×')+'</strong></div></div>'+
   '<div class="analysis-actions">'+btn('analysis-refresh','Refresh daily evidence','class="primary"')+'</div>'+
   '<p class="fine">Source: '+esc(r.source)+' · Last completed bar '+esc(when(r.asOf))+
   ' · Generated '+esc(when(r.generatedAt))+'</p></div>';
  if(!r.ready)return header+card('Analysis readiness',empty('Trend verdict withheld',r.caveats.join(' ')))+position(r);
  const levelsCard=card('Price levels that matter',
   '<p class="fine">Automatically derived from validated daily candles, recent extremes, pivots and available moving averages. Not order prices.</p>'+
   '<div class="analysis-grid analysis-level-grid">'+levels('Resistance ↑',r.levels.resistances)+levels('Support ↓',r.levels.supports)+'</div>');
  const scenarios=card('What would change the view?',
   r.scenarios.map(x=>'<article class="analysis-scenario '+esc('analysis-'+x.kind)+'"><h3>'+esc(x.title)+'</h3>'+
    '<strong>'+esc(x.trigger)+'</strong>'+narrate(x.interpretation)+
    '<p class="fine">Next observation: '+esc(x.next)+'</p></article>').join(''));
  const news=card('News & business implications',
   r.headlines.length?r.headlines.map(x=>'<article class="analysis-news"><div class="fine">'+esc(x.official?'Official filing · ':'')+esc(x.source)+' · '+esc(when(x.publishedAt))+'</div>'+
    '<h3>'+esc(x.title)+'</h3>'+narrate(x.interpretation)+
    (typeof x.url==='string'&&/^https:\/\//i.test(x.url)?btn('link','Open original source','data-url="'+esc(x.url)+'" class="text-button"'):'')+'</article>').join('')+
    '<p class="fine">Headline relevance is a review prompt, not a claim that news caused the price movement.</p>':
    empty('No dated news available','Connect and refresh the official filings and news sources. The app will not invent company results or announcements.'));
  const diagnostics=card('Evidence, source times & limitations',
   row('Candle date',r.date||'Unavailable')+row('Last completed candle',when(r.asOf))+
   row('Evidence generated',when(r.generatedAt))+
   '<p class="fine">'+esc(r.caveats.join(' · '))+'</p>');
  return header+
    card('Why this verdict?',r.signals.map(signalView).join(''))+
    levelsCard+scenarios+position(r)+news+diagnostics;
 }
 return {view,preview,report};
};
