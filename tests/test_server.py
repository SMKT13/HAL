import datetime as dt
import json
import os
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

import server


def fixture(count=220, end=dt.date(2026, 10, 9)):
    start = end - dt.timedelta(days=count - 1)
    timestamps = [int(dt.datetime.combine(start + dt.timedelta(days=i), dt.time(15, 30),
                                        server.IST).timestamp()) for i in range(count)]
    closes = [100.0 + i for i in range(count)]
    return {'chart': {'error': None, 'result': [{
        'timestamp': timestamps,
        'meta': {'regularMarketPrice': closes[-1], 'regularMarketTime': timestamps[-1],
                 'currency': 'INR', 'marketState': 'CLOSED'},
        'indicators': {'quote': [{'open': closes, 'close': closes,
                                 'high': [v + 2 for v in closes],
                                 'low': [v - 2 for v in closes], 'volume': [1000] * count}]}
    }]}}


class IndicatorTests(unittest.TestCase):
    def test_short_sma_preserves_alignment(self):
        self.assertEqual(server.sma_series([1, 2], 3), [None, None])
        self.assertEqual(server.sma_series([], 3), [])
        self.assertEqual(server.sma_series([1, 2, 3, 4], 3), [None, None, 2, 3])

    def test_rsi_edges(self):
        self.assertEqual(server.rsi_series([10] * 30)[-1], 50)
        self.assertEqual(server.rsi_series(list(range(1, 31)))[-1], 100)
        self.assertEqual(server.rsi_series(list(range(30, 0, -1)))[-1], 0)
        self.assertEqual(server.rsi_series([1, 2]), [None, None])

    def test_atr_uses_mean_seed_then_wilder_smoothing(self):
        # True ranges after the first observation are 4, 6, 8, 10.
        result = server.atr_series([11, 12, 13, 14, 15], [9, 8, 7, 6, 5], [10] * 5, 3)
        self.assertEqual(result[:3], [None, None, None])
        self.assertEqual(result[3], 6)
        self.assertAlmostEqual(result[4], 22 / 3)

    def test_mfi_edges(self):
        flat = [10] * 30
        self.assertEqual(server.mfi_series(flat, flat, flat, [0] * 30)[-1], 50)
        rising = list(range(1, 31))
        self.assertEqual(server.mfi_series(rising, rising, rising, [1] * 30)[-1], 100)


class PayloadTests(unittest.TestCase):
    def test_invalid_bars_are_rejected(self):
        raw = fixture(6)
        result = raw['chart']['result'][0]
        q = result['indicators']['quote'][0]
        q['high'][0] = None
        q['close'][1] = float('nan')
        q['volume'][2] = -1
        q['low'][3] = 2000
        _, rows = server.history(raw)
        self.assertEqual(len(rows), 2)

    def test_error_and_empty_chart_fail_clearly(self):
        for raw in ({'chart': {'result': None, 'error': {'description': 'Unavailable'}}}, fixture(1)):
            with self.assertRaises(ValueError):
                server.history(raw)

    def test_short_history_returns_null_indicators(self):
        data = server.build(fixture(2), now=dt.datetime(2026, 10, 10, tzinfo=server.IST))
        self.assertIsNone(data['ind']['sma20'])
        self.assertIsNone(data['ind']['bb_lo'])
        self.assertEqual(data['ind']['flow_signal'], 'unavailable')
        self.assertEqual(len(data['series']['sma200']), 2)
        json.dumps(data, allow_nan=False)

    def test_partial_today_bar_not_used_for_pivots(self):
        raw = fixture(30, end=dt.date(2026, 10, 10))
        data = server.build(raw, now=dt.datetime(2026, 10, 10, 12, tzinfo=server.IST))
        self.assertEqual(data['levels']['pivot_session'], '2026-10-09')
        self.assertTrue(data['provisional_bar'])
        self.assertAlmostEqual(data['levels']['pivot'], 128)

    def test_same_day_after_cutoff_can_supply_pivots(self):
        data = server.build(fixture(30), now=dt.datetime(2026, 10, 9, 16, tzinfo=server.IST))
        self.assertEqual(data['levels']['pivot_session'], '2026-10-09')
        self.assertFalse(data['provisional_bar'])

    def test_quote_after_latest_bar_uses_latest_prior_close(self):
        raw = fixture(30)
        meta = raw['chart']['result'][0]['meta']
        meta['regularMarketTime'] += 86400
        self.assertEqual(server.build(raw)['quote']['prev_close'], 129)
        meta['regularMarketPreviousClose'] = 125
        self.assertEqual(server.build(raw)['quote']['prev_close'], 125)

    def test_unknown_quote_time_stays_unknown(self):
        raw = fixture()
        del raw['chart']['result'][0]['meta']['regularMarketTime']
        data = server.build(raw)
        self.assertIsNone(data['quote_as_of'])
        self.assertNotIn('fno', data)  # Held contracts are explicit client state.

    def test_nifty_uses_sixty_aligned_returns(self):
        raw = fixture()
        _, rows = server.history(raw)
        result = server.nifty_context(raw, [(row['d'], row['c']) for row in rows])
        self.assertEqual(result['return_observations'], 60)
        self.assertEqual(result['beta60'], 1)
        self.assertEqual(result['corr60'], 1)


class CacheTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.cache = os.path.join(self.temp.name, 'cache.json')
        self.patcher = patch.object(server, 'CACHE_FILE', self.cache)
        self.patcher.start()
        self.addCleanup(self.patcher.stop)

    def seed(self, age=0):
        data = server.build(fixture())
        data['_ts'] = time.time() - age
        server.write_cache(data)
        return data

    def test_warm_cache_does_not_fetch(self):
        self.seed()
        with patch.object(server, 'fetch_yahoo') as fetch:
            result = server.get_data()
        fetch.assert_not_called()
        self.assertEqual(result['data_status'], 'cached')
        self.assertNotIn('_ts', result)

    def test_failed_fetch_preserves_cache_and_time(self):
        initial = self.seed(server.CACHE_TTL + 10)
        with patch.object(server, 'fetch_yahoo', side_effect=ValueError('provider failed')):
            result = server.get_data()
        self.assertTrue(result['stale'])
        self.assertEqual(result['quote_as_of'], initial['quote_as_of'])
        self.assertGreater(result['cache_age_seconds'], server.CACHE_TTL)
        self.assertEqual(server.read_cache()['_ts'], initial['_ts'])

    def test_corrupt_and_obsolete_cache_not_served(self):
        for value in ('{', '[1]', '{"_ts": 123}', '{"schema_version": 2, "_ts": NaN}'):
            with open(self.cache, 'w') as stream:
                stream.write(value)
            self.assertIsNone(server.read_cache())

    def test_atomic_write_failure_keeps_previous_cache(self):
        initial = self.seed()
        with patch.object(server.os, 'replace', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                server.write_cache({'replacement': True})
        self.assertEqual(server.read_cache()['_ts'], initial['_ts'])
        self.assertEqual(os.listdir(self.temp.name), ['cache.json'])

    def test_parallel_refreshes_share_successful_fetch(self):
        with patch.object(server, 'fetch_yahoo', return_value=fixture()) as fetch:
            with ThreadPoolExecutor(max_workers=4) as pool:
                result = list(pool.map(lambda _: server.get_data(force=True), range(4)))
        self.assertEqual(fetch.call_count, 2)  # One HAL request and one NIFTY request.
        self.assertTrue(all(r.get('quote') for r in result))
        self.assertEqual(len([r for r in result if r['data_status'] == 'fresh_fetch']), 1)

    def test_nifty_failure_does_not_discard_hal(self):
        with patch.object(server, 'fetch_yahoo', side_effect=[fixture(), ValueError('NIFTY failed')]):
            result = server.get_data()
        self.assertIn('quote', result)
        self.assertIsNone(result['mkt'])
        self.assertFalse(result['stale'])

    def test_http_unavailable_is_503_and_static_assets_served(self):
        httpd = server.ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        base = f'http://127.0.0.1:{httpd.server_port}'
        try:
            with patch.object(server, 'get_data', return_value={'error':'unavailable'}) as get:
                with self.assertRaises(urllib.error.HTTPError) as failure:
                    urllib.request.urlopen(base + '/api/data?notforce=1')
                self.assertEqual(failure.exception.code, 503)
                get.assert_called_once_with(force=False)
            for path in ('/', '/portfolio.js', '/dashboard.js', '/health'):
                with urllib.request.urlopen(base + path) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
        finally:
            httpd.shutdown()
            httpd.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
