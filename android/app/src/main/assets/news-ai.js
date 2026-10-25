'use strict';
// Results are volatile, local-only and are never silently substituted for trade signals.
const HALNewsAI = (() => {
  const results = new Map();
  let state = 'checking', progress = null, error = '', lastRequest = '';
  const valid = new Set(['positive','negative','neutral']);
  function decorate(n) {
    const entry = results.get(n.url);
    if (!entry) return '';
    const label = entry.label.charAt(0).toUpperCase() + entry.label.slice(1);
    const pct = Math.round(entry.confidence * 100);
    return '<span class="hal-sentiment hal-sentiment-' + entry.label +
      '" title="Offline text classifier only; not price direction or investment advice">FinBERT: ' +
      label + ' (' + pct + '% confidence)</span>';
  }
  function statusText() {
    if (state === 'ready') return 'FinBERT installed on this device. News headlines are classified privately, offline, when the Newsroom opens. Sentiment is not a price forecast.';
    if (state === 'downloading') return 'Downloading verified FinBERT model' + (Number.isFinite(progress) ? ' · ' + progress + '%' : '') + '. Keep this app open.';
    if (state === 'error') return error || 'Model unavailable. Retry when connected.';
    if (state === 'not_installed') return 'Optional offline financial sentiment · ~111 MB one-time model download. Wi-Fi recommended. No headline is sent to Hugging Face.';
    return 'Checking for the optional offline FinBERT model…';
  }
  function render() {
    const el = document.getElementById('finbert-status'), btn = document.getElementById('finbert-install');
    if (!el || !btn) return;
    el.textContent = statusText();
    btn.hidden = state === 'ready';
    btn.disabled = state === 'downloading' || state === 'checking';
    btn.textContent = state === 'error' ? 'Retry download' : 'Install offline model';
  }
  function maybeScore(news) {
    if (state !== 'ready' || !Array.isArray(news)) return;
    const items = news.filter(n=>n.url && n.title && typeof n.title==='string')
      .slice(0,12).map(n=>({id:n.url,title:n.title.slice(0,480)}));
    const signature = JSON.stringify(items);
    if (!items.length || signature === lastRequest) return;
    lastRequest = signature;
    if (typeof HALNative === 'undefined' || typeof HALNative.finbertScore !== 'function') return;
    HALNative.finbertScore(signature);
  }
  function receive(event, data) {
    if (event === 'finbert_status') {
      const next = data?.state;
      if (['ready','not_installed','downloading','error'].includes(next)) state = next;
      progress = Number.isFinite(data?.progress) ? data.progress : null;
      if (state === 'ready') { error = ''; maybeScore(typeof allNews!=='undefined'?allNews:[]); }
      render(); return true;
    }
    if (event === 'finbert_error') {
      error = String(data?.message || 'Offline classification failed').slice(0,180);
      state = 'error'; render(); return true;
    }
    if (event === 'finbert_results') {
      if (Array.isArray(data?.items)) for (const row of data.items) {
        if (row && typeof row.id === 'string' && valid.has(row.label) &&
            Number.isFinite(row.confidence) && row.confidence >= 0 && row.confidence <= 1)
          results.set(row.id,{label:row.label,confidence:row.confidence});
      }
      if (typeof renderNews === 'function') renderNews();
      return true;
    }
    return false;
  }
  function bind() {
    const button = document.getElementById('finbert-install');
    if (button) button.onclick=()=>{
      if (state === 'downloading' || state === 'checking' || state === 'ready') return;
      state = 'downloading'; progress = 0; error = ''; render();
      if (typeof HALNative !== 'undefined' && typeof HALNative.finbertInstall === 'function') HALNative.finbertInstall();
      else { state = 'error'; error = 'Install an updated signed Android APK to use offline models.'; render(); }
    };
    render();
  }
  return {decorate,maybeScore,receive,bind,render};
})();
