"""Offline research, authentication and contract mapping. Synthetic fixtures."""
import datetime as dt
import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from unittest.mock import patch
from http.server import ThreadingHTTPServer
import research_feed as r
import upstox_feed as u
import server

class ResearchTests(unittest.TestCase):
    def setUp(self):
        r.CACHE.clear(); u.CACHED.clear()

    def test_readonly_path_allowlist(self):
        for path in ('/v2/order/place', '/v2/portfolio/short-term-positions', '/v2/news/../order/place', '//evil.example/news'):
            self.assertFalse(r.allowed_path(path))
            with self.assertRaises(u.FeedError): r.api(path, {}, 'fake')
        self.assertTrue(r.allowed_path('/v2/fundamentals/INE066F01020/cash-flow'))
        self.assertTrue(r.allowed_path('/v3/historical-candle/NSE_EQ%7CINE066F01020/days/1/2026-10-15/2025-07-01'))

    def test_rss_exact_hal_and_no_entities(self):
        raw = b'<rss><channel><item><title>HAL - Results</title><link>https://nsearchives.nseindia.com/a.pdf</link></item><item><title>HALDER company</title></item><item><title>Hindustan Aeronautics Limited</title></item></channel></rss>'
        self.assertEqual(len(r.parse_rss(raw, 'fixture')), 2)
        with self.assertRaises(ValueError): r.parse_rss(b'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>', 'fixture')

    def test_bad_research_parameters_rejected(self):
        for args in [('orders', 'D', 'consolidated'), ('news', 'D', 'bad'), ('chain', '2026-02-30', 'consolidated'), ('candles', '../other', 'consolidated')]:
            with self.assertRaises(u.FeedError): r.load(*args)

    def test_fundamentals_partial_failure_and_matching_basis(self):
        def api(path, params, token):
            if path.endswith('cash-flow'): raise u.FeedError('upstox_permission_denied')
            return {'path': path, 'params': params}
        with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'TEST-SECRET'}), patch.object(u, 'hal_underlying', return_value='NSE_EQ|INE066F01020'), patch.object(r, 'api', side_effect=api):
            data = r.load('fundamentals', 'D', 'standalone')
        self.assertEqual(data['errors']['cash'], 'upstox_permission_denied')
        self.assertEqual(data['data']['income']['params']['type'], 'standalone')
        self.assertEqual(data['data']['annual']['params']['time_period'], 'yearly')
        self.assertNotIn('TEST-SECRET', json.dumps(data)); self.assertEqual(len(data['data']), 8)

    def test_token_rotation_invalidates_cache(self):
        with patch.object(r, 'api', return_value={'status': 'NORMAL_OPEN'}) as call:
            with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'one'}): r.load('status'); r.load('status')
            with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'two'}): r.load('status')
            self.assertEqual(call.call_count, 2)

    def test_redirect_is_rejected(self):
        for handler in (r.NoRedirect(), u.NoRedirect()):
            with self.assertRaises(u.FeedError): handler.redirect_request(None, None, 302, '', {}, 'https://other.example')

    def test_server_has_exact_option_lots_and_bid(self):
        expiry = (dt.datetime.now(u.IST).date() + dt.timedelta(days=30)).isoformat()
        def call(path, params, token):
            if path == '/option/contract': return [{'underlying_symbol': 'HAL', 'expiry': expiry, 'instrument_key': 'NSE_FO|PE', 'lot_size': 125}]
            if path == '/market-quote/quotes': return {'spot': {'instrument_token': 'NSE_EQ|INE066F01020', 'last_price': 5000}, 'future': {'instrument_token': 'NSE_FO|FUT', 'last_price': 5030, 'depth': {'buy': [{'price': 5029}]}}}
            if path == '/option/chain': return [{'expiry': expiry, 'strike_price': 4500, 'put_options': {'instrument_key': 'NSE_FO|PE', 'market_data': {'ltp': 40}, 'option_greeks': {'delta': -.2, 'theta': -1.5, 'iv': 30}}}]
            self.fail('Unexpected endpoint ' + path)
        with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'fake'}), patch.object(u, 'hal_underlying', return_value='NSE_EQ|INE066F01020'), patch.object(u, 'futures_contracts', return_value=[{'expiry': expiry, 'instrument_key': 'NSE_FO|FUT', 'lot_size': 100, 'trading_symbol': 'HAL'}]), patch.object(u, '_call', side_effect=call):
            data = u.snapshot()
        self.assertEqual(data['option_rows'][0]['put']['lot_size'], 125)
        self.assertEqual(data['futures'][0]['quote']['bid'], 5029)
        self.assertEqual(data['available_expiries'], [expiry])

    def test_research_http_requires_viewer_auth(self):
        http = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
        thread = threading.Thread(target=http.serve_forever, daemon=True); thread.start()
        url = 'http://127.0.0.1:%s/api/upstox/research?section=status' % http.server_port
        try:
            with patch.dict(os.environ, {'HAL_VIEWER_KEY': 'fixture-viewer'}), patch.object(r, 'load', return_value={'section': 'status', 'data': {}}) as load:
                with self.assertRaises(urllib.error.HTTPError) as error: urllib.request.urlopen(url)
                self.assertEqual(error.exception.code, 403); load.assert_not_called()
                request = urllib.request.Request(url, headers={'X-HAL-Viewer-Key': 'fixture-viewer'})
                with urllib.request.urlopen(request) as response: self.assertEqual(json.load(response)['section'], 'status')
                load.assert_called_once()
        finally:
            http.shutdown(); http.server_close(); thread.join()

if __name__ == '__main__': unittest.main()
