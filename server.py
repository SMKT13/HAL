#!/usr/bin/env python3
"""HAL Dashboard — stdlib-only server.
Serves the dashboard page and /api/data: fetches NSE data for HAL (via Yahoo
Finance chart API, potentially delayed), computes technicals server-side, caches
to disk (15 min TTL) so restarts are instant and offline falls back to cache.
Run: python3 server.py   (binds 0.0.0.0:8000)
"""
import json, math, time, os, datetime, urllib.request
import tempfile
import threading
import agents
import upstox_feed
import research_feed
from urllib.parse import parse_qs, urlsplit
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get('PORT', 8000))
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE = os.path.join(HERE, 'cache.json')
CACHE_TTL = 15 * 60
CACHE_VERSION = 3
CACHE_LOCK = threading.Lock()
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
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


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def history(raw):
    """Validate complete OHLCV bars; sort and deduplicate by IST session date."""
    chart = raw.get('chart', {})
    if chart.get('error') or not chart.get('result'):
        raise ValueError('Market provider returned no chart data')
    result = chart['result'][0]
    quote = result['indicators']['quote'][0]
    rows = {}
    for index, timestamp in enumerate(result.get('timestamp', [])):
        values = [quote.get(key, [])[index] if index < len(quote.get(key, [])) else None
                  for key in ('open', 'high', 'low', 'close', 'volume')]
        if not finite(timestamp) or not all(finite(v) for v in values):
            continue
        o, h, l, c, v = values
        if min(o, h, l, c) <= 0 or v < 0 or h < max(o, c, l) or l > min(o, c):
            continue
        if v == 0 and o == h == l == c:
            continue
        try:
            date = datetime.datetime.fromtimestamp(timestamp, IST).date().isoformat()
        except (OverflowError, OSError, ValueError):
            continue
        rows[date] = dict(d=date, o=o, h=h, l=l, c=c, v=v)
    if len(rows) < 2:
        raise ValueError('At least two valid daily bars are required')
    return result.get('meta', {}), [rows[key] for key in sorted(rows)]


def quote_time(meta):
    timestamp = meta.get('regularMarketTime')
    if finite(timestamp) and timestamp > 0:
        try:
            return datetime.datetime.fromtimestamp(timestamp, IST)
        except (OverflowError, OSError, ValueError):
            pass
    return None


def previous_close(meta, rows):
    supplied = meta.get('regularMarketPreviousClose')
    if finite(supplied) and supplied > 0:
        return supplied
    moment = quote_time(meta)
    date = moment.date().isoformat() if moment else rows[-1]['d']
    previous = [row for row in rows if row['d'] < date]
    return previous[-1]['c'] if previous else rows[-2]['c']


def nifty_context(raw_nifty, hal_closes, now=None):
    """Market regime block: Nifty tech + HAL-beta/corr. Returns None on failure."""
    try:
        m, all_rows = history(raw_nifty)
        now = now or datetime.datetime.now(IST)
        rows = [r for r in all_rows if r['d'] < now.date().isoformat() or (r['d'] == now.date().isoformat() and now.hour >= 16)]
        dates, closes = [r['d'] for r in rows], [r['c'] for r in rows]
        c = closes
        if len(c) < 210:
            return None
        rsi = rsi_series(c)[-1]
        s200 = sum(c[-200:]) / 200
        s20 = sum(c[-20:]) / 20
        # beta/corr 60d vs HAL
        hmap = {d: v for d, v in zip(dates, c)}
        pairs = [(hv, hmap[d]) for d, hv in hal_closes if d in hmap][-61:]
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
        if not finite(price) or price <= 0:
            return None
        prev = previous_close(m, all_rows)
        w52l = min(row['l'] for row in rows); w52h = max(row['h'] for row in rows)
        as_of = quote_time(m)
        return {
            'quote_as_of': as_of.isoformat() if as_of else None,
            'last_session': rows[-1]['d'],
            'return_observations': len(pairs) - 1,
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
    if n <= 0:
        raise ValueError('SMA period must be positive')
    if len(vals) < n:
        return [None] * len(vals)
    out = []
    s = sum(vals[:n]); out.append(s / n)
    for i in range(n, len(vals)):
        s += vals[i] - vals[i - n]
        out.append(s / n)
    return [None] * (n - 1) + out


def strength_index(positive, negative):
    if positive == 0 and negative == 0:
        return 50.0
    if negative == 0:
        return 100.0
    return 100.0 - 100.0 / (1.0 + positive / negative)


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
                out[i] = strength_index(g, l)
        else:
            g = (g * (n - 1) + up) / n
            l = (l * (n - 1) + dn) / n
            out[i] = strength_index(g, l)
    return out


def ema_series(vals, n):
    out = [None] * len(vals); k = 2.0 / (n + 1)
    prev = None
    for i, v in enumerate(vals):
        prev = v if prev is None else v * k + prev * (1 - k)
        out[i] = prev
    return out


def atr_series(hi, lo, cl, n=14):
    out = [None] * len(cl); a = None; seed = []
    for i in range(1, len(cl)):
        tr = max(hi[i] - lo[i], abs(hi[i] - cl[i - 1]), abs(lo[i] - cl[i - 1]))
        if len(seed) < n:
            seed.append(tr)
            if len(seed) == n:
                a = sum(seed) / n
        else:
            a = (a * (n - 1) + tr) / n
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
            out[i] = strength_index(max(0.0, pos), max(0.0, neg))
    return out


# ---------------- build payload ----------------
def build(raw, mkt=None, now=None):
    now = now or datetime.datetime.now(IST)
    m, rows = history(raw)
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
    # Same-day bars remain provisional until 16:00 IST. Holidays are not inferred.
    complete = [row for row in rows if row['d'] < now.date().isoformat()
                or (row['d'] == now.date().isoformat() and now.hour >= 16)]
    if not complete:
        raise ValueError('No completed market session available')
    pivot_bar = complete[-1]
    # Indicator summaries use completed sessions; chart arrays retain alignment.
    i = rows.index(pivot_bar) if pivot_bar else -1
    H, L, C = (pivot_bar[key] for key in ('h', 'l', 'c')) if pivot_bar else (None, None, None)
    P = (H + L + C) / 3.0 if pivot_bar else None
    spot = m.get('regularMarketPrice')
    if not finite(spot) or spot <= 0:
        raise ValueError('Market provider returned an invalid price')
    w52h = m.get('fiftyTwoWeekHigh')
    w52l = m.get('fiftyTwoWeekLow')
    w52h = w52h if finite(w52h) and w52h > 0 else max(row['h'] for row in rows)
    w52l = w52l if finite(w52l) and w52l > 0 else min(row['l'] for row in rows)
    if w52h < w52l:
        raise ValueError('Market provider returned an invalid annual range')
    fib = {f: round(w52h - (w52h - w52l) * f, 1) for f in (0.236, 0.382, 0.5, 0.618)}
    as_of = quote_time(m)
    spread = mfi[i] - rsi[i] if mfi[i] is not None and rsi[i] is not None else None
    def meta_or_bar(name, key):
        value = m.get(name)
        if finite(value) and (value >= 0 if key == 'v' else value > 0):
            return value
        return last[key] if as_of and as_of.date().isoformat() == last['d'] else None

    ann_vol = None
    completed_cl = cl[:i + 1]
    if len(completed_cl) >= 21:
        rets = [math.log(completed_cl[j] / completed_cl[j - 1]) for j in range(len(completed_cl) - 20, len(completed_cl))]
        mu = sum(rets) / len(rets)
        ann_vol = math.sqrt(sum((x - mu) ** 2 for x in rets) / (len(rets) - 1)) * math.sqrt(252) * 100

    return {
        'schema_version': CACHE_VERSION,
        'fetched_at': now.strftime('%d-%b-%Y %H:%M:%S IST'),
        'fetched_at_iso': now.isoformat(),
        'source': 'Yahoo Finance chart API (HAL.NS)',
        'quote_as_of': as_of.isoformat() if as_of else None,
        'last_session': last['d'],
        'indicator_session': pivot_bar['d'] if pivot_bar else None,
        'provisional_bar': last['d'] == now.date().isoformat() and now.hour < 16,
        'history_bars': len(rows),
        'delay_note': 'Quotes may be delayed; provider latency is not guaranteed.',
        'market_state': m.get('marketState', 'Unknown (provider did not specify)'),
        'currency': m.get('currency', 'INR'),
        'quote': {
            'price': spot,
            'prev_close': previous_close(m, rows),
            'open': meta_or_bar('regularMarketOpen', 'o'),
            'day_high': meta_or_bar('regularMarketDayHigh', 'h'),
            'day_low': meta_or_bar('regularMarketDayLow', 'l'),
            'volume': meta_or_bar('regularMarketVolume', 'v'),
            'w52h': w52h, 'w52l': w52l,
        },
        'ind': {
            'sma20': s20[i], 'sma50': s50[i], 'sma200': s200[i],
            'rsi14': rsi[i], 'macd': macd[i], 'macd_sig': sig[i], 'macd_hist': hist[i],
            'hist_prev': hist[i - 1], 'atr14': atr[i],
            'bb_lo': mid[i] - 2 * sd[i] if sd[i] is not None else None,
            'bb_mid': mid[i], 'bb_up': mid[i] + 2 * sd[i] if sd[i] is not None else None,
            'mfi14': mfi[i],
            'mfi_rsi_spread': spread,
            'flow_signal': ('unavailable' if spread is None else
                            'acc' if spread >= 8 else 'dist' if spread <= -8 else 'neutral'),
            'ann_vol_realized': ann_vol,
        },
        'levels': {
            'pivot': P, 'pivot_session': pivot_bar['d'] if pivot_bar else None,
            'r1': 2 * P - L if P is not None else None,
            'r2': P + H - L if P is not None else None,
            's1': 2 * P - H if P is not None else None,
            's2': P - H + L if P is not None else None,
            'gate': s20[i],           # descriptive trend reference
            'stop': s50[i],           # 50-DMA (dynamic, info)
            'fib': fib,
        },
        'daily': rows,
        'series': {'sma20': s20, 'sma50': s50, 'sma200': s200,
                   'rsi': rsi, 'macd': macd, 'sig': sig, 'hist': hist},
        'week': rows[-6:],
        'mkt': mkt,  # Nifty context (may be None)
    }


# ---------------- cache + http ----------------
def read_cache():
    try:
        with open(CACHE_FILE, encoding='utf-8') as stream:
            cached = json.load(stream)
        if (cached.get('schema_version') == CACHE_VERSION
                and finite(cached.get('_ts')) and cached['_ts'] <= time.time()
                and finite(cached.get('quote', {}).get('price'))
                and cached['quote']['price'] > 0 and cached.get('daily')
                and cached.get('ind') and cached.get('levels') and cached.get('series')):
            json.dumps(cached, allow_nan=False)
            return cached
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return None


def write_cache(payload):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8',
                                         dir=os.path.dirname(CACHE_FILE),
                                         prefix='.hal-cache-', delete=False) as stream:
            temporary = stream.name
            json.dump(payload, stream, allow_nan=False)
        os.replace(temporary, CACHE_FILE)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def public_payload(payload, status, error=None):
    data = dict(payload)
    timestamp = data.pop('_ts', None)
    data['data_status'] = status
    data['stale'] = status == 'stale'
    data['cache_age_seconds'] = round(max(0, time.time() - timestamp)) if timestamp else None
    if error:
        data['error'] = error
    return data


def get_data(force=False):
    # Serialize refreshes and re-read after acquiring the lock to avoid torn writes
    # and duplicate upstream requests from simultaneous browser refreshes.
    with CACHE_LOCK:
        cached = read_cache()
        if cached:
            age = time.time() - cached['_ts']
            if age < (30 if force else CACHE_TTL):
                return public_payload(cached, 'cached')
        try:
            raw = fetch_yahoo('HAL.NS')
            _, rows = history(raw)
            mkt = None
            try:
                raw_nifty = fetch_yahoo('%5ENSEI')
                mkt = nifty_context(raw_nifty, [(r['d'], r['c']) for r in rows])
            except Exception:
                pass  # HAL remains available when the optional NIFTY feed fails.
            payload = build(raw, mkt=mkt)
            payload['_ts'] = time.time()
            json.dumps(payload, allow_nan=False)
            try:
                write_cache(payload)
            except OSError:
                payload['cache_write_failed'] = True
            return public_payload(payload, 'fresh_fetch')
        except Exception as exc:
            print(f'Market refresh failed: {type(exc).__name__}: {exc}', flush=True)
            message = 'Market provider unavailable or returned invalid data.'
            if cached:
                return public_payload(cached, 'stale', message)
            return {'error': message, 'data_status': 'unavailable', 'stale': True}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlsplit(self.path)
        path = url.path
        if path == '/api/agents':
            data = get_data()
            if not data.get('quote'):
                self._send(503, b'{"error":"Market data unavailable"}', 'application/json')
            else:
                result = agents.analyze(data)
                self._send(200, json.dumps(result, allow_nan=False).encode(), 'application/json')
        elif path == '/api/upstox/research':
            if not upstox_feed.authorized(self.headers.get('X-HAL-Viewer-Key', '')):
                self._send(403, b'{"error":"Viewer access not configured or unauthorized"}', 'application/json')
            else:
                params = parse_qs(url.query)
                try:
                    result = research_feed.load(params.get('section', ['candles'])[0],
                                                params.get('frame', ['D'])[0],
                                                params.get('type', ['consolidated'])[0])
                    self._send(200, json.dumps(result, allow_nan=False).encode(), 'application/json')
                except upstox_feed.FeedError as exc:
                    self._send(503, json.dumps({'error': str(exc)}).encode(), 'application/json')
                except Exception:
                    self._send(503, b'{"error":"research_unavailable"}', 'application/json')
        elif path == '/api/upstox/hal':
            # Never make broker-sourced data publicly accessible by default.
            # A separately configured viewer key is mandatory; the OAuth token
            # is used only in the backend for authorized read-only requests.
            key = self.headers.get('X-HAL-Viewer-Key', '')
            if not upstox_feed.authorized(key):
                self._send(403, b'{"error":"Viewer access not configured or unauthorized"}', 'application/json')
            else:
                expiry = parse_qs(url.query).get('expiry', [None])[0]
                try:
                    result = upstox_feed.snapshot(expiry)
                    self._send(200, json.dumps(result, allow_nan=False).encode(), 'application/json')
                except upstox_feed.FeedError as exc:
                    status = 400 if str(exc) in ('invalid_expiry', 'expiry_not_listed') else 503
                    self._send(status, json.dumps({'error': str(exc)}).encode(), 'application/json')
                except Exception:
                    self._send(503, b'{"error":"market_data_unavailable"}', 'application/json')
        elif path == '/health':
            self._send(200, b'{"status":"ok"}', 'application/json')
        elif path == '/api/data':
            force = parse_qs(url.query).get('force') == ['1']
            data = get_data(force=force)
            self._send(200 if data.get('quote') else 503,
                       json.dumps(data, allow_nan=False).encode(), 'application/json')
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
