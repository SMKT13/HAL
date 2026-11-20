package in.smkt.haldesk;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, manifest = Config.NONE)
public class RoomReadOnlyPreviewTest {
 private Context context;
 @Before public void setup(){context=RuntimeEnvironment.getApplication();context.deleteDatabase("haldesk_book.db");}
 private SQLiteDatabase fixture(boolean broken) throws Exception {
  SQLiteDatabase db=context.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null);
  db.execSQL("CREATE TABLE book (id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT,digest TEXT,updated_at INTEGER)");
  db.execSQL("CREATE TABLE FoPositionEntity (id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL)");
  db.execSQL("CREATE TABLE TradeLedgerEntity (id TEXT NOT NULL PRIMARY KEY,payload TEXT NOT NULL,gross INTEGER NOT NULL,fees INTEGER NOT NULL)");
  String book="{\"version\":4,\"legs\":[],\"journal\":[]}";
  byte[] digest=MessageDigest.getInstance("SHA-256").digest(book.getBytes(StandardCharsets.UTF_8));
  StringBuilder hash=new StringBuilder();for(byte b:digest)hash.append(String.format("%02x",b&255));
  db.execSQL("INSERT INTO book VALUES(1,1,?,?,123)",new Object[]{book,broken?"broken":hash.toString()});
  db.execSQL("INSERT INTO FoPositionEntity VALUES(?,?)",new Object[]{"native-put","{\"id\":\"native-put\",\"type\":\"PE\",\"side\":\"SELL\",\"expiry\":\"2026-12-29\",\"strike\":4500,\"lots\":1,\"lotSize\":150,\"entry\":55}"});
  db.execSQL("INSERT INTO TradeLedgerEntity VALUES(?,?,?,?)",new Object[]{"native-closed","{\"kind\":\"close\"}",1000L,15L});
  db.setVersion(2);
  return db;
 }
 @Test public void previewsNativePositionWithoutChangingVersionOrLedger() throws Exception {
  fixture(false).close();
  JSONObject view=RoomReadOnlyPreview.read(context);
  assertEquals(2,view.getInt("schema"));
  assertEquals(1,view.getInt("nativeOnly"));
  assertEquals(1,view.getLong("ledgerRows"));
  assertEquals("SELL",view.getJSONArray("legs").getJSONObject(0).getString("side"));
  assertEquals("PE",view.getJSONArray("legs").getJSONObject(0).getString("type"));
  try(SQLiteDatabase db=SQLiteDatabase.openDatabase(context.getDatabasePath("haldesk_book.db").getPath(),null,SQLiteDatabase.OPEN_READONLY)) {
   assertEquals(2,db.getVersion());
   try(android.database.Cursor c=db.rawQuery("SELECT COUNT(*) FROM TradeLedgerEntity",null)){
    assertTrue(c.moveToFirst());assertEquals(1,c.getInt(0));
   }
  }
 }
 @Test public void nativeChangedAndMissingLegacyContractsFlagged() throws Exception {
  SQLiteDatabase db=fixture(false);
  // A valid original record not in Room indicates a discrepancy requiring reconciliation.
  String legacy="{\"version\":4,\"legs\":[{\"id\":\"legacy-future\",\"type\":\"FUT\",\"expiry\":\"2026-12-29\",\"lots\":1,\"lotSize\":150,\"entry\":4900}],\"journal\":[]}";
  byte[] bytes=MessageDigest.getInstance("SHA-256").digest(legacy.getBytes(StandardCharsets.UTF_8));
  StringBuilder digest=new StringBuilder();
  for(byte b:bytes)digest.append(String.format("%02x",b&255));
  db.execSQL("UPDATE book SET payload=?,digest=? WHERE id=1",new Object[]{legacy,digest.toString()});
  db.close();
  JSONObject result=RoomReadOnlyPreview.read(context);
  assertEquals(1,result.getInt("nativeOnly"));
  assertEquals(0,result.getInt("contractDifferences"));
  assertEquals(1,result.getInt("legacyOnly"));
 }
 @Test public void modifiedMatchingRoomContractIsExplicitlyCounted() throws Exception {
  SQLiteDatabase db=fixture(false);
  String legacy="{\"version\":4,\"legs\":[{\"id\":\"native-put\",\"type\":\"PE\",\"expiry\":\"2026-12-29\",\"lots\":1,\"lotSize\":150,\"entry\":55,\"strike\":4500}],\"journal\":[]}";
  byte[] bytes=MessageDigest.getInstance("SHA-256").digest(legacy.getBytes(StandardCharsets.UTF_8));
  StringBuilder digest=new StringBuilder();
  for(byte b:bytes)digest.append(String.format("%02x",b&255));
  db.execSQL("UPDATE book SET payload=?,digest=? WHERE id=1",new Object[]{legacy,digest.toString()});
  db.close();
  JSONObject result=RoomReadOnlyPreview.read(context);
  assertEquals(0,result.getInt("nativeOnly"));
  assertEquals(1,result.getInt("contractDifferences"));
  assertEquals(0,result.getInt("legacyOnly"));
 }
 @Test public void corruptBookCannotBeSilentlyPreviewed() throws Exception {
  fixture(true).close();
  try{RoomReadOnlyPreview.read(context);fail("Corrupt saved book must be blocked");}
  catch(Exception expected){assertEquals("book_corrupted_recovery_available",expected.getMessage());}
 }
 @Test public void legacyV1IsHandledByExistingBookStore() throws Exception {
  SQLiteDatabase db=context.openOrCreateDatabase("haldesk_book.db",Context.MODE_PRIVATE,null);db.setVersion(1);db.close();
  assertNull(RoomReadOnlyPreview.read(context));
 }
}
