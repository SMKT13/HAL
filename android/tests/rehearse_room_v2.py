#!/usr/bin/env python3
"""Rehearse Library HAL Atlas 5.1.24 Room-v2 mirror in memory, without app database writes.

This is not a deployable Room migration, does not validate Room schema identity,
and does not authorize signing or installing a rebuilt Android app.
"""
import argparse
import datetime
import hashlib
import json
import math
import sqlite3
from pathlib import Path
from urllib.parse import quote

ROOM_TABLES = {
    "FoPositionEntity": "CREATE TABLE FoPositionEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL)",
    "TradeLedgerEntity": "CREATE TABLE TradeLedgerEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,gross INTEGER NOT NULL,fees INTEGER NOT NULL)",
    "PriceAlertEntity": "CREATE TABLE PriceAlertEntity(id TEXT NOT NULL PRIMARY KEY,kind TEXT NOT NULL,threshold REAL NOT NULL,enabled INTEGER NOT NULL)",
    "CachedSnapshotEntity": "CREATE TABLE CachedSnapshotEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,at INTEGER NOT NULL)",
}

def _money_to_paise(value):
    number = float(value)
    if not math.isfinite(number) or abs(number) > 1e13:
        raise ValueError("invalid_amount")
    return math.floor(number * 100.0 + 0.5)  # Kotlin/Java Math.round semantics

def _json(obj):
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False)

def _records(book):
    history = book.get("history") or {}
    legacy = book.get("legacy") or {}
    charges = history.get("charges")
    excluded = set(history.get("excludedJournalIds") or [])
    opening = 0 if history.get("excludeLegacyRealized") else legacy.get("realized", 0)
    base_fees = charges["amount"] if charges is not None else legacy.get("costs", 0)
    if opening or base_fees:
        yield "opening", legacy, _money_to_paise(opening), _money_to_paise(base_fees)
    for record in history.get("records") or []:
        yield "history/" + record["id"], record, _money_to_paise(record["gross"]), 0
    for event in book["journal"]:
        kind = event["kind"]
        fee = event["fees"] if kind == "close" else event["amount"] if kind == "fee" else 0
        gross = 0
        if kind == "close" and event["id"] not in excluded:
            leg = event["leg"]
            gross = (float(event["exit"]) - float(leg["entry"])) * int(leg["lots"]) * int(leg["lotSize"])
        charge_after = charges is None or event["date"] > charges["asOf"]
        yield "journal/" + event["id"], event, _money_to_paise(gross), _money_to_paise(fee if charge_after else 0)

def rehearse(path):
    p = Path(path).resolve(strict=True)
    if not p.is_file():
        raise ValueError("not_a_database_file")
    source = sqlite3.connect("file:" + quote(str(p)) + "?mode=ro", uri=True)
    source.execute("PRAGMA query_only=ON")
    target = sqlite3.connect(":memory:")
    try:
        if source.execute("PRAGMA user_version").fetchone()[0] != 1:
            raise ValueError("only_legacy_v1_supported")
        tables = {r[0] for r in source.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if not {"book", "recovery", "cache"} <= tables:
            raise ValueError("legacy_schema_incomplete")
        row = source.execute("SELECT payload,digest,updated_at FROM book WHERE id=1").fetchone()
        if row is None:
            raise ValueError("missing_legacy_book")
        payload, digest, stamp = row
        if hashlib.sha256(payload.encode("utf-8")).hexdigest() != digest:
            raise ValueError("legacy_checksum_invalid")
        book = json.loads(payload)
        if not isinstance(book, dict) or book.get("version") != 4 or not isinstance(book.get("legs"), list) or not isinstance(book.get("journal"), list):
            raise ValueError("invalid_document")
        source.backup(target)  # Memory-only clone.
        for sql in ROOM_TABLES.values():
            target.execute(sql)
        target.execute("INSERT INTO CachedSnapshotEntity VALUES(?,?,?)", ("atlas-original", payload, stamp))
        seen = set()
        for leg in book["legs"]:
            identity = leg["id"]
            if not identity or identity in seen:
                raise ValueError("duplicate_or_missing_contract_id")
            seen.add(identity)
            if leg.get("type") not in {"FUT", "PE"} or leg.get("side", "BUY") != "BUY":
                raise ValueError("unsupported_legacy_contract")
            datetime.date.fromisoformat(leg["expiry"])
            if int(leg["lots"]) <= 0 or int(leg["lotSize"]) <= 0 or not math.isfinite(float(leg["entry"])):
                raise ValueError("invalid_contract_fields")
            target.execute("INSERT INTO FoPositionEntity VALUES(?,?)", (identity, _json(leg)))
        entries = list(_records(book))
        for ident, item, gross, fees in entries:
            target.execute("INSERT INTO TradeLedgerEntity VALUES(?,?,?,?)", (ident, _json(item), gross, fees))
        target.commit()
        saved = target.execute("SELECT payload FROM CachedSnapshotEntity WHERE id='atlas-original'").fetchone()[0]
        assert saved == payload
        assert target.execute("SELECT COUNT(*) FROM FoPositionEntity").fetchone()[0] == len(book["legs"])
        assert target.execute("SELECT COUNT(*) FROM TradeLedgerEntity").fetchone()[0] == len(entries)
        assert source.execute("PRAGMA user_version").fetchone()[0] == 1
        gross, fees = target.execute(
            "SELECT COALESCE(SUM(gross),0),COALESCE(SUM(fees),0) FROM TradeLedgerEntity"
        ).fetchone()
        return {"status": "in_memory_projection_passed",
                "realized_gross_paise": gross, "charges_paise": fees, "legacy_positions": len(book["legs"]),
                "projected_ledger_rows": len(entries), "source_schema_unchanged": True,
                "note": "Not a Room migration or installability certification"}
    finally:
        target.close()
        source.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = rehearse(args.db)
        print(json.dumps(result, sort_keys=True, indent=2))
    except (ValueError, OSError, sqlite3.Error, KeyError, TypeError, IndexError, OverflowError) as exc:
        print(json.dumps({"status": "blocked", "reason": type(exc).__name__}))
        raise SystemExit(2)
