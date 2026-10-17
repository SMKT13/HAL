"""Offline regression tests for the free source-grounded analyst panels."""
import copy
import unittest

import agents


def sample():
    return {
        "quote": {"price": 4900.0},
        "ind": {"sma20": 4800.0, "sma50": 4750.0, "rsi14": 61.0,
                "macd_hist": 5.5, "atr14": 95.0},
        "source": "Fixture: validated market feed",
        "quote_as_of": "2026-10-14T11:00:00+05:30",
        "last_session": "2026-10-14",
        "data_status": "fresh_fetch", "stale": False
    }


class AgentTests(unittest.TestCase):
    def test_positive_market_signals(self):
        report = agents.analyze(sample())
        self.assertEqual(report["mode"], "deterministic_rules_not_llm")
        self.assertEqual(report["technical_score"], 4)
        self.assertIn("bullish tilt", report["assessment"])
        self.assertEqual(len(report["agents"]), 7)
        self.assertEqual(report["agents"][4]["stance"], "Data not connected")
        self.assertNotIn("open interest", str(report["agents"][0]).lower())

    def test_bearish_market_signals(self):
        payload = sample()
        payload["quote"]["price"] = 4400
        payload["ind"].update(rsi14=36, macd_hist=-10)
        report = agents.analyze(payload)
        self.assertEqual(report["technical_score"], -4)
        self.assertIn("bearish tilt", report["assessment"])

    def test_nulls_are_unavailable_not_zero(self):
        payload = sample()
        payload["ind"] = {"sma20": None, "rsi14": None, "macd_hist": None}
        report = agents.analyze(payload)
        self.assertEqual(report["technical_score"], 0)
        self.assertEqual(report["agents"][0]["stance"], "Insufficient indicators")
        self.assertEqual(report["signal_count"], 0)

    def test_stale_feed_overrides_trading_verdict(self):
        payload = sample()
        payload["stale"] = True
        report = agents.analyze(payload)
        self.assertTrue(report["stale"])
        self.assertEqual(report["assessment"], "No trade verdict on stale data")
        self.assertIn("stale", report["agents"][3]["evidence"][0].lower())

    def test_rejects_malformed_price_without_external_network(self):
        for value in (None, 0, -1, float("inf"), float("nan"), True):
            payload = sample()
            payload["quote"]["price"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                agents.analyze(payload)
        first = sample()
        second = copy.deepcopy(first)
        self.assertEqual(agents.analyze(first), agents.analyze(second))


if __name__ == "__main__":
    unittest.main()

