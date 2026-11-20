package in.smkt.haldesk;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
public final class AiHistoryRetentionTest {
    private static int count;
    private static void check(boolean ok){count++;if(!ok)throw new AssertionError("History test "+count);}
    private static JSONObject item(String id,long time,boolean pinned)throws Exception{
        return new JSONObject().put("id",id).put("updatedAt",Instant.ofEpochMilli(time).toString()).put("pinned",pinned);
    }
    public static void main(String[]args)throws Exception {
        long now=Instant.parse("2026-11-20T10:00:00Z").toEpochMilli();
        long days=24*60*60*1000L;
        JSONArray rows=new JSONArray().put(item("fresh",now-days,false))
           .put(item("expired",now-91*days,false))
           .put(item("pinned",now-200*days,true))
           .put(item("boundary",now-90*days,false));
        JSONObject doc=new JSONObject().put("schema",1).put("items",rows);
        JSONObject clean=AiHistoryRetention.prune(doc,now);
        check(clean.getJSONArray("items").length()==2);
        check(clean.getJSONArray("items").getJSONObject(0).getString("id").equals("fresh"));
        check(clean.getJSONArray("items").getJSONObject(1).getString("id").equals("pinned"));
        JSONObject newer=item("new",now,false);
        clean=AiHistoryRetention.upsert(clean,newer,now);check(clean.getJSONArray("items").length()==3);
        clean=AiHistoryRetention.setPinned(clean,"fresh",true,now);
        check(clean.getJSONArray("items").getJSONObject(1).getBoolean("pinned"));
        clean=AiHistoryRetention.remove(clean,"fresh",now);
        check(clean.getJSONArray("items").length()==2);
        System.out.println("PASS "+count+" encrypted-store retention policy checks");
    }
}
