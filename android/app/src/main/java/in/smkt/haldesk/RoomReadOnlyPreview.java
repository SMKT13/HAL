package in.smkt.haldesk;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.util.HashSet;

/** Read-only preview of the Library 5.1.24 Room v2 sidecar; NEVER upgrades or mutates data. */
public final class RoomReadOnlyPreview {
    private RoomReadOnlyPreview() {}

    /** Returns null for legacy v1/new installs. Throws (fail-closed) for corrupt/unexpected v2. */
    public static JSONObject read(Context context) throws Exception {
        File file = context.getDatabasePath("haldesk_book.db");
        if (!file.exists()) return null;
        try (SQLiteDatabase db = SQLiteDatabase.openDatabase(file.getPath(),null,SQLiteDatabase.OPEN_READONLY)) {
            int schema = db.getVersion();
            if (schema == 1) return null;
            if (schema != 2) throw new Exception("unsupported_database_schema");
            if (!table(db,"FoPositionEntity") || !table(db,"TradeLedgerEntity")) {
                throw new Exception("room_v2_missing_tables");
            }
            JSONObject book = null;
            if (table(db,"book")) {
                try(Cursor c=db.rawQuery("SELECT payload,digest FROM book WHERE id=1",null)) {
                    if (c.moveToFirst()) {
                        String raw=c.getString(0),digest=c.getString(1);
                        if (!hash(raw).equals(digest)) throw new Exception("book_corrupted_recovery_available");
                        book=BookValidator.parse(raw);
                    }
                }
            }
            HashSet<String> seen=new HashSet<>(),original=new HashSet<>();
            if (book!=null) {
                JSONArray legs=book.getJSONArray("legs");
                for(int i=0;i<legs.length();i++)original.add(legs.getJSONObject(i).getString("id"));
            }
            JSONArray visible=new JSONArray();
            int nativeOnly=0;
            try(Cursor c=db.rawQuery("SELECT id,payload FROM FoPositionEntity ORDER BY rowid",null)) {
                if(c.getCount()>1000)throw new Exception("room_v2_too_many_contracts");
                while(c.moveToNext()){
                    String id=c.getString(0);
                    JSONObject item=new JSONObject(c.getString(1));
                    if(id==null || id.isEmpty() || !seen.add(id) || !id.equals(item.optString("id",id))){
                        throw new Exception("room_v2_invalid_contract_id");
                    }
                    String type=item.optString("type"),side=item.optString("side","BUY");
                    if(!("FUT".equals(type)||"CE".equals(type)||"PE".equals(type)) ||
                       !("BUY".equals(side)||"SELL".equals(side)))throw new Exception("room_v2_invalid_contract");
                    LocalDate.parse(item.getString("expiry"));
                    int lots=item.getInt("lots"),size=item.getInt("lotSize");
                    double entry=item.getDouble("entry");
                    if(lots<=0||size<=0||!Double.isFinite(entry)||entry<0 ||
                       ("FUT".equals(type)&&entry==0))throw new Exception("room_v2_invalid_contract");
                    JSONObject summary=new JSONObject()
                        .put("type",type).put("side",side).put("expiry",item.getString("expiry"))
                        .put("lots",lots).put("lotSize",size).put("entry",entry);
                    if(!"FUT".equals(type)){
                        double strike=item.getDouble("strike");
                        if(!Double.isFinite(strike)||strike<=0)throw new Exception("room_v2_invalid_contract");
                        summary.put("strike",strike);
                    }
                    visible.put(summary);
                    if(!original.contains(id))nativeOnly++;
                }
            }
            // Do not invent a P&L or hide any native-only transactions.
            long ledgerCount;
            try(Cursor c=db.rawQuery("SELECT COUNT(*) FROM TradeLedgerEntity",null)){
                if(!c.moveToFirst())throw new Exception("room_v2_ledger_unavailable");
                ledgerCount=c.getLong(0);
            }
            return new JSONObject().put("schema",2).put("legs",visible)
                .put("nativeOnly",nativeOnly).put("ledgerRows",ledgerCount)
                .put("message","Room v2 saved contracts (read-only). Full ledger, recovery P&L and edits require reconciliation. No database changes were made.");
        }
    }

    private static boolean table(SQLiteDatabase db,String name) {
        try(Cursor c=db.rawQuery("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",new String[]{name})){
            return c.moveToFirst();
        }
    }
    private static String hash(String raw)throws Exception {
        byte[] bytes=MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8));
        StringBuilder out=new StringBuilder(bytes.length*2);
        for(byte b:bytes)out.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        return out.toString();
    }
}
