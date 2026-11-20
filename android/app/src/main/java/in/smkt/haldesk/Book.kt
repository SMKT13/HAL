package `in`.smkt.haldesk

import android.content.Context
import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.flow.Flow
import org.json.JSONObject
import java.security.MessageDigest

@Entity data class FoPositionEntity(@PrimaryKey val id:String,val payload:String)
@Entity data class TradeLedgerEntity(@PrimaryKey val id:String,val payload:String,val gross:Long,val fees:Long)
@Entity data class PriceAlertEntity(@PrimaryKey val id:String,val kind:String,val threshold:Double,val enabled:Boolean)
@Entity data class CachedSnapshotEntity(@PrimaryKey val id:String,val payload:String,val at:Long)
@Dao interface BookDao {
    @Query("SELECT * FROM FoPositionEntity ORDER BY id") fun positions():Flow<List<FoPositionEntity>>
    @Query("SELECT * FROM TradeLedgerEntity ORDER BY rowid") fun ledger():Flow<List<TradeLedgerEntity>>
    @Query("SELECT * FROM PriceAlertEntity ORDER BY id") fun alerts():Flow<List<PriceAlertEntity>>
    @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun save(row:FoPositionEntity)
    @Insert suspend fun log(row:TradeLedgerEntity)
    @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun save(row:PriceAlertEntity)
    @Insert(onConflict=OnConflictStrategy.REPLACE) suspend fun cache(row:CachedSnapshotEntity)
    @Query("SELECT * FROM CachedSnapshotEntity WHERE id=:id") suspend fun cached(id:String):CachedSnapshotEntity?
    @Query("DELETE FROM FoPositionEntity WHERE id=:id AND payload=:payload") suspend fun removeVersion(id:String,payload:String):Int
    @Delete suspend fun remove(row:PriceAlertEntity)
}
fun paise(n:Double):Long { require(n.isFinite() && kotlin.math.abs(n)<=1e13); return Math.round(n*100) }
private fun tables(db:SupportSQLiteDatabase){
    db.execSQL("CREATE TABLE FoPositionEntity (id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL)")
    db.execSQL("CREATE TABLE TradeLedgerEntity (id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,gross INTEGER NOT NULL,fees INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE PriceAlertEntity (id TEXT NOT NULL PRIMARY KEY,kind TEXT NOT NULL,threshold REAL NOT NULL,enabled INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE CachedSnapshotEntity (id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,at INTEGER NOT NULL)")
}
val atlasMigration=object:Migration(1,2){
    override fun migrate(db:SupportSQLiteDatabase){
        tables(db)
        db.query("SELECT payload,digest,updated_at FROM book WHERE id=1").use { c ->
            if(!c.moveToFirst()) return
            val raw=c.getString(0)
            val digest=MessageDigest.getInstance("SHA-256").digest(raw.toByteArray()).joinToString(""){"%02x".format(it)}
            require(digest==c.getString(1)){"Saved book failed checksum verification"}
            val b=BookValidator.parse(raw)
            db.execSQL("INSERT INTO CachedSnapshotEntity VALUES(?,?,?)",arrayOf("atlas-original",raw,c.getLong(2)))
            val legs=b.getJSONArray("legs")
            for(i in 0 until legs.length()){
                val leg=legs.getJSONObject(i)
                db.execSQL("INSERT INTO FoPositionEntity(id,payload) VALUES(?,?)",arrayOf(leg.getString("id"),leg.toString()))
            }
            for(r in AtlasCompat.project(b))db.execSQL("INSERT INTO TradeLedgerEntity VALUES(?,?,?,?)",arrayOf<Any>(r.id,r.payload,r.gross,r.fees))
        }
    }
}
@Database(entities=[FoPositionEntity::class,TradeLedgerEntity::class,PriceAlertEntity::class,CachedSnapshotEntity::class],version=2,exportSchema=false)
abstract class TradebookDb:RoomDatabase(){
    abstract fun book():BookDao
    companion object {
        @Volatile private var instance:TradebookDb?=null
        fun get(c:Context): TradebookDb = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(c.applicationContext,TradebookDb::class.java,"haldesk_book.db")
                .addMigrations(atlasMigration).build().also { instance=it }
        }
    }
}
