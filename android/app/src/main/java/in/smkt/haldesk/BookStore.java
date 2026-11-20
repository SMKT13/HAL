package in.smkt.haldesk;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
/** Atomic snapshots. Never wipes legacy WebView data or silently resets corrupt records. */
final class BookStore extends SQLiteOpenHelper {
 private final int schemaAtOpen;
 /**
  * Detect the installed database version WITHOUT opening it for mutation.
  * Existing Room v2 data must not be silently downgraded or reinterpreted
  * by this legacy-only implementation.
  */
 private static int schemaOf(Context context) {
  java.io.File file=context.getDatabasePath("haldesk_book.db");
  if(!file.exists())return 1;
  try(SQLiteDatabase db=SQLiteDatabase.openDatabase(file.getPath(),null,SQLiteDatabase.OPEN_READONLY)){
   int version=db.getVersion();
   return (version==1||version==2)?version:0;
  }catch(android.database.sqlite.SQLiteException failure){
   // An unrecognised or damaged file must not crash MainActivity construction.
   // Never open it with SQLiteOpenHelper; both reads and writes fail closed.
   return 0;
  }
 }
 BookStore(Context context){this(context,schemaOf(context));}
 private BookStore(Context context,int observedSchema){
  // SQLiteOpenHelper requires a positive target version. No DB is actually
  // opened when the observed version is 0 (unreadable/unsupported).
  super(context,"haldesk_book.db",null,observedSchema==1?1:2);
  schemaAtOpen=observedSchema;
  if(schemaAtOpen==1)setWriteAheadLoggingEnabled(true);
 }
 private void requireCompatible(){
  if(schemaAtOpen==2)throw new IllegalStateException("room_v2_requires_reconciliation");
  if(schemaAtOpen==0)throw new IllegalStateException("database_unreadable_or_unsupported");
 }
 @Override public synchronized SQLiteDatabase getWritableDatabase(){
  requireCompatible();return super.getWritableDatabase();
 }
 @Override public synchronized SQLiteDatabase getReadableDatabase(){
  requireCompatible();return super.getReadableDatabase();
 }
 @Override public void onConfigure(SQLiteDatabase db){db.setForeignKeyConstraintsEnabled(true);}
 @Override public void onCreate(SQLiteDatabase db){
  for(String table:new String[]{"book","recovery"})db.execSQL("CREATE TABLE "+table+" (id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,updated_at INTEGER NOT NULL)");
  db.execSQL("CREATE TABLE cache (key TEXT PRIMARY KEY,payload TEXT NOT NULL,digest TEXT NOT NULL,updated_at INTEGER NOT NULL)");
 }
 @Override public void onUpgrade(SQLiteDatabase db,int before,int after){throw new IllegalStateException("Explicit database migration required");}
 synchronized JSONObject load(boolean previous)throws Exception{return read(getReadableDatabase(),previous?"recovery":"book");}
 private JSONObject read(SQLiteDatabase db,String table)throws Exception{
  JSONObject out=new JSONObject().put("ok",true).put("revision",0).put("book",JSONObject.NULL);
  try(Cursor c=db.query(table,new String[]{"revision","payload","digest","updated_at"},"id=1",null,null,null,null)){if(c.moveToFirst()){String payload=c.getString(1);if(!digest(payload).equals(c.getString(2)))throw new Exception("book_corrupted_recovery_available");out.put("revision",c.getLong(0)).put("book",BookValidator.parse(payload)).put("updatedAt",c.getLong(3));}}
  return out;
 }
 synchronized JSONObject save(String payload,long expected)throws Exception{
  JSONObject valid=BookValidator.parse(payload);if(expected<0)throw new Exception("invalid_revision");SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
  try{JSONObject old=read(db,"book");long rev=old.getLong("revision");if(rev!=expected)throw new Exception("revision_conflict_reload_required");if(!old.isNull("book"))db.execSQL("INSERT OR REPLACE INTO recovery SELECT * FROM book WHERE id=1");
   long next=rev+1,now=System.currentTimeMillis();valid.put("revision",next);String encoded=valid.toString();ContentValues v=new ContentValues();v.put("id",1);v.put("revision",next);v.put("payload",encoded);v.put("digest",digest(encoded));v.put("updated_at",now);if(db.insertWithOnConflict("book",null,v,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new Exception("book_save_failed");db.setTransactionSuccessful();return new JSONObject().put("ok",true).put("revision",next).put("updatedAt",now);
  }finally{db.endTransaction();}
 }
 synchronized long currentRevision(){try(Cursor c=getReadableDatabase().rawQuery("SELECT revision FROM book WHERE id=1",null)){return c.moveToFirst()?c.getLong(0):0;}catch(Exception e){return -1;}}
 synchronized JSONObject restorePrevious(long expected)throws Exception{
  SQLiteDatabase db=getWritableDatabase();db.beginTransaction();
  try{long current=currentRevision();if(current<0||current!=expected)throw new Exception("revision_conflict_reload_required");JSONObject old=read(db,"recovery");if(old.isNull("book"))throw new Exception("no_recovery_copy");JSONObject valid=BookValidator.parse(old.getJSONObject("book").toString());
   db.execSQL("CREATE TABLE IF NOT EXISTS quarantine (id INTEGER PRIMARY KEY AUTOINCREMENT,revision INTEGER NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL,updated_at INTEGER NOT NULL)");
   db.execSQL("INSERT INTO quarantine(revision,payload,digest,updated_at) SELECT revision,payload,digest,updated_at FROM book WHERE id=1");
   JSONObject risk=valid.optJSONObject("riskProfile");if(risk!=null){risk.put("confirmedAt",JSONObject.NULL);risk.put("confirmedBook",JSONObject.NULL);}
   long next=current+1,now=System.currentTimeMillis();valid.put("revision",next);String encoded=valid.toString();ContentValues v=new ContentValues();v.put("id",1);v.put("revision",next);v.put("payload",encoded);v.put("digest",digest(encoded));v.put("updated_at",now);if(db.insertWithOnConflict("book",null,v,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new Exception("book_save_failed");db.setTransactionSuccessful();return new JSONObject().put("ok",true).put("revision",next).put("book",valid).put("updatedAt",now);
  }finally{db.endTransaction();}
 }
 synchronized JSONObject cacheGet(String key)throws Exception{key(key);try(Cursor c=getReadableDatabase().query("cache",new String[]{"payload","digest","updated_at"},"key=?",new String[]{key},null,null,null)){if(!c.moveToFirst())return new JSONObject().put("ok",true).put("data",JSONObject.NULL);String p=c.getString(0);if(!digest(p).equals(c.getString(1)))throw new Exception("cache_corrupted");return new JSONObject().put("ok",true).put("data",new JSONObject(p)).put("storedAt",c.getLong(2)).put("cached",true);}}
 synchronized void cachePut(String key,String payload)throws Exception{key(key);if(payload==null||payload.getBytes(StandardCharsets.UTF_8).length>4000000)throw new Exception("cache_too_large");BookValidator.rejectCredentials(new JSONObject(payload),0);ContentValues v=new ContentValues();v.put("key",key);v.put("payload",payload);v.put("digest",digest(payload));v.put("updated_at",System.currentTimeMillis());if(getWritableDatabase().insertWithOnConflict("cache",null,v,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new Exception("cache_save_failed");}
 private void key(String k)throws Exception{if(k==null||!k.matches("(snapshot|research|health)(:[A-Za-z0-9_-]{1,40}){0,4}"))throw new Exception("invalid_cache_key");}
 private static String digest(String value)throws Exception{byte[] hash=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:hash)s.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return s.toString();}
}
