#!/usr/bin/env python3
"""Read-only compatibility audit for HAL Atlas schema-1 and Library Room schema-2.

Does not open the Android app, migrate, repair, export holdings, or print raw records.
Run only against a private *copy* of the app database, together with its WAL/SHM
if applicable. All database connections use SQLite mode=ro + query_only.
"""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path
from urllib.parse import quote

LEGACY = {"book", "recovery", "cache"}
ROOM = {"FoPositionEntity", "TradeLedgerEntity", "PriceAlertEntity", "CachedSnapshotEntity"}

def fingerprint(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

def _row_json(raw):
    value = json.loads(raw)
    if not isinstance(value, dict):
        raise ValueError("Expected JSON object")
    return value

def _canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)

def audit_database(path):
    db_path = Path(path).resolve(strict=True)
    if not db_path.is_file():
        raise ValueError("Not a regular SQLite file")
    uri = "file:" + quote(str(db_path)) + "?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.execute("PRAGMA query_only=ON")
    report = {"schema": None, "status": "blocked", "counts": {}, "flags": [], "errors": []}
    try:
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        report["schema"] = version
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        if version not in (1, 2):
            report["errors"].append("unsupported_database_version")
        if not LEGACY <= tables:
            report["errors"].append("missing_legacy_tables")
        book = {}
        if "book" in tables:
            try:
                row = conn.execute("SELECT payload,digest FROM book WHERE id=1").fetchone()
                if row:
                    raw, stored_digest = row
                    if fingerprint(raw) != stored_digest:
                        report["errors"].append("book_checksum_mismatch")
                    else:
                        book = _row_json(raw)
                        if book.get("version") != 4:
                            report["errors"].append("unsupported_book_document")
                        if not isinstance(book.get("legs"), list) or not isinstance(book.get("journal"), list):
                            report["errors"].append("invalid_book_arrays")
            except (sqlite3.Error, ValueError, TypeError, json.JSONDecodeError):
                report["errors"].append("unreadable_book")
        legacy_legs = book.get("legs", []) if isinstance(book.get("legs"), list) else []
        legacy_journal = book.get("journal", []) if isinstance(book.get("journal"), list) else []
        report["counts"]["legacy_legs"] = len(legacy_legs)
        report["counts"]["legacy_journal"] = len(legacy_journal)
        if version == 2:
            missing = sorted(ROOM - tables)
            if missing:
                report["errors"].append("missing_room_tables")
            else:
                try:
                    positions = conn.execute("SELECT id,payload FROM FoPositionEntity").fetchall()
                    ledgers = conn.execute("SELECT id,payload FROM TradeLedgerEntity").fetchall()
                    for table, field in [("FoPositionEntity", "room_positions"),
                                         ("TradeLedgerEntity", "room_ledger"),
                                         ("PriceAlertEntity", "room_alerts"),
                                         ("CachedSnapshotEntity", "room_cache")]:
                        report["counts"][field] = conn.execute('SELECT COUNT(*) FROM "' + table + '"').fetchone()[0]
                    before = {str(p.get("id")): _canonical(p) for p in legacy_legs if isinstance(p, dict) and p.get("id")}
                    native_only, changed = 0, 0
                    for ident, raw in positions:
                        item = _row_json(raw)
                        if ident not in before:
                            native_only += 1
                        elif _canonical(item) != before[ident]:
                            changed += 1
                    report["counts"]["native_only_positions"] = native_only
                    report["counts"]["contract_differences"] = changed
                    native_journal = sum(1 for ident, _ in ledgers if not ident.startswith(("journal/", "history/")) and ident != "opening")
                    report["counts"]["native_only_ledger"] = native_journal
                    if native_only or changed or native_journal:
                        report["flags"].append("native_records_need_reconciliation")
                except (sqlite3.Error, ValueError, TypeError, json.JSONDecodeError):
                    report["errors"].append("unreadable_room_records")
            if "room_master_table" not in tables:
                report["flags"].append("room_identity_missing")
            else:
                try:
                    identity = conn.execute("SELECT identity_hash FROM room_master_table WHERE id=42").fetchone()
                    if not identity or not identity[0]:
                        report["flags"].append("room_identity_missing")
                except sqlite3.Error:
                    report["flags"].append("room_identity_missing")
            report["flags"].append("room_v2_requires_migration_validation")
        if report["errors"]:
            report["status"] = "blocked"
        elif version == 1:
            report["status"] = "legacy_v1_readable"
        else:
            report["status"] = "room_v2_review_required"
        return report
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="Audit a private copy of the HAL app database (never mutates it).")
    parser.add_argument("--db", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = audit_database(args.db)
    except (OSError, ValueError, sqlite3.Error):
        result = {"schema": None, "status": "blocked", "counts": {}, "flags": [], "errors": ["cannot_open_database"]}
    print(json.dumps(result, sort_keys=True, indent=2))
    return 0 if not result["errors"] else 2

if __name__ == "__main__":
    raise SystemExit(main())
