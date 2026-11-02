if (!Array.prototype.at) Object.defineProperty(Array.prototype, "at", { value: function(i) {
  i = Math.trunc(i) || 0;
  return this[i < 0 ? this.length + i : i];
} });
if (!Array.prototype.flatMap) Object.defineProperty(Array.prototype, "flatMap", { value: function(fn, self) {
  return this.reduce(function(out, x, i, a) {
    return out.concat(fn.call(self, x, i, a));
  }, []);
} });
(function(root) {
  "use strict";
  const DAY = 864e5, IST = 198e5, YEAR = 365 * DAY;
  const finite = (x) => typeof x === "number" && Number.isFinite(x);
  const value = (x) => x === "" || x == null || typeof x === "boolean" ? null : Number.isFinite(Number(x)) ? Number(x) : null;
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => a.length ? sum(a) / a.length : null;
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const num = (...xs) => {
    var _a;
    return (_a = xs.find(finite)) != null ? _a : null;
  };
  const time = (x) => finite(x) ? x : typeof x === "string" && x.trim() ? /^\d{13}$/.test(x) ? Number(x) : Date.parse(x) : NaN;
  const iso = (x) => Number.isFinite(time(x)) && Math.abs(time(x)) <= 864e13 ? new Date(time(x)).toISOString() : null;
  const validDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s + "T00:00:00Z")) && (/* @__PURE__ */ new Date(s + "T00:00:00Z")).toISOString().slice(0, 10) === s;
  const istDate = (t) => new Date((t == null ? Date.now() : time(t)) + IST).toISOString().slice(0, 10);
  const expiryTime = (d) => validDate(d) ? Date.parse(d + "T15:30:00+05:30") : NaN;
  const units = (l) => l.lots * l.lotSize;
  const safeText = (v, n = 1e3) => typeof v === "string" ? v.slice(0, n) : "";
  function safeURL(s) {
    try {
      const u = new URL(s);
      return u.protocol === "https:" && !u.username && !u.password && u.hostname.includes(".") && !/^(localhost|127\.|0\.|192\.168\.|10\.|169\.254\.)/.test(u.hostname) ? u.href : null;
    } catch (_) {
      return null;
    }
  }
  function fail(message) {
    throw new Error(message);
  }
  function cleanJSON(x, depth = 0) {
    if (depth > 30) fail("Backup nesting exceeds supported depth.");
    if (Array.isArray(x)) return x.map((v) => cleanJSON(v, depth + 1));
    if (x && typeof x === "object") {
      const out = {};
      for (const [k, v] of Object.entries(x)) {
        if (/^(?:__proto__|prototype|constructor|api[_-]?key|gemini[_-]?(?:api[_-]?)?key|upstox[_-]?(?:access[_-]?)?token|access[_-]?token|refresh[_-]?token|token|viewer[_-]?key|authorization|password|secret|secrets|credentials|private[_-]?key|keystore|signing[_-]?password)$/i.test(k)) continue;
        out[k] = cleanJSON(v, depth + 1);
      }
      return out;
    }
    return x;
  }
  function validateLeg(input, index = 0) {
    if (!input || typeof input !== "object" || Array.isArray(input)) fail("Invalid leg record.");
    const l = clone(input);
    if (!["FUT", "PE"].includes(l.type) || !validDate(l.expiry)) fail("Use a long HAL future or put with an exact expiry date.");
    if (!Number.isInteger(l.lots) || l.lots < 1 || l.lots > 1e4) fail("Lots must be a positive whole number, at most 10,000.");
    if (!Number.isInteger(l.lotSize) || l.lotSize < 1 || l.lotSize > 1e5) fail("Units per lot must be a positive verified whole number.");
    if (!finite(l.entry) || l.entry < 0 || l.entry > 1e7 || l.type === "FUT" && l.entry === 0) fail("Entry price must be a valid non-negative premium or positive futures price.");
    if (l.type === "PE" && (!finite(l.strike) || l.strike <= 0 || l.strike > 1e7)) fail("Put strike must be positive.");
    if (l.manual != null && (!finite(l.manual) || l.manual < 0 || l.manual > 1e7)) fail("Manual mark must be non-negative; zero is allowed.");
    if (l.manualAt != null && !Number.isFinite(time(l.manualAt))) fail("Invalid manual mark timestamp.");
    l.id = safeText(l.id, 100) || "leg-" + index;
    l.strike = l.type === "PE" ? l.strike : null;
    l.manual = l.manual == null ? null : l.manual;
    l.manualAt = l.manualAt == null ? null : iso(l.manualAt);
    l.instrumentKey = safeText(l.instrumentKey || l.instrument_key, 180) || null;
    return l;
  }
  function emptyBook() {
    return { version: 4, revision: 0, legs: [], journal: [], notes: [], bookmarks: [], checkpoints: [], riskProfile: { capital: null, maxLoss: null, hedgeBudget: null, reserve: null, reviewBelow: null, reviewAbove: null, confirmedAt: null, confirmedBook: null }, funding: { margin: null, free: null, at: null }, preferences: { theme: "dark", auto: true, markMode: "ltp" }, hedge: { budget: null, maxLoss: null, protectThrough: null, buyFees: 0, exitFees: 0, slippage: 0.5, maxSpread: 10, ivShift: 0, rate: 6, dividend: 0 } };
  }
  function validateBook(input) {
    var _a, _b, _c, _d;
    input = cleanJSON(input);
    if (!input || typeof input !== "object" || Array.isArray(input) || ![2, 4].includes(input.version)) fail("A HAL Desk schema 2 or 4 backup is required.");
    for (const [k, n] of [["legs", 100], ["journal", 5e4], ["notes", 1e4], ["bookmarks", 5e3], ["checkpoints", 5e3]]) if (input[k] != null && (!Array.isArray(input[k]) || input[k].length > n)) fail("Invalid or excessive " + k + " records.");
    if (!Array.isArray(input.legs) || !Array.isArray(input.journal)) fail("Backup book and journal are required.");
    const out = emptyBook();
    out.revision = Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 0;
    out.legs = input.legs.map(validateLeg);
    if (new Set(out.legs.map((l) => l.id)).size !== out.legs.length) fail("Duplicate leg identifiers in backup.");
    out.journal = input.journal.map((j, i) => {
      if (!j || !["close", "fee", "settlement", "funding"].includes(j.kind) || !validDate(j.date)) fail("Invalid journal entry " + (i + 1) + ".");
      const r = { id: safeText(j.id, 100) || "journal-" + i, kind: j.kind, date: j.date, note: safeText(j.note, 1e4) };
      if (j.kind === "close") {
        r.leg = validateLeg(j.leg, i);
        if (!finite(j.exit) || j.exit < 0 || !finite(j.fees) || j.fees < 0) fail("Invalid close price or charges.");
        Object.assign(r, { exit: j.exit, fees: j.fees, gross: (j.exit - r.leg.entry) * units(r.leg) });
      } else {
        if (!finite(j.amount) || j.kind === "fee" && j.amount < 0) fail("Invalid journal cash amount.");
        r.amount = j.amount;
      }
      return r;
    });
    if (new Set(out.journal.map((j) => j.id)).size !== out.journal.length) fail("Duplicate journal identifiers in backup.");
    out.notes = (input.notes || []).map((n) => ({ id: safeText(n.id, 100), date: validDate(n.date) ? n.date : null, title: safeText(n.title, 500), text: safeText(n.text, 2e4), url: safeURL(n.url) || "", category: safeText(n.category, 100) || "Other", eventDate: validDate(n.eventDate) ? n.eventDate : null }));
    out.bookmarks = (input.bookmarks || []).map((n) => ({ title: safeText(n.title, 1e3), url: safeURL(n.url), published: safeText(n.published, 100), source: safeText(n.source, 200) })).filter((n) => n.url);
    out.checkpoints = clone(input.checkpoints || []);
    if (input.legacy != null) {
      const l = input.legacy;
      if (!finite(l.realized) || !finite(l.costs) || l.costs < 0 || !Array.isArray(l.journal) || l.journal.length > 5e4) fail("Invalid legacy realised ledger.");
      out.legacy = { realized: l.realized, costs: l.costs, journal: l.journal.map((j, i) => {
        if (!validDate(j.date) || !["close", "fee", "settlement"].includes(j.kind) || !finite(j.amount)) fail("Invalid legacy historical record.");
        return { id: safeText(j.id, 100) || "legacy-" + i, kind: j.kind, date: j.date, amount: j.amount, note: safeText(j.note, 1e4) };
      }) };
    }
    const f = input.funding || {};
    for (const k of ["margin", "free"]) {
      if (f[k] != null && (!finite(f[k]) || f[k] < 0)) fail("Invalid funding snapshot.");
      out.funding[k] = (_a = f[k]) != null ? _a : null;
    }
    out.funding.at = f.at == null ? null : iso(f.at);
    const p = input.preferences || {};
    out.preferences = { theme: ["dark", "light", "system"].includes(p.theme) ? p.theme : "dark", auto: p.auto !== false, markMode: p.markMode === "bid" ? "bid" : "ltp" };
    for (const k of ["capital", "maxLoss", "hedgeBudget", "reserve", "reviewBelow", "reviewAbove"]) {
      const v = (_b = input.riskProfile) == null ? void 0 : _b[k];
      if (v != null && (!finite(v) || v < 0)) fail("Invalid risk limit " + k + ".");
      out.riskProfile[k] = v != null ? v : null;
    }
    if (finite(out.riskProfile.reviewBelow) && finite(out.riskProfile.reviewAbove) && out.riskProfile.reviewBelow >= out.riskProfile.reviewAbove) fail("Lower review trigger must be below the upper trigger.");
    out.riskProfile.confirmedAt = iso((_c = input.riskProfile) == null ? void 0 : _c.confirmedAt);
    out.riskProfile.confirmedBook = safeText((_d = input.riskProfile) == null ? void 0 : _d.confirmedBook, 5e4) || null;
    out.hedge = hedgePreferences(input.hedge || {});
    if (input.rollover != null) out.legacyRolloverPreferences = clone(input.rollover);
    if (input.legacyRolloverPreferences != null) out.legacyRolloverPreferences = clone(input.legacyRolloverPreferences);
    if (input.migration != null) out.migration = clone(input.migration);
    if (input.version === 2) out.migration = { fromVersion: 2, reviewRequired: true };
    return out;
  }
  function contractKey(c) {
    return c.instrumentKey || c.instrument_key || c.key || null;
  }
  function normContract(c) {
    return { instrumentKey: contractKey(c), type: c.type || c.instrument_type, expiry: c.expiry, strike: num(c.strike, c.strike_price), lotSize: num(c.lotSize, c.lot_size), symbol: c.symbol || c.trading_symbol || null };
  }
  function normQuote(q = {}, fallback = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const depth = q.depth || {};
    const buy = ((_a = depth.buy) == null ? void 0 : _a[0]) || {}, sell = ((_b = depth.sell) == null ? void 0 : _b[0]) || {};
    const g = q.greeks || q.option_greeks || {};
    return { price: num(q.price, q.last_price, q.ltp), bid: num(q.bid, q.bid_price, buy.price), ask: num(q.ask, q.ask_price, sell.price), bidQty: num(q.bidQty, q.bid_qty, q.bid_quantity, buy.quantity), askQty: num(q.askQty, q.ask_qty, q.ask_quantity, sell.quantity), quoteAt: iso((_e = (_d = (_c = q.quoteAt) != null ? _c : q.quote_as_of) != null ? _d : q.timestamp) != null ? _e : fallback.quoteAt), tradeAt: iso((_h = (_g = (_f = q.tradeAt) != null ? _f : q.last_trade_at) != null ? _g : q.last_trade_time) != null ? _h : q.ltt), retrievedAt: iso((_k = (_j = (_i = q.retrievedAt) != null ? _i : q.retrieved_at) != null ? _j : q.fetched_at_iso) != null ? _k : fallback.retrievedAt), source: q.source || fallback.source || "REST", delta: num(q.delta, g.delta), theta: num(q.theta, g.theta), iv: num(q.iv, g.iv), greeksAt: iso((_l = q.greeksAt) != null ? _l : q.greeks_timestamp), thetaPerDayVerified: q.thetaPerDayVerified === true || q.theta_unit_verified === true, volume: num(q.volume, q.volume_traded), oi: num(q.oi, q.open_interest), previousOi: num(q.previousOi, q.previous_oi), previousClose: num(q.previousClose, q.prev_close, q.prev_close_price, (_m = q.ohlc) == null ? void 0 : _m.close), lastSuccess: iso((_n = q.lastSuccess) != null ? _n : fallback.lastSuccess), lastFailure: iso((_o = q.lastFailure) != null ? _o : fallback.lastFailure), failure: safeText(q.failure || fallback.failure, 500) || null };
  }
  function normalizeMarket(input = {}) {
    var _a, _b, _c;
    const out = { contracts: [], quotes: {}, spot: normQuote(input.spot || {}, { retrievedAt: input.fetched_at_iso }), marketOpen: (_a = input.marketOpen) != null ? _a : null, lastSuccess: iso((_b = input.lastSuccess) != null ? _b : input.fetched_at_iso), lastFailure: iso(input.lastFailure), failure: input.failure || null };
    const seen = /* @__PURE__ */ new Set();
    const add = (raw, quote) => {
      var _a2;
      const c = normContract(raw);
      if (!c.instrumentKey) c.instrumentKey = [c.type, c.expiry, (_a2 = c.strike) != null ? _a2 : ""].join("|");
      if (!seen.has(c.instrumentKey)) {
        out.contracts.push(c);
        seen.add(c.instrumentKey);
      }
      if (quote) out.quotes[c.instrumentKey] = normQuote(quote, { retrievedAt: input.fetched_at_iso, lastSuccess: out.lastSuccess, lastFailure: out.lastFailure, failure: out.failure });
    };
    for (const c of input.contracts || []) add(c, ((_c = input.quotes) == null ? void 0 : _c[contractKey(c)]) || c.quote);
    for (const [key, q] of Object.entries(input.quotes || {})) out.quotes[key] = normQuote(q, { retrievedAt: input.fetched_at_iso, lastSuccess: out.lastSuccess, lastFailure: out.lastFailure, failure: out.failure });
    for (const f of input.futures || []) add({ ...f, type: "FUT" }, f.quote || f);
    const chains = {};
    if (input.option_expiry) chains[input.option_expiry] = input;
    Object.assign(chains, input.chains || {});
    for (const [expiry, chain] of Object.entries(chains)) for (const row of chain.option_rows || []) if (row.put) add({ ...row.put, type: "PE", expiry, strike: row.strike }, { ...row.put, ...row.put.quote || {} });
    const held = input.held_contracts || input.heldContracts || [];
    for (const h of Array.isArray(held) ? held : Object.values(held)) add(h, h.quote || h);
    return out;
  }
  function quoteQuality(q, opts = {}) {
    var _a, _b, _c;
    const now = opts.now == null ? Date.now() : time(opts.now), maxAge = (_a = opts.maxAge) != null ? _a : 12e4, maxTradeAge = (_b = opts.maxTradeAge) != null ? _b : 12e4, futureTolerance = (_c = opts.futureTolerance) != null ? _c : 5e3;
    const reasons = [], warnings = [];
    const quoteAt = time(q == null ? void 0 : q.quoteAt), tradeAt = time(q == null ? void 0 : q.tradeAt), retrievedAt = time(q == null ? void 0 : q.retrievedAt);
    if (!q) reasons.push("Quote unavailable");
    if (!finite(q == null ? void 0 : q.price) || q.price < 0) reasons.push("Price unavailable or invalid");
    if ((q == null ? void 0 : q.source) === "STREAM") reasons.push("Streaming preview cannot be used as a valuation mark");
    if (!Number.isFinite(quoteAt)) reasons.push("Provider quote timestamp unavailable");
    for (const [label, t] of [["Provider quote", quoteAt], ["Last trade", tradeAt], ["Retrieval", retrievedAt]]) if (Number.isFinite(t) && t > now + futureTolerance) reasons.push(label + " timestamp is in the future");
    if (!Number.isFinite(retrievedAt)) warnings.push("HTTP retrieval timestamp unavailable");
    if (!Number.isFinite(tradeAt)) (opts.requireTrade ? reasons : warnings).push("Last exchange trade timestamp unavailable");
    const quoteStale = Number.isFinite(quoteAt) && now - quoteAt > maxAge, tradeStale = Number.isFinite(tradeAt) && now - tradeAt > maxTradeAge;
    if (quoteStale) warnings.push("Provider quote is older than " + maxAge / 1e3 + " seconds");
    if (tradeStale) warnings.push("Last trade is older than " + maxTradeAge / 1e3 + " seconds");
    if (opts.requireFresh && quoteStale) reasons.push("Stale provider quote");
    if (opts.requireTrade && tradeStale) reasons.push("Stale last exchange trade");
    if ((q == null ? void 0 : q.source) === "CACHE") warnings.push("Cached observation");
    const failed = !!(q == null ? void 0 : q.failure) || Number.isFinite(time(q == null ? void 0 : q.lastFailure)) && (!Number.isFinite(time(q == null ? void 0 : q.lastSuccess)) || time(q.lastFailure) > time(q.lastSuccess));
    if (failed) warnings.push("Refresh failed; previous observation retained");
    if (opts.requireFresh && (failed || (q == null ? void 0 : q.source) === "CACHE")) reasons.push("A successful fresh REST refresh is required");
    return { valid: reasons.length === 0, fresh: reasons.length === 0 && !quoteStale && !tradeStale && Number.isFinite(tradeAt), status: reasons.length ? "unavailable" : quoteStale || tradeStale || (q == null ? void 0 : q.source) === "CACHE" || failed ? "stale" : "current", reasons, warnings, quoteAge: Number.isFinite(quoteAt) ? now - quoteAt : null, tradeAge: Number.isFinite(tradeAt) ? now - tradeAt : null, quoteAt: iso(quoteAt), tradeAt: iso(tradeAt), retrievedAt: iso(retrievedAt) };
  }
  function matchContract(leg, market) {
    const m = (market == null ? void 0 : market.contracts) ? market : normalizeMarket(market), exact = m.contracts.filter((c) => c.type === leg.type && c.expiry === leg.expiry && (leg.type !== "PE" || c.strike === leg.strike));
    const chosen = leg.instrumentKey ? exact.find((c) => c.instrumentKey === leg.instrumentKey) : exact.length === 1 ? exact[0] : null;
    if (!chosen) return { contract: null, error: leg.instrumentKey ? "Saved instrument key does not match an exact listed contract" : exact.length > 1 ? "Ambiguous contract; save its exact instrument key" : "Exact listed contract unavailable", mismatch: false };
    if (chosen.lotSize !== leg.lotSize) return { contract: chosen, error: "Saved lot size differs from the provider contract", mismatch: true };
    return { contract: chosen, error: null, mismatch: false };
  }
  function resolveMark(leg, input = {}, opts = {}) {
    const market = normalizeMarket(input), match = matchContract(leg, market), now = opts.now == null ? Date.now() : time(opts.now), warnings = [];
    const base = { price: null, source: "Unavailable", status: "unavailable", quoteAt: null, tradeAt: null, retrievedAt: null, warnings, contract: match.contract, mismatch: match.mismatch };
    if (match.mismatch) return { ...base, warnings: [match.error] };
    if (finite(leg.manual)) {
      const t = time(leg.manualAt);
      if (Number.isFinite(t) && t > now + 5e3) return { ...base, warnings: ["Manual mark timestamp is in the future"] };
      if (!Number.isFinite(t)) warnings.push("Manual mark timestamp unavailable");
      if (match.error) warnings.push(match.error + "; manual valuation uses the saved quantity");
      return { ...base, price: leg.manual, source: "Manual", status: "manual", quoteAt: iso(t), warnings };
    }
    if (match.error) return { ...base, warnings: [match.error] };
    const q = market.quotes[match.contract.instrumentKey], quality = quoteQuality(q, { now });
    if (!quality.valid) return { ...base, ...quality, warnings: [...quality.reasons, ...quality.warnings], source: (q == null ? void 0 : q.source) || "Unavailable" };
    const price = opts.markMode === "bid" && leg.type === "PE" ? q.bid : q.price;
    if (!finite(price) || price < 0) return { ...base, warnings: ["Required mark price unavailable"] };
    if (expiryTime(leg.expiry) < now) warnings.push("Expired open leg needs actual close or settlement reconciliation");
    return { ...base, ...quality, price, source: q.source === "CACHE" ? "Cached REST" : opts.markMode === "bid" && leg.type === "PE" ? "REST bid" : "REST LTP", warnings: [...warnings, ...quality.warnings], quote: q };
  }
  function ledger(book, input = {}, opts = {}) {
    var _a, _b;
    const b = validateBook(book);
    const rows = b.legs.map((leg) => {
      const mark = resolveMark(leg, input, { ...opts, markMode: opts.markMode || b.preferences.markMode });
      return { leg, mark, units: units(leg), pnl: finite(mark.price) ? (mark.price - leg.entry) * units(leg) : null };
    });
    const complete = rows.every((r) => finite(r.pnl)), open = complete ? sum(rows.map((r) => r.pnl)) : null;
    const realized = (((_a = b.legacy) == null ? void 0 : _a.realized) || 0) + sum(b.journal.filter((j) => j.kind === "close").map((j) => (j.exit - j.leg.entry) * units(j.leg)));
    const charges = (((_b = b.legacy) == null ? void 0 : _b.costs) || 0) + sum(b.journal.map((j) => j.kind === "close" ? j.fees : j.kind === "fee" ? j.amount : 0));
    return { rows, open, realized, charges, net: complete ? realized + open - charges : null, complete, openPutPremium: sum(b.legs.filter((l) => l.type === "PE").map((l) => l.entry * units(l))), settlements: sum(b.journal.filter((j) => j.kind === "settlement").map((j) => j.amount)), fundingMovements: sum(b.journal.filter((j) => j.kind === "funding").map((j) => j.amount)), unavailableLegs: rows.filter((r) => r.pnl === null).map((r) => r.leg.id), manual: rows.some((r) => r.mark.source === "Manual"), stale: rows.some((r) => r.mark.status === "stale") };
  }
  function closeLeg(book, idOrIndex, lots, exit, fees, date, options = {}) {
    const b = validateBook(book), index = typeof idOrIndex === "number" ? idOrIndex : b.legs.findIndex((l) => l.id === idOrIndex), leg = b.legs[index], now = options.now == null ? Date.now() : time(options.now);
    if (!leg || !Number.isInteger(lots) || lots < 1 || lots > leg.lots || !finite(exit) || exit < 0 || !finite(fees) || fees < 0 || !validDate(date) || date > istDate(now)) fail("Check closed lots, actual exit price, charges and completed trade date.");
    const id = options.id || "close-" + now + "-" + b.journal.length;
    if (b.journal.some((j) => j.id === id)) fail("Duplicate close transaction identifier.");
    const record = { id, kind: "close", date, note: safeText(options.note, 1e4), leg: { ...leg, lots }, exit, fees, gross: (exit - leg.entry) * lots * leg.lotSize };
    b.journal.push(record);
    if (lots === leg.lots) b.legs.splice(index, 1);
    else b.legs[index].lots -= lots;
    b.revision++;
    b.riskProfile.confirmedAt = null;
    b.riskProfile.confirmedBook = null;
    return b;
  }
  function recordCash(book, kind, amount, date, note = "", opts = {}) {
    const b = validateBook(book), now = opts.now == null ? Date.now() : time(opts.now);
    if (!["fee", "settlement", "funding"].includes(kind) || !finite(amount) || kind === "fee" && amount < 0 || !validDate(date) || date > istDate(now)) fail("Invalid completed cash journal movement.");
    const id = opts.id || kind + "-" + now + "-" + b.journal.length;
    if (b.journal.some((j) => j.id === id)) fail("Duplicate journal transaction identifier.");
    b.journal.push({ id, kind, amount, date, note: safeText(note, 1e4) });
    b.revision++;
    return b;
  }
  function validGreeks(q, now = Date.now()) {
    return !!q && Number.isFinite(time(q.greeksAt)) && time(q.greeksAt) <= time(now) + 5e3 && time(now) - time(q.greeksAt) <= 12e4 && finite(q.delta) && q.delta >= -1 && q.delta <= 0 && finite(q.theta) && finite(q.iv) && q.iv > 0 && q.iv <= 500;
  }
  function risk(legsOrBook, input = {}, now = Date.now()) {
    now = time(now);
    const book = Array.isArray(legsOrBook) ? { ...emptyBook(), legs: legsOrBook } : validateBook(legsOrBook), legs = book.legs.map(validateLeg), market = normalizeMarket(input), active = legs.filter((l) => expiryTime(l.expiry) >= now), futures = active.filter((l) => l.type === "FUT"), puts = active.filter((l) => l.type === "PE");
    const futureUnits = sum(futures.map(units)), putUnits = sum(puts.map(units)), coveredUnits = Math.min(futureUnits, putUnits), warnings = [], mismatches = [];
    let delta = futureUnits, theta = 0, greeksComplete = true, thetaComplete = true;
    for (const leg of active) {
      const match = matchContract(leg, market);
      if (match.error) {
        mismatches.push({ legId: leg.id, reason: match.error });
        greeksComplete = false;
        continue;
      }
      if (leg.type === "PE") {
        const q = market.quotes[match.contract.instrumentKey], quality = quoteQuality(q, { now, requireFresh: true, requireTrade: true });
        if (!quality.valid || !validGreeks(q, now)) {
          greeksComplete = false;
          continue;
        }
        delta += q.delta * units(leg);
        if (q.thetaPerDayVerified) theta += q.theta * units(leg);
        else thetaComplete = false;
      }
    }
    if (!futureUnits && !putUnits) {
      delta = 0;
      theta = 0;
      greeksComplete = true;
    }
    const dates = [...new Set(active.map((l) => l.expiry))].sort(), timeline = dates.map((date) => {
      const f = sum(futures.filter((l) => l.expiry > date).map(units)), p = sum(puts.filter((l) => l.expiry > date).map(units));
      return { date, futureUnits: f, putUnits: p, coveredUnits: Math.min(f, p), uncoveredUnits: Math.max(0, f - p), expiring: active.filter((l) => l.expiry === date).map((l) => l.id) };
    });
    const add = (code, title, detail) => warnings.push({ code, title, detail });
    if (legs.some((l) => expiryTime(l.expiry) < now)) add("expired", "Expired leg needs reconciliation", "Record the actual close or settlement; expired legs are excluded from active quantity and Greeks.");
    if (futureUnits > putUnits) add("quantity_gap", "Incomplete quantity coverage", futureUnits - putUnits + " futures units have no corresponding active put quantity.");
    if (putUnits > futureUnits) add("overhedged", "Put quantity exceeds futures quantity", putUnits - futureUnits + " additional put units are a separate directional exposure.");
    const gap = timeline.find((t) => t.uncoveredUnits > 0);
    if (gap) add("expiry_gap", "Protection expires before futures", "After " + gap.date + ", " + gap.uncoveredUnits + " futures units remain without matching active put quantity.");
    if (new Set(puts.map((l) => l.strike)).size > 1) add("strike_distribution", "Protection spans several strikes", "Equal quantity does not mean equal downside protection: review each strike.");
    if (mismatches.length) add("contract_mismatch", "Contract specifications need verification", mismatches.map((m) => m.reason).join("; "));
    if (!greeksComplete || !thetaComplete) add("greeks_missing", "Aggregate Greeks unavailable", "Every active contract must match and every put needs valid, recent contract Greeks with their own timestamps. Theta also needs a verified per-day unit convention.");
    if (active.some((l) => expiryTime(l.expiry) - now <= 7 * DAY)) add("near_expiry", "Contract expiry within seven days", "Review margin, exercise, delivery obligations and broker deadlines. No automatic rollover is assumed.");
    if (futureUnits) add("margin", "Futures margin and physical settlement", "Mark-to-market cash calls can occur before expiry. Stock derivatives may require physical delivery; confirm broker obligations and deadlines.");
    const rp = book.riskProfile || {}, spot = market.spot.price;
    if (finite(spot) && finite(rp.reviewBelow) && spot <= rp.reviewBelow) add("lower_review", "Lower review threshold crossed", "Observed spot is at or below your saved review level. This is a review prompt, not an order.");
    if (finite(spot) && finite(rp.reviewAbove) && spot >= rp.reviewAbove) add("upper_review", "Upper review threshold crossed", "Observed spot is at or above your saved review level.");
    const valuation = ledger(book, market, { now });
    if (finite(rp.maxLoss) && rp.maxLoss > 0 && finite(valuation.net) && valuation.net <= -rp.maxLoss) add("loss_limit", "Recorded strategy loss review threshold crossed", "Indicative strategy net P&L has reached your review threshold. This is not a guaranteed loss limit.");
    if (finite(rp.reserve) && finite(book.funding.free) && book.funding.free < rp.reserve) add("reserve", "Recorded cash reserve below threshold", "Review the age of your manual funding snapshot and current broker cash requirements.");
    if (legs.length && !rp.confirmedAt) add("unconfirmed", "Book not confirmed against broker", "Confirm exact lots, entries, expiries and completed closes against your broker records.");
    const distribution = puts.map((l) => ({ legId: l.id, strike: l.strike, expiry: l.expiry, lots: l.lots, lotSize: l.lotSize, units: units(l) }));
    return { futureUnits, futureLots: sum(futures.map((l) => l.lots)), putUnits, putLots: sum(puts.map((l) => l.lots)), coveredUnits, uncoveredUnits: Math.max(0, futureUnits - putUnits), coverage: futureUnits ? putUnits / futureUnits * 100 : null, delta: greeksComplete ? delta : null, theta: greeksComplete && thetaComplete ? theta : null, greeksComplete: greeksComplete && thetaComplete, deltaComplete: greeksComplete, thetaComplete: greeksComplete && thetaComplete, nextExpiry: dates[0] || null, timeline, warnings, distribution, mismatches, openPutPremium: sum(puts.map((l) => l.entry * units(l))), coverageMeaning: "Quantity overlap at this time only; strike, basis and expiry still affect protection." };
  }
  function cdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989422804014327 * Math.exp(-x * x / 2), p = 1 - d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x >= 0 ? p : 1 - p;
  }
  function putPrice(S, K, T, vol, r = 0.06, q = 0) {
    if (![S, K, T, vol, r, q].every(finite) || S < 0 || K <= 0 || T < 0 || vol < 0) fail("Invalid Black\u2013Scholes inputs.");
    if (T === 0) return Math.max(K - S, 0);
    if (S === 0) return K * Math.exp(-r * T);
    if (vol === 0) return Math.max(K * Math.exp(-r * T) - S * Math.exp(-q * T), 0);
    const d1 = (Math.log(S / K) + (r - q + vol * vol / 2) * T) / (vol * Math.sqrt(T)), d2 = d1 - vol * Math.sqrt(T);
    return Math.max(0, K * Math.exp(-r * T) * cdf(-d2) - S * Math.exp(-q * T) * cdf(-d1));
  }
  function scenario(legsOrBook, input = {}, params = {}, now = Date.now()) {
    var _a, _b, _c, _d, _e, _f;
    const result = { rows: [], total: null, horizon: null, complete: false, errors: [], assumptions: [], kind: "model" };
    try {
      now = time(now);
      if (!finite(now)) fail("Invalid calculation time.");
      const legs = (Array.isArray(legsOrBook) ? legsOrBook : legsOrBook.legs).map(validateLeg), market = normalizeMarket(input), spot = params.spot, rate = (_a = params.rate) != null ? _a : 6, dividend = (_b = params.dividend) != null ? _b : 0, ivShift = (_c = params.ivShift) != null ? _c : 0, basis = params.basis || "constant";
      const horizon = params.horizon != null ? validDate(params.horizon) ? expiryTime(params.horizon) : time(params.horizon) : now + ((_d = params.days) != null ? _d : 0) * DAY;
      result.horizon = iso(horizon);
      if (!finite(spot) || spot < 0 || !finite(horizon) || horizon < now || ![rate, dividend, ivShift].every(finite) || rate < -10 || rate > 100 || dividend < 0 || dividend > 100 || !["constant", "decay", "carry"].includes(basis)) fail("Check scenario spot, horizon, interest, dividend, IV and basis assumptions.");
      if (legs.some((l) => expiryTime(l.expiry) < now)) fail("Reconcile expired open legs before modelling.");
      if (legs.some((l) => horizon > expiryTime(l.expiry))) fail("Horizon exceeds an open-leg expiry. A later hypothetical price cannot determine an earlier settlement.");
      const needsBase = basis !== "carry" && legs.some((l) => l.type === "FUT" && horizon < expiryTime(l.expiry)), baseSpot = finite(params.baseSpot) ? params.baseSpot : market.spot.price;
      if (needsBase && (!finite(baseSpot) || baseSpot <= 0)) fail("A valid separately observed base spot is required for futures basis modelling.");
      result.assumptions = ["European Black\u2013Scholes put model; ACT/365 time; interest and dividend are explicit annual percentage assumptions.", "Scenario P&L is measured from saved entry prices; historical realised P&L and charges are separate.", "Futures basis: " + basis + ". No future rollover, path-dependent settlement, margin cash flow or execution guarantee is inferred."];
      if (needsBase && finite(params.baseSpot)) result.assumptions.push("Base spot is a user-supplied model input.");
      else if (needsBase && market.spot.price != null) {
        const sq = quoteQuality(market.spot, { now });
        if (!sq.valid) fail("Base spot source is invalid: " + sq.reasons.join("; "));
        if (sq.status === "stale") result.assumptions.push("Base spot is stale; model output is based on the labelled cached observation.");
      }
      for (const leg of legs) {
        const expiry = expiryTime(leg.expiry), T = Math.max(0, (expiry - horizon) / YEAR), match = matchContract(leg, market);
        if (match.mismatch) fail("Lot size mismatch for " + leg.id + ".");
        let modelPrice, iv = null;
        if (leg.type === "FUT") {
          if (T === 0) modelPrice = spot;
          else if (basis === "carry") modelPrice = spot * Math.exp((rate - dividend) / 100 * T);
          else {
            const mark = resolveMark(leg, market, { now });
            if (!finite(mark.price)) fail("Current futures mark required for " + leg.id + ".");
            const initialBasis = mark.price - baseSpot;
            modelPrice = spot + initialBasis * (basis === "decay" ? (expiry - horizon) / (expiry - now) : 1);
            if (modelPrice < 0) fail("Futures basis assumption produced a negative price.");
          }
        } else {
          if (T === 0) modelPrice = Math.max(leg.strike - spot, 0);
          else {
            const q = match.contract ? market.quotes[match.contract.instrumentKey] : null;
            const explicit = (_f = (_e = params.ivByLeg) == null ? void 0 : _e[leg.id]) != null ? _f : params.fallbackIV;
            if (finite(explicit)) iv = explicit;
            else if (q && quoteQuality(q, { now, requireFresh: true, requireTrade: true }).valid && finite(q.iv) && q.iv > 0 && q.iv <= 500 && Number.isFinite(time(q.greeksAt)) && time(q.greeksAt) <= now + 5e3 && now - time(q.greeksAt) <= 12e4) iv = q.iv;
            if (!finite(iv)) fail("Valid put IV unavailable for " + leg.id + "; enter an explicit IV assumption.");
            iv += ivShift;
            if (iv < 0 || iv > 500) fail("Scenario IV must be from 0% to 500%.");
            modelPrice = putPrice(spot, leg.strike, T, iv / 100, rate / 100, dividend / 100);
          }
        }
        result.rows.push({ leg, modelPrice, iv, units: units(leg), pnl: (modelPrice - leg.entry) * units(leg), kind: T === 0 ? "expiry payoff" : "model estimate" });
      }
      result.total = sum(result.rows.map((r) => r.pnl));
      result.complete = true;
      result.kind = result.rows.every((r) => r.kind === "expiry payoff") ? "exact expiry payoff" : "model estimate";
      return result;
    } catch (e) {
      result.errors.push(e.message);
      result.total = null;
      return result;
    }
  }
  function payoff(legs, spot) {
    if (new Set(legs.map((l) => l.expiry)).size !== 1) fail("A direct combined expiry payoff requires one common expiry.");
    if (!finite(spot) || spot < 0) fail("Invalid settlement spot.");
    return sum(legs.map((l, i) => {
      validateLeg(l, i);
      return ((l.type === "FUT" ? spot : Math.max(l.strike - spot, 0)) - l.entry) * units(l);
    }));
  }
  function hedgePreferences(input = {}) {
    const out = { budget: null, maxLoss: null, protectThrough: null, buyFees: 0, exitFees: 0, slippage: 0.5, maxSpread: 10, ivShift: 0, rate: 6, dividend: 0, minVolume: 1, minOI: 1, maxAge: 12e4, maxTradeAge: 12e4 };
    const ranges = { budget: [0, 1e12], maxLoss: [0, 1e12], buyFees: [0, 1e9], exitFees: [0, 1e9], slippage: [0, 10], maxSpread: [0, 100], ivShift: [-500, 500], rate: [-10, 100], dividend: [0, 100], minVolume: [0, 1e12], minOI: [0, 1e12], maxAge: [1e3, 864e5], maxTradeAge: [1e3, 864e5] };
    for (const [k, [lo, hi]] of Object.entries(ranges)) if (input[k] != null) {
      if (!finite(input[k]) || input[k] < lo || input[k] > hi) fail("Invalid hedge setting " + k + ".");
      out[k] = input[k];
    }
    if (input.protectThrough != null) {
      if (!validDate(input.protectThrough)) fail("Invalid protection-through date.");
      out.protectThrough = input.protectThrough;
    }
    if (input.shocks != null) {
      if (!Array.isArray(input.shocks) || !input.shocks.length || input.shocks.length > 30 || input.shocks.some((x) => !finite(x) || x < -1 || x > 2)) fail("Invalid shock grid.");
      out.shocks = [...input.shocks];
    }
    if (input.horizons != null) {
      if (!Array.isArray(input.horizons) || !input.horizons.length || input.horizons.length > 20) fail("Invalid horizon grid.");
      out.horizons = [...input.horizons];
    }
    return out;
  }
  function findHedges(book, input = {}, settings = {}, now = Date.now()) {
    const result = { candidates: [], excluded: [], rankings: { lowerCost: null, balanced: null, strongerProtection: null }, errors: [], assumptions: [], current: [], currentErrors: [] };
    try {
      now = time(now);
      const b = validateBook(book), market = normalizeMarket(input), p = hedgePreferences(settings), futures = b.legs.filter((l) => l.type === "FUT"), puts = b.legs.filter((l) => l.type === "PE"), futureUnits = sum(futures.map(units));
      if (!futureUnits) fail("Record and confirm a long futures position before comparing protective puts.");
      if (b.legs.some((l) => expiryTime(l.expiry) < now)) fail("Reconcile expired legs before hedge comparison.");
      if (!validDate(p.protectThrough) || expiryTime(p.protectThrough) < now) fail("Choose a current or future protection-through date.");
      if (!finite(p.budget) || !finite(p.maxLoss)) fail("Enter a new-purchase budget and maximum acceptable sampled additional loss.");
      const spot = market.spot.price, sq = quoteQuality(market.spot, { now, requireFresh: true, requireTrade: true, maxAge: p.maxAge, maxTradeAge: p.maxTradeAge });
      if (!sq.valid || !finite(spot) || spot <= 0) fail("Spot quote fails freshness/source checks: " + sq.reasons.join("; "));
      const startingFutures = [];
      for (const leg of futures) {
        const match = matchContract(leg, market), q = match.contract ? market.quotes[match.contract.instrumentKey] : null;
        if (match.error || !quoteQuality(q, { now, requireFresh: true, requireTrade: true, maxAge: p.maxAge, maxTradeAge: p.maxTradeAge }).valid) fail("Exact current futures quote/specification unavailable for " + leg.id + ".");
        startingFutures.push({ ...leg, entry: q.price, manual: null });
      }
      let saleProceeds = 0, oldBidValue = 0;
      const sales = /* @__PURE__ */ new Map();
      for (const leg of puts) {
        const match = matchContract(leg, market);
        if (match.error) fail("Existing-put sale price or sufficient displayed bid quantity unavailable for " + leg.id + ".");
        const key = match.contract.instrumentKey;
        sales.set(key, (sales.get(key) || 0) + units(leg));
      }
      for (const [key, quantity] of sales) {
        const q = market.quotes[key];
        if (!quoteQuality(q, { now, requireFresh: true, requireTrade: true, maxAge: p.maxAge, maxTradeAge: p.maxTradeAge }).valid || !finite(q.bid) || q.bid < 0 || !finite(q.bidQty) || q.bidQty < quantity) fail("Existing-put sale price or sufficient combined displayed bid quantity unavailable for " + key + ".");
        oldBidValue += q.bid * quantity;
        saleProceeds += q.bid * (1 - p.slippage / 100) * quantity;
      }
      const shocks = p.shocks || [0, -0.03, -0.05, -0.1], earliestFutures = Math.min(...futures.map((l) => expiryTime(l.expiry))), target = expiryTime(p.protectThrough), defaultHorizon = Math.min(target, earliestFutures), horizons = p.horizons || [now, defaultHorizon];
      const times = [...new Set(horizons.map((h) => validDate(h) ? expiryTime(h) : time(h)))].sort((a, b2) => a - b2);
      if (times.some((t) => !finite(t) || t < now || t > earliestFutures)) fail("Each scenario horizon must be current/future and no later than the earliest futures expiry.");
      result.assumptions = ["Candidates replace all recorded existing puts; exact whole-lot coverage of all current futures units.", "New purchase uses ask plus " + p.slippage + "% slippage; old-put proceeds use bid less the same percentage. Displayed depth is a screen, not a fill guarantee.", "Budget applies to gross new premium plus buy charges before any sale proceeds.", "Sampled additional loss is measured from current futures marks and pays new premium plus buy/exit charges. Existing-put sale proceeds reduce cash needed, not model profit.", "Balanced score = 50% normalized gross purchase cost + 50% normalized sampled worst loss among eligible candidates.", "Sampled worst loss is not a guaranteed maximum loss; no future rollover is assumed."];
      const currentBasis = [...startingFutures, ...puts.map((l) => {
        const match = matchContract(l, market), q = market.quotes[match.contract.instrumentKey];
        return { ...l, entry: q.bid, manual: null };
      })];
      for (const t of times) for (const shock of shocks) {
        const s = scenario(currentBasis, market, { spot: spot * (1 + shock), horizon: t, ivShift: p.ivShift, rate: p.rate, dividend: p.dividend }, now);
        if (s.complete) result.current.push({ horizon: s.horizon, shock, spot: spot * (1 + shock), additionalPnl: s.total });
        else result.currentErrors.push({ horizon: iso(t), shock, reason: s.errors.join("; ") });
      }
      for (const contract of market.contracts.filter((c) => c.type === "PE")) {
        const reasons = [], q = market.quotes[contract.instrumentKey], quality = quoteQuality(q, { now, requireFresh: true, requireTrade: true, maxAge: p.maxAge, maxTradeAge: p.maxTradeAge });
        if (!validDate(contract.expiry) || expiryTime(contract.expiry) < target) reasons.push("Expiry precedes protection-through date");
        if (!Number.isInteger(contract.lotSize) || contract.lotSize <= 0 || futureUnits % contract.lotSize !== 0) reasons.push("Whole lots cannot exactly cover futures units");
        if (!finite(contract.strike) || contract.strike <= 0) reasons.push("Invalid strike");
        reasons.push(...quality.reasons);
        if (!finite(q == null ? void 0 : q.bid) || !finite(q == null ? void 0 : q.ask) || q.bid < 0 || q.ask <= 0 || q.ask < q.bid) reasons.push("Invalid two-sided bid/ask");
        const spread = finite(q == null ? void 0 : q.ask) && finite(q == null ? void 0 : q.bid) && q.ask > 0 ? (q.ask - q.bid) / ((q.ask + q.bid) / 2) * 100 : null;
        if (!finite(spread) || spread > p.maxSpread) reasons.push("Bid/ask spread exceeds limit");
        if (!finite(q == null ? void 0 : q.askQty) || q.askQty < futureUnits || !finite(q == null ? void 0 : q.bidQty) || q.bidQty <= 0) reasons.push("Displayed depth is missing or insufficient");
        if (!finite(q == null ? void 0 : q.volume) || q.volume < p.minVolume) reasons.push("Volume unavailable or below minimum");
        if (!finite(q == null ? void 0 : q.oi) || q.oi < p.minOI) reasons.push("Open interest unavailable or below minimum");
        if (!validGreeks(q, now)) reasons.push("Valid IV/put Greeks with their own source timestamp unavailable");
        const lots = Number.isInteger(contract.lotSize) && contract.lotSize > 0 ? futureUnits / contract.lotSize : null, purchasePrice = finite(q == null ? void 0 : q.ask) ? q.ask * (1 + p.slippage / 100) : null, newPremium = finite(purchasePrice) ? purchasePrice * futureUnits : null, grossCost = finite(newPremium) ? newPremium + p.buyFees : null;
        if (finite(grossCost) && grossCost > p.budget) reasons.push("Gross new-hedge cost exceeds budget");
        if (times.some((t) => t > expiryTime(contract.expiry))) reasons.push("Scenario horizon exceeds candidate expiry");
        if (reasons.length) {
          result.excluded.push({ contract, reasons: [...new Set(reasons)] });
          continue;
        }
        const candidateLeg = { id: "candidate-" + contract.instrumentKey, type: "PE", expiry: contract.expiry, strike: contract.strike, lots, lotSize: contract.lotSize, entry: purchasePrice, manual: null, instrumentKey: contract.instrumentKey }, scenarios = [];
        for (const t of times) for (const shock of shocks) {
          const s = scenario([...startingFutures, candidateLeg], market, { spot: spot * (1 + shock), horizon: t, ivShift: p.ivShift, rate: p.rate, dividend: p.dividend }, now);
          if (!s.complete) reasons.push(...s.errors);
          else scenarios.push({ horizon: s.horizon, shock, spot: spot * (1 + shock), additionalPnl: s.total - p.buyFees - p.exitFees - (oldBidValue - saleProceeds), rows: s.rows });
        }
        const worstLoss = scenarios.length ? Math.max(0, -Math.min(...scenarios.map((s) => s.additionalPnl))) : null;
        if (finite(worstLoss) && worstLoss > p.maxLoss) reasons.push("Sampled additional loss exceeds limit");
        if (reasons.length) {
          result.excluded.push({ contract, reasons: [...new Set(reasons)] });
          continue;
        }
        result.candidates.push({ contract, lots, units: futureUnits, newPremium, grossCost, saleProceeds, netCashRequired: grossCost + p.exitFees - saleProceeds, buyFees: p.buyFees, exitFees: p.exitFees, existingExitSlippage: oldBidValue - saleProceeds, slippage: p.slippage, spread, worstLoss, scenarios, quoteQuality: quality, expiryGap: contract.expiry < futures.map((l) => l.expiry).sort().at(-1), selectionChangesBook: false });
      }
      const cs = result.candidates;
      if (cs.length) {
        const minCost = Math.min(...cs.map((c) => c.grossCost)), maxCost = Math.max(...cs.map((c) => c.grossCost)), minLoss = Math.min(...cs.map((c) => c.worstLoss)), maxLoss = Math.max(...cs.map((c) => c.worstLoss));
        for (const c of cs) c.balancedScore = 0.5 * (maxCost === minCost ? 0 : (c.grossCost - minCost) / (maxCost - minCost)) + 0.5 * (maxLoss === minLoss ? 0 : (c.worstLoss - minLoss) / (maxLoss - minLoss));
        const tie = (a, b2) => a.contract.instrumentKey.localeCompare(b2.contract.instrumentKey);
        result.rankings.lowerCost = [...cs].sort((a, b2) => a.grossCost - b2.grossCost || a.worstLoss - b2.worstLoss || tie(a, b2))[0];
        result.rankings.strongerProtection = [...cs].sort((a, b2) => a.worstLoss - b2.worstLoss || a.grossCost - b2.grossCost || tie(a, b2))[0];
        result.rankings.balanced = [...cs].sort((a, b2) => a.balancedScore - b2.balancedScore || a.grossCost - b2.grossCost || tie(a, b2))[0];
      }
      if (!cs.length) result.errors.push("No listed put passes all chosen checks. Review the excluded reasons; no recommendation was forced.");
      return result;
    } catch (e) {
      result.errors.push(e.message);
      return result;
    }
  }
  function candles(raw) {
    var _a, _b;
    const map = /* @__PURE__ */ new Map(), conflicts = /* @__PURE__ */ new Set();
    for (const x of Array.isArray(raw) ? raw : []) {
      if (!x || typeof x !== "object") continue;
      const r = Array.isArray(x) ? { t: time(x[0]), o: x[1], h: x[2], l: x[3], c: x[4], v: x[5], oi: num(x[6]) } : { t: time((_b = (_a = x.t) != null ? _a : x.time) != null ? _b : x.timestamp), o: num(x.o, x.open), h: num(x.h, x.high), l: num(x.l, x.low), c: num(x.c, x.close), v: num(x.v, x.volume), oi: num(x.oi) };
      if (!finite(r.t) || ![r.o, r.h, r.l, r.c, r.v].every(finite) || Math.min(r.o, r.h, r.l, r.c) <= 0 || r.v < 0 || r.h < Math.max(r.o, r.c, r.l) || r.l > Math.min(r.o, r.c, r.h)) continue;
      if (map.has(r.t) && JSON.stringify(map.get(r.t)) !== JSON.stringify(r)) {
        conflicts.add(r.t);
        continue;
      }
      map.set(r.t, r);
    }
    return [...map.values()].filter((r) => !conflicts.has(r.t)).sort((a, b) => a.t - b.t);
  }
  function completed(rows, frame = "D", now = Date.now()) {
    now = time(now);
    const daily = ["D", "daily", "day"].includes(frame), duration = ["15m", "15minute", "15minutes"].includes(frame) ? 9e5 : 36e5;
    return rows.filter((r) => finite(r == null ? void 0 : r.t) && r.t <= now && (daily ? now >= Date.parse(istDate(r.t) + "T15:30:00+05:30") : r.t + duration <= now));
  }
  function sma(values, n) {
    if (!Number.isInteger(n) || n < 1) fail("Invalid moving-average period.");
    const out = [];
    let acc = 0, bad = 0;
    for (let i = 0; i < values.length; i++) {
      if (finite(values[i])) acc += values[i];
      else bad++;
      if (i >= n) {
        if (finite(values[i - n])) acc -= values[i - n];
        else bad--;
      }
      out.push(i >= n - 1 && !bad ? acc / n : null);
    }
    return out;
  }
  function ema(values, n) {
    if (!Number.isInteger(n) || n < 1) fail("Invalid exponential-average period.");
    let previous = null, window2 = [];
    return values.map((v) => {
      if (!finite(v)) {
        previous = null;
        window2 = [];
        return null;
      }
      if (previous === null) {
        window2.push(v);
        if (window2.length === n) previous = mean(window2);
      } else previous = v * 2 / (n + 1) + previous * (1 - 2 / (n + 1));
      return previous;
    });
  }
  function rsi(values, n = 14) {
    const out = values.map(() => null);
    if (values.length <= n || values.some((x) => !finite(x))) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= n; i++) {
      gain += Math.max(0, values[i] - values[i - 1]);
      loss += Math.max(0, values[i - 1] - values[i]);
    }
    gain /= n;
    loss /= n;
    const score = () => gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    out[n] = score();
    for (let i = n + 1; i < values.length; i++) {
      gain = (gain * (n - 1) + Math.max(0, values[i] - values[i - 1])) / n;
      loss = (loss * (n - 1) + Math.max(0, values[i - 1] - values[i])) / n;
      out[i] = score();
    }
    return out;
  }
  function atr(rows, n = 14) {
    if (rows.length <= n) return null;
    const tr = rows.slice(1).map((r, i) => Math.max(r.h - r.l, Math.abs(r.h - rows[i].c), Math.abs(r.l - rows[i].c)));
    let a = mean(tr.slice(0, n));
    for (const v of tr.slice(n)) a = (a * (n - 1) + v) / n;
    return a;
  }
  function technicals(raw, frame = "D", now = Date.now(), fetchedAt = null) {
    var _a, _b, _c;
    if (frame && typeof frame === "object") {
      const opts = frame;
      frame = opts.frame || "D";
      now = (_a = opts.now) != null ? _a : Date.now();
      fetchedAt = (_b = opts.fetchedAt) != null ? _b : null;
    }
    now = time(now);
    const all = candles(raw), rows = completed(all, frame, now), prices = rows.map((r) => r.c), n = prices.length, last = rows[n - 1], daily = ["D", "daily", "day"].includes(frame);
    const result = { ready: false, stale: true, reason: null, rows, all, frame, asOf: last ? iso(last.t) : null, fetchedAt: iso(fetchedAt), completedCount: n, incompleteCount: all.length - rows.length, close: (_c = last == null ? void 0 : last.c) != null ? _c : null, sma20: null, sma50: null, sma200: null, ema12: null, ema26: null, rsi: null, macd: null, signal: null, hist: null, atr: null, mfi: null, bbLow: null, bbMid: null, bbHigh: null, vol: null, historicalVolatility: null, pivot: null, s1: null, s2: null, r1: null, r2: null, support: null, resistance: null, volumeRatio: null, volumeTrend: "Unavailable", bias: "Insufficient history", evidence: [], series: {} };
    if (!last) {
      result.reason = "No valid completed provider candles.";
      return result;
    }
    const s20 = sma(prices, 20), s50 = sma(prices, 50), s200 = sma(prices, 200), e12 = ema(prices, 12), e26 = ema(prices, 26), macd = prices.map((_, i) => finite(e12[i]) && finite(e26[i]) ? e12[i] - e26[i] : null), signal = ema(macd, 9), rs = rsi(prices), hist = finite(signal[n - 1]) ? macd[n - 1] - signal[n - 1] : null;
    Object.assign(result, { sma20: s20[n - 1], sma50: s50[n - 1], sma200: s200[n - 1], ema12: e12[n - 1], ema26: e26[n - 1], rsi: rs[n - 1], macd: macd[n - 1], signal: signal[n - 1], hist, atr: atr(rows), series: { sma20: s20, sma50: s50, sma200: s200, ema12: e12, ema26: e26, rsi: rs, macd, signal } });
    if (n >= 20) {
      const m = mean(prices.slice(-20)), sd = Math.sqrt(mean(prices.slice(-20).map((v) => (v - m) ** 2)));
      Object.assign(result, { bbMid: m, bbLow: m - 2 * sd, bbHigh: m + 2 * sd, support: Math.min(...rows.slice(-20).map((r) => r.l)), resistance: Math.max(...rows.slice(-20).map((r) => r.h)) });
    }
    if (n >= 15) {
      let positive = 0, negative = 0;
      for (let i = n - 14; i < n; i++) {
        const r = rows[i], p = rows[i - 1], tp = (r.h + r.l + r.c) / 3, previous = (p.h + p.l + p.c) / 3;
        if (tp > previous) positive += tp * r.v;
        else if (tp < previous) negative += tp * r.v;
      }
      result.mfi = positive === 0 && negative === 0 ? 50 : negative === 0 ? 100 : 100 - 100 / (1 + positive / negative);
    }
    const pivot = (last.h + last.l + last.c) / 3;
    Object.assign(result, { pivot, s1: 2 * pivot - last.h, r1: 2 * pivot - last.l, s2: pivot - (last.h - last.l), r2: pivot + (last.h - last.l), pivotMeaning: "Next-bar classic pivots based on the last completed bar." });
    if (n >= 21) {
      const previousVolume = mean(rows.slice(-21, -1).map((r) => r.v));
      if (previousVolume > 0) result.volumeRatio = last.v / previousVolume;
      result.volumeTrend = result.volumeRatio === null ? "Unavailable" : result.volumeRatio >= 1.5 ? "Above 20-bar average" : result.volumeRatio <= 0.5 ? "Below 20-bar average" : "Near 20-bar average";
    }
    if (n >= 21) {
      const tail = prices.slice(-21), returns = tail.slice(1).map((p, i) => Math.log(p / tail[i])), mu = mean(returns), sd = Math.sqrt(sum(returns.map((v) => (v - mu) ** 2)) / (returns.length - 1));
      result.historicalVolatility = { perBar: sd * 100, annualized: daily ? sd * Math.sqrt(252) * 100 : null, observations: returns.length, annualization: daily ? "252 trading sessions; daily log returns" : "Intraday annualization unavailable without a verified exchange/session calendar" };
      result.vol = result.historicalVolatility.annualized;
    }
    const retrieval = time(fetchedAt), lastAge = now - last.t;
    result.stale = !finite(retrieval) || retrieval > now + 5e3 || now - retrieval > 30 * 6e4 || lastAge > (daily ? 5 * DAY : ["15m", "15minute", "15minutes"].includes(frame) ? 30 * 6e4 : 2 * 36e5);
    result.ready = n >= 50;
    result.reason = !result.ready ? "At least 50 completed bars are required for the trend conclusion." : result.stale ? "Candle retrieval or latest completed bar needs refresh." : null;
    let score = 0;
    for (const [label, v] of [["SMA 20", result.sma20], ["SMA 50", result.sma50]]) if (finite(v)) {
      const direction = Math.sign(last.c - v);
      score += direction;
      result.evidence.push({ label, value: v, reading: direction > 0 ? "Close above" : direction < 0 ? "Close below" : "Close equal" });
    }
    if (finite(hist)) {
      score += Math.sign(hist);
      result.evidence.push({ label: "MACD histogram", value: hist, reading: hist > 0 ? "Positive momentum" : hist < 0 ? "Negative momentum" : "Flat" });
    }
    if (finite(result.rsi)) {
      score += result.rsi > 55 ? 1 : result.rsi < 45 ? -1 : 0;
      result.evidence.push({ label: "RSI 14", value: result.rsi, reading: result.rsi > 70 ? "Overbought range" : result.rsi < 30 ? "Oversold range" : "Middle range" });
    }
    result.bias = !result.ready ? "Insufficient history" : result.stale ? "Data needs refresh" : score >= 2 ? "Bullish evidence" : score <= -2 ? "Bearish evidence" : "Mixed evidence";
    return result;
  }
  function patterns(raw, options = {}) {
    var _a, _b, _c, _d;
    const now = (_a = options.now) != null ? _a : Date.now(), frame = options.frame || "D", window2 = (_b = options.window) != null ? _b : 10, forward = (_c = options.forward) != null ? _c : 5, limit = (_d = options.limit) != null ? _d : 12, rows = completed(candles(raw), frame, now);
    const result = { matches: [], sampleCount: 0, observations: rows.length, window: window2, forward, metric: "Root mean square distance between normalized cumulative log-return paths, in percentage points; lower is closer.", summary: null, reason: null, warning: "Historical similarity and sample outcomes are descriptive, not a forecast or independent probability estimate." };
    if (!Number.isInteger(window2) || window2 < 3 || window2 > 100 || !Number.isInteger(forward) || forward < 1 || forward > 100 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      result.reason = "Invalid pattern window, outcome horizon or sample limit.";
      return result;
    }
    if (rows.length < window2 * 2 + forward) {
      result.reason = "Insufficient completed history for a non-overlapping past sample.";
      return result;
    }
    const path = (bars) => bars.map((b) => Math.log(b.c / bars[0].c) * 100), targetStart = rows.length - window2, target = path(rows.slice(targetStart)), candidates = [];
    for (let start = 0; start + window2 + forward <= targetStart; start++) {
      const values = path(rows.slice(start, start + window2)), distance = Math.sqrt(mean(values.map((v, i) => (v - target[i]) ** 2))), end = start + window2 - 1, outcome = (rows[end + forward].c / rows[end].c - 1) * 100;
      candidates.push({ start, end, outcomeEnd: end + forward, from: iso(rows[start].t), to: iso(rows[end].t), outcomeTo: iso(rows[end + forward].t), distance, outcome });
    }
    candidates.sort((a, b) => a.distance - b.distance || a.start - b.start);
    for (const c of candidates) {
      if (result.matches.some((m) => !(c.outcomeEnd < m.start || c.start > m.outcomeEnd))) continue;
      result.matches.push(c);
      if (result.matches.length >= limit) break;
    }
    result.sampleCount = result.matches.length;
    if (!result.sampleCount) {
      result.reason = "No historical samples with completed, non-overlapping outcomes.";
      return result;
    }
    const outcomes = result.matches.map((m) => m.outcome).sort((a, b) => a - b), mid = Math.floor(outcomes.length / 2);
    result.summary = { mean: mean(outcomes), median: outcomes.length % 2 ? outcomes[mid] : (outcomes[mid - 1] + outcomes[mid]) / 2, min: outcomes[0], max: outcomes.at(-1), positiveCount: outcomes.filter((x) => x > 0).length, negativeCount: outcomes.filter((x) => x < 0).length, flatCount: outcomes.filter((x) => x === 0).length };
    return result;
  }
  function carryComparison(input = {}, now = Date.now()) {
    const m = normalizeMarket(input), rows = m.contracts.filter((c) => c.type === "FUT" && expiryTime(c.expiry) >= time(now)).sort((a, b) => a.expiry.localeCompare(b.expiry)), out = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const near = rows[i], far = rows[i + 1], n = m.quotes[near.instrumentKey], f = m.quotes[far.instrumentKey], nq = quoteQuality(n, { now }), fq = quoteQuality(f, { now });
      const days = (expiryTime(far.expiry) - expiryTime(near.expiry)) / DAY, spread = nq.valid && fq.valid ? f.price - n.price : null;
      out.push({ near, far, spread, percent: finite(spread) && n.price > 0 ? spread / n.price * 100 : null, annualized: finite(spread) && n.price > 0 && days > 0 ? spread / n.price * 365 / days * 100 : null, days, stale: nq.status === "stale" || fq.status === "stale", warnings: [...nq.reasons, ...nq.warnings, ...fq.reasons, ...fq.warnings], meaning: "Observed futures price spread, not guaranteed financing cost or a rollover instruction." });
    }
    return out;
  }
  function streamFrame(previous = {}, frame = {}, opts = {}) {
    var _a, _b, _c, _d, _e;
    const now = time((_a = opts.now) != null ? _a : Date.now()), feedAt = time((_c = (_b = frame.feedAt) != null ? _b : frame.currentTs) != null ? _c : frame.current_ts), instrumentKey = frame.instrumentKey || frame.instrument_key, tradeAt = time((_d = frame.tradeAt) != null ? _d : frame.ltt), price = num(frame.price, frame.ltp), old = previous[instrumentKey];
    const reject = (reason) => ({ accepted: false, reason, state: previous, observation: null });
    if (!instrumentKey || !finite(feedAt) || !finite(price) || price < 0) return reject("Missing instrument, feed timestamp or price");
    if (feedAt > now + 5e3 || Number.isFinite(tradeAt) && tradeAt > now + 5e3) return reject("Future-dated streaming frame");
    if (now - feedAt > ((_e = opts.maxAge) != null ? _e : 12e4)) return reject("Old streaming frame");
    if (old && feedAt <= time(old.feedAt)) return reject("Duplicate or out-of-order streaming frame");
    if (old && Number.isFinite(tradeAt) && Number.isFinite(time(old.tradeAt)) && tradeAt < time(old.tradeAt)) return reject("Regressed last-trade timestamp");
    const observation = { instrumentKey, feedAt: iso(feedAt), tradeAt: iso(tradeAt), price, source: "STREAM", purpose: "Live observation only; excluded from portfolio valuation" };
    return { accepted: true, reason: null, state: { ...previous, [instrumentKey]: observation }, observation };
  }
  function cacheRefresh(previous, result, now = Date.now()) {
    const stamp = iso(now);
    if ((result == null ? void 0 : result.ok) === true && result.data && typeof result.data === "object") return { data: clone(result.data), lastSuccess: stamp, lastFailure: (previous == null ? void 0 : previous.lastFailure) || null, failure: null, source: "REST" };
    return { data: (previous == null ? void 0 : previous.data) ? clone(previous.data) : null, lastSuccess: (previous == null ? void 0 : previous.lastSuccess) || null, lastFailure: stamp, failure: safeText((result == null ? void 0 : result.error) || "Refresh failed", 500), source: (previous == null ? void 0 : previous.data) ? "CACHE" : "UNAVAILABLE" };
  }
  function journalCSV(book) {
    var _a, _b, _c, _d, _e, _f, _g;
    const b = validateBook(book), columns = ["id", "kind", "date", "type", "expiry", "strike", "lots", "units_per_lot", "entry", "exit", "gross_realized", "charges", "cash_movement", "note"], rows = [columns];
    for (const j of b.journal) rows.push([j.id, j.kind, j.date, (_a = j.leg) == null ? void 0 : _a.type, (_b = j.leg) == null ? void 0 : _b.expiry, (_c = j.leg) == null ? void 0 : _c.strike, (_d = j.leg) == null ? void 0 : _d.lots, (_e = j.leg) == null ? void 0 : _e.lotSize, (_f = j.leg) == null ? void 0 : _f.entry, j.exit, j.kind === "close" ? (j.exit - j.leg.entry) * units(j.leg) : null, j.kind === "close" ? j.fees : j.kind === "fee" ? j.amount : null, ["settlement", "funding"].includes(j.kind) ? j.amount : null, j.note]);
    for (const j of ((_g = b.legacy) == null ? void 0 : _g.journal) || []) rows.push([j.id, "legacy_" + j.kind, j.date, null, null, null, null, null, null, null, j.kind === "close" ? j.amount : null, j.kind === "fee" ? j.amount : null, j.kind === "settlement" ? j.amount : null, j.note]);
    const cell = (v) => {
      if (v == null) return '""';
      let s = String(v);
      if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  }
  const api = { DAY, YEAR, finite, value, time, iso, validDate, istDate, expiryTime, units, safeURL, validateLeg, emptyBook, validateBook, normalizeMarket, normQuote, quoteQuality, matchContract, resolveMark, ledger, closeLeg, recordCash, validGreeks, risk, cdf, putPrice, scenario, payoff, hedgePreferences, findHedges, candles, completed, sma, ema, rsi, atr, technicals, patterns, carryComparison, streamFrame, cacheRefresh, journalCSV };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HAL4Engine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
;
(function(root) {
  "use strict";
  const finite = (x) => typeof x === "number" && Number.isFinite(x);
  const number = (x) => finite(x) ? x : null;
  const stamp = (x) => typeof x === "string" && Number.isFinite(Date.parse(x)) ? new Date(Date.parse(x)).toISOString() : null;
  const text = (x, n = 200) => typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n) : null;
  const array = (x) => Array.isArray(x) ? x : [];
  const iso = (now) => new Date(now).toISOString();
  function safeURL(value) {
    try {
      const u = new URL(value);
      return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
    } catch (_) {
      return null;
    }
  }
  function select(source, keys) {
    const out = {};
    for (const k of keys) {
      const x = source == null ? void 0 : source[k];
      if (typeof x === "boolean" || x === null || finite(x)) out[k] = x;
      else if (typeof x === "string") out[k] = text(x, 300);
    }
    return out;
  }
  function canonical(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    return "{" + Object.keys(value).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  }
  function fingerprint(value) {
    let h = 2166136261;
    const s = canonical(value);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return "rev-" + (h >>> 0).toString(16).padStart(8, "0");
  }
  function contract(leg) {
    return select(leg, ["id", "type", "expiry", "strike", "lots", "lotSize", "entry", "manual", "manualAt", "instrumentKey"]);
  }
  function materialFingerprint(book) {
    var _a;
    return fingerprint({ legs: array(book == null ? void 0 : book.legs).map(contract), journal: array(book == null ? void 0 : book.journal).map((j) => ({ id: j.id, kind: j.kind, date: j.date, leg: j.leg ? contract(j.leg) : null, exit: number(j.exit), fees: number(j.fees), amount: number(j.amount) })), legacy: select(book == null ? void 0 : book.legacy, ["realized", "costs"]), funding: select(book == null ? void 0 : book.funding, ["margin", "free", "at"]), markMode: ((_a = book == null ? void 0 : book.preferences) == null ? void 0 : _a.markMode) || "ltp", riskProfile: select(book == null ? void 0 : book.riskProfile, ["capital", "maxLoss", "hedgeBudget", "reserve", "minCoverage", "maxMarginUsage", "reviewBelow", "reviewAbove", "expiryWarningDays"]) });
  }
  function isBookConfirmed(book, now = Date.now()) {
    var _a, _b;
    const at = Date.parse((_a = book == null ? void 0 : book.riskProfile) == null ? void 0 : _a.confirmedAt);
    return Number.isFinite(at) && at <= now + 6e4 && ((_b = book == null ? void 0 : book.riskProfile) == null ? void 0 : _b.confirmedBook) === materialFingerprint(book);
  }
  function marketEvidence(market = {}) {
    const quote = (q) => {
      if (!q || typeof q !== "object") return null;
      return select(q, ["instrumentKey", "symbol", "price", "last_price", "change", "changePct", "prevClose", "previousClose", "quoteAt", "tradeAt", "retrievedAt", "source", "status", "cached", "lastSuccess", "lastFailure", "error"]);
    };
    return { spot: quote(market.spot), nifty: quote(market.nifty), vix: quote(market.vix), status: select(market.status, ["state", "status", "market", "exchange", "source", "asOf", "retrievedAt"]), lastSuccess: stamp(market.lastSuccess), lastFailure: stamp(market.lastFailure), failureReason: text(market.error || market.failureReason) };
  }
  function normalizeNews(raw) {
    return array(raw).map((n) => ({ id: text(n.id, 120), title: text(n.title || n.headline, 260), url: safeURL(n.url || n.link), source: text(n.source, 100), publishedAt: stamp(n.publishedAt || n.published_at || n.date), retrievedAt: stamp(n.retrievedAt || n.retrieved_at), official: n.official === true, topic: text(n.topic, 60), summary: text(n.summary, 500) })).filter((n) => n.title);
  }
  function newsGroups(raw) {
    const groups = /* @__PURE__ */ new Map();
    for (const n of normalizeNews(raw)) {
      const key = n.title.toLowerCase().replace(/\bhal\b/g, "hindustan aeronautics").replace(/[^a-z0-9]+/g, " ").trim();
      if (!groups.has(key)) groups.set(key, { ...n, duplicates: [] });
      else {
        const group = groups.get(key);
        group.duplicates.push(n);
        if (n.official && !group.official) {
          const old = { ...group };
          delete old.duplicates;
          Object.assign(group, n);
          group.duplicates = [old, ...group.duplicates.filter((x) => x !== n)];
        }
      }
    }
    return [...groups.values()].sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
  }
  function technicalEvidence(t = {}) {
    const out = select(t, ["bias", "frame", "completedCount", "vol", "asOf", "interval", "bars", "ready", "stale", "reason", "trend", "momentum", "sma20", "sma50", "sma200", "ema12", "ema26", "rsi", "rsi14", "atr", "atr14", "mfi", "mfi14", "historicalVolatility", "hv", "volumeTrend"]);
    if (finite(t.macd)) out.macd = { value: t.macd, signal: number(t.signal), histogram: number(t.hist) };
    if (finite(t.bbMid)) out.bollinger = { lower: number(t.bbLow), middle: t.bbMid, upper: number(t.bbHigh) };
    if (finite(t.pivot)) out.pivots = select(t, ["pivot", "r1", "r2", "s1", "s2"]);
    for (const k of ["macd", "bollinger", "pivots"]) if (t[k] && typeof t[k] === "object") out[k] = select(t[k], ["value", "macd", "signal", "histogram", "upper", "middle", "lower", "pivot", "r1", "r2", "r3", "s1", "s2", "s3"]);
    for (const k of ["support", "resistance"]) {
      const v = t[k];
      out[k] = finite(v) ? v : array(v).filter(finite).slice(0, 5);
    }
    return out;
  }
  function valuationEvidence(v = {}) {
    return { ...select(v, ["open", "realized", "charges", "net", "complete", "openPutPremium", "settlements", "fundingMovements"]), rows: array(v.rows).slice(0, 30).map((r) => ({ leg: contract(r.leg || {}), units: number(r.units), pnl: number(r.pnl), mark: select(r.mark, ["price", "source", "quoteAt", "tradeAt", "retrievedAt", "status"]) })) };
  }
  function riskEvidence(r = {}) {
    return { ...select(r, ["futureUnits", "putUnits", "coveredUnits", "uncoveredUnits", "coverage", "delta", "theta", "greeksComplete", "nextExpiry"]), warnings: array(r.warnings).slice(0, 12).map((w) => typeof w === "string" ? text(w, 220) : select(w, ["code", "title", "detail"])), distribution: array(r.distribution).slice(0, 30).map((x) => select(x, ["expiry", "strike", "units", "lots", "type"])) };
  }
  function scenarioEvidence(s) {
    return array(s).slice(0, 12).map((x) => ({ ...select(x, ["total", "horizon", "complete", "spot", "shock", "ivShift", "rate", "dividend"]), errors: array(x.errors).map((x2) => text(x2, 160)).slice(0, 5), assumptions: array(x.assumptions).map((x2) => text(x2, 200)).slice(0, 6), rows: array(x.rows).slice(0, 30).map((r) => ({ leg: contract(r.leg || {}), modelPrice: number(r.modelPrice), pnl: number(r.pnl), iv: number(r.iv) })) }));
  }
  function fundamentalEvidence(f = {}) {
    var _a;
    const profile = select(f.profile, ["name", "symbol", "sector", "industry", "description", "source", "retrievedAt"]);
    profile.url = safeURL((_a = f.profile) == null ? void 0 : _a.url);
    const metrics = array(f.metrics).slice(0, 30).map((m) => ({ ...select(m, ["label", "value", "unit", "period", "source", "retrievedAt", "kind"]), url: safeURL(m.url) })).filter((m) => m.label && (m.kind === "provider" || m.kind === "derived"));
    return { profile, metrics };
  }
  function providerFundamentals(packet) {
    const metrics = [], data = (packet == null ? void 0 : packet.data) || {}, retrievedAt = stamp(packet == null ? void 0 : packet.fetched_at_iso), source = "Upstox official API";
    function walk(v, path, context = {}, depth = 0) {
      var _a, _b, _c, _d, _e, _f, _g;
      if (depth > 8 || metrics.length >= 30) return;
      if (Array.isArray(v)) {
        v.slice(0, 20).forEach((x, i) => walk(x, path + " [" + (i + 1) + "]", context, depth + 1));
        return;
      }
      if (v && typeof v === "object") {
        const c = { period: (_d = (_c = (_b = (_a = v.period) != null ? _a : v.reporting_period) != null ? _b : v.fiscal_year) != null ? _c : v.year) != null ? _d : context.period, unit: (_g = (_f = (_e = v.unit) != null ? _e : v.units) != null ? _f : v.currency) != null ? _g : context.unit };
        for (const [k, x] of Object.entries(v)) walk(x, path + " / " + k, c, depth + 1);
      } else if (finite(v)) metrics.push({ label: path, value: v, period: context.period == null ? null : String(context.period), unit: context.unit == null ? null : String(context.unit), source, retrievedAt, kind: "provider" });
    }
    for (const k of ["income", "annual", "ratios", "balance", "cash", "shareholding"]) if (data[k]) walk(data[k], k);
    return { profile: { symbol: "HAL", source, retrievedAt }, metrics };
  }
  function evidencePacket(input = {}, options = {}) {
    var _a, _b, _c, _d, _e;
    const now = (_a = options.now) != null ? _a : Date.now(), mode = options.mode || "research";
    if (!["research", "copilot", "deliberate"].includes(mode)) throw Error("Unknown AI review mode.");
    const includePortfolio = mode !== "research" && options.includePortfolio === true;
    const market = marketEvidence(input.market || {}), news = normalizeNews(input.news).slice(0, 12);
    const sources = /* @__PURE__ */ new Map();
    for (const n of news) if (n.url) sources.set(n.url, { label: n.source || n.title, url: n.url, publishedAt: n.publishedAt, retrievedAt: n.retrievedAt });
    for (const s of array(input.sources)) {
      const url = safeURL(s.url);
      if (url) sources.set(url, { label: text(s.label || s.title || s.source, 150), url, publishedAt: stamp(s.publishedAt), retrievedAt: stamp(s.retrievedAt) });
    }
    const packet = { schemaVersion: 4, generatedAt: iso(now), quoteAsOf: ((_b = market.spot) == null ? void 0 : _b.quoteAt) || null, portfolioIncluded: includePortfolio, market, technical: technicalEvidence(input.technical), fundamentals: fundamentalEvidence(input.fundamentals), news, sources: [...sources.values()].slice(0, 20) };
    if (includePortfolio) {
      packet.bookRevision = materialFingerprint(input.book);
      packet.portfolio = { confirmedAt: isBookConfirmed(input.book, now) ? stamp(input.book.riskProfile.confirmedAt) : null, legs: array((_c = input.book) == null ? void 0 : _c.legs).slice(0, 30).map(contract) };
      packet.valuation = valuationEvidence(input.valuation || input.ledger);
      packet.risk = riskEvidence(input.risk);
      packet.scenarios = scenarioEvidence(input.scenarios);
      packet.funding = select(input.funding || ((_d = input.book) == null ? void 0 : _d.funding), ["margin", "free", "at", "source"]);
      packet.coach = coach(input, now).map((x) => select(x, ["code", "severity", "title", "detail"]));
    }
    let serialized = JSON.stringify(packet);
    if (serialized.length > 23e3) {
      packet.news = packet.news.slice(0, 5);
      packet.scenarios = (_e = packet.scenarios) == null ? void 0 : _e.slice(0, 4);
      serialized = JSON.stringify(packet);
    }
    if (serialized.length > 24e3) throw Error("Evidence exceeds the safe request limit. Review fewer legs or scenarios.");
    return packet;
  }
  function coach(input = {}, now = Date.now()) {
    var _a;
    const book = input.book || {}, risk = input.risk || {}, valuation = input.valuation || input.ledger || {}, market = input.market || {}, items = [];
    const add = (code, severity, title, detail) => items.push({ code, severity, title, detail });
    if (!array(book.legs).length) add("EMPTY_BOOK", "info", "Research is available", "No current holdings are assumed. Record and confirm your actual broker position before position analysis.");
    else {
      if (!isBookConfirmed(book, now)) add("CONFIRM_BOOK", "review", "Confirm the saved book", "Compare every expiry, strike, quantity and entry against your broker.");
      if (valuation.complete === false) add("INCOMPLETE_MARKS", "review", "Basket P&L is unavailable", "One or more necessary marks are missing or invalid. Review each leg; missing values are not zero.");
      if (finite(risk.coverage) && risk.coverage < 100) add("QUANTITY_GAP", "review", "Protection quantity is incomplete", "".concat((_a = risk.uncoveredUnits) != null ? _a : "Some", " futures units are uncovered. Quantity coverage does not guarantee a loss limit."));
      if (risk.greeksComplete === false) add("GREEKS_INCOMPLETE", "info", "Net Greeks are unavailable", "Required contract Greeks are missing or invalid.");
      for (const w of array(risk.warnings)) {
        const title = typeof w === "string" ? w : w.title;
        add(w.code || "RISK_REVIEW", "review", text(title, 120), text(typeof w === "string" ? w : w.detail, 300));
      }
      const funding = input.funding || book.funding || {}, at = Date.parse(funding.at);
      if (!Number.isFinite(at) || at > now + 6e4 || now - at > 864e5) add("FUNDING_STALE", "review", "Review margin and available funds", "The latest manual funding snapshot is missing, future-dated or over 24 hours old. Broker margin can change.");
    }
    const spot = market.spot || {}, quoted = Date.parse(spot.quoteAt), trade = Date.parse(spot.tradeAt);
    if (!Number.isFinite(quoted)) add("SOURCE_TIME_MISSING", "review", "Quote time is unavailable", "HTTP retrieval time does not establish a fresh exchange quote.");
    else if (quoted > now + 6e4 || Number.isFinite(trade) && trade > now + 6e4) add("CLOCK_MISMATCH", "review", "Check source and device clocks", "A source timestamp is ahead of this device.");
    else if (now - quoted > 12e4) add("QUOTE_STALE", "info", "Using an older observation", "The last quote is older than two minutes. Review the source timestamp and official market status.");
    if (market.lastFailure && (!market.lastSuccess || Date.parse(market.lastFailure) > Date.parse(market.lastSuccess))) add("REFRESH_FAILED", "review", "Last refresh failed", text(market.error || market.failureReason || "Previously cached data remains visible and is not a successful refresh.", 300));
    return items.slice(0, 24);
  }
  function checkpoint(input = {}, now = Date.now()) {
    var _a, _b, _c, _d, _e, _f;
    const v = input.valuation || input.ledger || {}, r = input.risk || {}, spot = ((_a = input.market) == null ? void 0 : _a.spot) || {};
    return { version: 4, savedAt: iso(now), bookRevision: materialFingerprint(input.book), quoteAsOf: stamp(spot.quoteAt), spot: number((_b = spot.price) != null ? _b : spot.last_price), open: number(v.open), complete: v.complete === true, coverage: number(r.coverage), delta: number(r.delta), theta: number(r.theta), rsi: number((_e = (_c = input.technical) == null ? void 0 : _c.rsi) != null ? _e : (_d = input.technical) == null ? void 0 : _d.rsi14), newsURLs: normalizeNews(input.news).map((n) => n.url).filter(Boolean).slice(0, 100), legs: array((_f = input.book) == null ? void 0 : _f.legs).map(contract) };
  }
  function changes(previous, current, news = []) {
    const base = { ready: false, reason: null, sameBook: false, from: (previous == null ? void 0 : previous.savedAt) || null, to: (current == null ? void 0 : current.savedAt) || null };
    const a = Date.parse(previous == null ? void 0 : previous.savedAt), b = Date.parse(current == null ? void 0 : current.savedAt);
    if (!previous || previous.version !== 4 || !Number.isFinite(a) || !current || current.version !== 4 || !Number.isFinite(b)) return { ...base, reason: "Save a new review checkpoint to begin comparison." };
    if (a > b) return { ...base, reason: "Previous checkpoint is ahead of the current clock." };
    const sameBook = previous.bookRevision === current.bookRevision, diff = (a2, b2) => finite(a2) && finite(b2) ? b2 - a2 : null, seen = new Set(array(previous.newsURLs));
    return { ...base, ready: true, sameBook, fromQuote: previous.quoteAsOf, toQuote: current.quoteAsOf, spot: diff(previous.spot, current.spot), open: sameBook && previous.complete && current.complete ? diff(previous.open, current.open) : null, coverage: sameBook ? diff(previous.coverage, current.coverage) : null, delta: sameBook ? diff(previous.delta, current.delta) : null, theta: sameBook ? diff(previous.theta, current.theta) : null, rsi: diff(previous.rsi, current.rsi), newNews: normalizeNews(news).filter((n) => n.url && !seen.has(n.url)).slice(0, 12), reason: sameBook ? "Changes compare saved observations; price movements are not attributed to news." : "The book changed. Open P&L and exposure changes are withheld as like-for-like comparisons." };
  }
  function canUseAnswer(answer, book) {
    return Boolean(answer && answer.portfolioIncluded === false || answer && answer.bookRevision && answer.bookRevision === materialFingerprint(book));
  }
  const api = { safeURL, canonical, materialFingerprint, isBookConfirmed, contract, normalizeNews, newsGroups, fundamentalEvidence, providerFundamentals, evidencePacket, coach, checkpoint, changes, canUseAnswer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.HAL4Insights = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
;
(function(root) {
  "use strict";
  const E = typeof module === "object" ? require("./engine4.js") : root.HAL4Engine, clone = (x) => JSON.parse(JSON.stringify(x)), stamp = () => (/* @__PURE__ */ new Date()).toISOString();
  const errors = { credential_missing: "Add an Upstox Analytics Token in Connection.", token_expired_or_unauthorized: "Upstox rejected or expired the token. Replace it in Connection.", upstox_permission_denied: "This token cannot access this feed.", upstox_rate_limited: "Upstox rate limit reached. Wait before refreshing.", network_unavailable: "Network unavailable. Saved observations are retained.", bad_response: "Provider response could not be validated.", expiry_not_listed: "This exact expiry is no longer listed.", no_hal_option_contracts: "No eligible HAL option contracts were returned.", redirect_blocked: "An unexpected provider redirect was blocked.", cancelled: "Request cancelled when leaving the foreground." };
  function message(code) {
    return errors[code] || String(code || "Data unavailable").replace(/_/g, " ");
  }
  const object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const errorSummary = (data) => {
    var _a;
    const e = { ...object((_a = data == null ? void 0 : data.data) == null ? void 0 : _a.errors) ? data.data.errors : {}, ...object(data == null ? void 0 : data.errors) ? data.errors : {} };
    if (data == null ? void 0 : data.chain_error) e.chain = data.chain_error;
    return Object.keys(e).length ? Object.entries(e).map(([k, v]) => k + ": " + message(v)).join("; ") : null;
  };
  function empty() {
    return { snapshot: null, research: {}, health: {}, lastSuccess: null, lastFailure: null, failure: null, loading: false, cached: false, stream: null };
  }
  function key(section, frame = "D", type = "consolidated") {
    return section + ":" + frame + (section === "fundamentals" ? ":" + type : "");
  }
  function ingest(state, event, data, now = stamp()) {
    const s = { ...state, research: { ...state.research }, health: { ...state.health } };
    if (event === "loading") {
      s.loading = true;
      s.health.market = { ...s.health.market, pending: now };
    }
    if (event === "idle") s.loading = false;
    if (event === "snapshot") {
      if (!data || !Array.isArray(data.futures) || data.spot != null && typeof data.spot !== "object") return ingest(s, "error", { code: "bad_response" }, now);
      s.snapshot = { ...clone(data), _received_at: now, _cache: false };
      s.lastSuccess = now;
      s.failure = null;
      s.cached = false;
      s.loading = false;
      s.health.market = { ...s.health.market, pending: null, lastSuccess: now, error: errorSummary(data) };
    }
    if (event === "error") {
      s.lastFailure = now;
      s.failure = data.code || "network_unavailable";
      s.loading = false;
      s.health.market = { ...s.health.market, pending: null, lastFailure: now, error: s.failure };
    }
    if (event === "research") {
      if (!object(data) || typeof data.section !== "string" || !object(data.data)) return ingest(s, "research_error", { key: object(data) && data.section ? key(data.section, data.frame, data.type) : "research:D", code: "bad_response" }, now);
      const k = key(data.section, data.frame, data.type);
      s.research[k] = { ...clone(data), _received_at: now, _cache: false };
      s.health[k] = { ...s.health[k], pending: null, lastSuccess: now, error: errorSummary(data) };
    }
    if (event === "research_error") {
      const rawKey = data.key || key(data.section, data.frame, data.type), k = rawKey.startsWith("fundamentals:") ? rawKey : rawKey.replace(/:(consolidated|standalone)$/, "");
      s.health[k] = { ...s.health[k], pending: null, lastFailure: now, error: data.code || "network_unavailable" };
    }
    if (event === "stream") s.stream = clone(data);
    return s;
  }
  function packet(s, section, frame = "D", type = "consolidated") {
    return s.research[key(section, frame, type)] || s.research[section + ":" + frame] || null;
  }
  function market(s) {
    var _a, _b, _c, _d;
    const result = { contracts: [], quotes: {}, spot: E.normQuote({}), lastSuccess: s.lastSuccess, lastFailure: s.lastFailure, failure: s.failure };
    const contracts = /* @__PURE__ */ new Map();
    const tag = (q, p, h) => ({ ...q, source: p._cache ? "CACHE" : q.source, lastSuccess: (h == null ? void 0 : h.lastSuccess) || p._received_at || p.fetched_at_iso, lastFailure: (h == null ? void 0 : h.lastFailure) || null, failure: (h == null ? void 0 : h.error) || null });
    const choose = (a, b) => {
      if (!a) return b;
      const av = Date.parse(a.quoteAt), bv = Date.parse(b.quoteAt), at = Date.parse(a.tradeAt), bt = Date.parse(b.tradeAt);
      if (Number.isFinite(at) && Number.isFinite(bt) && bt < at) return a;
      if (Number.isFinite(av) && (!Number.isFinite(bv) || bv < av)) return a;
      if (bv === av && Date.parse(b.retrievedAt) < Date.parse(a.retrievedAt)) return a;
      return b;
    };
    const add = (raw, p, h) => {
      const m = E.normalizeMarket(raw);
      for (const c of m.contracts) contracts.set(c.instrumentKey, c);
      for (const [k, q] of Object.entries(m.quotes)) result.quotes[k] = choose(result.quotes[k], tag(q, p, h));
      return m;
    };
    if (s.snapshot) {
      const m = add(s.snapshot, s.snapshot, s.health.market);
      result.spot = tag(m.spot, s.snapshot, s.health.market);
    }
    for (const p of Object.values(s.research)) {
      const d = p == null ? void 0 : p.data;
      if (!d) continue;
      const h = s.health[key(p.section, p.frame, p.type)];
      if (["chain", "hedges"].includes(p.section)) add(d, p, h);
      if (p.section === "contracts") add({ held_contracts: (d.contracts || []).filter((c) => c.verified || c.reason === "lot_size_mismatch").map((c) => ({ ...c, type: c.type === "PUT" ? "PE" : c.type })), fetched_at_iso: p.fetched_at_iso }, p, h);
    }
    result.contracts = [...contracts.values()];
    const held = packet(s, "contracts");
    if (held) {
      for (const c of ((_a = held.data) == null ? void 0 : _a.contracts) || []) if (!c.verified && !["lot_size_mismatch", "instrument_key_mismatch"].includes(c.reason)) {
        const type = c.type === "PUT" ? "PE" : c.type;
        result.contracts = result.contracts.filter((x) => !(x.type === type && x.expiry === c.expiry && (type !== "PE" || x.strike === c.strike)));
      }
    }
    const status = (_c = (_b = packet(s, "status")) == null ? void 0 : _b.data) == null ? void 0 : _c.market;
    result.status = status || {};
    result.marketOpen = (status == null ? void 0 : status.status) === "NORMAL_OPEN";
    const context = packet(s, "context");
    for (const [k, q] of Object.entries(((_d = context == null ? void 0 : context.data) == null ? void 0 : _d.indices) || {})) {
      const name = (q.symbol || q.instrument_token || k).toLowerCase(), n = tag(E.normQuote(q), context, s.health[key("context")]);
      if (name.includes("vix")) result.vix = n;
      else if (name.includes("nifty") && name.includes("50")) result.nifty = n;
    }
    return result;
  }
  function rawCandles(s, frame = "D", section = "candles") {
    var _a, _b, _c, _d, _e;
    const p = packet(s, section, frame), d = (p == null ? void 0 : p.data) || {};
    const malformed = [(_a = d.history) == null ? void 0 : _a.candles, (_b = d.intraday) == null ? void 0 : _b.candles].some((x) => x != null && !Array.isArray(x));
    return { raw: [...Array.isArray((_c = d.history) == null ? void 0 : _c.candles) ? d.history.candles : [], ...Array.isArray((_d = d.intraday) == null ? void 0 : _d.candles) ? d.intraday.candles : []], retrievedAt: (p == null ? void 0 : p.fetched_at_iso) || null, error: malformed ? "bad_response" : ((_e = s.health[key(section, frame)]) == null ? void 0 : _e.error) || null };
  }
  function news(s) {
    var _a, _b, _c, _d, _e, _f;
    const result = [];
    const flatten = (x) => Array.isArray(x) ? x : x && typeof x === "object" ? Object.values(x).flatMap(flatten) : [];
    for (const section of ["news", "filings"]) {
      const p = packet(s, section), d = (p == null ? void 0 : p.data) || {};
      let list = section === "filings" ? d.items : d.articles;
      list = flatten(list);
      for (const n of list) {
        if (!n || typeof n !== "object") continue;
        const t = (_e = (_d = (_c = (_b = (_a = n.published_time) != null ? _a : n.publishedAt) != null ? _b : n.published_at) != null ? _c : n.published) != null ? _d : n.published_date) != null ? _e : n.date;
        result.push({ title: n.heading || n.title || n.headline, url: n.article_link || n.url || n.link || n.news_url, publishedAt: typeof t === "number" ? Number.isFinite(t) && Math.abs(t) <= 864e13 ? new Date(t).toISOString() : null : t, source: typeof n.source === "string" ? n.source : ((_f = n.source) == null ? void 0 : _f.name) || (section === "filings" ? "NSE disclosure" : "Upstox news"), summary: n.summary || n.description, official: section === "filings" || n.official === true, retrievedAt: p == null ? void 0 : p.fetched_at_iso, topic: n.topic || "Business" });
      }
    }
    return result;
  }
  function safeBackup(book) {
    return { app: "HAL Desk", schema: 4, exportedAt: stamp(), book: E.validateBook(book) };
  }
  function previewImport(raw) {
    if (!raw || typeof raw !== "object") throw Error("Invalid backup.");
    if (raw.schema != null && ![2, 4].includes(raw.schema)) throw Error("Unsupported backup schema.");
    let b = raw.book || raw;
    if (b.version === 1) b = { ...E.emptyBook(), legs: b.legs };
    const clean = E.validateBook(b);
    clean.riskProfile.confirmedAt = null;
    clean.riskProfile.confirmedBook = null;
    if (Array.isArray(raw.history)) clean.migration = { ...clean.migration || {}, legacyPriceHistory: clone(raw.history) };
    return clean;
  }
  function loadBook(native, storage) {
    if (native == null ? void 0 : native.loadBook) {
      const r = JSON.parse(native.loadBook());
      if (!r.ok) throw Error(r.message || "Native storage could not be read.");
      if (r.book) return { book: E.validateBook(typeof r.book === "string" ? JSON.parse(r.book) : r.book), revision: r.revision, migrated: false };
    }
    const current = storage.getItem("hal_desk_v4");
    if (current) return { book: E.validateBook(JSON.parse(current)), revision: 0, migrated: false };
    let legacy = storage.getItem("hal_desk_v2"), from = "hal_desk_v2";
    if (!legacy) {
      legacy = storage.getItem("hal_positions_v1");
      from = "hal_positions_v1";
    }
    if (legacy) {
      let b = JSON.parse(legacy);
      if (b.version === 1) b = { ...E.emptyBook(), legs: b.legs };
      const book = E.validateBook(b);
      book.migration = { ...book.migration || {}, fromKey: from, at: stamp(), reviewRequired: true };
      for (const [k, label] of [["hal_checkpoint_v1", "legacyCheckpoint"], ["hal_last_visit_v2", "legacyLastVisit"]]) {
        try {
          const x = storage.getItem(k);
          if (x) book.migration[label] = JSON.parse(x);
        } catch (_) {
        }
      }
      try {
        const old = JSON.parse(storage.getItem("hal_cache_v2") || "null");
        if (old == null ? void 0 : old.history) book.migration.legacyPriceHistory = old.history;
      } catch (_) {
      }
      return { book, revision: 0, migrated: true };
    }
    return { book: E.emptyBook(), revision: 0, migrated: false };
  }
  function saveBook(native, storage, book, revision) {
    const clean = E.validateBook(book);
    if (native == null ? void 0 : native.saveBook) {
      const r = JSON.parse(native.saveBook(JSON.stringify(clean), revision));
      if (!r.ok) throw Error(r.message || "Book save failed; changes not committed.");
      return { book: clean, revision: r.revision };
    }
    const old = storage.getItem("hal_desk_v4");
    if (old) storage.setItem("hal_previous_v4", old);
    storage.setItem("hal_desk_v4", JSON.stringify(clean));
    return { book: clean, revision: revision + 1 };
  }
  function cache(s) {
    return { version: 4, snapshot: s.snapshot, research: s.research, health: s.health, lastSuccess: s.lastSuccess, lastFailure: s.lastFailure, failure: s.failure };
  }
  function restoreCache(raw) {
    if (!raw || typeof raw !== "object") return empty();
    const s = { ...empty(), ...raw, loading: false, cached: true, stream: null };
    s.health = object(s.health) ? clone(s.health) : {};
    if (s.snapshot) s.snapshot = { ...s.snapshot, _cache: true };
    s.research = { ...s.research || {} };
    for (const [k, p] of Object.entries(s.research)) s.research[k] = { ...p, _cache: true };
    for (const [k, h] of Object.entries(s.health)) {
      if (object(h)) h.pending = null;
      else delete s.health[k];
    }
    return s;
  }
  const api = { empty, key, ingest, packet, market, rawCandles, news, message, safeBackup, previewImport, loadBook, saveBook, cache, restoreCache };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.HAL4Data = api;
})(typeof globalThis === "undefined" ? this : globalThis);
;
/*!
 * @license
 * TradingView Lightweight Charts™ v5.0.8
 * Copyright (c) 2025 TradingView, Inc.
 * Licensed under Apache License 2.0 https://www.apache.org/licenses/LICENSE-2.0
 */
!(function() {
  "use strict";
  var _a;
  const t = { title: "", visible: true, lastValueVisible: true, priceLineVisible: true, priceLineSource: 0, priceLineWidth: 1, priceLineColor: "", priceLineStyle: 2, baseLineVisible: true, baseLineWidth: 1, baseLineColor: "#B2B5BE", baseLineStyle: 0, priceFormat: { type: "price", precision: 2, minMove: 0.01 } };
  var i, s;
  function n(t2, i2) {
    const s2 = { 0: [], 1: [t2.lineWidth, t2.lineWidth], 2: [2 * t2.lineWidth, 2 * t2.lineWidth], 3: [6 * t2.lineWidth, 6 * t2.lineWidth], 4: [t2.lineWidth, 4 * t2.lineWidth] }[i2];
    t2.setLineDash(s2);
  }
  function e(t2, i2, s2, n2) {
    t2.beginPath();
    const e2 = t2.lineWidth % 2 ? 0.5 : 0;
    t2.moveTo(s2, i2 + e2), t2.lineTo(n2, i2 + e2), t2.stroke();
  }
  function r(t2, i2) {
    if (!t2) throw new Error("Assertion failed" + (i2 ? ": " + i2 : ""));
  }
  function h(t2) {
    if (void 0 === t2) throw new Error("Value is undefined");
    return t2;
  }
  function a(t2) {
    if (null === t2) throw new Error("Value is null");
    return t2;
  }
  function l(t2) {
    return a(h(t2));
  }
  !(function(t2) {
    t2[t2.Simple = 0] = "Simple", t2[t2.WithSteps = 1] = "WithSteps", t2[t2.Curved = 2] = "Curved";
  })(i || (i = {})), (function(t2) {
    t2[t2.Solid = 0] = "Solid", t2[t2.Dotted = 1] = "Dotted", t2[t2.Dashed = 2] = "Dashed", t2[t2.LargeDashed = 3] = "LargeDashed", t2[t2.SparseDotted = 4] = "SparseDotted";
  })(s || (s = {}));
  class o {
    constructor() {
      this.t = [];
    }
    i(t2, i2, s2) {
      const n2 = { h: t2, l: i2, o: true === s2 };
      this.t.push(n2);
    }
    _(t2) {
      const i2 = this.t.findIndex(((i3) => t2 === i3.h));
      i2 > -1 && this.t.splice(i2, 1);
    }
    u(t2) {
      this.t = this.t.filter(((i2) => i2.l !== t2));
    }
    p(t2, i2, s2) {
      const n2 = [...this.t];
      this.t = this.t.filter(((t3) => !t3.o)), n2.forEach(((n3) => n3.h(t2, i2, s2)));
    }
    v() {
      return this.t.length > 0;
    }
    m() {
      this.t = [];
    }
  }
  function _(t2, ...i2) {
    for (const s2 of i2) for (const i3 in s2) void 0 !== s2[i3] && Object.prototype.hasOwnProperty.call(s2, i3) && !["__proto__", "constructor", "prototype"].includes(i3) && ("object" != typeof s2[i3] || void 0 === t2[i3] || Array.isArray(s2[i3]) ? t2[i3] = s2[i3] : _(t2[i3], s2[i3]));
    return t2;
  }
  function u(t2) {
    return "number" == typeof t2 && isFinite(t2);
  }
  function c(t2) {
    return "number" == typeof t2 && t2 % 1 == 0;
  }
  function d(t2) {
    return "string" == typeof t2;
  }
  function f(t2) {
    return "boolean" == typeof t2;
  }
  function p(t2) {
    const i2 = t2;
    if (!i2 || "object" != typeof i2) return i2;
    let s2, n2, e2;
    for (n2 in s2 = Array.isArray(i2) ? [] : {}, i2) i2.hasOwnProperty(n2) && (e2 = i2[n2], s2[n2] = e2 && "object" == typeof e2 ? p(e2) : e2);
    return s2;
  }
  function v(t2) {
    return null !== t2;
  }
  function m(t2) {
    return null === t2 ? void 0 : t2;
  }
  const w = "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif";
  function g(t2, i2, s2) {
    return void 0 === i2 && (i2 = w), "".concat(s2 = void 0 !== s2 ? "".concat(s2, " ") : "").concat(t2, "px ").concat(i2);
  }
  class M {
    constructor(t2) {
      this.M = { S: 1, C: 5, P: NaN, k: "", T: "", R: "", D: "", V: 0, B: 0, I: 0, A: 0, O: 0 }, this.L = t2;
    }
    N() {
      const t2 = this.M, i2 = this.W(), s2 = this.F();
      return t2.P === i2 && t2.T === s2 || (t2.P = i2, t2.T = s2, t2.k = g(i2, s2), t2.A = 2.5 / 12 * i2, t2.V = t2.A, t2.B = i2 / 12 * t2.C, t2.I = i2 / 12 * t2.C, t2.O = 0), t2.R = this.H(), t2.D = this.U(), this.M;
    }
    H() {
      return this.L.N().layout.textColor;
    }
    U() {
      return this.L.$();
    }
    W() {
      return this.L.N().layout.fontSize;
    }
    F() {
      return this.L.N().layout.fontFamily;
    }
  }
  function b(t2) {
    return t2 < 0 ? 0 : t2 > 255 ? 255 : Math.round(t2) || 0;
  }
  function x(t2) {
    return 0.199 * t2[0] + 0.687 * t2[1] + 0.114 * t2[2];
  }
  class S {
    constructor(t2, i2) {
      this.j = /* @__PURE__ */ new Map(), this.q = t2, i2 && (this.j = i2);
    }
    Y(t2, i2) {
      if ("transparent" === t2) return t2;
      const s2 = this.K(t2), n2 = s2[3];
      return "rgba(".concat(s2[0], ", ").concat(s2[1], ", ").concat(s2[2], ", ").concat(i2 * n2, ")");
    }
    X(t2) {
      const i2 = this.K(t2);
      return { Z: "rgb(".concat(i2[0], ", ").concat(i2[1], ", ").concat(i2[2], ")"), G: x(i2) > 160 ? "black" : "white" };
    }
    J(t2) {
      return x(this.K(t2));
    }
    tt(t2, i2, s2) {
      const [n2, e2, r2, h2] = this.K(t2), [a2, l2, o2, _2] = this.K(i2), u2 = [b(n2 + s2 * (a2 - n2)), b(e2 + s2 * (l2 - e2)), b(r2 + s2 * (o2 - r2)), (c2 = h2 + s2 * (_2 - h2), c2 <= 0 || c2 > 1 ? Math.min(Math.max(c2, 0), 1) : Math.round(1e4 * c2) / 1e4)];
      var c2;
      return "rgba(".concat(u2[0], ", ").concat(u2[1], ", ").concat(u2[2], ", ").concat(u2[3], ")");
    }
    K(t2) {
      const i2 = this.j.get(t2);
      if (i2) return i2;
      const s2 = (function(t3) {
        const i3 = document.createElement("div");
        i3.style.display = "none", document.body.appendChild(i3), i3.style.color = t3;
        const s3 = window.getComputedStyle(i3).color;
        return document.body.removeChild(i3), s3;
      })(t2), n2 = s2.match(/^rgba?\s*\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)$/);
      if (!n2) {
        if (this.q.length) for (const i3 of this.q) {
          const s3 = i3(t2);
          if (s3) return this.j.set(t2, s3), s3;
        }
        throw new Error("Failed to parse color: ".concat(t2));
      }
      const e2 = [parseInt(n2[1], 10), parseInt(n2[2], 10), parseInt(n2[3], 10), n2[4] ? parseFloat(n2[4]) : 1];
      return this.j.set(t2, e2), e2;
    }
  }
  class C {
    constructor() {
      this.it = [];
    }
    st(t2) {
      this.it = t2;
    }
    nt(t2, i2, s2) {
      this.it.forEach(((n2) => {
        n2.nt(t2, i2, s2);
      }));
    }
  }
  class P {
    nt(t2, i2, s2) {
      t2.useBitmapCoordinateSpace(((t3) => this.et(t3, i2, s2)));
    }
  }
  class y extends P {
    constructor() {
      super(...arguments), this.rt = null;
    }
    ht(t2) {
      this.rt = t2;
    }
    et({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) {
      if (null === this.rt || null === this.rt.lt) return;
      const n2 = this.rt.lt, e2 = this.rt, r2 = Math.max(1, Math.floor(i2)) % 2 / 2, h2 = (h3) => {
        t2.beginPath();
        for (let a2 = n2.to - 1; a2 >= n2.from; --a2) {
          const n3 = e2.ot[a2], l2 = Math.round(n3._t * i2) + r2, o2 = n3.ut * s2, _2 = h3 * s2 + r2;
          t2.moveTo(l2, o2), t2.arc(l2, o2, _2, 0, 2 * Math.PI);
        }
        t2.fill();
      };
      e2.ct > 0 && (t2.fillStyle = e2.dt, h2(e2.ft + e2.ct)), t2.fillStyle = e2.vt, h2(e2.ft);
    }
  }
  function k() {
    return { ot: [{ _t: 0, ut: 0, wt: 0, gt: 0 }], vt: "", dt: "", ft: 0, ct: 0, lt: null };
  }
  const T = { from: 0, to: 1 };
  class R {
    constructor(t2, i2, s2) {
      this.Mt = new C(), this.bt = [], this.xt = [], this.St = true, this.L = t2, this.Ct = i2, this.Pt = s2, this.Mt.st(this.bt);
    }
    yt(t2) {
      this.kt(), this.St = true;
    }
    Tt() {
      return this.St && (this.Rt(), this.St = false), this.Mt;
    }
    kt() {
      const t2 = this.Pt.Dt();
      t2.length !== this.bt.length && (this.xt = t2.map(k), this.bt = this.xt.map(((t3) => {
        const i2 = new y();
        return i2.ht(t3), i2;
      })), this.Mt.st(this.bt));
    }
    Rt() {
      const t2 = 2 === this.Ct.N().mode || !this.Ct.Et(), i2 = this.Pt.Vt(), s2 = this.Ct.Bt(), n2 = this.L.It();
      this.kt(), i2.forEach(((i3, e2) => {
        var _a2;
        const r2 = this.xt[e2], h2 = i3.At(s2), a2 = i3.zt();
        !t2 && null !== h2 && i3.Et() && null !== a2 ? (r2.vt = h2.Ot, r2.ft = h2.ft, r2.ct = h2.Lt, r2.ot[0].gt = h2.gt, r2.ot[0].ut = i3.Wt().Nt(h2.gt, a2.Ft), r2.dt = (_a2 = h2.Ht) != null ? _a2 : this.L.Ut(r2.ot[0].ut / i3.Wt().$t()), r2.ot[0].wt = s2, r2.ot[0]._t = n2.jt(s2), r2.lt = T) : r2.lt = null;
      }));
    }
  }
  class D extends P {
    constructor(t2) {
      super(), this.qt = t2;
    }
    et({ context: t2, bitmapSize: i2, horizontalPixelRatio: s2, verticalPixelRatio: r2 }) {
      if (null === this.qt) return;
      const h2 = this.qt.Yt.Et, a2 = this.qt.Kt.Et;
      if (!h2 && !a2) return;
      const l2 = Math.round(this.qt._t * s2), o2 = Math.round(this.qt.ut * r2);
      t2.lineCap = "butt", h2 && l2 >= 0 && (t2.lineWidth = Math.floor(this.qt.Yt.ct * s2), t2.strokeStyle = this.qt.Yt.R, t2.fillStyle = this.qt.Yt.R, n(t2, this.qt.Yt.Xt), (function(t3, i3, s3, n2) {
        t3.beginPath();
        const e2 = t3.lineWidth % 2 ? 0.5 : 0;
        t3.moveTo(i3 + e2, s3), t3.lineTo(i3 + e2, n2), t3.stroke();
      })(t2, l2, 0, i2.height)), a2 && o2 >= 0 && (t2.lineWidth = Math.floor(this.qt.Kt.ct * r2), t2.strokeStyle = this.qt.Kt.R, t2.fillStyle = this.qt.Kt.R, n(t2, this.qt.Kt.Xt), e(t2, o2, 0, i2.width));
    }
  }
  class E {
    constructor(t2, i2) {
      this.St = true, this.Zt = { Yt: { ct: 1, Xt: 0, R: "", Et: false }, Kt: { ct: 1, Xt: 0, R: "", Et: false }, _t: 0, ut: 0 }, this.Gt = new D(this.Zt), this.Jt = t2, this.Pt = i2;
    }
    yt() {
      this.St = true;
    }
    Tt(t2) {
      return this.St && (this.Rt(), this.St = false), this.Gt;
    }
    Rt() {
      const t2 = this.Jt.Et(), i2 = this.Pt.Qt().N().crosshair, s2 = this.Zt;
      if (2 === i2.mode) return s2.Kt.Et = false, void (s2.Yt.Et = false);
      s2.Kt.Et = t2 && this.Jt.ti(this.Pt), s2.Yt.Et = t2 && this.Jt.ii(), s2.Kt.ct = i2.horzLine.width, s2.Kt.Xt = i2.horzLine.style, s2.Kt.R = i2.horzLine.color, s2.Yt.ct = i2.vertLine.width, s2.Yt.Xt = i2.vertLine.style, s2.Yt.R = i2.vertLine.color, s2._t = this.Jt.si(), s2.ut = this.Jt.ni();
    }
  }
  function V(t2, i2, s2, n2, e2, r2) {
    t2.fillRect(i2 + r2, s2, n2 - 2 * r2, r2), t2.fillRect(i2 + r2, s2 + e2 - r2, n2 - 2 * r2, r2), t2.fillRect(i2, s2, r2, e2), t2.fillRect(i2 + n2 - r2, s2, r2, e2);
  }
  function B(t2, i2, s2, n2, e2, r2) {
    t2.save(), t2.globalCompositeOperation = "copy", t2.fillStyle = r2, t2.fillRect(i2, s2, n2, e2), t2.restore();
  }
  function I(t2, i2, s2, n2, e2, r2) {
    t2.beginPath(), t2.roundRect ? t2.roundRect(i2, s2, n2, e2, r2) : (t2.lineTo(i2 + n2 - r2[1], s2), 0 !== r2[1] && t2.arcTo(i2 + n2, s2, i2 + n2, s2 + r2[1], r2[1]), t2.lineTo(i2 + n2, s2 + e2 - r2[2]), 0 !== r2[2] && t2.arcTo(i2 + n2, s2 + e2, i2 + n2 - r2[2], s2 + e2, r2[2]), t2.lineTo(i2 + r2[3], s2 + e2), 0 !== r2[3] && t2.arcTo(i2, s2 + e2, i2, s2 + e2 - r2[3], r2[3]), t2.lineTo(i2, s2 + r2[0]), 0 !== r2[0] && t2.arcTo(i2, s2, i2 + r2[0], s2, r2[0]));
  }
  function A(t2, i2, s2, n2, e2, r2, h2 = 0, a2 = [0, 0, 0, 0], l2 = "") {
    if (t2.save(), !h2 || !l2 || l2 === r2) return I(t2, i2, s2, n2, e2, a2), t2.fillStyle = r2, t2.fill(), void t2.restore();
    const o2 = h2 / 2;
    var _2;
    I(t2, i2 + o2, s2 + o2, n2 - h2, e2 - h2, (_2 = -o2, a2.map(((t3) => 0 === t3 ? t3 : t3 + _2)))), "transparent" !== r2 && (t2.fillStyle = r2, t2.fill()), "transparent" !== l2 && (t2.lineWidth = h2, t2.strokeStyle = l2, t2.closePath(), t2.stroke()), t2.restore();
  }
  function z(t2, i2, s2, n2, e2, r2, h2) {
    t2.save(), t2.globalCompositeOperation = "copy";
    const a2 = t2.createLinearGradient(0, 0, 0, e2);
    a2.addColorStop(0, r2), a2.addColorStop(1, h2), t2.fillStyle = a2, t2.fillRect(i2, s2, n2, e2), t2.restore();
  }
  class O {
    constructor(t2, i2) {
      this.ht(t2, i2);
    }
    ht(t2, i2) {
      this.qt = t2, this.ei = i2;
    }
    $t(t2, i2) {
      return this.qt.Et ? t2.P + t2.A + t2.V : 0;
    }
    nt(t2, i2, s2, n2) {
      if (!this.qt.Et || 0 === this.qt.ri.length) return;
      const e2 = this.qt.R, r2 = this.ei.Z, h2 = t2.useBitmapCoordinateSpace(((t3) => {
        const h3 = t3.context;
        h3.font = i2.k;
        const a2 = this.hi(t3, i2, s2, n2), l2 = a2.ai;
        return a2.li ? A(h3, l2.oi, l2._i, l2.ui, l2.ci, r2, l2.di, [l2.ft, 0, 0, l2.ft], r2) : A(h3, l2.fi, l2._i, l2.ui, l2.ci, r2, l2.di, [0, l2.ft, l2.ft, 0], r2), this.qt.pi && (h3.fillStyle = e2, h3.fillRect(l2.fi, l2.mi, l2.wi - l2.fi, l2.gi)), this.qt.Mi && (h3.fillStyle = i2.D, h3.fillRect(a2.li ? l2.bi - l2.di : 0, l2._i, l2.di, l2.xi - l2._i)), a2;
      }));
      t2.useMediaCoordinateSpace((({ context: t3 }) => {
        const s3 = h2.Si;
        t3.font = i2.k, t3.textAlign = h2.li ? "right" : "left", t3.textBaseline = "middle", t3.fillStyle = e2, t3.fillText(this.qt.ri, s3.Ci, (s3._i + s3.xi) / 2 + s3.Pi);
      }));
    }
    hi(t2, i2, s2, n2) {
      var _a2;
      const { context: e2, bitmapSize: r2, mediaSize: h2, horizontalPixelRatio: a2, verticalPixelRatio: l2 } = t2, o2 = this.qt.pi || !this.qt.yi ? i2.C : 0, _2 = this.qt.ki ? i2.S : 0, u2 = i2.A + this.ei.Ti, c2 = i2.V + this.ei.Ri, d2 = i2.B, f2 = i2.I, p2 = this.qt.ri, v2 = i2.P, m2 = s2.Di(e2, p2), w2 = Math.ceil(s2.Ei(e2, p2)), g2 = v2 + u2 + c2, M2 = i2.S + d2 + f2 + w2 + o2, b2 = Math.max(1, Math.floor(l2));
      let x2 = Math.round(g2 * l2);
      x2 % 2 != b2 % 2 && (x2 += 1);
      const S2 = _2 > 0 ? Math.max(1, Math.floor(_2 * a2)) : 0, C2 = Math.round(M2 * a2), P2 = Math.round(o2 * a2), y2 = (_a2 = this.ei.Vi) != null ? _a2 : this.ei.Bi, k2 = Math.round(y2 * l2) - Math.floor(0.5 * l2), T2 = Math.floor(k2 + b2 / 2 - x2 / 2), R2 = T2 + x2, D2 = "right" === n2, E2 = D2 ? h2.width - _2 : _2, V2 = D2 ? r2.width - S2 : S2;
      let B2, I2, A2;
      return D2 ? (B2 = V2 - C2, I2 = V2 - P2, A2 = E2 - o2 - d2 - _2) : (B2 = V2 + C2, I2 = V2 + P2, A2 = E2 + o2 + d2), { li: D2, ai: { _i: T2, mi: k2, xi: R2, ui: C2, ci: x2, ft: 2 * a2, di: S2, oi: B2, fi: V2, wi: I2, gi: b2, bi: r2.width }, Si: { _i: T2 / l2, xi: R2 / l2, Ci: A2, Pi: m2 } };
    }
  }
  class L {
    constructor(t2) {
      this.Ii = { Bi: 0, Z: "#000", Ri: 0, Ti: 0 }, this.Ai = { ri: "", Et: false, pi: true, yi: false, Ht: "", R: "#FFF", Mi: false, ki: false }, this.zi = { ri: "", Et: false, pi: false, yi: true, Ht: "", R: "#FFF", Mi: true, ki: true }, this.St = true, this.Oi = new (t2 || O)(this.Ai, this.Ii), this.Li = new (t2 || O)(this.zi, this.Ii);
    }
    ri() {
      return this.Ni(), this.Ai.ri;
    }
    Bi() {
      return this.Ni(), this.Ii.Bi;
    }
    yt() {
      this.St = true;
    }
    $t(t2, i2 = false) {
      return Math.max(this.Oi.$t(t2, i2), this.Li.$t(t2, i2));
    }
    Wi() {
      return this.Ii.Vi || 0;
    }
    Fi(t2) {
      this.Ii.Vi = t2;
    }
    Hi() {
      return this.Ni(), this.Ai.Et || this.zi.Et;
    }
    Ui() {
      return this.Ni(), this.Ai.Et;
    }
    Tt(t2) {
      return this.Ni(), this.Ai.pi = this.Ai.pi && t2.N().ticksVisible, this.zi.pi = this.zi.pi && t2.N().ticksVisible, this.Oi.ht(this.Ai, this.Ii), this.Li.ht(this.zi, this.Ii), this.Oi;
    }
    $i() {
      return this.Ni(), this.Oi.ht(this.Ai, this.Ii), this.Li.ht(this.zi, this.Ii), this.Li;
    }
    Ni() {
      this.St && (this.Ai.pi = true, this.zi.pi = false, this.ji(this.Ai, this.zi, this.Ii));
    }
  }
  class N extends L {
    constructor(t2, i2, s2) {
      super(), this.Jt = t2, this.qi = i2, this.Yi = s2;
    }
    ji(t2, i2, s2) {
      if (t2.Et = false, 2 === this.Jt.N().mode) return;
      const n2 = this.Jt.N().horzLine;
      if (!n2.labelVisible) return;
      const e2 = this.qi.zt();
      if (!this.Jt.Et() || this.qi.Ki() || null === e2) return;
      const r2 = this.qi.Xi().X(n2.labelBackgroundColor);
      s2.Z = r2.Z, t2.R = r2.G;
      const h2 = 2 / 12 * this.qi.P();
      s2.Ti = h2, s2.Ri = h2;
      const a2 = this.Yi(this.qi);
      s2.Bi = a2.Bi, t2.ri = this.qi.Zi(a2.gt, e2), t2.Et = true;
    }
  }
  const W = /[1-9]/g;
  class F {
    constructor() {
      this.qt = null;
    }
    ht(t2) {
      this.qt = t2;
    }
    nt(t2, i2) {
      if (null === this.qt || false === this.qt.Et || 0 === this.qt.ri.length) return;
      const s2 = t2.useMediaCoordinateSpace((({ context: t3 }) => (t3.font = i2.k, Math.round(i2.Gi.Ei(t3, a(this.qt).ri, W)))));
      if (s2 <= 0) return;
      const n2 = i2.Ji, e2 = s2 + 2 * n2, r2 = e2 / 2, h2 = this.qt.Qi;
      let l2 = this.qt.Bi, o2 = Math.floor(l2 - r2) + 0.5;
      o2 < 0 ? (l2 += Math.abs(0 - o2), o2 = Math.floor(l2 - r2) + 0.5) : o2 + e2 > h2 && (l2 -= Math.abs(h2 - (o2 + e2)), o2 = Math.floor(l2 - r2) + 0.5);
      const _2 = o2 + e2, u2 = Math.ceil(0 + i2.S + i2.C + i2.A + i2.P + i2.V);
      t2.useBitmapCoordinateSpace((({ context: t3, horizontalPixelRatio: s3, verticalPixelRatio: n3 }) => {
        const e3 = a(this.qt);
        t3.fillStyle = e3.Z;
        const r3 = Math.round(o2 * s3), h3 = Math.round(0 * n3), l3 = Math.round(_2 * s3), c2 = Math.round(u2 * n3), d2 = Math.round(2 * s3);
        if (t3.beginPath(), t3.moveTo(r3, h3), t3.lineTo(r3, c2 - d2), t3.arcTo(r3, c2, r3 + d2, c2, d2), t3.lineTo(l3 - d2, c2), t3.arcTo(l3, c2, l3, c2 - d2, d2), t3.lineTo(l3, h3), t3.fill(), e3.pi) {
          const r4 = Math.round(e3.Bi * s3), a2 = h3, l4 = Math.round((a2 + i2.C) * n3);
          t3.fillStyle = e3.R;
          const o3 = Math.max(1, Math.floor(s3)), _3 = Math.floor(0.5 * s3);
          t3.fillRect(r4 - _3, a2, o3, l4 - a2);
        }
      })), t2.useMediaCoordinateSpace((({ context: t3 }) => {
        const s3 = a(this.qt), e3 = 0 + i2.S + i2.C + i2.A + i2.P / 2;
        t3.font = i2.k, t3.textAlign = "left", t3.textBaseline = "middle", t3.fillStyle = s3.R;
        const r3 = i2.Gi.Di(t3, "Apr0");
        t3.translate(o2 + n2, e3 + r3), t3.fillText(s3.ri, 0, 0);
      }));
    }
  }
  class H {
    constructor(t2, i2, s2) {
      this.St = true, this.Gt = new F(), this.Zt = { Et: false, Z: "#4c525e", R: "white", ri: "", Qi: 0, Bi: NaN, pi: true }, this.Ct = t2, this.ts = i2, this.Yi = s2;
    }
    yt() {
      this.St = true;
    }
    Tt() {
      return this.St && (this.Rt(), this.St = false), this.Gt.ht(this.Zt), this.Gt;
    }
    Rt() {
      const t2 = this.Zt;
      if (t2.Et = false, 2 === this.Ct.N().mode) return;
      const i2 = this.Ct.N().vertLine;
      if (!i2.labelVisible) return;
      const s2 = this.ts.It();
      if (s2.Ki()) return;
      t2.Qi = s2.Qi();
      const n2 = this.Yi();
      if (null === n2) return;
      t2.Bi = n2.Bi;
      const e2 = s2.ss(this.Ct.Bt());
      t2.ri = s2.ns(a(e2)), t2.Et = true;
      const r2 = this.ts.Xi().X(i2.labelBackgroundColor);
      t2.Z = r2.Z, t2.R = r2.G, t2.pi = s2.N().ticksVisible;
    }
  }
  class U {
    constructor() {
      this.es = null, this.rs = 0;
    }
    hs() {
      return this.rs;
    }
    ls(t2) {
      this.rs = t2;
    }
    Wt() {
      return this.es;
    }
    _s(t2) {
      this.es = t2;
    }
    us(t2) {
      return [];
    }
    cs() {
      return [];
    }
    Et() {
      return true;
    }
  }
  var $;
  !(function(t2) {
    t2[t2.Normal = 0] = "Normal", t2[t2.Magnet = 1] = "Magnet", t2[t2.Hidden = 2] = "Hidden", t2[t2.MagnetOHLC = 3] = "MagnetOHLC";
  })($ || ($ = {}));
  class j extends U {
    constructor(t2, i2) {
      super(), this.Pt = null, this.ds = NaN, this.fs = 0, this.ps = false, this.vs = /* @__PURE__ */ new Map(), this.ws = false, this.gs = /* @__PURE__ */ new WeakMap(), this.Ms = /* @__PURE__ */ new WeakMap(), this.bs = NaN, this.xs = NaN, this.Ss = NaN, this.Cs = NaN, this.ts = t2, this.Ps = i2;
      this.ys = /* @__PURE__ */ ((t3, i3) => (s3) => {
        const n2 = i3(), e2 = t3();
        if (s3 === a(this.Pt).ks()) return { gt: e2, Bi: n2 };
        {
          const t4 = a(s3.zt());
          return { gt: s3.Ts(n2, t4), Bi: n2 };
        }
      })((() => this.ds), (() => this.xs));
      const s2 = /* @__PURE__ */ ((t3, i3) => () => {
        const s3 = this.ts.It().Rs(t3()), n2 = i3();
        return s3 && Number.isFinite(n2) ? { wt: s3, Bi: n2 } : null;
      })((() => this.fs), (() => this.si()));
      this.Ds = new H(this, t2, s2);
    }
    N() {
      return this.Ps;
    }
    Es(t2, i2) {
      this.Ss = t2, this.Cs = i2;
    }
    Vs() {
      this.Ss = NaN, this.Cs = NaN;
    }
    Bs() {
      return this.Ss;
    }
    Is() {
      return this.Cs;
    }
    As(t2, i2, s2) {
      this.ws || (this.ws = true), this.ps = true, this.zs(t2, i2, s2);
    }
    Bt() {
      return this.fs;
    }
    si() {
      return this.bs;
    }
    ni() {
      return this.xs;
    }
    Et() {
      return this.ps;
    }
    Os() {
      this.ps = false, this.Ls(), this.ds = NaN, this.bs = NaN, this.xs = NaN, this.Pt = null, this.Vs(), this.Ns();
    }
    Ws(t2) {
      let i2 = this.gs.get(t2);
      i2 || (i2 = new E(this, t2), this.gs.set(t2, i2));
      let s2 = this.Ms.get(t2);
      return s2 || (s2 = new R(this.ts, this, t2), this.Ms.set(t2, s2)), [i2, s2];
    }
    ti(t2) {
      return t2 === this.Pt && this.Ps.horzLine.visible;
    }
    ii() {
      return this.Ps.vertLine.visible;
    }
    Fs(t2, i2) {
      this.ps && this.Pt === t2 || this.vs.clear();
      const s2 = [];
      return this.Pt === t2 && s2.push(this.Hs(this.vs, i2, this.ys)), s2;
    }
    cs() {
      return this.ps ? [this.Ds] : [];
    }
    Us() {
      return this.Pt;
    }
    Ns() {
      this.ts.$s().forEach(((t2) => {
        var _a2, _b;
        (_a2 = this.gs.get(t2)) == null ? void 0 : _a2.yt(), (_b = this.Ms.get(t2)) == null ? void 0 : _b.yt();
      })), this.vs.forEach(((t2) => t2.yt())), this.Ds.yt();
    }
    js(t2) {
      return t2 && !t2.ks().Ki() ? t2.ks() : null;
    }
    zs(t2, i2, s2) {
      this.qs(t2, i2, s2) && this.Ns();
    }
    qs(t2, i2, s2) {
      const n2 = this.bs, e2 = this.xs, r2 = this.ds, h2 = this.fs, a2 = this.Pt, l2 = this.js(s2);
      this.fs = t2, this.bs = isNaN(t2) ? NaN : this.ts.It().jt(t2), this.Pt = s2;
      const o2 = null !== l2 ? l2.zt() : null;
      return null !== l2 && null !== o2 ? (this.ds = i2, this.xs = l2.Nt(i2, o2)) : (this.ds = NaN, this.xs = NaN), n2 !== this.bs || e2 !== this.xs || h2 !== this.fs || r2 !== this.ds || a2 !== this.Pt;
    }
    Ls() {
      const t2 = this.ts.Ys().map(((t3) => t3.Xs().Ks())).filter(v), i2 = 0 === t2.length ? null : Math.max(...t2);
      this.fs = null !== i2 ? i2 : NaN;
    }
    Hs(t2, i2, s2) {
      let n2 = t2.get(i2);
      return void 0 === n2 && (n2 = new N(this, i2, s2), t2.set(i2, n2)), n2;
    }
  }
  function q(t2) {
    return "left" === t2 || "right" === t2;
  }
  class Y {
    constructor(t2) {
      this.Zs = /* @__PURE__ */ new Map(), this.Gs = [], this.Js = t2;
    }
    Qs(t2, i2) {
      const s2 = (function(t3, i3) {
        return void 0 === t3 ? i3 : { tn: Math.max(t3.tn, i3.tn), sn: t3.sn || i3.sn };
      })(this.Zs.get(t2), i2);
      this.Zs.set(t2, s2);
    }
    nn() {
      return this.Js;
    }
    en(t2) {
      const i2 = this.Zs.get(t2);
      return void 0 === i2 ? { tn: this.Js } : { tn: Math.max(this.Js, i2.tn), sn: i2.sn };
    }
    rn() {
      this.hn(), this.Gs = [{ an: 0 }];
    }
    ln(t2) {
      this.hn(), this.Gs = [{ an: 1, Ft: t2 }];
    }
    _n(t2) {
      this.un(), this.Gs.push({ an: 5, Ft: t2 });
    }
    hn() {
      this.un(), this.Gs.push({ an: 6 });
    }
    cn() {
      this.hn(), this.Gs = [{ an: 4 }];
    }
    dn(t2) {
      this.hn(), this.Gs.push({ an: 2, Ft: t2 });
    }
    fn(t2) {
      this.hn(), this.Gs.push({ an: 3, Ft: t2 });
    }
    pn() {
      return this.Gs;
    }
    vn(t2) {
      for (const i2 of t2.Gs) this.mn(i2);
      this.Js = Math.max(this.Js, t2.Js), t2.Zs.forEach(((t3, i2) => {
        this.Qs(i2, t3);
      }));
    }
    static wn() {
      return new Y(2);
    }
    static gn() {
      return new Y(3);
    }
    mn(t2) {
      switch (t2.an) {
        case 0:
          this.rn();
          break;
        case 1:
          this.ln(t2.Ft);
          break;
        case 2:
          this.dn(t2.Ft);
          break;
        case 3:
          this.fn(t2.Ft);
          break;
        case 4:
          this.cn();
          break;
        case 5:
          this._n(t2.Ft);
          break;
        case 6:
          this.un();
      }
    }
    un() {
      const t2 = this.Gs.findIndex(((t3) => 5 === t3.an));
      -1 !== t2 && this.Gs.splice(t2, 1);
    }
  }
  class K {
    formatTickmarks(t2) {
      return t2.map(((t3) => this.format(t3)));
    }
  }
  const X = ".";
  function Z(t2, i2) {
    if (!u(t2)) return "n/a";
    if (!c(i2)) throw new TypeError("invalid length");
    if (i2 < 0 || i2 > 16) throw new TypeError("invalid length");
    if (0 === i2) return t2.toString();
    return ("0000000000000000" + t2.toString()).slice(-i2);
  }
  class G extends K {
    constructor(t2, i2) {
      if (super(), i2 || (i2 = 1), u(t2) && c(t2) || (t2 = 100), t2 < 0) throw new TypeError("invalid base");
      this.qi = t2, this.Mn = i2, this.bn();
    }
    format(t2) {
      const i2 = t2 < 0 ? "\u2212" : "";
      return t2 = Math.abs(t2), i2 + this.xn(t2);
    }
    bn() {
      if (this.Sn = 0, this.qi > 0 && this.Mn > 0) {
        let t2 = this.qi;
        for (; t2 > 1; ) t2 /= 10, this.Sn++;
      }
    }
    xn(t2) {
      const i2 = this.qi / this.Mn;
      let s2 = Math.floor(t2), n2 = "";
      const e2 = void 0 !== this.Sn ? this.Sn : NaN;
      if (i2 > 1) {
        let r2 = +(Math.round(t2 * i2) - s2 * i2).toFixed(this.Sn);
        r2 >= i2 && (r2 -= i2, s2 += 1), n2 = X + Z(+r2.toFixed(this.Sn) * this.Mn, e2);
      } else s2 = Math.round(s2 * i2) / i2, e2 > 0 && (n2 = X + Z(0, e2));
      return s2.toFixed(0) + n2;
    }
  }
  class J extends G {
    constructor(t2 = 100) {
      super(t2);
    }
    format(t2) {
      return "".concat(super.format(t2), "%");
    }
  }
  class Q extends K {
    constructor(t2) {
      super(), this.Cn = t2;
    }
    format(t2) {
      let i2 = "";
      return t2 < 0 && (i2 = "-", t2 = -t2), t2 < 995 ? i2 + this.Pn(t2) : t2 < 999995 ? i2 + this.Pn(t2 / 1e3) + "K" : t2 < 999999995 ? (t2 = 1e3 * Math.round(t2 / 1e3), i2 + this.Pn(t2 / 1e6) + "M") : (t2 = 1e6 * Math.round(t2 / 1e6), i2 + this.Pn(t2 / 1e9) + "B");
    }
    Pn(t2) {
      let i2;
      const s2 = Math.pow(10, this.Cn);
      return i2 = (t2 = Math.round(t2 * s2) / s2) >= 1e-15 && t2 < 1 ? t2.toFixed(this.Cn).replace(/\.?0+$/, "") : String(t2), i2.replace(/(\.[1-9]*)0+$/, ((t3, i3) => i3));
    }
  }
  const tt = /[2-9]/g;
  class it {
    constructor(t2 = 50) {
      this.yn = 0, this.kn = 1, this.Tn = 1, this.Rn = {}, this.Dn = /* @__PURE__ */ new Map(), this.En = t2;
    }
    Vn() {
      this.yn = 0, this.Dn.clear(), this.kn = 1, this.Tn = 1, this.Rn = {};
    }
    Ei(t2, i2, s2) {
      return this.Bn(t2, i2, s2).width;
    }
    Di(t2, i2, s2) {
      const n2 = this.Bn(t2, i2, s2);
      return ((n2.actualBoundingBoxAscent || 0) - (n2.actualBoundingBoxDescent || 0)) / 2;
    }
    Bn(t2, i2, s2) {
      const n2 = s2 || tt, e2 = String(i2).replace(n2, "0");
      if (this.Dn.has(e2)) return h(this.Dn.get(e2)).In;
      if (this.yn === this.En) {
        const t3 = this.Rn[this.Tn];
        delete this.Rn[this.Tn], this.Dn.delete(t3), this.Tn++, this.yn--;
      }
      t2.save(), t2.textBaseline = "middle";
      const r2 = t2.measureText(e2);
      return t2.restore(), 0 === r2.width && i2.length || (this.Dn.set(e2, { In: r2, An: this.kn }), this.Rn[this.kn] = e2, this.yn++, this.kn++), r2;
    }
  }
  class st {
    constructor(t2) {
      this.zn = null, this.M = null, this.On = "right", this.Ln = t2;
    }
    Nn(t2, i2, s2) {
      this.zn = t2, this.M = i2, this.On = s2;
    }
    nt(t2) {
      null !== this.M && null !== this.zn && this.zn.nt(t2, this.M, this.Ln, this.On);
    }
  }
  class nt {
    constructor(t2, i2, s2) {
      this.Wn = t2, this.Ln = new it(50), this.Fn = i2, this.L = s2, this.W = -1, this.Gt = new st(this.Ln);
    }
    Tt() {
      const t2 = this.L.Hn(this.Fn);
      if (null === t2) return null;
      const i2 = t2.Un(this.Fn) ? t2.$n() : this.Fn.Wt();
      if (null === i2) return null;
      const s2 = t2.jn(i2);
      if ("overlay" === s2) return null;
      const n2 = this.L.qn();
      return n2.P !== this.W && (this.W = n2.P, this.Ln.Vn()), this.Gt.Nn(this.Wn.$i(), n2, s2), this.Gt;
    }
  }
  class et extends P {
    constructor() {
      super(...arguments), this.qt = null;
    }
    ht(t2) {
      this.qt = t2;
    }
    Yn(t2, i2) {
      var _a2;
      if (!((_a2 = this.qt) == null ? void 0 : _a2.Et)) return null;
      const { ut: s2, ct: n2, Kn: e2 } = this.qt;
      return i2 >= s2 - n2 - 7 && i2 <= s2 + n2 + 7 ? { Xn: this.qt, Kn: e2 } : null;
    }
    et({ context: t2, bitmapSize: i2, horizontalPixelRatio: s2, verticalPixelRatio: r2 }) {
      if (null === this.qt) return;
      if (false === this.qt.Et) return;
      const h2 = Math.round(this.qt.ut * r2);
      h2 < 0 || h2 > i2.height || (t2.lineCap = "butt", t2.strokeStyle = this.qt.R, t2.lineWidth = Math.floor(this.qt.ct * s2), n(t2, this.qt.Xt), e(t2, h2, 0, i2.width));
    }
  }
  class rt {
    constructor(t2) {
      this.Zn = { ut: 0, R: "rgba(0, 0, 0, 0)", ct: 1, Xt: 0, Et: false }, this.Gn = new et(), this.St = true, this.Jn = t2, this.Qn = t2.Qt(), this.Gn.ht(this.Zn);
    }
    yt() {
      this.St = true;
    }
    Tt() {
      return this.Jn.Et() ? (this.St && (this.te(), this.St = false), this.Gn) : null;
    }
  }
  class ht extends rt {
    constructor(t2) {
      super(t2);
    }
    te() {
      this.Zn.Et = false;
      const t2 = this.Jn.Wt(), i2 = t2.ie().ie;
      if (2 !== i2 && 3 !== i2) return;
      const s2 = this.Jn.N();
      if (!s2.baseLineVisible || !this.Jn.Et()) return;
      const n2 = this.Jn.zt();
      null !== n2 && (this.Zn.Et = true, this.Zn.ut = t2.Nt(n2.Ft, n2.Ft), this.Zn.R = s2.baseLineColor, this.Zn.ct = s2.baseLineWidth, this.Zn.Xt = s2.baseLineStyle);
    }
  }
  class at extends P {
    constructor() {
      super(...arguments), this.qt = null;
    }
    ht(t2) {
      this.qt = t2;
    }
    se() {
      return this.qt;
    }
    et({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) {
      const n2 = this.qt;
      if (null === n2) return;
      const e2 = Math.max(1, Math.floor(i2)), r2 = e2 % 2 / 2, h2 = Math.round(n2.ne.x * i2) + r2, a2 = n2.ne.y * s2;
      t2.fillStyle = n2.ee, t2.beginPath();
      const l2 = Math.max(2, 1.5 * n2.re) * i2;
      t2.arc(h2, a2, l2, 0, 2 * Math.PI, false), t2.fill(), t2.fillStyle = n2.he, t2.beginPath(), t2.arc(h2, a2, n2.ft * i2, 0, 2 * Math.PI, false), t2.fill(), t2.lineWidth = e2, t2.strokeStyle = n2.ae, t2.beginPath(), t2.arc(h2, a2, n2.ft * i2 + e2 / 2, 0, 2 * Math.PI, false), t2.stroke();
    }
  }
  const lt = [{ le: 0, oe: 0.25, _e: 4, ue: 10, ce: 0.25, de: 0, fe: 0.4, pe: 0.8 }, { le: 0.25, oe: 0.525, _e: 10, ue: 14, ce: 0, de: 0, fe: 0.8, pe: 0 }, { le: 0.525, oe: 1, _e: 14, ue: 14, ce: 0, de: 0, fe: 0, pe: 0 }];
  class ot {
    constructor(t2) {
      this.Gt = new at(), this.St = true, this.ve = true, this.me = performance.now(), this.we = this.me - 1, this.ge = t2;
    }
    Me() {
      this.we = this.me - 1, this.yt();
    }
    be() {
      if (this.yt(), 2 === this.ge.N().lastPriceAnimation) {
        const t2 = performance.now(), i2 = this.we - t2;
        if (i2 > 0) return void (i2 < 650 && (this.we += 2600));
        this.me = t2, this.we = t2 + 2600;
      }
    }
    yt() {
      this.St = true;
    }
    xe() {
      this.ve = true;
    }
    Et() {
      return 0 !== this.ge.N().lastPriceAnimation;
    }
    Se() {
      switch (this.ge.N().lastPriceAnimation) {
        case 0:
          return false;
        case 1:
          return true;
        case 2:
          return performance.now() <= this.we;
      }
    }
    Tt() {
      return this.St ? (this.Rt(), this.St = false, this.ve = false) : this.ve && (this.Ce(), this.ve = false), this.Gt;
    }
    Rt() {
      this.Gt.ht(null);
      const t2 = this.ge.Qt().It(), i2 = t2.Pe(), s2 = this.ge.zt();
      if (null === i2 || null === s2) return;
      const n2 = this.ge.ye(true);
      if (n2.ke || !i2.Te(n2.Re)) return;
      const e2 = { x: t2.jt(n2.Re), y: this.ge.Wt().Nt(n2.gt, s2.Ft) }, r2 = n2.R, h2 = this.ge.N().lineWidth, a2 = this.De(this.Ee(), r2);
      this.Gt.ht({ ee: r2, re: h2, he: a2.he, ae: a2.ae, ft: a2.ft, ne: e2 });
    }
    Ce() {
      const t2 = this.Gt.se();
      if (null !== t2) {
        const i2 = this.De(this.Ee(), t2.ee);
        t2.he = i2.he, t2.ae = i2.ae, t2.ft = i2.ft;
      }
    }
    Ee() {
      return this.Se() ? performance.now() - this.me : 2599;
    }
    Ve(t2, i2, s2, n2) {
      const e2 = s2 + (n2 - s2) * i2;
      return this.ge.Qt().Xi().Y(t2, e2);
    }
    De(t2, i2) {
      const s2 = t2 % 2600 / 2600;
      let n2;
      for (const t3 of lt) if (s2 >= t3.le && s2 <= t3.oe) {
        n2 = t3;
        break;
      }
      r(void 0 !== n2, "Last price animation internal logic error");
      const e2 = (s2 - n2.le) / (n2.oe - n2.le);
      return { he: this.Ve(i2, e2, n2.ce, n2.de), ae: this.Ve(i2, e2, n2.fe, n2.pe), ft: (h2 = e2, a2 = n2._e, l2 = n2.ue, a2 + (l2 - a2) * h2) };
      var h2, a2, l2;
    }
  }
  class _t extends rt {
    constructor(t2) {
      super(t2);
    }
    te() {
      const t2 = this.Zn;
      t2.Et = false;
      const i2 = this.Jn.N();
      if (!i2.priceLineVisible || !this.Jn.Et()) return;
      const s2 = this.Jn.ye(0 === i2.priceLineSource);
      s2.ke || (t2.Et = true, t2.ut = s2.Bi, t2.R = this.Jn.Be(s2.R), t2.ct = i2.priceLineWidth, t2.Xt = i2.priceLineStyle);
    }
  }
  class ut extends L {
    constructor(t2) {
      super(), this.Jt = t2;
    }
    ji(t2, i2, s2) {
      t2.Et = false, i2.Et = false;
      const n2 = this.Jt;
      if (!n2.Et()) return;
      const e2 = n2.N(), r2 = e2.lastValueVisible, h2 = "" !== n2.Ie(), a2 = 0 === e2.seriesLastValueMode, l2 = n2.ye(false);
      if (l2.ke) return;
      r2 && (t2.ri = this.Ae(l2, r2, a2), t2.Et = 0 !== t2.ri.length), (h2 || a2) && (i2.ri = this.ze(l2, r2, h2, a2), i2.Et = i2.ri.length > 0);
      const o2 = n2.Be(l2.R), _2 = this.Jt.Qt().Xi().X(o2);
      s2.Z = _2.Z, s2.Bi = l2.Bi, i2.Ht = n2.Qt().Ut(l2.Bi / n2.Wt().$t()), t2.Ht = o2, t2.R = _2.G, i2.R = _2.G;
    }
    ze(t2, i2, s2, n2) {
      let e2 = "";
      const r2 = this.Jt.Ie();
      return s2 && 0 !== r2.length && (e2 += "".concat(r2, " ")), i2 && n2 && (e2 += this.Jt.Wt().Oe() ? t2.Le : t2.Ne), e2.trim();
    }
    Ae(t2, i2, s2) {
      return i2 ? s2 ? this.Jt.Wt().Oe() ? t2.Ne : t2.Le : t2.ri : "";
    }
  }
  function ct(t2, i2, s2, n2) {
    const e2 = Number.isFinite(i2), r2 = Number.isFinite(s2);
    return e2 && r2 ? t2(i2, s2) : e2 || r2 ? e2 ? i2 : s2 : n2;
  }
  class dt {
    constructor(t2, i2) {
      this.We = t2, this.Fe = i2;
    }
    He(t2) {
      return null !== t2 && (this.We === t2.We && this.Fe === t2.Fe);
    }
    Ue() {
      return new dt(this.We, this.Fe);
    }
    $e() {
      return this.We;
    }
    je() {
      return this.Fe;
    }
    qe() {
      return this.Fe - this.We;
    }
    Ki() {
      return this.Fe === this.We || Number.isNaN(this.Fe) || Number.isNaN(this.We);
    }
    vn(t2) {
      return null === t2 ? this : new dt(ct(Math.min, this.$e(), t2.$e(), -1 / 0), ct(Math.max, this.je(), t2.je(), 1 / 0));
    }
    Ye(t2) {
      if (!u(t2)) return;
      if (0 === this.Fe - this.We) return;
      const i2 = 0.5 * (this.Fe + this.We);
      let s2 = this.Fe - i2, n2 = this.We - i2;
      s2 *= t2, n2 *= t2, this.Fe = i2 + s2, this.We = i2 + n2;
    }
    Ke(t2) {
      u(t2) && (this.Fe += t2, this.We += t2);
    }
    Xe() {
      return { minValue: this.We, maxValue: this.Fe };
    }
    static Ze(t2) {
      return null === t2 ? null : new dt(t2.minValue, t2.maxValue);
    }
  }
  class ft {
    constructor(t2, i2) {
      this.Ge = t2, this.Je = i2 || null;
    }
    Qe() {
      return this.Ge;
    }
    tr() {
      return this.Je;
    }
    Xe() {
      return { priceRange: null === this.Ge ? null : this.Ge.Xe(), margins: this.Je || void 0 };
    }
    static Ze(t2) {
      return null === t2 ? null : new ft(dt.Ze(t2.priceRange), t2.margins);
    }
  }
  class pt extends rt {
    constructor(t2, i2) {
      super(t2), this.ir = i2;
    }
    te() {
      const t2 = this.Zn;
      t2.Et = false;
      const i2 = this.ir.N();
      if (!this.Jn.Et() || !i2.lineVisible) return;
      const s2 = this.ir.sr();
      null !== s2 && (t2.Et = true, t2.ut = s2, t2.R = i2.color, t2.ct = i2.lineWidth, t2.Xt = i2.lineStyle, t2.Kn = this.ir.N().id);
    }
  }
  class vt extends L {
    constructor(t2, i2) {
      super(), this.ge = t2, this.ir = i2;
    }
    ji(t2, i2, s2) {
      t2.Et = false, i2.Et = false;
      const n2 = this.ir.N(), e2 = n2.axisLabelVisible, r2 = "" !== n2.title, h2 = this.ge;
      if (!e2 || !h2.Et()) return;
      const a2 = this.ir.sr();
      if (null === a2) return;
      r2 && (i2.ri = n2.title, i2.Et = true), i2.Ht = h2.Qt().Ut(a2 / h2.Wt().$t()), t2.ri = this.nr(n2.price), t2.Et = true;
      const l2 = this.ge.Qt().Xi().X(n2.axisLabelColor || n2.color);
      s2.Z = l2.Z;
      const o2 = n2.axisLabelTextColor || l2.G;
      t2.R = o2, i2.R = o2, s2.Bi = a2;
    }
    nr(t2) {
      const i2 = this.ge.zt();
      return null === i2 ? "" : this.ge.Wt().Zi(t2, i2.Ft);
    }
  }
  class mt {
    constructor(t2, i2) {
      this.ge = t2, this.Ps = i2, this.er = new pt(t2, this), this.Wn = new vt(t2, this), this.rr = new nt(this.Wn, t2, t2.Qt());
    }
    hr(t2) {
      _(this.Ps, t2), this.yt(), this.ge.Qt().ar();
    }
    N() {
      return this.Ps;
    }
    lr() {
      return this.er;
    }
    _r() {
      return this.rr;
    }
    ur() {
      return this.Wn;
    }
    yt() {
      this.er.yt(), this.Wn.yt();
    }
    sr() {
      const t2 = this.ge, i2 = t2.Wt();
      if (t2.Qt().It().Ki() || i2.Ki()) return null;
      const s2 = t2.zt();
      return null === s2 ? null : i2.Nt(this.Ps.price, s2.Ft);
    }
  }
  class wt extends U {
    constructor(t2) {
      super(), this.ts = t2;
    }
    Qt() {
      return this.ts;
    }
  }
  const gt = { Bar: (t2, i2, s2, n2) => {
    var _a2;
    const e2 = i2.upColor, r2 = i2.downColor, h2 = a(t2(s2, n2)), o2 = l(h2.Ft[0]) <= l(h2.Ft[3]);
    return { cr: (_a2 = h2.R) != null ? _a2 : o2 ? e2 : r2 };
  }, Candlestick: (t2, i2, s2, n2) => {
    var _a2, _b, _c;
    const e2 = i2.upColor, r2 = i2.downColor, h2 = i2.borderUpColor, o2 = i2.borderDownColor, _2 = i2.wickUpColor, u2 = i2.wickDownColor, c2 = a(t2(s2, n2)), d2 = l(c2.Ft[0]) <= l(c2.Ft[3]);
    return { cr: (_a2 = c2.R) != null ? _a2 : d2 ? e2 : r2, dr: (_b = c2.Ht) != null ? _b : d2 ? h2 : o2, pr: (_c = c2.vr) != null ? _c : d2 ? _2 : u2 };
  }, Custom: (t2, i2, s2, n2) => {
    var _a2;
    return { cr: (_a2 = a(t2(s2, n2)).R) != null ? _a2 : i2.color };
  }, Area: (t2, i2, s2, n2) => {
    var _a2, _b, _c, _d;
    const e2 = a(t2(s2, n2));
    return { cr: (_a2 = e2.vt) != null ? _a2 : i2.lineColor, vt: (_b = e2.vt) != null ? _b : i2.lineColor, mr: (_c = e2.mr) != null ? _c : i2.topColor, wr: (_d = e2.wr) != null ? _d : i2.bottomColor };
  }, Baseline: (t2, i2, s2, n2) => {
    var _a2, _b, _c, _d, _e2, _f;
    const e2 = a(t2(s2, n2));
    return { cr: e2.Ft[3] >= i2.baseValue.price ? i2.topLineColor : i2.bottomLineColor, gr: (_a2 = e2.gr) != null ? _a2 : i2.topLineColor, Mr: (_b = e2.Mr) != null ? _b : i2.bottomLineColor, br: (_c = e2.br) != null ? _c : i2.topFillColor1, Sr: (_d = e2.Sr) != null ? _d : i2.topFillColor2, Cr: (_e2 = e2.Cr) != null ? _e2 : i2.bottomFillColor1, Pr: (_f = e2.Pr) != null ? _f : i2.bottomFillColor2 };
  }, Line: (t2, i2, s2, n2) => {
    var _a2, _b;
    const e2 = a(t2(s2, n2));
    return { cr: (_a2 = e2.R) != null ? _a2 : i2.color, vt: (_b = e2.R) != null ? _b : i2.color };
  }, Histogram: (t2, i2, s2, n2) => {
    var _a2;
    return { cr: (_a2 = a(t2(s2, n2)).R) != null ? _a2 : i2.color };
  } };
  class Mt {
    constructor(t2) {
      this.yr = (t3, i2) => void 0 !== i2 ? i2.Ft : this.ge.Xs().kr(t3), this.ge = t2, this.Tr = gt[t2.Rr()];
    }
    Dr(t2, i2) {
      return this.Tr(this.yr, this.ge.N(), t2, i2);
    }
  }
  function bt(t2, i2, s2, n2, e2 = 0, r2 = i2.length) {
    let h2 = r2 - e2;
    for (; 0 < h2; ) {
      const r3 = h2 >> 1, a2 = e2 + r3;
      n2(i2[a2], s2) === t2 ? (e2 = a2 + 1, h2 -= r3 + 1) : h2 = r3;
    }
    return e2;
  }
  const xt = bt.bind(null, true), St = bt.bind(null, false);
  var Ct;
  !(function(t2) {
    t2[t2.NearestLeft = -1] = "NearestLeft", t2[t2.None = 0] = "None", t2[t2.NearestRight = 1] = "NearestRight";
  })(Ct || (Ct = {}));
  const Pt = 30;
  class yt {
    constructor() {
      this.Er = [], this.Vr = /* @__PURE__ */ new Map(), this.Br = /* @__PURE__ */ new Map(), this.Ir = [];
    }
    Ar() {
      return this.zr() > 0 ? this.Er[this.Er.length - 1] : null;
    }
    Or() {
      return this.zr() > 0 ? this.Lr(0) : null;
    }
    Ks() {
      return this.zr() > 0 ? this.Lr(this.Er.length - 1) : null;
    }
    zr() {
      return this.Er.length;
    }
    Ki() {
      return 0 === this.zr();
    }
    Te(t2) {
      return null !== this.Nr(t2, 0);
    }
    kr(t2) {
      return this.Wr(t2);
    }
    Wr(t2, i2 = 0) {
      const s2 = this.Nr(t2, i2);
      return null === s2 ? null : { ...this.Fr(s2), Re: this.Lr(s2) };
    }
    Hr() {
      return this.Er;
    }
    Ur(t2, i2, s2) {
      if (this.Ki()) return null;
      let n2 = null;
      for (const e2 of s2) {
        n2 = kt(n2, this.$r(t2, i2, e2));
      }
      return n2;
    }
    ht(t2) {
      this.Br.clear(), this.Vr.clear(), this.Er = t2, this.Ir = t2.map(((t3) => t3.Re));
    }
    jr() {
      return this.Ir;
    }
    Lr(t2) {
      return this.Er[t2].Re;
    }
    Fr(t2) {
      return this.Er[t2];
    }
    Nr(t2, i2) {
      const s2 = this.qr(t2);
      if (null === s2 && 0 !== i2) switch (i2) {
        case -1:
          return this.Yr(t2);
        case 1:
          return this.Kr(t2);
        default:
          throw new TypeError("Unknown search mode");
      }
      return s2;
    }
    Yr(t2) {
      let i2 = this.Xr(t2);
      return i2 > 0 && (i2 -= 1), i2 !== this.Er.length && this.Lr(i2) < t2 ? i2 : null;
    }
    Kr(t2) {
      const i2 = this.Zr(t2);
      return i2 !== this.Er.length && t2 < this.Lr(i2) ? i2 : null;
    }
    qr(t2) {
      const i2 = this.Xr(t2);
      return i2 === this.Er.length || t2 < this.Er[i2].Re ? null : i2;
    }
    Xr(t2) {
      return xt(this.Er, t2, ((t3, i2) => t3.Re < i2));
    }
    Zr(t2) {
      return St(this.Er, t2, ((t3, i2) => t3.Re > i2));
    }
    Gr(t2, i2, s2) {
      let n2 = null;
      for (let e2 = t2; e2 < i2; e2++) {
        const t3 = this.Er[e2].Ft[s2];
        Number.isNaN(t3) || (null === n2 ? n2 = { Jr: t3, Qr: t3 } : (t3 < n2.Jr && (n2.Jr = t3), t3 > n2.Qr && (n2.Qr = t3)));
      }
      return n2;
    }
    $r(t2, i2, s2) {
      if (this.Ki()) return null;
      let n2 = null;
      const e2 = a(this.Or()), r2 = a(this.Ks()), h2 = Math.max(t2, e2), l2 = Math.min(i2, r2), o2 = Math.ceil(h2 / Pt) * Pt, _2 = Math.max(o2, Math.floor(l2 / Pt) * Pt);
      {
        const t3 = this.Xr(h2), e3 = this.Zr(Math.min(l2, o2, i2));
        n2 = kt(n2, this.Gr(t3, e3, s2));
      }
      let u2 = this.Vr.get(s2);
      void 0 === u2 && (u2 = /* @__PURE__ */ new Map(), this.Vr.set(s2, u2));
      for (let t3 = Math.max(o2 + 1, h2); t3 < _2; t3 += Pt) {
        const i3 = Math.floor(t3 / Pt);
        let e3 = u2.get(i3);
        if (void 0 === e3) {
          const t4 = this.Xr(i3 * Pt), n3 = this.Zr((i3 + 1) * Pt - 1);
          e3 = this.Gr(t4, n3, s2), u2.set(i3, e3);
        }
        n2 = kt(n2, e3);
      }
      {
        const t3 = this.Xr(_2), i3 = this.Zr(l2);
        n2 = kt(n2, this.Gr(t3, i3, s2));
      }
      return n2;
    }
  }
  function kt(t2, i2) {
    if (null === t2) return i2;
    if (null === i2) return t2;
    return { Jr: Math.min(t2.Jr, i2.Jr), Qr: Math.max(t2.Qr, i2.Qr) };
  }
  class Tt {
    constructor(t2) {
      this.th = t2;
    }
    nt(t2, i2, s2) {
      this.th.draw(t2);
    }
    ih(t2, i2, s2) {
      var _a2, _b;
      (_b = (_a2 = this.th).drawBackground) == null ? void 0 : _b.call(_a2, t2);
    }
  }
  class Rt {
    constructor(t2) {
      this.Dn = null, this.sh = t2;
    }
    Tt() {
      var _a2;
      const t2 = this.sh.renderer();
      if (null === t2) return null;
      if (((_a2 = this.Dn) == null ? void 0 : _a2.nh) === t2) return this.Dn.eh;
      const i2 = new Tt(t2);
      return this.Dn = { nh: t2, eh: i2 }, i2;
    }
    rh() {
      var _a2, _b, _c;
      return (_c = (_b = (_a2 = this.sh).zOrder) == null ? void 0 : _b.call(_a2)) != null ? _c : "normal";
    }
  }
  class Dt {
    constructor(t2) {
      this.hh = null, this.ah = t2;
    }
    oh() {
      return this.ah;
    }
    Ns() {
      var _a2, _b;
      (_b = (_a2 = this.ah).updateAllViews) == null ? void 0 : _b.call(_a2);
    }
    Ws() {
      var _a2, _b, _c, _d;
      const t2 = (_c = (_b = (_a2 = this.ah).paneViews) == null ? void 0 : _b.call(_a2)) != null ? _c : [];
      if (((_d = this.hh) == null ? void 0 : _d.nh) === t2) return this.hh.eh;
      const i2 = t2.map(((t3) => new Rt(t3)));
      return this.hh = { nh: t2, eh: i2 }, i2;
    }
    Yn(t2, i2) {
      var _a2, _b, _c;
      return (_c = (_b = (_a2 = this.ah).hitTest) == null ? void 0 : _b.call(_a2, t2, i2)) != null ? _c : null;
    }
  }
  let Et = class extends Dt {
    us() {
      return [];
    }
  };
  class Vt {
    constructor(t2) {
      this.th = t2;
    }
    nt(t2, i2, s2) {
      this.th.draw(t2);
    }
    ih(t2, i2, s2) {
      var _a2, _b;
      (_b = (_a2 = this.th).drawBackground) == null ? void 0 : _b.call(_a2, t2);
    }
  }
  class Bt {
    constructor(t2) {
      this.Dn = null, this.sh = t2;
    }
    Tt() {
      var _a2;
      const t2 = this.sh.renderer();
      if (null === t2) return null;
      if (((_a2 = this.Dn) == null ? void 0 : _a2.nh) === t2) return this.Dn.eh;
      const i2 = new Vt(t2);
      return this.Dn = { nh: t2, eh: i2 }, i2;
    }
    rh() {
      var _a2, _b, _c;
      return (_c = (_b = (_a2 = this.sh).zOrder) == null ? void 0 : _b.call(_a2)) != null ? _c : "normal";
    }
  }
  function It(t2) {
    var _a2, _b, _c, _d, _e2;
    return { ri: t2.text(), Bi: t2.coordinate(), Vi: (_a2 = t2.fixedCoordinate) == null ? void 0 : _a2.call(t2), R: t2.textColor(), Z: t2.backColor(), Et: (_c = (_b = t2.visible) == null ? void 0 : _b.call(t2)) != null ? _c : true, pi: (_e2 = (_d = t2.tickVisible) == null ? void 0 : _d.call(t2)) != null ? _e2 : true };
  }
  class At {
    constructor(t2, i2) {
      this.Gt = new F(), this._h = t2, this.uh = i2;
    }
    Tt() {
      return this.Gt.ht({ Qi: this.uh.Qi(), ...It(this._h) }), this.Gt;
    }
  }
  class zt extends L {
    constructor(t2, i2) {
      super(), this._h = t2, this.qi = i2;
    }
    ji(t2, i2, s2) {
      const n2 = It(this._h);
      s2.Z = n2.Z, t2.R = n2.R;
      const e2 = 2 / 12 * this.qi.P();
      s2.Ti = e2, s2.Ri = e2, s2.Bi = n2.Bi, s2.Vi = n2.Vi, t2.ri = n2.ri, t2.Et = n2.Et, t2.pi = n2.pi;
    }
  }
  class Ot extends Dt {
    constructor(t2, i2) {
      super(t2), this.dh = null, this.fh = null, this.ph = null, this.mh = null, this.ge = i2;
    }
    cs() {
      var _a2, _b, _c, _d;
      const t2 = (_c = (_b = (_a2 = this.ah).timeAxisViews) == null ? void 0 : _b.call(_a2)) != null ? _c : [];
      if (((_d = this.dh) == null ? void 0 : _d.nh) === t2) return this.dh.eh;
      const i2 = this.ge.Qt().It(), s2 = t2.map(((t3) => new At(t3, i2)));
      return this.dh = { nh: t2, eh: s2 }, s2;
    }
    Fs() {
      var _a2, _b, _c, _d;
      const t2 = (_c = (_b = (_a2 = this.ah).priceAxisViews) == null ? void 0 : _b.call(_a2)) != null ? _c : [];
      if (((_d = this.fh) == null ? void 0 : _d.nh) === t2) return this.fh.eh;
      const i2 = this.ge.Wt(), s2 = t2.map(((t3) => new zt(t3, i2)));
      return this.fh = { nh: t2, eh: s2 }, s2;
    }
    wh() {
      var _a2, _b, _c, _d;
      const t2 = (_c = (_b = (_a2 = this.ah).priceAxisPaneViews) == null ? void 0 : _b.call(_a2)) != null ? _c : [];
      if (((_d = this.ph) == null ? void 0 : _d.nh) === t2) return this.ph.eh;
      const i2 = t2.map(((t3) => new Bt(t3)));
      return this.ph = { nh: t2, eh: i2 }, i2;
    }
    gh() {
      var _a2, _b, _c, _d;
      const t2 = (_c = (_b = (_a2 = this.ah).timeAxisPaneViews) == null ? void 0 : _b.call(_a2)) != null ? _c : [];
      if (((_d = this.mh) == null ? void 0 : _d.nh) === t2) return this.mh.eh;
      const i2 = t2.map(((t3) => new Bt(t3)));
      return this.mh = { nh: t2, eh: i2 }, i2;
    }
    Mh(t2, i2) {
      var _a2, _b, _c;
      return (_c = (_b = (_a2 = this.ah).autoscaleInfo) == null ? void 0 : _b.call(_a2, t2, i2)) != null ? _c : null;
    }
  }
  function Lt(t2, i2, s2, n2) {
    t2.forEach(((t3) => {
      i2(t3).forEach(((t4) => {
        t4.rh() === s2 && n2.push(t4);
      }));
    }));
  }
  function Nt(t2) {
    return t2.Ws();
  }
  function Wt(t2) {
    return t2.wh();
  }
  function Ft(t2) {
    return t2.gh();
  }
  const Ht = ["Area", "Line", "Baseline"];
  class Ut extends wt {
    constructor(t2, i2, s2, n2, e2) {
      super(t2), this.qt = new yt(), this.er = new _t(this), this.bh = [], this.xh = new ht(this), this.Sh = null, this.Ch = null, this.Ph = null, this.yh = [], this.Ps = s2, this.kh = i2;
      const r2 = new ut(this);
      this.vs = [r2], this.rr = new nt(r2, this, t2), Ht.includes(this.kh) && (this.Sh = new ot(this)), this.Th(), this.sh = n2(this, this.Qt(), e2);
    }
    m() {
      null !== this.Ph && clearTimeout(this.Ph);
    }
    Be(t2) {
      return this.Ps.priceLineColor || t2;
    }
    ye(t2) {
      const i2 = { ke: true }, s2 = this.Wt();
      if (this.Qt().It().Ki() || s2.Ki() || this.qt.Ki()) return i2;
      const n2 = this.Qt().It().Pe(), e2 = this.zt();
      if (null === n2 || null === e2) return i2;
      let r2, h2;
      if (t2) {
        const t3 = this.qt.Ar();
        if (null === t3) return i2;
        r2 = t3, h2 = t3.Re;
      } else {
        const t3 = this.qt.Wr(n2.bi(), -1);
        if (null === t3) return i2;
        if (r2 = this.qt.kr(t3.Re), null === r2) return i2;
        h2 = t3.Re;
      }
      const a2 = r2.Ft[3], l2 = this.Rh().Dr(h2, { Ft: r2 }), o2 = s2.Nt(a2, e2.Ft);
      return { ke: false, gt: a2, ri: s2.Zi(a2, e2.Ft), Le: s2.Dh(a2), Ne: s2.Eh(a2, e2.Ft), R: l2.cr, Bi: o2, Re: h2 };
    }
    Rh() {
      return null !== this.Ch || (this.Ch = new Mt(this)), this.Ch;
    }
    N() {
      return this.Ps;
    }
    hr(t2) {
      const i2 = t2.priceScaleId;
      void 0 !== i2 && i2 !== this.Ps.priceScaleId && this.Qt().Vh(this, i2), _(this.Ps, t2), void 0 !== t2.priceFormat && (this.Th(), this.Qt().Bh()), this.Qt().Ih(this), this.Qt().Ah(), this.sh.yt("options");
    }
    ht(t2, i2) {
      this.qt.ht(t2), this.sh.yt("data"), null !== this.Sh && (i2 && i2.zh ? this.Sh.be() : 0 === t2.length && this.Sh.Me());
      const s2 = this.Qt().Hn(this);
      this.Qt().Oh(s2), this.Qt().Ih(this), this.Qt().Ah(), this.Qt().ar();
    }
    Lh(t2) {
      const i2 = new mt(this, t2);
      return this.bh.push(i2), this.Qt().Ih(this), i2;
    }
    Nh(t2) {
      const i2 = this.bh.indexOf(t2);
      -1 !== i2 && this.bh.splice(i2, 1), this.Qt().Ih(this);
    }
    Wh() {
      return this.bh;
    }
    Rr() {
      return this.kh;
    }
    zt() {
      const t2 = this.Fh();
      return null === t2 ? null : { Ft: t2.Ft[3], Hh: t2.wt };
    }
    Fh() {
      const t2 = this.Qt().It().Pe();
      if (null === t2) return null;
      const i2 = t2.Uh();
      return this.qt.Wr(i2, 1);
    }
    Xs() {
      return this.qt;
    }
    $h(t2) {
      const i2 = this.qt.kr(t2);
      return null === i2 ? null : "Bar" === this.kh || "Candlestick" === this.kh || "Custom" === this.kh ? { jh: i2.Ft[0], qh: i2.Ft[1], Yh: i2.Ft[2], Kh: i2.Ft[3] } : i2.Ft[3];
    }
    Xh(t2) {
      const i2 = [];
      Lt(this.yh, Nt, "top", i2);
      const s2 = this.Sh;
      return null !== s2 && s2.Et() ? (null === this.Ph && s2.Se() && (this.Ph = setTimeout((() => {
        this.Ph = null, this.Qt().Zh();
      }), 0)), s2.xe(), i2.unshift(s2), i2) : i2;
    }
    Ws() {
      const t2 = [];
      this.Gh() || t2.push(this.xh), t2.push(this.sh, this.er);
      const i2 = this.bh.map(((t3) => t3.lr()));
      return t2.push(...i2), Lt(this.yh, Nt, "normal", t2), t2;
    }
    Jh() {
      return this.Qh(Nt, "bottom");
    }
    ta(t2) {
      return this.Qh(Wt, t2);
    }
    ia(t2) {
      return this.Qh(Ft, t2);
    }
    sa(t2, i2) {
      return this.yh.map(((s2) => s2.Yn(t2, i2))).filter(((t3) => null !== t3));
    }
    us() {
      return [this.rr, ...this.bh.map(((t2) => t2._r()))];
    }
    Fs(t2, i2) {
      if (i2 !== this.es && !this.Gh()) return [];
      const s2 = [...this.vs];
      for (const t3 of this.bh) s2.push(t3.ur());
      return this.yh.forEach(((t3) => {
        s2.push(...t3.Fs());
      })), s2;
    }
    cs() {
      const t2 = [];
      return this.yh.forEach(((i2) => {
        t2.push(...i2.cs());
      })), t2;
    }
    Mh(t2, i2) {
      if (void 0 !== this.Ps.autoscaleInfoProvider) {
        const s2 = this.Ps.autoscaleInfoProvider((() => {
          const s3 = this.na(t2, i2);
          return null === s3 ? null : s3.Xe();
        }));
        return ft.Ze(s2);
      }
      return this.na(t2, i2);
    }
    ea() {
      return this.Ps.priceFormat.minMove;
    }
    ra() {
      return this.ha;
    }
    Ns() {
      var _a2;
      this.sh.yt();
      for (const t2 of this.vs) t2.yt();
      for (const t2 of this.bh) t2.yt();
      this.er.yt(), this.xh.yt(), (_a2 = this.Sh) == null ? void 0 : _a2.yt(), this.yh.forEach(((t2) => t2.Ns()));
    }
    Wt() {
      return a(super.Wt());
    }
    At(t2) {
      if (!(("Line" === this.kh || "Area" === this.kh || "Baseline" === this.kh) && this.Ps.crosshairMarkerVisible)) return null;
      const i2 = this.qt.kr(t2);
      if (null === i2) return null;
      return { gt: i2.Ft[3], ft: this.aa(), Ht: this.la(), Lt: this.oa(), Ot: this._a(t2) };
    }
    Ie() {
      return this.Ps.title;
    }
    Et() {
      return this.Ps.visible;
    }
    ua(t2) {
      this.yh.push(new Ot(t2, this));
    }
    ca(t2) {
      this.yh = this.yh.filter(((i2) => i2.oh() !== t2));
    }
    da() {
      if ("Custom" === this.kh) return (t2) => this.sh.fa(t2);
    }
    pa() {
      if ("Custom" === this.kh) return (t2) => this.sh.va(t2);
    }
    ma() {
      return this.qt.jr();
    }
    Gh() {
      return !q(this.Wt().wa());
    }
    na(t2, i2) {
      if (!c(t2) || !c(i2) || this.qt.Ki()) return null;
      const s2 = "Line" === this.kh || "Area" === this.kh || "Baseline" === this.kh || "Histogram" === this.kh ? [3] : [2, 1], n2 = this.qt.Ur(t2, i2, s2);
      let e2 = null !== n2 ? new dt(n2.Jr, n2.Qr) : null, r2 = null;
      if ("Histogram" === this.Rr()) {
        const t3 = this.Ps.base, i3 = new dt(t3, t3);
        e2 = null !== e2 ? e2.vn(i3) : i3;
      }
      return this.yh.forEach(((s3) => {
        const n3 = s3.Mh(t2, i2);
        if (n3 == null ? void 0 : n3.priceRange) {
          const t3 = new dt(n3.priceRange.minValue, n3.priceRange.maxValue);
          e2 = null !== e2 ? e2.vn(t3) : t3;
        }
        (n3 == null ? void 0 : n3.margins) && (r2 = n3.margins);
      })), new ft(e2, r2);
    }
    aa() {
      switch (this.kh) {
        case "Line":
        case "Area":
        case "Baseline":
          return this.Ps.crosshairMarkerRadius;
      }
      return 0;
    }
    la() {
      switch (this.kh) {
        case "Line":
        case "Area":
        case "Baseline": {
          const t2 = this.Ps.crosshairMarkerBorderColor;
          if (0 !== t2.length) return t2;
        }
      }
      return null;
    }
    oa() {
      switch (this.kh) {
        case "Line":
        case "Area":
        case "Baseline":
          return this.Ps.crosshairMarkerBorderWidth;
      }
      return 0;
    }
    _a(t2) {
      switch (this.kh) {
        case "Line":
        case "Area":
        case "Baseline": {
          const t3 = this.Ps.crosshairMarkerBackgroundColor;
          if (0 !== t3.length) return t3;
        }
      }
      return this.Rh().Dr(t2).cr;
    }
    Th() {
      var _a2;
      switch (this.Ps.priceFormat.type) {
        case "custom": {
          const t2 = this.Ps.priceFormat.formatter;
          this.ha = { format: t2, formatTickmarks: (_a2 = this.Ps.priceFormat.tickmarksFormatter) != null ? _a2 : ((i2) => i2.map(t2)) };
          break;
        }
        case "volume":
          this.ha = new Q(this.Ps.priceFormat.precision);
          break;
        case "percent":
          this.ha = new J(this.Ps.priceFormat.precision);
          break;
        default: {
          const t2 = Math.pow(10, this.Ps.priceFormat.precision);
          this.ha = new G(t2, this.Ps.priceFormat.minMove * t2);
        }
      }
      null !== this.es && this.es.ga();
    }
    Qh(t2, i2) {
      const s2 = [];
      return Lt(this.yh, t2, i2, s2), s2;
    }
  }
  const $t = [3], jt = [0, 1, 2, 3];
  class qt {
    constructor(t2) {
      this.Ps = t2;
    }
    Ma(t2, i2, s2) {
      let n2 = t2;
      if (0 === this.Ps.mode) return n2;
      const e2 = s2.ks(), r2 = e2.zt();
      if (null === r2) return n2;
      const h2 = e2.Nt(t2, r2), a2 = s2.ba().filter(((t3) => t3 instanceof Ut)).reduce(((t3, n3) => {
        if (s2.Un(n3) || !n3.Et()) return t3;
        const e3 = n3.Wt(), r3 = n3.Xs();
        if (e3.Ki() || !r3.Te(i2)) return t3;
        const h3 = r3.kr(i2);
        if (null === h3) return t3;
        const a3 = l(n3.zt()), o3 = 3 === this.Ps.mode ? jt : $t;
        return t3.concat(o3.map(((t4) => e3.Nt(h3.Ft[t4], a3.Ft))));
      }), []);
      if (0 === a2.length) return n2;
      a2.sort(((t3, i3) => Math.abs(t3 - h2) - Math.abs(i3 - h2)));
      const o2 = a2[0];
      return n2 = e2.Ts(o2, r2), n2;
    }
  }
  function Yt(t2, i2, s2) {
    return Math.min(Math.max(t2, i2), s2);
  }
  function Kt(t2, i2, s2) {
    return i2 - t2 <= s2;
  }
  function Xt(t2) {
    const i2 = Math.ceil(t2);
    return i2 % 2 == 0 ? i2 - 1 : i2;
  }
  class Zt extends P {
    constructor() {
      super(...arguments), this.qt = null;
    }
    ht(t2) {
      this.qt = t2;
    }
    et({ context: t2, bitmapSize: i2, horizontalPixelRatio: s2, verticalPixelRatio: e2 }) {
      if (null === this.qt) return;
      const r2 = Math.max(1, Math.floor(s2));
      t2.lineWidth = r2, (function(t3, i3) {
        t3.save(), t3.lineWidth % 2 && t3.translate(0.5, 0.5), i3(), t3.restore();
      })(t2, (() => {
        const h2 = a(this.qt);
        if (h2.xa) {
          t2.strokeStyle = h2.Sa, n(t2, h2.Ca), t2.beginPath();
          for (const n2 of h2.Pa) {
            const e3 = Math.round(n2.ya * s2);
            t2.moveTo(e3, -r2), t2.lineTo(e3, i2.height + r2);
          }
          t2.stroke();
        }
        if (h2.ka) {
          t2.strokeStyle = h2.Ta, n(t2, h2.Ra), t2.beginPath();
          for (const s3 of h2.Da) {
            const n2 = Math.round(s3.ya * e2);
            t2.moveTo(-r2, n2), t2.lineTo(i2.width + r2, n2);
          }
          t2.stroke();
        }
      }));
    }
  }
  class Gt {
    constructor(t2) {
      this.Gt = new Zt(), this.St = true, this.Pt = t2;
    }
    yt() {
      this.St = true;
    }
    Tt() {
      if (this.St) {
        const t2 = this.Pt.Qt().N().grid, i2 = { ka: t2.horzLines.visible, xa: t2.vertLines.visible, Ta: t2.horzLines.color, Sa: t2.vertLines.color, Ra: t2.horzLines.style, Ca: t2.vertLines.style, Da: this.Pt.ks().Ea(), Pa: (this.Pt.Qt().It().Ea() || []).map(((t3) => ({ ya: t3.coord }))) };
        this.Gt.ht(i2), this.St = false;
      }
      return this.Gt;
    }
  }
  class Jt {
    constructor(t2) {
      this.sh = new Gt(t2);
    }
    lr() {
      return this.sh;
    }
  }
  const Qt = { Va: 4, Ba: 1e-4 };
  function ti(t2, i2) {
    const s2 = 100 * (t2 - i2) / i2;
    return i2 < 0 ? -s2 : s2;
  }
  function ii(t2, i2) {
    const s2 = ti(t2.$e(), i2), n2 = ti(t2.je(), i2);
    return new dt(s2, n2);
  }
  function si(t2, i2) {
    const s2 = 100 * (t2 - i2) / i2 + 100;
    return i2 < 0 ? -s2 : s2;
  }
  function ni(t2, i2) {
    const s2 = si(t2.$e(), i2), n2 = si(t2.je(), i2);
    return new dt(s2, n2);
  }
  function ei(t2, i2) {
    const s2 = Math.abs(t2);
    if (s2 < 1e-15) return 0;
    const n2 = Math.log10(s2 + i2.Ba) + i2.Va;
    return t2 < 0 ? -n2 : n2;
  }
  function ri(t2, i2) {
    const s2 = Math.abs(t2);
    if (s2 < 1e-15) return 0;
    const n2 = Math.pow(10, s2 - i2.Va) - i2.Ba;
    return t2 < 0 ? -n2 : n2;
  }
  function hi(t2, i2) {
    if (null === t2) return null;
    const s2 = ei(t2.$e(), i2), n2 = ei(t2.je(), i2);
    return new dt(s2, n2);
  }
  function ai(t2, i2) {
    if (null === t2) return null;
    const s2 = ri(t2.$e(), i2), n2 = ri(t2.je(), i2);
    return new dt(s2, n2);
  }
  function li(t2) {
    if (null === t2) return Qt;
    const i2 = Math.abs(t2.je() - t2.$e());
    if (i2 >= 1 || i2 < 1e-15) return Qt;
    const s2 = Math.ceil(Math.abs(Math.log10(i2))), n2 = Qt.Va + s2;
    return { Va: n2, Ba: 1 / Math.pow(10, n2) };
  }
  class oi {
    constructor(t2, i2) {
      if (this.Ia = t2, this.Aa = i2, (function(t3) {
        if (t3 < 0) return false;
        for (let i3 = t3; i3 > 1; i3 /= 10) if (i3 % 10 != 0) return false;
        return true;
      })(this.Ia)) this.za = [2, 2.5, 2];
      else {
        this.za = [];
        for (let t3 = this.Ia; 1 !== t3; ) {
          if (t3 % 2 == 0) this.za.push(2), t3 /= 2;
          else {
            if (t3 % 5 != 0) throw new Error("unexpected base");
            this.za.push(2, 2.5), t3 /= 5;
          }
          if (this.za.length > 100) throw new Error("something wrong with base");
        }
      }
    }
    Oa(t2, i2, s2) {
      const n2 = 0 === this.Ia ? 0 : 1 / this.Ia;
      let e2 = Math.pow(10, Math.max(0, Math.ceil(Math.log10(t2 - i2)))), r2 = 0, h2 = this.Aa[0];
      for (; ; ) {
        const t3 = Kt(e2, n2, 1e-14) && e2 > n2 + 1e-14, i3 = Kt(e2, s2 * h2, 1e-14), a3 = Kt(e2, 1, 1e-14);
        if (!(t3 && i3 && a3)) break;
        e2 /= h2, h2 = this.Aa[++r2 % this.Aa.length];
      }
      if (e2 <= n2 + 1e-14 && (e2 = n2), e2 = Math.max(1, e2), this.za.length > 0 && (a2 = e2, l2 = 1, o2 = 1e-14, Math.abs(a2 - l2) < o2)) for (r2 = 0, h2 = this.za[0]; Kt(e2, s2 * h2, 1e-14) && e2 > n2 + 1e-14; ) e2 /= h2, h2 = this.za[++r2 % this.za.length];
      var a2, l2, o2;
      return e2;
    }
  }
  class _i {
    constructor(t2, i2, s2, n2) {
      this.La = [], this.qi = t2, this.Ia = i2, this.Na = s2, this.Wa = n2;
    }
    Oa(t2, i2) {
      if (t2 < i2) throw new Error("high < low");
      const s2 = this.qi.$t(), n2 = (t2 - i2) * this.Fa() / s2, e2 = new oi(this.Ia, [2, 2.5, 2]), r2 = new oi(this.Ia, [2, 2, 2.5]), h2 = new oi(this.Ia, [2.5, 2, 2]), a2 = [];
      return a2.push(e2.Oa(t2, i2, n2), r2.Oa(t2, i2, n2), h2.Oa(t2, i2, n2)), (function(t3) {
        if (t3.length < 1) throw Error("array is empty");
        let i3 = t3[0];
        for (let s3 = 1; s3 < t3.length; ++s3) t3[s3] < i3 && (i3 = t3[s3]);
        return i3;
      })(a2);
    }
    Ha() {
      const t2 = this.qi, i2 = t2.zt();
      if (null === i2) return void (this.La = []);
      const s2 = t2.$t(), n2 = this.Na(s2 - 1, i2), e2 = this.Na(0, i2), r2 = this.qi.N().entireTextOnly ? this.Ua() / 2 : 0, h2 = r2, a2 = s2 - 1 - r2, l2 = Math.max(n2, e2), o2 = Math.min(n2, e2);
      if (l2 === o2) return void (this.La = []);
      const _2 = this.Oa(l2, o2);
      if (this.$a(i2, _2, l2, o2, h2, a2), t2.ja() && this.qa(_2, o2, l2)) {
        const t3 = this.qi.Ya();
        this.Ka(i2, _2, h2, a2, t3, 2 * t3);
      }
      const u2 = this.La.map(((t3) => t3.Xa)), c2 = this.qi.Za(u2);
      for (let t3 = 0; t3 < this.La.length; t3++) this.La[t3].Ga = c2[t3];
    }
    Ea() {
      return this.La;
    }
    Ua() {
      return this.qi.P();
    }
    Fa() {
      return Math.ceil(2.5 * this.Ua());
    }
    $a(t2, i2, s2, n2, e2, r2) {
      const h2 = this.La, a2 = this.qi;
      let l2 = s2 % i2;
      l2 += l2 < 0 ? i2 : 0;
      const o2 = s2 >= n2 ? 1 : -1;
      let _2 = null, u2 = 0;
      for (let c2 = s2 - l2; c2 > n2; c2 -= i2) {
        const s3 = this.Wa(c2, t2, true);
        null !== _2 && Math.abs(s3 - _2) < this.Fa() || (s3 < e2 || s3 > r2 || (u2 < h2.length ? (h2[u2].ya = s3, h2[u2].Ga = a2.Ja(c2), h2[u2].Xa = c2) : h2.push({ ya: s3, Ga: a2.Ja(c2), Xa: c2 }), u2++, _2 = s3, a2.Qa() && (i2 = this.Oa(c2 * o2, n2))));
      }
      h2.length = u2;
    }
    Ka(t2, i2, s2, n2, e2, r2) {
      const h2 = this.La, a2 = this.tl(t2, s2, e2, r2), l2 = this.tl(t2, n2, -r2, -e2), o2 = this.Wa(0, t2, true) - this.Wa(i2, t2, true);
      h2.length > 0 && h2[0].ya - a2.ya < o2 / 2 && h2.shift(), h2.length > 0 && l2.ya - h2[h2.length - 1].ya < o2 / 2 && h2.pop(), h2.unshift(a2), h2.push(l2);
    }
    tl(t2, i2, s2, n2) {
      const e2 = (s2 + n2) / 2, r2 = this.Na(i2 + s2, t2), h2 = this.Na(i2 + n2, t2), a2 = Math.min(r2, h2), l2 = Math.max(r2, h2), o2 = Math.max(0.1, this.Oa(l2, a2)), _2 = this.Na(i2 + e2, t2), u2 = _2 - _2 % o2, c2 = this.Wa(u2, t2, true);
      return { Ga: this.qi.Ja(u2), ya: c2, Xa: u2 };
    }
    qa(t2, i2, s2) {
      let n2 = l(this.qi.Qe());
      return this.qi.Qa() && (n2 = ai(n2, this.qi.il())), n2.$e() - i2 < t2 && s2 - n2.je() < t2;
    }
  }
  function ui(t2) {
    return t2.slice().sort(((t3, i2) => a(t3.hs()) - a(i2.hs())));
  }
  var ci;
  !(function(t2) {
    t2[t2.Normal = 0] = "Normal", t2[t2.Logarithmic = 1] = "Logarithmic", t2[t2.Percentage = 2] = "Percentage", t2[t2.IndexedTo100 = 3] = "IndexedTo100";
  })(ci || (ci = {}));
  const di = new J(), fi = new G(100, 1);
  class pi {
    constructor(t2, i2, s2, n2, e2) {
      this.sl = 0, this.nl = null, this.Ge = null, this.el = null, this.rl = { hl: false, al: null }, this.ll = false, this.ol = 0, this._l = 0, this.ul = new o(), this.cl = new o(), this.dl = [], this.fl = null, this.pl = null, this.vl = null, this.ml = null, this.wl = null, this.ha = fi, this.gl = li(null), this.Ml = t2, this.Ps = i2, this.bl = s2, this.xl = n2, this.Sl = e2, this.Cl = new _i(this, 100, this.Pl.bind(this), this.yl.bind(this));
    }
    wa() {
      return this.Ml;
    }
    N() {
      return this.Ps;
    }
    hr(t2) {
      if (_(this.Ps, t2), this.ga(), void 0 !== t2.mode && this.kl({ ie: t2.mode }), void 0 !== t2.scaleMargins) {
        const i2 = h(t2.scaleMargins.top), s2 = h(t2.scaleMargins.bottom);
        if (i2 < 0 || i2 > 1) throw new Error("Invalid top margin - expect value between 0 and 1, given=".concat(i2));
        if (s2 < 0 || s2 > 1) throw new Error("Invalid bottom margin - expect value between 0 and 1, given=".concat(s2));
        if (i2 + s2 > 1) throw new Error("Invalid margins - sum of margins must be less than 1, given=".concat(i2 + s2));
        this.Tl(), this.vl = null;
      }
    }
    Rl() {
      return this.Ps.autoScale;
    }
    Dl() {
      return this.ll;
    }
    Qa() {
      return 1 === this.Ps.mode;
    }
    Oe() {
      return 2 === this.Ps.mode;
    }
    El() {
      return 3 === this.Ps.mode;
    }
    il() {
      return this.gl;
    }
    ie() {
      return { sn: this.Ps.autoScale, Vl: this.Ps.invertScale, ie: this.Ps.mode };
    }
    kl(t2) {
      const i2 = this.ie();
      let s2 = null;
      void 0 !== t2.sn && (this.Ps.autoScale = t2.sn), void 0 !== t2.ie && (this.Ps.mode = t2.ie, 2 !== t2.ie && 3 !== t2.ie || (this.Ps.autoScale = true), this.rl.hl = false), 1 === i2.ie && t2.ie !== i2.ie && (!(function(t3, i3) {
        if (null === t3) return false;
        const s3 = ri(t3.$e(), i3), n3 = ri(t3.je(), i3);
        return isFinite(s3) && isFinite(n3);
      })(this.Ge, this.gl) ? this.Ps.autoScale = true : (s2 = ai(this.Ge, this.gl), null !== s2 && this.Bl(s2))), 1 === t2.ie && t2.ie !== i2.ie && (s2 = hi(this.Ge, this.gl), null !== s2 && this.Bl(s2));
      const n2 = i2.ie !== this.Ps.mode;
      n2 && (2 === i2.ie || this.Oe()) && this.ga(), n2 && (3 === i2.ie || this.El()) && this.ga(), void 0 !== t2.Vl && i2.Vl !== t2.Vl && (this.Ps.invertScale = t2.Vl, this.Il()), this.cl.p(i2, this.ie());
    }
    Al() {
      return this.cl;
    }
    P() {
      return this.bl.fontSize;
    }
    $t() {
      return this.sl;
    }
    zl(t2) {
      this.sl !== t2 && (this.sl = t2, this.Tl(), this.vl = null);
    }
    Ol() {
      if (this.nl) return this.nl;
      const t2 = this.$t() - this.Ll() - this.Nl();
      return this.nl = t2, t2;
    }
    Qe() {
      return this.Wl(), this.Ge;
    }
    Bl(t2, i2) {
      const s2 = this.Ge;
      (i2 || null === s2 && null !== t2 || null !== s2 && !s2.He(t2)) && (this.vl = null, this.Ge = t2);
    }
    Fl(t2) {
      this.Bl(t2), this.Hl(null !== t2);
    }
    Ki() {
      return this.Wl(), 0 === this.sl || !this.Ge || this.Ge.Ki();
    }
    Ul(t2) {
      return this.Vl() ? t2 : this.$t() - 1 - t2;
    }
    Nt(t2, i2) {
      return this.Oe() ? t2 = ti(t2, i2) : this.El() && (t2 = si(t2, i2)), this.yl(t2, i2);
    }
    $l(t2, i2, s2) {
      this.Wl();
      const n2 = this.Nl(), e2 = a(this.Qe()), r2 = e2.$e(), h2 = e2.je(), l2 = this.Ol() - 1, o2 = this.Vl(), _2 = l2 / (h2 - r2), u2 = void 0 === s2 ? 0 : s2.from, c2 = void 0 === s2 ? t2.length : s2.to, d2 = this.jl();
      for (let s3 = u2; s3 < c2; s3++) {
        const e3 = t2[s3], h3 = e3.gt;
        if (isNaN(h3)) continue;
        let a2 = h3;
        null !== d2 && (a2 = d2(e3.gt, i2));
        const l3 = n2 + _2 * (a2 - r2), u3 = o2 ? l3 : this.sl - 1 - l3;
        e3.ut = u3;
      }
    }
    ql(t2, i2, s2) {
      this.Wl();
      const n2 = this.Nl(), e2 = a(this.Qe()), r2 = e2.$e(), h2 = e2.je(), l2 = this.Ol() - 1, o2 = this.Vl(), _2 = l2 / (h2 - r2), u2 = void 0 === s2 ? 0 : s2.from, c2 = void 0 === s2 ? t2.length : s2.to, d2 = this.jl();
      for (let s3 = u2; s3 < c2; s3++) {
        const e3 = t2[s3];
        let h3 = e3.jh, a2 = e3.qh, l3 = e3.Yh, u3 = e3.Kh;
        null !== d2 && (h3 = d2(e3.jh, i2), a2 = d2(e3.qh, i2), l3 = d2(e3.Yh, i2), u3 = d2(e3.Kh, i2));
        let c3 = n2 + _2 * (h3 - r2), f2 = o2 ? c3 : this.sl - 1 - c3;
        e3.Yl = f2, c3 = n2 + _2 * (a2 - r2), f2 = o2 ? c3 : this.sl - 1 - c3, e3.Kl = f2, c3 = n2 + _2 * (l3 - r2), f2 = o2 ? c3 : this.sl - 1 - c3, e3.Xl = f2, c3 = n2 + _2 * (u3 - r2), f2 = o2 ? c3 : this.sl - 1 - c3, e3.Zl = f2;
      }
    }
    Ts(t2, i2) {
      const s2 = this.Pl(t2, i2);
      return this.Gl(s2, i2);
    }
    Gl(t2, i2) {
      let s2 = t2;
      return this.Oe() ? s2 = (function(t3, i3) {
        return i3 < 0 && (t3 = -t3), t3 / 100 * i3 + i3;
      })(s2, i2) : this.El() && (s2 = (function(t3, i3) {
        return t3 -= 100, i3 < 0 && (t3 = -t3), t3 / 100 * i3 + i3;
      })(s2, i2)), s2;
    }
    ba() {
      return this.dl;
    }
    Dt() {
      return this.pl || (this.pl = ui(this.dl)), this.pl;
    }
    Jl(t2) {
      -1 === this.dl.indexOf(t2) && (this.dl.push(t2), this.ga(), this.Ql());
    }
    io(t2) {
      const i2 = this.dl.indexOf(t2);
      if (-1 === i2) throw new Error("source is not attached to scale");
      this.dl.splice(i2, 1), 0 === this.dl.length && (this.kl({ sn: true }), this.Bl(null)), this.ga(), this.Ql();
    }
    zt() {
      let t2 = null;
      for (const i2 of this.dl) {
        const s2 = i2.zt();
        null !== s2 && ((null === t2 || s2.Hh < t2.Hh) && (t2 = s2));
      }
      return null === t2 ? null : t2.Ft;
    }
    Vl() {
      return this.Ps.invertScale;
    }
    Ea() {
      const t2 = null === this.zt();
      if (null !== this.vl && (t2 || this.vl.so === t2)) return this.vl.Ea;
      this.Cl.Ha();
      const i2 = this.Cl.Ea();
      return this.vl = { Ea: i2, so: t2 }, this.ul.p(), i2;
    }
    no() {
      return this.ul;
    }
    eo(t2) {
      this.Oe() || this.El() || null === this.ml && null === this.el && (this.Ki() || (this.ml = this.sl - t2, this.el = a(this.Qe()).Ue()));
    }
    ro(t2) {
      if (this.Oe() || this.El()) return;
      if (null === this.ml) return;
      this.kl({ sn: false }), (t2 = this.sl - t2) < 0 && (t2 = 0);
      let i2 = (this.ml + 0.2 * (this.sl - 1)) / (t2 + 0.2 * (this.sl - 1));
      const s2 = a(this.el).Ue();
      i2 = Math.max(i2, 0.1), s2.Ye(i2), this.Bl(s2);
    }
    ho() {
      this.Oe() || this.El() || (this.ml = null, this.el = null);
    }
    ao(t2) {
      this.Rl() || null === this.wl && null === this.el && (this.Ki() || (this.wl = t2, this.el = a(this.Qe()).Ue()));
    }
    lo(t2) {
      if (this.Rl()) return;
      if (null === this.wl) return;
      const i2 = a(this.Qe()).qe() / (this.Ol() - 1);
      let s2 = t2 - this.wl;
      this.Vl() && (s2 *= -1);
      const n2 = s2 * i2, e2 = a(this.el).Ue();
      e2.Ke(n2), this.Bl(e2, true), this.vl = null;
    }
    oo() {
      this.Rl() || null !== this.wl && (this.wl = null, this.el = null);
    }
    ra() {
      return this.ha || this.ga(), this.ha;
    }
    Zi(t2, i2) {
      switch (this.Ps.mode) {
        case 2:
          return this._o(ti(t2, i2));
        case 3:
          return this.ra().format(si(t2, i2));
        default:
          return this.nr(t2);
      }
    }
    Ja(t2) {
      switch (this.Ps.mode) {
        case 2:
          return this._o(t2);
        case 3:
          return this.ra().format(t2);
        default:
          return this.nr(t2);
      }
    }
    Za(t2) {
      switch (this.Ps.mode) {
        case 2:
          return this.uo(t2);
        case 3:
          return this.ra().formatTickmarks(t2);
        default:
          return this.co(t2);
      }
    }
    Dh(t2) {
      return this.nr(t2, a(this.fl).ra());
    }
    Eh(t2, i2) {
      return t2 = ti(t2, i2), this._o(t2, di);
    }
    do() {
      return this.dl;
    }
    fo(t2) {
      this.rl = { al: t2, hl: false };
    }
    Ns() {
      this.dl.forEach(((t2) => t2.Ns()));
    }
    ja() {
      return this.Ps.ensureEdgeTickMarksVisible && this.Rl();
    }
    Ya() {
      return this.P() / 2;
    }
    ga() {
      this.vl = null;
      let t2 = 1 / 0;
      this.fl = null;
      for (const i3 of this.dl) i3.hs() < t2 && (t2 = i3.hs(), this.fl = i3);
      let i2 = 100;
      null !== this.fl && (i2 = Math.round(1 / this.fl.ea())), this.ha = fi, this.Oe() ? (this.ha = di, i2 = 100) : this.El() ? (this.ha = new G(100, 1), i2 = 100) : null !== this.fl && (this.ha = this.fl.ra()), this.Cl = new _i(this, i2, this.Pl.bind(this), this.yl.bind(this)), this.Cl.Ha();
    }
    Ql() {
      this.pl = null;
    }
    Xi() {
      return this.Sl;
    }
    Hl(t2) {
      this.ll = t2;
    }
    Ll() {
      return this.Vl() ? this.Ps.scaleMargins.bottom * this.$t() + this._l : this.Ps.scaleMargins.top * this.$t() + this.ol;
    }
    Nl() {
      return this.Vl() ? this.Ps.scaleMargins.top * this.$t() + this.ol : this.Ps.scaleMargins.bottom * this.$t() + this._l;
    }
    Wl() {
      this.rl.hl || (this.rl.hl = true, this.po());
    }
    Tl() {
      this.nl = null;
    }
    yl(t2, i2) {
      if (this.Wl(), this.Ki()) return 0;
      t2 = this.Qa() && t2 ? ei(t2, this.gl) : t2;
      const s2 = a(this.Qe()), n2 = this.Nl() + (this.Ol() - 1) * (t2 - s2.$e()) / s2.qe();
      return this.Ul(n2);
    }
    Pl(t2, i2) {
      if (this.Wl(), this.Ki()) return 0;
      const s2 = this.Ul(t2), n2 = a(this.Qe()), e2 = n2.$e() + n2.qe() * ((s2 - this.Nl()) / (this.Ol() - 1));
      return this.Qa() ? ri(e2, this.gl) : e2;
    }
    Il() {
      this.vl = null, this.Cl.Ha();
    }
    po() {
      if (this.Dl() && !this.Rl()) return;
      const t2 = this.rl.al;
      if (null === t2) return;
      let i2 = null;
      const s2 = this.do();
      let n2 = 0, e2 = 0;
      for (const r3 of s2) {
        if (!r3.Et()) continue;
        const s3 = r3.zt();
        if (null === s3) continue;
        const h3 = r3.Mh(t2.Uh(), t2.bi());
        let l2 = h3 && h3.Qe();
        if (null !== l2) {
          switch (this.Ps.mode) {
            case 1:
              l2 = hi(l2, this.gl);
              break;
            case 2:
              l2 = ii(l2, s3.Ft);
              break;
            case 3:
              l2 = ni(l2, s3.Ft);
          }
          if (i2 = null === i2 ? l2 : i2.vn(a(l2)), null !== h3) {
            const t3 = h3.tr();
            null !== t3 && (n2 = Math.max(n2, t3.above), e2 = Math.max(e2, t3.below));
          }
        }
      }
      if (this.ja() && (n2 = Math.max(n2, this.Ya()), e2 = Math.max(e2, this.Ya())), n2 === this.ol && e2 === this._l || (this.ol = n2, this._l = e2, this.vl = null, this.Tl()), null !== i2) {
        if (i2.$e() === i2.je()) {
          const t3 = this.fl, s3 = 5 * (null === t3 || this.Oe() || this.El() ? 1 : t3.ea());
          this.Qa() && (i2 = ai(i2, this.gl)), i2 = new dt(i2.$e() - s3, i2.je() + s3), this.Qa() && (i2 = hi(i2, this.gl));
        }
        if (this.Qa()) {
          const t3 = ai(i2, this.gl), s3 = li(t3);
          if (r2 = s3, h2 = this.gl, r2.Va !== h2.Va || r2.Ba !== h2.Ba) {
            const n3 = null !== this.el ? ai(this.el, this.gl) : null;
            this.gl = s3, i2 = hi(t3, s3), null !== n3 && (this.el = hi(n3, s3));
          }
        }
        this.Bl(i2);
      } else null === this.Ge && (this.Bl(new dt(-0.5, 0.5)), this.gl = li(null));
      var r2, h2;
    }
    jl() {
      return this.Oe() ? ti : this.El() ? si : this.Qa() ? (t2) => ei(t2, this.gl) : null;
    }
    vo(t2, i2, s2) {
      return void 0 === i2 ? (void 0 === s2 && (s2 = this.ra()), s2.format(t2)) : i2(t2);
    }
    mo(t2, i2, s2) {
      return void 0 === i2 ? (void 0 === s2 && (s2 = this.ra()), s2.formatTickmarks(t2)) : i2(t2);
    }
    nr(t2, i2) {
      return this.vo(t2, this.xl.priceFormatter, i2);
    }
    co(t2, i2) {
      var _a2;
      const s2 = this.xl.priceFormatter;
      return this.mo(t2, (_a2 = this.xl.tickmarksPriceFormatter) != null ? _a2 : s2 ? (t3) => t3.map(s2) : void 0, i2);
    }
    _o(t2, i2) {
      return this.vo(t2, this.xl.percentageFormatter, i2);
    }
    uo(t2, i2) {
      var _a2;
      const s2 = this.xl.percentageFormatter;
      return this.mo(t2, (_a2 = this.xl.tickmarksPercentageFormatter) != null ? _a2 : s2 ? (t3) => t3.map(s2) : void 0, i2);
    }
  }
  function vi(t2) {
    return t2 instanceof Ut;
  }
  class mi {
    constructor(t2, i2) {
      this.dl = [], this.wo = /* @__PURE__ */ new Map(), this.sl = 0, this.Mo = 0, this.bo = 1, this.pl = null, this.xo = false, this.So = new o(), this.yh = [], this.uh = t2, this.ts = i2, this.Co = new Jt(this);
      const s2 = i2.N();
      this.Po = this.yo("left", s2.leftPriceScale), this.ko = this.yo("right", s2.rightPriceScale), this.Po.Al().i(this.To.bind(this, this.Po), this), this.ko.Al().i(this.To.bind(this, this.ko), this), this.Ro(s2);
    }
    Ro(t2) {
      if (t2.leftPriceScale && this.Po.hr(t2.leftPriceScale), t2.rightPriceScale && this.ko.hr(t2.rightPriceScale), t2.localization && (this.Po.ga(), this.ko.ga()), t2.overlayPriceScales) {
        const i2 = Array.from(this.wo.values());
        for (const s2 of i2) {
          const i3 = a(s2[0].Wt());
          i3.hr(t2.overlayPriceScales), t2.localization && i3.ga();
        }
      }
    }
    Do(t2) {
      switch (t2) {
        case "left":
          return this.Po;
        case "right":
          return this.ko;
      }
      return this.wo.has(t2) ? h(this.wo.get(t2))[0].Wt() : null;
    }
    m() {
      this.Qt().Eo().u(this), this.Po.Al().u(this), this.ko.Al().u(this), this.dl.forEach(((t2) => {
        t2.m && t2.m();
      })), this.yh = this.yh.filter(((t2) => {
        const i2 = t2.oh();
        return i2.detached && i2.detached(), false;
      })), this.So.p();
    }
    Vo() {
      return this.bo;
    }
    Bo(t2) {
      this.bo = t2;
    }
    Qt() {
      return this.ts;
    }
    Qi() {
      return this.Mo;
    }
    $t() {
      return this.sl;
    }
    Io(t2) {
      this.Mo = t2, this.Ao();
    }
    zl(t2) {
      this.sl = t2, this.Po.zl(t2), this.ko.zl(t2), this.dl.forEach(((i2) => {
        if (this.Un(i2)) {
          const s2 = i2.Wt();
          null !== s2 && s2.zl(t2);
        }
      })), this.Ao();
    }
    zo(t2) {
      this.xo = t2;
    }
    Oo() {
      return this.xo;
    }
    Lo() {
      return this.dl.filter(vi);
    }
    ba() {
      return this.dl;
    }
    Un(t2) {
      const i2 = t2.Wt();
      return null === i2 || this.Po !== i2 && this.ko !== i2;
    }
    Jl(t2, i2, s2) {
      this.No(t2, i2, s2 ? t2.hs() : this.dl.length);
    }
    io(t2, i2) {
      const s2 = this.dl.indexOf(t2);
      r(-1 !== s2, "removeDataSource: invalid data source"), this.dl.splice(s2, 1), i2 || this.dl.forEach(((t3, i3) => t3.ls(i3)));
      const n2 = a(t2.Wt()).wa();
      if (this.wo.has(n2)) {
        const i3 = h(this.wo.get(n2)), s3 = i3.indexOf(t2);
        -1 !== s3 && (i3.splice(s3, 1), 0 === i3.length && this.wo.delete(n2));
      }
      const e2 = t2.Wt();
      e2 && e2.ba().indexOf(t2) >= 0 && (e2.io(t2), this.Wo(e2)), this.pl = null;
    }
    jn(t2) {
      return t2 === this.Po ? "left" : t2 === this.ko ? "right" : "overlay";
    }
    Fo() {
      return this.Po;
    }
    Ho() {
      return this.ko;
    }
    Uo(t2, i2) {
      t2.eo(i2);
    }
    $o(t2, i2) {
      t2.ro(i2), this.Ao();
    }
    jo(t2) {
      t2.ho();
    }
    qo(t2, i2) {
      t2.ao(i2);
    }
    Yo(t2, i2) {
      t2.lo(i2), this.Ao();
    }
    Ko(t2) {
      t2.oo();
    }
    Ao() {
      this.dl.forEach(((t2) => {
        t2.Ns();
      }));
    }
    ks() {
      let t2 = null;
      return this.ts.N().rightPriceScale.visible && 0 !== this.ko.ba().length ? t2 = this.ko : this.ts.N().leftPriceScale.visible && 0 !== this.Po.ba().length ? t2 = this.Po : 0 !== this.dl.length && (t2 = this.dl[0].Wt()), null === t2 && (t2 = this.ko), t2;
    }
    $n() {
      let t2 = null;
      return this.ts.N().rightPriceScale.visible ? t2 = this.ko : this.ts.N().leftPriceScale.visible && (t2 = this.Po), t2;
    }
    Wo(t2) {
      null !== t2 && t2.Rl() && this.Xo(t2);
    }
    Zo(t2) {
      const i2 = this.uh.Pe();
      t2.kl({ sn: true }), null !== i2 && t2.fo(i2), this.Ao();
    }
    Go() {
      this.Xo(this.Po), this.Xo(this.ko);
    }
    Jo() {
      this.Wo(this.Po), this.Wo(this.ko), this.dl.forEach(((t2) => {
        this.Un(t2) && this.Wo(t2.Wt());
      })), this.Ao(), this.ts.ar();
    }
    Dt() {
      return null === this.pl && (this.pl = ui(this.dl)), this.pl;
    }
    Qo(t2, i2) {
      i2 = Yt(i2, 0, this.dl.length - 1);
      const s2 = this.dl.indexOf(t2);
      r(-1 !== s2, "setSeriesOrder: invalid data source"), this.dl.splice(s2, 1), this.dl.splice(i2, 0, t2), this.dl.forEach(((t3, i3) => t3.ls(i3))), this.pl = null;
      for (const t3 of [this.Po, this.ko]) t3.Ql(), t3.ga();
      this.ts.ar();
    }
    Vt() {
      return this.Dt().filter(vi);
    }
    t_() {
      return this.So;
    }
    i_() {
      return this.Co;
    }
    ua(t2) {
      this.yh.push(new Et(t2));
    }
    ca(t2) {
      this.yh = this.yh.filter(((i2) => i2.oh() !== t2)), t2.detached && t2.detached(), this.ts.ar();
    }
    s_() {
      return this.yh;
    }
    sa(t2, i2) {
      return this.yh.map(((s2) => s2.Yn(t2, i2))).filter(((t3) => null !== t3));
    }
    Xo(t2) {
      const i2 = t2.do();
      if (i2 && i2.length > 0 && !this.uh.Ki()) {
        const i3 = this.uh.Pe();
        null !== i3 && t2.fo(i3);
      }
      t2.Ns();
    }
    No(t2, i2, s2) {
      let n2 = this.Do(i2);
      if (null === n2 && (n2 = this.yo(i2, this.ts.N().overlayPriceScales)), this.dl.splice(s2, 0, t2), !q(i2)) {
        const s3 = this.wo.get(i2) || [];
        s3.push(t2), this.wo.set(i2, s3);
      }
      t2.ls(s2), n2.Jl(t2), t2._s(n2), this.Wo(n2), this.pl = null;
    }
    To(t2, i2, s2) {
      i2.ie !== s2.ie && this.Xo(t2);
    }
    yo(t2, i2) {
      const s2 = { visible: true, autoScale: true, ...p(i2) }, n2 = new pi(t2, s2, this.ts.N().layout, this.ts.N().localization, this.ts.Xi());
      return n2.zl(this.$t()), n2;
    }
  }
  function wi(t2) {
    return { n_: t2.n_, e_: { Kn: t2.r_.externalId }, h_: t2.r_.cursorStyle };
  }
  function gi(t2, i2, s2, n2) {
    for (const e2 of t2) {
      const t3 = e2.Tt(n2);
      if (null !== t3 && t3.Yn) {
        const n3 = t3.Yn(i2, s2);
        if (null !== n3) return { a_: e2, e_: n3 };
      }
    }
    return null;
  }
  function Mi(t2) {
    return void 0 !== t2.Ws;
  }
  function bi(t2, i2, s2) {
    const n2 = [t2, ...t2.Dt()], e2 = (function(t3, i3, s3) {
      var _a2, _b;
      let n3, e3;
      for (const a2 of t3) {
        const t4 = (_b = (_a2 = a2.sa) == null ? void 0 : _a2.call(a2, i3, s3)) != null ? _b : [];
        for (const i4 of t4) r2 = i4.zOrder, h2 = n3 == null ? void 0 : n3.zOrder, (!h2 || "top" === r2 && "top" !== h2 || "normal" === r2 && "bottom" === h2) && (n3 = i4, e3 = a2);
      }
      var r2, h2;
      return n3 && e3 ? { r_: n3, n_: e3 } : null;
    })(n2, i2, s2);
    if ("top" === (e2 == null ? void 0 : e2.r_.zOrder)) return wi(e2);
    for (const r2 of n2) {
      if (e2 && e2.n_ === r2 && "bottom" !== e2.r_.zOrder && !e2.r_.isBackground) return wi(e2);
      if (Mi(r2)) {
        const n3 = gi(r2.Ws(t2), i2, s2, t2);
        if (null !== n3) return { n_: r2, a_: n3.a_, e_: n3.e_ };
      }
      if (e2 && e2.n_ === r2 && "bottom" !== e2.r_.zOrder && e2.r_.isBackground) return wi(e2);
    }
    return (e2 == null ? void 0 : e2.r_) ? wi(e2) : null;
  }
  class xi {
    constructor(t2, i2, s2 = 50) {
      this.yn = 0, this.kn = 1, this.Tn = 1, this.Dn = /* @__PURE__ */ new Map(), this.Rn = /* @__PURE__ */ new Map(), this.l_ = t2, this.o_ = i2, this.En = s2;
    }
    __(t2) {
      const i2 = t2.time, s2 = this.o_.cacheKey(i2), n2 = this.Dn.get(s2);
      if (void 0 !== n2) return n2.u_;
      if (this.yn === this.En) {
        const t3 = this.Rn.get(this.Tn);
        this.Rn.delete(this.Tn), this.Dn.delete(h(t3)), this.Tn++, this.yn--;
      }
      const e2 = this.l_(t2);
      return this.Dn.set(s2, { u_: e2, An: this.kn }), this.Rn.set(this.kn, s2), this.yn++, this.kn++, e2;
    }
  }
  class Si {
    constructor(t2, i2) {
      r(t2 <= i2, "right should be >= left"), this.c_ = t2, this.d_ = i2;
    }
    Uh() {
      return this.c_;
    }
    bi() {
      return this.d_;
    }
    f_() {
      return this.d_ - this.c_ + 1;
    }
    Te(t2) {
      return this.c_ <= t2 && t2 <= this.d_;
    }
    He(t2) {
      return this.c_ === t2.Uh() && this.d_ === t2.bi();
    }
  }
  function Ci(t2, i2) {
    return null === t2 || null === i2 ? t2 === i2 : t2.He(i2);
  }
  class Pi {
    constructor() {
      this.p_ = /* @__PURE__ */ new Map(), this.Dn = null, this.v_ = false;
    }
    m_(t2) {
      this.v_ = t2, this.Dn = null;
    }
    w_(t2, i2) {
      this.g_(i2), this.Dn = null;
      for (let s2 = i2; s2 < t2.length; ++s2) {
        const i3 = t2[s2];
        let n2 = this.p_.get(i3.timeWeight);
        void 0 === n2 && (n2 = [], this.p_.set(i3.timeWeight, n2)), n2.push({ index: s2, time: i3.time, weight: i3.timeWeight, originalTime: i3.originalTime });
      }
    }
    M_(t2, i2, s2, n2, e2) {
      const r2 = Math.ceil(i2 / t2);
      return null !== this.Dn && this.Dn.b_ === r2 && e2 === this.Dn.x_ && s2 === this.Dn.S_ || (this.Dn = { x_: e2, S_: s2, Ea: this.C_(r2, s2, n2), b_: r2 }), this.Dn.Ea;
    }
    g_(t2) {
      if (0 === t2) return void this.p_.clear();
      const i2 = [];
      this.p_.forEach(((s2, n2) => {
        t2 <= s2[0].index ? i2.push(n2) : s2.splice(xt(s2, t2, ((i3) => i3.index < t2)), 1 / 0);
      }));
      for (const t3 of i2) this.p_.delete(t3);
    }
    C_(t2, i2, s2) {
      let n2 = [];
      const e2 = (t3) => !i2 || s2.has(t3.index);
      for (const i3 of Array.from(this.p_.keys()).sort(((t3, i4) => i4 - t3))) {
        if (!this.p_.get(i3)) continue;
        const s3 = n2;
        n2 = [];
        const r2 = s3.length;
        let a2 = 0;
        const l2 = h(this.p_.get(i3)), o2 = l2.length;
        let _2 = 1 / 0, u2 = -1 / 0;
        for (let i4 = 0; i4 < o2; i4++) {
          const h2 = l2[i4], o3 = h2.index;
          for (; a2 < r2; ) {
            const t3 = s3[a2], i5 = t3.index;
            if (!(i5 < o3 && e2(t3))) {
              _2 = i5;
              break;
            }
            a2++, n2.push(t3), u2 = i5, _2 = 1 / 0;
          }
          if (_2 - o3 >= t2 && o3 - u2 >= t2 && e2(h2)) n2.push(h2), u2 = o3;
          else if (this.v_) return s3;
        }
        for (; a2 < r2; a2++) e2(s3[a2]) && n2.push(s3[a2]);
      }
      return n2;
    }
  }
  class yi {
    constructor(t2) {
      this.P_ = t2;
    }
    y_() {
      return null === this.P_ ? null : new Si(Math.floor(this.P_.Uh()), Math.ceil(this.P_.bi()));
    }
    k_() {
      return this.P_;
    }
    static T_() {
      return new yi(null);
    }
  }
  function ki(t2, i2) {
    return t2.weight > i2.weight ? t2 : i2;
  }
  class Ti {
    constructor(t2, i2, s2, n2) {
      this.Mo = 0, this.R_ = null, this.D_ = [], this.wl = null, this.ml = null, this.E_ = new Pi(), this.V_ = /* @__PURE__ */ new Map(), this.B_ = yi.T_(), this.I_ = true, this.A_ = new o(), this.z_ = new o(), this.O_ = new o(), this.L_ = null, this.N_ = null, this.W_ = /* @__PURE__ */ new Map(), this.F_ = -1, this.H_ = [], this.Ps = i2, this.xl = s2, this.U_ = i2.rightOffset, this.j_ = i2.barSpacing, this.ts = t2, this.o_ = n2, this.q_(), this.E_.m_(i2.uniformDistribution), this.Y_();
    }
    N() {
      return this.Ps;
    }
    K_(t2) {
      _(this.xl, t2), this.X_(), this.q_();
    }
    hr(t2, i2) {
      var _a2;
      _(this.Ps, t2), this.Ps.fixLeftEdge && this.Z_(), this.Ps.fixRightEdge && this.G_(), void 0 !== t2.barSpacing && this.ts.dn(t2.barSpacing), void 0 !== t2.rightOffset && this.ts.fn(t2.rightOffset), void 0 === t2.minBarSpacing && void 0 === t2.maxBarSpacing || this.ts.dn((_a2 = t2.barSpacing) != null ? _a2 : this.j_), void 0 !== t2.ignoreWhitespaceIndices && t2.ignoreWhitespaceIndices !== this.Ps.ignoreWhitespaceIndices && this.Y_(), this.X_(), this.q_(), this.O_.p();
    }
    Rs(t2) {
      var _a2, _b;
      return (_b = (_a2 = this.D_[t2]) == null ? void 0 : _a2.time) != null ? _b : null;
    }
    ss(t2) {
      var _a2;
      return (_a2 = this.D_[t2]) != null ? _a2 : null;
    }
    J_(t2, i2) {
      if (this.D_.length < 1) return null;
      if (this.o_.key(t2) > this.o_.key(this.D_[this.D_.length - 1].time)) return i2 ? this.D_.length - 1 : null;
      const s2 = xt(this.D_, this.o_.key(t2), ((t3, i3) => this.o_.key(t3.time) < i3));
      return this.o_.key(t2) < this.o_.key(this.D_[s2].time) ? i2 ? s2 : null : s2;
    }
    Ki() {
      return 0 === this.Mo || 0 === this.D_.length || null === this.R_;
    }
    Q_() {
      return this.D_.length > 0;
    }
    Pe() {
      return this.tu(), this.B_.y_();
    }
    iu() {
      return this.tu(), this.B_.k_();
    }
    su() {
      const t2 = this.Pe();
      if (null === t2) return null;
      const i2 = { from: t2.Uh(), to: t2.bi() };
      return this.nu(i2);
    }
    nu(t2) {
      const i2 = Math.round(t2.from), s2 = Math.round(t2.to), n2 = a(this.eu()), e2 = a(this.ru());
      return { from: a(this.ss(Math.max(n2, i2))), to: a(this.ss(Math.min(e2, s2))) };
    }
    hu(t2) {
      return { from: a(this.J_(t2.from, true)), to: a(this.J_(t2.to, true)) };
    }
    Qi() {
      return this.Mo;
    }
    Io(t2) {
      if (!isFinite(t2) || t2 <= 0) return;
      if (this.Mo === t2) return;
      const i2 = this.iu(), s2 = this.Mo;
      if (this.Mo = t2, this.I_ = true, this.Ps.lockVisibleTimeRangeOnResize && 0 !== s2) {
        const i3 = this.j_ * t2 / s2;
        this.j_ = i3;
      }
      if (this.Ps.fixLeftEdge && null !== i2 && i2.Uh() <= 0) {
        const i3 = s2 - t2;
        this.U_ -= Math.round(i3 / this.j_) + 1, this.I_ = true;
      }
      this.au(), this.lu();
    }
    jt(t2) {
      if (this.Ki() || !c(t2)) return 0;
      const i2 = this.ou() + this.U_ - t2;
      return this.Mo - (i2 + 0.5) * this.j_ - 1;
    }
    _u(t2, i2) {
      const s2 = this.ou(), n2 = void 0 === i2 ? 0 : i2.from, e2 = void 0 === i2 ? t2.length : i2.to;
      for (let i3 = n2; i3 < e2; i3++) {
        const n3 = t2[i3].wt, e3 = s2 + this.U_ - n3, r2 = this.Mo - (e3 + 0.5) * this.j_ - 1;
        t2[i3]._t = r2;
      }
    }
    uu(t2, i2) {
      const s2 = Math.ceil(this.cu(t2));
      return i2 && this.Ps.ignoreWhitespaceIndices && !this.du(s2) ? this.fu(s2) : s2;
    }
    fn(t2) {
      this.I_ = true, this.U_ = t2, this.lu(), this.ts.pu(), this.ts.ar();
    }
    vu() {
      return this.j_;
    }
    dn(t2) {
      this.mu(t2), this.lu(), this.ts.pu(), this.ts.ar();
    }
    wu() {
      return this.U_;
    }
    Ea() {
      if (this.Ki()) return null;
      if (null !== this.N_) return this.N_;
      const t2 = this.j_, i2 = 5 * (this.ts.N().layout.fontSize + 4) / 8 * (this.Ps.tickMarkMaxCharacterLength || 8), s2 = Math.round(i2 / t2), n2 = a(this.Pe()), e2 = Math.max(n2.Uh(), n2.Uh() - s2), r2 = Math.max(n2.bi(), n2.bi() - s2), h2 = this.E_.M_(t2, i2, this.Ps.ignoreWhitespaceIndices, this.W_, this.F_), l2 = this.eu() + s2, o2 = this.ru() - s2, _2 = this.gu(), u2 = this.Ps.fixLeftEdge || _2, c2 = this.Ps.fixRightEdge || _2;
      let d2 = 0;
      for (const t3 of h2) {
        if (!(e2 <= t3.index && t3.index <= r2)) continue;
        let s3;
        d2 < this.H_.length ? (s3 = this.H_[d2], s3.coord = this.jt(t3.index), s3.label = this.Mu(t3), s3.weight = t3.weight) : (s3 = { needAlignCoordinate: false, coord: this.jt(t3.index), label: this.Mu(t3), weight: t3.weight }, this.H_.push(s3)), this.j_ > i2 / 2 && !_2 ? s3.needAlignCoordinate = false : s3.needAlignCoordinate = u2 && t3.index <= l2 || c2 && t3.index >= o2, d2++;
      }
      return this.H_.length = d2, this.N_ = this.H_, this.H_;
    }
    bu() {
      this.I_ = true, this.dn(this.Ps.barSpacing), this.fn(this.Ps.rightOffset);
    }
    xu(t2) {
      this.I_ = true, this.R_ = t2, this.lu(), this.Z_();
    }
    Su(t2, i2) {
      const s2 = this.cu(t2), n2 = this.vu(), e2 = n2 + i2 * (n2 / 10);
      this.dn(e2), this.Ps.rightBarStaysOnScroll || this.fn(this.wu() + (s2 - this.cu(t2)));
    }
    eo(t2) {
      this.wl && this.oo(), null === this.ml && null === this.L_ && (this.Ki() || (this.ml = t2, this.Cu()));
    }
    ro(t2) {
      if (null === this.L_) return;
      const i2 = Yt(this.Mo - t2, 0, this.Mo), s2 = Yt(this.Mo - a(this.ml), 0, this.Mo);
      0 !== i2 && 0 !== s2 && this.dn(this.L_.vu * i2 / s2);
    }
    ho() {
      null !== this.ml && (this.ml = null, this.Pu());
    }
    ao(t2) {
      null === this.wl && null === this.L_ && (this.Ki() || (this.wl = t2, this.Cu()));
    }
    lo(t2) {
      if (null === this.wl) return;
      const i2 = (this.wl - t2) / this.vu();
      this.U_ = a(this.L_).wu + i2, this.I_ = true, this.lu();
    }
    oo() {
      null !== this.wl && (this.wl = null, this.Pu());
    }
    yu() {
      this.ku(this.Ps.rightOffset);
    }
    ku(t2, i2 = 400) {
      if (!isFinite(t2)) throw new RangeError("offset is required and must be finite number");
      if (!isFinite(i2) || i2 <= 0) throw new RangeError("animationDuration (optional) must be finite positive number");
      const s2 = this.U_, n2 = performance.now();
      this.ts._n({ Tu: (t3) => (t3 - n2) / i2 >= 1, Ru: (e2) => {
        const r2 = (e2 - n2) / i2;
        return r2 >= 1 ? t2 : s2 + (t2 - s2) * r2;
      } });
    }
    yt(t2, i2) {
      this.I_ = true, this.D_ = t2, this.E_.w_(t2, i2), this.lu();
    }
    Du() {
      return this.A_;
    }
    Eu() {
      return this.z_;
    }
    Vu() {
      return this.O_;
    }
    ou() {
      return this.R_ || 0;
    }
    Bu(t2) {
      const i2 = t2.f_();
      this.mu(this.Mo / i2), this.U_ = t2.bi() - this.ou(), this.lu(), this.I_ = true, this.ts.pu(), this.ts.ar();
    }
    Iu() {
      const t2 = this.eu(), i2 = this.ru();
      null !== t2 && null !== i2 && this.Bu(new Si(t2, i2 + this.Ps.rightOffset));
    }
    Au(t2) {
      const i2 = new Si(t2.from, t2.to);
      this.Bu(i2);
    }
    ns(t2) {
      return void 0 !== this.xl.timeFormatter ? this.xl.timeFormatter(t2.originalTime) : this.o_.formatHorzItem(t2.time);
    }
    Y_() {
      if (!this.Ps.ignoreWhitespaceIndices) return;
      this.W_.clear();
      const t2 = this.ts.Ys();
      for (const i2 of t2) for (const t3 of i2.ma()) this.W_.set(t3, true);
      this.F_++;
    }
    gu() {
      const t2 = this.ts.N().handleScroll, i2 = this.ts.N().handleScale;
      return !(t2.horzTouchDrag || t2.mouseWheel || t2.pressedMouseMove || t2.vertTouchDrag || i2.axisDoubleClickReset.time || i2.axisPressedMouseMove.time || i2.mouseWheel || i2.pinch);
    }
    eu() {
      return 0 === this.D_.length ? null : 0;
    }
    ru() {
      return 0 === this.D_.length ? null : this.D_.length - 1;
    }
    zu(t2) {
      return (this.Mo - 1 - t2) / this.j_;
    }
    cu(t2) {
      const i2 = this.zu(t2), s2 = this.ou() + this.U_ - i2;
      return Math.round(1e6 * s2) / 1e6;
    }
    mu(t2) {
      const i2 = this.j_;
      this.j_ = t2, this.au(), i2 !== this.j_ && (this.I_ = true, this.Ou());
    }
    tu() {
      if (!this.I_) return;
      if (this.I_ = false, this.Ki()) return void this.Lu(yi.T_());
      const t2 = this.ou(), i2 = this.Mo / this.j_, s2 = this.U_ + t2, n2 = new Si(s2 - i2 + 1, s2);
      this.Lu(new yi(n2));
    }
    au() {
      const t2 = Yt(this.j_, this.Nu(), this.Wu());
      this.j_ !== t2 && (this.j_ = t2, this.I_ = true);
    }
    Wu() {
      return this.Ps.maxBarSpacing > 0 ? this.Ps.maxBarSpacing : 0.5 * this.Mo;
    }
    Nu() {
      return this.Ps.fixLeftEdge && this.Ps.fixRightEdge && 0 !== this.D_.length ? this.Mo / this.D_.length : this.Ps.minBarSpacing;
    }
    lu() {
      const t2 = this.Fu();
      null !== t2 && this.U_ < t2 && (this.U_ = t2, this.I_ = true);
      const i2 = this.Hu();
      this.U_ > i2 && (this.U_ = i2, this.I_ = true);
    }
    Fu() {
      const t2 = this.eu(), i2 = this.R_;
      if (null === t2 || null === i2) return null;
      return t2 - i2 - 1 + (this.Ps.fixLeftEdge ? this.Mo / this.j_ : Math.min(2, this.D_.length));
    }
    Hu() {
      return this.Ps.fixRightEdge ? 0 : this.Mo / this.j_ - Math.min(2, this.D_.length);
    }
    Cu() {
      this.L_ = { vu: this.vu(), wu: this.wu() };
    }
    Pu() {
      this.L_ = null;
    }
    Mu(t2) {
      let i2 = this.V_.get(t2.weight);
      return void 0 === i2 && (i2 = new xi(((t3) => this.Uu(t3)), this.o_), this.V_.set(t2.weight, i2)), i2.__(t2);
    }
    Uu(t2) {
      return this.o_.formatTickmark(t2, this.xl);
    }
    Lu(t2) {
      const i2 = this.B_;
      this.B_ = t2, Ci(i2.y_(), this.B_.y_()) || this.A_.p(), Ci(i2.k_(), this.B_.k_()) || this.z_.p(), this.Ou();
    }
    Ou() {
      this.N_ = null;
    }
    X_() {
      this.Ou(), this.V_.clear();
    }
    q_() {
      this.o_.updateFormatter(this.xl);
    }
    Z_() {
      if (!this.Ps.fixLeftEdge) return;
      const t2 = this.eu();
      if (null === t2) return;
      const i2 = this.Pe();
      if (null === i2) return;
      const s2 = i2.Uh() - t2;
      if (s2 < 0) {
        const t3 = this.U_ - s2 - 1;
        this.fn(t3);
      }
      this.au();
    }
    G_() {
      this.lu(), this.au();
    }
    du(t2) {
      return !this.Ps.ignoreWhitespaceIndices || (this.W_.get(t2) || false);
    }
    fu(t2) {
      const i2 = (function* (t3) {
        const i3 = Math.round(t3), s3 = i3 < t3;
        let n2 = 1;
        for (; ; ) s3 ? (yield i3 + n2, yield i3 - n2) : (yield i3 - n2, yield i3 + n2), n2++;
      })(t2), s2 = this.ru();
      for (; s2; ) {
        const t3 = i2.next().value;
        if (this.W_.get(t3)) return t3;
        if (t3 < 0 || t3 > s2) break;
      }
      return t2;
    }
  }
  var Ri, Di, Ei, Vi, Bi;
  !(function(t2) {
    t2[t2.OnTouchEnd = 0] = "OnTouchEnd", t2[t2.OnNextTap = 1] = "OnNextTap";
  })(Ri || (Ri = {}));
  class Ii {
    constructor(t2, i2, s2) {
      this.$u = [], this.ju = [], this.Mo = 0, this.qu = null, this.Yu = new o(), this.Ku = new o(), this.Xu = null, this.Zu = t2, this.Ps = i2, this.o_ = s2, this.Sl = new S(this.Ps.layout.colorParsers), this.Gu = new M(this), this.uh = new Ti(this, i2.timeScale, this.Ps.localization, s2), this.Ct = new j(this, i2.crosshair), this.Ju = new qt(i2.crosshair), i2.addDefaultPane && (this.Qu(0), this.$u[0].Bo(2)), this.tc = this.sc(0), this.nc = this.sc(1);
    }
    Bh() {
      this.ec(Y.gn());
    }
    ar() {
      this.ec(Y.wn());
    }
    Zh() {
      this.ec(new Y(1));
    }
    Ih(t2) {
      const i2 = this.rc(t2);
      this.ec(i2);
    }
    hc() {
      return this.qu;
    }
    ac(t2) {
      var _a2, _b, _c, _d;
      if (((_a2 = this.qu) == null ? void 0 : _a2.n_) === (t2 == null ? void 0 : t2.n_) && ((_c = (_b = this.qu) == null ? void 0 : _b.e_) == null ? void 0 : _c.Kn) === ((_d = t2 == null ? void 0 : t2.e_) == null ? void 0 : _d.Kn)) return;
      const i2 = this.qu;
      this.qu = t2, null !== i2 && this.Ih(i2.n_), null !== t2 && t2.n_ !== (i2 == null ? void 0 : i2.n_) && this.Ih(t2.n_);
    }
    N() {
      return this.Ps;
    }
    hr(t2) {
      _(this.Ps, t2), this.$u.forEach(((i2) => i2.Ro(t2))), void 0 !== t2.timeScale && this.uh.hr(t2.timeScale), void 0 !== t2.localization && this.uh.K_(t2.localization), (t2.leftPriceScale || t2.rightPriceScale) && this.Yu.p(), this.tc = this.sc(0), this.nc = this.sc(1), this.Bh();
    }
    lc(t2, i2, s2 = 0) {
      const n2 = this.$u[s2];
      if (void 0 === n2) return;
      if ("left" === t2) return _(this.Ps, { leftPriceScale: i2 }), n2.Ro({ leftPriceScale: i2 }), this.Yu.p(), void this.Bh();
      if ("right" === t2) return _(this.Ps, { rightPriceScale: i2 }), n2.Ro({ rightPriceScale: i2 }), this.Yu.p(), void this.Bh();
      const e2 = this.oc(t2, s2);
      null !== e2 && (e2.Wt.hr(i2), this.Yu.p());
    }
    oc(t2, i2) {
      const s2 = this.$u[i2];
      if (void 0 === s2) return null;
      const n2 = s2.Do(t2);
      return null !== n2 ? { Us: s2, Wt: n2 } : null;
    }
    It() {
      return this.uh;
    }
    $s() {
      return this.$u;
    }
    _c() {
      return this.Ct;
    }
    uc() {
      return this.Ku;
    }
    cc(t2, i2) {
      t2.zl(i2), this.pu();
    }
    Io(t2) {
      this.Mo = t2, this.uh.Io(this.Mo), this.$u.forEach(((i2) => i2.Io(t2))), this.pu();
    }
    dc(t2) {
      1 !== this.$u.length && (r(t2 >= 0 && t2 < this.$u.length, "Invalid pane index"), this.$u.splice(t2, 1), this.Bh());
    }
    fc(t2, i2) {
      if (this.$u.length < 2) return;
      r(t2 >= 0 && t2 < this.$u.length, "Invalid pane index");
      const s2 = this.$u[t2], n2 = this.$u.reduce(((t3, i3) => t3 + i3.Vo()), 0), e2 = this.$u.reduce(((t3, i3) => t3 + i3.$t()), 0), h2 = e2 - 30 * (this.$u.length - 1);
      i2 = Math.min(h2, Math.max(30, i2));
      const a2 = n2 / e2, l2 = s2.$t();
      s2.Bo(i2 * a2);
      let o2 = i2 - l2, _2 = this.$u.length - 1;
      for (const t3 of this.$u) if (t3 !== s2) {
        const i3 = Math.min(h2, Math.max(30, t3.$t() - o2 / _2));
        o2 -= t3.$t() - i3, _2 -= 1;
        const s3 = i3 * a2;
        t3.Bo(s3);
      }
      this.Bh();
    }
    vc(t2, i2) {
      r(t2 >= 0 && t2 < this.$u.length && i2 >= 0 && i2 < this.$u.length, "Invalid pane index");
      const s2 = this.$u[t2], n2 = this.$u[i2];
      this.$u[t2] = n2, this.$u[i2] = s2, this.Bh();
    }
    mc(t2, i2) {
      if (r(t2 >= 0 && t2 < this.$u.length && i2 >= 0 && i2 < this.$u.length, "Invalid pane index"), t2 === i2) return;
      const [s2] = this.$u.splice(t2, 1);
      this.$u.splice(i2, 0, s2), this.Bh();
    }
    Uo(t2, i2, s2) {
      t2.Uo(i2, s2);
    }
    $o(t2, i2, s2) {
      t2.$o(i2, s2), this.Ah(), this.ec(this.wc(t2, 2));
    }
    jo(t2, i2) {
      t2.jo(i2), this.ec(this.wc(t2, 2));
    }
    qo(t2, i2, s2) {
      i2.Rl() || t2.qo(i2, s2);
    }
    Yo(t2, i2, s2) {
      i2.Rl() || (t2.Yo(i2, s2), this.Ah(), this.ec(this.wc(t2, 2)));
    }
    Ko(t2, i2) {
      i2.Rl() || (t2.Ko(i2), this.ec(this.wc(t2, 2)));
    }
    Zo(t2, i2) {
      t2.Zo(i2), this.ec(this.wc(t2, 2));
    }
    gc(t2) {
      this.uh.eo(t2);
    }
    Mc(t2, i2) {
      const s2 = this.It();
      if (s2.Ki() || 0 === i2) return;
      const n2 = s2.Qi();
      t2 = Math.max(1, Math.min(t2, n2)), s2.Su(t2, i2), this.pu();
    }
    bc(t2) {
      this.xc(0), this.Sc(t2), this.Cc();
    }
    Pc(t2) {
      this.uh.ro(t2), this.pu();
    }
    yc() {
      this.uh.ho(), this.ar();
    }
    xc(t2) {
      this.uh.ao(t2);
    }
    Sc(t2) {
      this.uh.lo(t2), this.pu();
    }
    Cc() {
      this.uh.oo(), this.ar();
    }
    Ys() {
      return this.ju;
    }
    kc(t2, i2, s2, n2, e2) {
      this.Ct.Es(t2, i2);
      let r2 = NaN, h2 = this.uh.uu(t2, true);
      const a2 = this.uh.Pe();
      null !== a2 && (h2 = Math.min(Math.max(a2.Uh(), h2), a2.bi()));
      const l2 = n2.ks(), o2 = l2.zt();
      if (null !== o2 && (r2 = l2.Ts(i2, o2)), r2 = this.Ju.Ma(r2, h2, n2), this.Ct.As(h2, r2, n2), this.Zh(), !e2) {
        const e3 = bi(n2, t2, i2);
        this.ac(e3 && { n_: e3.n_, e_: e3.e_, h_: e3.h_ || null }), this.Ku.p(this.Ct.Bt(), { x: t2, y: i2 }, s2);
      }
    }
    Tc(t2, i2, s2) {
      const n2 = s2.ks(), e2 = n2.zt(), r2 = n2.Nt(t2, a(e2)), h2 = this.uh.J_(i2, true), l2 = this.uh.jt(a(h2));
      this.kc(l2, r2, null, s2, true);
    }
    Rc(t2) {
      this._c().Os(), this.Zh(), t2 || this.Ku.p(null, null, null);
    }
    Ah() {
      const t2 = this.Ct.Us();
      if (null !== t2) {
        const i2 = this.Ct.Bs(), s2 = this.Ct.Is();
        this.kc(i2, s2, null, t2);
      }
      this.Ct.Ns();
    }
    Dc(t2, i2, s2) {
      const n2 = this.uh.Rs(0);
      void 0 !== i2 && void 0 !== s2 && this.uh.yt(i2, s2);
      const e2 = this.uh.Rs(0), r2 = this.uh.ou(), h2 = this.uh.Pe();
      if (null !== h2 && null !== n2 && null !== e2) {
        const i3 = h2.Te(r2), a2 = this.o_.key(n2) > this.o_.key(e2), l2 = null !== t2 && t2 > r2 && !a2, o2 = this.uh.N().allowShiftVisibleRangeOnWhitespaceReplacement, _2 = i3 && (!(void 0 === s2) || o2) && this.uh.N().shiftVisibleRangeOnNewBar;
        if (l2 && !_2) {
          const i4 = t2 - r2;
          this.uh.fn(this.uh.wu() - i4);
        }
      }
      this.uh.xu(t2);
    }
    Oh(t2) {
      null !== t2 && t2.Jo();
    }
    Hn(t2) {
      if ((function(t3) {
        return t3 instanceof mi;
      })(t2)) return t2;
      const i2 = this.$u.find(((i3) => i3.Dt().includes(t2)));
      return void 0 === i2 ? null : i2;
    }
    pu() {
      this.$u.forEach(((t2) => t2.Jo())), this.Ah();
    }
    m() {
      this.$u.forEach(((t2) => t2.m())), this.$u.length = 0, this.Ps.localization.priceFormatter = void 0, this.Ps.localization.percentageFormatter = void 0, this.Ps.localization.timeFormatter = void 0;
    }
    Ec() {
      return this.Gu;
    }
    qn() {
      return this.Gu.N();
    }
    Eo() {
      return this.Yu;
    }
    Vc(t2, i2) {
      const s2 = this.Qu(i2);
      this.Bc(t2, s2), this.ju.push(t2), 1 === this.ju.length ? this.Bh() : this.ar();
    }
    Ic(t2) {
      const i2 = this.Hn(t2), s2 = this.ju.indexOf(t2);
      r(-1 !== s2, "Series not found");
      const n2 = a(i2);
      this.ju.splice(s2, 1), n2.io(t2), t2.m && t2.m(), this.uh.Y_(), this.Ac(n2);
    }
    Vh(t2, i2) {
      const s2 = a(this.Hn(t2));
      s2.io(t2, true), s2.Jl(t2, i2, true);
    }
    Iu() {
      const t2 = Y.wn();
      t2.rn(), this.ec(t2);
    }
    zc(t2) {
      const i2 = Y.wn();
      i2.ln(t2), this.ec(i2);
    }
    cn() {
      const t2 = Y.wn();
      t2.cn(), this.ec(t2);
    }
    dn(t2) {
      const i2 = Y.wn();
      i2.dn(t2), this.ec(i2);
    }
    fn(t2) {
      const i2 = Y.wn();
      i2.fn(t2), this.ec(i2);
    }
    _n(t2) {
      const i2 = Y.wn();
      i2._n(t2), this.ec(i2);
    }
    hn() {
      const t2 = Y.wn();
      t2.hn(), this.ec(t2);
    }
    Oc() {
      return this.Ps.rightPriceScale.visible ? "right" : "left";
    }
    Lc(t2, i2) {
      r(i2 >= 0, "Index should be greater or equal to 0");
      if (i2 === this.Nc(t2)) return;
      const s2 = a(this.Hn(t2));
      s2.io(t2);
      const n2 = this.Qu(i2);
      this.Bc(t2, n2), 0 === s2.ba().length && this.Ac(s2), this.Bh();
    }
    Wc() {
      return this.nc;
    }
    $() {
      return this.tc;
    }
    Ut(t2) {
      const i2 = this.nc, s2 = this.tc;
      if (i2 === s2) return i2;
      if (t2 = Math.max(0, Math.min(100, Math.round(100 * t2))), null === this.Xu || this.Xu.mr !== s2 || this.Xu.wr !== i2) this.Xu = { mr: s2, wr: i2, Fc: /* @__PURE__ */ new Map() };
      else {
        const i3 = this.Xu.Fc.get(t2);
        if (void 0 !== i3) return i3;
      }
      const n2 = this.Sl.tt(s2, i2, t2 / 100);
      return this.Xu.Fc.set(t2, n2), n2;
    }
    Hc(t2) {
      return this.$u.indexOf(t2);
    }
    Xi() {
      return this.Sl;
    }
    Uc() {
      return this.$c();
    }
    $c(t2) {
      const i2 = new mi(this.uh, this);
      this.$u.push(i2);
      const s2 = t2 != null ? t2 : this.$u.length - 1, n2 = Y.gn();
      return n2.Qs(s2, { tn: 0, sn: true }), this.ec(n2), i2;
    }
    Qu(t2) {
      return r(t2 >= 0, "Index should be greater or equal to 0"), (t2 = Math.min(this.$u.length, t2)) < this.$u.length ? this.$u[t2] : this.$c(t2);
    }
    Nc(t2) {
      return this.$u.findIndex(((i2) => i2.Lo().includes(t2)));
    }
    wc(t2, i2) {
      const s2 = new Y(i2);
      if (null !== t2) {
        const n2 = this.$u.indexOf(t2);
        s2.Qs(n2, { tn: i2 });
      }
      return s2;
    }
    rc(t2, i2) {
      return void 0 === i2 && (i2 = 2), this.wc(this.Hn(t2), i2);
    }
    ec(t2) {
      this.Zu && this.Zu(t2), this.$u.forEach(((t3) => t3.i_().lr().yt()));
    }
    Bc(t2, i2) {
      const s2 = t2.N().priceScaleId, n2 = void 0 !== s2 ? s2 : this.Oc();
      i2.Jl(t2, n2), q(n2) || t2.hr(t2.N());
    }
    sc(t2) {
      const i2 = this.Ps.layout;
      return "gradient" === i2.background.type ? 0 === t2 ? i2.background.topColor : i2.background.bottomColor : i2.background.color;
    }
    Ac(t2) {
      !t2.Oo() && 0 === t2.ba().length && this.$u.length > 1 && this.$u.splice(this.Hc(t2), 1);
    }
  }
  function Ai(t2) {
    return !u(t2) && !d(t2);
  }
  function zi(t2) {
    return u(t2);
  }
  !(function(t2) {
    t2[t2.Disabled = 0] = "Disabled", t2[t2.Continuous = 1] = "Continuous", t2[t2.OnDataUpdate = 2] = "OnDataUpdate";
  })(Di || (Di = {})), (function(t2) {
    t2[t2.LastBar = 0] = "LastBar", t2[t2.LastVisible = 1] = "LastVisible";
  })(Ei || (Ei = {})), (function(t2) {
    t2.Solid = "solid", t2.VerticalGradient = "gradient";
  })(Vi || (Vi = {})), (function(t2) {
    t2[t2.Year = 0] = "Year", t2[t2.Month = 1] = "Month", t2[t2.DayOfMonth = 2] = "DayOfMonth", t2[t2.Time = 3] = "Time", t2[t2.TimeWithSeconds = 4] = "TimeWithSeconds";
  })(Bi || (Bi = {}));
  const Oi = (t2) => t2.getUTCFullYear();
  function Li(t2, i2, s2) {
    return i2.replace(/yyyy/g, ((t3) => Z(Oi(t3), 4))(t2)).replace(/yy/g, ((t3) => Z(Oi(t3) % 100, 2))(t2)).replace(/MMMM/g, ((t3, i3) => new Date(t3.getUTCFullYear(), t3.getUTCMonth(), 1).toLocaleString(i3, { month: "long" }))(t2, s2)).replace(/MMM/g, ((t3, i3) => new Date(t3.getUTCFullYear(), t3.getUTCMonth(), 1).toLocaleString(i3, { month: "short" }))(t2, s2)).replace(/MM/g, ((t3) => Z(((t4) => t4.getUTCMonth() + 1)(t3), 2))(t2)).replace(/dd/g, ((t3) => Z(((t4) => t4.getUTCDate())(t3), 2))(t2));
  }
  class Ni {
    constructor(t2 = "yyyy-MM-dd", i2 = "default") {
      this.jc = t2, this.qc = i2;
    }
    __(t2) {
      return Li(t2, this.jc, this.qc);
    }
  }
  class Wi {
    constructor(t2) {
      this.Yc = t2 || "%h:%m:%s";
    }
    __(t2) {
      return this.Yc.replace("%h", Z(t2.getUTCHours(), 2)).replace("%m", Z(t2.getUTCMinutes(), 2)).replace("%s", Z(t2.getUTCSeconds(), 2));
    }
  }
  const Fi = { Kc: "yyyy-MM-dd", Xc: "%h:%m:%s", Zc: " ", Gc: "default" };
  class Hi {
    constructor(t2 = {}) {
      const i2 = { ...Fi, ...t2 };
      this.Jc = new Ni(i2.Kc, i2.Gc), this.Qc = new Wi(i2.Xc), this.td = i2.Zc;
    }
    __(t2) {
      return "".concat(this.Jc.__(t2)).concat(this.td).concat(this.Qc.__(t2));
    }
  }
  function Ui(t2) {
    return 60 * t2 * 60 * 1e3;
  }
  function $i(t2) {
    return 60 * t2 * 1e3;
  }
  const ji = [{ sd: (qi = 1, 1e3 * qi), nd: 10 }, { sd: $i(1), nd: 20 }, { sd: $i(5), nd: 21 }, { sd: $i(30), nd: 22 }, { sd: Ui(1), nd: 30 }, { sd: Ui(3), nd: 31 }, { sd: Ui(6), nd: 32 }, { sd: Ui(12), nd: 33 }];
  var qi;
  function Yi(t2, i2) {
    if (t2.getUTCFullYear() !== i2.getUTCFullYear()) return 70;
    if (t2.getUTCMonth() !== i2.getUTCMonth()) return 60;
    if (t2.getUTCDate() !== i2.getUTCDate()) return 50;
    for (let s2 = ji.length - 1; s2 >= 0; --s2) if (Math.floor(i2.getTime() / ji[s2].sd) !== Math.floor(t2.getTime() / ji[s2].sd)) return ji[s2].nd;
    return 0;
  }
  function Ki(t2) {
    let i2 = t2;
    if (d(t2) && (i2 = Zi(t2)), !Ai(i2)) throw new Error("time must be of type BusinessDay");
    const s2 = new Date(Date.UTC(i2.year, i2.month - 1, i2.day, 0, 0, 0, 0));
    return { ed: Math.round(s2.getTime() / 1e3), rd: i2 };
  }
  function Xi(t2) {
    if (!zi(t2)) throw new Error("time must be of type isUTCTimestamp");
    return { ed: t2 };
  }
  function Zi(t2) {
    const i2 = new Date(t2);
    if (isNaN(i2.getTime())) throw new Error("Invalid date string=".concat(t2, ", expected format=yyyy-mm-dd"));
    return { day: i2.getUTCDate(), month: i2.getUTCMonth() + 1, year: i2.getUTCFullYear() };
  }
  function Gi(t2) {
    d(t2.time) && (t2.time = Zi(t2.time));
  }
  class Ji {
    options() {
      return this.Ps;
    }
    setOptions(t2) {
      this.Ps = t2, this.updateFormatter(t2.localization);
    }
    preprocessData(t2) {
      Array.isArray(t2) ? (function(t3) {
        t3.forEach(Gi);
      })(t2) : Gi(t2);
    }
    createConverterToInternalObj(t2) {
      return a((function(t3) {
        return 0 === t3.length ? null : Ai(t3[0].time) || d(t3[0].time) ? Ki : Xi;
      })(t2));
    }
    key(t2) {
      return "object" == typeof t2 && "ed" in t2 ? t2.ed : this.key(this.convertHorzItemToInternal(t2));
    }
    cacheKey(t2) {
      const i2 = t2;
      return void 0 === i2.rd ? new Date(1e3 * i2.ed).getTime() : new Date(Date.UTC(i2.rd.year, i2.rd.month - 1, i2.rd.day)).getTime();
    }
    convertHorzItemToInternal(t2) {
      return zi(i2 = t2) ? Xi(i2) : Ai(i2) ? Ki(i2) : Ki(Zi(i2));
      var i2;
    }
    updateFormatter(t2) {
      if (!this.Ps) return;
      const i2 = t2.dateFormat;
      this.Ps.timeScale.timeVisible ? this.hd = new Hi({ Kc: i2, Xc: this.Ps.timeScale.secondsVisible ? "%h:%m:%s" : "%h:%m", Zc: "   ", Gc: t2.locale }) : this.hd = new Ni(i2, t2.locale);
    }
    formatHorzItem(t2) {
      const i2 = t2;
      return this.hd.__(new Date(1e3 * i2.ed));
    }
    formatTickmark(t2, i2) {
      const s2 = (function(t3, i3, s3) {
        switch (t3) {
          case 0:
          case 10:
            return i3 ? s3 ? 4 : 3 : 2;
          case 20:
          case 21:
          case 22:
          case 30:
          case 31:
          case 32:
          case 33:
            return i3 ? 3 : 2;
          case 50:
            return 2;
          case 60:
            return 1;
          case 70:
            return 0;
        }
      })(t2.weight, this.Ps.timeScale.timeVisible, this.Ps.timeScale.secondsVisible), n2 = this.Ps.timeScale;
      if (void 0 !== n2.tickMarkFormatter) {
        const e2 = n2.tickMarkFormatter(t2.originalTime, s2, i2.locale);
        if (null !== e2) return e2;
      }
      return (function(t3, i3, s3) {
        const n3 = {};
        switch (i3) {
          case 0:
            n3.year = "numeric";
            break;
          case 1:
            n3.month = "short";
            break;
          case 2:
            n3.day = "numeric";
            break;
          case 3:
            n3.hour12 = false, n3.hour = "2-digit", n3.minute = "2-digit";
            break;
          case 4:
            n3.hour12 = false, n3.hour = "2-digit", n3.minute = "2-digit", n3.second = "2-digit";
        }
        const e2 = void 0 === t3.rd ? new Date(1e3 * t3.ed) : new Date(Date.UTC(t3.rd.year, t3.rd.month - 1, t3.rd.day));
        return new Date(e2.getUTCFullYear(), e2.getUTCMonth(), e2.getUTCDate(), e2.getUTCHours(), e2.getUTCMinutes(), e2.getUTCSeconds(), e2.getUTCMilliseconds()).toLocaleString(s3, n3);
      })(t2.time, s2, i2.locale);
    }
    maxTickMarkWeight(t2) {
      let i2 = t2.reduce(ki, t2[0]).weight;
      return i2 > 30 && i2 < 50 && (i2 = 30), i2;
    }
    fillWeightsForPoints(t2, i2) {
      !(function(t3, i3 = 0) {
        if (0 === t3.length) return;
        let s2 = 0 === i3 ? null : t3[i3 - 1].time.ed, n2 = null !== s2 ? new Date(1e3 * s2) : null, e2 = 0;
        for (let r2 = i3; r2 < t3.length; ++r2) {
          const i4 = t3[r2], h2 = new Date(1e3 * i4.time.ed);
          null !== n2 && (i4.timeWeight = Yi(h2, n2)), e2 += i4.time.ed - (s2 || i4.time.ed), s2 = i4.time.ed, n2 = h2;
        }
        if (0 === i3 && t3.length > 1) {
          const i4 = Math.ceil(e2 / (t3.length - 1)), s3 = new Date(1e3 * (t3[0].time.ed - i4));
          t3[0].timeWeight = Yi(new Date(1e3 * t3[0].time.ed), s3);
        }
      })(t2, i2);
    }
    static ad(t2) {
      return _({ localization: { dateFormat: "dd MMM 'yy" } }, t2 != null ? t2 : {});
    }
  }
  function Qi(t2) {
    var i2 = t2.width, s2 = t2.height;
    if (i2 < 0) throw new Error("Negative width is not allowed for Size");
    if (s2 < 0) throw new Error("Negative height is not allowed for Size");
    return { width: i2, height: s2 };
  }
  function ts(t2, i2) {
    return t2.width === i2.width && t2.height === i2.height;
  }
  var is = (function() {
    function t2(t3) {
      var i2 = this;
      this._resolutionListener = function() {
        return i2._onResolutionChanged();
      }, this._resolutionMediaQueryList = null, this._observers = [], this._window = t3, this._installResolutionListener();
    }
    return t2.prototype.dispose = function() {
      this._uninstallResolutionListener(), this._window = null;
    }, Object.defineProperty(t2.prototype, "value", { get: function() {
      return this._window.devicePixelRatio;
    }, enumerable: false, configurable: true }), t2.prototype.subscribe = function(t3) {
      var i2 = this, s2 = { next: t3 };
      return this._observers.push(s2), { unsubscribe: function() {
        i2._observers = i2._observers.filter((function(t4) {
          return t4 !== s2;
        }));
      } };
    }, t2.prototype._installResolutionListener = function() {
      if (null !== this._resolutionMediaQueryList) throw new Error("Resolution listener is already installed");
      var t3 = this._window.devicePixelRatio;
      this._resolutionMediaQueryList = this._window.matchMedia("all and (resolution: ".concat(t3, "dppx)")), this._resolutionMediaQueryList.addListener(this._resolutionListener);
    }, t2.prototype._uninstallResolutionListener = function() {
      null !== this._resolutionMediaQueryList && (this._resolutionMediaQueryList.removeListener(this._resolutionListener), this._resolutionMediaQueryList = null);
    }, t2.prototype._reinstallResolutionListener = function() {
      this._uninstallResolutionListener(), this._installResolutionListener();
    }, t2.prototype._onResolutionChanged = function() {
      var t3 = this;
      this._observers.forEach((function(i2) {
        return i2.next(t3._window.devicePixelRatio);
      })), this._reinstallResolutionListener();
    }, t2;
  })();
  var ss = (function() {
    function t2(t3, i2, s2) {
      var n2;
      this._canvasElement = null, this._bitmapSizeChangedListeners = [], this._suggestedBitmapSize = null, this._suggestedBitmapSizeChangedListeners = [], this._devicePixelRatioObservable = null, this._canvasElementResizeObserver = null, this._canvasElement = t3, this._canvasElementClientSize = Qi({ width: this._canvasElement.clientWidth, height: this._canvasElement.clientHeight }), this._transformBitmapSize = null != i2 ? i2 : function(t4) {
        return t4;
      }, this._allowResizeObserver = null === (n2 = null == s2 ? void 0 : s2.allowResizeObserver) || void 0 === n2 || n2, this._chooseAndInitObserver();
    }
    return t2.prototype.dispose = function() {
      var t3, i2;
      if (null === this._canvasElement) throw new Error("Object is disposed");
      null === (t3 = this._canvasElementResizeObserver) || void 0 === t3 || t3.disconnect(), this._canvasElementResizeObserver = null, null === (i2 = this._devicePixelRatioObservable) || void 0 === i2 || i2.dispose(), this._devicePixelRatioObservable = null, this._suggestedBitmapSizeChangedListeners.length = 0, this._bitmapSizeChangedListeners.length = 0, this._canvasElement = null;
    }, Object.defineProperty(t2.prototype, "canvasElement", { get: function() {
      if (null === this._canvasElement) throw new Error("Object is disposed");
      return this._canvasElement;
    }, enumerable: false, configurable: true }), Object.defineProperty(t2.prototype, "canvasElementClientSize", { get: function() {
      return this._canvasElementClientSize;
    }, enumerable: false, configurable: true }), Object.defineProperty(t2.prototype, "bitmapSize", { get: function() {
      return Qi({ width: this.canvasElement.width, height: this.canvasElement.height });
    }, enumerable: false, configurable: true }), t2.prototype.resizeCanvasElement = function(t3) {
      this._canvasElementClientSize = Qi(t3), this.canvasElement.style.width = "".concat(this._canvasElementClientSize.width, "px"), this.canvasElement.style.height = "".concat(this._canvasElementClientSize.height, "px"), this._invalidateBitmapSize();
    }, t2.prototype.subscribeBitmapSizeChanged = function(t3) {
      this._bitmapSizeChangedListeners.push(t3);
    }, t2.prototype.unsubscribeBitmapSizeChanged = function(t3) {
      this._bitmapSizeChangedListeners = this._bitmapSizeChangedListeners.filter((function(i2) {
        return i2 !== t3;
      }));
    }, Object.defineProperty(t2.prototype, "suggestedBitmapSize", { get: function() {
      return this._suggestedBitmapSize;
    }, enumerable: false, configurable: true }), t2.prototype.subscribeSuggestedBitmapSizeChanged = function(t3) {
      this._suggestedBitmapSizeChangedListeners.push(t3);
    }, t2.prototype.unsubscribeSuggestedBitmapSizeChanged = function(t3) {
      this._suggestedBitmapSizeChangedListeners = this._suggestedBitmapSizeChangedListeners.filter((function(i2) {
        return i2 !== t3;
      }));
    }, t2.prototype.applySuggestedBitmapSize = function() {
      if (null !== this._suggestedBitmapSize) {
        var t3 = this._suggestedBitmapSize;
        this._suggestedBitmapSize = null, this._resizeBitmap(t3), this._emitSuggestedBitmapSizeChanged(t3, this._suggestedBitmapSize);
      }
    }, t2.prototype._resizeBitmap = function(t3) {
      var i2 = this.bitmapSize;
      ts(i2, t3) || (this.canvasElement.width = t3.width, this.canvasElement.height = t3.height, this._emitBitmapSizeChanged(i2, t3));
    }, t2.prototype._emitBitmapSizeChanged = function(t3, i2) {
      var s2 = this;
      this._bitmapSizeChangedListeners.forEach((function(n2) {
        return n2.call(s2, t3, i2);
      }));
    }, t2.prototype._suggestNewBitmapSize = function(t3) {
      var i2 = this._suggestedBitmapSize, s2 = Qi(this._transformBitmapSize(t3, this._canvasElementClientSize)), n2 = ts(this.bitmapSize, s2) ? null : s2;
      null === i2 && null === n2 || null !== i2 && null !== n2 && ts(i2, n2) || (this._suggestedBitmapSize = n2, this._emitSuggestedBitmapSizeChanged(i2, n2));
    }, t2.prototype._emitSuggestedBitmapSizeChanged = function(t3, i2) {
      var s2 = this;
      this._suggestedBitmapSizeChangedListeners.forEach((function(n2) {
        return n2.call(s2, t3, i2);
      }));
    }, t2.prototype._chooseAndInitObserver = function() {
      var t3 = this;
      this._allowResizeObserver ? new Promise((function(t4) {
        var i2 = new ResizeObserver((function(s2) {
          t4(s2.every((function(t5) {
            return "devicePixelContentBoxSize" in t5;
          }))), i2.disconnect();
        }));
        i2.observe(document.body, { box: "device-pixel-content-box" });
      })).catch((function() {
        return false;
      })).then((function(i2) {
        return i2 ? t3._initResizeObserver() : t3._initDevicePixelRatioObservable();
      })) : this._initDevicePixelRatioObservable();
    }, t2.prototype._initDevicePixelRatioObservable = function() {
      var t3 = this;
      if (null !== this._canvasElement) {
        var i2 = ns(this._canvasElement);
        if (null === i2) throw new Error("No window is associated with the canvas");
        this._devicePixelRatioObservable = (function(t4) {
          return new is(t4);
        })(i2), this._devicePixelRatioObservable.subscribe((function() {
          return t3._invalidateBitmapSize();
        })), this._invalidateBitmapSize();
      }
    }, t2.prototype._invalidateBitmapSize = function() {
      var t3, i2;
      if (null !== this._canvasElement) {
        var s2 = ns(this._canvasElement);
        if (null !== s2) {
          var n2 = null !== (i2 = null === (t3 = this._devicePixelRatioObservable) || void 0 === t3 ? void 0 : t3.value) && void 0 !== i2 ? i2 : s2.devicePixelRatio, e2 = this._canvasElement.getClientRects(), r2 = void 0 !== e2[0] ? (function(t4, i3) {
            return Qi({ width: Math.round(t4.left * i3 + t4.width * i3) - Math.round(t4.left * i3), height: Math.round(t4.top * i3 + t4.height * i3) - Math.round(t4.top * i3) });
          })(e2[0], n2) : Qi({ width: this._canvasElementClientSize.width * n2, height: this._canvasElementClientSize.height * n2 });
          this._suggestNewBitmapSize(r2);
        }
      }
    }, t2.prototype._initResizeObserver = function() {
      var t3 = this;
      null !== this._canvasElement && (this._canvasElementResizeObserver = new ResizeObserver((function(i2) {
        var s2 = i2.find((function(i3) {
          return i3.target === t3._canvasElement;
        }));
        if (s2 && s2.devicePixelContentBoxSize && s2.devicePixelContentBoxSize[0]) {
          var n2 = s2.devicePixelContentBoxSize[0], e2 = Qi({ width: n2.inlineSize, height: n2.blockSize });
          t3._suggestNewBitmapSize(e2);
        }
      })), this._canvasElementResizeObserver.observe(this._canvasElement, { box: "device-pixel-content-box" }));
    }, t2;
  })();
  function ns(t2) {
    return t2.ownerDocument.defaultView;
  }
  var es = (function() {
    function t2(t3, i2, s2) {
      if (0 === i2.width || 0 === i2.height) throw new TypeError("Rendering target could only be created on a media with positive width and height");
      if (this._mediaSize = i2, 0 === s2.width || 0 === s2.height) throw new TypeError("Rendering target could only be created using a bitmap with positive integer width and height");
      this._bitmapSize = s2, this._context = t3;
    }
    return t2.prototype.useMediaCoordinateSpace = function(t3) {
      try {
        return this._context.save(), this._context.setTransform(1, 0, 0, 1, 0, 0), this._context.scale(this._horizontalPixelRatio, this._verticalPixelRatio), t3({ context: this._context, mediaSize: this._mediaSize });
      } finally {
        this._context.restore();
      }
    }, t2.prototype.useBitmapCoordinateSpace = function(t3) {
      try {
        return this._context.save(), this._context.setTransform(1, 0, 0, 1, 0, 0), t3({ context: this._context, mediaSize: this._mediaSize, bitmapSize: this._bitmapSize, horizontalPixelRatio: this._horizontalPixelRatio, verticalPixelRatio: this._verticalPixelRatio });
      } finally {
        this._context.restore();
      }
    }, Object.defineProperty(t2.prototype, "_horizontalPixelRatio", { get: function() {
      return this._bitmapSize.width / this._mediaSize.width;
    }, enumerable: false, configurable: true }), Object.defineProperty(t2.prototype, "_verticalPixelRatio", { get: function() {
      return this._bitmapSize.height / this._mediaSize.height;
    }, enumerable: false, configurable: true }), t2;
  })();
  function rs(t2, i2) {
    var s2 = t2.canvasElementClientSize;
    if (0 === s2.width || 0 === s2.height) return null;
    var n2 = t2.bitmapSize;
    if (0 === n2.width || 0 === n2.height) return null;
    var e2 = t2.canvasElement.getContext("2d", i2);
    return null === e2 ? null : new es(e2, s2, n2);
  }
  const hs = "undefined" != typeof window;
  function as() {
    return !!hs && window.navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  }
  function ls() {
    return !!hs && /iPhone|iPad|iPod/.test(window.navigator.platform);
  }
  function os(t2) {
    return t2 + t2 % 2;
  }
  function _s(t2) {
    hs && void 0 !== window.chrome && t2.addEventListener("mousedown", ((t3) => {
      if (1 === t3.button) return t3.preventDefault(), false;
    }));
  }
  class us {
    constructor(t2, i2, s2) {
      this.ld = 0, this.od = null, this._d = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY }, this.ud = 0, this.dd = null, this.fd = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY }, this.pd = null, this.vd = false, this.md = null, this.wd = null, this.gd = false, this.Md = false, this.bd = false, this.xd = null, this.Sd = null, this.Cd = null, this.Pd = null, this.yd = null, this.kd = null, this.Td = null, this.Rd = 0, this.Dd = false, this.Ed = false, this.Vd = false, this.Bd = 0, this.Id = null, this.Ad = !ls(), this.zd = (t3) => {
        this.Od(t3);
      }, this.Ld = (t3) => {
        if (this.Nd(t3)) {
          const i3 = this.Wd(t3);
          if (++this.ud, this.dd && this.ud > 1) {
            const { Fd: s3 } = this.Hd(fs(t3), this.fd);
            s3 < 30 && !this.bd && this.Ud(i3, this.jd.$d), this.qd();
          }
        } else {
          const i3 = this.Wd(t3);
          if (++this.ld, this.od && this.ld > 1) {
            const { Fd: s3 } = this.Hd(fs(t3), this._d);
            s3 < 5 && !this.Md && this.Yd(i3, this.jd.Kd), this.Xd();
          }
        }
      }, this.Zd = t2, this.jd = i2, this.Ps = s2, this.Gd();
    }
    m() {
      null !== this.xd && (this.xd(), this.xd = null), null !== this.Sd && (this.Sd(), this.Sd = null), null !== this.Pd && (this.Pd(), this.Pd = null), null !== this.yd && (this.yd(), this.yd = null), null !== this.kd && (this.kd(), this.kd = null), null !== this.Cd && (this.Cd(), this.Cd = null), this.Jd(), this.Xd();
    }
    Qd(t2) {
      this.Pd && this.Pd();
      const i2 = this.tf.bind(this);
      if (this.Pd = () => {
        this.Zd.removeEventListener("mousemove", i2);
      }, this.Zd.addEventListener("mousemove", i2), this.Nd(t2)) return;
      const s2 = this.Wd(t2);
      this.Yd(s2, this.jd.if), this.Ad = true;
    }
    Xd() {
      null !== this.od && clearTimeout(this.od), this.ld = 0, this.od = null, this._d = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY };
    }
    qd() {
      null !== this.dd && clearTimeout(this.dd), this.ud = 0, this.dd = null, this.fd = { _t: Number.NEGATIVE_INFINITY, ut: Number.POSITIVE_INFINITY };
    }
    tf(t2) {
      if (this.Vd || null !== this.wd) return;
      if (this.Nd(t2)) return;
      const i2 = this.Wd(t2);
      this.Yd(i2, this.jd.sf), this.Ad = true;
    }
    nf(t2) {
      const i2 = vs(t2.changedTouches, a(this.Id));
      if (null === i2) return;
      if (this.Bd = ps(t2), null !== this.Td) return;
      if (this.Ed) return;
      this.Dd = true;
      const s2 = this.Hd(fs(i2), a(this.wd)), { ef: n2, rf: e2, Fd: r2 } = s2;
      if (this.gd || !(r2 < 5)) {
        if (!this.gd) {
          const t3 = 0.5 * n2, i3 = e2 >= t3 && !this.Ps.hf(), s3 = t3 > e2 && !this.Ps.af();
          i3 || s3 || (this.Ed = true), this.gd = true, this.bd = true, this.Jd(), this.qd();
        }
        if (!this.Ed) {
          const s3 = this.Wd(t2, i2);
          this.Ud(s3, this.jd.lf), ds(t2);
        }
      }
    }
    _f(t2) {
      if (0 !== t2.button) return;
      const i2 = this.Hd(fs(t2), a(this.md)), { Fd: s2 } = i2;
      if (s2 >= 5 && (this.Md = true, this.Xd()), this.Md) {
        const i3 = this.Wd(t2);
        this.Yd(i3, this.jd.uf);
      }
    }
    Hd(t2, i2) {
      const s2 = Math.abs(i2._t - t2._t), n2 = Math.abs(i2.ut - t2.ut);
      return { ef: s2, rf: n2, Fd: s2 + n2 };
    }
    cf(t2) {
      let i2 = vs(t2.changedTouches, a(this.Id));
      if (null === i2 && 0 === t2.touches.length && (i2 = t2.changedTouches[0]), null === i2) return;
      this.Id = null, this.Bd = ps(t2), this.Jd(), this.wd = null, this.kd && (this.kd(), this.kd = null);
      const s2 = this.Wd(t2, i2);
      if (this.Ud(s2, this.jd.df), ++this.ud, this.dd && this.ud > 1) {
        const { Fd: t3 } = this.Hd(fs(i2), this.fd);
        t3 < 30 && !this.bd && this.Ud(s2, this.jd.$d), this.qd();
      } else this.bd || (this.Ud(s2, this.jd.ff), this.jd.ff && ds(t2));
      0 === this.ud && ds(t2), 0 === t2.touches.length && this.vd && (this.vd = false, ds(t2));
    }
    Od(t2) {
      if (0 !== t2.button) return;
      const i2 = this.Wd(t2);
      if (this.md = null, this.Vd = false, this.yd && (this.yd(), this.yd = null), as()) {
        this.Zd.ownerDocument.documentElement.removeEventListener("mouseleave", this.zd);
      }
      if (!this.Nd(t2)) if (this.Yd(i2, this.jd.pf), ++this.ld, this.od && this.ld > 1) {
        const { Fd: s2 } = this.Hd(fs(t2), this._d);
        s2 < 5 && !this.Md && this.Yd(i2, this.jd.Kd), this.Xd();
      } else this.Md || this.Yd(i2, this.jd.vf);
    }
    Jd() {
      null !== this.pd && (clearTimeout(this.pd), this.pd = null);
    }
    mf(t2) {
      if (null !== this.Id) return;
      const i2 = t2.changedTouches[0];
      this.Id = i2.identifier, this.Bd = ps(t2);
      const s2 = this.Zd.ownerDocument.documentElement;
      this.bd = false, this.gd = false, this.Ed = false, this.wd = fs(i2), this.kd && (this.kd(), this.kd = null);
      {
        const i3 = this.nf.bind(this), n3 = this.cf.bind(this);
        this.kd = () => {
          s2.removeEventListener("touchmove", i3), s2.removeEventListener("touchend", n3);
        }, s2.addEventListener("touchmove", i3, { passive: false }), s2.addEventListener("touchend", n3, { passive: false }), this.Jd(), this.pd = setTimeout(this.wf.bind(this, t2), 240);
      }
      const n2 = this.Wd(t2, i2);
      this.Ud(n2, this.jd.gf), this.dd || (this.ud = 0, this.dd = setTimeout(this.qd.bind(this), 500), this.fd = fs(i2));
    }
    Mf(t2) {
      if (0 !== t2.button) return;
      const i2 = this.Zd.ownerDocument.documentElement;
      as() && i2.addEventListener("mouseleave", this.zd), this.Md = false, this.md = fs(t2), this.yd && (this.yd(), this.yd = null);
      {
        const t3 = this._f.bind(this), s3 = this.Od.bind(this);
        this.yd = () => {
          i2.removeEventListener("mousemove", t3), i2.removeEventListener("mouseup", s3);
        }, i2.addEventListener("mousemove", t3), i2.addEventListener("mouseup", s3);
      }
      if (this.Vd = true, this.Nd(t2)) return;
      const s2 = this.Wd(t2);
      this.Yd(s2, this.jd.bf), this.od || (this.ld = 0, this.od = setTimeout(this.Xd.bind(this), 500), this._d = fs(t2));
    }
    Gd() {
      this.Zd.addEventListener("mouseenter", this.Qd.bind(this)), this.Zd.addEventListener("touchcancel", this.Jd.bind(this));
      {
        const t2 = this.Zd.ownerDocument, i2 = (t3) => {
          this.jd.xf && (t3.composed && this.Zd.contains(t3.composedPath()[0]) || t3.target && this.Zd.contains(t3.target) || this.jd.xf());
        };
        this.Sd = () => {
          t2.removeEventListener("touchstart", i2);
        }, this.xd = () => {
          t2.removeEventListener("mousedown", i2);
        }, t2.addEventListener("mousedown", i2), t2.addEventListener("touchstart", i2, { passive: true });
      }
      ls() && (this.Cd = () => {
        this.Zd.removeEventListener("dblclick", this.Ld);
      }, this.Zd.addEventListener("dblclick", this.Ld)), this.Zd.addEventListener("mouseleave", this.Sf.bind(this)), this.Zd.addEventListener("touchstart", this.mf.bind(this), { passive: true }), _s(this.Zd), this.Zd.addEventListener("mousedown", this.Mf.bind(this)), this.Cf(), this.Zd.addEventListener("touchmove", (() => {
      }), { passive: false });
    }
    Cf() {
      void 0 === this.jd.Pf && void 0 === this.jd.yf && void 0 === this.jd.kf || (this.Zd.addEventListener("touchstart", ((t2) => this.Tf(t2.touches)), { passive: true }), this.Zd.addEventListener("touchmove", ((t2) => {
        if (2 === t2.touches.length && null !== this.Td && void 0 !== this.jd.yf) {
          const i2 = cs(t2.touches[0], t2.touches[1]) / this.Rd;
          this.jd.yf(this.Td, i2), ds(t2);
        }
      }), { passive: false }), this.Zd.addEventListener("touchend", ((t2) => {
        this.Tf(t2.touches);
      })));
    }
    Tf(t2) {
      1 === t2.length && (this.Dd = false), 2 !== t2.length || this.Dd || this.vd ? this.Rf() : this.Df(t2);
    }
    Df(t2) {
      const i2 = this.Zd.getBoundingClientRect() || { left: 0, top: 0 };
      this.Td = { _t: (t2[0].clientX - i2.left + (t2[1].clientX - i2.left)) / 2, ut: (t2[0].clientY - i2.top + (t2[1].clientY - i2.top)) / 2 }, this.Rd = cs(t2[0], t2[1]), void 0 !== this.jd.Pf && this.jd.Pf(), this.Jd();
    }
    Rf() {
      null !== this.Td && (this.Td = null, void 0 !== this.jd.kf && this.jd.kf());
    }
    Sf(t2) {
      if (this.Pd && this.Pd(), this.Nd(t2)) return;
      if (!this.Ad) return;
      const i2 = this.Wd(t2);
      this.Yd(i2, this.jd.Ef), this.Ad = !ls();
    }
    wf(t2) {
      const i2 = vs(t2.touches, a(this.Id));
      if (null === i2) return;
      const s2 = this.Wd(t2, i2);
      this.Ud(s2, this.jd.Vf), this.bd = true, this.vd = true;
    }
    Nd(t2) {
      return t2.sourceCapabilities && void 0 !== t2.sourceCapabilities.firesTouchEvents ? t2.sourceCapabilities.firesTouchEvents : ps(t2) < this.Bd + 500;
    }
    Ud(t2, i2) {
      i2 && i2.call(this.jd, t2);
    }
    Yd(t2, i2) {
      i2 && i2.call(this.jd, t2);
    }
    Wd(t2, i2) {
      const s2 = i2 || t2, n2 = this.Zd.getBoundingClientRect() || { left: 0, top: 0 };
      return { clientX: s2.clientX, clientY: s2.clientY, pageX: s2.pageX, pageY: s2.pageY, screenX: s2.screenX, screenY: s2.screenY, localX: s2.clientX - n2.left, localY: s2.clientY - n2.top, ctrlKey: t2.ctrlKey, altKey: t2.altKey, shiftKey: t2.shiftKey, metaKey: t2.metaKey, Bf: !t2.type.startsWith("mouse") && "contextmenu" !== t2.type && "click" !== t2.type, If: t2.type, Af: s2.target, a_: t2.view, zf: () => {
        "touchstart" !== t2.type && ds(t2);
      } };
    }
  }
  function cs(t2, i2) {
    const s2 = t2.clientX - i2.clientX, n2 = t2.clientY - i2.clientY;
    return Math.sqrt(s2 * s2 + n2 * n2);
  }
  function ds(t2) {
    t2.cancelable && t2.preventDefault();
  }
  function fs(t2) {
    return { _t: t2.pageX, ut: t2.pageY };
  }
  function ps(t2) {
    return t2.timeStamp || performance.now();
  }
  function vs(t2, i2) {
    for (let s2 = 0; s2 < t2.length; ++s2) if (t2[s2].identifier === i2) return t2[s2];
    return null;
  }
  class ms {
    constructor(t2, i2, s2) {
      this.Of = null, this.Lf = null, this.Nf = true, this.Wf = null, this.Ff = t2, this.Hf = t2.Uf()[i2], this.$f = t2.Uf()[s2], this.jf = document.createElement("tr"), this.jf.style.height = "1px", this.qf = document.createElement("td"), this.qf.style.position = "relative", this.qf.style.padding = "0", this.qf.style.margin = "0", this.qf.setAttribute("colspan", "3"), this.Yf(), this.jf.appendChild(this.qf), this.Nf = this.Ff.N().layout.panes.enableResize, this.Nf ? this.Kf() : (this.Of = null, this.Lf = null);
    }
    m() {
      null !== this.Lf && this.Lf.m();
    }
    Xf() {
      return this.jf;
    }
    Zf() {
      return Qi({ width: this.Hf.Zf().width, height: 1 });
    }
    Gf() {
      return Qi({ width: this.Hf.Gf().width, height: 1 * window.devicePixelRatio });
    }
    Jf(t2, i2, s2) {
      const n2 = this.Gf();
      t2.fillStyle = this.Ff.N().layout.panes.separatorColor, t2.fillRect(i2, s2, n2.width, n2.height);
    }
    yt() {
      this.Yf(), this.Ff.N().layout.panes.enableResize !== this.Nf && (this.Nf = this.Ff.N().layout.panes.enableResize, this.Nf ? this.Kf() : (null !== this.Of && (this.qf.removeChild(this.Of.Qf), this.qf.removeChild(this.Of.tp), this.Of = null), null !== this.Lf && (this.Lf.m(), this.Lf = null)));
    }
    Kf() {
      const t2 = document.createElement("div"), i2 = t2.style;
      i2.position = "fixed", i2.display = "none", i2.zIndex = "49", i2.top = "0", i2.left = "0", i2.width = "100%", i2.height = "100%", i2.cursor = "row-resize", this.qf.appendChild(t2);
      const s2 = document.createElement("div"), n2 = s2.style;
      n2.position = "absolute", n2.zIndex = "50", n2.top = "-4px", n2.height = "9px", n2.width = "100%", n2.backgroundColor = "", n2.cursor = "row-resize", this.qf.appendChild(s2);
      const e2 = { if: this.ip.bind(this), Ef: this.sp.bind(this), bf: this.np.bind(this), gf: this.np.bind(this), uf: this.ep.bind(this), lf: this.ep.bind(this), pf: this.rp.bind(this), df: this.rp.bind(this) };
      this.Lf = new us(s2, e2, { hf: () => false, af: () => true }), this.Of = { tp: s2, Qf: t2 };
    }
    Yf() {
      this.qf.style.background = this.Ff.N().layout.panes.separatorColor;
    }
    ip(t2) {
      null !== this.Of && (this.Of.tp.style.backgroundColor = this.Ff.N().layout.panes.separatorHoverColor);
    }
    sp(t2) {
      null !== this.Of && null === this.Wf && (this.Of.tp.style.backgroundColor = "");
    }
    np(t2) {
      if (null === this.Of) return;
      const i2 = this.Hf.hp().Vo() + this.$f.hp().Vo(), s2 = i2 / (this.Hf.Zf().height + this.$f.Zf().height), n2 = 30 * s2;
      i2 <= 2 * n2 || (this.Wf = { ap: t2.pageY, lp: this.Hf.hp().Vo(), op: i2 - n2, _p: i2, up: s2, cp: n2 }, this.Of.Qf.style.display = "block");
    }
    ep(t2) {
      const i2 = this.Wf;
      if (null === i2) return;
      const s2 = (t2.pageY - i2.ap) * i2.up, n2 = Yt(i2.lp + s2, i2.cp, i2.op);
      this.Hf.hp().Bo(n2), this.$f.hp().Bo(i2._p - n2), this.Ff.Qt().Bh();
    }
    rp(t2) {
      null !== this.Wf && null !== this.Of && (this.Wf = null, this.Of.Qf.style.display = "none");
    }
  }
  function ws(t2, i2) {
    return t2.dp - i2.dp;
  }
  function gs(t2, i2, s2) {
    const n2 = (t2.dp - i2.dp) / (t2.wt - i2.wt);
    return Math.sign(n2) * Math.min(Math.abs(n2), s2);
  }
  class Ms {
    constructor(t2, i2, s2, n2) {
      this.fp = null, this.pp = null, this.vp = null, this.mp = null, this.wp = null, this.gp = 0, this.Mp = 0, this.bp = t2, this.xp = i2, this.Sp = s2, this.Mn = n2;
    }
    Cp(t2, i2) {
      if (null !== this.fp) {
        if (this.fp.wt === i2) return void (this.fp.dp = t2);
        if (Math.abs(this.fp.dp - t2) < this.Mn) return;
      }
      this.mp = this.vp, this.vp = this.pp, this.pp = this.fp, this.fp = { wt: i2, dp: t2 };
    }
    le(t2, i2) {
      if (null === this.fp || null === this.pp) return;
      if (i2 - this.fp.wt > 50) return;
      let s2 = 0;
      const n2 = gs(this.fp, this.pp, this.xp), e2 = ws(this.fp, this.pp), r2 = [n2], h2 = [e2];
      if (s2 += e2, null !== this.vp) {
        const t3 = gs(this.pp, this.vp, this.xp);
        if (Math.sign(t3) === Math.sign(n2)) {
          const i3 = ws(this.pp, this.vp);
          if (r2.push(t3), h2.push(i3), s2 += i3, null !== this.mp) {
            const t4 = gs(this.vp, this.mp, this.xp);
            if (Math.sign(t4) === Math.sign(n2)) {
              const i4 = ws(this.vp, this.mp);
              r2.push(t4), h2.push(i4), s2 += i4;
            }
          }
        }
      }
      let a2 = 0;
      for (let t3 = 0; t3 < r2.length; ++t3) a2 += h2[t3] / s2 * r2[t3];
      Math.abs(a2) < this.bp || (this.wp = { dp: t2, wt: i2 }, this.Mp = a2, this.gp = (function(t3, i3) {
        const s3 = Math.log(i3);
        return Math.log(1 * s3 / -t3) / s3;
      })(Math.abs(a2), this.Sp));
    }
    Ru(t2) {
      const i2 = a(this.wp), s2 = t2 - i2.wt;
      return i2.dp + this.Mp * (Math.pow(this.Sp, s2) - 1) / Math.log(this.Sp);
    }
    Tu(t2) {
      return null === this.wp || this.Pp(t2) === this.gp;
    }
    Pp(t2) {
      const i2 = t2 - a(this.wp).wt;
      return Math.min(i2, this.gp);
    }
  }
  class bs {
    constructor(t2, i2) {
      this.yp = void 0, this.kp = void 0, this.Tp = void 0, this.ps = false, this.Rp = t2, this.Dp = i2, this.Ep();
    }
    yt() {
      this.Ep();
    }
    Vp() {
      this.yp && this.Rp.removeChild(this.yp), this.kp && this.Rp.removeChild(this.kp), this.yp = void 0, this.kp = void 0;
    }
    Bp() {
      return this.ps !== this.Ip() || this.Tp !== this.Ap();
    }
    Ap() {
      return this.Dp.Qt().Xi().J(this.Dp.N().layout.textColor) > 160 ? "dark" : "light";
    }
    Ip() {
      return this.Dp.N().layout.attributionLogo;
    }
    zp() {
      const t2 = new URL(location.href);
      return t2.hostname ? "&utm_source=" + t2.hostname + t2.pathname : "";
    }
    Ep() {
      this.Bp() && (this.Vp(), this.ps = this.Ip(), this.ps && (this.Tp = this.Ap(), this.kp = document.createElement("style"), this.kp.innerText = "a#tv-attr-logo{--fill:#131722;--stroke:#fff;position:absolute;left:10px;bottom:10px;height:19px;width:35px;margin:0;padding:0;border:0;z-index:3;}a#tv-attr-logo[data-dark]{--fill:#D1D4DC;--stroke:#131722;}", this.yp = document.createElement("a"), this.yp.href = "https://www.tradingview.com/?utm_medium=lwc-link&utm_campaign=lwc-chart".concat(this.zp()), this.yp.title = "Charting by TradingView", this.yp.id = "tv-attr-logo", this.yp.target = "_blank", this.yp.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="35" height="19" fill="none"><g fill-rule="evenodd" clip-path="url(#a)" clip-rule="evenodd"><path fill="var(--stroke)" d="M2 0H0v10h6v9h21.4l.5-1.3 6-15 1-2.7H23.7l-.5 1.3-.2.6a5 5 0 0 0-7-.9V0H2Zm20 17h4l5.2-13 .8-2h-7l-1 2.5-.2.5-1.5 3.8-.3.7V17Zm-.8-10a3 3 0 0 0 .7-2.7A3 3 0 1 0 16.8 7h4.4ZM14 7V2H2v6h6v9h4V7h2Z"/><path fill="var(--fill)" d="M14 2H2v6h6v9h6V2Zm12 15h-7l6-15h7l-6 15Zm-7-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></g><defs><clipPath id="a"><path fill="var(--stroke)" d="M0 0h35v19H0z"/></clipPath></defs></svg>', this.yp.toggleAttribute("data-dark", "dark" === this.Tp), this.Rp.appendChild(this.kp), this.Rp.appendChild(this.yp)));
    }
  }
  function xs(t2, i2) {
    const s2 = a(t2.ownerDocument).createElement("canvas");
    t2.appendChild(s2);
    const n2 = new ss(s2, (e2 = { options: { allowResizeObserver: true }, transform: (t3, i3) => ({ width: Math.max(t3.width, i3.width), height: Math.max(t3.height, i3.height) }) }).transform, e2.options);
    var e2;
    return n2.resizeCanvasElement(i2), n2;
  }
  function Ss(t2) {
    var _a2;
    t2.width = 1, t2.height = 1, (_a2 = t2.getContext("2d")) == null ? void 0 : _a2.clearRect(0, 0, 1, 1);
  }
  function Cs(t2, i2, s2, n2) {
    t2.ih && t2.ih(i2, s2, n2);
  }
  function Ps(t2, i2, s2, n2) {
    t2.nt(i2, s2, n2);
  }
  function ys(t2, i2, s2, n2) {
    const e2 = t2(s2, n2);
    for (const t3 of e2) {
      const s3 = t3.Tt(n2);
      null !== s3 && i2(s3);
    }
  }
  function ks(t2, i2) {
    return (s2) => {
      var _a2, _b, _c, _d;
      if (!(function(t3) {
        return void 0 !== t3.Wt;
      })(s2)) return [];
      return ((_b = (_a2 = s2.Wt()) == null ? void 0 : _a2.wa()) != null ? _b : "") !== i2 ? [] : (_d = (_c = s2.ta) == null ? void 0 : _c.call(s2, t2)) != null ? _d : [];
    };
  }
  function Ts(t2, i2, s2, n2) {
    if (!t2.length) return;
    let e2 = 0;
    const r2 = t2[0].$t(n2, true);
    let h2 = 1 === i2 ? s2 / 2 - (t2[0].Wi() - r2 / 2) : t2[0].Wi() - r2 / 2 - s2 / 2;
    h2 = Math.max(0, h2);
    for (let r3 = 1; r3 < t2.length; r3++) {
      const a2 = t2[r3], l2 = t2[r3 - 1], o2 = l2.$t(n2, false), _2 = a2.Wi(), u2 = l2.Wi();
      if (1 === i2 ? _2 > u2 - o2 : _2 < u2 + o2) {
        const n3 = u2 - o2 * i2;
        a2.Fi(n3);
        const r4 = n3 - i2 * o2 / 2;
        if ((1 === i2 ? r4 < 0 : r4 > s2) && h2 > 0) {
          const n4 = 1 === i2 ? -1 - r4 : r4 - s2, a3 = Math.min(n4, h2);
          for (let s3 = e2; s3 < t2.length; s3++) t2[s3].Fi(t2[s3].Wi() + i2 * a3);
          h2 -= a3;
        }
      } else e2 = r3, h2 = 1 === i2 ? u2 - o2 - _2 : _2 - (u2 + o2);
    }
  }
  class Rs {
    constructor(t2, i2, s2, n2) {
      this.qi = null, this.Op = null, this.Lp = false, this.Np = new it(200), this.Wp = null, this.Fp = 0, this.Hp = false, this.Up = () => {
        this.Hp || this.Pt.$p().Qt().ar();
      }, this.jp = () => {
        this.Hp || this.Pt.$p().Qt().ar();
      }, this.Pt = t2, this.Ps = i2, this.bl = i2.layout, this.Gu = s2, this.qp = "left" === n2, this.Yp = ks("normal", n2), this.Kp = ks("top", n2), this.Xp = ks("bottom", n2), this.qf = document.createElement("div"), this.qf.style.height = "100%", this.qf.style.overflow = "hidden", this.qf.style.width = "25px", this.qf.style.left = "0", this.qf.style.position = "relative", this.Zp = xs(this.qf, Qi({ width: 16, height: 16 })), this.Zp.subscribeSuggestedBitmapSizeChanged(this.Up);
      const e2 = this.Zp.canvasElement;
      e2.style.position = "absolute", e2.style.zIndex = "1", e2.style.left = "0", e2.style.top = "0", this.Gp = xs(this.qf, Qi({ width: 16, height: 16 })), this.Gp.subscribeSuggestedBitmapSizeChanged(this.jp);
      const r2 = this.Gp.canvasElement;
      r2.style.position = "absolute", r2.style.zIndex = "2", r2.style.left = "0", r2.style.top = "0";
      const h2 = { bf: this.np.bind(this), gf: this.np.bind(this), uf: this.ep.bind(this), lf: this.ep.bind(this), xf: this.Jp.bind(this), pf: this.rp.bind(this), df: this.rp.bind(this), Kd: this.Qp.bind(this), $d: this.Qp.bind(this), if: this.tv.bind(this), Ef: this.sp.bind(this) };
      this.Lf = new us(this.Gp.canvasElement, h2, { hf: () => !this.Ps.handleScroll.vertTouchDrag, af: () => true });
    }
    m() {
      this.Lf.m(), this.Gp.unsubscribeSuggestedBitmapSizeChanged(this.jp), Ss(this.Gp.canvasElement), this.Gp.dispose(), this.Zp.unsubscribeSuggestedBitmapSizeChanged(this.Up), Ss(this.Zp.canvasElement), this.Zp.dispose(), null !== this.qi && this.qi.no().u(this), this.qi = null;
    }
    Xf() {
      return this.qf;
    }
    P() {
      return this.bl.fontSize;
    }
    iv() {
      const t2 = this.Gu.N();
      return this.Wp !== t2.k && (this.Np.Vn(), this.Wp = t2.k), t2;
    }
    sv() {
      if (null === this.qi) return 0;
      let t2 = 0;
      const i2 = this.iv(), s2 = a(this.Zp.canvasElement.getContext("2d", { colorSpace: this.Pt.$p().N().layout.colorSpace }));
      s2.save();
      const n2 = this.qi.Ea();
      s2.font = this.nv(), n2.length > 0 && (t2 = Math.max(this.Np.Ei(s2, n2[0].Ga), this.Np.Ei(s2, n2[n2.length - 1].Ga)));
      const e2 = this.ev();
      for (let i3 = e2.length; i3--; ) {
        const n3 = this.Np.Ei(s2, e2[i3].ri());
        n3 > t2 && (t2 = n3);
      }
      const r2 = this.qi.zt();
      if (null !== r2 && null !== this.Op && (2 !== (h2 = this.Ps.crosshair).mode && h2.horzLine.visible && h2.horzLine.labelVisible)) {
        const i3 = this.qi.Ts(1, r2), n3 = this.qi.Ts(this.Op.height - 2, r2);
        t2 = Math.max(t2, this.Np.Ei(s2, this.qi.Zi(Math.floor(Math.min(i3, n3)) + 0.11111111111111, r2)), this.Np.Ei(s2, this.qi.Zi(Math.ceil(Math.max(i3, n3)) - 0.11111111111111, r2)));
      }
      var h2;
      s2.restore();
      const l2 = t2 || 34;
      return os(Math.ceil(i2.S + i2.C + i2.B + i2.I + 5 + l2));
    }
    rv(t2) {
      null !== this.Op && ts(this.Op, t2) || (this.Op = t2, this.Hp = true, this.Zp.resizeCanvasElement(t2), this.Gp.resizeCanvasElement(t2), this.Hp = false, this.qf.style.width = "".concat(t2.width, "px"), this.qf.style.height = "".concat(t2.height, "px"));
    }
    hv() {
      return a(this.Op).width;
    }
    _s(t2) {
      this.qi !== t2 && (null !== this.qi && this.qi.no().u(this), this.qi = t2, t2.no().i(this.ul.bind(this), this));
    }
    Wt() {
      return this.qi;
    }
    Vn() {
      const t2 = this.Pt.hp();
      this.Pt.$p().Qt().Zo(t2, a(this.Wt()));
    }
    av(t2) {
      if (null === this.Op) return;
      const i2 = { colorSpace: this.Pt.$p().N().layout.colorSpace };
      if (1 !== t2) {
        this.lv(), this.Zp.applySuggestedBitmapSize();
        const t3 = rs(this.Zp, i2);
        null !== t3 && (t3.useBitmapCoordinateSpace(((t4) => {
          this.ov(t4), this._v(t4);
        })), this.Pt.uv(t3, this.Xp), this.cv(t3), this.Pt.uv(t3, this.Yp), this.dv(t3));
      }
      this.Gp.applySuggestedBitmapSize();
      const s2 = rs(this.Gp, i2);
      null !== s2 && (s2.useBitmapCoordinateSpace((({ context: t3, bitmapSize: i3 }) => {
        t3.clearRect(0, 0, i3.width, i3.height);
      })), this.fv(s2), this.Pt.uv(s2, this.Kp));
    }
    Gf() {
      return this.Zp.bitmapSize;
    }
    Jf(t2, i2, s2) {
      const n2 = this.Gf();
      n2.width > 0 && n2.height > 0 && t2.drawImage(this.Zp.canvasElement, i2, s2);
    }
    yt() {
      var _a2;
      (_a2 = this.qi) == null ? void 0 : _a2.Ea();
    }
    np(t2) {
      if (null === this.qi || this.qi.Ki() || !this.Ps.handleScale.axisPressedMouseMove.price) return;
      const i2 = this.Pt.$p().Qt(), s2 = this.Pt.hp();
      this.Lp = true, i2.Uo(s2, this.qi, t2.localY);
    }
    ep(t2) {
      if (null === this.qi || !this.Ps.handleScale.axisPressedMouseMove.price) return;
      const i2 = this.Pt.$p().Qt(), s2 = this.Pt.hp(), n2 = this.qi;
      i2.$o(s2, n2, t2.localY);
    }
    Jp() {
      if (null === this.qi || !this.Ps.handleScale.axisPressedMouseMove.price) return;
      const t2 = this.Pt.$p().Qt(), i2 = this.Pt.hp(), s2 = this.qi;
      this.Lp && (this.Lp = false, t2.jo(i2, s2));
    }
    rp(t2) {
      if (null === this.qi || !this.Ps.handleScale.axisPressedMouseMove.price) return;
      const i2 = this.Pt.$p().Qt(), s2 = this.Pt.hp();
      this.Lp = false, i2.jo(s2, this.qi);
    }
    Qp(t2) {
      this.Ps.handleScale.axisDoubleClickReset.price && this.Vn();
    }
    tv(t2) {
      if (null === this.qi) return;
      !this.Pt.$p().Qt().N().handleScale.axisPressedMouseMove.price || this.qi.Oe() || this.qi.El() || this.pv(1);
    }
    sp(t2) {
      this.pv(0);
    }
    ev() {
      const t2 = [], i2 = null === this.qi ? void 0 : this.qi;
      return ((s2) => {
        for (let n2 = 0; n2 < s2.length; ++n2) {
          const e2 = s2[n2].Fs(this.Pt.hp(), i2);
          for (let i3 = 0; i3 < e2.length; i3++) t2.push(e2[i3]);
        }
      })(this.Pt.hp().Dt()), t2;
    }
    ov({ context: t2, bitmapSize: i2 }) {
      const { width: s2, height: n2 } = i2, e2 = this.Pt.hp().Qt(), r2 = e2.$(), h2 = e2.Wc();
      r2 === h2 ? B(t2, 0, 0, s2, n2, r2) : z(t2, 0, 0, s2, n2, r2, h2);
    }
    _v({ context: t2, bitmapSize: i2, horizontalPixelRatio: s2 }) {
      if (null === this.Op || null === this.qi || !this.qi.N().borderVisible) return;
      t2.fillStyle = this.qi.N().borderColor;
      const n2 = Math.max(1, Math.floor(this.iv().S * s2));
      let e2;
      e2 = this.qp ? i2.width - n2 : 0, t2.fillRect(e2, 0, n2, i2.height);
    }
    cv(t2) {
      if (null === this.Op || null === this.qi) return;
      const i2 = this.qi.Ea(), s2 = this.qi.N(), n2 = this.iv(), e2 = this.qp ? this.Op.width - n2.C : 0;
      s2.borderVisible && s2.ticksVisible && t2.useBitmapCoordinateSpace((({ context: t3, horizontalPixelRatio: r2, verticalPixelRatio: h2 }) => {
        t3.fillStyle = s2.borderColor;
        const a2 = Math.max(1, Math.floor(h2)), l2 = Math.floor(0.5 * h2), o2 = Math.round(n2.C * r2);
        t3.beginPath();
        for (const s3 of i2) t3.rect(Math.floor(e2 * r2), Math.round(s3.ya * h2) - l2, o2, a2);
        t3.fill();
      })), t2.useMediaCoordinateSpace((({ context: t3 }) => {
        var _a2;
        t3.font = this.nv(), t3.fillStyle = (_a2 = s2.textColor) != null ? _a2 : this.bl.textColor, t3.textAlign = this.qp ? "right" : "left", t3.textBaseline = "middle";
        const r2 = this.qp ? Math.round(e2 - n2.B) : Math.round(e2 + n2.C + n2.B), h2 = i2.map(((i3) => this.Np.Di(t3, i3.Ga)));
        for (let s3 = i2.length; s3--; ) {
          const n3 = i2[s3];
          t3.fillText(n3.Ga, r2, n3.ya + h2[s3]);
        }
      }));
    }
    lv() {
      if (null === this.Op || null === this.qi) return;
      let t2 = this.Op.height / 2;
      const i2 = [], s2 = this.qi.Dt().slice(), n2 = this.Pt.hp(), e2 = this.iv();
      this.qi === n2.$n() && this.Pt.hp().Dt().forEach(((t3) => {
        n2.Un(t3) && s2.push(t3);
      }));
      const r2 = this.qi.ba()[0], h2 = this.qi;
      s2.forEach(((s3) => {
        const e3 = s3.Fs(n2, h2);
        e3.forEach(((t3) => {
          t3.Fi(null), t3.Hi() && i2.push(t3);
        })), r2 === s3 && e3.length > 0 && (t2 = e3[0].Bi());
      })), i2.forEach(((t3) => t3.Fi(t3.Bi())));
      this.qi.N().alignLabels && this.vv(i2, e2, t2);
    }
    vv(t2, i2, s2) {
      if (null === this.Op) return;
      const n2 = t2.filter(((t3) => t3.Bi() <= s2)), e2 = t2.filter(((t3) => t3.Bi() > s2));
      n2.sort(((t3, i3) => i3.Bi() - t3.Bi())), n2.length && e2.length && e2.push(n2[0]), e2.sort(((t3, i3) => t3.Bi() - i3.Bi()));
      for (const s3 of t2) {
        const t3 = Math.floor(s3.$t(i2) / 2), n3 = s3.Bi();
        n3 > -t3 && n3 < t3 && s3.Fi(t3), n3 > this.Op.height - t3 && n3 < this.Op.height + t3 && s3.Fi(this.Op.height - t3);
      }
      Ts(n2, 1, this.Op.height, i2), Ts(e2, -1, this.Op.height, i2);
    }
    dv(t2) {
      if (null === this.Op) return;
      const i2 = this.ev(), s2 = this.iv(), n2 = this.qp ? "right" : "left";
      i2.forEach(((i3) => {
        if (i3.Ui()) {
          i3.Tt(a(this.qi)).nt(t2, s2, this.Np, n2);
        }
      }));
    }
    fv(t2) {
      if (null === this.Op || null === this.qi) return;
      const i2 = this.Pt.$p().Qt(), s2 = [], n2 = this.Pt.hp(), e2 = i2._c().Fs(n2, this.qi);
      e2.length && s2.push(e2);
      const r2 = this.iv(), h2 = this.qp ? "right" : "left";
      s2.forEach(((i3) => {
        i3.forEach(((i4) => {
          i4.Tt(a(this.qi)).nt(t2, r2, this.Np, h2);
        }));
      }));
    }
    pv(t2) {
      this.qf.style.cursor = 1 === t2 ? "ns-resize" : "default";
    }
    ul() {
      const t2 = this.sv();
      this.Fp < t2 && this.Pt.$p().Qt().Bh(), this.Fp = t2;
    }
    nv() {
      return g(this.bl.fontSize, this.bl.fontFamily);
    }
  }
  function Ds(t2, i2) {
    var _a2, _b;
    return (_b = (_a2 = t2.Jh) == null ? void 0 : _a2.call(t2, i2)) != null ? _b : [];
  }
  function Es(t2, i2) {
    var _a2, _b;
    return (_b = (_a2 = t2.Ws) == null ? void 0 : _a2.call(t2, i2)) != null ? _b : [];
  }
  function Vs(t2, i2) {
    var _a2, _b;
    return (_b = (_a2 = t2.us) == null ? void 0 : _a2.call(t2, i2)) != null ? _b : [];
  }
  function Bs(t2, i2) {
    var _a2, _b;
    return (_b = (_a2 = t2.Xh) == null ? void 0 : _a2.call(t2, i2)) != null ? _b : [];
  }
  class Is {
    constructor(t2, i2) {
      this.Op = Qi({ width: 0, height: 0 }), this.mv = null, this.wv = null, this.gv = null, this.Mv = null, this.bv = false, this.xv = new o(), this.Sv = new o(), this.Cv = 0, this.Pv = false, this.yv = null, this.kv = false, this.Tv = null, this.Rv = null, this.Hp = false, this.Up = () => {
        this.Hp || null === this.Dv || this.ts().ar();
      }, this.jp = () => {
        this.Hp || null === this.Dv || this.ts().ar();
      }, this.Dp = t2, this.Dv = i2, this.Dv.t_().i(this.Ev.bind(this), this, true), this.Vv = document.createElement("td"), this.Vv.style.padding = "0", this.Vv.style.position = "relative";
      const s2 = document.createElement("div");
      s2.style.width = "100%", s2.style.height = "100%", s2.style.position = "relative", s2.style.overflow = "hidden", this.Bv = document.createElement("td"), this.Bv.style.padding = "0", this.Iv = document.createElement("td"), this.Iv.style.padding = "0", this.Vv.appendChild(s2), this.Zp = xs(s2, Qi({ width: 16, height: 16 })), this.Zp.subscribeSuggestedBitmapSizeChanged(this.Up);
      const n2 = this.Zp.canvasElement;
      n2.style.position = "absolute", n2.style.zIndex = "1", n2.style.left = "0", n2.style.top = "0", this.Gp = xs(s2, Qi({ width: 16, height: 16 })), this.Gp.subscribeSuggestedBitmapSizeChanged(this.jp);
      const e2 = this.Gp.canvasElement;
      e2.style.position = "absolute", e2.style.zIndex = "2", e2.style.left = "0", e2.style.top = "0", this.jf = document.createElement("tr"), this.jf.appendChild(this.Bv), this.jf.appendChild(this.Vv), this.jf.appendChild(this.Iv), this.Av(), this.Lf = new us(this.Gp.canvasElement, this, { hf: () => null === this.yv && !this.Dp.N().handleScroll.vertTouchDrag, af: () => null === this.yv && !this.Dp.N().handleScroll.horzTouchDrag });
    }
    m() {
      null !== this.mv && this.mv.m(), null !== this.wv && this.wv.m(), this.gv = null, this.Gp.unsubscribeSuggestedBitmapSizeChanged(this.jp), Ss(this.Gp.canvasElement), this.Gp.dispose(), this.Zp.unsubscribeSuggestedBitmapSizeChanged(this.Up), Ss(this.Zp.canvasElement), this.Zp.dispose(), null !== this.Dv && (this.Dv.t_().u(this), this.Dv.m()), this.Lf.m();
    }
    hp() {
      return a(this.Dv);
    }
    zv(t2) {
      var _a2, _b;
      null !== this.Dv && this.Dv.t_().u(this), this.Dv = t2, null !== this.Dv && this.Dv.t_().i(Is.prototype.Ev.bind(this), this, true), this.Av(), this.Dp.Uf().indexOf(this) === this.Dp.Uf().length - 1 ? (this.gv = (_a2 = this.gv) != null ? _a2 : new bs(this.Vv, this.Dp), this.gv.yt()) : ((_b = this.gv) == null ? void 0 : _b.Vp(), this.gv = null);
    }
    $p() {
      return this.Dp;
    }
    Xf() {
      return this.jf;
    }
    Av() {
      if (null !== this.Dv && (this.Ov(), 0 !== this.ts().Ys().length)) {
        if (null !== this.mv) {
          const t2 = this.Dv.Fo();
          this.mv._s(a(t2));
        }
        if (null !== this.wv) {
          const t2 = this.Dv.Ho();
          this.wv._s(a(t2));
        }
      }
    }
    Lv() {
      null !== this.mv && this.mv.yt(), null !== this.wv && this.wv.yt();
    }
    Vo() {
      return null !== this.Dv ? this.Dv.Vo() : 0;
    }
    Bo(t2) {
      this.Dv && this.Dv.Bo(t2);
    }
    if(t2) {
      if (!this.Dv) return;
      this.Nv();
      const i2 = t2.localX, s2 = t2.localY;
      this.Wv(i2, s2, t2);
    }
    bf(t2) {
      this.Nv(), this.Fv(), this.Wv(t2.localX, t2.localY, t2);
    }
    sf(t2) {
      if (!this.Dv) return;
      this.Nv();
      const i2 = t2.localX, s2 = t2.localY;
      this.Wv(i2, s2, t2);
    }
    vf(t2) {
      null !== this.Dv && (this.Nv(), this.Hv(t2));
    }
    Kd(t2) {
      null !== this.Dv && this.Uv(this.Sv, t2);
    }
    $d(t2) {
      this.Kd(t2);
    }
    uf(t2) {
      this.Nv(), this.$v(t2), this.Wv(t2.localX, t2.localY, t2);
    }
    pf(t2) {
      null !== this.Dv && (this.Nv(), this.Pv = false, this.jv(t2));
    }
    ff(t2) {
      null !== this.Dv && this.Hv(t2);
    }
    Vf(t2) {
      if (this.Pv = true, null === this.yv) {
        const i2 = { x: t2.localX, y: t2.localY };
        this.qv(i2, i2, t2);
      }
    }
    Ef(t2) {
      null !== this.Dv && (this.Nv(), this.Dv.Qt().ac(null), this.Yv());
    }
    Kv() {
      return this.xv;
    }
    Xv() {
      return this.Sv;
    }
    Pf() {
      this.Cv = 1, this.ts().hn();
    }
    yf(t2, i2) {
      if (!this.Dp.N().handleScale.pinch) return;
      const s2 = 5 * (i2 - this.Cv);
      this.Cv = i2, this.ts().Mc(t2._t, s2);
    }
    gf(t2) {
      this.Pv = false, this.kv = null !== this.yv, this.Fv();
      const i2 = this.ts()._c();
      null !== this.yv && i2.Et() && (this.Tv = { x: i2.si(), y: i2.ni() }, this.yv = { x: t2.localX, y: t2.localY });
    }
    lf(t2) {
      if (null === this.Dv) return;
      const i2 = t2.localX, s2 = t2.localY;
      if (null === this.yv) this.$v(t2);
      else {
        this.kv = false;
        const n2 = a(this.Tv), e2 = n2.x + (i2 - this.yv.x), r2 = n2.y + (s2 - this.yv.y);
        this.Wv(e2, r2, t2);
      }
    }
    df(t2) {
      0 === this.$p().N().trackingMode.exitMode && (this.kv = true), this.Zv(), this.jv(t2);
    }
    Yn(t2, i2) {
      const s2 = this.Dv;
      return null === s2 ? null : bi(s2, t2, i2);
    }
    Gv(t2, i2) {
      a("left" === i2 ? this.mv : this.wv).rv(Qi({ width: t2, height: this.Op.height }));
    }
    Zf() {
      return this.Op;
    }
    rv(t2) {
      ts(this.Op, t2) || (this.Op = t2, this.Hp = true, this.Zp.resizeCanvasElement(t2), this.Gp.resizeCanvasElement(t2), this.Hp = false, this.Vv.style.width = t2.width + "px", this.Vv.style.height = t2.height + "px");
    }
    Jv() {
      const t2 = a(this.Dv);
      t2.Wo(t2.Fo()), t2.Wo(t2.Ho());
      for (const i2 of t2.ba()) if (t2.Un(i2)) {
        const s2 = i2.Wt();
        null !== s2 && t2.Wo(s2), i2.Ns();
      }
      for (const i2 of t2.s_()) i2.Ns();
    }
    Gf() {
      return this.Zp.bitmapSize;
    }
    Jf(t2, i2, s2) {
      const n2 = this.Gf();
      n2.width > 0 && n2.height > 0 && t2.drawImage(this.Zp.canvasElement, i2, s2);
    }
    av(t2) {
      if (0 === t2) return;
      if (null === this.Dv) return;
      t2 > 1 && this.Jv(), null !== this.mv && this.mv.av(t2), null !== this.wv && this.wv.av(t2);
      const i2 = { colorSpace: this.Dp.N().layout.colorSpace };
      if (1 !== t2) {
        this.Zp.applySuggestedBitmapSize();
        const t3 = rs(this.Zp, i2);
        null !== t3 && (t3.useBitmapCoordinateSpace(((t4) => {
          this.ov(t4);
        })), this.Dv && (this.Qv(t3, Ds), this.tm(t3), this.Qv(t3, Es), this.Qv(t3, Vs)));
      }
      this.Gp.applySuggestedBitmapSize();
      const s2 = rs(this.Gp, i2);
      null !== s2 && (s2.useBitmapCoordinateSpace((({ context: t3, bitmapSize: i3 }) => {
        t3.clearRect(0, 0, i3.width, i3.height);
      })), this.im(s2), this.Qv(s2, Bs), this.Qv(s2, Vs));
    }
    sm() {
      return this.mv;
    }
    nm() {
      return this.wv;
    }
    uv(t2, i2) {
      this.Qv(t2, i2);
    }
    Ev() {
      null !== this.Dv && this.Dv.t_().u(this), this.Dv = null;
    }
    Hv(t2) {
      this.Uv(this.xv, t2);
    }
    Uv(t2, i2) {
      const s2 = i2.localX, n2 = i2.localY;
      t2.v() && t2.p(this.ts().It().uu(s2), { x: s2, y: n2 }, i2);
    }
    ov({ context: t2, bitmapSize: i2 }) {
      const { width: s2, height: n2 } = i2, e2 = this.ts(), r2 = e2.$(), h2 = e2.Wc();
      r2 === h2 ? B(t2, 0, 0, s2, n2, h2) : z(t2, 0, 0, s2, n2, r2, h2);
    }
    tm(t2) {
      const i2 = a(this.Dv), s2 = i2.i_().lr().Tt(i2);
      null !== s2 && s2.nt(t2, false);
    }
    im(t2) {
      this.rm(t2, Es, Ps, this.ts()._c());
    }
    Qv(t2, i2) {
      const s2 = a(this.Dv), n2 = s2.Dt(), e2 = s2.s_();
      for (const s3 of e2) this.rm(t2, i2, Cs, s3);
      for (const s3 of n2) this.rm(t2, i2, Cs, s3);
      for (const s3 of e2) this.rm(t2, i2, Ps, s3);
      for (const s3 of n2) this.rm(t2, i2, Ps, s3);
    }
    rm(t2, i2, s2, n2) {
      const e2 = a(this.Dv), r2 = e2.Qt().hc(), h2 = null !== r2 && r2.n_ === n2, l2 = null !== r2 && h2 && void 0 !== r2.e_ ? r2.e_.Xn : void 0;
      ys(i2, ((i3) => s2(i3, t2, h2, l2)), n2, e2);
    }
    Ov() {
      if (null === this.Dv) return;
      const t2 = this.Dp, i2 = this.Dv.Fo().N().visible, s2 = this.Dv.Ho().N().visible;
      i2 || null === this.mv || (this.Bv.removeChild(this.mv.Xf()), this.mv.m(), this.mv = null), s2 || null === this.wv || (this.Iv.removeChild(this.wv.Xf()), this.wv.m(), this.wv = null);
      const n2 = t2.Qt().Ec();
      i2 && null === this.mv && (this.mv = new Rs(this, t2.N(), n2, "left"), this.Bv.appendChild(this.mv.Xf())), s2 && null === this.wv && (this.wv = new Rs(this, t2.N(), n2, "right"), this.Iv.appendChild(this.wv.Xf()));
    }
    hm(t2) {
      return t2.Bf && this.Pv || null !== this.yv;
    }
    am(t2) {
      return Math.max(0, Math.min(t2, this.Op.width - 1));
    }
    lm(t2) {
      return Math.max(0, Math.min(t2, this.Op.height - 1));
    }
    Wv(t2, i2, s2) {
      this.ts().kc(this.am(t2), this.lm(i2), s2, a(this.Dv));
    }
    Yv() {
      this.ts().Rc();
    }
    Zv() {
      this.kv && (this.yv = null, this.Yv());
    }
    qv(t2, i2, s2) {
      this.yv = t2, this.kv = false, this.Wv(i2.x, i2.y, s2);
      const n2 = this.ts()._c();
      this.Tv = { x: n2.si(), y: n2.ni() };
    }
    ts() {
      return this.Dp.Qt();
    }
    jv(t2) {
      if (!this.bv) return;
      const i2 = this.ts(), s2 = this.hp();
      if (i2.Ko(s2, s2.ks()), this.Mv = null, this.bv = false, i2.Cc(), null !== this.Rv) {
        const t3 = performance.now(), s3 = i2.It();
        this.Rv.le(s3.wu(), t3), this.Rv.Tu(t3) || i2._n(this.Rv);
      }
    }
    Nv() {
      this.yv = null;
    }
    Fv() {
      if (!this.Dv) return;
      if (this.ts().hn(), document.activeElement !== document.body && document.activeElement !== document.documentElement) a(document.activeElement).blur();
      else {
        const t2 = document.getSelection();
        null !== t2 && t2.removeAllRanges();
      }
      !this.Dv.ks().Ki() && this.ts().It().Ki();
    }
    $v(t2) {
      if (null === this.Dv) return;
      const i2 = this.ts(), s2 = i2.It();
      if (s2.Ki()) return;
      const n2 = this.Dp.N(), e2 = n2.handleScroll, r2 = n2.kineticScroll;
      if ((!e2.pressedMouseMove || t2.Bf) && (!e2.horzTouchDrag && !e2.vertTouchDrag || !t2.Bf)) return;
      const h2 = this.Dv.ks(), a2 = performance.now();
      if (null !== this.Mv || this.hm(t2) || (this.Mv = { x: t2.clientX, y: t2.clientY, ed: a2, om: t2.localX, _m: t2.localY }), null !== this.Mv && !this.bv && (this.Mv.x !== t2.clientX || this.Mv.y !== t2.clientY)) {
        if (t2.Bf && r2.touch || !t2.Bf && r2.mouse) {
          const t3 = s2.vu();
          this.Rv = new Ms(0.2 / t3, 7 / t3, 0.997, 15 / t3), this.Rv.Cp(s2.wu(), this.Mv.ed);
        } else this.Rv = null;
        h2.Ki() || i2.qo(this.Dv, h2, t2.localY), i2.xc(t2.localX), this.bv = true;
      }
      this.bv && (h2.Ki() || i2.Yo(this.Dv, h2, t2.localY), i2.Sc(t2.localX), null !== this.Rv && this.Rv.Cp(s2.wu(), a2));
    }
  }
  class As {
    constructor(t2, i2, s2, n2, e2) {
      this.St = true, this.Op = Qi({ width: 0, height: 0 }), this.Up = () => this.av(3), this.qp = "left" === t2, this.Gu = s2.Ec, this.Ps = i2, this.um = n2, this.dm = e2, this.qf = document.createElement("div"), this.qf.style.width = "25px", this.qf.style.height = "100%", this.qf.style.overflow = "hidden", this.Zp = xs(this.qf, Qi({ width: 16, height: 16 })), this.Zp.subscribeSuggestedBitmapSizeChanged(this.Up);
    }
    m() {
      this.Zp.unsubscribeSuggestedBitmapSizeChanged(this.Up), Ss(this.Zp.canvasElement), this.Zp.dispose();
    }
    Xf() {
      return this.qf;
    }
    Zf() {
      return this.Op;
    }
    rv(t2) {
      ts(this.Op, t2) || (this.Op = t2, this.Zp.resizeCanvasElement(t2), this.qf.style.width = "".concat(t2.width, "px"), this.qf.style.height = "".concat(t2.height, "px"), this.St = true);
    }
    av(t2) {
      if (t2 < 3 && !this.St) return;
      if (0 === this.Op.width || 0 === this.Op.height) return;
      this.St = false, this.Zp.applySuggestedBitmapSize();
      const i2 = rs(this.Zp, { colorSpace: this.Ps.layout.colorSpace });
      null !== i2 && i2.useBitmapCoordinateSpace(((t3) => {
        this.ov(t3), this._v(t3);
      }));
    }
    Gf() {
      return this.Zp.bitmapSize;
    }
    Jf(t2, i2, s2) {
      const n2 = this.Gf();
      n2.width > 0 && n2.height > 0 && t2.drawImage(this.Zp.canvasElement, i2, s2);
    }
    _v({ context: t2, bitmapSize: i2, horizontalPixelRatio: s2, verticalPixelRatio: n2 }) {
      if (!this.um()) return;
      t2.fillStyle = this.Ps.timeScale.borderColor;
      const e2 = Math.floor(this.Gu.N().S * s2), r2 = Math.floor(this.Gu.N().S * n2), h2 = this.qp ? i2.width - e2 : 0;
      t2.fillRect(h2, 0, e2, r2);
    }
    ov({ context: t2, bitmapSize: i2 }) {
      B(t2, 0, 0, i2.width, i2.height, this.dm());
    }
  }
  function zs(t2) {
    return (i2) => {
      var _a2, _b;
      return (_b = (_a2 = i2.ia) == null ? void 0 : _a2.call(i2, t2)) != null ? _b : [];
    };
  }
  const Os = zs("normal"), Ls = zs("top"), Ns = zs("bottom");
  class Ws {
    constructor(t2, i2) {
      this.fm = null, this.pm = null, this.M = null, this.vm = false, this.Op = Qi({ width: 0, height: 0 }), this.wm = new o(), this.Np = new it(5), this.Hp = false, this.Up = () => {
        this.Hp || this.Dp.Qt().ar();
      }, this.jp = () => {
        this.Hp || this.Dp.Qt().ar();
      }, this.Dp = t2, this.o_ = i2, this.Ps = t2.N().layout, this.yp = document.createElement("tr"), this.gm = document.createElement("td"), this.gm.style.padding = "0", this.Mm = document.createElement("td"), this.Mm.style.padding = "0", this.qf = document.createElement("td"), this.qf.style.height = "25px", this.qf.style.padding = "0", this.bm = document.createElement("div"), this.bm.style.width = "100%", this.bm.style.height = "100%", this.bm.style.position = "relative", this.bm.style.overflow = "hidden", this.qf.appendChild(this.bm), this.Zp = xs(this.bm, Qi({ width: 16, height: 16 })), this.Zp.subscribeSuggestedBitmapSizeChanged(this.Up);
      const s2 = this.Zp.canvasElement;
      s2.style.position = "absolute", s2.style.zIndex = "1", s2.style.left = "0", s2.style.top = "0", this.Gp = xs(this.bm, Qi({ width: 16, height: 16 })), this.Gp.subscribeSuggestedBitmapSizeChanged(this.jp);
      const n2 = this.Gp.canvasElement;
      n2.style.position = "absolute", n2.style.zIndex = "2", n2.style.left = "0", n2.style.top = "0", this.yp.appendChild(this.gm), this.yp.appendChild(this.qf), this.yp.appendChild(this.Mm), this.xm(), this.Dp.Qt().Eo().i(this.xm.bind(this), this), this.Lf = new us(this.Gp.canvasElement, this, { hf: () => true, af: () => !this.Dp.N().handleScroll.horzTouchDrag });
    }
    m() {
      this.Lf.m(), null !== this.fm && this.fm.m(), null !== this.pm && this.pm.m(), this.Gp.unsubscribeSuggestedBitmapSizeChanged(this.jp), Ss(this.Gp.canvasElement), this.Gp.dispose(), this.Zp.unsubscribeSuggestedBitmapSizeChanged(this.Up), Ss(this.Zp.canvasElement), this.Zp.dispose();
    }
    Xf() {
      return this.yp;
    }
    Sm() {
      return this.fm;
    }
    Cm() {
      return this.pm;
    }
    bf(t2) {
      if (this.vm) return;
      this.vm = true;
      const i2 = this.Dp.Qt();
      !i2.It().Ki() && this.Dp.N().handleScale.axisPressedMouseMove.time && i2.gc(t2.localX);
    }
    gf(t2) {
      this.bf(t2);
    }
    xf() {
      const t2 = this.Dp.Qt();
      !t2.It().Ki() && this.vm && (this.vm = false, this.Dp.N().handleScale.axisPressedMouseMove.time && t2.yc());
    }
    uf(t2) {
      const i2 = this.Dp.Qt();
      !i2.It().Ki() && this.Dp.N().handleScale.axisPressedMouseMove.time && i2.Pc(t2.localX);
    }
    lf(t2) {
      this.uf(t2);
    }
    pf() {
      this.vm = false;
      const t2 = this.Dp.Qt();
      t2.It().Ki() && !this.Dp.N().handleScale.axisPressedMouseMove.time || t2.yc();
    }
    df() {
      this.pf();
    }
    Kd() {
      this.Dp.N().handleScale.axisDoubleClickReset.time && this.Dp.Qt().cn();
    }
    $d() {
      this.Kd();
    }
    if() {
      this.Dp.Qt().N().handleScale.axisPressedMouseMove.time && this.pv(1);
    }
    Ef() {
      this.pv(0);
    }
    Zf() {
      return this.Op;
    }
    Pm() {
      return this.wm;
    }
    ym(t2, i2, s2) {
      ts(this.Op, t2) || (this.Op = t2, this.Hp = true, this.Zp.resizeCanvasElement(t2), this.Gp.resizeCanvasElement(t2), this.Hp = false, this.qf.style.width = "".concat(t2.width, "px"), this.qf.style.height = "".concat(t2.height, "px"), this.wm.p(t2)), null !== this.fm && this.fm.rv(Qi({ width: i2, height: t2.height })), null !== this.pm && this.pm.rv(Qi({ width: s2, height: t2.height }));
    }
    km() {
      const t2 = this.Tm();
      return Math.ceil(t2.S + t2.C + t2.P + t2.A + t2.V + t2.Rm);
    }
    yt() {
      this.Dp.Qt().It().Ea();
    }
    Gf() {
      return this.Zp.bitmapSize;
    }
    Jf(t2, i2, s2) {
      const n2 = this.Gf();
      n2.width > 0 && n2.height > 0 && t2.drawImage(this.Zp.canvasElement, i2, s2);
    }
    av(t2) {
      if (0 === t2) return;
      const i2 = { colorSpace: this.Ps.colorSpace };
      if (1 !== t2) {
        this.Zp.applySuggestedBitmapSize();
        const s3 = rs(this.Zp, i2);
        null !== s3 && (s3.useBitmapCoordinateSpace(((t3) => {
          this.ov(t3), this._v(t3), this.Dm(s3, Ns);
        })), this.cv(s3), this.Dm(s3, Os)), null !== this.fm && this.fm.av(t2), null !== this.pm && this.pm.av(t2);
      }
      this.Gp.applySuggestedBitmapSize();
      const s2 = rs(this.Gp, i2);
      null !== s2 && (s2.useBitmapCoordinateSpace((({ context: t3, bitmapSize: i3 }) => {
        t3.clearRect(0, 0, i3.width, i3.height);
      })), this.Em([...this.Dp.Qt().Ys(), this.Dp.Qt()._c()], s2), this.Dm(s2, Ls));
    }
    Dm(t2, i2) {
      const s2 = this.Dp.Qt().Ys();
      for (const n2 of s2) ys(i2, ((i3) => Cs(i3, t2, false, void 0)), n2, void 0);
      for (const n2 of s2) ys(i2, ((i3) => Ps(i3, t2, false, void 0)), n2, void 0);
    }
    ov({ context: t2, bitmapSize: i2 }) {
      B(t2, 0, 0, i2.width, i2.height, this.Dp.Qt().Wc());
    }
    _v({ context: t2, bitmapSize: i2, verticalPixelRatio: s2 }) {
      if (this.Dp.N().timeScale.borderVisible) {
        t2.fillStyle = this.Vm();
        const n2 = Math.max(1, Math.floor(this.Tm().S * s2));
        t2.fillRect(0, 0, i2.width, n2);
      }
    }
    cv(t2) {
      const i2 = this.Dp.Qt().It(), s2 = i2.Ea();
      if (!s2 || 0 === s2.length) return;
      const n2 = this.o_.maxTickMarkWeight(s2), e2 = this.Tm(), r2 = i2.N();
      r2.borderVisible && r2.ticksVisible && t2.useBitmapCoordinateSpace((({ context: t3, horizontalPixelRatio: i3, verticalPixelRatio: n3 }) => {
        t3.strokeStyle = this.Vm(), t3.fillStyle = this.Vm();
        const r3 = Math.max(1, Math.floor(i3)), h2 = Math.floor(0.5 * i3);
        t3.beginPath();
        const a2 = Math.round(e2.C * n3);
        for (let n4 = s2.length; n4--; ) {
          const e3 = Math.round(s2[n4].coord * i3);
          t3.rect(e3 - h2, 0, r3, a2);
        }
        t3.fill();
      })), t2.useMediaCoordinateSpace((({ context: t3 }) => {
        const i3 = e2.S + e2.C + e2.A + e2.P / 2;
        t3.textAlign = "center", t3.textBaseline = "middle", t3.fillStyle = this.H(), t3.font = this.nv();
        for (const e3 of s2) if (e3.weight < n2) {
          const s3 = e3.needAlignCoordinate ? this.Bm(t3, e3.coord, e3.label) : e3.coord;
          t3.fillText(e3.label, s3, i3);
        }
        this.Dp.N().timeScale.allowBoldLabels && (t3.font = this.Im());
        for (const e3 of s2) if (e3.weight >= n2) {
          const s3 = e3.needAlignCoordinate ? this.Bm(t3, e3.coord, e3.label) : e3.coord;
          t3.fillText(e3.label, s3, i3);
        }
      }));
    }
    Bm(t2, i2, s2) {
      const n2 = this.Np.Ei(t2, s2), e2 = n2 / 2, r2 = Math.floor(i2 - e2) + 0.5;
      return r2 < 0 ? i2 += Math.abs(0 - r2) : r2 + n2 > this.Op.width && (i2 -= Math.abs(this.Op.width - (r2 + n2))), i2;
    }
    Em(t2, i2) {
      const s2 = this.Tm();
      for (const n2 of t2) for (const t3 of n2.cs()) t3.Tt().nt(i2, s2);
    }
    Vm() {
      return this.Dp.N().timeScale.borderColor;
    }
    H() {
      return this.Ps.textColor;
    }
    W() {
      return this.Ps.fontSize;
    }
    nv() {
      return g(this.W(), this.Ps.fontFamily);
    }
    Im() {
      return g(this.W(), this.Ps.fontFamily, "bold");
    }
    Tm() {
      null === this.M && (this.M = { S: 1, O: NaN, A: NaN, V: NaN, Ji: NaN, C: 5, P: NaN, k: "", Gi: new it(), Rm: 0 });
      const t2 = this.M, i2 = this.nv();
      if (t2.k !== i2) {
        const s2 = this.W();
        t2.P = s2, t2.k = i2, t2.A = 3 * s2 / 12, t2.V = 3 * s2 / 12, t2.Ji = 9 * s2 / 12, t2.O = 0, t2.Rm = 4 * s2 / 12, t2.Gi.Vn();
      }
      return this.M;
    }
    pv(t2) {
      this.qf.style.cursor = 1 === t2 ? "ew-resize" : "default";
    }
    xm() {
      const t2 = this.Dp.Qt(), i2 = t2.N();
      i2.leftPriceScale.visible || null === this.fm || (this.gm.removeChild(this.fm.Xf()), this.fm.m(), this.fm = null), i2.rightPriceScale.visible || null === this.pm || (this.Mm.removeChild(this.pm.Xf()), this.pm.m(), this.pm = null);
      const s2 = { Ec: this.Dp.Qt().Ec() }, n2 = () => i2.leftPriceScale.borderVisible && t2.It().N().borderVisible, e2 = () => t2.Wc();
      i2.leftPriceScale.visible && null === this.fm && (this.fm = new As("left", i2, s2, n2, e2), this.gm.appendChild(this.fm.Xf())), i2.rightPriceScale.visible && null === this.pm && (this.pm = new As("right", i2, s2, n2, e2), this.Mm.appendChild(this.pm.Xf()));
    }
  }
  const Fs = !!hs && !!navigator.userAgentData && navigator.userAgentData.brands.some(((t2) => t2.brand.includes("Chromium"))) && !!hs && (((_a = navigator == null ? void 0 : navigator.userAgentData) == null ? void 0 : _a.platform) ? "Windows" === navigator.userAgentData.platform : navigator.userAgent.toLowerCase().indexOf("win") >= 0);
  class Hs {
    constructor(t2, i2, s2) {
      var n2;
      this.Am = [], this.zm = [], this.Om = 0, this.sl = 0, this.Mo = 0, this.Lm = 0, this.Nm = 0, this.Wm = null, this.Fm = false, this.xv = new o(), this.Sv = new o(), this.Ku = new o(), this.Hm = null, this.Um = null, this.Rp = t2, this.Ps = i2, this.o_ = s2, this.yp = document.createElement("div"), this.yp.classList.add("tv-lightweight-charts"), this.yp.style.overflow = "hidden", this.yp.style.direction = "ltr", this.yp.style.width = "100%", this.yp.style.height = "100%", (n2 = this.yp).style.userSelect = "none", n2.style.webkitUserSelect = "none", n2.style.msUserSelect = "none", n2.style.MozUserSelect = "none", n2.style.webkitTapHighlightColor = "transparent", this.$m = document.createElement("table"), this.$m.setAttribute("cellspacing", "0"), this.yp.appendChild(this.$m), this.jm = this.qm.bind(this), Us(this.Ps) && this.Ym(true), this.ts = new Ii(this.Zu.bind(this), this.Ps, s2), this.Qt().uc().i(this.Km.bind(this), this), this.Xm = new Ws(this, this.o_), this.$m.appendChild(this.Xm.Xf());
      const e2 = i2.autoSize && this.Zm();
      let r2 = this.Ps.width, h2 = this.Ps.height;
      if (e2 || 0 === r2 || 0 === h2) {
        const i3 = t2.getBoundingClientRect();
        r2 = r2 || i3.width, h2 = h2 || i3.height;
      }
      this.Gm(r2, h2), this.Jm(), t2.appendChild(this.yp), this.Qm(), this.ts.It().Vu().i(this.ts.Bh.bind(this.ts), this), this.ts.Eo().i(this.ts.Bh.bind(this.ts), this);
    }
    Qt() {
      return this.ts;
    }
    N() {
      return this.Ps;
    }
    Uf() {
      return this.Am;
    }
    tw() {
      return this.Xm;
    }
    m() {
      this.Ym(false), 0 !== this.Om && window.cancelAnimationFrame(this.Om), this.ts.uc().u(this), this.ts.It().Vu().u(this), this.ts.Eo().u(this), this.ts.m();
      for (const t2 of this.Am) this.$m.removeChild(t2.Xf()), t2.Kv().u(this), t2.Xv().u(this), t2.m();
      this.Am = [];
      for (const t2 of this.zm) this.iw(t2);
      this.zm = [], a(this.Xm).m(), null !== this.yp.parentElement && this.yp.parentElement.removeChild(this.yp), this.Ku.m(), this.xv.m(), this.Sv.m(), this.sw();
    }
    Gm(t2, i2, s2 = false) {
      if (this.sl === i2 && this.Mo === t2) return;
      const n2 = (function(t3) {
        const i3 = Math.floor(t3.width), s3 = Math.floor(t3.height);
        return Qi({ width: i3 - i3 % 2, height: s3 - s3 % 2 });
      })(Qi({ width: t2, height: i2 }));
      this.sl = n2.height, this.Mo = n2.width;
      const e2 = this.sl + "px", r2 = this.Mo + "px";
      a(this.yp).style.height = e2, a(this.yp).style.width = r2, this.$m.style.height = e2, this.$m.style.width = r2, s2 ? this.nw(Y.gn(), performance.now()) : this.ts.Bh();
    }
    av(t2) {
      void 0 === t2 && (t2 = Y.gn());
      for (let i2 = 0; i2 < this.Am.length; i2++) this.Am[i2].av(t2.en(i2).tn);
      this.Ps.timeScale.visible && this.Xm.av(t2.nn());
    }
    hr(t2) {
      var _a2;
      const i2 = Us(this.Ps);
      this.ts.hr(t2);
      const s2 = Us(this.Ps);
      s2 !== i2 && this.Ym(s2), ((_a2 = t2.layout) == null ? void 0 : _a2.panes) && this.ew(), this.Qm(), this.rw(t2);
    }
    Kv() {
      return this.xv;
    }
    Xv() {
      return this.Sv;
    }
    uc() {
      return this.Ku;
    }
    hw() {
      null !== this.Wm && (this.nw(this.Wm, performance.now()), this.Wm = null);
      const t2 = this.aw(null), i2 = document.createElement("canvas");
      i2.width = t2.width, i2.height = t2.height;
      const s2 = a(i2.getContext("2d"));
      return this.aw(s2), i2;
    }
    lw(t2) {
      if ("left" === t2 && !this.ow()) return 0;
      if ("right" === t2 && !this._w()) return 0;
      if (0 === this.Am.length) return 0;
      return a("left" === t2 ? this.Am[0].sm() : this.Am[0].nm()).hv();
    }
    uw() {
      return this.Ps.autoSize && null !== this.Hm;
    }
    tp() {
      return this.yp;
    }
    cw(t2) {
      this.Um = t2, this.Um ? this.tp().style.setProperty("cursor", t2) : this.tp().style.removeProperty("cursor");
    }
    dw() {
      return this.Um;
    }
    fw(t2) {
      return h(this.Am[t2]).Zf();
    }
    ew() {
      this.zm.forEach(((t2) => {
        t2.yt();
      }));
    }
    rw(t2) {
      (void 0 !== t2.autoSize || !this.Hm || void 0 === t2.width && void 0 === t2.height) && (t2.autoSize && !this.Hm && this.Zm(), false === t2.autoSize && null !== this.Hm && this.sw(), t2.autoSize || void 0 === t2.width && void 0 === t2.height || this.Gm(t2.width || this.Mo, t2.height || this.sl));
    }
    aw(t2) {
      let i2 = 0, s2 = 0;
      const n2 = this.Am[0], e2 = (i3, s3) => {
        let n3 = 0;
        for (let e3 = 0; e3 < this.Am.length; e3++) {
          const r3 = this.Am[e3], h2 = a("left" === i3 ? r3.sm() : r3.nm()), l2 = h2.Gf();
          if (null !== t2 && h2.Jf(t2, s3, n3), n3 += l2.height, e3 < this.Am.length - 1) {
            const i4 = this.zm[e3], r4 = i4.Gf();
            null !== t2 && i4.Jf(t2, s3, n3), n3 += r4.height;
          }
        }
      };
      if (this.ow()) {
        e2("left", 0);
        i2 += a(n2.sm()).Gf().width;
      }
      for (let n3 = 0; n3 < this.Am.length; n3++) {
        const e3 = this.Am[n3], r3 = e3.Gf();
        if (null !== t2 && e3.Jf(t2, i2, s2), s2 += r3.height, n3 < this.Am.length - 1) {
          const e4 = this.zm[n3], r4 = e4.Gf();
          null !== t2 && e4.Jf(t2, i2, s2), s2 += r4.height;
        }
      }
      if (i2 += n2.Gf().width, this._w()) {
        e2("right", i2);
        i2 += a(n2.nm()).Gf().width;
      }
      const r2 = (i3, s3, n3) => {
        a("left" === i3 ? this.Xm.Sm() : this.Xm.Cm()).Jf(a(t2), s3, n3);
      };
      if (this.Ps.timeScale.visible) {
        const i3 = this.Xm.Gf();
        if (null !== t2) {
          let e3 = 0;
          this.ow() && (r2("left", e3, s2), e3 = a(n2.sm()).Gf().width), this.Xm.Jf(t2, e3, s2), e3 += i3.width, this._w() && r2("right", e3, s2);
        }
        s2 += i3.height;
      }
      return Qi({ width: i2, height: s2 });
    }
    pw() {
      let t2 = 0, i2 = 0, s2 = 0;
      for (const n3 of this.Am) this.ow() && (i2 = Math.max(i2, a(n3.sm()).sv(), this.Ps.leftPriceScale.minimumWidth)), this._w() && (s2 = Math.max(s2, a(n3.nm()).sv(), this.Ps.rightPriceScale.minimumWidth)), t2 += n3.Vo();
      i2 = os(i2), s2 = os(s2);
      const n2 = this.Mo, e2 = this.sl, r2 = Math.max(n2 - i2 - s2, 0), h2 = 1 * this.zm.length, l2 = this.Ps.timeScale.visible;
      let o2 = l2 ? Math.max(this.Xm.km(), this.Ps.timeScale.minimumHeight) : 0;
      var _2;
      o2 = (_2 = o2) + _2 % 2;
      const u2 = h2 + o2, c2 = e2 < u2 ? 0 : e2 - u2, d2 = c2 / t2;
      let f2 = 0;
      const p2 = window.devicePixelRatio || 1;
      for (let t3 = 0; t3 < this.Am.length; ++t3) {
        const n3 = this.Am[t3];
        n3.zv(this.ts.$s()[t3]);
        let e3 = 0, h3 = 0;
        h3 = t3 === this.Am.length - 1 ? Math.ceil((c2 - f2) * p2) / p2 : Math.round(n3.Vo() * d2 * p2) / p2, e3 = Math.max(h3, 2), f2 += e3, n3.rv(Qi({ width: r2, height: e3 })), this.ow() && n3.Gv(i2, "left"), this._w() && n3.Gv(s2, "right"), n3.hp() && this.ts.cc(n3.hp(), e3);
      }
      this.Xm.ym(Qi({ width: l2 ? r2 : 0, height: o2 }), l2 ? i2 : 0, l2 ? s2 : 0), this.ts.Io(r2), this.Lm !== i2 && (this.Lm = i2), this.Nm !== s2 && (this.Nm = s2);
    }
    Ym(t2) {
      t2 ? this.yp.addEventListener("wheel", this.jm, { passive: false }) : this.yp.removeEventListener("wheel", this.jm);
    }
    mw(t2) {
      switch (t2.deltaMode) {
        case t2.DOM_DELTA_PAGE:
          return 120;
        case t2.DOM_DELTA_LINE:
          return 32;
      }
      return Fs ? 1 / window.devicePixelRatio : 1;
    }
    qm(t2) {
      if (!(0 !== t2.deltaX && this.Ps.handleScroll.mouseWheel || 0 !== t2.deltaY && this.Ps.handleScale.mouseWheel)) return;
      const i2 = this.mw(t2), s2 = i2 * t2.deltaX / 100, n2 = -i2 * t2.deltaY / 100;
      if (t2.cancelable && t2.preventDefault(), 0 !== n2 && this.Ps.handleScale.mouseWheel) {
        const i3 = Math.sign(n2) * Math.min(1, Math.abs(n2)), s3 = t2.clientX - this.yp.getBoundingClientRect().left;
        this.Qt().Mc(s3, i3);
      }
      0 !== s2 && this.Ps.handleScroll.mouseWheel && this.Qt().bc(-80 * s2);
    }
    nw(t2, i2) {
      var _a2;
      const s2 = t2.nn();
      3 === s2 && this.ww(), 3 !== s2 && 2 !== s2 || (this.gw(t2), this.Mw(t2, i2), this.Xm.yt(), this.Am.forEach(((t3) => {
        t3.Lv();
      })), 3 === ((_a2 = this.Wm) == null ? void 0 : _a2.nn()) && (this.Wm.vn(t2), this.ww(), this.gw(this.Wm), this.Mw(this.Wm, i2), t2 = this.Wm, this.Wm = null)), this.av(t2);
    }
    Mw(t2, i2) {
      for (const s2 of t2.pn()) this.mn(s2, i2);
    }
    gw(t2) {
      const i2 = this.ts.$s();
      for (let s2 = 0; s2 < i2.length; s2++) t2.en(s2).sn && i2[s2].Go();
    }
    mn(t2, i2) {
      const s2 = this.ts.It();
      switch (t2.an) {
        case 0:
          s2.Iu();
          break;
        case 1:
          s2.Au(t2.Ft);
          break;
        case 2:
          s2.dn(t2.Ft);
          break;
        case 3:
          s2.fn(t2.Ft);
          break;
        case 4:
          s2.bu();
          break;
        case 5:
          t2.Ft.Tu(i2) || s2.fn(t2.Ft.Ru(i2));
      }
    }
    Zu(t2) {
      null !== this.Wm ? this.Wm.vn(t2) : this.Wm = t2, this.Fm || (this.Fm = true, this.Om = window.requestAnimationFrame(((t3) => {
        if (this.Fm = false, this.Om = 0, null !== this.Wm) {
          const i2 = this.Wm;
          this.Wm = null, this.nw(i2, t3);
          for (const s2 of i2.pn()) if (5 === s2.an && !s2.Ft.Tu(t3)) {
            this.Qt()._n(s2.Ft);
            break;
          }
        }
      })));
    }
    ww() {
      this.Jm();
    }
    iw(t2) {
      this.$m.removeChild(t2.Xf()), t2.m();
    }
    Jm() {
      const t2 = this.ts.$s(), i2 = t2.length, s2 = this.Am.length;
      for (let t3 = i2; t3 < s2; t3++) {
        const t4 = h(this.Am.pop());
        this.$m.removeChild(t4.Xf()), t4.Kv().u(this), t4.Xv().u(this), t4.m();
        const i3 = this.zm.pop();
        void 0 !== i3 && this.iw(i3);
      }
      for (let n2 = s2; n2 < i2; n2++) {
        const i3 = new Is(this, t2[n2]);
        if (i3.Kv().i(this.bw.bind(this, i3), this), i3.Xv().i(this.xw.bind(this, i3), this), this.Am.push(i3), n2 > 0) {
          const t3 = new ms(this, n2 - 1, n2);
          this.zm.push(t3), this.$m.insertBefore(t3.Xf(), this.Xm.Xf());
        }
        this.$m.insertBefore(i3.Xf(), this.Xm.Xf());
      }
      for (let s3 = 0; s3 < i2; s3++) {
        const i3 = t2[s3], n2 = this.Am[s3];
        n2.hp() !== i3 ? n2.zv(i3) : n2.Av();
      }
      this.Qm(), this.pw();
    }
    Sw(t2, i2, s2, n2) {
      var _a2;
      const e2 = /* @__PURE__ */ new Map();
      if (null !== t2) {
        this.ts.Ys().forEach(((i3) => {
          const s3 = i3.Xs().Wr(t2);
          null !== s3 && e2.set(i3, s3);
        }));
      }
      let r2;
      if (null !== t2) {
        const i3 = (_a2 = this.ts.It().ss(t2)) == null ? void 0 : _a2.originalTime;
        void 0 !== i3 && (r2 = i3);
      }
      const h2 = this.Qt().hc(), a2 = null !== h2 && h2.n_ instanceof Ut ? h2.n_ : void 0, l2 = null !== h2 && void 0 !== h2.e_ ? h2.e_.Kn : void 0, o2 = this.Cw(n2);
      return { Pw: r2, Re: t2 != null ? t2 : void 0, yw: i2 != null ? i2 : void 0, kw: -1 !== o2 ? o2 : void 0, Tw: a2, Rw: e2, Dw: l2, Ew: s2 != null ? s2 : void 0 };
    }
    Cw(t2) {
      let i2 = -1;
      if (t2) i2 = this.Am.indexOf(t2);
      else {
        const t3 = this.Qt()._c().Us();
        null !== t3 && (i2 = this.Qt().$s().indexOf(t3));
      }
      return i2;
    }
    bw(t2, i2, s2, n2) {
      this.xv.p((() => this.Sw(i2, s2, n2, t2)));
    }
    xw(t2, i2, s2, n2) {
      this.Sv.p((() => this.Sw(i2, s2, n2, t2)));
    }
    Km(t2, i2, s2) {
      var _a2, _b;
      this.cw((_b = (_a2 = this.Qt().hc()) == null ? void 0 : _a2.h_) != null ? _b : null), this.Ku.p((() => this.Sw(t2, i2, s2)));
    }
    Qm() {
      const t2 = this.Ps.timeScale.visible ? "" : "none";
      this.Xm.Xf().style.display = t2;
    }
    ow() {
      return this.Am[0].hp().Fo().N().visible;
    }
    _w() {
      return this.Am[0].hp().Ho().N().visible;
    }
    Zm() {
      return "ResizeObserver" in window && (this.Hm = new ResizeObserver(((t2) => {
        const i2 = t2[t2.length - 1];
        i2 && this.Gm(i2.contentRect.width, i2.contentRect.height);
      })), this.Hm.observe(this.Rp, { box: "border-box" }), true);
    }
    sw() {
      null !== this.Hm && this.Hm.disconnect(), this.Hm = null;
    }
  }
  function Us(t2) {
    return Boolean(t2.handleScroll.mouseWheel || t2.handleScale.mouseWheel);
  }
  function $s(t2) {
    return void 0 === t2.open && void 0 === t2.value;
  }
  function js(t2) {
    return (function(t3) {
      return void 0 !== t3.open;
    })(t2) || (function(t3) {
      return void 0 !== t3.value;
    })(t2);
  }
  function qs(t2, i2, s2, n2) {
    const e2 = s2.value, r2 = { Re: i2, wt: t2, Ft: [e2, e2, e2, e2], Pw: n2 };
    return void 0 !== s2.color && (r2.R = s2.color), r2;
  }
  function Ys(t2, i2, s2, n2) {
    const e2 = s2.value, r2 = { Re: i2, wt: t2, Ft: [e2, e2, e2, e2], Pw: n2 };
    return void 0 !== s2.lineColor && (r2.vt = s2.lineColor), void 0 !== s2.topColor && (r2.mr = s2.topColor), void 0 !== s2.bottomColor && (r2.wr = s2.bottomColor), r2;
  }
  function Ks(t2, i2, s2, n2) {
    const e2 = s2.value, r2 = { Re: i2, wt: t2, Ft: [e2, e2, e2, e2], Pw: n2 };
    return void 0 !== s2.topLineColor && (r2.gr = s2.topLineColor), void 0 !== s2.bottomLineColor && (r2.Mr = s2.bottomLineColor), void 0 !== s2.topFillColor1 && (r2.br = s2.topFillColor1), void 0 !== s2.topFillColor2 && (r2.Sr = s2.topFillColor2), void 0 !== s2.bottomFillColor1 && (r2.Cr = s2.bottomFillColor1), void 0 !== s2.bottomFillColor2 && (r2.Pr = s2.bottomFillColor2), r2;
  }
  function Xs(t2, i2, s2, n2) {
    const e2 = { Re: i2, wt: t2, Ft: [s2.open, s2.high, s2.low, s2.close], Pw: n2 };
    return void 0 !== s2.color && (e2.R = s2.color), e2;
  }
  function Zs(t2, i2, s2, n2) {
    const e2 = { Re: i2, wt: t2, Ft: [s2.open, s2.high, s2.low, s2.close], Pw: n2 };
    return void 0 !== s2.color && (e2.R = s2.color), void 0 !== s2.borderColor && (e2.Ht = s2.borderColor), void 0 !== s2.wickColor && (e2.vr = s2.wickColor), e2;
  }
  function Gs(t2, i2, s2, n2, e2) {
    const r2 = h(e2)(s2), a2 = Math.max(...r2), l2 = Math.min(...r2), o2 = r2[r2.length - 1], _2 = [o2, a2, l2, o2], { time: u2, color: c2, ...d2 } = s2;
    return { Re: i2, wt: t2, Ft: _2, Pw: n2, se: d2, R: c2 };
  }
  function Js(t2) {
    return void 0 !== t2.Ft;
  }
  function Qs(t2, i2) {
    return void 0 !== i2.customValues && (t2.Vw = i2.customValues), t2;
  }
  function tn(t2) {
    return (i2, s2, n2, e2, r2, h2) => (function(t3, i3) {
      return i3 ? i3(t3) : $s(t3);
    })(n2, h2) ? Qs({ wt: i2, Re: s2, Pw: e2 }, n2) : Qs(t2(i2, s2, n2, e2, r2), n2);
  }
  function sn(t2) {
    return { Candlestick: tn(Zs), Bar: tn(Xs), Area: tn(Ys), Baseline: tn(Ks), Histogram: tn(qs), Line: tn(qs), Custom: tn(Gs) }[t2];
  }
  function nn(t2) {
    return { Re: 0, Bw: /* @__PURE__ */ new Map(), Hh: t2 };
  }
  function en(t2, i2) {
    if (void 0 !== t2 && 0 !== t2.length) return { Iw: i2.key(t2[0].wt), Aw: i2.key(t2[t2.length - 1].wt) };
  }
  function rn(t2) {
    let i2;
    return t2.forEach(((t3) => {
      void 0 === i2 && (i2 = t3.Pw);
    })), h(i2);
  }
  class hn {
    constructor(t2) {
      this.zw = /* @__PURE__ */ new Map(), this.Ow = /* @__PURE__ */ new Map(), this.Lw = /* @__PURE__ */ new Map(), this.Nw = [], this.o_ = t2;
    }
    m() {
      this.zw.clear(), this.Ow.clear(), this.Lw.clear(), this.Nw = [];
    }
    Ww(t2, i2) {
      let s2 = 0 !== this.zw.size, n2 = false;
      const e2 = this.Ow.get(t2);
      if (void 0 !== e2) if (1 === this.Ow.size) s2 = false, n2 = true, this.zw.clear();
      else for (const i3 of this.Nw) i3.pointData.Bw.delete(t2) && (n2 = true);
      let r2 = [];
      if (0 !== i2.length) {
        const s3 = i2.map(((t3) => t3.time)), e3 = this.o_.createConverterToInternalObj(i2), h3 = sn(t2.Rr()), a2 = t2.da(), l2 = t2.pa();
        r2 = i2.map(((i3, r3) => {
          const o2 = e3(i3.time), _2 = this.o_.key(o2);
          let u2 = this.zw.get(_2);
          void 0 === u2 && (u2 = nn(o2), this.zw.set(_2, u2), n2 = true);
          const c2 = h3(o2, u2.Re, i3, s3[r3], a2, l2);
          return u2.Bw.set(t2, c2), c2;
        }));
      }
      s2 && this.Fw(), this.Hw(t2, r2);
      let h2 = -1;
      if (n2) {
        const t3 = [];
        this.zw.forEach(((i3) => {
          t3.push({ timeWeight: 0, time: i3.Hh, pointData: i3, originalTime: rn(i3.Bw) });
        })), t3.sort(((t4, i3) => this.o_.key(t4.time) - this.o_.key(i3.time))), h2 = this.Uw(t3);
      }
      return this.$w(t2, h2, (function(t3, i3, s3) {
        const n3 = en(t3, s3), e3 = en(i3, s3);
        if (void 0 !== n3 && void 0 !== e3) return { jw: false, zh: n3.Aw >= e3.Aw && n3.Iw >= e3.Iw };
      })(this.Ow.get(t2), e2, this.o_));
    }
    Ic(t2) {
      return this.Ww(t2, []);
    }
    qw(t2, i2, s2) {
      const n2 = i2;
      !(function(t3) {
        void 0 === t3.Pw && (t3.Pw = t3.time);
      })(n2), this.o_.preprocessData(i2);
      const e2 = this.o_.createConverterToInternalObj([i2])(i2.time), r2 = this.Lw.get(t2);
      if (!s2 && void 0 !== r2 && this.o_.key(e2) < this.o_.key(r2)) throw new Error("Cannot update oldest data, last time=".concat(r2, ", new time=").concat(e2));
      let h2 = this.zw.get(this.o_.key(e2));
      if (s2 && void 0 === h2) throw new Error("Cannot update non-existing data point when historicalUpdate is true");
      const a2 = void 0 === h2;
      void 0 === h2 && (h2 = nn(e2), this.zw.set(this.o_.key(e2), h2));
      const l2 = sn(t2.Rr()), o2 = t2.da(), _2 = t2.pa(), u2 = l2(e2, h2.Re, i2, n2.Pw, o2, _2);
      h2.Bw.set(t2, u2), s2 ? this.Yw(t2, u2, h2.Re) : this.Kw(t2, u2);
      const c2 = { zh: Js(u2), jw: s2 };
      if (!a2) return this.$w(t2, -1, c2);
      const d2 = { timeWeight: 0, time: h2.Hh, pointData: h2, originalTime: rn(h2.Bw) }, f2 = xt(this.Nw, this.o_.key(d2.time), ((t3, i3) => this.o_.key(t3.time) < i3));
      this.Nw.splice(f2, 0, d2);
      for (let t3 = f2; t3 < this.Nw.length; ++t3) an(this.Nw[t3].pointData, t3);
      return this.o_.fillWeightsForPoints(this.Nw, f2), this.$w(t2, f2, c2);
    }
    Kw(t2, i2) {
      let s2 = this.Ow.get(t2);
      void 0 === s2 && (s2 = [], this.Ow.set(t2, s2));
      const n2 = 0 !== s2.length ? s2[s2.length - 1] : null;
      null === n2 || this.o_.key(i2.wt) > this.o_.key(n2.wt) ? Js(i2) && s2.push(i2) : Js(i2) ? s2[s2.length - 1] = i2 : s2.splice(-1, 1), this.Lw.set(t2, i2.wt);
    }
    Yw(t2, i2, s2) {
      const n2 = this.Ow.get(t2);
      if (void 0 === n2) return;
      const e2 = xt(n2, s2, ((t3, i3) => t3.Re < i3));
      Js(i2) ? n2[e2] = i2 : n2.splice(e2, 1);
    }
    Hw(t2, i2) {
      0 !== i2.length ? (this.Ow.set(t2, i2.filter(Js)), this.Lw.set(t2, i2[i2.length - 1].wt)) : (this.Ow.delete(t2), this.Lw.delete(t2));
    }
    Fw() {
      for (const t2 of this.Nw) 0 === t2.pointData.Bw.size && this.zw.delete(this.o_.key(t2.time));
    }
    Uw(t2) {
      let i2 = -1;
      for (let s2 = 0; s2 < this.Nw.length && s2 < t2.length; ++s2) {
        const n2 = this.Nw[s2], e2 = t2[s2];
        if (this.o_.key(n2.time) !== this.o_.key(e2.time)) {
          i2 = s2;
          break;
        }
        e2.timeWeight = n2.timeWeight, an(e2.pointData, s2);
      }
      if (-1 === i2 && this.Nw.length !== t2.length && (i2 = Math.min(this.Nw.length, t2.length)), -1 === i2) return -1;
      for (let s2 = i2; s2 < t2.length; ++s2) an(t2[s2].pointData, s2);
      return this.o_.fillWeightsForPoints(t2, i2), this.Nw = t2, i2;
    }
    Xw() {
      if (0 === this.Ow.size) return null;
      let t2 = 0;
      return this.Ow.forEach(((i2) => {
        0 !== i2.length && (t2 = Math.max(t2, i2[i2.length - 1].Re));
      })), t2;
    }
    $w(t2, i2, s2) {
      const n2 = { Lo: /* @__PURE__ */ new Map(), It: { ou: this.Xw() } };
      if (-1 !== i2) this.Ow.forEach(((i3, e2) => {
        n2.Lo.set(e2, { se: i3, Zw: e2 === t2 ? s2 : void 0 });
      })), this.Ow.has(t2) || n2.Lo.set(t2, { se: [], Zw: s2 }), n2.It.Gw = this.Nw, n2.It.Jw = i2;
      else {
        const i3 = this.Ow.get(t2);
        n2.Lo.set(t2, { se: i3 || [], Zw: s2 });
      }
      return n2;
    }
  }
  function an(t2, i2) {
    t2.Re = i2, t2.Bw.forEach(((t3) => {
      t3.Re = i2;
    }));
  }
  function ln(t2, i2) {
    return t2.wt < i2;
  }
  function on(t2, i2) {
    return i2 < t2.wt;
  }
  function _n(t2, i2, s2) {
    const n2 = i2.Uh(), e2 = i2.bi(), r2 = xt(t2, n2, ln), h2 = St(t2, e2, on);
    if (!s2) return { from: r2, to: h2 };
    let a2 = r2, l2 = h2;
    return r2 > 0 && r2 < t2.length && t2[r2].wt >= n2 && (a2 = r2 - 1), h2 > 0 && h2 < t2.length && t2[h2 - 1].wt <= e2 && (l2 = h2 + 1), { from: a2, to: l2 };
  }
  class un {
    constructor(t2, i2, s2) {
      this.Qw = true, this.tg = true, this.ig = true, this.sg = [], this.ng = null, this.Jn = t2, this.Qn = i2, this.eg = s2;
    }
    yt(t2) {
      this.Qw = true, "data" === t2 && (this.tg = true), "options" === t2 && (this.ig = true);
    }
    Tt() {
      return this.Jn.Et() ? (this.rg(), null === this.ng ? null : this.hg) : null;
    }
    ag() {
      this.sg = this.sg.map(((t2) => ({ ...t2, ...this.Jn.Rh().Dr(t2.wt) })));
    }
    lg() {
      this.ng = null;
    }
    rg() {
      this.tg && (this.og(), this.tg = false), this.ig && (this.ag(), this.ig = false), this.Qw && (this._g(), this.Qw = false);
    }
    _g() {
      const t2 = this.Jn.Wt(), i2 = this.Qn.It();
      if (this.lg(), i2.Ki() || t2.Ki()) return;
      const s2 = i2.Pe();
      if (null === s2) return;
      if (0 === this.Jn.Xs().zr()) return;
      const n2 = this.Jn.zt();
      null !== n2 && (this.ng = _n(this.sg, s2, this.eg), this.ug(t2, i2, n2.Ft), this.cg());
    }
  }
  class cn {
    constructor(t2, i2) {
      this.dg = t2, this.qi = i2;
    }
    nt(t2, i2, s2) {
      this.dg.draw(t2, this.qi, i2, s2);
    }
  }
  class dn extends un {
    constructor(t2, i2, s2) {
      super(t2, i2, false), this.sh = s2, this.hg = new cn(this.sh.renderer(), ((i3) => {
        const s3 = t2.zt();
        return null === s3 ? null : t2.Wt().Nt(i3, s3.Ft);
      }));
    }
    fa(t2) {
      return this.sh.priceValueBuilder(t2);
    }
    va(t2) {
      return this.sh.isWhitespace(t2);
    }
    og() {
      const t2 = this.Jn.Rh();
      this.sg = this.Jn.Xs().Hr().map(((i2) => ({ wt: i2.Re, _t: NaN, ...t2.Dr(i2.Re), fg: i2.se })));
    }
    ug(t2, i2) {
      i2._u(this.sg, m(this.ng));
    }
    cg() {
      this.sh.update({ bars: this.sg.map(fn), barSpacing: this.Qn.It().vu(), visibleRange: this.ng }, this.Jn.N());
    }
  }
  function fn(t2) {
    return { x: t2._t, time: t2.wt, originalData: t2.fg, barColor: t2.cr };
  }
  const pn = { color: "#2196f3" }, vn = (t2, i2, s2) => {
    const n2 = l(s2);
    return new dn(t2, i2, n2);
  };
  function mn(t2) {
    const i2 = { value: t2.Ft[3], time: t2.Pw };
    return void 0 !== t2.Vw && (i2.customValues = t2.Vw), i2;
  }
  function wn(t2) {
    const i2 = mn(t2);
    return void 0 !== t2.R && (i2.color = t2.R), i2;
  }
  function gn(t2) {
    const i2 = mn(t2);
    return void 0 !== t2.vt && (i2.lineColor = t2.vt), void 0 !== t2.mr && (i2.topColor = t2.mr), void 0 !== t2.wr && (i2.bottomColor = t2.wr), i2;
  }
  function Mn(t2) {
    const i2 = mn(t2);
    return void 0 !== t2.gr && (i2.topLineColor = t2.gr), void 0 !== t2.Mr && (i2.bottomLineColor = t2.Mr), void 0 !== t2.br && (i2.topFillColor1 = t2.br), void 0 !== t2.Sr && (i2.topFillColor2 = t2.Sr), void 0 !== t2.Cr && (i2.bottomFillColor1 = t2.Cr), void 0 !== t2.Pr && (i2.bottomFillColor2 = t2.Pr), i2;
  }
  function bn(t2) {
    const i2 = { open: t2.Ft[0], high: t2.Ft[1], low: t2.Ft[2], close: t2.Ft[3], time: t2.Pw };
    return void 0 !== t2.Vw && (i2.customValues = t2.Vw), i2;
  }
  function xn(t2) {
    const i2 = bn(t2);
    return void 0 !== t2.R && (i2.color = t2.R), i2;
  }
  function Sn(t2) {
    const i2 = bn(t2), { R: s2, Ht: n2, vr: e2 } = t2;
    return void 0 !== s2 && (i2.color = s2), void 0 !== n2 && (i2.borderColor = n2), void 0 !== e2 && (i2.wickColor = e2), i2;
  }
  function Cn(t2) {
    return { Area: gn, Line: wn, Baseline: Mn, Histogram: wn, Bar: xn, Candlestick: Sn, Custom: Pn }[t2];
  }
  function Pn(t2) {
    const i2 = t2.Pw;
    return { ...t2.se, time: i2 };
  }
  const yn = { vertLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, horzLine: { color: "#9598A1", width: 1, style: 3, visible: true, labelVisible: true, labelBackgroundColor: "#131722" }, mode: 1 }, kn = { vertLines: { color: "#D6DCDE", style: 0, visible: true }, horzLines: { color: "#D6DCDE", style: 0, visible: true } }, Tn = { background: { type: "solid", color: "#FFFFFF" }, textColor: "#191919", fontSize: 12, fontFamily: w, panes: { enableResize: true, separatorColor: "#E0E3EB", separatorHoverColor: "rgba(178, 181, 189, 0.2)" }, attributionLogo: true, colorSpace: "srgb", colorParsers: [] }, Rn = { autoScale: true, mode: 0, invertScale: false, alignLabels: true, borderVisible: true, borderColor: "#2B2B43", entireTextOnly: false, visible: false, ticksVisible: false, scaleMargins: { bottom: 0.1, top: 0.2 }, minimumWidth: 0, ensureEdgeTickMarksVisible: false }, Dn = { rightOffset: 0, barSpacing: 6, minBarSpacing: 0.5, maxBarSpacing: 0, fixLeftEdge: false, fixRightEdge: false, lockVisibleTimeRangeOnResize: false, rightBarStaysOnScroll: false, borderVisible: true, borderColor: "#2B2B43", visible: true, timeVisible: false, secondsVisible: true, shiftVisibleRangeOnNewBar: true, allowShiftVisibleRangeOnWhitespaceReplacement: false, ticksVisible: false, uniformDistribution: false, minimumHeight: 0, allowBoldLabels: true, ignoreWhitespaceIndices: false };
  function En() {
    return { addDefaultPane: true, width: 0, height: 0, autoSize: false, layout: Tn, crosshair: yn, grid: kn, overlayPriceScales: { ...Rn }, leftPriceScale: { ...Rn, visible: false }, rightPriceScale: { ...Rn, visible: true }, timeScale: Dn, localization: { locale: hs ? navigator.language : "", dateFormat: "dd MMM 'yy" }, handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: { time: true, price: true }, axisDoubleClickReset: { time: true, price: true }, mouseWheel: true, pinch: true }, kineticScroll: { mouse: false, touch: true }, trackingMode: { exitMode: 1 } };
  }
  class Vn {
    constructor(t2, i2, s2) {
      this.Ff = t2, this.pg = i2, this.vg = s2 != null ? s2 : 0;
    }
    applyOptions(t2) {
      this.Ff.Qt().lc(this.pg, t2, this.vg);
    }
    options() {
      return this.qi().N();
    }
    width() {
      return q(this.pg) ? this.Ff.lw(this.pg) : 0;
    }
    setVisibleRange(t2) {
      this.setAutoScale(false), this.qi().Fl(new dt(t2.from, t2.to));
    }
    getVisibleRange() {
      const t2 = this.qi().Qe();
      return null === t2 ? null : { from: t2.$e(), to: t2.je() };
    }
    setAutoScale(t2) {
      this.applyOptions({ autoScale: t2 });
    }
    qi() {
      return a(this.Ff.Qt().oc(this.pg, this.vg)).Wt;
    }
  }
  class Bn {
    constructor(t2, i2, s2, n2) {
      this.Ff = t2, this.Pt = s2, this.mg = i2, this.wg = n2;
    }
    getHeight() {
      return this.Pt.$t();
    }
    setHeight(t2) {
      const i2 = this.Ff.Qt(), s2 = i2.Hc(this.Pt);
      i2.fc(s2, t2);
    }
    getStretchFactor() {
      return this.Pt.Vo();
    }
    setStretchFactor(t2) {
      this.Pt.Bo(t2), this.Ff.Qt().Bh();
    }
    paneIndex() {
      return this.Ff.Qt().Hc(this.Pt);
    }
    moveTo(t2) {
      const i2 = this.paneIndex();
      i2 !== t2 && (r(t2 >= 0 && t2 < this.Ff.Uf().length, "Invalid pane index"), this.Ff.Qt().mc(i2, t2));
    }
    getSeries() {
      var _a2;
      return (_a2 = this.Pt.Lo().map(((t2) => this.mg(t2)))) != null ? _a2 : [];
    }
    getHTMLElement() {
      const t2 = this.Ff.Uf();
      return t2 && 0 !== t2.length && t2[this.paneIndex()] ? t2[this.paneIndex()].Xf() : null;
    }
    attachPrimitive(t2) {
      this.Pt.ua(t2), t2.attached && t2.attached({ chart: this.wg, requestUpdate: () => this.Pt.Qt().Bh() });
    }
    detachPrimitive(t2) {
      this.Pt.ca(t2);
    }
    priceScale(t2) {
      if (null === this.Pt.Do(t2)) throw new Error("Cannot find price scale with id: ".concat(t2));
      return new Vn(this.Ff, t2, this.paneIndex());
    }
    setPreserveEmptyPane(t2) {
      this.Pt.zo(t2);
    }
    preserveEmptyPane() {
      return this.Pt.Oo();
    }
    addCustomSeries(t2, i2 = {}, s2 = 0) {
      return this.wg.addCustomSeries(t2, i2, s2);
    }
    addSeries(t2, i2 = {}) {
      return this.wg.addSeries(t2, i2, this.paneIndex());
    }
  }
  const In = { color: "#FF0000", price: 0, lineStyle: 2, lineWidth: 1, lineVisible: true, axisLabelVisible: true, title: "", axisLabelColor: "", axisLabelTextColor: "" };
  class An {
    constructor(t2) {
      this.ir = t2;
    }
    applyOptions(t2) {
      this.ir.hr(t2);
    }
    options() {
      return this.ir.N();
    }
    gg() {
      return this.ir;
    }
  }
  class zn {
    constructor(t2, i2, s2, n2, e2, r2) {
      this.Mg = new o(), this.Jn = t2, this.bg = i2, this.xg = s2, this.o_ = e2, this.wg = n2, this.Sg = r2;
    }
    m() {
      this.Mg.m();
    }
    priceFormatter() {
      return this.Jn.ra();
    }
    priceToCoordinate(t2) {
      const i2 = this.Jn.zt();
      return null === i2 ? null : this.Jn.Wt().Nt(t2, i2.Ft);
    }
    coordinateToPrice(t2) {
      const i2 = this.Jn.zt();
      return null === i2 ? null : this.Jn.Wt().Ts(t2, i2.Ft);
    }
    barsInLogicalRange(t2) {
      if (null === t2) return null;
      const i2 = new yi(new Si(t2.from, t2.to)).y_(), s2 = this.Jn.Xs();
      if (s2.Ki()) return null;
      const n2 = s2.Wr(i2.Uh(), 1), e2 = s2.Wr(i2.bi(), -1), r2 = a(s2.Or()), h2 = a(s2.Ks());
      if (null !== n2 && null !== e2 && n2.Re > e2.Re) return { barsBefore: t2.from - r2, barsAfter: h2 - t2.to };
      const l2 = { barsBefore: null === n2 || n2.Re === r2 ? t2.from - r2 : n2.Re - r2, barsAfter: null === e2 || e2.Re === h2 ? h2 - t2.to : h2 - e2.Re };
      return null !== n2 && null !== e2 && (l2.from = n2.Pw, l2.to = e2.Pw), l2;
    }
    setData(t2) {
      this.o_, this.Jn.Rr(), this.bg.Cg(this.Jn, t2), this.Pg("full");
    }
    update(t2, i2 = false) {
      this.Jn.Rr(), this.bg.yg(this.Jn, t2, i2), this.Pg("update");
    }
    dataByIndex(t2, i2) {
      const s2 = this.Jn.Xs().Wr(t2, i2);
      if (null === s2) return null;
      return Cn(this.seriesType())(s2);
    }
    data() {
      const t2 = Cn(this.seriesType());
      return this.Jn.Xs().Hr().map(((i2) => t2(i2)));
    }
    subscribeDataChanged(t2) {
      this.Mg.i(t2);
    }
    unsubscribeDataChanged(t2) {
      this.Mg._(t2);
    }
    applyOptions(t2) {
      this.Jn.hr(t2);
    }
    options() {
      return p(this.Jn.N());
    }
    priceScale() {
      return this.xg.priceScale(this.Jn.Wt().wa(), this.getPane().paneIndex());
    }
    createPriceLine(t2) {
      const i2 = _(p(In), t2), s2 = this.Jn.Lh(i2);
      return new An(s2);
    }
    removePriceLine(t2) {
      this.Jn.Nh(t2.gg());
    }
    priceLines() {
      return this.Jn.Wh().map(((t2) => new An(t2)));
    }
    seriesType() {
      return this.Jn.Rr();
    }
    attachPrimitive(t2) {
      this.Jn.ua(t2), t2.attached && t2.attached({ chart: this.wg, series: this, requestUpdate: () => this.Jn.Qt().Bh(), horzScaleBehavior: this.o_ });
    }
    detachPrimitive(t2) {
      this.Jn.ca(t2), t2.detached && t2.detached(), this.Jn.Qt().Bh();
    }
    getPane() {
      const t2 = this.Jn, i2 = a(this.Jn.Qt().Hn(t2));
      return this.Sg(i2);
    }
    moveToPane(t2) {
      this.Jn.Qt().Lc(this.Jn, t2);
    }
    seriesOrder() {
      const t2 = this.Jn.Qt().Hn(this.Jn);
      return null === t2 ? -1 : t2.Lo().indexOf(this.Jn);
    }
    setSeriesOrder(t2) {
      const i2 = this.Jn.Qt().Hn(this.Jn);
      null !== i2 && i2.Qo(this.Jn, t2);
    }
    Pg(t2) {
      this.Mg.v() && this.Mg.p(t2);
    }
  }
  class On {
    constructor(t2, i2, s2) {
      this.kg = new o(), this.z_ = new o(), this.wm = new o(), this.ts = t2, this.uh = t2.It(), this.Xm = i2, this.uh.Du().i(this.Tg.bind(this)), this.uh.Eu().i(this.Rg.bind(this)), this.Xm.Pm().i(this.Dg.bind(this)), this.o_ = s2;
    }
    m() {
      this.uh.Du().u(this), this.uh.Eu().u(this), this.Xm.Pm().u(this), this.kg.m(), this.z_.m(), this.wm.m();
    }
    scrollPosition() {
      return this.uh.wu();
    }
    scrollToPosition(t2, i2) {
      i2 ? this.uh.ku(t2, 1e3) : this.ts.fn(t2);
    }
    scrollToRealTime() {
      this.uh.yu();
    }
    getVisibleRange() {
      const t2 = this.uh.su();
      return null === t2 ? null : { from: t2.from.originalTime, to: t2.to.originalTime };
    }
    setVisibleRange(t2) {
      const i2 = { from: this.o_.convertHorzItemToInternal(t2.from), to: this.o_.convertHorzItemToInternal(t2.to) }, s2 = this.uh.hu(i2);
      this.ts.zc(s2);
    }
    getVisibleLogicalRange() {
      const t2 = this.uh.iu();
      return null === t2 ? null : { from: t2.Uh(), to: t2.bi() };
    }
    setVisibleLogicalRange(t2) {
      r(t2.from <= t2.to, "The from index cannot be after the to index."), this.ts.zc(t2);
    }
    resetTimeScale() {
      this.ts.cn();
    }
    fitContent() {
      this.ts.Iu();
    }
    logicalToCoordinate(t2) {
      const i2 = this.ts.It();
      return i2.Ki() ? null : i2.jt(t2);
    }
    coordinateToLogical(t2) {
      return this.uh.Ki() ? null : this.uh.uu(t2);
    }
    timeToIndex(t2, i2) {
      const s2 = this.o_.convertHorzItemToInternal(t2);
      return this.uh.J_(s2, i2);
    }
    timeToCoordinate(t2) {
      const i2 = this.timeToIndex(t2, false);
      return null === i2 ? null : this.uh.jt(i2);
    }
    coordinateToTime(t2) {
      const i2 = this.ts.It(), s2 = i2.uu(t2), n2 = i2.ss(s2);
      return null === n2 ? null : n2.originalTime;
    }
    width() {
      return this.Xm.Zf().width;
    }
    height() {
      return this.Xm.Zf().height;
    }
    subscribeVisibleTimeRangeChange(t2) {
      this.kg.i(t2);
    }
    unsubscribeVisibleTimeRangeChange(t2) {
      this.kg._(t2);
    }
    subscribeVisibleLogicalRangeChange(t2) {
      this.z_.i(t2);
    }
    unsubscribeVisibleLogicalRangeChange(t2) {
      this.z_._(t2);
    }
    subscribeSizeChange(t2) {
      this.wm.i(t2);
    }
    unsubscribeSizeChange(t2) {
      this.wm._(t2);
    }
    applyOptions(t2) {
      this.uh.hr(t2);
    }
    options() {
      return { ...p(this.uh.N()), barSpacing: this.uh.vu() };
    }
    Tg() {
      this.kg.v() && this.kg.p(this.getVisibleRange());
    }
    Rg() {
      this.z_.v() && this.z_.p(this.getVisibleLogicalRange());
    }
    Dg(t2) {
      this.wm.p(t2.width, t2.height);
    }
  }
  function Ln(t2) {
    if (void 0 === t2 || "custom" === t2.type) return;
    const i2 = t2;
    void 0 !== i2.minMove && void 0 === i2.precision && (i2.precision = (function(t3) {
      if (t3 >= 1) return 0;
      let i3 = 0;
      for (; i3 < 8; i3++) {
        const s2 = Math.round(t3);
        if (Math.abs(s2 - t3) < 1e-8) return i3;
        t3 *= 10;
      }
      return i3;
    })(i2.minMove));
  }
  function Nn(t2) {
    return (function(t3) {
      if (f(t3.handleScale)) {
        const i3 = t3.handleScale;
        t3.handleScale = { axisDoubleClickReset: { time: i3, price: i3 }, axisPressedMouseMove: { time: i3, price: i3 }, mouseWheel: i3, pinch: i3 };
      } else if (void 0 !== t3.handleScale) {
        const { axisPressedMouseMove: i3, axisDoubleClickReset: s2 } = t3.handleScale;
        f(i3) && (t3.handleScale.axisPressedMouseMove = { time: i3, price: i3 }), f(s2) && (t3.handleScale.axisDoubleClickReset = { time: s2, price: s2 });
      }
      const i2 = t3.handleScroll;
      f(i2) && (t3.handleScroll = { horzTouchDrag: i2, vertTouchDrag: i2, mouseWheel: i2, pressedMouseMove: i2 });
    })(t2), t2;
  }
  class Wn {
    constructor(t2, i2, s2) {
      this.Eg = /* @__PURE__ */ new Map(), this.Vg = /* @__PURE__ */ new Map(), this.Bg = new o(), this.Ig = new o(), this.Ag = new o(), this.$u = /* @__PURE__ */ new WeakMap(), this.zg = new hn(i2);
      const n2 = void 0 === s2 ? p(En()) : _(p(En()), Nn(s2));
      this.Og = i2, this.Ff = new Hs(t2, n2, i2), this.Ff.Kv().i(((t3) => {
        this.Bg.v() && this.Bg.p(this.Lg(t3()));
      }), this), this.Ff.Xv().i(((t3) => {
        this.Ig.v() && this.Ig.p(this.Lg(t3()));
      }), this), this.Ff.uc().i(((t3) => {
        this.Ag.v() && this.Ag.p(this.Lg(t3()));
      }), this);
      const e2 = this.Ff.Qt();
      this.Ng = new On(e2, this.Ff.tw(), this.Og);
    }
    remove() {
      this.Ff.Kv().u(this), this.Ff.Xv().u(this), this.Ff.uc().u(this), this.Ng.m(), this.Ff.m(), this.Eg.clear(), this.Vg.clear(), this.Bg.m(), this.Ig.m(), this.Ag.m(), this.zg.m();
    }
    resize(t2, i2, s2) {
      this.autoSizeActive() || this.Ff.Gm(t2, i2, s2);
    }
    addCustomSeries(t2, i2 = {}, s2 = 0) {
      const n2 = ((t3) => ({ type: "Custom", isBuiltIn: false, defaultOptions: { ...pn, ...t3.defaultOptions() }, Wg: vn, Fg: t3 }))(l(t2));
      return this.Hg(n2, i2, s2);
    }
    addSeries(t2, i2 = {}, s2 = 0) {
      return this.Hg(t2, i2, s2);
    }
    removeSeries(t2) {
      const i2 = h(this.Eg.get(t2)), s2 = this.zg.Ic(i2);
      this.Ff.Qt().Ic(i2), this.Ug(s2), this.Eg.delete(t2), this.Vg.delete(i2);
    }
    Cg(t2, i2) {
      this.Ug(this.zg.Ww(t2, i2));
    }
    yg(t2, i2, s2) {
      this.Ug(this.zg.qw(t2, i2, s2));
    }
    subscribeClick(t2) {
      this.Bg.i(t2);
    }
    unsubscribeClick(t2) {
      this.Bg._(t2);
    }
    subscribeCrosshairMove(t2) {
      this.Ag.i(t2);
    }
    unsubscribeCrosshairMove(t2) {
      this.Ag._(t2);
    }
    subscribeDblClick(t2) {
      this.Ig.i(t2);
    }
    unsubscribeDblClick(t2) {
      this.Ig._(t2);
    }
    priceScale(t2, i2 = 0) {
      return new Vn(this.Ff, t2, i2);
    }
    timeScale() {
      return this.Ng;
    }
    applyOptions(t2) {
      this.Ff.hr(Nn(t2));
    }
    options() {
      return this.Ff.N();
    }
    takeScreenshot() {
      return this.Ff.hw();
    }
    addPane(t2 = false) {
      const i2 = this.Ff.Qt().Uc();
      return i2.zo(t2), this.$g(i2);
    }
    removePane(t2) {
      this.Ff.Qt().dc(t2);
    }
    swapPanes(t2, i2) {
      this.Ff.Qt().vc(t2, i2);
    }
    autoSizeActive() {
      return this.Ff.uw();
    }
    chartElement() {
      return this.Ff.tp();
    }
    panes() {
      return this.Ff.Qt().$s().map(((t2) => this.$g(t2)));
    }
    paneSize(t2 = 0) {
      const i2 = this.Ff.fw(t2);
      return { height: i2.height, width: i2.width };
    }
    setCrosshairPosition(t2, i2, s2) {
      const n2 = this.Eg.get(s2);
      if (void 0 === n2) return;
      const e2 = this.Ff.Qt().Hn(n2);
      null !== e2 && this.Ff.Qt().Tc(t2, i2, e2);
    }
    clearCrosshairPosition() {
      this.Ff.Qt().Rc(true);
    }
    horzBehaviour() {
      return this.Og;
    }
    Hg(i2, s2 = {}, n2 = 0) {
      r(void 0 !== i2.Wg), Ln(s2.priceFormat), "Candlestick" === i2.type && (function(t2) {
        void 0 !== t2.borderColor && (t2.borderUpColor = t2.borderColor, t2.borderDownColor = t2.borderColor), void 0 !== t2.wickColor && (t2.wickUpColor = t2.wickColor, t2.wickDownColor = t2.wickColor);
      })(s2);
      const e2 = _(p(t), p(i2.defaultOptions), s2), h2 = i2.Wg, a2 = new Ut(this.Ff.Qt(), i2.type, e2, h2, i2.Fg);
      this.Ff.Qt().Vc(a2, n2);
      const l2 = new zn(a2, this, this, this, this.Og, ((t2) => this.$g(t2)));
      return this.Eg.set(l2, a2), this.Vg.set(a2, l2), l2;
    }
    Ug(t2) {
      const i2 = this.Ff.Qt();
      i2.Dc(t2.It.ou, t2.It.Gw, t2.It.Jw), t2.Lo.forEach(((t3, i3) => i3.ht(t3.se, t3.Zw))), i2.It().Y_(), i2.pu();
    }
    jg(t2) {
      return h(this.Vg.get(t2));
    }
    Lg(t2) {
      const i2 = /* @__PURE__ */ new Map();
      t2.Rw.forEach(((t3, s3) => {
        const n2 = s3.Rr(), e2 = Cn(n2)(t3);
        if ("Custom" !== n2) r(js(e2));
        else {
          const t4 = s3.pa();
          r(!t4 || false === t4(e2));
        }
        i2.set(this.jg(s3), e2);
      }));
      const s2 = void 0 !== t2.Tw && this.Vg.has(t2.Tw) ? this.jg(t2.Tw) : void 0;
      return { time: t2.Pw, logical: t2.Re, point: t2.yw, paneIndex: t2.kw, hoveredSeries: s2, hoveredObjectId: t2.Dw, seriesData: i2, sourceEvent: t2.Ew };
    }
    $g(t2) {
      let i2 = this.$u.get(t2);
      return i2 || (i2 = new Bn(this.Ff, ((t3) => this.jg(t3)), t2, this), this.$u.set(t2, i2)), i2;
    }
  }
  function Fn(t2) {
    if (d(t2)) {
      const i2 = document.getElementById(t2);
      return r(null !== i2, "Cannot find element in DOM with id=".concat(t2)), i2;
    }
    return t2;
  }
  function Hn(t2, i2, s2) {
    const n2 = Fn(t2), e2 = new Wn(n2, i2, s2);
    return i2.setOptions(e2.options()), e2;
  }
  class Un extends un {
    constructor(t2, i2) {
      super(t2, i2, true);
    }
    ug(t2, i2, s2) {
      i2._u(this.sg, m(this.ng)), t2.$l(this.sg, s2, m(this.ng));
    }
    qg(t2, i2) {
      return { wt: t2, gt: i2, _t: NaN, ut: NaN };
    }
    og() {
      const t2 = this.Jn.Rh();
      this.sg = this.Jn.Xs().Hr().map(((i2) => {
        const s2 = i2.Ft[3];
        return this.Yg(i2.Re, s2, t2);
      }));
    }
  }
  function $n(t2, i2, s2, n2, e2, r2, h2) {
    if (0 === i2.length || n2.from >= i2.length || n2.to <= 0) return;
    const { context: a2, horizontalPixelRatio: l2, verticalPixelRatio: o2 } = t2, _2 = i2[n2.from];
    let u2 = r2(t2, _2), c2 = _2;
    if (n2.to - n2.from < 2) {
      const i3 = e2 / 2;
      a2.beginPath();
      const s3 = { _t: _2._t - i3, ut: _2.ut }, n3 = { _t: _2._t + i3, ut: _2.ut };
      a2.moveTo(s3._t * l2, s3.ut * o2), a2.lineTo(n3._t * l2, n3.ut * o2), h2(t2, u2, s3, n3);
    } else {
      const e3 = (i3, s3) => {
        h2(t2, u2, c2, s3), a2.beginPath(), u2 = i3, c2 = s3;
      };
      let d2 = c2;
      a2.beginPath(), a2.moveTo(_2._t * l2, _2.ut * o2);
      for (let h3 = n2.from + 1; h3 < n2.to; ++h3) {
        d2 = i2[h3];
        const n3 = r2(t2, d2);
        switch (s2) {
          case 0:
            a2.lineTo(d2._t * l2, d2.ut * o2);
            break;
          case 1:
            a2.lineTo(d2._t * l2, i2[h3 - 1].ut * o2), n3 !== u2 && (e3(n3, d2), a2.lineTo(d2._t * l2, i2[h3 - 1].ut * o2)), a2.lineTo(d2._t * l2, d2.ut * o2);
            break;
          case 2: {
            const [t3, s3] = Kn(i2, h3 - 1, h3);
            a2.bezierCurveTo(t3._t * l2, t3.ut * o2, s3._t * l2, s3.ut * o2, d2._t * l2, d2.ut * o2);
            break;
          }
        }
        1 !== s2 && n3 !== u2 && (e3(n3, d2), a2.moveTo(d2._t * l2, d2.ut * o2));
      }
      (c2 !== d2 || c2 === d2 && 1 === s2) && h2(t2, u2, c2, d2);
    }
  }
  const jn = 6;
  function qn(t2, i2) {
    return { _t: t2._t - i2._t, ut: t2.ut - i2.ut };
  }
  function Yn(t2, i2) {
    return { _t: t2._t / i2, ut: t2.ut / i2 };
  }
  function Kn(t2, i2, s2) {
    const n2 = Math.max(0, i2 - 1), e2 = Math.min(t2.length - 1, s2 + 1);
    var r2, h2;
    return [(r2 = t2[i2], h2 = Yn(qn(t2[s2], t2[n2]), jn), { _t: r2._t + h2._t, ut: r2.ut + h2.ut }), qn(t2[s2], Yn(qn(t2[e2], t2[i2]), jn))];
  }
  function Xn(t2, i2) {
    const s2 = t2.context;
    s2.strokeStyle = i2, s2.stroke();
  }
  class Zn extends P {
    constructor() {
      super(...arguments), this.rt = null;
    }
    ht(t2) {
      this.rt = t2;
    }
    et(t2) {
      if (null === this.rt) return;
      const { ot: i2, lt: s2, Kg: e2, Xg: r2, ct: h2, Xt: a2, Zg: l2 } = this.rt;
      if (null === s2) return;
      const o2 = t2.context;
      o2.lineCap = "butt", o2.lineWidth = h2 * t2.verticalPixelRatio, n(o2, a2), o2.lineJoin = "round";
      const _2 = this.Gg.bind(this);
      void 0 !== r2 && $n(t2, i2, r2, s2, e2, _2, Xn), l2 && (function(t3, i3, s3, n2, e3) {
        if (n2.to - n2.from <= 0) return;
        const { horizontalPixelRatio: r3, verticalPixelRatio: h3, context: a3 } = t3;
        let l3 = null;
        const o3 = Math.max(1, Math.floor(r3)) % 2 / 2, _3 = s3 * h3 + o3;
        for (let s4 = n2.to - 1; s4 >= n2.from; --s4) {
          const n3 = i3[s4];
          if (n3) {
            const i4 = e3(t3, n3);
            i4 !== l3 && (a3.beginPath(), null !== l3 && a3.fill(), a3.fillStyle = i4, l3 = i4);
            const s5 = Math.round(n3._t * r3) + o3, u2 = n3.ut * h3;
            a3.moveTo(s5, u2), a3.arc(s5, u2, _3, 0, 2 * Math.PI);
          }
        }
        a3.fill();
      })(t2, i2, l2, s2, _2);
    }
  }
  class Gn extends Zn {
    Gg(t2, i2) {
      return i2.vt;
    }
  }
  class Jn extends Un {
    constructor() {
      super(...arguments), this.hg = new Gn();
    }
    Yg(t2, i2, s2) {
      return { ...this.qg(t2, i2), ...s2.Dr(t2) };
    }
    cg() {
      const t2 = this.Jn.N(), i2 = { ot: this.sg, Xt: t2.lineStyle, Xg: t2.lineVisible ? t2.lineType : void 0, ct: t2.lineWidth, Zg: t2.pointMarkersVisible ? t2.pointMarkersRadius || t2.lineWidth / 2 + 2 : void 0, lt: this.ng, Kg: this.Qn.It().vu() };
      this.hg.ht(i2);
    }
  }
  const Qn = { type: "Line", isBuiltIn: true, defaultOptions: { color: "#2196f3", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, Wg: (t2, i2) => new Jn(t2, i2) };
  function te(t2, i2) {
    return t2.weight > i2.weight ? t2 : i2;
  }
  class ie {
    constructor() {
      this.Jg = new o(), this.Qg = /* @__PURE__ */ (function(t2) {
        let i2 = false;
        return function(...s2) {
          i2 || (i2 = true, queueMicrotask((() => {
            t2(...s2), i2 = false;
          })));
        };
      })((() => this.Jg.p(this.tM))), this.tM = 0;
    }
    iM() {
      return this.Jg;
    }
    m() {
      this.Jg.m();
    }
    options() {
      return this.Ps;
    }
    setOptions(t2) {
      this.Ps = t2;
    }
    preprocessData(t2) {
    }
    updateFormatter(t2) {
      this.Ps && (this.Ps.localization = t2);
    }
    createConverterToInternalObj(t2) {
      return this.Qg(), (t3) => (t3 > this.tM && (this.tM = t3), t3);
    }
    key(t2) {
      return t2;
    }
    cacheKey(t2) {
      return t2;
    }
    convertHorzItemToInternal(t2) {
      return t2;
    }
    formatHorzItem(t2) {
      return this.sM(t2);
    }
    formatTickmark(t2) {
      return this.sM(t2.time);
    }
    maxTickMarkWeight(t2) {
      return t2.reduce(te, t2[0]).weight;
    }
    fillWeightsForPoints(t2, i2) {
      for (let n2 = i2; n2 < t2.length; ++n2) t2[n2].timeWeight = (s2 = t2[n2].time) % 120 == 0 ? 10 : s2 % 60 == 0 ? 9 : s2 % 36 == 0 ? 8 : s2 % 12 == 0 ? 7 : s2 % 6 == 0 ? 6 : s2 % 3 == 0 ? 5 : s2 % 1 == 0 ? 4 : 0;
      var s2;
      this.tM = t2[t2.length - 1].time, this.Qg();
    }
    sM(t2) {
      var _a2;
      if ((_a2 = this.Ps.localization) == null ? void 0 : _a2.timeFormatter) return this.Ps.localization.timeFormatter(t2);
      if (t2 < 12) return "".concat(t2, "M");
      const i2 = Math.floor(t2 / 12), s2 = t2 % 12;
      return 0 === s2 ? "".concat(i2, "Y") : "".concat(i2, "Y").concat(s2, "M");
    }
  }
  const se = { yieldCurve: { baseResolution: 1, minimumTimeRange: 120, startTimeRange: 0 }, timeScale: { ignoreWhitespaceIndices: true }, leftPriceScale: { visible: true }, rightPriceScale: { visible: false }, localization: { priceFormatter: (t2) => t2.toFixed(3) + "%" } }, ne = { lastValueVisible: false, priceLineVisible: false };
  class ee extends Wn {
    constructor(t2, i2) {
      const s2 = _(se, i2 || {}), n2 = new ie();
      super(t2, n2, s2), n2.setOptions(this.options()), this._initWhitespaceSeries();
    }
    addSeries(t2, i2 = {}, s2 = 0) {
      if (t2.isBuiltIn && false === ["Area", "Line"].includes(t2.type)) throw new Error("Yield curve only support Area and Line series");
      const n2 = { ...ne, ...i2 };
      return super.addSeries(t2, n2, s2);
    }
    _initWhitespaceSeries() {
      const t2 = this.horzBehaviour(), i2 = this.addSeries(Qn);
      let s2;
      function n2(n3) {
        const e2 = (function(t3, i3) {
          return { le: Math.max(0, t3.startTimeRange), oe: Math.max(0, t3.minimumTimeRange, i3 || 0), nM: Math.max(1, t3.baseResolution) };
        })(t2.options().yieldCurve, n3), r2 = (({ le: t3, oe: i3, nM: s3 }) => "".concat(t3, "~").concat(i3, "~").concat(s3))(e2);
        r2 !== s2 && (s2 = r2, i2.setData((function({ le: t3, oe: i3, nM: s3 }) {
          return Array.from({ length: Math.floor((i3 - t3) / s3) + 1 }, ((i4, n4) => ({ time: t3 + n4 * s3 })));
        })(e2)));
      }
      n2(0), t2.iM().i(n2);
    }
  }
  function re(t2, i2) {
    return t2.weight > i2.weight ? t2 : i2;
  }
  class he {
    options() {
      return this.Ps;
    }
    setOptions(t2) {
      this.Ps = t2;
    }
    preprocessData(t2) {
    }
    updateFormatter(t2) {
      this.Ps && (this.Ps.localization = t2);
    }
    createConverterToInternalObj(t2) {
      return (t3) => t3;
    }
    key(t2) {
      return t2;
    }
    cacheKey(t2) {
      return t2;
    }
    convertHorzItemToInternal(t2) {
      return t2;
    }
    formatHorzItem(t2) {
      return t2.toFixed(this.Cn());
    }
    formatTickmark(t2, i2) {
      return t2.time.toFixed(this.Cn());
    }
    maxTickMarkWeight(t2) {
      return t2.reduce(re, t2[0]).weight;
    }
    fillWeightsForPoints(t2, i2) {
      for (let n2 = i2; n2 < t2.length; ++n2) t2[n2].timeWeight = (s2 = t2[n2].time) === 100 * Math.ceil(s2 / 100) ? 8 : s2 === 50 * Math.ceil(s2 / 50) ? 7 : s2 === 25 * Math.ceil(s2 / 25) ? 6 : s2 === 10 * Math.ceil(s2 / 10) ? 5 : s2 === 5 * Math.ceil(s2 / 5) ? 4 : s2 === Math.ceil(s2) ? 3 : 2 * s2 === Math.ceil(2 * s2) ? 1 : 0;
      var s2;
    }
    Cn() {
      return this.Ps.localization.precision;
    }
  }
  function ae(t2, i2, s2, n2, e2) {
    const { context: r2, horizontalPixelRatio: h2, verticalPixelRatio: a2 } = i2;
    r2.lineTo(e2._t * h2, t2 * a2), r2.lineTo(n2._t * h2, t2 * a2), r2.closePath(), r2.fillStyle = s2, r2.fill();
  }
  class le extends P {
    constructor() {
      super(...arguments), this.rt = null;
    }
    ht(t2) {
      this.rt = t2;
    }
    et(t2) {
      var _a2;
      if (null === this.rt) return;
      const { ot: i2, lt: s2, Kg: e2, ct: r2, Xt: h2, Xg: a2 } = this.rt, l2 = (_a2 = this.rt.eM) != null ? _a2 : this.rt.rM ? 0 : t2.mediaSize.height;
      if (null === s2) return;
      const o2 = t2.context;
      o2.lineCap = "butt", o2.lineJoin = "round", o2.lineWidth = r2, n(o2, h2), o2.lineWidth = 1, $n(t2, i2, a2, s2, e2, this.hM.bind(this), ae.bind(null, l2));
    }
  }
  class oe {
    aM(t2, i2) {
      const s2 = this.lM, { oM: n2, _M: e2, uM: r2, cM: h2, eM: a2, dM: l2, fM: o2 } = i2;
      if (void 0 === this.pM || void 0 === s2 || s2.oM !== n2 || s2._M !== e2 || s2.uM !== r2 || s2.cM !== h2 || s2.eM !== a2 || s2.dM !== l2 || s2.fM !== o2) {
        const { verticalPixelRatio: s3 } = t2, _2 = a2 || l2 > 0 ? s3 : 1, u2 = l2 * _2, c2 = o2 === t2.bitmapSize.height ? o2 : o2 * _2, d2 = (a2 != null ? a2 : 0) * _2, f2 = t2.context.createLinearGradient(0, u2, 0, c2);
        if (f2.addColorStop(0, n2), null != a2) {
          const t3 = Yt((d2 - u2) / (c2 - u2), 0, 1);
          f2.addColorStop(t3, e2), f2.addColorStop(t3, r2);
        }
        f2.addColorStop(1, h2), this.pM = f2, this.lM = i2;
      }
      return this.pM;
    }
  }
  class _e extends le {
    constructor() {
      super(...arguments), this.vM = new oe();
    }
    hM(t2, i2) {
      var _a2, _b;
      const s2 = this.rt;
      return this.vM.aM(t2, { oM: i2.br, _M: i2.Sr, uM: i2.Cr, cM: i2.Pr, eM: s2.eM, dM: (_a2 = s2.dM) != null ? _a2 : 0, fM: (_b = s2.fM) != null ? _b : t2.bitmapSize.height });
    }
  }
  class ue extends Zn {
    constructor() {
      super(...arguments), this.mM = new oe();
    }
    Gg(t2, i2) {
      var _a2, _b;
      const s2 = this.rt;
      return this.mM.aM(t2, { oM: i2.gr, _M: i2.gr, uM: i2.Mr, cM: i2.Mr, eM: s2.eM, dM: (_a2 = s2.dM) != null ? _a2 : 0, fM: (_b = s2.fM) != null ? _b : t2.bitmapSize.height });
    }
  }
  class ce extends Un {
    constructor(t2, i2) {
      super(t2, i2), this.hg = new C(), this.wM = new _e(), this.gM = new ue(), this.hg.st([this.wM, this.gM]);
    }
    Yg(t2, i2, s2) {
      return { ...this.qg(t2, i2), ...s2.Dr(t2) };
    }
    cg() {
      const t2 = this.Jn.zt();
      if (null === t2) return;
      const i2 = this.Jn.N(), s2 = this.Jn.Wt().Nt(i2.baseValue.price, t2.Ft), n2 = this.Qn.It().vu();
      if (null === this.ng || 0 === this.sg.length) return;
      let e2, r2;
      if (i2.relativeGradient) {
        e2 = this.sg[this.ng.from].ut, r2 = this.sg[this.ng.from].ut;
        for (let t3 = this.ng.from; t3 < this.ng.to; t3++) {
          const i3 = this.sg[t3];
          i3.ut < e2 && (e2 = i3.ut), i3.ut > r2 && (r2 = i3.ut);
        }
      }
      this.wM.ht({ ot: this.sg, ct: i2.lineWidth, Xt: i2.lineStyle, Xg: i2.lineType, eM: s2, dM: e2, fM: r2, rM: false, lt: this.ng, Kg: n2 }), this.gM.ht({ ot: this.sg, ct: i2.lineWidth, Xt: i2.lineStyle, Xg: i2.lineVisible ? i2.lineType : void 0, Zg: i2.pointMarkersVisible ? i2.pointMarkersRadius || i2.lineWidth / 2 + 2 : void 0, eM: s2, dM: e2, fM: r2, lt: this.ng, Kg: n2 });
    }
  }
  const de = { type: "Baseline", isBuiltIn: true, defaultOptions: { baseValue: { type: "price", price: 0 }, relativeGradient: false, topFillColor1: "rgba(38, 166, 154, 0.28)", topFillColor2: "rgba(38, 166, 154, 0.05)", topLineColor: "rgba(38, 166, 154, 1)", bottomFillColor1: "rgba(239, 83, 80, 0.05)", bottomFillColor2: "rgba(239, 83, 80, 0.28)", bottomLineColor: "rgba(239, 83, 80, 1)", lineWidth: 3, lineStyle: 0, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, Wg: (t2, i2) => new ce(t2, i2) };
  class fe extends le {
    constructor() {
      super(...arguments), this.vM = new oe();
    }
    hM(t2, i2) {
      var _a2, _b;
      return this.vM.aM(t2, { oM: i2.mr, _M: "", uM: "", cM: i2.wr, dM: (_b = (_a2 = this.rt) == null ? void 0 : _a2.dM) != null ? _b : 0, fM: t2.bitmapSize.height });
    }
  }
  class pe extends Un {
    constructor(t2, i2) {
      super(t2, i2), this.hg = new C(), this.MM = new fe(), this.bM = new Gn(), this.hg.st([this.MM, this.bM]);
    }
    Yg(t2, i2, s2) {
      return { ...this.qg(t2, i2), ...s2.Dr(t2) };
    }
    cg() {
      const t2 = this.Jn.N();
      if (null === this.ng || 0 === this.sg.length) return;
      let i2;
      if (t2.relativeGradient) {
        i2 = this.sg[this.ng.from].ut;
        for (let t3 = this.ng.from; t3 < this.ng.to; t3++) {
          const s2 = this.sg[t3];
          s2.ut < i2 && (i2 = s2.ut);
        }
      }
      this.MM.ht({ Xg: t2.lineType, ot: this.sg, Xt: t2.lineStyle, ct: t2.lineWidth, eM: null, dM: i2, rM: t2.invertFilledArea, lt: this.ng, Kg: this.Qn.It().vu() }), this.bM.ht({ Xg: t2.lineVisible ? t2.lineType : void 0, ot: this.sg, Xt: t2.lineStyle, ct: t2.lineWidth, lt: this.ng, Kg: this.Qn.It().vu(), Zg: t2.pointMarkersVisible ? t2.pointMarkersRadius || t2.lineWidth / 2 + 2 : void 0 });
    }
  }
  const ve = { type: "Area", isBuiltIn: true, defaultOptions: { topColor: "rgba( 46, 220, 135, 0.4)", bottomColor: "rgba( 40, 221, 100, 0)", invertFilledArea: false, relativeGradient: false, lineColor: "#33D778", lineStyle: 0, lineWidth: 3, lineType: 0, lineVisible: true, crosshairMarkerVisible: true, crosshairMarkerRadius: 4, crosshairMarkerBorderColor: "", crosshairMarkerBorderWidth: 2, crosshairMarkerBackgroundColor: "", lastPriceAnimation: 0, pointMarkersVisible: false }, Wg: (t2, i2) => new pe(t2, i2) };
  class me extends P {
    constructor() {
      super(...arguments), this.qt = null, this.xM = 0, this.SM = 0;
    }
    ht(t2) {
      this.qt = t2;
    }
    et({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) {
      if (null === this.qt || 0 === this.qt.Xs.length || null === this.qt.lt) return;
      if (this.xM = this.CM(i2), this.xM >= 2) {
        Math.max(1, Math.floor(i2)) % 2 != this.xM % 2 && this.xM--;
      }
      this.SM = this.qt.PM ? Math.min(this.xM, Math.floor(i2)) : this.xM;
      let n2 = null;
      const e2 = this.SM <= this.xM && this.qt.vu >= Math.floor(1.5 * i2);
      for (let r2 = this.qt.lt.from; r2 < this.qt.lt.to; ++r2) {
        const h2 = this.qt.Xs[r2];
        n2 !== h2.cr && (t2.fillStyle = h2.cr, n2 = h2.cr);
        const a2 = Math.floor(0.5 * this.SM), l2 = Math.round(h2._t * i2), o2 = l2 - a2, _2 = this.SM, u2 = o2 + _2 - 1, c2 = Math.min(h2.Kl, h2.Xl), d2 = Math.max(h2.Kl, h2.Xl), f2 = Math.round(c2 * s2) - a2, p2 = Math.round(d2 * s2) + a2, v2 = Math.max(p2 - f2, this.SM);
        t2.fillRect(o2, f2, _2, v2);
        const m2 = Math.ceil(1.5 * this.xM);
        if (e2) {
          if (this.qt.yM) {
            const i4 = l2 - m2;
            let n4 = Math.max(f2, Math.round(h2.Yl * s2) - a2), e4 = n4 + _2 - 1;
            e4 > f2 + v2 - 1 && (e4 = f2 + v2 - 1, n4 = e4 - _2 + 1), t2.fillRect(i4, n4, o2 - i4, e4 - n4 + 1);
          }
          const i3 = l2 + m2;
          let n3 = Math.max(f2, Math.round(h2.Zl * s2) - a2), e3 = n3 + _2 - 1;
          e3 > f2 + v2 - 1 && (e3 = f2 + v2 - 1, n3 = e3 - _2 + 1), t2.fillRect(u2 + 1, n3, i3 - u2, e3 - n3 + 1);
        }
      }
    }
    CM(t2) {
      const i2 = Math.floor(t2);
      return Math.max(i2, Math.floor((function(t3, i3) {
        return Math.floor(0.3 * t3 * i3);
      })(a(this.qt).vu, t2)));
    }
  }
  class we extends un {
    constructor(t2, i2) {
      super(t2, i2, false);
    }
    ug(t2, i2, s2) {
      i2._u(this.sg, m(this.ng)), t2.ql(this.sg, s2, m(this.ng));
    }
    kM(t2, i2, s2) {
      return { wt: t2, jh: i2.Ft[0], qh: i2.Ft[1], Yh: i2.Ft[2], Kh: i2.Ft[3], _t: NaN, Yl: NaN, Kl: NaN, Xl: NaN, Zl: NaN };
    }
    og() {
      const t2 = this.Jn.Rh();
      this.sg = this.Jn.Xs().Hr().map(((i2) => this.Yg(i2.Re, i2, t2)));
    }
  }
  class ge extends we {
    constructor() {
      super(...arguments), this.hg = new me();
    }
    Yg(t2, i2, s2) {
      return { ...this.kM(t2, i2, s2), ...s2.Dr(t2) };
    }
    cg() {
      const t2 = this.Jn.N();
      this.hg.ht({ Xs: this.sg, vu: this.Qn.It().vu(), yM: t2.openVisible, PM: t2.thinBars, lt: this.ng });
    }
  }
  const Me = { type: "Bar", isBuiltIn: true, defaultOptions: { upColor: "#26a69a", downColor: "#ef5350", openVisible: true, thinBars: true }, Wg: (t2, i2) => new ge(t2, i2) };
  class be extends P {
    constructor() {
      super(...arguments), this.qt = null, this.xM = 0;
    }
    ht(t2) {
      this.qt = t2;
    }
    et(t2) {
      if (null === this.qt || 0 === this.qt.Xs.length || null === this.qt.lt) return;
      const { horizontalPixelRatio: i2 } = t2;
      if (this.xM = (function(t3, i3) {
        if (t3 >= 2.5 && t3 <= 4) return Math.floor(3 * i3);
        const s3 = 1 - 0.2 * Math.atan(Math.max(4, t3) - 4) / (0.5 * Math.PI), n3 = Math.floor(t3 * s3 * i3), e2 = Math.floor(t3 * i3), r2 = Math.min(n3, e2);
        return Math.max(Math.floor(i3), r2);
      })(this.qt.vu, i2), this.xM >= 2) {
        Math.floor(i2) % 2 != this.xM % 2 && this.xM--;
      }
      const s2 = this.qt.Xs;
      this.qt.TM && this.RM(t2, s2, this.qt.lt), this.qt.Mi && this._v(t2, s2, this.qt.lt);
      const n2 = this.DM(i2);
      (!this.qt.Mi || this.xM > 2 * n2) && this.EM(t2, s2, this.qt.lt);
    }
    RM(t2, i2, s2) {
      if (null === this.qt) return;
      const { context: n2, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t2;
      let h2 = "", a2 = Math.min(Math.floor(e2), Math.floor(this.qt.vu * e2));
      a2 = Math.max(Math.floor(e2), Math.min(a2, this.xM));
      const l2 = Math.floor(0.5 * a2);
      let o2 = null;
      for (let t3 = s2.from; t3 < s2.to; t3++) {
        const s3 = i2[t3];
        s3.pr !== h2 && (n2.fillStyle = s3.pr, h2 = s3.pr);
        const _2 = Math.round(Math.min(s3.Yl, s3.Zl) * r2), u2 = Math.round(Math.max(s3.Yl, s3.Zl) * r2), c2 = Math.round(s3.Kl * r2), d2 = Math.round(s3.Xl * r2);
        let f2 = Math.round(e2 * s3._t) - l2;
        const p2 = f2 + a2 - 1;
        null !== o2 && (f2 = Math.max(o2 + 1, f2), f2 = Math.min(f2, p2));
        const v2 = p2 - f2 + 1;
        n2.fillRect(f2, c2, v2, _2 - c2), n2.fillRect(f2, u2 + 1, v2, d2 - u2), o2 = p2;
      }
    }
    DM(t2) {
      let i2 = Math.floor(1 * t2);
      this.xM <= 2 * i2 && (i2 = Math.floor(0.5 * (this.xM - 1)));
      const s2 = Math.max(Math.floor(t2), i2);
      return this.xM <= 2 * s2 ? Math.max(Math.floor(t2), Math.floor(1 * t2)) : s2;
    }
    _v(t2, i2, s2) {
      if (null === this.qt) return;
      const { context: n2, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t2;
      let h2 = "";
      const a2 = this.DM(e2);
      let l2 = null;
      for (let t3 = s2.from; t3 < s2.to; t3++) {
        const s3 = i2[t3];
        s3.dr !== h2 && (n2.fillStyle = s3.dr, h2 = s3.dr);
        let o2 = Math.round(s3._t * e2) - Math.floor(0.5 * this.xM);
        const _2 = o2 + this.xM - 1, u2 = Math.round(Math.min(s3.Yl, s3.Zl) * r2), c2 = Math.round(Math.max(s3.Yl, s3.Zl) * r2);
        if (null !== l2 && (o2 = Math.max(l2 + 1, o2), o2 = Math.min(o2, _2)), this.qt.vu * e2 > 2 * a2) V(n2, o2, u2, _2 - o2 + 1, c2 - u2 + 1, a2);
        else {
          const t4 = _2 - o2 + 1;
          n2.fillRect(o2, u2, t4, c2 - u2 + 1);
        }
        l2 = _2;
      }
    }
    EM(t2, i2, s2) {
      if (null === this.qt) return;
      const { context: n2, horizontalPixelRatio: e2, verticalPixelRatio: r2 } = t2;
      let h2 = "";
      const a2 = this.DM(e2);
      for (let t3 = s2.from; t3 < s2.to; t3++) {
        const s3 = i2[t3];
        let l2 = Math.round(Math.min(s3.Yl, s3.Zl) * r2), o2 = Math.round(Math.max(s3.Yl, s3.Zl) * r2), _2 = Math.round(s3._t * e2) - Math.floor(0.5 * this.xM), u2 = _2 + this.xM - 1;
        if (s3.cr !== h2) {
          const t4 = s3.cr;
          n2.fillStyle = t4, h2 = t4;
        }
        this.qt.Mi && (_2 += a2, l2 += a2, u2 -= a2, o2 -= a2), l2 > o2 || n2.fillRect(_2, l2, u2 - _2 + 1, o2 - l2 + 1);
      }
    }
  }
  class xe extends we {
    constructor() {
      super(...arguments), this.hg = new be();
    }
    Yg(t2, i2, s2) {
      return { ...this.kM(t2, i2, s2), ...s2.Dr(t2) };
    }
    cg() {
      const t2 = this.Jn.N();
      this.hg.ht({ Xs: this.sg, vu: this.Qn.It().vu(), TM: t2.wickVisible, Mi: t2.borderVisible, lt: this.ng });
    }
  }
  const Se = { type: "Candlestick", isBuiltIn: true, defaultOptions: { upColor: "#26a69a", downColor: "#ef5350", wickVisible: true, borderVisible: true, borderColor: "#378658", borderUpColor: "#26a69a", borderDownColor: "#ef5350", wickColor: "#737375", wickUpColor: "#26a69a", wickDownColor: "#ef5350" }, Wg: (t2, i2) => new xe(t2, i2) };
  class Ce extends P {
    constructor() {
      super(...arguments), this.qt = null, this.VM = [];
    }
    ht(t2) {
      this.qt = t2, this.VM = [];
    }
    et({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) {
      if (null === this.qt || 0 === this.qt.ot.length || null === this.qt.lt) return;
      this.VM.length || this.BM(i2);
      const n2 = Math.max(1, Math.floor(s2)), e2 = Math.round(this.qt.IM * s2) - Math.floor(n2 / 2), r2 = e2 + n2;
      for (let i3 = this.qt.lt.from; i3 < this.qt.lt.to; i3++) {
        const h2 = this.qt.ot[i3], a2 = this.VM[i3 - this.qt.lt.from], l2 = Math.round(h2.ut * s2);
        let o2, _2;
        t2.fillStyle = h2.cr, l2 <= e2 ? (o2 = l2, _2 = r2) : (o2 = e2, _2 = l2 - Math.floor(n2 / 2) + n2), t2.fillRect(a2.Uh, o2, a2.bi - a2.Uh + 1, _2 - o2);
      }
    }
    BM(t2) {
      if (null === this.qt || 0 === this.qt.ot.length || null === this.qt.lt) return void (this.VM = []);
      const i2 = Math.ceil(this.qt.vu * t2) <= 1 ? 0 : Math.max(1, Math.floor(t2)), s2 = Math.round(this.qt.vu * t2) - i2;
      this.VM = new Array(this.qt.lt.to - this.qt.lt.from);
      for (let i3 = this.qt.lt.from; i3 < this.qt.lt.to; i3++) {
        const n3 = this.qt.ot[i3], e2 = Math.round(n3._t * t2);
        let r2, h2;
        if (s2 % 2) {
          const t3 = (s2 - 1) / 2;
          r2 = e2 - t3, h2 = e2 + t3;
        } else {
          const t3 = s2 / 2;
          r2 = e2 - t3, h2 = e2 + t3 - 1;
        }
        this.VM[i3 - this.qt.lt.from] = { Uh: r2, bi: h2, AM: e2, ne: n3._t * t2, wt: n3.wt };
      }
      for (let t3 = this.qt.lt.from + 1; t3 < this.qt.lt.to; t3++) {
        const s3 = this.VM[t3 - this.qt.lt.from], n3 = this.VM[t3 - this.qt.lt.from - 1];
        s3.wt === n3.wt + 1 && (s3.Uh - n3.bi !== i2 + 1 && (n3.AM > n3.ne ? n3.bi = s3.Uh - i2 - 1 : s3.Uh = n3.bi + i2 + 1));
      }
      let n2 = Math.ceil(this.qt.vu * t2);
      for (let t3 = this.qt.lt.from; t3 < this.qt.lt.to; t3++) {
        const i3 = this.VM[t3 - this.qt.lt.from];
        i3.bi < i3.Uh && (i3.bi = i3.Uh);
        const s3 = i3.bi - i3.Uh + 1;
        n2 = Math.min(s3, n2);
      }
      if (i2 > 0 && n2 < 4) for (let t3 = this.qt.lt.from; t3 < this.qt.lt.to; t3++) {
        const i3 = this.VM[t3 - this.qt.lt.from];
        i3.bi - i3.Uh + 1 > n2 && (i3.AM > i3.ne ? i3.bi -= 1 : i3.Uh += 1);
      }
    }
  }
  class Pe extends Un {
    constructor() {
      super(...arguments), this.hg = new Ce();
    }
    Yg(t2, i2, s2) {
      return { ...this.qg(t2, i2), ...s2.Dr(t2) };
    }
    cg() {
      const t2 = { ot: this.sg, vu: this.Qn.It().vu(), lt: this.ng, IM: this.Jn.Wt().Nt(this.Jn.N().base, a(this.Jn.zt()).Ft) };
      this.hg.ht(t2);
    }
  }
  const ye = { type: "Histogram", isBuiltIn: true, defaultOptions: { color: "#26a69a", base: 0 }, Wg: (t2, i2) => new Pe(t2, i2) };
  class ke {
    constructor(t2, i2) {
      this.Pt = t2, this.zM = i2, this.OM();
    }
    detach() {
      this.Pt.detachPrimitive(this.zM);
    }
    getPane() {
      return this.Pt;
    }
    applyOptions(t2) {
      var _a2, _b;
      (_b = (_a2 = this.zM).hr) == null ? void 0 : _b.call(_a2, t2);
    }
    OM() {
      this.Pt.attachPrimitive(this.zM);
    }
  }
  const Te = { visible: true, horzAlign: "center", vertAlign: "center", lines: [] }, Re = { color: "rgba(0, 0, 0, 0.5)", fontSize: 48, fontFamily: w, fontStyle: "", text: "" };
  class De {
    constructor(t2) {
      this.LM = /* @__PURE__ */ new Map(), this.qt = t2;
    }
    draw(t2) {
      t2.useMediaCoordinateSpace(((t3) => {
        if (!this.qt.visible) return;
        const { context: i2, mediaSize: s2 } = t3;
        let n2 = 0;
        for (const t4 of this.qt.lines) {
          if (0 === t4.text.length) continue;
          i2.font = t4.k;
          const e3 = this.NM(i2, t4.text);
          e3 > s2.width ? t4.Su = s2.width / e3 : t4.Su = 1, n2 += t4.lineHeight * t4.Su;
        }
        let e2 = 0;
        switch (this.qt.vertAlign) {
          case "top":
            e2 = 0;
            break;
          case "center":
            e2 = Math.max((s2.height - n2) / 2, 0);
            break;
          case "bottom":
            e2 = Math.max(s2.height - n2, 0);
        }
        for (const t4 of this.qt.lines) {
          i2.save(), i2.fillStyle = t4.color;
          let n3 = 0;
          switch (this.qt.horzAlign) {
            case "left":
              i2.textAlign = "left", n3 = t4.lineHeight / 2;
              break;
            case "center":
              i2.textAlign = "center", n3 = s2.width / 2;
              break;
            case "right":
              i2.textAlign = "right", n3 = s2.width - 1 - t4.lineHeight / 2;
          }
          i2.translate(n3, e2), i2.textBaseline = "top", i2.font = t4.k, i2.scale(t4.Su, t4.Su), i2.fillText(t4.text, 0, t4.WM), i2.restore(), e2 += t4.lineHeight * t4.Su;
        }
      }));
    }
    NM(t2, i2) {
      const s2 = this.FM(t2.font);
      let n2 = s2.get(i2);
      return void 0 === n2 && (n2 = t2.measureText(i2).width, s2.set(i2, n2)), n2;
    }
    FM(t2) {
      let i2 = this.LM.get(t2);
      return void 0 === i2 && (i2 = /* @__PURE__ */ new Map(), this.LM.set(t2, i2)), i2;
    }
  }
  class Ee {
    constructor(t2) {
      this.Ps = Be(t2);
    }
    yt(t2) {
      this.Ps = Be(t2);
    }
    renderer() {
      return new De(this.Ps);
    }
  }
  function Ve(t2) {
    return { ...t2, k: g(t2.fontSize, t2.fontFamily, t2.fontStyle), lineHeight: t2.lineHeight || 1.2 * t2.fontSize, WM: 0, Su: 0 };
  }
  function Be(t2) {
    return { ...t2, lines: t2.lines.map(Ve) };
  }
  function Ie(t2) {
    return { ...Re, ...t2 };
  }
  function Ae(t2) {
    var _a2, _b;
    return { ...Te, ...t2, lines: (_b = (_a2 = t2.lines) == null ? void 0 : _a2.map(Ie)) != null ? _b : [] };
  }
  class ze {
    constructor(t2) {
      this.Ps = Ae(t2), this.HM = [new Ee(this.Ps)];
    }
    updateAllViews() {
      this.HM.forEach(((t2) => t2.yt(this.Ps)));
    }
    paneViews() {
      return this.HM;
    }
    attached({ requestUpdate: t2 }) {
      this.UM = t2;
    }
    detached() {
      this.UM = void 0;
    }
    hr(t2) {
      this.Ps = Ae({ ...this.Ps, ...t2 }), this.UM && this.UM();
    }
  }
  const Oe = { alpha: 1, padding: 0 };
  class Le {
    constructor(t2) {
      this.qt = t2;
    }
    draw(t2) {
      t2.useMediaCoordinateSpace(((t3) => {
        var _a2;
        const i2 = t3.context, s2 = this.$M(this.qt, t3.mediaSize);
        s2 && this.qt.jM && (i2.globalAlpha = (_a2 = this.qt.alpha) != null ? _a2 : 1, i2.drawImage(this.qt.jM, s2._t, s2.ut, s2.Qi, s2.$t));
      }));
    }
    $M(t2, i2) {
      const { maxHeight: s2, maxWidth: n2, qM: e2, YM: r2, padding: h2 } = t2, a2 = Math.round(i2.width / 2), l2 = Math.round(i2.height / 2), o2 = h2 != null ? h2 : 0;
      let _2 = i2.width - 2 * o2, u2 = i2.height - 2 * o2;
      s2 && (u2 = Math.min(u2, s2)), n2 && (_2 = Math.min(_2, n2));
      const c2 = _2 / r2, d2 = u2 / e2, f2 = Math.min(c2, d2), p2 = r2 * f2, v2 = e2 * f2;
      return { _t: a2 - 0.5 * p2, ut: l2 - 0.5 * v2, $t: v2, Qi: p2 };
    }
  }
  class Ne {
    constructor(t2) {
      this.KM = null, this.XM = 0, this.ZM = 0, this.Ps = t2, this.M = We(this.Ps, this.KM, this.XM, this.ZM);
    }
    GM(t2) {
      void 0 !== t2.JM && (this.XM = t2.JM), void 0 !== t2.QM && (this.ZM = t2.QM), void 0 !== t2.tb && (this.KM = t2.tb), this.yt();
    }
    ib(t2) {
      this.Ps = t2, this.yt();
    }
    zOrder() {
      return "bottom";
    }
    yt() {
      this.M = We(this.Ps, this.KM, this.XM, this.ZM);
    }
    renderer() {
      return new Le(this.M);
    }
  }
  function We(t2, i2, s2, n2) {
    return { ...t2, jM: i2, YM: s2, qM: n2 };
  }
  function Fe(t2) {
    return { ...Oe, ...t2 };
  }
  class He {
    constructor(t2, i2) {
      this.sb = null, this.nb = t2, this.Ps = Fe(i2), this.HM = [new Ne(this.Ps)];
    }
    updateAllViews() {
      this.HM.forEach(((t2) => t2.yt()));
    }
    paneViews() {
      return this.HM;
    }
    attached(t2) {
      const { requestUpdate: i2 } = t2;
      this.eb = i2, this.sb = new Image(), this.sb.onload = () => {
        var _a2, _b, _c, _d;
        const t3 = (_b = (_a2 = this.sb) == null ? void 0 : _a2.naturalHeight) != null ? _b : 1, i3 = (_d = (_c = this.sb) == null ? void 0 : _c.naturalWidth) != null ? _d : 1;
        this.HM.forEach(((s2) => s2.GM({ QM: t3, JM: i3, tb: this.sb }))), this.eb && this.eb();
      }, this.sb.src = this.nb;
    }
    detached() {
      this.eb = void 0, this.sb = null;
    }
    hr(t2) {
      this.Ps = Fe({ ...this.Ps, ...t2 }), this.rb(), this.UM && this.UM();
    }
    UM() {
      this.eb && this.eb();
    }
    rb() {
      this.HM.forEach(((t2) => t2.ib(this.Ps)));
    }
  }
  class Ue {
    constructor(t2, i2) {
      this.Jn = t2, this.ah = i2, this.OM();
    }
    detach() {
      this.Jn.detachPrimitive(this.ah);
    }
    getSeries() {
      return this.Jn;
    }
    applyOptions(t2) {
      this.ah && this.ah.hr && this.ah.hr(t2);
    }
    OM() {
      this.Jn.attachPrimitive(this.ah);
    }
  }
  const $e = { zOrder: "normal" };
  function je(t2, i2) {
    return Xt(Math.min(Math.max(t2, 12), 30) * i2);
  }
  function qe(t2, i2) {
    switch (t2) {
      case "arrowDown":
      case "arrowUp":
        return je(i2, 1);
      case "circle":
        return je(i2, 0.8);
      case "square":
        return je(i2, 0.7);
    }
  }
  function Ye(t2) {
    return (function(t3) {
      const i2 = Math.ceil(t3);
      return i2 % 2 != 0 ? i2 - 1 : i2;
    })(je(t2, 1));
  }
  function Ke(t2) {
    return Math.max(je(t2, 0.1), 3);
  }
  function Xe(t2, i2, s2) {
    return i2 ? t2 : s2 ? Math.ceil(t2 / 2) : 0;
  }
  function Ze(t2, i2, s2, n2) {
    const e2 = (qe("arrowUp", n2) - 1) / 2 * s2.hb, r2 = (Xt(n2 / 2) - 1) / 2 * s2.hb;
    i2.beginPath(), t2 ? (i2.moveTo(s2._t - e2, s2.ut), i2.lineTo(s2._t, s2.ut - e2), i2.lineTo(s2._t + e2, s2.ut), i2.lineTo(s2._t + r2, s2.ut), i2.lineTo(s2._t + r2, s2.ut + e2), i2.lineTo(s2._t - r2, s2.ut + e2), i2.lineTo(s2._t - r2, s2.ut)) : (i2.moveTo(s2._t - e2, s2.ut), i2.lineTo(s2._t, s2.ut + e2), i2.lineTo(s2._t + e2, s2.ut), i2.lineTo(s2._t + r2, s2.ut), i2.lineTo(s2._t + r2, s2.ut - e2), i2.lineTo(s2._t - r2, s2.ut - e2), i2.lineTo(s2._t - r2, s2.ut)), i2.fill();
  }
  function Ge(t2, i2, s2, n2, e2, r2) {
    const h2 = (qe("arrowUp", n2) - 1) / 2, a2 = (Xt(n2 / 2) - 1) / 2;
    if (e2 >= i2 - a2 - 2 && e2 <= i2 + a2 + 2 && r2 >= (t2 ? s2 : s2 - h2) - 2 && r2 <= (t2 ? s2 + h2 : s2) + 2) return true;
    return (() => {
      if (e2 < i2 - h2 - 3 || e2 > i2 + h2 + 3 || r2 < (t2 ? s2 - h2 - 3 : s2) || r2 > (t2 ? s2 : s2 + h2 + 3)) return false;
      const n3 = Math.abs(e2 - i2);
      return Math.abs(r2 - s2) + 3 >= n3 / 2;
    })();
  }
  class Je {
    constructor() {
      this.qt = null, this.Ln = new it(), this.W = -1, this.F = "", this.Wp = "", this.ab = "normal";
    }
    ht(t2) {
      this.qt = t2;
    }
    Nn(t2, i2, s2) {
      this.W === t2 && this.F === i2 || (this.W = t2, this.F = i2, this.Wp = g(t2, i2), this.Ln.Vn()), this.ab = s2;
    }
    Yn(t2, i2) {
      var _a2;
      if (null === this.qt || null === this.qt.lt) return null;
      for (let s2 = this.qt.lt.from; s2 < this.qt.lt.to; s2++) {
        const n2 = this.qt.ot[s2];
        if (n2 && tr(n2, t2, i2)) return { zOrder: "normal", externalId: (_a2 = n2.Kn) != null ? _a2 : "" };
      }
      return null;
    }
    draw(t2) {
      "aboveSeries" !== this.ab && t2.useBitmapCoordinateSpace(((t3) => {
        this.et(t3);
      }));
    }
    drawBackground(t2) {
      "aboveSeries" === this.ab && t2.useBitmapCoordinateSpace(((t3) => {
        this.et(t3);
      }));
    }
    et({ context: t2, horizontalPixelRatio: i2, verticalPixelRatio: s2 }) {
      if (null !== this.qt && null !== this.qt.lt) {
        t2.textBaseline = "middle", t2.font = this.Wp;
        for (let n2 = this.qt.lt.from; n2 < this.qt.lt.to; n2++) {
          const e2 = this.qt.ot[n2];
          void 0 !== e2.ri && (e2.ri.Qi = this.Ln.Ei(t2, e2.ri.lb), e2.ri.$t = this.W, e2.ri._t = e2._t - e2.ri.Qi / 2), Qe(e2, t2, i2, s2);
        }
      }
    }
  }
  function Qe(t2, i2, s2, n2) {
    i2.fillStyle = t2.R, void 0 !== t2.ri && (function(t3, i3, s3, n3, e2, r2) {
      t3.save(), t3.scale(e2, r2), t3.fillText(i3, s3, n3), t3.restore();
    })(i2, t2.ri.lb, t2.ri._t, t2.ri.ut, s2, n2), (function(t3, i3, s3) {
      if (0 === t3.zr) return;
      switch (t3.ob) {
        case "arrowDown":
          return void Ze(false, i3, s3, t3.zr);
        case "arrowUp":
          return void Ze(true, i3, s3, t3.zr);
        case "circle":
          return void (function(t4, i4, s4) {
            const n3 = (qe("circle", s4) - 1) / 2;
            t4.beginPath(), t4.arc(i4._t, i4.ut, n3 * i4.hb, 0, 2 * Math.PI, false), t4.fill();
          })(i3, s3, t3.zr);
        case "square":
          return void (function(t4, i4, s4) {
            const n3 = qe("square", s4), e2 = (n3 - 1) * i4.hb / 2, r2 = i4._t - e2, h2 = i4.ut - e2;
            t4.fillRect(r2, h2, n3 * i4.hb, n3 * i4.hb);
          })(i3, s3, t3.zr);
      }
      t3.ob;
    })(t2, i2, (function(t3, i3, s3) {
      const n3 = Math.max(1, Math.floor(i3)) % 2 / 2;
      return { _t: Math.round(t3._t * i3) + n3, ut: t3.ut * s3, hb: i3 };
    })(t2, s2, n2));
  }
  function tr(t2, i2, s2) {
    return !(void 0 === t2.ri || !(function(t3, i3, s3, n2, e2, r2) {
      const h2 = n2 / 2;
      return e2 >= t3 && e2 <= t3 + s3 && r2 >= i3 - h2 && r2 <= i3 + h2;
    })(t2.ri._t, t2.ri.ut, t2.ri.Qi, t2.ri.$t, i2, s2)) || (function(t3, i3, s3) {
      if (0 === t3.zr) return false;
      switch (t3.ob) {
        case "arrowDown":
          return Ge(true, t3._t, t3.ut, t3.zr, i3, s3);
        case "arrowUp":
          return Ge(false, t3._t, t3.ut, t3.zr, i3, s3);
        case "circle":
          return (function(t4, i4, s4, n2, e2) {
            const r2 = 2 + qe("circle", s4) / 2, h2 = t4 - n2, a2 = i4 - e2;
            return Math.sqrt(h2 * h2 + a2 * a2) <= r2;
          })(t3._t, t3.ut, t3.zr, i3, s3);
        case "square":
          return (function(t4, i4, s4, n2, e2) {
            const r2 = qe("square", s4), h2 = (r2 - 1) / 2, a2 = t4 - h2, l2 = i4 - h2;
            return n2 >= a2 && n2 <= a2 + r2 && e2 >= l2 && e2 <= l2 + r2;
          })(t3._t, t3.ut, t3.zr, i3, s3);
      }
    })(t2, i2, s2);
  }
  function ir(t2) {
    return "atPriceTop" === t2 || "atPriceBottom" === t2 || "atPriceMiddle" === t2;
  }
  function sr(t2, i2, s2, n2, e2, r2, h2, l2) {
    const o2 = (function(t3, i3) {
      if (ir(i3.position) && void 0 !== i3.price) return i3.price;
      if ("value" in (s3 = t3) && "number" == typeof s3.value) return t3.value;
      var s3;
      if ((function(t4) {
        return "open" in t4 && "high" in t4 && "low" in t4 && "close" in t4;
      })(t3)) {
        if ("inBar" === i3.position) return t3.close;
        if ("aboveBar" === i3.position) return t3.high;
        if ("belowBar" === i3.position) return t3.low;
      }
    })(s2, i2);
    if (void 0 === o2) return;
    const _2 = ir(i2.position), c2 = l2.timeScale(), d2 = u(i2.size) ? Math.max(i2.size, 0) : 1, f2 = Ye(c2.options().barSpacing) * d2, p2 = f2 / 2;
    t2.zr = f2;
    switch (i2.position) {
      case "inBar":
      case "atPriceMiddle":
        return t2.ut = a(h2.priceToCoordinate(o2)), void (void 0 !== t2.ri && (t2.ri.ut = t2.ut + p2 + r2 + 0.6 * e2));
      case "aboveBar":
      case "atPriceTop": {
        const i3 = _2 ? 0 : n2._b;
        return t2.ut = a(h2.priceToCoordinate(o2)) - p2 - i3, void 0 !== t2.ri && (t2.ri.ut = t2.ut - p2 - 0.6 * e2, n2._b += 1.2 * e2), void (_2 || (n2._b += f2 + r2));
      }
      case "belowBar":
      case "atPriceBottom": {
        const i3 = _2 ? 0 : n2.ub;
        return t2.ut = a(h2.priceToCoordinate(o2)) + p2 + i3, void 0 !== t2.ri && (t2.ri.ut = t2.ut + p2 + r2 + 0.6 * e2, n2.ub += 1.2 * e2), void (_2 || (n2.ub += f2 + r2));
      }
    }
  }
  class nr {
    constructor(t2, i2, s2) {
      this.cb = [], this.St = true, this.fb = true, this.Gt = new Je(), this.ge = t2, this.Dp = i2, this.qt = { ot: [], lt: null }, this.Ps = s2;
    }
    renderer() {
      if (!this.ge.options().visible) return null;
      this.St && this.pb();
      const t2 = this.Dp.options().layout;
      return this.Gt.Nn(t2.fontSize, t2.fontFamily, this.Ps.zOrder), this.Gt.ht(this.qt), this.Gt;
    }
    mb(t2) {
      this.cb = t2, this.yt("data");
    }
    yt(t2) {
      this.St = true, "data" === t2 && (this.fb = true);
    }
    wb(t2) {
      this.St = true, this.Ps = t2;
    }
    zOrder() {
      return "aboveSeries" === this.Ps.zOrder ? "top" : this.Ps.zOrder;
    }
    pb() {
      const t2 = this.Dp.timeScale(), i2 = this.cb;
      this.fb && (this.qt.ot = i2.map(((t3) => ({ wt: t3.time, _t: 0, ut: 0, zr: 0, ob: t3.shape, R: t3.color, Kn: t3.id, gb: t3.gb, ri: void 0 }))), this.fb = false);
      const s2 = this.Dp.options().layout;
      this.qt.lt = null;
      const n2 = t2.getVisibleLogicalRange();
      if (null === n2) return;
      const e2 = new Si(Math.floor(n2.from), Math.ceil(n2.to));
      if (null === this.ge.data()[0]) return;
      if (0 === this.qt.ot.length) return;
      let r2 = NaN;
      const h2 = Ke(t2.options().barSpacing), l2 = { _b: h2, ub: h2 };
      this.qt.lt = _n(this.qt.ot, e2, true);
      for (let n3 = this.qt.lt.from; n3 < this.qt.lt.to; n3++) {
        const e3 = i2[n3];
        e3.time !== r2 && (l2._b = h2, l2.ub = h2, r2 = e3.time);
        const o2 = this.qt.ot[n3];
        o2._t = a(t2.logicalToCoordinate(e3.time)), void 0 !== e3.text && e3.text.length > 0 && (o2.ri = { lb: e3.text, _t: 0, ut: 0, Qi: 0, $t: 0 });
        const _2 = this.ge.dataByIndex(e3.time, 0);
        null !== _2 && sr(o2, e3, _2, l2, s2.fontSize, h2, this.ge, this.Dp);
      }
      this.St = false;
    }
  }
  function er(t2) {
    return { ...$e, ...t2 };
  }
  class rr {
    constructor(t2) {
      this.sh = null, this.cb = [], this.Mb = [], this.bb = null, this.ge = null, this.Dp = null, this.xb = true, this.Sb = null, this.Cb = null, this.Pb = null, this.yb = true, this.Ps = er(t2);
    }
    attached(t2) {
      this.kb(), this.Dp = t2.chart, this.ge = t2.series, this.sh = new nr(this.ge, a(this.Dp), this.Ps), this.eb = t2.requestUpdate, this.ge.subscribeDataChanged(((t3) => this.Pg(t3))), this.yb = true, this.UM();
    }
    UM() {
      this.eb && this.eb();
    }
    detached() {
      this.ge && this.bb && this.ge.unsubscribeDataChanged(this.bb), this.Dp = null, this.ge = null, this.sh = null, this.bb = null;
    }
    mb(t2) {
      this.yb = true, this.cb = t2, this.kb(), this.xb = true, this.Cb = null, this.UM();
    }
    Tb() {
      return this.cb;
    }
    paneViews() {
      return this.sh ? [this.sh] : [];
    }
    updateAllViews() {
      this.Rb();
    }
    hitTest(t2, i2) {
      var _a2, _b;
      return this.sh ? (_b = (_a2 = this.sh.renderer()) == null ? void 0 : _a2.Yn(t2, i2)) != null ? _b : null : null;
    }
    autoscaleInfo(t2, i2) {
      if (this.sh) {
        const t3 = this.Db();
        if (t3) return { priceRange: null, margins: t3 };
      }
      return null;
    }
    hr(t2) {
      this.Ps = er({ ...this.Ps, ...t2 }), this.UM && this.UM();
    }
    Db() {
      const t2 = a(this.Dp).timeScale().options().barSpacing;
      if (this.xb || t2 !== this.Pb) {
        if (this.Pb = t2, this.cb.length > 0) {
          const i2 = Ke(t2), s2 = 1.5 * Ye(t2) + 2 * i2, n2 = this.Eb();
          this.Sb = { above: Xe(s2, n2.aboveBar, n2.inBar), below: Xe(s2, n2.belowBar, n2.inBar) };
        } else this.Sb = null;
        this.xb = false;
      }
      return this.Sb;
    }
    Eb() {
      return null === this.Cb && (this.Cb = this.cb.reduce(((t2, i2) => (t2[i2.position] || (t2[i2.position] = true), t2)), { inBar: false, aboveBar: false, belowBar: false, atPriceTop: false, atPriceBottom: false, atPriceMiddle: false })), this.Cb;
    }
    kb() {
      var _a2;
      if (!this.yb || !this.Dp || !this.ge) return;
      const t2 = this.Dp.timeScale(), i2 = (_a2 = this.ge) == null ? void 0 : _a2.data();
      if (null == t2.getVisibleLogicalRange() || !this.ge || 0 === i2.length) return void (this.Mb = []);
      const s2 = t2.timeToIndex(a(i2[0].time), true);
      this.Mb = this.cb.map(((i3, n2) => {
        const e2 = t2.timeToIndex(i3.time, true), r2 = e2 < s2 ? 1 : -1, h2 = a(this.ge).dataByIndex(e2, r2), l2 = { time: t2.timeToIndex(a(h2).time, false), position: i3.position, shape: i3.shape, color: i3.color, id: i3.id, gb: n2, text: i3.text, size: i3.size, price: i3.price, Pw: i3.time };
        if ("atPriceTop" === i3.position || "atPriceBottom" === i3.position || "atPriceMiddle" === i3.position) {
          if (void 0 === i3.price) throw new Error("Price is required for position ".concat(i3.position));
          return { ...l2, position: i3.position, price: i3.price };
        }
        return { ...l2, position: i3.position, price: i3.price };
      })), this.yb = false;
    }
    Rb(t2) {
      this.sh && (this.kb(), this.sh.mb(this.Mb), this.sh.wb(this.Ps), this.sh.yt(t2));
    }
    Pg(t2) {
      this.yb = true, this.UM();
    }
  }
  class hr extends Ue {
    constructor(t2, i2, s2) {
      super(t2, i2), s2 && this.setMarkers(s2);
    }
    setMarkers(t2) {
      this.ah.mb(t2);
    }
    markers() {
      return this.ah.Tb();
    }
  }
  class ar {
    constructor(t2) {
      this.cb = /* @__PURE__ */ new Map(), this.Vb = t2;
    }
    Bb(t2, i2, s2) {
      if (this.Ib(i2), void 0 !== s2) {
        const n2 = window.setTimeout((() => {
          this.cb.delete(i2), this.Ab();
        }), s2), e2 = { ...t2, zb: n2, Ob: Date.now() + s2 };
        this.cb.set(i2, e2);
      } else this.cb.set(i2, { ...t2, zb: void 0, Ob: void 0 });
      this.Ab();
    }
    Ib(t2) {
      const i2 = this.cb.get(t2);
      i2 && void 0 !== i2.zb && window.clearTimeout(i2.zb), this.cb.delete(t2), this.Ab();
    }
    Lb() {
      for (const [t2] of this.cb) this.Ib(t2);
    }
    Nb() {
      const t2 = Date.now(), i2 = [];
      for (const [s2, n2] of this.cb) !n2.Ob || n2.Ob > t2 ? i2.push({ time: n2.time, sign: n2.sign, value: n2.value }) : this.Ib(s2);
      return i2;
    }
    Wb(t2) {
      this.Vb = t2;
    }
    Ab() {
      this.Vb && this.Vb();
    }
  }
  const lr = { positiveColor: "#22AB94", negativeColor: "#F7525F", updateVisibilityDuration: 5e3 };
  class or {
    constructor(t2, i2, s2, n2) {
      this.qt = t2, this.Fb = i2, this.Hb = s2, this.Ub = n2;
    }
    draw(t2) {
      t2.useBitmapCoordinateSpace(((t3) => {
        const i2 = t3.context, s2 = Math.max(1, Math.floor(t3.horizontalPixelRatio)) % 2 / 2, n2 = 4 * t3.verticalPixelRatio + s2;
        this.qt.forEach(((e2) => {
          const r2 = Math.round(e2._t * t3.horizontalPixelRatio) + s2;
          i2.beginPath();
          const h2 = this.$b(e2.jb);
          i2.fillStyle = h2, i2.arc(r2, e2.ut * t3.verticalPixelRatio, n2, 0, 2 * Math.PI, false), i2.fill(), e2.jb && (i2.strokeStyle = h2, i2.lineWidth = Math.floor(2 * t3.horizontalPixelRatio), i2.beginPath(), i2.moveTo((e2._t - 4.7) * t3.horizontalPixelRatio + s2, (e2.ut - 7 * e2.jb) * t3.verticalPixelRatio), i2.lineTo(e2._t * t3.horizontalPixelRatio + s2, (e2.ut - 7 * e2.jb - 7 * e2.jb * 0.5) * t3.verticalPixelRatio), i2.lineTo((e2._t + 4.7) * t3.horizontalPixelRatio + s2, (e2.ut - 7 * e2.jb) * t3.verticalPixelRatio), i2.stroke());
        }));
      }));
    }
    $b(t2) {
      return 0 === t2 ? this.Fb : t2 > 0 ? this.Ub : this.Hb;
    }
  }
  class _r {
    constructor(t2, i2, s2) {
      this.qt = [], this.ge = t2, this.uh = i2, this.Ps = s2;
    }
    yt(t2) {
      this.qt = t2.map(((t3) => {
        const i2 = this.ge.priceToCoordinate(t3.value);
        if (null === i2) return null;
        return { _t: a(this.uh.timeToCoordinate(t3.time)), ut: i2, jb: t3.sign };
      })).filter(v);
    }
    renderer() {
      const t2 = (function(t3, i2) {
        return /* @__PURE__ */ (function(t4, i3) {
          return "Area" === i3;
        })(0, i2) ? t3.lineColor : t3.color;
      })(this.ge.options(), this.ge.seriesType());
      return new or(this.qt, t2, this.Ps.negativeColor, this.Ps.positiveColor);
    }
  }
  function ur(t2, i2) {
    return "Line" === i2 || "Area" === i2;
  }
  class cr {
    constructor(t2) {
      this.Dp = void 0, this.ge = void 0, this.HM = [], this.o_ = null, this.qb = /* @__PURE__ */ new Map(), this.Yb = new ar((() => this.UM())), this.Ps = { ...lr, ...t2 };
    }
    hr(t2) {
      this.Ps = { ...this.Ps, ...t2 }, this.UM();
    }
    mb(t2) {
      this.Yb.Lb();
      const i2 = this.o_;
      i2 && t2.forEach(((t3) => {
        this.Yb.Bb(t3, i2.key(t3.time));
      }));
    }
    Tb() {
      return this.Yb.Nb();
    }
    UM() {
      var _a2;
      (_a2 = this.eb) == null ? void 0 : _a2.call(this);
    }
    attached(t2) {
      const { chart: i2, series: s2, requestUpdate: n2, horzScaleBehavior: e2 } = t2;
      this.Dp = i2, this.ge = s2, this.o_ = e2;
      const r2 = this.ge.seriesType();
      if ("Area" !== r2 && "Line" !== r2) throw new Error("UpDownMarkersPrimitive is only supported for Area and Line series types");
      this.HM = [new _r(this.ge, this.Dp.timeScale(), this.Ps)], this.eb = n2, this.UM();
    }
    detached() {
      this.Dp = void 0, this.ge = void 0, this.eb = void 0;
    }
    $p() {
      return h(this.Dp);
    }
    Lo() {
      return h(this.ge);
    }
    updateAllViews() {
      this.HM.forEach(((t2) => t2.yt(this.Tb())));
    }
    paneViews() {
      return this.HM;
    }
    ht(t2) {
      if (!this.ge) throw new Error("Primitive not attached to series");
      const i2 = this.ge.seriesType();
      this.qb.clear();
      const s2 = this.o_;
      s2 && t2.forEach(((t3) => {
        js(t3) && ur(0, i2) && this.qb.set(s2.key(t3.time), t3.value);
      })), h(this.ge).setData(t2);
    }
    yt(t2, i2) {
      if (!this.ge || !this.o_) throw new Error("Primitive not attached to series");
      const s2 = this.ge.seriesType(), n2 = this.o_.key(t2.time);
      if ($s(t2) && this.qb.delete(n2), js(t2) && ur(0, s2)) {
        const i3 = this.qb.get(n2);
        i3 && this.Yb.Bb({ time: t2.time, value: t2.value, sign: dr(t2.value, i3) }, n2, this.Ps.updateVisibilityDuration);
      }
      h(this.ge).update(t2, i2);
    }
    Kb() {
      this.Yb.Lb();
    }
  }
  function dr(t2, i2) {
    return t2 === i2 ? 0 : t2 - i2 > 0 ? 1 : -1;
  }
  class fr extends Ue {
    setData(t2) {
      return this.ah.ht(t2);
    }
    update(t2, i2) {
      return this.ah.yt(t2, i2);
    }
    markers() {
      return this.ah.Tb();
    }
    setMarkers(t2) {
      return this.ah.mb(t2);
    }
    clearMarkers() {
      return this.ah.Kb();
    }
  }
  const pr = { ...t, color: "#2196f3" };
  var vr = Object.freeze({ __proto__: null, AreaSeries: ve, BarSeries: Me, BaselineSeries: de, CandlestickSeries: Se, get ColorType() {
    return Vi;
  }, get CrosshairMode() {
    return $;
  }, HistogramSeries: ye, get LastPriceAnimationMode() {
    return Di;
  }, LineSeries: Qn, get LineStyle() {
    return s;
  }, get LineType() {
    return i;
  }, get MismatchDirection() {
    return Ct;
  }, get PriceLineSource() {
    return Ei;
  }, get PriceScaleMode() {
    return ci;
  }, get TickMarkType() {
    return Bi;
  }, get TrackingModeExitMode() {
    return Ri;
  }, createChart: function(t2, i2) {
    return Hn(t2, new Ji(), Ji.ad(i2));
  }, createChartEx: Hn, createImageWatermark: function(t2, i2, s2) {
    return new ke(t2, new He(i2, s2));
  }, createOptionsChart: function(t2, i2) {
    return Hn(t2, new he(), i2);
  }, createSeriesMarkers: function(t2, i2, s2) {
    const n2 = new hr(t2, new rr(s2 != null ? s2 : {}));
    return i2 && n2.setMarkers(i2), n2;
  }, createTextWatermark: function(t2, i2) {
    return new ke(t2, new ze(i2));
  }, createUpDownMarkers: function(t2, i2 = {}) {
    return new fr(t2, new cr(i2));
  }, createYieldCurveChart: function(t2, i2) {
    const s2 = Fn(t2);
    return new ee(s2, i2);
  }, customSeriesDefaultOptions: pr, defaultHorzScaleBehavior: function() {
    return Ji;
  }, isBusinessDay: Ai, isUTCTimestamp: zi, version: function() {
    return "5.0.8";
  } });
  window.LightweightCharts = vr;
})();
;
(function() {
  "use strict";
  var _a, _b;
  const E = HAL4Engine, D = HAL4Data, I = HAL4Insights, N = window.HALNative, $ = (id) => document.getElementById(id), esc = (x) => String(x != null ? x : "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (v, d = 2) => E.finite(v) ? v.toLocaleString("en-IN", { maximumFractionDigits: d }) : "\u2014", money = (v) => E.finite(v) ? (v < 0 ? "\u2212" : "") + "\u20B9" + Math.abs(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "Unavailable", pct = (v) => E.finite(v) ? num(v) + "%" : "\u2014";
  const when = (v) => v && Number.isFinite(Date.parse(v)) ? new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) + " IST" : "Time unavailable", date = (v) => E.validDate(v) ? (/* @__PURE__ */ new Date(v + "T00:00:00Z")).toLocaleDateString("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" }) : "\u2014", stamp = () => (/* @__PURE__ */ new Date()).toISOString(), clone = (v) => JSON.parse(JSON.stringify(v)), color = (v) => E.finite(v) ? v < 0 ? "negative" : "positive" : "muted";
  const btn = (a, t, x = "") => '<button data-action="'.concat(a, '" ').concat(x, ">").concat(t, "</button>"), badge = (t, c = "") => '<span class="badge '.concat(esc(c), '">').concat(esc(t), "</span>"), row = (a, b) => '<div class="row"><span>'.concat(esc(a), "</span><strong>").concat(esc(b), "</strong></div>"), tile = (a, b, c = "") => '<div class="metric"><small>'.concat(esc(a), "</small><strong>").concat(esc(b), "</strong><span>").concat(esc(c), "</span></div>"), empty = (a, b = "") => '<div class="empty"><strong>'.concat(esc(a), "</strong>").concat(esc(b), "</div>"), card = (a, b, c = "") => '<section class="card"><div class="section-heading"><h2>'.concat(esc(a), "</h2>").concat(c, "</div>").concat(b, "</section>");
  const table = (h, rs) => '<div class="table-wrap"><table><thead><tr>'.concat(h.map((x) => "<th>" + esc(x) + "</th>").join(""), "</tr></thead><tbody>").concat(rs.map((r) => "<tr>" + r.map((x) => "<td>" + esc(x) + "</td>").join("") + "</tr>").join(""), "</tbody></table></div>"), input = (id, label, v = "", type = "number") => "<label>".concat(esc(label), '<input id="').concat(id, '" type="').concat(type, '" ').concat(type === "number" ? 'step="any" inputmode="decimal"' : "", ' value="').concat(esc(v != null ? v : ""), '"></label>'), select = (id, label, opts, v) => "<label>".concat(esc(label), '<select id="').concat(id, '">').concat(opts.map(([k, t]) => '<option value="'.concat(esc(k), '" ').concat(k === v ? "selected" : "", ">").concat(esc(t), "</option>")).join(""), "</select></label>"), value = (id) => {
    var _a2;
    return E.value((_a2 = $(id)) == null ? void 0 : _a2.value);
  }, text = (id) => {
    var _a2;
    return ((_a2 = $(id)) == null ? void 0 : _a2.value) || "";
  };
  let book = E.emptyBook(), revision = 0, s = D.empty(), configured = false, started = false, storageError = "", chart = null, saveModal = null, returnFocus = null, toastTimer;
  const ui = { screen: "today", position: "book", plan: "stress", research: "markets", frame: "D", expiry: "", side: "PE", filter: "all", search: "", statement: "consolidated", scenario: { spot: "", horizon: "", iv: "", shift: 0, rate: 6, dividend: 0, basis: "constant", base: "" }, result: null, resultAt: null, hedges: null, hedgesAt: null, hedgeDraft: null, pattern: null, patternWindow: 20, patternForward: 10, aiMode: "copilot", question: "Explain the position, expiry gaps, quote reliability and evidence that needs review.", share: true, ai: null, pendingAI: null, aiError: "", aiConfigured: false, model: "", finbert: { state: "not_installed" }, sentiments: {} };
  function native(name, ...args) {
    if (typeof (N == null ? void 0 : N[name]) === "function") return N[name](...args);
    if (!["ready", "finbertStatus"].includes(name)) toast("Available in the installed Android app.");
    return null;
  }
  function toast(msg) {
    clearTimeout(toastTimer);
    $("toast").textContent = msg;
    $("toast").hidden = false;
    toastTimer = setTimeout(() => $("toast").hidden = true, 6e3);
  }
  function isBookConfirmed() {
    return I.isBookConfirmed(book);
  }
  function invalidateCalculations() {
    ui.result = null;
    ui.resultAt = null;
    ui.hedges = null;
    ui.hedgesAt = null;
  }
  function theme() {
    document.body.classList.toggle("light", book.preferences.theme === "light" || book.preferences.theme === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  }
  function commit(b) {
    if (storageError) throw Error("Recover the saved book before editing.");
    const next = E.validateBook(b);
    if (I.materialFingerprint(next) !== I.materialFingerprint(book)) {
      next.riskProfile.confirmedAt = null;
      next.riskProfile.confirmedBook = null;
      ui.ai = null;
      invalidateCalculations();
      if (ui.pendingAI) native("aiCancel", ui.pendingAI.id);
      ui.pendingAI = null;
    }
    const r = D.saveBook(N, localStorage, next, revision);
    book = r.book;
    revision = r.revision;
    book.revision = revision;
    theme();
    render();
  }
  function cache() {
    try {
      const x = JSON.stringify(D.cache(s));
      if (N == null ? void 0 : N.cachePut) {
        const r = JSON.parse(N.cachePut("snapshot", x));
        if (!r.ok) throw Error();
      } else localStorage.setItem("hal_cache_v4", x);
    } catch (_) {
      toast("Market cache could not be saved; your portfolio is stored separately.");
    }
  }
  const market = () => D.market(s), ledger = () => E.ledger(book, market()), risk = () => {
    const r = E.risk(book, market());
    if (book.legs.length && !isBookConfirmed() && !r.warnings.some((w) => w.code === "unconfirmed")) r.warnings.push({ code: "unconfirmed", title: "Confirm your book", detail: "Check these positions against your broker records." });
    return r;
  }, news = () => I.newsGroups(D.news(s));
  function technical(frame = "D") {
    const p = D.rawCandles(s, frame), t = E.technicals(p.raw, frame, Date.now(), p.retrievedAt);
    if (p.error) {
      t.stale = true;
      t.bias = "Refresh failed";
    }
    return t;
  }
  function evidence() {
    return { book, valuation: ledger(), risk: risk(), market: market(), technical: technical(), fundamentals: I.providerFundamentals(D.packet(s, "fundamentals", "D", ui.statement)), news: news(), scenarios: ui.result && !Array.isArray(ui.result) ? [ui.result] : [], funding: book.funding };
  }
  const checkpoint = () => I.checkpoint(evidence()), changes = () => I.changes(book.checkpoints.at(-1), checkpoint(), news());
  function request(section, frame = "D", force = false) {
    if (!configured && section !== "filings") return;
    const k = D.key(section, frame, ui.statement), h = s.health[k] || {}, ttl = section === "fundamentals" ? 216e5 : ["candles", "patterns", "news", "filings"].includes(section) ? 9e5 : 6e4;
    if (h.pending || !force && h.lastSuccess && Date.now() - Date.parse(h.lastSuccess) < ttl) return;
    if (h.lastAttempt && Date.now() - Date.parse(h.lastAttempt) < 1e4) return;
    s.health[k] = { ...h, pending: stamp(), lastAttempt: stamp() };
    native("research", JSON.stringify({ section, frame, type: ui.statement, ...section === "contracts" ? { legs: book.legs.map((l) => ({ type: l.type, expiry: l.expiry, strike: l.strike, lotSize: l.lotSize, ...l.instrumentKey ? { instrument_key: l.instrumentKey } : {} })) } : {} }));
  }
  function refresh(force = true) {
    if (s.loading) return;
    if (!configured) {
      native("settings");
      return;
    }
    native("refresh", ui.expiry || "");
    request("status", "D", force);
    request("context", "D", force);
    if (book.legs.length) request("contracts", "D", force);
    for (const d of [...new Set(book.legs.filter((l) => l.type === "PE" && E.expiryTime(l.expiry) > Date.now()).map((l) => l.expiry))]) request("hedges", d, force);
  }
  function navigate(screen, sub) {
    ui.screen = screen;
    if (sub) ui[screen] = sub;
    render();
    window.scrollTo(0, 0);
    if (screen === "research") {
      if (ui.research === "markets") request("candles", ui.frame);
      if (ui.research === "company") request("fundamentals");
      if (ui.research === "news") {
        request("news");
        request("filings");
      }
    }
  }
  const subnav = (group, items) => '<div class="subnav">'.concat(items.map(([k, t]) => '<button data-sub="'.concat(k, '" class="').concat(ui[group] === k ? "active" : "", '" aria-pressed="').concat(ui[group] === k, '">').concat(esc(t), "</button>")).join(""), "</div>"), intro = (t, n) => '<div class="page-intro"><div class="eyebrow">Hindustan Aeronautics \xB7 NSE</div><h1>'.concat(esc(t), "</h1><p>").concat(esc(n), "</p></div>"), reviews = (items) => items.map((w) => '<article class="review-item"><strong>'.concat(esc(w.title), "</strong><p>").concat(esc(w.detail), "</p></article>")).join("");
  function clocks(q) {
    const z = E.quoteQuality(q);
    return row("Provider quote", when(q == null ? void 0 : q.quoteAt)) + row("Last exchange trade", when(q == null ? void 0 : q.tradeAt)) + row("HTTP retrieved", when(q == null ? void 0 : q.retrievedAt)) + row("Last successful refresh", when(s.lastSuccess)) + row("Last failed refresh", when(s.lastFailure)) + '<p class="fine">'.concat(esc([...z.reasons, ...z.warnings].join(" \xB7 ") || "A recent HTTP retrieval does not establish a recent exchange trade."), "</p>");
  }
  function changeView() {
    const c = changes();
    return c.ready ? '<p class="fine">Since '.concat(esc(when(c.from)), '</p><div class="metrics">').concat(tile("Spot change", money(c.spot))).concat(tile("Open P&L change", money(c.open), c.sameBook ? "Same book" : "Book changed"), '</div><p class="fine">').concat(esc(c.reason), "</p>") : empty("No comparison checkpoint", c.reason);
  }
  function articleCards(list, limit = 30) {
    return list.slice(0, limit).map((n) => {
      var _a2;
      return '<article class="news-item"><div class="news-meta"><span>'.concat(esc(n.source || "Unknown source")).concat(n.official ? " \xB7 Official filing" : "", "</span><span>").concat(esc(when(n.publishedAt)), "</span></div><h3>").concat(esc(n.title), "</h3>").concat(n.summary ? "<p>" + esc(n.summary) + "</p>" : "").concat(((_a2 = n.duplicates) == null ? void 0 : _a2.length) ? badge(n.duplicates.length + " duplicates grouped") : "").concat(ui.sentiments[n.url] ? badge("FinBERT " + ui.sentiments[n.url].label + " " + pct(ui.sentiments[n.url].confidence * 100)) : "", '<div class="toolbar">').concat(n.url ? btn("link", "Read source", 'data-url="'.concat(esc(n.url), '" class="text-button"')) + btn("bookmark", book.bookmarks.some((b) => b.url === n.url) ? "Saved" : "Save", 'data-url="'.concat(esc(n.url), '" class="text-button"')) : badge("Link unavailable"), '</div><p class="fine">Retrieved ').concat(esc(when(n.retrievedAt)), "</p></article>");
    }).join("") || empty("No verified news loaded", "Refresh when connected. Absence from a feed does not prove that no event occurred.");
  }
  function today(m, l, r) {
    var _a2, _b2, _c, _d;
    const q = E.quoteQuality(m.spot), delta = E.finite(m.spot.price) && E.finite(m.spot.previousClose) ? m.spot.price - m.spot.previousClose : null, shocks = [0, -0.03, -0.05, -0.1].map((x) => {
      const p = E.scenario(book, m, { spot: E.finite(m.spot.price) ? m.spot.price * (1 + x) : null, days: 0 });
      return [x ? pct(x * 100) : "Unchanged", money(p.total), p.complete ? "Model estimate" : p.errors[0]];
    });
    return intro("Your position, in focus.", "Exposure, protection and the evidence worth reviewing.") + '<div class="columns"><section class="card hero"><div class="hero-header"><span class="eyebrow">Indicative open P&L</span>'.concat(badge(l.manual ? "Manual marks included" : l.stale ? "Older REST marks" : l.complete ? "All marks available" : "Incomplete", l.manual ? "manual" : l.stale ? "stale" : ""), '</div><div class="hero-value ').concat(color(l.open), '">').concat(book.legs.length ? money(l.open) : "No open book", '</div><p class="fine">').concat(book.legs.length ? l.complete ? book.legs.length + " saved legs \xB7 not a broker account balance" : "One or more required marks are unavailable." : "Record and confirm your actual holdings. No example positions are preloaded.", '</p><div class="hero-footer"><div><small>Recorded realised</small><strong>').concat(money(l.realized), "</strong></div><div><small>Net strategy P&L</small><strong>").concat(money(l.net), "</strong></div></div></section>").concat(card("HAL \xB7 NSE", '<div class="hero-value">'.concat(money(m.spot.price), '</div><p class="').concat(color(delta), '">').concat(money(delta), " daily change \xB7 ").concat(badge(q.status, q.status), '</p><p class="fine">Quote ').concat(esc(when(m.spot.quoteAt)), "<br>Trade ").concat(esc(when(m.spot.tradeAt)), "</p><details><summary>Source & refresh clocks</summary>").concat(clocks(m.spot), "</details>")), '</div><div class="metrics wide">').concat(tile("Futures exposure", num(r.futureUnits, 0) + " shares", num(r.futureLots, 0) + " lots")).concat(tile("Quantity coverage", pct(r.coverage), num(r.putUnits, 0) + " put units")).concat(tile("Net delta", num(r.delta), "Only with complete valid Greeks")).concat(tile("Nearest expiry", date(r.nextExpiry)), '</div><div class="columns">').concat(card("Owned protection", '<p class="fine">'.concat(esc(r.coverageMeaning), '</p><div class="coverage-track"><span style="width:').concat(Math.min(r.coverage || 0, 100), '%"></span></div>').concat(r.distribution.map((p) => '<div class="owned-put"><div><b>\u20B9'.concat(num(p.strike, 0), " PE</b><small>").concat(date(p.expiry), "</small></div><span>").concat(num(p.units, 0), " units</span></div>")).join("") || empty("No active puts")))).concat(card("Review triggers", reviews(r.warnings.slice(0, 5)) || empty("No position triggers")), "</div>").concat(card("Downside shock preview", book.legs.length ? table(["Spot shock", "Entry-based P&L", "Evidence"], shocks) + '<p class="fine">Immediate model shocks; current IV and observed futures basis. Excludes journal charges and realised history. Missing inputs remain unavailable.</p>' : empty("Record your position first"), btn("go-stress", "Explore", 'class="text-button"')), '<div class="columns">').concat(card("Since your last review", changeView(), btn("checkpoint", "Save checkpoint", 'class="text-button"'))).concat(card("Market context", row("NIFTY 50", money((_a2 = m.nifty) == null ? void 0 : _a2.price)) + row("India VIX", num((_b2 = m.vix) == null ? void 0 : _b2.price)) + '<p class="fine">' + esc(when((_c = m.nifty) == null ? void 0 : _c.quoteAt)) + " \xB7 " + esc(when((_d = m.vix) == null ? void 0 : _d.quoteAt)) + "</p>", btn("health", "Data health", 'class="text-button"')), "</div>").concat(card("Business & news", articleCards(news(), 3), btn("go-news", "All news", 'class="text-button"')));
  }
  function contractHelp(leg, m) {
    const candidates = m.contracts.filter((c) => c.type === leg.type && (leg.type !== "PE" || c.strike === leg.strike));
    return '<p class="fine">Saved expiry ' + esc(date(leg.expiry)) + " \xB7 " + esc(leg.lotSize) + " units per lot. " + (candidates.length ? "Provider lists " + candidates.slice(0, 8).map((c) => esc(date(c.expiry)) + " (lot " + esc(E.finite(c.lotSize) ? c.lotSize : "unavailable") + ")").join(", ") + "." : "No same-strike contract metadata is currently available.") + " Use Verify contracts, then review Edit / manual mark \u2192 Fill from listed contract against your broker record. Entries and expiry dates are never changed automatically.</p>";
  }
  function position(m, l, r) {
    let body = "";
    if (ui.position === "book") body = '<div class="toolbar">'.concat(btn("add", "Add position", 'class="primary"')).concat(btn("verify", "Verify contracts")).concat(btn("confirm", "Confirm book"), '</div><p class="fine">').concat(isBookConfirmed() ? "Confirmed " + when(book.riskProfile.confirmedAt) : "Not confirmed against broker records.", " These controls record trades; they never place orders.</p>") + (l.rows.map((x) => {
      var _a2;
      return card("HAL " + (x.leg.type === "FUT" ? "Future" : num(x.leg.strike, 0) + " PE"), '<p class="contract-meta">'.concat(date(x.leg.expiry), " \xB7 ").concat(x.leg.lots, " lots \xD7 ").concat(x.leg.lotSize, " units</p>").concat(row("Indicative P&L", money(x.pnl))).concat(row("Entry / mark", money(x.leg.entry) + " / " + money(x.mark.price))).concat(badge(x.mark.source, x.mark.status), '<p class="fine">').concat(esc(x.mark.warnings.join(" \xB7 ")), "</p>").concat(!E.finite(x.mark.price) ? contractHelp(x.leg, m) : "", "<details><summary>Exact contract & clocks</summary>").concat(row("Instrument", x.leg.instrumentKey || ((_a2 = x.mark.contract) == null ? void 0 : _a2.instrumentKey) || "Unverified")).concat(row("Quote", when(x.mark.quoteAt))).concat(row("Trade", when(x.mark.tradeAt))).concat(row("Retrieved", when(x.mark.retrievedAt)), '</details><div class="toolbar">').concat(btn("edit", "Edit / manual mark", 'data-id="'.concat(esc(x.leg.id), '"'))).concat(btn("close", "Record completed close", 'data-id="'.concat(esc(x.leg.id), '"')), "</div>"));
    }).join("") || empty("Your book is empty", "Add exact HAL futures and protective puts, then confirm with your broker."));
    if (ui.position === "performance") body = '<div class="metrics wide">'.concat(tile("Open", money(l.open))).concat(tile("Realised gross", money(l.realized))).concat(tile("Charges", money(l.charges))).concat(tile("Strategy net", money(l.net)), "</div>") + card("Leg performance", table(["Contract", "Expiry", "Units", "Entry", "Mark", "P&L"], l.rows.map((x) => [x.leg.type === "FUT" ? "Future" : num(x.leg.strike) + " PE", date(x.leg.expiry), x.units, money(x.leg.entry), money(x.mark.price), money(x.pnl)]))) + card("Premium & cash", row("Open put entry premium", money(l.openPutPremium)) + row("Settlement cash", money(l.settlements)) + row("Funding cash", money(l.fundingMovements)) + '<p class="fine">Settlement and funding cash are separate from P&L and are never added twice.</p>') + card("Price & review observations", table(["Saved at", "Spot", "Open P&L", "Coverage"], book.checkpoints.slice(-30).reverse().map((c) => [when(c.savedAt), money(c.spot), money(c.open), pct(c.coverage)])), btn("checkpoint", "Save checkpoint", 'class="text-button"'));
    if (ui.position === "risk") {
      const c = E.carryComparison(m);
      body = '<div class="metrics">'.concat(tile("Uncovered futures", num(r.uncoveredUnits, 0) + " units")).concat(tile("Net delta", num(r.delta))).concat(tile("Net theta", num(r.theta), "Unavailable if convention is unverified")).concat(tile("Put quantity", num(r.putUnits, 0)), "</div>") + card("Position risks", reviews(r.warnings), btn("limits", "Risk limits", 'class="text-button"')) + card("Protection timeline", table(["After expiry", "Futures units", "Put units", "Uncovered"], r.timeline.map((t) => [date(t.date), t.futureUnits, t.putUnits, t.uncoveredUnits])) + '<p class="fine">Coverage at one time does not guarantee a downside floor through a later futures expiry.</p>') + card("Futures carry", table(["Near / far expiry", "Spread", "Annualised"], (Array.isArray(c) ? c : c.rows || []).map((x) => {
        var _a2, _b2;
        return [date(x.nearExpiry || ((_a2 = x.near) == null ? void 0 : _a2.expiry)) + " / " + date(x.farExpiry || ((_b2 = x.far) == null ? void 0 : _b2.expiry)), money(x.spread), pct(x.annualized)];
      })) + '<p class="fine">Observed spread, not a rollover plan or funding projection.</p>');
    }
    if (ui.position === "journal") body = card("Funding snapshot", row("Recorded margin", money(book.funding.margin)) + row("Recorded available funds", money(book.funding.free)) + row("Time", when(book.funding.at)) + '<p class="fine">Manual snapshot; broker margin can change. No account-fund access.</p>', btn("funding", "Update", 'class="text-button"')) + '<div class="toolbar">'.concat(btn("cash", "Record fee / cash", 'class="primary"')).concat(btn("csv", "Journal CSV")).concat(btn("export", "JSON backup")).concat(btn("import", "Import")).concat(btn("recovery", "Previous book"), "</div>") + card("Completed history", book.journal.slice().reverse().map((j) => '<article class="news-item"><strong>'.concat(esc(j.kind === "close" ? "Completed " + j.leg.type + " close" : j.kind), "</strong><small> \xB7 ").concat(date(j.date), "</small>").concat(j.kind === "close" ? row(j.leg.lots + " \xD7 " + j.leg.lotSize + " \xB7 " + date(j.leg.expiry), money((j.exit - j.leg.entry) * E.units(j.leg))) + row("Exit / charges", money(j.exit) + " / " + money(j.fees)) : row("Amount", money(j.amount)), '<p class="fine">').concat(esc(j.note), "</p>").concat(btn("journal-edit", "Correct record", 'data-id="'.concat(esc(j.id), '" class="text-button"')), "</article>")).join("") || empty("No recorded closes")) + (book.legacy ? card("Preserved legacy history", row("Realised", money(book.legacy.realized)) + row("Costs", money(book.legacy.costs)) + table(["Date", "Kind", "Amount", "Note"], book.legacy.journal.map((j) => [j.date, j.kind, money(j.amount), j.note]))) : "");
    return intro("My Position", "Your exact contracts and complete local record.") + subnav("position", [["book", "Book"], ["performance", "Performance"], ["risk", "Risk"], ["journal", "Journal & Funding"]]) + body;
  }
  function scenarioView(r) {
    if (Array.isArray(r)) return card("Sampled scenarios", table(["Shock", "Spot", "P&L", "Quality"], r.map((x) => [pct(x.shock * 100), money(x.spot), money(x.total), x.complete ? x.kind : x.errors.join("; ")])));
    return card(r.complete ? "Scenario results" : "Scenario unavailable", '<div class="hero-value '.concat(color(r.total), '">').concat(money(r.total), '</div><p class="fine">').concat(esc(r.kind), " \xB7 ").concat(when(r.horizon), "</p>").concat(r.complete ? table(["Contract", "Model price", "Units", "P&L", "Valuation"], r.rows.map((x) => [x.leg.type === "FUT" ? "Future" : num(x.leg.strike) + " PE", money(x.modelPrice), x.units, money(x.pnl), x.kind])) : reviews(r.errors.map((e) => ({ title: "Input needs review", detail: e }))), "<details><summary>Assumptions</summary>").concat(r.assumptions.map((a) => '<p class="fine">' + esc(a) + "</p>").join(""), "</details>"));
  }
  function plan(m) {
    var _a2, _b2, _c;
    let body;
    const p = ui.scenario, h = ui.hedgeDraft || book.hedge;
    if (ui.plan === "stress") body = card("Multi-leg stress test", '<p class="fine">A horizon after the earliest open-leg expiry is invalid. A later hypothetical spot cannot establish an earlier settlement.</p><div class="form-grid">'.concat(input("sc-spot", "Scenario spot (\u20B9)", (_a2 = E.value(p.spot)) != null ? _a2 : m.spot.price)).concat(input("sc-horizon", "Horizon \xB7 blank = now", p.horizon, "date")).concat(input("sc-iv", "Explicit IV assumption (%) \xB7 optional", p.iv)).concat(input("sc-shift", "IV shift (percentage points)", p.shift)).concat(input("sc-rate", "Interest rate (% annual)", p.rate)).concat(input("sc-dividend", "Dividend yield (% annual)", p.dividend)).concat(select("sc-basis", "Futures basis", [["constant", "Observed constant basis"], ["decay", "Basis decays to expiry"], ["carry", "Theoretical cost of carry"]], p.basis)).concat(input("sc-base", "Manual base spot \xB7 optional", p.base), '</div><div class="toolbar">').concat(btn("scenario", "Calculate", 'class="primary"')).concat(btn("shock-grid", "Run 0 / \u22123 / \u22125 / \u221210%"), '</div><p class="fine">European Black\u2013Scholes puts; ACT/365. Entered IV, rates and base spot are assumptions. Missing inputs remain unavailable. No model price is an execution quote.</p>')) + (ui.result ? '<p class="fine">Calculated ' + esc(when(ui.resultAt)) + " using the displayed assumptions.</p>" + scenarioView(ui.result) : empty("Choose assumptions to calculate"));
    else body = card("Find a protective put", '<p class="fine">Compare actual listed HAL puts as replacements for existing puts. Whole lots must exactly cover current futures units. A comparison never changes your saved positions.</p><div class="form-grid">'.concat(input("hg-budget", "Gross purchase budget (\u20B9)", h.budget)).concat(input("hg-loss", "Sampled additional-loss limit (\u20B9)", h.maxLoss)).concat(input("hg-through", "Protection-through date", h.protectThrough, "date")).concat(input("hg-spread", "Maximum bid/ask spread (%)", h.maxSpread), '</div><details><summary>Costs, liquidity & model assumptions</summary><div class="form-grid">').concat(input("hg-buy", "Buy charges (\u20B9)", h.buyFees)).concat(input("hg-exit", "Exit charges (\u20B9)", h.exitFees)).concat(input("hg-slip", "Slippage each side (%)", h.slippage)).concat(input("hg-iv", "IV shift (percentage points)", h.ivShift)).concat(input("hg-rate", "Interest (% annual)", h.rate)).concat(input("hg-dividend", "Dividend (% annual)", h.dividend)).concat(input("hg-volume", "Minimum volume (units)", (_b2 = h.minVolume) != null ? _b2 : 1)).concat(input("hg-oi", "Minimum OI (units)", (_c = h.minOI) != null ? _c : 1), '</div></details><div class="toolbar">').concat(btn("hedge-fetch", "Save & fetch puts", 'class="primary"')).concat(btn("hedge-rank", "Compare available quotes"), '</div><p class="fine">Fresh quote/trade clocks, contract specifications, liquidity and valid Greeks are required. No qualifying contract is a valid result.</p>')) + (ui.hedges ? '<p class="fine">Compared '.concat(esc(when(ui.hedgesAt)), '. Refresh or edit assumptions to recalculate.</p><div class="columns">').concat([["lowerCost", "Lower Cost"], ["balanced", "Balanced"], ["strongerProtection", "Stronger Protection"]].map(([k, title]) => {
      const c = ui.hedges.rankings[k];
      return card(title, c ? "<h3>\u20B9".concat(num(c.contract.strike, 0), " PE \xB7 ").concat(date(c.contract.expiry), "</h3>").concat(row("Gross purchase", money(c.grossCost))).concat(row("Sampled worst loss", money(c.worstLoss))).concat(row("Net cash required", money(c.netCashRequired))).concat(c.expiryGap ? '<p class="warning fine">Protection ends before the last futures expiry.</p>' : "").concat(btn("hedge-detail", "Inspect comparison", 'data-id="'.concat(esc(c.contract.instrumentKey), '" class="text-button"'))) : empty("No qualifying candidate"));
    }).join(""), "</div>").concat(card("Eligibility & ranking", reviews(ui.hedges.errors.map((e) => ({ title: "No forced recommendation", detail: e }))) + "<details><summary>Excluded contracts (".concat(ui.hedges.excluded.length, ")</summary>").concat(table(["Strike", "Expiry", "Reason"], ui.hedges.excluded.map((c) => [c.contract.strike, date(c.contract.expiry), c.reasons.join("; ")])), "</details><details><summary>Ranking method</summary>").concat(ui.hedges.assumptions.map((x) => '<p class="fine">' + esc(x) + "</p>").join(""), "</details>"))) : empty("No comparison requested", "Sampled worst loss is not a guaranteed maximum loss."));
    return intro("Plan with evidence", "Understand the assumptions behind every comparison.") + subnav("plan", [["stress", "Stress Test"], ["hedge", "Find a Hedge"]]) + body;
  }
  function facts(v, path = "", out = []) {
    if (out.length >= 120) return out;
    if (Array.isArray(v)) v.slice(0, 30).forEach((x, i) => facts(x, path + " [" + (i + 1) + "]", out));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) facts(x, path ? path + " / " + k : k, out);
    else if (v != null) out.push([path, String(v)]);
    return out;
  }
  function research(m) {
    var _a2, _b2, _c;
    let body = "";
    const t = technical(ui.frame), p = D.packet(s, "fundamentals", "D", ui.statement), fund = (p == null ? void 0 : p.data) || {}, base = s.snapshot || {};
    if (ui.research === "markets") {
      const chain = ((_a2 = D.packet(s, "hedges", ui.expiry)) == null ? void 0 : _a2.data) || ((_b2 = D.packet(s, "chain", ui.expiry)) == null ? void 0 : _b2.data) || (base.option_expiry === ui.expiry ? base : {});
      body = card("HAL price & volume", '<div class="hero-header"><strong style="font-size:28px">'.concat(money(m.spot.price), "</strong>").concat(badge(E.quoteQuality(m.spot).status), '</div><div class="toolbar">').concat([["D", "Daily"], ["1h", "Hourly"], ["15m", "15 minute"]].map(([k, v]) => btn("frame", v, 'data-id="'.concat(k, '" ').concat(k === ui.frame ? 'class="primary"' : ""))).join("")).concat(btn("candles", "Refresh"), '</div><div id="market-chart" class="chart"></div>').concat(t.rows.length ? "" : empty("Chart unavailable", "Load completed provider candles."), '<p class="fine">').concat(esc(t.bias || "Insufficient history"), " \xB7 ").concat(t.rows.length, " completed bars \xB7 ").concat(when(t.asOf ? new Date(t.asOf).toISOString() : null), '. SMA20/50, volume, saved futures entries and put strikes. <a href="https://www.tradingview.com/">Lightweight Charts\u2122 by TradingView</a>.</p>')) + card("Listed futures", table(["Expiry", "Lot", "LTP", "Volume", "OI", "Previous OI", "Bid / ask"], (base.futures || []).map((f) => {
        var _a3, _b3, _c2, _d, _e, _f;
        return [date(f.expiry), f.lot_size, money((_a3 = f.quote) == null ? void 0 : _a3.last_price), num((_b3 = f.quote) == null ? void 0 : _b3.volume, 0), num((_c2 = f.quote) == null ? void 0 : _c2.open_interest, 0), num((_d = f.quote) == null ? void 0 : _d.previous_oi, 0), money((_e = f.quote) == null ? void 0 : _e.bid) + " / " + money((_f = f.quote) == null ? void 0 : _f.ask)];
      }))) + card("Option chain", '<div class="form-grid">'.concat(select("chain-expiry", "Expiry", (base.available_expiries || []).map((x) => [x, date(x)]), ui.expiry)).concat(select("chain-side", "Side", [["PE", "Puts"], ["CE", "Calls"]], ui.side), "</div>").concat(btn("chain", "Refresh chain"), '<p class="warning">').concat(esc(D.message(chain.chain_error || ((_c = s.health[D.key("hedges", ui.expiry)]) == null ? void 0 : _c.error) || "").replace(/^Data unavailable$/, "")), "</p>").concat((chain.option_rows || []).length ? "" : empty("No option rows for this expiry", "Check Data health or select another listed expiry and refresh."), '<p class="fine">Provider IV is percent. Chain retrieval does not certify recent trades or individual Greek timestamps.</p>').concat(table(["Strike", "LTP", "Bid", "Ask", "Volume", "OI", "IV", "Delta", "Theta"], ((chain == null ? void 0 : chain.option_rows) || []).map((r) => {
        var _a3, _b3, _c2, _d, _e, _f, _g, _h, _i, _j, _k;
        const q = ui.side === "PE" ? r.put : r.call;
        return [r.strike, money((_b3 = (_a3 = q == null ? void 0 : q.quote) == null ? void 0 : _a3.last_price) != null ? _b3 : q == null ? void 0 : q.ltp), money((_d = (_c2 = q == null ? void 0 : q.quote) == null ? void 0 : _c2.bid) != null ? _d : q == null ? void 0 : q.bid), money((_f = (_e = q == null ? void 0 : q.quote) == null ? void 0 : _e.ask) != null ? _f : q == null ? void 0 : q.ask), num((_h = (_g = q == null ? void 0 : q.quote) == null ? void 0 : _g.volume) != null ? _h : q == null ? void 0 : q.volume, 0), num((_k = (_j = (_i = q == null ? void 0 : q.quote) == null ? void 0 : _i.open_interest) != null ? _j : q == null ? void 0 : q.oi) != null ? _k : q == null ? void 0 : q.open_interest, 0), pct(q == null ? void 0 : q.iv), num(q == null ? void 0 : q.delta, 3), num(q == null ? void 0 : q.theta, 3)];
      })))) + card("Foreground stream preview", '<p class="fine">Observation only. Streams stop when Android pauses the app and never overwrite REST marks.</p><div class="toolbar">'.concat(btn("stream-start", "Start preview")).concat(btn("stream-stop", "Stop"), '</div><div id="stream-view">').concat(streamView(), "</div>")) + card("Data quality", clocks(m.spot), btn("health", "All feeds", 'class="text-button"'));
    }
    if (ui.research === "company") {
      const a = technical();
      body = card("Daily technical evidence", "".concat(badge(a.bias || "Insufficient history", a.stale ? "stale" : ""), '<p class="fine">').concat(a.rows.length, " completed bars \xB7 ").concat(when(a.asOf ? new Date(a.asOf).toISOString() : null), "</p>").concat(table(["Indicator", "Value"], [["SMA20 / 50 / 200", money(a.sma20) + " / " + money(a.sma50) + " / " + money(a.sma200)], ["EMA12 / 26", money(a.ema12) + " / " + money(a.ema26)], ["RSI14", num(a.rsi)], ["MACD / signal / histogram", num(a.macd) + " / " + num(a.signal) + " / " + num(a.hist)], ["ATR14", money(a.atr)], ["MFI14", num(a.mfi)], ["Bollinger lower / upper", money(a.bbLow) + " / " + money(a.bbHigh)], ["Support / resistance", money(a.support) + " / " + money(a.resistance)], ["Pivot / S1 / R1", money(a.pivot) + " / " + money(a.s1) + " / " + money(a.r1)], ["Historical volatility", pct(a.vol)], ["Volume trend", a.volumeTrend]]), '<p class="fine">Locally derived indicators. Recent extremes and pivots are observations, not instructions. Incomplete or stale history withholds directional conclusions.</p>'), btn("technical", "Refresh", 'class="text-button"')) + card("Company fundamentals", "".concat(select("statement", "Reporting basis", [["consolidated", "Consolidated"], ["standalone", "Standalone"]], ui.statement)).concat(btn("fundamentals", "Refresh fundamentals"), '<p class="fine">Provider-reported facts \xB7 retrieved ').concat(when(p == null ? void 0 : p.fetched_at_iso), ". Reporting-period and unit fields remain as returned; missing information is not estimated.</p>").concat(Object.entries({ profile: "Profile", income: "Quarterly income", annual: "Annual income", ratios: "Valuation ratios", balance: "Balance sheet", cash: "Cash flow", shareholding: "Shareholding", actions: "Corporate actions", peers: "Competitors" }).map(([k, v]) => {
        var _a3;
        return "<details><summary>".concat(v).concat(fund[k] ? "" : " \xB7 unavailable", "</summary>").concat(fund[k] ? table(["Provider field / period", "Reported value"], facts(fund[k])) : empty("Unavailable", D.message(((_a3 = p == null ? void 0 : p.errors) == null ? void 0 : _a3[k]) || "No verified data loaded")), "</details>");
      }).join(""), '<a href="https://upstox.com/developer/api-documentation/fundamentals/">Source documentation</a>')) + card("Business notes & events", book.notes.map((n) => '<article class="news-item">'.concat(badge("User-entered note"), "<h3>").concat(esc(n.title), "</h3><p>").concat(esc(n.text), '</p><p class="fine">').concat(esc(n.category), " \xB7 ").concat(date(n.date), " \xB7 Event ").concat(date(n.eventDate), "</p>").concat(n.url ? btn("link", "Source", 'data-url="'.concat(esc(n.url), '" class="text-button"')) : "").concat(btn("note-edit", "Edit", 'data-id="'.concat(esc(n.id), '" class="text-button"')), "</article>")).join("") || empty("No business notes", "Record verified order backlog, execution progress and guidance with source links."), btn("note", "Add note", 'class="text-button"'));
    }
    if (ui.research === "news") {
      let list = ui.filter === "saved" ? book.bookmarks.map((n) => ({ ...n, publishedAt: n.published })) : news();
      if (ui.filter === "official") list = list.filter((n) => n.official);
      const re = { orders: /order|contract|defence|defense/i, results: /profit|revenue|earnings|results|dividend/i, delivery: /deliver|production|engine|tejas|helicopter/i }[ui.filter];
      if (re) list = list.filter((n) => re.test(n.title + " " + n.summary));
      if (ui.search) list = list.filter((n) => n.title.toLowerCase().includes(ui.search.toLowerCase()));
      body = card("HAL newsroom", '<div class="form-grid">'.concat(select("news-filter", "Topic", [["all", "All news"], ["official", "Official filings"], ["orders", "Orders"], ["results", "Results"], ["delivery", "Delivery / execution"], ["saved", "Bookmarks"]], ui.filter)).concat(input("news-search", "Headline search", ui.search, "search"), "</div>").concat(btn("news", "Refresh news")).concat(articleCards(list, 60))) + card("Offline financial sentiment", '<p class="fine">Opt-in English FinBERT classification. Sentiment is text classification, not a HAL price prediction. Model/tokenizer are pinned and checksum verified; excluded from backups.</p>'.concat(row("Model status", ui.finbert.state)).concat(ui.finbert.progress != null ? row("Progress", pct(ui.finbert.progress)) : "", '<p class="fine">').concat(esc(ui.finbert.message), '</p><div class="toolbar">').concat(ui.finbert.state === "ready" ? btn("sentiment", "Classify headlines") + btn("model-remove", "Remove model") : btn("model-install", "Download ~111 MB")).concat(ui.finbert.state === "downloading" ? btn("model-cancel", "Cancel download") : "", "</div>"));
    }
    if (ui.research === "insights") body = card("Change since review", changeView(), btn("checkpoint", "Save checkpoint", 'class="text-button"')) + card("Skills Coach", reviews(I.coach(evidence()))) + card("Historical pattern scanner", '<p class="fine">Normalized return-distance comparison of completed, non-overlapping windows. Sample outcomes are descriptive, not predictive probabilities or backtested trading signals.</p><div class="form-grid">'.concat(input("pattern-window", "Pattern window (sessions)", ui.patternWindow)).concat(input("pattern-forward", "Outcome horizon (sessions)", ui.patternForward), '</div><div class="toolbar">').concat(btn("patterns-load", "Load history")).concat(btn("patterns", "Compare", 'class="primary"'), "</div>").concat(ui.pattern ? '<p class="fine">' + esc(ui.pattern.reason || ui.pattern.metric) + "</p>" + table(["Pattern ended", "Distance \u2193", "Later return"], (ui.pattern.matches || []).map((x) => [when(x.to), num(x.distance, 4), pct(x.outcome)])) + (ui.pattern.summary ? table(["Samples", "Median", "Worst / best"], [[ui.pattern.sampleCount, pct(ui.pattern.summary.median), pct(ui.pattern.summary.min) + " / " + pct(ui.pattern.summary.max)]]) : "") : empty("No scan requested")));
    if (ui.research === "ai") body = card("Evidence-grounded AI Desk", '<p class="fine">Optional Gemini directly from Android. Your own API key and Google quota apply. Local deterministic calculations remain authoritative.</p>'.concat(row("Connection", ui.aiConfigured ? "Configured \xB7 " + ui.model : "Disabled / no API key")).concat(btn("ai-settings", "Manage key")).concat(select("ai-mode", "Workspace", [["copilot", "Position Copilot"], ["deliberate", "Six-Perspective Research"], ["research", "Research Assistant"]], ui.aiMode), '<label><input id="ai-share" type="checkbox" ').concat(ui.share ? "checked" : "", " ").concat(ui.aiMode === "research" ? "disabled" : "", '>Include position evidence</label><label>Question<textarea id="ai-question" maxlength="2000">').concat(esc(ui.question), '</textarea></label><p class="fine">Research Assistant always excludes your portfolio. Credentials, private journal memos and business-note text are excluded.</p><div class="toolbar">').concat(btn("ai-review", "Review exact evidence", 'class="primary"' + (ui.pendingAI ? " disabled" : ""))).concat(ui.pendingAI ? btn("ai-cancel", "Cancel request") : "", '</div><p class="warning">').concat(esc(ui.aiError || (ui.pendingAI ? "Waiting for Gemini\u2026" : "")), "</p>")) + (ui.ai ? card(I.canUseAnswer(ui.ai, book) ? "AI interpretation" : "Previous conclusion invalidated", I.canUseAnswer(ui.ai, book) ? '<p class="fine">Evidence '.concat(when(ui.ai.evidenceAt), " \xB7 ").concat(ui.ai.portfolioIncluded ? "Position " + esc(ui.ai.bookRevision) : "Portfolio excluded", '</p><div class="ai-output">').concat(esc(ui.ai.reply || ui.ai.text || ui.ai.answer || ui.ai.content || "No text returned"), "</div>") : empty("The position changed", "Review updated evidence and request a new answer.")) : "");
    return intro("Research", "HAL evidence, with source quality always in view.") + subnav("research", [["markets", "Markets"], ["company", "Company & Analysis"], ["news", "News"], ["insights", "Insights"], ["ai", "AI Desk"]]) + body;
  }
  function streamView() {
    const x = s.stream;
    return x ? row("State", String(x.state).replace(/_/g, " ")) + row("Decoded frames", num(x.frames, 0)) + table(["Instrument", "Preview price", "Feed time"], (x.rows || []).map((q) => {
      var _a2;
      return [q.key || q.instrument_key || q.instrumentKey, money((_a2 = q.price) != null ? _a2 : q.last_price), when(x.feed_ts ? new Date(x.feed_ts).toISOString() : null)];
    })) : empty("Preview stopped");
  }
  function drawChart() {
    var _a2;
    const el = $("market-chart"), t = technical(ui.frame);
    if (!el || !t.rows.length || !window.LightweightCharts) return;
    const c = getComputedStyle(document.body);
    chart = LightweightCharts.createChart(el, { width: el.clientWidth, height: 300, layout: { background: { color: c.getPropertyValue("--surface").trim() }, textColor: c.getPropertyValue("--muted").trim() }, grid: { vertLines: { color: c.getPropertyValue("--line").trim() }, horzLines: { color: c.getPropertyValue("--line").trim() } }, timeScale: { timeVisible: ui.frame !== "D" }, handleScroll: { vertTouchDrag: false }, localization: { locale: "en-IN", timeFormatter: (v) => when(new Date(v * 1e3).toISOString()) } });
    const cs = chart.addSeries(LightweightCharts.CandlestickSeries, { upColor: "#49b9a3", downColor: "#e88b93", borderVisible: false, wickUpColor: "#49b9a3", wickDownColor: "#e88b93" });
    cs.setData(t.rows.map((r) => ({ time: r.t / 1e3, open: r.o, high: r.h, low: r.l, close: r.c })));
    const vol = chart.addSeries(LightweightCharts.HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "volume" });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    vol.setData(t.rows.map((r) => ({ time: r.t / 1e3, value: r.v, color: r.c >= r.o ? "#38786b" : "#75424d" })));
    for (const [k, color2] of [["sma20", "#bcb4fb"], ["sma50", "#e2be78"]]) if ((_a2 = t.series) == null ? void 0 : _a2[k]) chart.addSeries(LightweightCharts.LineSeries, { color: color2, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }).setData(t.rows.map((r, i) => ({ time: r.t / 1e3, value: t.series[k][i] })).filter((x) => E.finite(x.value)));
    for (const l of book.legs) cs.createPriceLine({ price: l.type === "FUT" ? l.entry : l.strike, color: "#edc78a", lineWidth: 1, lineStyle: 2, title: l.type === "FUT" ? "Futures entry" : "Owned put strike" });
    chart.timeScale().fitContent();
  }
  function render() {
    var _a2;
    if (chart) {
      chart.remove();
      chart = null;
    }
    const m = market(), l = ledger(), r = risk();
    $("connection-state").textContent = configured ? s.loading ? "Refreshing\u2026" : s.failure ? "Connection needs review" : "Upstox \xB7 read only" : "Offline desk \xB7 no token";
    $("session-state").textContent = ((_a2 = m.status) == null ? void 0 : _a2.status) ? String(m.status.status).replace(/_/g, " ") : "Market status unavailable";
    $("refresh").disabled = s.loading;
    $("notice").textContent = storageError ? "Saved book could not be loaded. Existing records preserved. Open Settings \u2192 Recovery." : s.failure ? D.message(s.failure) + " Previous observations remain visible." : s.cached ? "Showing cached observations. Check source and trade timestamps." : "";
    $("notice").hidden = !$("notice").textContent;
    document.querySelectorAll("[data-screen]").forEach((b) => b.setAttribute("aria-current", b.dataset.screen === ui.screen ? "page" : "false"));
    $("main").innerHTML = storageError && ui.screen !== "research" ? intro("Saved book needs recovery", "Existing records are preserved.") + card("Financial values withheld", empty("The saved book could not be validated", "Recover the previous book before editing or valuing the portfolio."), btn("recovery", "Review recovery", 'class="text-button"')) : ui.screen === "today" ? today(m, l, r) : ui.screen === "position" ? position(m, l, r) : ui.screen === "plan" ? plan(m) : research(m);
    if (ui.screen === "research" && ui.research === "markets") drawChart();
  }
  function modal(title, html, label, fn) {
    returnFocus = document.activeElement;
    $("modal-title").textContent = title;
    $("modal-body").innerHTML = html;
    $("modal-error").textContent = "";
    $("modal-save").textContent = label || "Save";
    $("modal-save").hidden = !fn;
    saveModal = fn;
    $("modal").hidden = false;
    document.body.style.overflow = "hidden";
    ($("modal-body").querySelector("input,select,textarea,button") || $("modal-close")).focus();
  }
  function closeModal() {
    $("modal-error").textContent = "";
    $("modal").hidden = true;
    document.body.style.overflow = "";
    saveModal = null;
    if (returnFocus == null ? void 0 : returnFocus.isConnected) returnFocus.focus();
  }
  function legEditor(id) {
    const old = book.legs.find((l2) => l2.id === id), l = old || { type: "FUT", expiry: "", strike: null, lots: 1, lotSize: null, entry: null, manual: null, instrumentKey: null }, listed = market().contracts.filter((c) => ["FUT", "PE"].includes(c.type));
    modal(old ? "Edit recorded position" : "Record HAL position", '<p class="fine">Use exact broker-recorded entries and contract dates. Provider verification is required for automatic valuation. Manual quantities remain labelled unverified until matched.</p>'.concat(select("leg-listed", "Fill from listed contract", [["", "Enter from broker records"], ...l.instrumentKey && !listed.some((c) => c.instrumentKey === l.instrumentKey) ? [[l.instrumentKey, "Saved contract \xB7 currently not listed"]] : [], ...listed.map((c) => [c.instrumentKey, (c.type === "FUT" ? "Future" : c.strike + " PE") + " \xB7 " + date(c.expiry) + " \xB7 lot " + c.lotSize])], l.instrumentKey || ""), '<div class="form-grid">').concat(select("leg-type", "Position type", [["FUT", "Long future"], ["PE", "Long protective put"]], l.type)).concat(input("leg-expiry", "Exact expiry", l.expiry, "date")).concat(input("leg-strike", "Put strike (\u20B9)", l.strike)).concat(input("leg-lots", "Whole lots", l.lots)).concat(input("leg-size", "Units per lot", l.lotSize)).concat(input("leg-entry", "Actual entry / premium (\u20B9)", l.entry)).concat(input("leg-manual", "Manual mark \xB7 blank = REST", l.manual), '</div><p class="fine">A manual zero is valid. Changing a recorded position invalidates confirmation and previous AI conclusions. Existing journal entries are retained.</p>'), "Save position", () => {
      const next = { ...l, id: (old == null ? void 0 : old.id) || "leg-" + Date.now(), type: text("leg-type"), expiry: text("leg-expiry"), strike: value("leg-strike"), lots: value("leg-lots"), lotSize: value("leg-size"), entry: value("leg-entry"), manual: value("leg-manual"), manualAt: value("leg-manual") == null ? null : stamp(), instrumentKey: text("leg-listed") || null };
      E.validateLeg(next);
      const b = clone(book);
      if (old) b.legs[b.legs.findIndex((x) => x.id === old.id)] = next;
      else b.legs.push(next);
      commit(b);
      request("contracts", "D", true);
    });
    $("leg-listed").onchange = () => {
      var _a2;
      const c = listed.find((c2) => c2.instrumentKey === text("leg-listed"));
      if (!c) return;
      $("leg-type").value = c.type;
      $("leg-expiry").value = c.expiry;
      $("leg-strike").value = (_a2 = c.strike) != null ? _a2 : "";
      $("leg-size").value = c.lotSize;
    };
  }
  function closeLeg(id) {
    const l = book.legs.find((l2) => l2.id === id);
    modal("Record completed close", '<p>Record a trade or settlement already completed with your broker. This updates your local journal only.</p><div class="form-grid">'.concat(input("close-lots", "Lots closed", l.lots)).concat(input("close-exit", "Actual exit price (\u20B9)", "")).concat(input("close-fees", "Total charges (\u20B9)", 0)).concat(input("close-date", "Completed trade date", E.istDate(), "date"), '</div><label>Private memo<textarea id="close-note" maxlength="1000"></textarea></label>'), "Record close", () => commit(E.closeLeg(book, id, value("close-lots"), value("close-exit"), value("close-fees"), text("close-date"), { note: text("close-note") })));
  }
  function confirmBook() {
    if (!book.legs.length) throw Error("Record your actual holdings first.");
    modal("Confirm against your broker", table(["Contract", "Expiry", "Lots \xD7 units", "Entry"], book.legs.map((l) => [l.type === "FUT" ? "Future" : l.strike + " PE", date(l.expiry), l.lots + " \xD7 " + l.lotSize, money(l.entry)])) + '<label><input type="checkbox" id="confirm-check">I have checked every open leg and completed close against my broker records.</label>', "Confirm", () => {
      if (!$("confirm-check").checked) throw Error("Check the broker confirmation before saving.");
      const b = clone(book);
      b.riskProfile.confirmedAt = stamp();
      b.riskProfile.confirmedBook = I.materialFingerprint(b);
      if (b.migration) b.migration.reviewRequired = false;
      commit(b);
    });
  }
  function cashEntry() {
    modal("Record cost or cash", select("cash-kind", "Record type", [["fee", "Additional transaction / funding cost"], ["settlement", "Futures settlement cash"], ["funding", "Funding deposit / withdrawal"]], "fee") + input("cash-amount", "Amount \xB7 cash credits + / debits \u2212") + input("cash-date", "Completed date", E.istDate(), "date") + '<label>Private memo<textarea id="cash-note" maxlength="1000"></textarea></label><p class="fine">Costs are deducted once. Settlement and funding cash are separate from investment profit.</p>', "Save", () => commit(E.recordCash(book, text("cash-kind"), value("cash-amount"), text("cash-date"), text("cash-note"))));
  }
  function editJournal(id) {
    const j = book.journal.find((j2) => j2.id === id);
    modal("Correct a journal record", '<p class="fine">Correct price, charges or memo. Contract quantities and the open book are not silently reversed.</p>' + input("journal-date", "Date", j.date, "date") + (j.kind === "close" ? input("journal-exit", "Actual exit", j.exit) + input("journal-fees", "Charges", j.fees) : input("journal-amount", "Amount", j.amount)) + '<label>Private memo<textarea id="journal-note" maxlength="1000">'.concat(esc(j.note), "</textarea></label>"), "Save correction", () => {
      const b = clone(book), x = b.journal.find((x2) => x2.id === id);
      x.date = text("journal-date");
      if (x.date > E.istDate()) throw Error("Completed date cannot be in the future.");
      x.note = text("journal-note");
      if (x.kind === "close") {
        x.exit = value("journal-exit");
        x.fees = value("journal-fees");
      } else x.amount = value("journal-amount");
      commit(b);
    });
  }
  function funding() {
    modal("Manual funding snapshot", input("fund-margin", "Current margin recorded (\u20B9)", book.funding.margin) + input("fund-free", "Available funds recorded (\u20B9)", book.funding.free) + '<p class="fine">Timestamped now. This is your manual observation; the app does not access broker funds.</p>', "Save snapshot", () => {
      const margin = value("fund-margin"), free = value("fund-free");
      if (margin === null || free === null || margin < 0 || free < 0) throw Error("Enter both non-negative balances.");
      commit({ ...book, funding: { margin, free, at: stamp() } });
    });
  }
  function limits() {
    const fields = { capital: "Allocated capital", maxLoss: "Strategy loss review threshold", hedgeBudget: "Hedge budget", reserve: "Minimum cash reserve", reviewBelow: "Review below spot", reviewAbove: "Review above spot" };
    modal("Personal risk limits", '<div class="form-grid">' + Object.entries(fields).map(([k, v]) => input("limit-" + k, v + " (\u20B9)", book.riskProfile[k])).join("") + '</div><p class="fine">Review thresholds, not automatic stops or guaranteed loss limits.</p>', "Save", () => {
      const b = clone(book);
      for (const k of Object.keys(fields)) b.riskProfile[k] = value("limit-" + k);
      commit(b);
    });
  }
  function noteEditor(id) {
    const n = book.notes.find((n2) => n2.id === id) || { title: "", text: "", date: E.istDate(), category: "Other", url: "", eventDate: "" };
    modal("Business note", input("note-title", "Title", n.title, "text") + '<label>Private business note<textarea id="note-text" maxlength="3000">'.concat(esc(n.text), "</textarea></label>") + select("note-category", "Category", ["Order book", "Deliveries", "Guidance", "Results", "Operations", "Other"].map((x) => [x, x]), n.category) + input("note-url", "Verified source HTTPS URL", n.url, "url") + input("note-event", "Event date \xB7 optional", n.eventDate, "date"), "Save note", () => {
      if (!text("note-title").trim()) throw Error("Enter a title.");
      if (text("note-url") && !E.safeURL(text("note-url"))) throw Error("Use a valid HTTPS source link.");
      const next = { ...n, id: n.id || "note-" + Date.now(), date: E.istDate(), title: text("note-title"), text: text("note-text"), category: text("note-category"), url: text("note-url"), eventDate: text("note-event") || null }, b = clone(book);
      if (n.id) b.notes = b.notes.map((x) => x.id === n.id ? next : x);
      else b.notes.push(next);
      commit(b);
    });
  }
  function importPreview(raw) {
    const b = D.previewImport(raw);
    modal("Review backup import", "<p>This backup contains <b>".concat(b.legs.length, " open legs</b>, <b>").concat(b.journal.length, " journal entries</b>, ").concat(b.notes.length, " notes and ").concat(b.bookmarks.length, ' bookmarks.</p><p>The current book will be replaced. A previous-book recovery copy is retained. Credentials are neither imported nor exported.</p><label><input id="import-confirm" type="checkbox">I reviewed this backup and want to replace the local book.</label>'), "Replace book", () => {
      if (!$("import-confirm").checked) throw Error("Confirm the reviewed replacement.");
      commit(b);
      ui.hedgeDraft = null;
      invalidateCalculations();
      render();
      toast("Backup imported. Confirm the restored book against your broker.");
    });
  }
  function recovery() {
    let r;
    const reviewedRevision = revision;
    if (N == null ? void 0 : N.previousBook) {
      r = JSON.parse(N.previousBook());
      if (!r.ok) throw Error(r.message);
      if (!r.book) throw Error("No previous-book recovery copy exists.");
    } else {
      const raw = localStorage.getItem("hal_previous_v4") || localStorage.getItem("hal_before_import_v2");
      if (!raw) throw Error("No recovery copy exists.");
      r = { book: JSON.parse(raw) };
    }
    const b = E.validateBook(r.book);
    modal("Previous-book recovery", "<p>Restore ".concat(b.legs.length, " open legs and ").concat(b.journal.length, " journal records from the previous saved book.</p><p>The current native bytes are retained in a recovery quarantine when supported. Legacy WebView storage is not erased.</p>"), "Restore previous book", () => {
      if (N == null ? void 0 : N.restorePreviousBook) {
        const x = JSON.parse(N.restorePreviousBook(reviewedRevision));
        if (!x.ok) throw Error(x.message);
        book = E.validateBook(x.book);
        revision = x.revision;
        storageError = "";
        ui.ai = null;
        invalidateCalculations();
        ui.hedgeDraft = null;
        ui.pattern = null;
        if (ui.pendingAI) native("aiCancel", ui.pendingAI.id);
        ui.pendingAI = null;
        theme();
        render();
      } else {
        storageError = "";
        commit(b);
      }
    });
  }
  function settings() {
    modal("HAL Desk 4.0.2 \xB7 Settings", '<p class="fine">Personal read-only research. Android 8+. Credentials stay encrypted natively; market and AI calls use fixed HTTPS destinations.</p><div class="toolbar">'.concat(btn("connection", "Upstox connection")).concat(btn("ai-settings", "Gemini settings")).concat(btn("token-page", "Get Analytics Token"), "</div>").concat(select("theme", "Appearance", [["dark", "Graphite dark"], ["light", "Paper light"], ["system", "Follow device"]], book.preferences.theme)).concat(select("mark-mode", "Put valuation marks", [["ltp", "Last traded price"], ["bid", "Quoted bid"]], book.preferences.markMode), '<label><input id="auto-refresh" type="checkbox" ').concat(book.preferences.auto ? "checked" : "", '>Refresh roughly every 60 seconds while foreground</label><p class="fine">Android background monitoring is not guaranteed. No automatic paid AI requests occur.</p><div class="toolbar">').concat(btn("export", "Export JSON")).concat(btn("csv", "Journal CSV")).concat(btn("import", "Import backup")).concat(btn("recovery", "Recovery")).concat(btn("health", "Data health"), "</div>"), "Save preferences", () => commit({ ...book, preferences: { theme: text("theme"), markMode: text("mark-mode"), auto: $("auto-refresh").checked } }));
  }
  function health() {
    modal("Data readiness & connection health", Object.entries(s.health).map(([k, h]) => '<div class="health-row"><div><strong>'.concat(esc(k), "</strong><small>Success ").concat(when(h.lastSuccess), "<br>Failure ").concat(when(h.lastFailure), "</small><small>").concat(esc(h.error ? D.message(h.error) : ""), "</small></div>").concat(badge(h.pending ? "Loading" : h.error ? "Needs review" : h.lastSuccess ? "Retrieved" : "Unavailable", h.error ? "stale" : ""), "</div>")).join("") || empty("No feeds requested"), null, null);
  }
  function scenarioParams() {
    var _a2;
    const p = ui.scenario;
    return { spot: (_a2 = E.value(p.spot)) != null ? _a2 : market().spot.price, horizon: p.horizon || void 0, fallbackIV: E.value(p.iv), ivShift: E.value(p.shift), rate: E.value(p.rate), dividend: E.value(p.dividend), basis: p.basis, baseSpot: E.value(p.base) };
  }
  function readScenario() {
    for (const [k, id] of Object.entries({ spot: "spot", horizon: "horizon", iv: "iv", shift: "shift", rate: "rate", dividend: "dividend", basis: "basis", base: "base" })) if ($("sc-" + id)) ui.scenario[k] = text("sc-" + id);
  }
  function hedgeSettings() {
    return E.hedgePreferences({ budget: value("hg-budget"), maxLoss: value("hg-loss"), protectThrough: text("hg-through") || null, maxSpread: value("hg-spread"), buyFees: value("hg-buy"), exitFees: value("hg-exit"), slippage: value("hg-slip"), ivShift: value("hg-iv"), rate: value("hg-rate"), dividend: value("hg-dividend"), minVolume: value("hg-volume"), minOI: value("hg-oi") });
  }
  function compareHedge(id) {
    const c = ui.hedges.candidates.find((c2) => c2.contract.instrumentKey === id);
    if (!c) return;
    const cur = new Map(ui.hedges.current.map((x) => [x.horizon + "|" + x.shock, x.additionalPnl]));
    modal("Current protection vs replacement", "<h3>".concat(c.contract.strike, " PE \xB7 ").concat(date(c.contract.expiry), " \xB7 ").concat(c.lots, " lots</h3>").concat(row("New premium", money(c.newPremium))).concat(row("Buy / exit charges", money(c.buyFees) + " / " + money(c.exitFees))).concat(row("Existing-put sale proceeds", money(c.saleProceeds))).concat(row("Net cash required", money(c.netCashRequired))).concat(row("Spread / slippage", pct(c.spread) + " / " + pct(c.slippage))).concat(table(["Horizon", "Shock", "Current hedge \u0394P&L", "Replacement \u0394P&L"], c.scenarios.map((x) => [when(x.horizon), pct(x.shock * 100), money(cur.get(x.horizon + "|" + x.shock)), money(x.additionalPnl)])), '<p class="fine">Sale proceeds reduce cash required; they are not new investment profit. Sampled worst loss is not guaranteed. Current-hedge comparisons after earlier put expiry are withheld.</p><details><summary>Missing current comparisons</summary>').concat(table(["Horizon", "Reason"], ui.hedges.currentErrors.map((x) => [when(x.horizon), x.reason])), "</details>"), null, null);
  }
  function aiReview() {
    if (storageError && ui.aiMode !== "research") throw Error("Recover the saved book before sharing position evidence.");
    ui.question = text("ai-question");
    ui.share = $("ai-share").checked;
    const packet = I.evidencePacket(evidence(), { mode: ui.aiMode, includePortfolio: ui.share }), question = ui.question;
    if (!question.trim()) throw Error("Enter a question.");
    modal("Review evidence sent to Gemini", "<p>".concat(packet.portfolioIncluded ? "Includes the shown positions, valuations, risk and funding snapshot." : "Your portfolio is excluded.", ' Private journal memos, credentials and private notes are excluded.</p><p class="fine">Provider API charges or quota limits may apply. Evidence timestamp ').concat(when(packet.generatedAt), ".</p><pre>").concat(esc(JSON.stringify({ question, evidence: packet }, null, 2)), '</pre><label><input id="ai-consent" type="checkbox">Send this question and exact evidence to Google Gemini.</label>'), "Send to Gemini", () => {
      if (!$("ai-consent").checked) throw Error("Explicit evidence-sharing consent is required.");
      const id = "review-" + Date.now();
      ui.aiError = "";
      ui.ai = null;
      ui.pendingAI = { id, evidence: packet };
      native("ai", JSON.stringify({ id, mode: ui.aiMode, message: question, evidence: packet, consent: true }));
      render();
    });
  }
  const actions = { add: () => legEditor(), edit: (b) => legEditor(b.dataset.id), close: (b) => closeLeg(b.dataset.id), verify: () => {
    request("contracts", "D", true);
    toast("Requested exact saved-contract verification.");
  }, confirm: confirmBook, cash: cashEntry, "journal-edit": (b) => editJournal(b.dataset.id), funding, limits, note: () => noteEditor(), "note-edit": (b) => noteEditor(b.dataset.id), settings, connection: () => native("settings"), "token-page": () => native("openTokenPage"), health, recovery, export: () => native("exportBackup", JSON.stringify(D.safeBackup(book), null, 2)), csv: () => native("exportCSV", E.journalCSV(book)), import: () => native("importBackup"), link: (b) => {
    const url = E.safeURL(b.dataset.url);
    if (url) native("openLink", url);
  }, bookmark: (b) => {
    const url = b.dataset.url, n = news().find((n2) => n2.url === url) || book.bookmarks.find((n2) => n2.url === url);
    if (n) commit({ ...book, bookmarks: book.bookmarks.some((x) => x.url === url) ? book.bookmarks.filter((x) => x.url !== url) : [...book.bookmarks, { title: n.title, url, published: n.publishedAt || n.published, source: n.source }] });
  }, checkpoint: () => {
    const c = checkpoint();
    if (!c.quoteAsOf) throw Error("Load a timestamped market observation before saving a checkpoint.");
    commit({ ...book, checkpoints: [...book.checkpoints, c].slice(-5e3) });
    toast("Review checkpoint saved.");
  }, "go-stress": () => navigate("plan", "stress"), "go-news": () => navigate("research", "news"), scenario: () => {
    if (!book.legs.length) throw Error("Record your actual open position before modelling.");
    readScenario();
    ui.result = E.scenario(book, market(), scenarioParams());
    ui.resultAt = stamp();
    render();
  }, "shock-grid": () => {
    if (!book.legs.length) throw Error("Record your actual open position before modelling.");
    readScenario();
    const p = scenarioParams(), m = market();
    if (!E.finite(p.spot)) throw Error("Enter a scenario spot price.");
    ui.result = [0, -0.03, -0.05, -0.1].map((shock) => ({ shock, spot: p.spot * (1 + shock), ...E.scenario(book, m, { ...p, spot: p.spot * (1 + shock) }) }));
    ui.resultAt = stamp();
    render();
  }, "hedge-fetch": () => {
    var _a2;
    const h = hedgeSettings();
    commit({ ...book, hedge: h });
    refresh();
    for (const d of ((_a2 = s.snapshot) == null ? void 0 : _a2.available_expiries) || []) request("hedges", d, true);
    toast("Listed protection refresh requested. Compare after feeds complete.");
  }, "hedge-rank": () => {
    if (!isBookConfirmed()) throw Error("Confirm the current book against broker records first.");
    const h = hedgeSettings();
    commit({ ...book, hedge: h });
    ui.hedges = E.findHedges(book, market(), h);
    ui.hedgesAt = stamp();
    render();
  }, "hedge-detail": (b) => compareHedge(b.dataset.id), frame: (b) => {
    ui.frame = b.dataset.id;
    request("candles", ui.frame);
    render();
  }, candles: () => request("candles", ui.frame, true), technical: () => request("candles", "D", true), fundamentals: () => request("fundamentals", "D", true), chain: () => {
    request("hedges", ui.expiry, true);
  }, news: () => {
    request("news", "D", true);
    request("filings", "D", true);
  }, "stream-start": () => native("streamStart"), "stream-stop": () => native("streamStop"), "patterns-load": () => request("patterns", "D", true), patterns: () => {
    const p = D.rawCandles(s, "D", "patterns");
    if (p.error) throw Error("Historical feed refresh failed. Retry before scanning.");
    ui.pattern = E.patterns(p.raw, { window: value("pattern-window"), forward: value("pattern-forward") });
    render();
  }, "ai-settings": () => native("aiSettings"), "ai-review": aiReview, "ai-cancel": () => {
    if (ui.pendingAI) native("aiCancel", ui.pendingAI.id);
    ui.pendingAI = null;
    ui.aiError = "Cancelled by you.";
    render();
  }, "model-install": () => native("finbertInstall"), "model-cancel": () => native("finbertCancel"), "model-remove": () => modal("Remove offline model", "<p>Remove model files from this phone. Portfolio records remain available.</p>", "Remove model", () => native("finbertRemove")), sentiment: () => {
    const items = news().filter((n) => n.url).slice(0, 12).map((n) => ({ id: n.url, title: n.title.slice(0, 480) }));
    native("finbertScore", JSON.stringify(items));
  } };
  document.addEventListener("click", (ev) => {
    var _a2;
    const a = ev.target.closest("a[href]");
    if (a) {
      ev.preventDefault();
      const u = E.safeURL(a.href);
      if (u) native("openLink", u);
      return;
    }
    const screen = ev.target.closest("[data-screen]"), sub = ev.target.closest("[data-sub]"), b = ev.target.closest("[data-action]");
    try {
      if (screen) navigate(screen.dataset.screen);
      if (sub) {
        ui[ui.screen] = sub.dataset.sub;
        navigate(ui.screen);
      }
      if (b) (_a2 = actions[b.dataset.action]) == null ? void 0 : _a2.call(actions, b);
    } catch (e) {
      toast(e.message);
    }
  });
  function rememberInput(id) {
    if (id.startsWith("sc-")) {
      readScenario();
      ui.result = null;
      ui.resultAt = null;
    }
    if (id.startsWith("hg-")) {
      ui.hedgeDraft = { ...ui.hedgeDraft || book.hedge };
      for (const [k, suffix] of Object.entries({ budget: "budget", maxLoss: "loss", protectThrough: "through", maxSpread: "spread", buyFees: "buy", exitFees: "exit", slippage: "slip", ivShift: "iv", rate: "rate", dividend: "dividend", minVolume: "volume", minOI: "oi" })) if ($("hg-" + suffix)) ui.hedgeDraft[k] = text("hg-" + suffix);
      ui.hedges = null;
      ui.hedgesAt = null;
    }
    if (id === "pattern-window") ui.patternWindow = text(id);
    if (id === "pattern-forward") ui.patternForward = text(id);
    if (id.startsWith("pattern-")) ui.pattern = null;
    if (id === "news-search") ui.search = text(id);
    if (id === "ai-question") ui.question = text(id);
  }
  document.addEventListener("input", (ev) => rememberInput(ev.target.id));
  document.addEventListener("change", (ev) => {
    const id = ev.target.id;
    rememberInput(id);
    if (id === "chain-expiry") {
      ui.expiry = ev.target.value;
      request("hedges", ui.expiry);
      render();
    }
    if (id === "chain-side") {
      ui.side = ev.target.value;
      render();
    }
    if (id === "news-filter") {
      ui.filter = ev.target.value;
      render();
    }
    if (id === "news-search") {
      ui.search = ev.target.value;
      render();
    }
    if (id === "statement") {
      ui.statement = ev.target.value;
      request("fundamentals");
      render();
    }
    if (id === "ai-mode") {
      ui.aiMode = ev.target.value;
      render();
    }
    if (id === "ai-share") ui.share = ev.target.checked;
  });
  $("modal-close").onclick = $("modal-cancel").onclick = closeModal;
  $("modal-save").onclick = () => {
    try {
      saveModal == null ? void 0 : saveModal();
      closeModal();
    } catch (e) {
      $("modal-error").textContent = e.message;
    }
  };
  $("refresh").onclick = () => refresh();
  $("settings").onclick = settings;
  document.addEventListener("keydown", (ev) => {
    if ($("modal").hidden) return;
    if (ev.key === "Escape") closeModal();
    if (ev.key === "Tab") {
      const nodes = [...$("modal").querySelectorAll("button,input,select,textarea,a")].filter((x) => !x.disabled && !x.hidden), first = nodes[0], last = nodes.at(-1);
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      }
      if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  });
  function receive(event, data) {
    var _a2, _b2, _c, _d, _e, _f, _g, _h, _i;
    if (event === "lifecycle" && data.state === "resumed") {
      s.loading = false;
      for (const h of Object.values(s.health)) if (h.pending) {
        h.pending = null;
        h.lastAttempt = null;
      }
      invalidateCalculations();
      if (ui.pendingAI) {
        ui.pendingAI = null;
        ui.aiError = "Cancelled when the app left the foreground.";
      }
    }
    if (event === "connection") {
      configured = !!data.configured;
      if (!started) {
        started = true;
        if (configured) {
          refresh();
          request("candles");
          request("news");
          request("filings");
          request("fundamentals");
        }
      }
    }
    if (event === "ai_connection") {
      ui.aiConfigured = !!data.configured;
      ui.model = data.model || "";
    }
    if (["snapshot", "error", "research", "research_error"].includes(event)) invalidateCalculations();
    if (["loading", "idle", "snapshot", "error", "research", "research_error"].includes(event)) {
      s = D.ingest(s, event, data);
      if (event === "snapshot") {
        const dates = (data.available_expiries || []).filter(E.validDate);
        if (!ui.expiry || dates.length && !dates.includes(ui.expiry)) {
          ui.expiry = dates.includes(data.option_expiry) ? data.option_expiry : dates[0] || "";
          if (ui.expiry && ui.expiry !== data.option_expiry) request("hedges", ui.expiry, true);
        }
        if (!ui.scenario.spot) ui.scenario.spot = (_b2 = (_a2 = data.spot) == null ? void 0 : _a2.last_price) != null ? _b2 : "";
      }
      if (["snapshot", "research", "error", "research_error"].includes(event)) cache();
    }
    if (event === "stream") {
      s = D.ingest(s, event, data);
      if ($("stream-view")) $("stream-view").innerHTML = streamView();
      return;
    }
    if (event === "reset") {
      s = D.empty();
      invalidateCalculations();
      ui.pattern = null;
      cache();
    }
    if (event === "import_preview") {
      try {
        importPreview(data);
      } catch (e) {
        toast("Backup rejected: " + e.message);
      }
      return;
    }
    if (event === "file_saved") toast("File saved.");
    if (event === "file_error") toast(data.message || "File operation failed.");
    if (event === "ai_result" && ((_c = ui.pendingAI) == null ? void 0 : _c.id) === data.id) {
      const p = ui.pendingAI.evidence;
      ui.ai = { ...data.data, evidenceAt: ((_d = data.data) == null ? void 0 : _d.evidenceGeneratedAt) || p.generatedAt, bookRevision: ((_e = data.data) == null ? void 0 : _e.bookRevision) || p.bookRevision, portfolioIncluded: (_g = (_f = data.data) == null ? void 0 : _f.portfolioIncluded) != null ? _g : p.portfolioIncluded };
      ui.pendingAI = null;
    }
    if (event === "ai_error" && ((_h = ui.pendingAI) == null ? void 0 : _h.id) === data.id) {
      ui.aiError = data.message || "Gemini request failed.";
      ui.pendingAI = null;
    }
    if (event === "finbert_status") ui.finbert = { ...ui.finbert, ...data };
    if (event === "finbert_error") ui.finbert = { state: "error", message: data.message };
    if (event === "finbert_results") {
      for (const x of data.items || []) if (["positive", "negative", "neutral"].includes(x.label) && E.finite(x.confidence)) ui.sentiments[x.id] = x;
    }
    if (!((_i = document.activeElement) == null ? void 0 : _i.matches("main input,main select,main textarea"))) render();
  }
  window.HALApp = { receive, back: () => {
    if (!$("modal").hidden) closeModal();
    else if (ui.screen !== "today") navigate("today");
    else native("minimize");
  } };
  try {
    const x = D.loadBook(N, localStorage);
    book = x.book;
    revision = x.revision;
    if (x.migrated) {
      const saved = D.saveBook(N, localStorage, book, revision);
      book = saved.book;
      revision = saved.revision;
    }
  } catch (e) {
    storageError = e.message;
  }
  try {
    let raw;
    if (N == null ? void 0 : N.cacheGet) {
      const r = JSON.parse(N.cacheGet("snapshot"));
      raw = r.ok ? r.data : null;
    } else raw = JSON.parse(localStorage.getItem("hal_cache_v4") || "null");
    if (!raw) {
      const old = JSON.parse(localStorage.getItem("hal_cache_v2") || "null");
      if (old) raw = { snapshot: old.snapshot, research: old.research, lastSuccess: (_a = old.snapshot) == null ? void 0 : _a.fetched_at_iso };
    }
    s = D.restoreCache(raw);
  } catch (_) {
    s = D.empty();
  }
  if (((_b = s.snapshot) == null ? void 0 : _b.option_expiry) && E.expiryTime(s.snapshot.option_expiry) >= Date.now()) ui.expiry = s.snapshot.option_expiry;
  theme();
  render();
  native("ready");
  native("finbertStatus");
  setInterval(() => {
    if (document.visibilityState === "visible" && book.preferences.auto && configured) {
      refresh(false);
    }
  }, 6e4);
  setInterval(() => {
    var _a2;
    for (const [k, h] of Object.entries(s.health)) if (h.pending && Date.now() - Date.parse(h.pending) > 18e4) s = D.ingest(s, "research_error", { key: k, code: "network_unavailable" });
    if (document.visibilityState === "visible" && !((_a2 = document.activeElement) == null ? void 0 : _a2.matches("input,select,textarea")) && $("modal").hidden) render();
  }, 3e4);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      native("streamStop");
      s.loading = false;
      for (const h of Object.values(s.health)) if (h.pending) {
        h.pending = null;
        h.lastAttempt = null;
      }
      invalidateCalculations();
      if (ui.pendingAI) {
        native("aiCancel", ui.pendingAI.id);
        ui.pendingAI = null;
        ui.aiError = "Cancelled when the app left the foreground.";
      }
    }
  });
  const colorScheme = matchMedia("(prefers-color-scheme: light)"), themeChanged = () => {
    theme();
    render();
  };
  if (colorScheme.addEventListener) colorScheme.addEventListener("change", themeChanged);
  else colorScheme.addListener(themeChanged);
  window.addEventListener("resize", () => {
    if (chart) chart.applyOptions({ width: $("market-chart").clientWidth });
  });
})();
