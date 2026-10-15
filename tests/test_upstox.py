"""Offline contract tests for the Upstox HAL read-only adapter."""
import datetime as dt
import os
import unittest
from unittest.mock import patch
import upstox_feed as u


class UpstoxTests(unittest.TestCase):
    def test_viewer_secret_is_separate_and_required(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertFalse(u.authorized("anything"))
        with patch.dict(os.environ, {"HAL_VIEWER_KEY": "private-viewer-password"}):
            self.assertTrue(u.authorized("private-viewer-password"))
            self.assertFalse(u.authorized(""))
            self.assertFalse(u.authorized("wrong"))

    def test_expiry_does_not_accept_url_injection(self):
        with patch.dict(os.environ, {"UPSTOX_ACCESS_TOKEN": "fake"}):
            with self.assertRaises(u.FeedError):
                u.snapshot("2026-10-27&foo=bar")

    def test_search_only_exact_hal_equity(self):
        with patch.object(u, "_call", return_value=[
            {"segment": "NSE_EQ", "trading_symbol": "HALDER", "instrument_key": "NSE_EQ|FAKE"},
            {"segment": "NSE_EQ", "trading_symbol": "HAL", "instrument_key": "NSE_EQ|HALFAKE"}
        ]):
            self.assertEqual(u.hal_underlying("fake"), "NSE_EQ|HALFAKE")

    def test_futures_strict_match_and_expiry(self):
        data = [
            {"segment": "NSE_FO", "underlying_symbol": "HAL", "instrument_type": "FUT",
             "expiry": "2026-10-27", "instrument_key": "NSE_FO|101", "lot_size": 150},
            {"segment": "NSE_FO", "underlying_symbol": "HALLY", "instrument_type": "FUT",
             "expiry": "2026-10-27", "instrument_key": "NSE_FO|102"},
            {"segment": "NSE_FO", "underlying_symbol": "HAL", "instrument_type": "FUT",
             "expiry": "2026-09-29", "instrument_key": "NSE_FO|103"},
        ]
        with patch.object(u, "_call", return_value=data):
            result = u.futures_contracts("fake", dt.date(2026, 10, 15))
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["lot_size"], 150)

    def test_market_quotes_are_sanitized(self):
        q = u._simplify_quote({"last_price": 5000, "oi": 70, "volume": 80,
                               "timestamp": 1792000000000, "secret": "hidden"})
        self.assertEqual(q["open_interest"], 70)
        self.assertNotIn("secret", q)

    def test_options_do_not_invent_greeks(self):
        leg = u._simplify_option({"market_data": {"ltp": 42, "iv": 22.5}})
        self.assertEqual(leg["iv"], 22.5)
        self.assertIsNone(leg["delta"])
        self.assertIsNone(leg["oi"])

    def test_token_never_returned_in_safe_error(self):
        with patch.dict(os.environ, {"UPSTOX_ACCESS_TOKEN": "secret-example"}):
            with patch.object(u, "_call", side_effect=u.FeedError("upstox_network_unavailable")):
                with self.assertRaises(u.FeedError) as err:
                    u.snapshot()
                self.assertNotIn("secret-example", str(err.exception))


if __name__ == "__main__":
    unittest.main()
