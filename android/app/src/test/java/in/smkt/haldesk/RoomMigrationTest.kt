package `in`.smkt.haldesk

import android.content.Context
import androidx.room.Room
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk=[28],manifest=Config.NONE)
class RoomMigrationTest {
    private val first="""{"version":4,"legs":[],"journal":[]}"""
    private val second="""{"version":4,"legs":[{"id":"f","type":"FUT","entry":4900,"lots":2,"lotSize":150,"expiry":"2026-12-29"}],"journal":[{"id":"fee","kind":"fee","date":"2026-10-01","amount":25.25}],"legacy":{"realized":-10000,"costs":50}}"""

    @Test fun openingCorruptRoomFilePreservesItsOriginalBytes() {
        val c=RuntimeEnvironment.getApplication() as Context
        val name="room-corruption-test"
        val file=c.getDatabasePath(name)
        file.parentFile!!.mkdirs()
        val original="fixture with invalid database header".toByteArray()
        file.writeBytes(original)
        val db=Room.databaseBuilder(c,TradebookDb::class.java,name)
            .openHelperFactory(PreservingRoomHelper).addMigrations(atlasMigration).allowMainThreadQueries().build()
        try {
            assertThrows(Exception::class.java) { db.openHelper.writableDatabase }
            assertArrayEquals(original,file.readBytes())
        } finally { db.close() }
    }

    @Test fun migratesOnceAndKeepsOriginalRecoveryCacheAndStaleWriterIsBlocked(){
        val c:Context=RuntimeEnvironment.getApplication()
        c.deleteDatabase("haldesk_book.db")
        BookStore(c).use { old ->
            old.save(first,0)
            old.save(second,1)
            old.cachePut("health","""{"test":true}""")
            val saved=old.load(false).getJSONObject("book").toString()
            val recovery=old.load(true).getJSONObject("book").toString()
            repeat(2) {
                val db=Room.databaseBuilder(c,TradebookDb::class.java,"haldesk_book.db")
                    .openHelperFactory(PreservingRoomHelper).addMigrations(atlasMigration).allowMainThreadQueries().build()
                try { runBlocking {
                    assertEquals("f",db.book().positions().first().single().id)
                    val ledger=db.book().ledger().first()
                    assertEquals(2,ledger.size)
                    assertEquals(-1007525L,ledger.sumOf { it.gross-it.fees })
                    assertEquals(saved,db.book().cached("atlas-original")!!.payload)
                }} finally { db.close() }
            }
            assertThrows(Exception::class.java){old.save(first,2)}
            BookStore(c).use { upgraded ->
                assertEquals(2,upgraded.load(false).getInt("revision"))
                assertEquals(recovery,upgraded.load(true).getJSONObject("book").toString())
                assertTrue(upgraded.cacheGet("health").getJSONObject("data").getBoolean("test"))
            }
        }
    }
}
