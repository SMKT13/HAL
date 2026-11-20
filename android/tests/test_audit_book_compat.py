import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from audit_book_compat import audit_database

def sample_document():
    return {"version": 4, "legs": [{"id": "future-dec", "type": "FUT", "lots": 2, "lotSize": 150}], "journal": [{"id": "close-oct", "kind": "close"}]}

def fixture(path, version, corrupt=False, different=False, native=False, missing_room=False):
    db = sqlite3.connect(path)
    db.execute("PRAGMA user_version=" + str(version))
    for table in ("book", "recovery"):
        db.execute("CREATE TABLE " + table + " (id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER)")
    db.execute("CREATE TABLE cache(key TEXT PRIMARY KEY,payload TEXT,digest TEXT,updated_at INTEGER)")
    obj = sample_document()
    raw = json.dumps(obj)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    if corrupt: digest = "0"*64
    db.execute("INSERT INTO book VALUES (1,1,?,?,123)", (raw, digest))
    if version == 2 and not missing_room:
        db.execute("CREATE TABLE FoPositionEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL)")
        db.execute("CREATE TABLE TradeLedgerEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,gross INTEGER NOT NULL,fees INTEGER NOT NULL)")
        db.execute("CREATE TABLE PriceAlertEntity(id TEXT NOT NULL PRIMARY KEY,kind TEXT NOT NULL,threshold REAL NOT NULL,enabled INTEGER NOT NULL)")
        db.execute("CREATE TABLE CachedSnapshotEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,at INTEGER NOT NULL)")
        db.execute("CREATE TABLE room_master_table(id INTEGER PRIMARY KEY,identity_hash TEXT)")
        db.execute("INSERT INTO room_master_table VALUES(42,'valid-mock-hash')")
        leg = dict(obj['legs'][0])
        if different: leg['lots'] = 3
        db.execute("INSERT INTO FoPositionEntity VALUES (?,?)", (leg['id'],json.dumps(leg)))
        db.execute("INSERT INTO TradeLedgerEntity VALUES (?,?,?,?)", ('journal/close-oct', json.dumps(obj['journal'][0]), 0,0))
        if native:
            db.execute("INSERT INTO FoPositionEntity VALUES (?,?)", ('call-short',json.dumps({'type':'CE','side':'SELL'})))
            db.execute("INSERT INTO TradeLedgerEntity VALUES (?,?,?,?)",('native-close',json.dumps({'kind':'close'}),0,0))
    db.commit()
    db.close()

class AuditTests(unittest.TestCase):
    def test_legacy_readable_and_byte_identical_after_audit(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / 'book.db';fixture(p,1)
            before = hashlib.sha256(p.read_bytes()).hexdigest()
            r = audit_database(p)
            self.assertEqual(r['status'],'legacy_v1_readable')
            self.assertEqual(r['counts']['legacy_legs'],1)
            self.assertEqual(before,hashlib.sha256(p.read_bytes()).hexdigest())

    def test_room_native_only_and_edited_positions_detected(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'book.db';fixture(p,2,different=True,native=True)
            r=audit_database(p)
            self.assertEqual(r['status'],'room_v2_review_required')
            self.assertEqual(r['counts']['native_only_positions'],1)
            self.assertEqual(r['counts']['contract_differences'],1)
            self.assertEqual(r['counts']['native_only_ledger'],1)
            self.assertIn('native_records_need_reconciliation',r['flags'])

    def test_unmodified_mirror_still_requires_room_validation(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'book.db';fixture(p,2)
            r=audit_database(p)
            self.assertEqual(r['status'],'room_v2_review_required')
            self.assertNotIn('native_records_need_reconciliation',r['flags'])
            self.assertIn('room_v2_requires_migration_validation',r['flags'])

    def test_checksum_mismatch_blocks(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'book.db';fixture(p,1,corrupt=True)
            r=audit_database(p)
            self.assertEqual(r['status'],'blocked')
            self.assertIn('book_checksum_mismatch',r['errors'])

    def test_missing_room_tables_blocks(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'book.db';fixture(p,2,missing_room=True)
            r=audit_database(p)
            self.assertEqual(r['status'],'blocked')
            self.assertIn('missing_room_tables',r['errors'])

    def test_unsupported_version_blocks(self):
        with tempfile.TemporaryDirectory() as folder:
            p=Path(folder)/'book.db';fixture(p,3)
            r=audit_database(p)
            self.assertEqual(r['status'],'blocked')
            self.assertIn('unsupported_database_version',r['errors'])

if __name__=='__main__':
    unittest.main()
