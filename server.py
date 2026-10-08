#!/usr/bin/env python3
"""HAL Dashboard — stdlib-only server.
Serves the dashboard page and /api/data: fetches NSE data for HAL (via Yahoo
Finance chart API, delayed ~15 min), computes technicals server-side, caches
to disk (15 min TTL) so restarts are instant and offline falls back to cache.
Run: python3 server.py   (binds 0.0.0.0:8000)
"""
import json, math, time, os, calendar, datetime, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8000))
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(HERE, 'cache.json')
CACHE_TTL = 15 * 60
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
R_FREE = 0.065          # risk-free for futures carry / BS
PE_IV = 0.40            # post-breakdown IV regime (fills implied ~33% Mon; crash re-priced to ~40)
PE_STRIKE = 4500        # Oct 4500 PE (150 qty @ 57.40)
PE2_STRIKE = 4300       # Oct 4300 PE (150 qty @ 24.10)
FLOOR = 4616.0        # hard floor = 16-Sep-2026 swing low (old 4750 floor failed on 15/16-Sep closes)
REDUCE = 4750.0       # reduce line = old floor / 50-DMA zone
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


# ---------------- data fetch ----------------
def fetch_yahoo(symbol='HAL.NS'):
    err = None
    for host in ('query1', 'query2'):
        url = f'https://{host}.finance.yahoo.com/v8/finance/chart/{symbol}?range=1y&interval=1d'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=12) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            err = e
    raise err


def nifty_context(raw_nifty, hal_closes):
    """Market regime block: Nifty tech + HAL-beta/corr. Returns None on failure."""
    try:
        r = raw_nifty['chart']['result'][0]
        m = r['meta']; q = r['indicators']['quote'][0]
        dates, closes = [], []
        for i in range(len(r['timestamp'])):
            if q['close'][i] is None:
                continue
            if q['volume'][i] == 0 and q['open'][i] == q['close'][i] == q['high'][i] == q['low'][i]:
                continue
            dates.append(datetime.datetime.fromtimestamp(r['timestamp'][i], IST).strftime('%Y-%m-%d'))
            closes.append(q['close'][i])
        c = closes
        if len(c) < 210:
            return None
        # RSI
        g = l = 0.0
        for i in range(1, len(c)):
            ch_ = c[i] - c[i - 1]
            up, dn = max(ch_, 0.0), max(-ch_, 0.0)
            if i <= 14:
                g += up; l += dn
                if i == 14:
                    g /= 14; l /= 14
            else:
                g = (g * 13 + up) / 14; l = (l * 13 + dn) / 14
        rsi = 100.0 - 100.0 / (1.0 + (g / l if l else 999))
        s200 = sum(c[-200:]) / 200
        s20 = sum(c[-20:]) / 20
        # beta/corr 60d vs HAL
        hmap = {d: v for d, v in zip(dates, c)}
        pairs = [(hv, hmap[d]) for d, hv in hal_closes if d in hmap][-60:]
        if len(pairs) >= 40:
            hr = [pairs[i][0] / pairs[i - 1][0] - 1 for i in range(1, len(pairs))]
            nr = [pairs[i][1] / pairs[i - 1][1] - 1 for i in range(1, len(pairs))]
            n = len(hr)
            mh = sum(hr) / n; mn = sum(nr) / n
            cov = sum((a - mh) * (b - mn) for a, b in zip(hr, nr)) / n
            vh = sum((a - mh) ** 2 for a in hr) / n
            vn = sum((b - mn) ** 2 for b in nr) / n
            beta = cov / vn if vn else None
            corr = cov / math.sqrt(vh * vn) if (vh > 0 and vn > 0) else None
        else:
            beta = corr = None
        price = m['regularMarketPrice']
        prev = c[-2] if len(c) > 1 else price
        w52l = min(c); w52h = max(c)
        return {
            'price': round(price, 1), 'prev': round(prev, 1),
            'chg_pct': round((price / prev - 1) * 100, 2),
            'rsi14': round(rsi, 1),
            's20': round(s20), 's200': round(s200),
            'w52l': round(w52l), 'w52h': round(w52h),
            'above_200dma': price > s200, 'above_20dma': price > s20,
            'dist_52wl_pct': round((price / w52l - 1) * 100, 1),
            'beta60': round(beta, 2) if beta is not None else None,
            'corr60': round(corr, 2) if corr is not None else None,
        }
    except Exception:
        return None


# ---------------- indicators ----------------
def sma_series(vals, n):
    out = []
    s = sum(vals[:n]); out.append(s / n)
    for i in range(n, len(vals)):
        s += vals[i] - vals[i - n]
        out.append(s / n)
    return [None] * (n - 1) + out


def rsi_series(closes, n=14):
    out = [None] * len(closes)
    g = l = 0.0
    for i in range(1, len(closes)):
        ch = closes[i] - closes[i - 1]
        up = max(ch, 0.0); dn = max(-ch, 0.0)
        if i <= n:
            g += up; l += dn
            if i == n:
                g /= n; l /= n
                out[i] = 100.0 - 100.0 / (1.0 + (g / l if l else 999))
        else:
            g = (g * (n - 1) + up) / n
            l = (l * (n - 1) + dn) / n
            out[i] = 100.0 - 100.0 / (1.0 + (g / l if l else 999))
    return out


def ema_series(vals, n):
    out = [None] * len(vals); k = 2.0 / (n + 1)
    prev = None
    for i, v in enumerate(vals):
        prev = v if prev is None else v * k + prev * (1 - k)
        out[i] = prev
    return out


def atr_series(hi, lo, cl, n=14):
    out = [None] * len(cl); a = None
    for i in range(1, len(cl)):
        tr = max(hi[i] - lo[i], abs(hi[i] - cl[i - 1]), abs(lo[i] - cl[i - 1]))
        a = tr if a is None else (a * (n - 1) + tr) / n
        out[i] = a
    return out



def mfi_series(hi, lo, cl, vol, n=14):
    out = [None] * len(cl); pos = 0.0; neg = 0.0
    for i in range(1, len(cl)):
        tp = (hi[i] + lo[i] + cl[i]) / 3.0
        ptp = (hi[i-1] + lo[i-1] + cl[i-1]) / 3.0
        mf = tp * vol[i]
        if tp > ptp: pos += mf
        elif tp < ptp: neg += mf
        if i > n:
            j = i - n
            tpj = (hi[j] + lo[j] + cl[j]) / 3.0
            tpjp = (hi[j-1] + lo[j-1] + cl[j-1]) / 3.0
            mfj = tpj * vol[j]
            if tpj > tpjp: pos -= mfj
            elif tpj < tpjp: neg -= mfj
        if i >= n:
            out[i] = 100.0 - 100.0 / (1.0 + (pos / neg if neg else 999.0))
    return out


def bs_put(S, K, T, r, iv):
    if T <= 0:
        return max(0.0, K - S)
    d1 = (math.log(S / K) + (r + iv * iv / 2) * T) / (iv * math.sqrt(T))
    d2 = d1 - iv * math.sqrt(T)
    N = lambda x: 0.5 * (1 + math.erf(x / math.sqrt(2)))
    return K * math.exp(-r * T) * N(-d2) - S * N(-d1)


def last_tuesday(y, m):
    wd, nd = calendar.monthrange(y, m)
    d = datetime.date(y, m, nd)
    return d - datetime.timedelta(days=(d.weekday() - 1) % 7)


def next_expiries(today, count=2):
    out = []
    y, m = today.year, today.month
    while len(out) < count:
        t = last_tuesday(y, m)
        if t >= today:
            out.append(t.isoformat())
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


# ---------------- build payload ----------------
def build(raw, raw_nifty=None, mkt=None):
    global MKT
    MKT = mkt
    r = raw['chart']['result'][0]
    m = r['meta']
    q = r['indicators']['quote'][0]
    rows = []
    for i in range(len(r['timestamp'])):
        if q['close'][i] is None:
            continue
        # drop stub/holiday artifact bars (flat OHLC, zero volume)
        if q['volume'][i] == 0 and q['open'][i] == q['close'][i] == q['high'][i] == q['low'][i]:
            continue
        rows.append({
            'd': datetime.datetime.fromtimestamp(r['timestamp'][i], IST).strftime('%Y-%m-%d'),
            'o': q['open'][i], 'h': q['high'][i], 'l': q['low'][i],
            'c': q['close'][i], 'v': q['volume'][i]})
    cl = [x['c'] for x in rows]; hi = [x['h'] for x in rows]; lo = [x['l'] for x in rows]

    s20 = sma_series(cl, 20); s50 = sma_series(cl, 50)
    s200 = sma_series(cl, 200)
    rsi = rsi_series(cl)
    macd = [a - b for a, b in zip(ema_series(cl, 12), ema_series(cl, 26))]
    sig = ema_series([0.0 if v is None else v for v in macd], 9)
    hist = [None if (a is None or b is None) else a - b for a, b in zip(macd, sig)]
    atr = atr_series(hi, lo, cl)
    mfi = mfi_series(hi, lo, cl, [x['v'] for x in rows])
    mid = sma_series(cl, 20)
    sd = [None] * len(cl)
    for i in range(19, len(cl)):
        w = cl[i - 19:i + 1]; mu = sum(w) / 20
        sd[i] = math.sqrt(sum((x - mu) ** 2 for x in w) / 20)

    last = rows[-1]
    i = len(rows) - 1
    H, L, C = last['h'], last['l'], last['c']
    P = (H + L + C) / 3.0

    spot = m['regularMarketPrice']
    w52h, w52l = m['fiftyTwoWeekHigh'], m['fiftyTwoWeekLow']
    fib = {f: round(w52h - (w52h - w52l) * f, 1) for f in (0.236, 0.382, 0.5, 0.618)}

    today = datetime.datetime.now(IST).date()
    exp = next_expiries(today, 2)
    d1e = (datetime.date.fromisoformat(exp[0]) - today).days
    d2e = (datetime.date.fromisoformat(exp[1]) - today).days
    # futures carry to the far month only during roll week (near expiry < 7d)
    fut_days = d1e if d1e >= 7 else d2e
    fut_est = spot * (1 + R_FREE * fut_days / 365.0)
    # options track the next LIVE monthly (roll past an expiring contract)
    opt_days = d1e if d1e >= 1 else d2e
    opt_expiry = exp[0] if opt_days == d1e else exp[1]
    pe_est = bs_put(spot, PE_STRIKE, max(opt_days, 0) / 365.0, R_FREE, PE_IV)
    pe2_est = bs_put(spot, PE2_STRIKE, max(opt_days, 0) / 365.0, R_FREE, PE_IV)

    ann_vol = None
    if len(cl) > 21:
        rets = [math.log(cl[i] / cl[i - 1]) for i in range(len(cl) - 20, len(cl))]
        mu = sum(rets) / len(rets)
        ann_vol = math.sqrt(sum((x - mu) ** 2 for x in rets) / (len(rets) - 1)) * math.sqrt(252) * 100

    return {
        'fetched_at': datetime.datetime.now(IST).strftime('%d-%b-%Y %H:%M:%S IST'),
        'market_state': m.get('marketState', '?'),
        'currency': m.get('currency', 'INR'),
        'quote': {
            'price': spot,
            'prev_close': cl[-2] if len(cl) > 1 else spot,
            'open': m.get('regularMarketOpen'),
            'day_high': m.get('regularMarketDayHigh'),
            'day_low': m.get('regularMarketDayLow'),
            'volume': m.get('regularMarketVolume'),
            'w52h': w52h, 'w52l': w52l,
        },
        'ind': {
            'sma20': s20[i], 'sma50': s50[i], 'sma200': s200[i],
            'rsi14': rsi[i], 'macd': macd[i], 'macd_sig': sig[i], 'macd_hist': hist[i],
            'hist_prev': hist[i - 1], 'atr14': atr[i],
            'bb_lo': mid[i] - 2 * sd[i], 'bb_mid': mid[i], 'bb_up': mid[i] + 2 * sd[i],
            'mfi14': mfi[i],
            'mfi_rsi_spread': (mfi[i] - rsi[i]) if (mfi[i] is not None and rsi[i] is not None) else None,
            'flow_signal': ('acc' if ((mfi[i] or 0) - (rsi[i] or 0)) >= 8
                            else 'dist' if ((mfi[i] or 0) - (rsi[i] or 0)) <= -8
                            else 'neutral'),
            'ann_vol_realized': ann_vol,
        },
        'levels': {
            'pivot': P, 'r1': 2 * P - L, 'r2': P + (H - L), 's1': 2 * P - H, 's2': P - (H - L),
            'gate': s20[i],           # 20-DMA: recovery-confirm line
            'reduce': REDUCE,         # old floor / 50-DMA zone: close below = cut 1 lot
            'floor': FLOOR,           # 16-Sep-2026 swing low: close below = exit all
            'stop': s50[i],           # 50-DMA (dynamic, info)
            'target1': 5000.0, 'target2': w52h,
            'fib': fib,
        },
        'fno': {
            'lot': 150,
            'expiry1': exp[0], 'days1': d1e,
            'expiry2': exp[1], 'days2': d2e,
            'fut_expiry': exp[0] if fut_days == d1e else exp[1], 'fut_days': fut_days,
            'opt_expiry': opt_expiry, 'opt_days': opt_days,
            'fut_est': round(fut_est, 1),
            'pe_strike': PE_STRIKE, 'pe2_strike': PE2_STRIKE,
            'pe_iv': PE_IV * 100,
            'pe_est': round(pe_est, 1), 'pe2_est': round(pe2_est, 1),
        },
        'daily': rows,
        'series': {'sma20': s20[-130:], 'sma50': s50[-130:], 'sma200': s200[-130:],
                   'rsi': rsi[-130:], 'macd': macd[-130:], 'sig': sig[-130:], 'hist': hist[-130:]},
        'week': rows[-6:],
        'mkt': MKT,  # Nifty context (may be None)
    }


# ---------------- cache + http ----------------
def get_data(force=False):
    cached = None
    if os.path.exists(CACHE_FILE):
        try:
            cached = json.load(open(CACHE_FILE))
        except Exception:
            cached = None
    if cached and not force and time.time() - cached['_ts'] < CACHE_TTL:
        cached['stale'] = False
        return cached
    try:
        raw = fetch_yahoo('HAL.NS')
        try:
            raw_n = fetch_yahoo('%5ENSEI')
        except Exception:
            raw_n = None
        # compute HAL closes list from raw for beta
        rr = raw['chart']['result'][0]; qq = rr['indicators']['quote'][0]
        hal_closes = []
        for i in range(len(rr['timestamp'])):
            if qq['close'][i] is None:
                continue
            if qq['volume'][i] == 0 and qq['open'][i] == qq['close'][i] == qq['high'][i] == qq['low'][i]:
                continue
            hal_closes.append((datetime.datetime.fromtimestamp(rr['timestamp'][i], IST).strftime('%Y-%m-%d'),
                               qq['close'][i]))
        mkt = nifty_context(raw_n, hal_closes) if raw_n else None
        payload = build(raw, raw_n, mkt)
        payload['_ts'] = time.time()
        payload['stale'] = False
        try:
            json.dump(payload, open(CACHE_FILE, 'w'))
        except Exception:
            pass
        return payload
    except Exception as e:
        if cached:
            cached['stale'] = True
            cached['error'] = str(e)
            return cached
        return {'error': str(e), 'stale': True, 'fetched_at': datetime.datetime.now(IST).strftime('%d-%b-%Y %H:%M:%S IST')}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split('?')[0]
        if path in ('/', '/index.html'):
            try:
                body = open(os.path.join(HERE, 'index.html'), 'rb').read()
                self._send(200, body, 'text/html; charset=utf-8')
            except FileNotFoundError:
                self._send(404, b'missing index.html', 'text/plain')
        elif path == '/api/data':
            force = 'force=1' in self.path
            data = get_data(force=force)
            data.pop('_ts', None)
            self._send(200, json.dumps(data).encode(), 'application/json')
        elif path == '/favicon.ico':
            self._send(204, b'', 'text/plain')
        else:
            self._send(404, b'not found', 'text/plain')

    def log_message(self, fmt, *args):
        pass  # quiet


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'HAL dashboard serving on 0.0.0.0:{PORT}', flush=True)
    srv.serve_forever()
