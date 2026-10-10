'use strict';
const H = HalPortfolio;
const el = id => document.getElementById(id);
const finite = n => typeof n === 'number' && Number.isFinite(n);
const fmt = n => finite(n) ? n.toLocaleString('en-IN', {maximumFractionDigits: 2}) : '—';
const fmt0 = n => finite(n) ? Math.round(n).toLocaleString('en-IN') : '—';
const signed = n => finite(n) ? (n >= 0 ? '+' : '−') + '₹' + fmt0(Math.abs(n)) : 'Unavailable';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp = s => s && Number.isFinite(Date.parse(s)) ? new Date(s).toLocaleString('en-IN', {timeZone:'Asia/Kolkata'}) + ' IST' : 'Time not supplied';
const STORAGE = 'halpos3';
let DATA = null, loading = false, position = loadPosition();

function loadPosition() {
  try {
    const saved = localStorage.getItem(STORAGE) || localStorage.getItem('halpos2');
    return H.normalize(saved ? JSON.parse(saved) : {});
  } catch (error) {
    el('position-status').textContent = 'Saved position could not be read. Original repository values are shown; verify them before saving.';
    return H.normalize();
  }
}
function fillPosition() {
  for (const key of Object.keys(H.defaults)) {
    const input = el(key);
    if (input) input.value = position[key] ?? '';
  }
}
function savePosition(event) {
  const next = Object.assign({}, position);
  for (const key of Object.keys(H.defaults)) {
    const input = el(key);
    if (!input) continue;
    if (key.endsWith('expiry')) next[key] = input.value;
    else next[key] = input.value.trim() === '' ? (key.endsWith('mark') ? null : NaN) : Number(input.value);
  }
  const error = H.validate(next);
  if (error) {
    el('position-status').textContent = error + ' The last valid position remains in use.';
    return;
  }
  if (event && event.target.id.endsWith('mark')) next[event.target.id + 'At'] =
    next[event.target.id] === null ? null : new Date().toISOString();
  position = next;
  try {
    localStorage.setItem(STORAGE, JSON.stringify(position));
    el('position-status').textContent = 'Saved on this browser. Quantities are units; zero closes a leg.';
  } catch (error) {
    el('position-status').textContent = 'Storage unavailable. Changes work for this session only; export a backup.';
  }
  pos();
}
function usable(data) {
  if (!(data && finite(data.quote?.price) && data.quote.price > 0 &&
    data.ind && data.levels && data.series && Array.isArray(data.daily) && data.daily.length >= 2)) return false;
  const count = Math.min(130, data.daily.length);
  return data.daily.every(bar => H.validDate(bar.d) && ['o','h','l','c'].every(key => finite(bar[key]) && bar[key] > 0)) &&
    ['sma20','sma50','sma200','rsi','macd','sig','hist'].every(key =>
      Array.isArray(data.series[key]) && data.series[key].length >= count &&
      data.series[key].every(value => value === null || finite(value)));
}
async function load(force = false) {
  if (loading) return;
  loading = true;
  el('refresh').disabled = true;
  el('upd').textContent = 'Refreshing market data…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch('/api/data' + (force ? '?force=1' : ''), {signal:controller.signal, cache:'no-store'});
    if (!response.ok) throw new Error('Market API unavailable');
    const next = await response.json();
    if (!usable(next)) throw new Error('Incomplete market payload');
    DATA = next;
  } catch (error) {
    if (DATA) DATA = Object.assign({}, DATA, {stale:true, data_status:DATA.snapshot_mode ? 'snapshot' : 'stale'});
    else if (usable(window.HAL_SNAPSHOT)) DATA = Object.assign({}, window.HAL_SNAPSHOT,
      {stale:true, snapshot_mode:true, data_status:'snapshot'});
  } finally {
    clearTimeout(timer);
    loading = false;
    el('refresh').disabled = false;
  }
  if (DATA) render();
  else {
    el('upd').textContent = 'Market data unavailable. Retry when the server is reachable.';
    el('quality').textContent = 'No usable quote or saved snapshot.';
    pos();
  }
}
function render() {
  const d = DATA, q = d.quote, i = d.ind, l = d.levels;
  const change = finite(q.prev_close) && q.prev_close > 0 ? q.price - q.prev_close : null;
  el('px').textContent = '₹' + fmt(q.price);
  el('px').style.color = change === null ? 'var(--tx)' : change >= 0 ? 'var(--grn)' : 'var(--red)';
  el('chg').textContent = (change === null ? 'Change unavailable' :
    signed(change) + ' (' + (change / q.prev_close * 100).toFixed(2) + '%)') +
    ' · O ' + fmt0(q.open) + ' / H ' + fmt0(q.day_high) + ' / L ' + fmt0(q.day_low);
  const mode = d.snapshot_mode ? 'ARCHIVED SNAPSHOT' : d.stale ? 'STALE CACHE' :
    d.data_status === 'cached' ? 'CACHED FEED' : 'DELAYED FEED';
  el('data-badge').textContent = mode;
  el('data-badge').className = 'chip ' + (d.stale || d.snapshot_mode ? 'y' : 'g');
  el('upd').textContent = 'Retrieved: ' + (d.fetched_at || stamp(d.fetched_at_iso));
  el('mkt').textContent = 'Provider session: ' + (d.market_state || 'Unknown') + ' · refresh every 5 min';
  const session = d.last_session || d.daily.at(-1).d;
  const age = d.quote_as_of ? Math.max(0, (Date.now() - Date.parse(d.quote_as_of)) / 3600000) : null;
  el('quality').textContent = (d.snapshot_mode ? 'Offline fallback. Historical values, not current prices. ' :
    d.stale ? 'Refresh failed. Showing the last successful response. ' : '') +
    'Quote time: ' + stamp(d.quote_as_of) + ' · latest daily bar: ' + session +
    (finite(age) ? ' · quote age: ' + age.toFixed(1) + 'h' : '') +
    (d.provisional_bar ? ' · today’s bar is provisional' : '') +
    '. Quotes may be delayed; a successful refresh does not guarantee a new trade. ' +
    (d.cache_write_failed ? 'The server could not save its offline cache.' : '');
  const one = n => finite(n) ? n.toFixed(1) : '—';
  el('qk').innerHTML = [
    ['52W high',fmt0(q.w52h)], ['52W low',fmt0(q.w52l)], ['RSI · 14',one(i.rsi14)],
    ['MFI · 14',one(i.mfi14)], ['ATR · 14',one(i.atr14)],
    ['Realized vol · 20d',finite(i.ann_vol_realized) ? one(i.ann_vol_realized) + '%' : '—']
  ].map(([label,value]) => `<div class="kpi"><b>${value}</b><span class="sm mut">${label}</span></div>`).join('');
  const rows = [
    ['SMA 20', '20-session trend reference', l.gate],
    ['SMA 50', '50-session trend reference', l.stop],
    ['SMA 200', 'Long-term trend reference', i.sma200],
    ['Pivot', 'HLC average · completed bar ' + (l.pivot_session || 'not supplied'), l.pivot],
    ['R1 / S1', 'Pivot resistance / support', fmt0(l.r1) + ' / ' + fmt0(l.s1)],
    ['Fib 38.2% / 61.8%', 'Retracement of supplied annual range', fmt0(l.fib?.['0.382']) + ' / ' + fmt0(l.fib?.['0.618'])]
  ];
  el('lv').innerHTML = '<thead><tr><th>Reference</th><th>Basis</th><th>₹</th></tr></thead><tbody>' + rows.map(r =>
    `<tr><td>${r[0]}</td><td class="sm">${esc(r[1])}</td><td>${typeof r[2] === 'string' ? r[2] : fmt0(r[2])}</td></tr>`).join('') + '</tbody>';
  const refs = [['20', i.sma20], ['50', i.sma50], ['200', i.sma200]].filter(([,v]) => finite(v));
  el('zone').textContent = (d.stale || d.snapshot_mode ? 'Historical reading: ' : 'Technical reading: ') +
    (refs.length ? refs.map(([period,value]) => `${q.price >= value ? 'above' : 'below'} SMA${period} (${fmt0(value)})`).join(' · ') : 'insufficient history for moving averages') +
    '. These are descriptive indicators, not trade instructions.';
  el('flow').textContent = finite(i.mfi_rsi_spread) ? 'MFI − RSI spread: ' + one(i.mfi_rsi_spread) +
    '. This volume/price heuristic does not identify institutional buying or selling.' : 'MFI/RSI comparison unavailable.';
  el('wk').innerHTML = '<thead><tr><th>Date</th><th>Open</th><th>High</th><th>Low</th><th>Close</th><th>Volume</th></tr></thead><tbody>' +
    d.daily.slice(-6).reverse().map(b => `<tr><td>${esc(b.d)}</td>${['o','h','l','c'].map(k => `<td>${fmt0(b[k])}</td>`).join('')}<td>${finite(b.v) ? (b.v/1e5).toFixed(1)+'L' : '—'}</td></tr>`).join('') + '</tbody>';
  const mk = d.mkt;
  el('mktcard').hidden = !mk;
  if (mk) {
    el('mkq').innerHTML = [['NIFTY 50',fmt0(mk.price)],['SMA 20',fmt0(mk.s20)],['SMA 200',fmt0(mk.s200)],
      ['HAL beta',fmt(mk.beta60)],['Correlation',fmt(mk.corr60)]].map(([label,value]) =>
      `<div class="kpi"><b>${value}</b><span class="sm mut">${label}</span></div>`).join('');
    el('mktzone').textContent = 'NIFTY quote: ' + stamp(mk.quote_as_of) +
      ' · last bar: ' + (mk.last_session || 'not supplied') +
      '. Beta/correlation use up to 60 aligned simple daily returns. Historical association is not a forecast.';
  }
  drawCharts();
  pos();
}
function pos() {
  const d = DATA, session = d?.quote_as_of && Number.isFinite(Date.parse(d.quote_as_of)) ? H.todayIST(new Date(d.quote_as_of)) :
    d?.last_session || d?.daily?.at(-1)?.d;
  const book = H.markBook(position, d?.quote?.price, session);
  for (const leg of book.legs) {
    const key = leg.key;
    el(key + '-mark').textContent = leg.mark === null ? 'Unavailable' : '₹' + fmt(leg.mark);
    el(key + '-pnl').textContent = signed(leg.pnl);
    el(key + '-pnl').style.color = leg.pnl === null ? 'var(--mut)' : leg.pnl >= 0 ? 'var(--grn)' : 'var(--red)';
    el(key + '-source').textContent = leg.qty === 0 ? 'Closed leg · quantity 0' :
      leg.source + (leg.source.startsWith('Broker') ? ' · ' + stamp(leg.markedAt) :
        ' · spot session ' + (session || 'unknown') + (!d?.quote_as_of ? ' (assumed from last bar)' : '') +
        (d?.stale || d?.snapshot_mode ? ' · historical input' : ''));
  }
  el('tp').textContent = signed(book.total);
  el('tp').style.color = book.total === null ? 'var(--mut)' : book.total >= 0 ? 'var(--grn)' : 'var(--red)';
  el('tbe').textContent = 'Open book ' + signed(book.open) + ' · realized ' + signed(position.realized) +
    ' · entered costs ₹' + fmt0(position.costs) + '. Costs are not estimated automatically.';
  const active = book.legs.filter(l => l.qty > 0);
  const warnings = [];
  if (active.some(l => l.expired)) warnings.push('Expiry date reached: enter verified broker/settlement marks or record closed legs. Model marks stop on the expiry date; contracts never roll automatically.');
  if (active.some(l => l.qty % position.lot !== 0)) warnings.push('A quantity is not a multiple of the entered lot size. Verify the actual contract specification.');
  if (active.some(l => l.markedAt && H.todayIST(new Date(l.markedAt)) !== H.todayIST())) warnings.push('A manually entered broker mark is from an earlier date.');
  el('position-warning').textContent = warnings.join(' ');
  renderScenarios();
}
function renderScenarios() {
  const price = DATA?.quote?.price;
  const active = ['f', 'p1', 'p2'].filter(k => position[k + 'q'] > 0);
  const dates = new Set(active.map(k => position[k + 'expiry']));
  if (dates.size > 1 || !finite(price)) {
    el('scenario-note').textContent = dates.size > 1 ?
      'Expiry payoffs require the active legs to share one expiry. Different expiries need a time-dependent model.' : 'Load a spot quote to generate scenarios.';
    el('scenarios').innerHTML = '';
    return;
  }
  el('scenario-note').textContent = 'Hypothetical payoff at ' + (Array.from(dates)[0] || 'expiry') +
    ' for the saved long positions. Includes realized P&L and entered costs; excludes unentered charges, delivery funding and slippage. This is not a price forecast or a settlement instruction.';
  let prices = [0.9,0.95,1,1.05,1.1].map(n => Math.round(price*n));
  const custom = el('scenario-price').value.trim();
  if (custom !== '' && finite(Number(custom)) && Number(custom) >= 0) prices.push(Number(custom));
  prices = [...new Set(prices)].sort((a,b) => a-b);
  el('scenarios').innerHTML = '<thead><tr><th>HAL at expiry</th><th>Futures</th><th>Puts</th><th>All-in P&L</th></tr></thead><tbody>' + prices.map(spot => {
    const payoff = H.expiryPayoff(position, spot);
    return `<tr><td>₹${fmt0(spot)}</td><td>${signed(payoff.futures)}</td><td>${signed(payoff.puts)}</td><td class="${payoff.total >= 0 ? 'positive' : 'negative'}">${signed(payoff.total)}</td></tr>`;
  }).join('') + '</tbody>';
}

fillPosition();
for (const key of Object.keys(H.defaults)) if (el(key)) el(key).addEventListener('change', savePosition);
el('refresh').addEventListener('click', () => load(true));
el('scenario-price').addEventListener('input', renderScenarios);
el('export-position').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({version:3, exportedAt:new Date().toISOString(), position}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = 'hal-position.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
el('import-position').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 64000) throw new Error('Position file is too large.');
    const document = JSON.parse(await file.text());
    if (document.version !== 3 || !document.position) throw new Error('Unsupported position file.');
    const next = H.normalize(document.position);
    position = next; fillPosition(); savePosition();
  } catch (error) {
    el('position-status').textContent = 'Import failed: ' + error.message;
  } finally { event.target.value = ''; }
});

// ---------- charts ----------
function cvs(id){const c=el(id);const r=devicePixelRatio||1;const w=c.clientWidth;c.width=w*r;c.height=+c.getAttribute('height')*r;const x=c.getContext('2d');x.setTransform(r,0,0,r,0,0);return[x,w,+c.getAttribute('height')]}
function drawCharts(){
 const d=DATA;if(!d||!d.daily)return;
 const N=Math.min(130,d.daily.length);
 const data=d.daily.slice(-N),S=d.series;
 const hi=Math.max(...data.map(x=>x.h)),lo=Math.min(...data.map(x=>x.l));
 const pad=Math.max((hi-lo)*.06,1), H=hi+pad, L=lo-pad;
 // candles
 let[x,w,h]=cvs('cchart');
 x.fillStyle='#12161f';x.fillRect(0,0,w,h);
 const px=v=>h-(v-L)/(H-L)*(h-20)-5, cw=w/N;
 // gridlines: 52wh, floor, gate
 [[d.quote.w52h,'#66bb6a'],[d.levels.gate,'#f39c12']].forEach(([v,c])=>{
  if(v>L&&v<H){x.strokeStyle=c;x.setLineDash([4,4]);x.lineWidth=.8;x.beginPath();x.moveTo(0,px(v));x.lineTo(w,px(v));x.stroke();x.setLineDash([]);
   x.fillStyle=c;x.font='10px Arial';x.fillText(fmt0(v),4,px(v)-3);}});
 for(let gi=0;gi<4;gi++){const v=L+(H-L)*(gi+1)/5;x.strokeStyle='#1d2635';x.lineWidth=.5;x.beginPath();x.moveTo(0,px(v));x.lineTo(w,px(v));x.stroke();
  x.fillStyle='#5b6472';x.font='10px Arial';x.fillText(fmt0(v),w-46,px(v)-3);}
 data.forEach((b,i)=>{
  const o=px(b.o),c=px(b.c),up=b.c>=b.o,col=up?'#26a69a':'#ef5350';
  x.strokeStyle=col;x.lineWidth=1;x.beginPath();x.moveTo(i*cw+cw/2,px(b.h));x.lineTo(i*cw+cw/2,px(b.l));x.stroke();
  x.fillStyle=col;const t=Math.min(o,c);x.fillRect(i*cw+cw*.18,t,cw*.64,Math.max(1,Math.abs(o-c)));
 });
 [['sma20','#f39c12'],['sma50','#3498db'],['sma200','#9b59b6']].forEach(([k,c])=>{
  const s=S[k];if(!s)return;x.strokeStyle=c;x.lineWidth=1.4;x.beginPath();let st=false;
  for(let i=0;i<N;i++){const v=s[i+(S[k].length-N)];if(v==null)continue;
   st?x.lineTo(i*cw+cw/2,px(v)):(x.moveTo(i*cw+cw/2,px(v)),st=true);}x.stroke();});
 // RSI
 [x,w,h]=cvs('crsi');x.fillStyle='#12161f';x.fillRect(0,0,w,h);
 const ry=v=>h-v/100*(h-8)-4;
 [70,50,30].forEach(v=>{x.strokeStyle=v==50?'#263041':'#3a3a3a';x.setLineDash(v==50?[]:[4,4]);x.lineWidth=.7;x.beginPath();x.moveTo(0,ry(v));x.lineTo(w,ry(v));x.stroke();x.setLineDash([]);x.fillStyle='#5b6472';x.font='9px Arial';x.fillText(v,2,ry(v)-2);});
 x.strokeStyle='#8e44ad';x.lineWidth=1.3;x.beginPath();let st=false;
 for(let i=0;i<N;i++){const v=S.rsi[i+(S.rsi.length-N)];if(v==null)continue;st?x.lineTo(i*w/N+w/N/2,ry(v)):(x.moveTo(i*w/N+w/N/2,ry(v)),st=true);}x.stroke();
 // MACD
 [x,w,h]=cvs('cmacd');x.fillStyle='#12161f';x.fillRect(0,0,w,h);
 const ms=Math.max(...[...S.hist.slice(-N),...S.macd.slice(-N),...S.sig.slice(-N)].filter(v=>v!=null).map(Math.abs))*1.15||1;
 const my=v=>h/2-v/ms*(h/2-6);
 x.strokeStyle='#263041';x.beginPath();x.moveTo(0,my(0));x.lineTo(w,my(0));x.stroke();
 for(let i=0;i<N;i++){const v=S.hist[i+(S.hist.length-N)];if(v==null)continue;
  x.fillStyle=v>=0?'#26a69a':'#ef5350';x.fillRect(i*w/N,Math.min(my(0),my(v)),w/N*.7,Math.abs(my(v)-my(0)));}
 [['macd','#aab2c0'],['sig','#e67e22']].forEach(([k,c])=>{x.strokeStyle=c;x.lineWidth=1.2;x.beginPath();let st=false;
  for(let i=0;i<N;i++){const v=S[k][i+(S[k].length-N)];if(v==null)continue;st?x.lineTo(i*w/N,my(v)):(x.moveTo(i*w/N,my(v)),st=true);}x.stroke();});
}

let resizeTimer;
addEventListener("resize",()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>DATA&&drawCharts(),200)});
pos();
load();
setInterval(()=>load(),5*60*1000);
