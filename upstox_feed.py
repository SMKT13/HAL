"""Read-only HAL market-data adapter for Upstox V2 (Python standard library).

No orders, broker portfolio, credentials or execution endpoints are used.
This module never returns access tokens or upstream error bodies to clients.
"""
import datetime as dt
import hmac
import json
import math
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://api.upstox.com/v2"
IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
LOCK = threading.Lock()
CACHED = {}
TTL = 60
EXPIRY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class FeedError(Exception):
    """Safe error classification, never raw HTTP/token-bearing output."""


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def _call(path, params, token):
    if not token:
        raise FeedError("token_missing")
    if path not in ("/instruments/search", "/market-quote/quotes", "/option/chain"):
        raise FeedError("unsupported_path")
    url = BASE + path + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "Accept": "application/json", "Authorization": "Bearer " + token,
        "User-Agent": "HAL-personal-readonly-desk/1.0",
    })
    try:
        with urllib.request.urlopen(req, timeout=11) as response:
            raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise FeedError("provider_response_too_large")
        payload = json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            raise FeedError("token_expired_or_unauthorized") from None
        if exc.code == 403:
            raise FeedError("upstox_permission_denied") from None
        if exc.code == 429:
            raise FeedError("upstox_rate_limited") from None
        raise FeedError("upstox_request_failed") from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise FeedError("upstox_network_unavailable") from None
    except (ValueError, UnicodeError, TypeError):
        raise FeedError("upstox_bad_response") from None
    if not isinstance(payload, dict) or payload.get("status") != "success":
        raise FeedError("upstox_request_failed")
    return payload.get("data")


def authorized(viewer_key):
    password = os.environ.get("HAL_VIEWER_KEY", "")
    return bool(password and viewer_key and hmac.compare_digest(password, viewer_key))


def hal_underlying(token):
    data = _call("/instruments/search", {
        "query": "HAL", "exchanges": "NSE", "segments": "EQ",
        "page_number": 1, "records": 30,
    }, token)
    if not isinstance(data, list):
        raise FeedError("no_hal_equity_instrument")
    for item in data:
        if (isinstance(item, dict) and item.get("segment") == "NSE_EQ"
                and item.get("trading_symbol") == "HAL"
                and isinstance(item.get("instrument_key"), str)
                and item["instrument_key"].startswith("NSE_EQ|")):
            return item["instrument_key"]
    raise FeedError("no_hal_equity_instrument")


def futures_contracts(token, today):
    contracts = {}
    # Upstox instrument search returns at most 30 records per page.
    for page in range(1, 5):
        data = _call("/instruments/search", {
            "query": "HAL", "exchanges": "NSE", "segments": "FO",
            "instrument_types": "FUT", "page_number": page, "records": 30,
        }, token)
        if not isinstance(data, list):
            raise FeedError("no_hal_futures_contracts")
        for item in data:
            if not isinstance(item, dict):
                continue
            expiry = item.get("expiry")
            key = item.get("instrument_key")
            if (item.get("segment") != "NSE_FO" or item.get("underlying_symbol") != "HAL"
                    or item.get("instrument_type") != "FUT"
                    or not isinstance(expiry, str) or not EXPIRY_RE.fullmatch(expiry)
                    or not isinstance(key, str) or not key.startswith("NSE_FO|")):
                continue
            try:
                date = dt.date.fromisoformat(expiry)
            except ValueError:
                continue
            if date < today or date > today + dt.timedelta(days=400):
                continue
            contracts[expiry] = {
                "expiry": expiry, "instrument_key": key,
                "trading_symbol": str(item.get("trading_symbol", ""))[:100],
                "lot_size": number(item.get("lot_size")),
            }
        if len(data) < 30:
            break
    result = sorted(contracts.values(), key=lambda c: c["expiry"])
    if not result:
        raise FeedError("no_hal_futures_contracts")
    return result[:6]


def _quote_lookup(data, key):
    if not isinstance(data, dict):
        return None
    for quote in data.values():
        if isinstance(quote, dict) and quote.get("instrument_token") == key:
            return quote
    return None


def _time(value):
    if isinstance(value, str):
        if re.fullmatch(r"\d{12,16}", value):
            value = int(value)
        else:
            try:
                parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
                return parsed.astimezone(IST).isoformat()
            except ValueError:
                return None
    if number(value) is not None and value > 0:
        try:
            return dt.datetime.fromtimestamp(value / (1000 if value > 10**11 else 1), IST).isoformat()
        except (OverflowError, ValueError, OSError):
            return None
    return None


def _simplify_quote(raw):
    if not isinstance(raw, dict):
        return None
    ohlc = raw.get("ohlc") if isinstance(raw.get("ohlc"), dict) else {}
    return {
        "last_price": number(raw.get("last_price")),
        "volume": number(raw.get("volume")),
        "open_interest": number(raw.get("oi")),
        "prev_close": number(ohlc.get("close")),
        "open": number(ohlc.get("open")),
        "high": number(ohlc.get("high")),
        "low": number(ohlc.get("low")),
        "quote_as_of": _time(raw.get("timestamp")),
        "last_trade_at": _time(raw.get("last_trade_time")),
    }


def _simplify_option(raw):
    if not isinstance(raw, dict):
        return None
    data = raw.get("market_data")
    greeks = raw.get("option_greeks")
    if not isinstance(data, dict):
        data = {}
    if not isinstance(greeks, dict):
        greeks = {}
    return {
        "ltp": number(data.get("ltp")), "bid": number(data.get("bid_price")),
        "ask": number(data.get("ask_price")), "volume": number(data.get("volume")),
        "oi": number(data.get("oi")), "prev_oi": number(data.get("prev_oi")),
        "iv": number(greeks.get("iv")) if number(greeks.get("iv")) is not None else number(data.get("iv")), "delta": number(greeks.get("delta")),
        "gamma": number(greeks.get("gamma")), "theta": number(greeks.get("theta")),
        "vega": number(greeks.get("vega")),
    }


def _option_rows(data, expiry, spot):
    if not isinstance(data, list):
        raise FeedError("option_chain_unavailable")
    parsed = []
    for item in data:
        if not isinstance(item, dict) or item.get("expiry") != expiry:
            continue
        strike = number(item.get("strike_price"))
        if strike is None or strike <= 0:
            continue
        if abs(strike - spot) > max(1000, spot * 0.20) and strike not in (4300, 4500):
            continue
        parsed.append({
            "strike": strike,
            "call": _simplify_option(item.get("call_options")),
            "put": _simplify_option(item.get("put_options")),
        })
    parsed.sort(key=lambda item: (abs(item["strike"] - spot), item["strike"]))
    retained = parsed[:36]
    retained.sort(key=lambda item: item["strike"])
    return retained


def snapshot(expiry=None):
    """Return limited, timestamped public market fields; no account information."""
    token = os.environ.get("UPSTOX_ACCESS_TOKEN", "").strip()
    if not token:
        raise FeedError("token_missing")
    if expiry:
        if not EXPIRY_RE.fullmatch(expiry):
            raise FeedError("invalid_expiry")
        try:
            dt.date.fromisoformat(expiry)
        except ValueError:
            raise FeedError("invalid_expiry") from None
    now = dt.datetime.now(IST)
    cache_key = expiry or "__front__"
    with LOCK:
        cached = CACHED.get(cache_key)
        if cached and time.monotonic() - cached[0] < TTL:
            return dict(cached[1], cache_status="cached")
        underlying = hal_underlying(token)
        futures = futures_contracts(token, now.date())
        available = [c["expiry"] for c in futures]
        selected = expiry or available[0]
        if selected not in available:
            raise FeedError("expiry_not_listed")
        keys = [underlying] + [c["instrument_key"] for c in futures[:3]]
        quotes = _call("/market-quote/quotes", {"instrument_key": ",".join(keys)}, token)
        spot = _simplify_quote(_quote_lookup(quotes, underlying))
        if not spot or not spot["last_price"] or spot["last_price"] <= 0:
            raise FeedError("no_hal_spot_quote")
        future_quotes = []
        for c in futures[:3]:
            q = _simplify_quote(_quote_lookup(quotes, c["instrument_key"]))
            future_quotes.append({
                "expiry": c["expiry"], "trading_symbol": c["trading_symbol"],
                "lot_size": c["lot_size"], "quote": q,
            })
        chain = _call("/option/chain", {"instrument_key": underlying, "expiry_date": selected}, token)
        result = {
            "source": "Upstox market data V2 (read-only)", "symbol": "HAL",
            "fetched_at_iso": now.isoformat(),
            "spot": spot, "futures": future_quotes,
            "available_expiries": available, "option_expiry": selected,
            "option_rows": _option_rows(chain, selected, spot["last_price"]),
            "cache_status": "fresh_fetch",
            "note": "Quote timestamps are provider times; last trades may be old. LTP is not a bid/ask or guaranteed executable price. No broker positions or orders are accessed.",
        }
        CACHED[cache_key] = (time.monotonic(), result)
        return result
