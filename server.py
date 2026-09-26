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
PE_IV = 0.247           # IV implied from user's actual 4500 PE fill (28-Aug-2026)
PE_STRIKE = 4500
FLOOR = 4616.0        # hard floor = 16-Sep-2026 swing low (old 4750 floor failed on 15/16-Sep closes)
REDUCE = 4750.0       # reduce line = old floor / 50-DMA zone
IST = datetime.timezone(datetime.timedelta(hours=5, minutes=30))


# ---------------- data fetch ----------------
def fetch_yahoo():
    err = None
    for host in ('query1', 'query2'):
        url = f'https://{host}.finance.yahoo.com/v8/finance/chart/HAL.NS?range=1y&interval=1d'
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=12) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            err = e
    raise err


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
def build(raw):
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
    fut_oct = spot * (1 + R_FREE * d2e / 365.0)
    pe_est = bs_put(spot, PE_STRIKE, max(d1e, 0) / 365.0, R_FREE, PE_IV)

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
            'fut_est_oct': round(fut_oct, 1),
            'pe_strike': PE_STRIKE, 'pe_iv': PE_IV * 100,
            'pe_est': round(pe_est, 1),
        },
        'daily': rows,
        'series': {'sma20': s20[-130:], 'sma50': s50[-130:], 'sma200': s200[-130:],
                   'rsi': rsi[-130:], 'macd': macd[-130:], 'sig': sig[-130:], 'hist': hist[-130:]},
        'week': rows[-6:],
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
        payload = build(fetch_yahoo())
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
