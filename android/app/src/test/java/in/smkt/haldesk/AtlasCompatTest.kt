package in.smkt.haldesk

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.security.MessageDigest

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],manifest=Config.NONE)
class AtlasCompatTest {
    private fun setup():Context {
        val c:Context=RuntimeEnvironment.getApplication()
        c.deleteDatabase("haldesk_book.db")
        val path=c.getDatabasePath("haldesk_book.db")
        path.parentFile!!.mkdirs()
        val raw="""{"version":4,"legs":[{"id":"f","type":"FUT","expiry":"2026-12-29","lots":1,"lotSize":150,"entry":4927.35}],"journal":[],"notes":[]}"""
        val hash=MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()).joinToString(""){"%02x".format(it)}
        SQLiteDatabase.openOrCreateDatabase(path,null).use { db->
            db.execSQL("CREATE TABLE book(id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER)")
            db.execSQL("CREATE TABLE recovery(id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER)")
            db.execSQL("CREATE TABLE cache(key TEXT PRIMARY KEY,payload TEXT,digest TEXT,updated_at INTEGER)")
            db.execSQL("CREATE TABLE FoPositionEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL)")
            db.execSQL("CREATE TABLE TradeLedgerEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,gross INTEGER NOT NULL,fees INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE PriceAlertEntity(id TEXT NOT NULL PRIMARY KEY,kind TEXT NOT NULL,threshold REAL NOT NULL,enabled INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE CachedSnapshotEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,at INTEGER NOT NULL)")
            db.execSQL("CREATE TABLE room_master_table(id INTEGER PRIMARY KEY,identity_hash TEXT)")
            db.execSQL("INSERT INTO room_master_table VALUES(42,'fixture-valid-hash')")
            db.execSQL("INSERT INTO book VALUES(1,8,?,?,1)",arrayOf(raw,hash))
            db.execSQL("INSERT INTO FoPositionEntity VALUES(?,?)",arrayOf("f",JSONObject(raw).getJSONArray("legs").getJSONObject(0).toString()))
            val call=JSONObject().put("id","c").put("type","CE").put("side","SELL").put("expiry","2026-12-29")
                .put("strike",5100).put("entry",20).put("lots",1).put("lotSize",150)
            db.execSQL("INSERT INTO FoPositionEntity VALUES(?,?)",arrayOf("c",call.toString()))
            db.execSQL("INSERT INTO TradeLedgerEntity VALUES(?,?,?,?)",arrayOf<Any>("native-ledger","{}",5000L,250L))
            db.version=2
        }
        return c
    }
    @Test fun alteredRoomColumnLayoutIsRejectedWithoutSchemaWrites(){
        val c=setup()
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { db ->
            db.execSQL("ALTER TABLE TradeLedgerEntity ADD COLUMN unexpected TEXT")
        }
        try{ BookStore(c).use { store ->
            store.load(false);fail("Altered Room schema should be rejected")
        }}catch(expected:Exception){
            assertTrue(expected.message?.contains("room_v2_schema_layout_mismatch")==true)
        }
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { db ->
            db.rawQuery("PRAGMA table_info(TradeLedgerEntity)",null).use { cursor ->
                assertEquals(5,cursor.count)
            }
        }
    }
    @Test fun nativeOnlyExposuresBlockIncompleteLegacyLifetimeAccounting(){
        val c=setup()
        BookStore(c).use { store ->
            try {store.load(false);fail("Mixed native book should be reviewed in native terminal");}
            catch(expected:Exception){
                assertTrue(expected.message?.contains("room_v2_native_exposure_requires_review")==true)
            }
            val db=store.writableDatabase
            db.rawQuery("SELECT payload FROM FoPositionEntity WHERE id='c'",null).use {
                assertTrue(it.moveToFirst());assertEquals("CE",JSONObject(it.getString(0)).getString("type"))
            }
            db.rawQuery("SELECT fees FROM TradeLedgerEntity WHERE id='native-ledger'",null).use {
                assertTrue(it.moveToFirst());assertEquals(250,it.getLong(0))
            }
        }
    }
    @Test fun conflictingMirrorFeeAmountsWithholdLegacyBookWithoutRepair(){
        val c=setup()
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { db ->
            removeUnsupportedRows(db)
            val raw="""{"version":4,"legs":[{"id":"f","type":"FUT","expiry":"2026-12-29","lots":1,"lotSize":150,"entry":4927.35}],"journal":[{"id":"prior-fee","kind":"fee","date":"2026-11-19","amount":25.0}]}"""
            val sha=MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()).joinToString(""){"%02x".format(it)}
            db.execSQL("UPDATE book SET payload=?,digest=? WHERE id=1",arrayOf(raw,sha))
            db.execSQL("INSERT INTO TradeLedgerEntity VALUES(?,?,?,?)",
                arrayOf<Any>("journal/prior-fee","{\"id\":\"prior-fee\",\"kind\":\"fee\",\"date\":\"2026-11-19\",\"amount\":25.0}",0L,2501L))
        }
        BookStore(c).use { store ->
            try{store.load(false);fail("Inconsistent ledger fees must be blocked")}
            catch(expected:Exception) {
                assertTrue(expected.message?.contains("room_v2_mirror_amount_mismatch")==true)
            }
        }
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { db ->
            db.rawQuery("SELECT fees FROM TradeLedgerEntity WHERE id='journal/prior-fee'",null).use {
                assertTrue(it.moveToFirst());assertEquals(2501L,it.getLong(0))
            }
        }
    }
    @Test fun missingOriginalJournalMirrorBlocksProjectionWithoutRewritingBook(){
        val c=setup()
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { db ->
            removeUnsupportedRows(db)
            val raw="""{"version":4,"legs":[{"id":"f","type":"FUT","expiry":"2026-12-29","lots":1,"lotSize":150,"entry":4927.35}],"journal":[{"id":"prior-fee","kind":"fee","date":"2026-11-19","amount":25.0}]}"""
            val hash=MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()).joinToString(""){"%02x".format(it)}
            db.execSQL("UPDATE book SET payload=?,digest=? WHERE id=1",arrayOf(raw,hash))
        }
        BookStore(c).use { store ->
            try { store.load(false);fail("Missing journal must be rejected") }
            catch(expected:Exception) {
                assertTrue(expected.message?.contains("room_v2_journal_mismatch")==true)
            }
        }
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { db ->
            db.rawQuery("SELECT payload FROM book WHERE id=1",null).use {
                assertTrue(it.moveToFirst())
                val book=JSONObject(it.getString(0))
                assertEquals("prior-fee",book.getJSONArray("journal").getJSONObject(0).getString("id"))
            }
        }
    }
    private fun removeUnsupportedRows(db:SQLiteDatabase){
        db.delete("FoPositionEntity","id=?",arrayOf("c"))
        db.delete("TradeLedgerEntity","id=?",arrayOf("native-ledger"))
    }
    @Test fun detectsConcurrentRoomPositionModification(){
        val c=setup()
        // Use supported mirrored positions only for legacy editor writes.
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { removeUnsupportedRows(it) }
        BookStore(c).use{store->
            val book=store.load(false).getJSONObject("book")
            val db=store.writableDatabase
            val row=book.getJSONArray("legs").getJSONObject(0).put("lots",2)
            db.execSQL("UPDATE FoPositionEntity SET payload=? WHERE id='f'",arrayOf(row.toString()))
            assertThrows(Exception::class.java){store.save(book.toString(),8)}
            assertEquals(2,store.load(false).getJSONObject("book").getJSONArray("legs").getJSONObject(0).getInt("lots"))
        }
    }
    @Test fun nativeCloseSurvivesLegacyReplacementThatOmitsIt() {
        val c=setup()
        // Source has no other unsupported exposures; only native close is imported.
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use { removeUnsupportedRows(it) }
        BookStore(c).use { store->
            val old=store.load(false).getJSONObject("book")
            val db=store.writableDatabase
            val original=old.getJSONArray("legs").getJSONObject(0)
            val record=JSONObject().put("kind","close").put("date","2026-11-19")
                .put("exit",5000).put("leg",JSONObject(original.toString()))
            db.execSQL("INSERT INTO TradeLedgerEntity VALUES(?,?,?,?)",
                arrayOf<Any>("native-close",record.toString(),1089750L,0L))
            // Refresh serial after a native-only ledger insert.
            store.load(false)
            store.save(old.toString(),8)
            db.rawQuery("SELECT gross,fees FROM TradeLedgerEntity WHERE id='native-close'",null).use {
                assertTrue(it.moveToFirst())
                assertEquals(1089750L,it.getLong(0));assertEquals(0L,it.getLong(1))
            }
        }
    }
    @Test fun legacyVersionOneStillUsable(){
        val c=setup()
        c.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null).use {
            it.version=1
        }
        // Version downgrade is only legal in a separate legacy-only DB.
        assertEquals(1,BookStore(c).use { it.readableDatabase.version })
    }
}
