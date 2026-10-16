"""Authenticated, read-only HAL research. No broker orders or portfolio operations."""
import datetime as dt
import hashlib
from concurrent.futures import ThreadPoolExecutor
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

import upstox_feed

IST = dt.timezone(dt.timedelta(hours=5, minutes=30))
CACHE = {}
LOCK = threading.Lock()
SECTIONS = {"candles", "news", "fundamentals", "filings", "status", "chain", "hedges"}
RSS_FILES = ("Online_announcements.xml", "Board_Meetings.xml", "Financial_Results.xml")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise upstox_feed.FeedError("redirect_blocked")


def allowed_path(path):
    return (path in ("/v2/news", "/v2/market/status/NSE") or
            bool(re.fullmatch(r"/v2/fundamentals/[A-Z0-9]{12}/(profile|income-statement|balance-sheet|cash-flow|share-holdings|key-ratios|corporate-actions|competitors)", path)) or
            bool(re.fullmatch(r"/v3/historical-candle/(intraday/)?NSE_(EQ|INDEX)[^/]+/(days|minutes|hours)/(1|15)(/\d{4}-\d{2}-\d{2}/\d{4}-\d{2}-\d{2})?", path)))


def api(path, params, token):
    if not allowed_path(path):
        raise upstox_feed.FeedError("unsupported_path")
    if not token:
        raise upstox_feed.FeedError("token_missing")
    url = "https://api.upstox.com" + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + token,
        "Accept": "application/json", "User-Agent": "HAL-Desk-Research/2.0"})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            raw = response.read(4_000_001)
        if len(raw) > 4_000_000:
            raise upstox_feed.FeedError("response_too_large")
        result = json.loads(raw)
        if not isinstance(result, dict) or result.get("status") != "success" or result.get("data") is None:
            raise upstox_feed.FeedError("bad_response")
        return result["data"]
    except urllib.error.HTTPError as exc:
        raise upstox_feed.FeedError({401: "token_expired_or_unauthorized", 403: "upstox_permission_denied", 429: "upstox_rate_limited"}.get(exc.code, "upstox_request_failed")) from None
    except (OSError, ValueError, UnicodeError):
        raise upstox_feed.FeedError("network_unavailable") from None


def parse_rss(raw, file):
    if b"<!DOCTYPE" in raw.upper():
        raise ValueError("Unsupported XML")
    result = []
    for item in ET.fromstring(raw).iter("item"):
        fields = {key: re.sub(r"<[^>]*>", " ", item.findtext(key, default="")).strip()
                  for key in ("title", "description", "link", "pubDate")}
        text = fields["title"] + " " + fields["description"]
        if not (re.search(r"\bhindustan\s+aeronautics\b", text, re.I) or re.search(r"\bHAL\b", text)):
            continue
        result.append({"title": fields["title"][:500], "summary": fields["description"][:1800],
                       "url": fields["link"], "published": fields["pubDate"],
                       "source": "NSE disclosure", "official": True, "feed": file})
    return result


def filings():
    items, errors = [], {}
    for file in RSS_FILES:
        try:
            request = urllib.request.Request("https://nsearchives.nseindia.com/content/RSS/" + file,
                headers={"User-Agent": "HAL-Desk-Personal-Reader/2.0", "Accept": "application/rss+xml, application/xml, text/xml"})
            with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
                raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ValueError("Too large")
            items.extend(parse_rss(raw, file))
        except Exception:
            errors[file] = "official_feed_unavailable"
    return {"items": items, "coverage": "Latest NSE RSS window; absence is not proof that no filing exists."}, errors


def load(section="candles", frame="D", statement="consolidated"):
    if section not in SECTIONS or statement not in ("consolidated", "standalone"):
        raise upstox_feed.FeedError("invalid_research_request")
    if section in ("chain", "hedges"):
        try:
            if not isinstance(frame, str) or not upstox_feed.EXPIRY_RE.fullmatch(frame):
                raise ValueError("Invalid expiry")
            dt.date.fromisoformat(frame)
        except (ValueError, TypeError):
            raise upstox_feed.FeedError("invalid_expiry") from None
    elif frame not in ("D", "15m", "1h"):
        raise upstox_feed.FeedError("invalid_research_request")
    token = os.environ.get("UPSTOX_ACCESS_TOKEN", "")
    # A token rotation invalidates cached responses without logging the credential.
    cache_key = (section, frame, statement, hashlib.sha256(token.encode()).hexdigest())
    ttl = 21600 if section == "fundamentals" else 30 if section == "hedges" else 60 if section in ("status", "chain") else 900
    with LOCK:
        old = CACHE.get(cache_key)
        if old and time.time() - old[0] < ttl:
            return old[1]
    data, errors = {}, {}
    def field(name, path, params=None):
        try:
            data[name] = api(path, params or {}, token)
        except upstox_feed.FeedError as exc:
            errors[name] = str(exc)
    if section == "filings":
        data, errors = filings()
    elif section == "chain":
        data = upstox_feed.snapshot(frame)
    elif section == "hedges":
        data = upstox_feed.hedge_snapshot(frame)
    elif section == "status":
        field("market", "/v2/market/status/NSE")
    else:
        key = upstox_feed.hal_underlying(token)
        if not re.fullmatch(r"NSE_EQ\|[A-Z0-9]{12}", key):
            raise upstox_feed.FeedError("bad_response")
        base = "/v2/fundamentals/" + key.split("|", 1)[1] + "/"
        if section == "news":
            field("articles", "/v2/news", {"category": "instrument_keys", "instrument_keys": key, "page_size": 100, "page_number": 1})
            data["window_days"] = 7
        elif section == "fundamentals":
            jobs = [("income", "income-statement", {"type": statement, "time_period": "quarterly"}),
                    ("annual", "income-statement", {"type": statement, "time_period": "yearly", "fs": "true"})]
            for name, endpoint in (("ratios", "key-ratios"), ("cash", "cash-flow"), ("balance", "balance-sheet"), ("shareholding", "share-holdings"), ("actions", "corporate-actions"), ("profile", "profile"), ("peers", "competitors")):
                jobs.append((name, endpoint, {"type": statement, "fs": "true"} if name in ("cash", "balance") else {}))
            # Three concurrent read-only requests bound the nine-feed response time.
            with ThreadPoolExecutor(max_workers=3) as pool:
                list(pool.map(lambda job: field(job[0], base + job[1], job[2]), jobs))
        elif section == "candles":
            today = dt.datetime.now(IST).date()
            unit, interval, days = {"D": ("days", 1, 450), "15m": ("minutes", 15, 25), "1h": ("hours", 1, 80)}[frame]
            encoded = urllib.parse.quote(key, safe="")
            field("history", f"/v3/historical-candle/{encoded}/{unit}/{interval}/{today-dt.timedelta(days=1)}/{today-dt.timedelta(days=days)}")
            field("intraday", f"/v3/historical-candle/intraday/{encoded}/{unit}/{interval}")
    result = {"section": section, "frame": frame, "type": statement, "data": data, "errors": errors,
              "source": "NSE corporate RSS" if section == "filings" else "Upstox official API",
              "fetched_at_iso": dt.datetime.now(IST).isoformat()}
    if not errors:
        with LOCK:
            if len(CACHE) > 32:
                CACHE.clear()
            CACHE[cache_key] = (time.time(), result)
    return result
