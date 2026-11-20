package in.smkt.haldesk

import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest

/**
 * Library-5.1.24-style compatibility between legacy long FUT/PE book and
 * Room v2 sidecar. The native-only short/call rows and ledger IDs survive saves.
 * Invoked only for already-migrated v2 databases, never creates Room v2 on v1.
 */
object AtlasCompat {
    @JvmStatic fun track(db: SQLiteDatabase) {
        for (name in arrayOf("FoPositionEntity","TradeLedgerEntity","PriceAlertEntity","CachedSnapshotEntity")) {
            require(db.rawQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", arrayOf(name))
                .use { it.moveToFirst() }) { "room_v2_missing_tables" }
        }
        require(db.rawQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name='room_master_table'",null).use { it.moveToFirst() }) {
            "room_v2_identity_missing"
        }
        // Room v2 is only safe to bridge if its schema identity is present.
        val identity=db.rawQuery("SELECT identity_hash FROM room_master_table WHERE id=42",null).use {
            if(it.moveToFirst())it.getString(0) else null
        }
        require(!identity.isNullOrBlank()){"room_v2_identity_missing"}
        db.execSQL("CREATE TABLE IF NOT EXISTS atlas_serial(id INTEGER PRIMARY KEY, generation INTEGER NOT NULL)")
        db.execSQL("INSERT OR IGNORE INTO atlas_serial VALUES(1,0)")
        for (table in listOf("FoPositionEntity","TradeLedgerEntity")) {
            for (event in listOf("INSERT","UPDATE","DELETE")) {
                db.execSQL("CREATE TRIGGER IF NOT EXISTS atlas_${table}_${event} AFTER $event ON $table BEGIN UPDATE atlas_serial SET generation=generation+1 WHERE id=1; END")
            }
        }
    }
    @JvmStatic fun serial(db: SQLiteDatabase): Long =
        db.rawQuery("SELECT generation FROM atlas_serial WHERE id=1",null).use {
            check(it.moveToFirst()) { "room_v2_serial_missing" }
            it.getLong(0)
        }

    private fun supported(p:JSONObject): Boolean =
        p.optString("type") in listOf("FUT","PE") && p.optString("side","BUY") == "BUY"
    private fun mirroredRows(db:SQLiteDatabase):Set<String> {
        val ids=mutableSetOf<String>()
        db.rawQuery("SELECT id FROM TradeLedgerEntity",null).use { c ->
            while(c.moveToNext())ids.add(c.getString(0))
        }
        return ids
    }
    private fun nativeClose(id:String,p:JSONObject):Boolean =
        id!="opening" && !id.startsWith("journal/") && !id.startsWith("history/") &&
        p.optString("kind")=="close" && p.optJSONObject("leg")?.let(::supported)==true

    private fun JSONObject.rows(key:String):List<JSONObject> {
        val a=optJSONArray(key) ?: return emptyList()
        return List(a.length()){a.getJSONObject(it)}
    }
    private data class Ledger(val id:String,val payload:String,val gross:Long,val fees:Long)
    private fun paise(value:Double):Long {
        require(value.isFinite() && kotlin.math.abs(value)<=1e13) { "invalid_ledger_amount" }
        return Math.round(value*100.0)
    }
    private fun project(book:JSONObject):List<Ledger> {
        val h=book.optJSONObject("history") ?: JSONObject()
        val legacy=book.optJSONObject("legacy") ?: JSONObject()
        val charges=h.optJSONObject("charges")
        val excluded=h.optJSONArray("excludedJournalIds")
        val skip=(0 until (excluded?.length()?:0)).map { excluded!!.getString(it) }.toSet()
        val rows=mutableListOf<Ledger>()
        fun record(id:String,p:JSONObject,g:Double,f:Double) {
            rows.add(Ledger(id,p.toString(),paise(g),paise(f)))
        }
        val opening=if(h.optBoolean("excludeLegacyRealized"))0.0 else legacy.optDouble("realized",0.0)
        val baseFees=charges?.getDouble("amount")?:legacy.optDouble("costs",0.0)
        if(opening!=0.0||baseFees!=0.0)record("opening",legacy,opening,baseFees)
        for(r in h.rows("records"))record("history/"+r.getString("id"),r,r.getDouble("gross"),0.0)
        for(j in book.rows("journal")) {
            val id=j.getString("id")
            val kind=j.getString("kind")
            val fee=when(kind) {"close"->j.getDouble("fees");"fee"->j.getDouble("amount");else->0.0}
            val gross=if(kind=="close" && id !in skip) {
                val leg=j.getJSONObject("leg")
                (j.getDouble("exit")-leg.getDouble("entry"))*leg.getInt("lots")*leg.getInt("lotSize")
            }else 0.0
            val later=charges==null || j.getString("date")>charges.getString("asOf")
            record("journal/"+id,j,gross,if(later)fee else 0.0)
        }
        return rows
    }

    /**
     * Reconcile the supported subset. A snapshot does not misclassify native-only
     * short positions or calls as long protective exposure.
     */
    @JvmStatic fun visible(db:SQLiteDatabase,original:JSONObject?):JSONObject? {
        val legs=JSONArray()
        db.rawQuery("SELECT id,payload FROM FoPositionEntity ORDER BY rowid",null).use { cursor ->
            while(cursor.moveToNext()) {
                val p=JSONObject(cursor.getString(1))
                if(supported(p))legs.put(p.put("id",cursor.getString(0)))
            }
        }
        val journal=JSONArray()
        val historic=JSONArray()
        var openingPresent=false
        db.rawQuery("SELECT id,payload,fees FROM TradeLedgerEntity ORDER BY rowid",null).use { cursor ->
            while(cursor.moveToNext()) {
                val id=cursor.getString(0)
                val p=JSONObject(cursor.getString(1))
                val fee=cursor.getLong(2)
                when {
                    id=="opening"->openingPresent=true
                    id.startsWith("journal/")->journal.put(p)
                    id.startsWith("history/")->historic.put(p)
                    nativeClose(id,p)-> {
                        val leg=p.getJSONObject("leg")
                        if(leg.optString("id").isBlank())leg.put("id",id)
                        journal.put(p.put("id",id).put("fees",fee/100.0))
                    }
                }
            }
        }
        if(original==null&&legs.length()==0&&journal.length()==0&&historic.length()==0)return null
        if(historic.length()>0 && original?.optJSONObject("history")==null)
            throw IllegalStateException("room_v2_history_mismatch")
        // Missing source rows must never silently erase history or lifetime charges.
        if(original!=null) {
            val available=mirroredRows(db)
            for(row in project(original)) {
                if(row.id.startsWith("history/") && row.id !in available)
                    throw IllegalStateException("room_v2_history_mismatch")
                if(row.id=="opening" && row.id !in available)
                    throw IllegalStateException("room_v2_opening_mismatch")
            }
        }
        val book=original?:JSONObject().put("version",4)
        if(!openingPresent && original!=null && project(original).any { it.id=="opening" }) {
            throw IllegalStateException("room_v2_opening_mismatch")
        }
        book.put("legs",legs).put("journal",journal)
        book.optJSONObject("history")?.let { history ->
            history.put("records",historic)
            val ids=(0 until journal.length()).map { journal.getJSONObject(it).optString("id") }.toSet()
            history.optJSONArray("excludedJournalIds")?.let { old ->
                history.put("excludedJournalIds",JSONArray((0 until old.length()).map { old.getString(it) }.filter{it in ids}))
            }
        }
        return book
    }

    /**
     * Must run within BookStore's single SQLite transaction. Do not touch
     * Room-native short/call contracts, native non-mirror ledger entries,
     * alerts, or cached data. A conflict must abort ALL writes atomically.
     */
    @JvmStatic fun write(db:SQLiteDatabase,book:JSONObject) {
        val legs=book.getJSONArray("legs")
        val incoming=(0 until legs.length()).associate { legs.getJSONObject(it).let { p -> p.getString("id") to p } }
        val removed=mutableListOf<String>()
        db.rawQuery("SELECT id,payload FROM FoPositionEntity",null).use { cursor ->
            while(cursor.moveToNext()){
                val id=cursor.getString(0)
                val native=JSONObject(cursor.getString(1))
                if(supported(native) && id !in incoming)removed.add(id)
                if(!supported(native))require(id !in incoming) { "room_v2_contract_id_conflict" }
            }
        }
        removed.forEach { db.delete("FoPositionEntity","id=?",arrayOf(it)) }
        incoming.forEach { (id,p) ->
            require(supported(p)) { "unsupported_contract_in_legacy_book" }
            db.execSQL("INSERT OR REPLACE INTO FoPositionEntity VALUES(?,?)",arrayOf(id,p.toString()))
        }
        val mirrored=project(book).associateBy { it.id }.toMutableMap()
        val obsolete=mutableListOf<String>()
        db.rawQuery("SELECT id,payload,gross,fees FROM TradeLedgerEntity",null).use { cursor ->
            while(cursor.moveToNext()) {
                val id=cursor.getString(0)
                val p=JSONObject(cursor.getString(1))
                when {
                    nativeClose(id,p)-> {
                        // Native-only close entries are immutable evidence, not
                        // stale mirror rows. Never delete or rewrite them when
                        // importing a legacy snapshot that omits the close.
                        val match=mirrored.remove("journal/"+id)
                        if(match!=null &&
                           (match.gross!=cursor.getLong(2)||match.fees!=cursor.getLong(3)))
                            throw IllegalStateException("room_v2_native_ledger_conflict")
                    }
                    (id=="opening" || id.startsWith("history/") || id.startsWith("journal/")) && id !in mirrored->
                        obsolete.add(id)
                }
            }
        }
        obsolete.forEach { db.delete("TradeLedgerEntity","id=?",arrayOf(it)) }
        mirrored.values.forEach { row ->
            db.execSQL("INSERT OR REPLACE INTO TradeLedgerEntity(id,payload,gross,fees) VALUES(?,?,?,?)",
                arrayOf(row.id,row.payload,row.gross,row.fees))
        }
    }
}
