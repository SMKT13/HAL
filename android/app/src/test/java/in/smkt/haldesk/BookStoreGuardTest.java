package in.smkt.haldesk;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, manifest = Config.NONE)
public class BookStoreGuardTest {
    private Context context;
    @Before public void setup() {
        context = RuntimeEnvironment.getApplication();
        context.deleteDatabase("haldesk_book.db");
    }
    @Test public void incompleteRoomV2SchemaNeverAltered() throws Exception {
        SQLiteDatabase db=context.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null);
        db.execSQL("CREATE TABLE book(id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER)");
        db.execSQL("CREATE TABLE FoPositionEntity(id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL)");
        db.execSQL("INSERT INTO FoPositionEntity VALUES ('native-test','{\"type\":\"CE\"}')");
        db.setVersion(2);db.close();
        try(BookStore store=new BookStore(context)){
            try {store.load(false);fail("Incomplete Room v2 must not be opened");}
            catch(Exception expected){assertTrue(expected.getMessage().contains("room_v2_missing_tables"));}
            try {store.save("{\"version\":4,\"legs\":[],\"journal\":[]}",0);fail("Incomplete Room v2 must not be written");}
            catch(Exception expected){assertTrue(expected.getMessage().contains("room_v2_missing_tables"));}
        }
        try(SQLiteDatabase inspect=SQLiteDatabase.openDatabase(context.getDatabasePath("haldesk_book.db").getPath(),null,SQLiteDatabase.OPEN_READONLY)){
            assertEquals(2,inspect.getVersion());
            try(android.database.Cursor c=inspect.rawQuery("SELECT payload FROM FoPositionEntity WHERE id='native-test'",null)){
                assertTrue(c.moveToFirst());
                assertEquals("{\"type\":\"CE\"}",c.getString(0));
            }
        }
    }
    @Test public void unknownSchemaFailsClosedWithoutCrashingConstructor() throws Exception {
        SQLiteDatabase db=context.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null);
        db.execSQL("CREATE TABLE arbitrary (note TEXT)");
        db.setVersion(3);
        db.close();
        try(BookStore store=new BookStore(context)){
            try {store.load(false);fail("Unknown version must be blocked");}
            catch(Exception ex){assertEquals("database_unreadable_or_unsupported",ex.getMessage());}
        }
        try(SQLiteDatabase inspect=SQLiteDatabase.openDatabase(context.getDatabasePath("haldesk_book.db").getPath(),null,SQLiteDatabase.OPEN_READONLY)){
            assertEquals(3,inspect.getVersion());
        }
    }
    @Test public void malformedSqliteCannotCrashConstructorOrDestroyBytes() throws Exception {
        java.io.File file=context.getDatabasePath("haldesk_book.db");
        file.getParentFile().mkdirs();
        byte[] original="this is not a sqlite file".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        java.nio.file.Files.write(file.toPath(),original);
        try(BookStore store=new BookStore(context)){
            try{store.load(false);fail("Corrupt database must be blocked");}
            catch(Exception ex){assertEquals("database_unreadable_or_unsupported",ex.getMessage());}
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(file.toPath()));
    }
    @Test public void legacyVersion1StillSupportsNormalBook() throws Exception {
        try(BookStore store=new BookStore(context)){
            assertEquals(1,store.save("{\"version\":4,\"legs\":[],\"journal\":[]}",0).getLong("revision"));
            assertNotNull(store.load(false).getJSONObject("book"));
        }
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(context.getDatabasePath("haldesk_book.db").getPath(),null,SQLiteDatabase.OPEN_READONLY)){
            assertEquals(1,db.getVersion());
        }
    }
}
