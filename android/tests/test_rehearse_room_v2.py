import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from rehearse_room_v2 import rehearse, _records, _money_to_paise

def make_fixture(path, *, bad_hash=False, version=1, include_book=True, journal=None):
    con = sqlite3.connect(path)
    con.executescript("""CREATE TABLE book(id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER);
    CREATE TABLE recovery(id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER);
    CREATE TABLE cache(key TEXT PRIMARY KEY,payload TEXT,digest TEXT,updated_at INTEGER);""")
    con.execute("PRAGMA user_version=" + str(version))
    book = {"version": 4, "legs": [
        {"id": "demo-future", "type": "FUT", "expiry": "2030-06-25", "entry": 1250.25, "lots": 2, "lotSize": 150},
        {"id": "demo-put", "type": "PE", "expiry": "2030-05-28", "entry": 12.50, "strike": 1100, "lots": 1, "lotSize": 150}],
        "journal": journal if journal is not None else [{"id": "example-close", "kind": "close", "date": "2030-01-12",
            "leg": {"entry": 1270.50, "lots": 2, "lotSize": 150}, "exit": 1220.50, "fees": 7}],
        "legacy": {"realized": -100, "costs": 11}, "history": {
            "records": [{"id": "h1", "gross": -25}], "excludedJournalIds": ["example-close"],
            "charges": {"asOf": "2030-01-13", "amount": 143.20}}}
    raw = json.dumps(book)
    digest = hashlib.sha256(raw.encode()).hexdigest() if not bad_hash else "x" * 64
    if include_book:
        con.execute("INSERT INTO book VALUES(1,1,?,?,1700)", (raw, digest))
    con.commit()
    con.close()

class RehearsalTests(unittest.TestCase):
    def test_valid_book_is_identical_on_disk_after_rehearsal(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "book.db"
            make_fixture(p)
            before = hashlib.sha256(p.read_bytes()).hexdigest()
            report = rehearse(p)
            self.assertEqual(report["status"], "in_memory_projection_passed")
            self.assertEqual(report["legacy_positions"], 2)
            self.assertEqual(report["projected_ledger_rows"], 3)
            self.assertEqual(before, hashlib.sha256(p.read_bytes()).hexdigest())
            self.assertEqual(sqlite3.connect(p).execute("PRAGMA user_version").fetchone()[0], 1)

    def test_mixed_expiry_sqlite_clone_matches_expected_ledger(self):
        fixture = Path(__file__).resolve().parents[1] / "app/src/test/resources/mixed-expiry-book.json"
        raw = fixture.read_text()
        with tempfile.TemporaryDirectory() as folder:
            source = Path(folder) / "book.db"
            make_fixture(source)
            db = sqlite3.connect(source)
            try:
                db.execute("INSERT INTO recovery SELECT * FROM book")
                db.execute("UPDATE book SET revision=2,payload=?,digest=?",
                           (raw, hashlib.sha256(raw.encode()).hexdigest()))
                db.commit()
            finally:
                db.close()
            before = source.read_bytes()
            result = rehearse(source)
            self.assertEqual((result["legacy_positions"], result["projected_ledger_rows"]), (2,4))
            self.assertEqual((result["realized_gross_paise"], result["charges_paise"]), (-12000,1350))
            self.assertEqual(before, source.read_bytes())

    def test_invalid_checksum_fails_closed(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "book.db"
            make_fixture(p, bad_hash=True)
            with self.assertRaisesRegex(ValueError, "checksum"):
                rehearse(p)

    def test_schema_two_never_mutated(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "book.db"
            make_fixture(p, version=2)
            before = hashlib.sha256(p.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError, "legacy_v1"):
                rehearse(p)
            self.assertEqual(before, hashlib.sha256(p.read_bytes()).hexdigest())

    def test_empty_book_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "book.db"
            make_fixture(p, include_book=False)
            with self.assertRaisesRegex(ValueError, "missing_legacy_book"):
                rehearse(p)

    def test_duplicate_leg_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "book.db"
            make_fixture(p)
            con = sqlite3.connect(p)
            doc = json.loads(con.execute("SELECT payload FROM book").fetchone()[0])
            doc["legs"].append(doc["legs"][0])
            raw = json.dumps(doc)
            con.execute("UPDATE book SET payload=?,digest=?", (raw, hashlib.sha256(raw.encode()).hexdigest()))
            con.commit(); con.close()
            with self.assertRaisesRegex(ValueError, "duplicate"):
                rehearse(p)

    def test_legacy_excluded_close_is_not_double_counted(self):
        book = {"legacy": {"realized": 2, "costs": 3}, "history": {"records": [{"id":"h", "gross": -4}],
          "excludedJournalIds": ["old"], "charges": {"asOf": "2026-10-02", "amount": 10}},
          "journal": [{"kind": "close", "id":"old", "date":"2026-10-01", "exit": 4900, "fees": 15,
                       "leg": {"entry": 5000,"lots":1,"lotSize":150}}]}
        rows = list(_records(book))
        self.assertEqual([x[0] for x in rows], ["opening", "history/h", "journal/old"])
        self.assertEqual(rows[-1][2:], (0, 0))
        self.assertEqual(rows[0][2:], (200, 1000))

    def test_money_rounding_matches_java(self):
        self.assertEqual(_money_to_paise(1.005), 100)
        self.assertEqual(_money_to_paise(-0.005), 0)

if __name__ == "__main__": unittest.main()
