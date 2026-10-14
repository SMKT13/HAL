"""Transparent, deterministic HAL research panels; not TradingAgents LLM output.

Accepts only the existing validated /api/data payload. No invented F&O, news,
fundamental or live prices. This module has no dependencies or network calls.
"""
import math


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def money(value):
    return f"₹{value:,.2f}"


def analyze(data):
    """Create dated, audit-friendly rule-based analyst reports from market data."""
    quote = data.get("quote") or {}
    ind = data.get("ind") or {}
    mkt = data.get("mkt") or {}
    price = quote.get("price")
    if not number(price) or price <= 0:
        raise ValueError("A validated HAL spot quote is required")

    evidence_bull, evidence_bear = [], []
    directional = []
    for label, key in (("20-day average", "sma20"), ("50-day average", "sma50")):
        line = ind.get(key)
        if number(line) and line > 0:
            direction = 1 if price > line else -1 if price < line else 0
            if direction:
                (evidence_bull if direction > 0 else evidence_bear).append(
                    f"HAL spot {money(price)} is {'above' if direction > 0 else 'below'} its "
                    f"{label} ({money(line)})."
                )
            directional.append(direction)

    rsi = ind.get("rsi14")
    if number(rsi) and 0 <= rsi <= 100:
        if rsi >= 55:
            evidence_bull.append(f"RSI(14) is {rsi:.1f}, above the 55 strength reference.")
            directional.append(1)
        elif rsi <= 45:
            evidence_bear.append(f"RSI(14) is {rsi:.1f}, below the 45 weakness reference.")
            directional.append(-1)
        else:
            directional.append(0)

    histogram = ind.get("macd_hist")
    if number(histogram):
        if histogram > 0:
            evidence_bull.append(f"MACD histogram is positive ({histogram:.2f}).")
            directional.append(1)
        elif histogram < 0:
            evidence_bear.append(f"MACD histogram is negative ({histogram:.2f}).")
            directional.append(-1)
        else:
            directional.append(0)

    score = sum(directional)
    if len(directional) < 2:
        stance = "Insufficient indicators"
    elif score >= 2:
        stance = "Bullish tilt"
    elif score <= -2:
        stance = "Bearish tilt"
    else:
        stance = "Mixed / neutral"

    atr = ind.get("atr14")
    atr_percent = 100 * atr / price if number(atr) and atr >= 0 else None
    stale = bool(data.get("stale")) or data.get("data_status") == "stale"
    risk = ["Spot candles do not show HAL futures basis, open interest, option premiums, "
            "implied volatility, margin, or actual contract expiry."]
    if stale:
        risk.insert(0, "Market refresh failed: using a stale cached market snapshot.")
    if atr_percent is not None:
        risk.append(f"ATR(14) is {money(atr)} (~{atr_percent:.2f}% of spot); "
                    "this is a historical daily-range measure, not a forecast.")
    if mkt and number(mkt.get("price")):
        risk.append("NIFTY context is descriptive; it does not prove HAL will track the index.")
    risk.append("HAL stock futures and short options can lead to physical settlement "
                "and material margin obligations; check broker/exchange rules.")

    agents = [
        {"id": "technical", "name": "Technical analyst", "stance": stance,
         "evidence": (evidence_bull + evidence_bear)[:6] or
                     ["Not enough supported moving-average and momentum indicators."]},
        {"id": "bull", "name": "Bull researcher",
         "stance": "Evidence present" if evidence_bull else "Not confirmed",
         "evidence": evidence_bull or ["No bullish signals were confirmed by the available rules."]},
        {"id": "bear", "name": "Bear researcher",
         "stance": "Evidence present" if evidence_bear else "Not confirmed",
         "evidence": evidence_bear or ["No bearish signals were confirmed by the available rules."]},
        {"id": "risk", "name": "Risk manager", "stance": "Review required", "evidence": risk},
        {"id": "fundamental", "name": "Fundamental analyst", "stance": "Data not connected",
         "evidence": ["No verified current financial filings, valuation multiples or HAL "
                      "order-book figures are supplied by this market-data API."]},
        {"id": "news", "name": "News & sentiment analyst", "stance": "Data not connected",
         "evidence": ["The external TradingView headline widget is not ingested or fact-checked "
                      "by this endpoint. No news sentiment score has been calculated."]},
        {"id": "derivatives", "name": "F&O analyst", "stance": "Data not connected",
         "evidence": ["Live NSE HAL futures/option-chain OI, IV, Greeks, contract lots, "
                      "bid/ask and settlement data are unavailable from this feed.",
                      "The separate position calculator uses browser-only values and "
                      "model estimates; this server never reads your saved holdings."]},
    ]
    assessment = ("No trade verdict on stale data" if stale else
                  f"Rule-based technical assessment: {stance.lower()}.")
    return {
        "schema_version": 1,
        "mode": "deterministic_rules_not_llm",
        "symbol": "HAL.NS",
        "market_price": round(price, 2),
        "source": data.get("source", "Unspecified market feed"),
        "quote_as_of": data.get("quote_as_of"),
        "fetched_at_iso": data.get("fetched_at_iso"),
        "last_session": data.get("last_session"),
        "data_status": data.get("data_status", "unknown"),
        "stale": stale,
        "agents": agents,
        "assessment": assessment,
        "signal_count": len(directional),
        "technical_score": score,
        "limitations": [
            "This is rule-based research, not a run of TauricResearch TradingAgents or an AI model.",
            "Market quotes may be delayed, and historical candles can be provisional.",
            "No autonomous orders or position recommendations are produced.",
        ],
    }
