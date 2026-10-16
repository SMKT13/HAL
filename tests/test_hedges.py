"""Read-only full-quote enrichment tests. Synthetic data; no account credentials."""
import copy
import datetime as dt
import os
import unittest
from unittest.mock import patch
import upstox_feed as u
import research_feed as r


class HedgeFeedTests(unittest.TestCase):
    def setUp(self):
        self.expiry = (dt.datetime.now(u.IST).date() + dt.timedelta(days=30)).isoformat()
        self.stamp = dt.datetime.now(u.IST).isoformat()
        r.CACHE.clear()

    def fixture(self, count=1):
        rows, metadata = [], []
        for i in range(count):
            key = f'NSE_FO|{1000+i}'
            rows.append({'strike': 4300+i, 'put': {'instrument_key': key, 'lot_size': 100}})
            metadata.append({'instrument_key': key, 'expiry': self.expiry, 'strike_price': 4300+i,
                             'instrument_type': 'PE', 'underlying_symbol': 'HAL', 'lot_size': 100})
        return {'option_expiry': self.expiry, 'option_rows': rows,
                'fetched_at_iso': '2026-10-16T05:00:00Z', 'chain_error': ''}, metadata

    def enrich(self, base, metadata, calls):
        def call(path, params, token):
            calls.append((path, params))
            if path == '/option/contract':
                return metadata
            self.assertEqual(path, '/market-quote/quotes')
            keys = params['instrument_key'].split(',')
            self.assertLessEqual(len(keys), 100)
            return {k: {'instrument_token': k, 'last_price': 40, 'volume': 500, 'oi': 600,
                        'timestamp': self.stamp, 'last_trade_time': 1792126800000,
                        'depth': {'buy': [{'price': 39, 'quantity': 300}], 'sell': [{'price': 41, 'quantity': 400}]}}
                    for k in keys}
        with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'SYNTHETIC-ONLY'}), patch.object(u, 'snapshot', return_value=base), patch.object(u, 'hal_underlying', return_value='NSE_EQ|INE066F01020'), patch.object(u, '_call', side_effect=call):
            return u.hedge_snapshot(self.expiry)

    def test_quotes_include_depth_and_source_times_without_relabelling_old_chain(self):
        base, meta = self.fixture()
        original = copy.deepcopy(base)
        result = self.enrich(base, meta, [])
        q = result['option_rows'][0]['put']['quote']
        self.assertEqual((q['bid'], q['ask'], q['bid_quantity'], q['ask_quantity']), (39, 41, 300, 400))
        self.assertEqual(q['quote_as_of'], self.stamp)
        self.assertIsNotNone(q['last_trade_at'])
        self.assertEqual(result['fetched_at_iso'], base['fetched_at_iso'])
        self.assertIn('quotes_fetched_at', result)
        self.assertEqual(base, original, 'Shared snapshot cache must not be mutated')
        self.assertNotIn('SYNTHETIC-ONLY', str(result))

    def test_full_quotes_are_batched_and_only_verified_hal_put_keys_are_used(self):
        base, meta = self.fixture(205)
        calls = []
        self.enrich(base, meta, calls)
        batches = [p['instrument_key'].split(',') for path, p in calls if path == '/market-quote/quotes']
        self.assertEqual([len(x) for x in batches], [100, 100, 5])
        self.assertEqual(len({k for b in batches for k in b}), 205)

    def test_wrong_underlying_side_strike_expiry_or_key_is_never_quoted(self):
        for changes in [{'underlying_symbol': 'HALLY'}, {'instrument_type': 'CE'}, {'strike_price': 9999}, {'expiry': '2000-01-01'}, {'instrument_key': 'NSE_FO|1&other=2'}]:
            base, meta = self.fixture()
            meta[0].update(changes)
            calls = []
            result = self.enrich(base, meta, calls)
            self.assertNotIn('quote', result['option_rows'][0]['put'])
            self.assertEqual([p for p in calls if p[0] == '/market-quote/quotes'], [])

    def test_missing_quote_is_null_and_empty_depth_is_not_zero_filled(self):
        self.assertIsNone(u._simplify_quote(u._quote_lookup({}, 'NSE_FO|1')))
        q = u._simplify_quote({'last_price': 40, 'depth': {'buy': [], 'sell': []}})
        self.assertIsNone(q['bid']); self.assertIsNone(q['ask_quantity']); self.assertIsNone(q['quote_as_of'])
        self.assertIsNone(u._time('2026-10-16T10:30:00'), 'An unspecified timezone cannot establish freshness')
        self.assertIsNotNone(u._time('1792126800'))

    def test_chain_failure_is_not_promoted_to_a_valid_hedge_packet(self):
        base, _ = self.fixture(); base['chain_error'] = 'upstox_rate_limited'
        with patch.object(u, 'snapshot', return_value=base):
            with self.assertRaisesRegex(u.FeedError, 'upstox_rate_limited'):
                u.hedge_snapshot(self.expiry)

    def test_hedges_section_validation_caching_and_token_rotation(self):
        for frame in ['2026-02-30', '20261027', '2026-10-27&keys=other', '../orders']:
            with self.assertRaises(u.FeedError): r.load('hedges', frame)
        with patch.object(u, 'hedge_snapshot', return_value={'option_expiry': self.expiry}) as fetch:
            with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'one'}):
                a = r.load('hedges', self.expiry); r.load('hedges', self.expiry)
            with patch.dict(os.environ, {'UPSTOX_ACCESS_TOKEN': 'two'}): r.load('hedges', self.expiry)
            self.assertEqual(a['section'], 'hedges'); self.assertEqual(a['frame'], self.expiry)
            self.assertEqual(fetch.call_count, 2)

    def test_hedge_errors_are_not_cached_as_success(self):
        with patch.object(u, 'hedge_snapshot', side_effect=u.FeedError('upstox_permission_denied')):
            with self.assertRaises(u.FeedError): r.load('hedges', self.expiry)
        self.assertEqual(r.CACHE, {})


if __name__ == '__main__': unittest.main()
