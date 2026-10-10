/* Pure, dependency-free calculations shared by the UI and Node regression tests. */
(function (root) {
  'use strict';
  const defaults = Object.freeze({
    fq: 300, fa: 5124.9, fexpiry: '2026-10-27', fmark: null, fmarkAt: null,
    p1q: 150, p1a: 57.4, p1strike: 4500, p1iv: 24.8,
    p1expiry: '2026-10-27', p1mark: null, p1markAt: null,
    p2q: 150, p2a: 24.1, p2strike: 4300, p2iv: 28.7,
    p2expiry: '2026-10-27', p2mark: null, p2markAt: null,
    realized: -7011, costs: 0, rate: 6.5, dividend: 0, lot: 150
  });
  const number = value => typeof value === 'number' && Number.isFinite(value);
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  }
  function todayIST(now = new Date()) {
    return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
  }
  function validate(p) {
    for (const key of Object.keys(defaults)) {
      const value = p[key];
      if (key.endsWith('expiry')) {
        if (!validDate(value)) return 'Enter a valid expiry date for each contract.';
      } else if (key.endsWith('At')) {
        if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value))))
          return 'Invalid broker-mark timestamp.';
      } else if (key.endsWith('mark') && value === null) {
        continue;
      } else if (!number(value) || (key !== 'realized' && value < 0)) {
        return 'Enter finite, non-negative numbers; realized P&L may be negative.';
      }
    }
    if (['fq', 'p1q', 'p2q', 'lot'].some(k => !Number.isInteger(p[k])) || p.lot < 1)
      return 'Quantities and lot size must be whole units; lot size must be positive.';
    if (p.p1strike <= 0 || p.p2strike <= 0) return 'Put strikes must be positive.';
    if (p.p1iv > 500 || p.p2iv > 500 || p.rate > 100 || p.dividend > 100)
      return 'Check the IV, interest-rate and dividend-yield percentages.';
    return '';
  }
  function normalize(saved = {}) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('Invalid saved position.');
    const p = Object.assign({}, defaults);
    for (const key of Object.keys(defaults)) if (Object.hasOwn(saved, key)) p[key] = saved[key];
    const error = validate(p);
    if (error) throw new Error(error);
    return p;
  }
  function normalCDF(x) {
    if (x === 0) return 0.5;
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const density = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    const tail = density * t * (0.319381530 + t * (-0.356563782 +
      t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - tail : tail;
  }
  function putPrice(spot, strike, years, rate, iv, dividend = 0) {
    if (![spot, strike, years, rate, iv, dividend].every(number) || spot <= 0 || strike <= 0 || iv < 0)
      throw new Error('Invalid option-model inputs.');
    if (years <= 0) return Math.max(strike - spot, 0);
    if (iv === 0) return Math.max(strike * Math.exp(-rate * years) - spot * Math.exp(-dividend * years), 0);
    const d1 = (Math.log(spot / strike) + (rate - dividend + iv * iv / 2) * years) / (iv * Math.sqrt(years));
    const d2 = d1 - iv * Math.sqrt(years);
    return Math.max(0, strike * Math.exp(-rate * years) * normalCDF(-d2) -
      spot * Math.exp(-dividend * years) * normalCDF(-d1));
  }
  function daysBetween(date, expiry) {
    return (Date.parse(expiry) - Date.parse(date)) / 86400000;
  }
  function markBook(p, spot, asOfDate, today = todayIST()) {
    const error = validate(p);
    if (error) throw new Error(error);
    const validSpot = number(spot) && spot > 0 && validDate(asOfDate);
    const legs = ['f', 'p1', 'p2'].map(key => {
      const qty = p[key + 'q'], average = p[key + 'a'], expiry = p[key + 'expiry'];
      const days = validSpot ? daysBetween(asOfDate, expiry) : null;
      const expired = expiry <= today;
      const manual = p[key + 'mark'];
      let mark = manual, source = 'Broker mark (manual)';
      if (manual === null) {
        source = expired ? 'Expiry reached — enter broker/settlement mark' : 'Model estimate';
        if (validSpot && !expired && days > 0) {
          const years = days / 365;
          mark = key === 'f' ? spot * Math.exp((p.rate - p.dividend) / 100 * years) :
            putPrice(spot, p[key + 'strike'], years, p.rate / 100, p[key + 'iv'] / 100, p.dividend / 100);
        }
      }
      return {key, qty, average, expiry, expired, days, mark, source,
        markedAt: p[key + 'markAt'], pnl: qty === 0 ? 0 : mark === null ? null : (mark - average) * qty};
    });
    const open = legs.some(l => l.pnl === null) ? null : legs.reduce((sum, l) => sum + l.pnl, 0);
    return {legs, open, total: open === null ? null : open + p.realized - p.costs};
  }
  function expiryPayoff(p, spot) {
    if (!number(spot) || spot < 0) throw new Error('Invalid scenario price.');
    const active = ['f', 'p1', 'p2'].filter(key => p[key + 'q'] > 0);
    if (new Set(active.map(key => p[key + 'expiry'])).size > 1) return null;
    const futures = p.fq * (spot - p.fa);
    const puts = ['p1', 'p2'].reduce((sum, key) => sum + p[key + 'q'] *
      (Math.max(p[key + 'strike'] - spot, 0) - p[key + 'a']), 0);
    const open = futures + puts;
    return {futures, puts, open, total: open + p.realized - p.costs};
  }
  const api = {defaults, validDate, todayIST, validate, normalize, putPrice, markBook, expiryPayoff};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HalPortfolio = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
