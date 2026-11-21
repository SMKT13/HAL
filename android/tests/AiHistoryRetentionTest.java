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
        JSONArray activeThread=new JSONArray()
            .put(item("old-turn",now-120*days,false).put("conversationId","running"))
            .put(item("new-turn",now-days,false).put("conversationId","running"));
        JSONObject inThread=AiHistoryRetention.prune(new JSONObject().put("schema",1).put("items",activeThread),now);
        check(inThread.getJSONArray("items").length()==2);
        check(inThread.getJSONArray("items").getJSONObject(1).getString("id").equals("old-turn"));
        JSONObject pinnedOnly=new JSONObject().put("schema",1).put("items",new JSONArray().put(item("old-pinned",now-200*days,true)));
        check(AiHistoryRetention.prune(pinnedOnly,now).getJSONArray("items").length()==1);
        check(AiHistoryRetention.setPinned(pinnedOnly,"old-pinned",false,now).getJSONArray("items").length()==0);
        System.out.println("PASS "+count+" encrypted-store retention policy checks");
    }
}
