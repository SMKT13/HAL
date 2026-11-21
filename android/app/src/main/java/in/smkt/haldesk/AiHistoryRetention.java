package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.Map;

/** Pure 90-day local AI retention policy. Pinned research is never pruned. */
final class AiHistoryRetention {
    static final long RETENTION_MS=90L*24*60*60*1000;
    static final int MAX_RECORDS=200;
    private AiHistoryRetention(){}
    static JSONObject empty()throws Exception {return new JSONObject().put("schema",1).put("items",new JSONArray());}
    static long time(JSONObject item){
        try{return Instant.parse(item.optString("updatedAt","")).toEpochMilli();}
        catch(Exception ignored){return -1;}
    }
    static JSONObject prune(JSONObject doc,long now)throws Exception {
        if(doc==null||doc.optInt("schema",0)!=1)throw new Exception("Unsupported AI history schema.");
        JSONArray raw=doc.optJSONArray("items");if(raw==null)throw new Exception("Invalid AI history records.");
        // Ordinary chat expiration is based on the last activity of its thread,
        // not the age of individual turns within an otherwise active conversation.
        Map<String,Long> lastActivity=new HashMap<>();
        for(int i=0;i<raw.length();i++){
            JSONObject item=raw.optJSONObject(i);if(item==null)continue;
            long updated=time(item);
            if(updated<0||updated>now+86400000)continue;
            String thread=item.optString("conversationId",item.optString("id",""));
            Long previous=lastActivity.get(thread);
            if(previous==null||updated>previous)lastActivity.put(thread,updated);
        }
        ArrayList<JSONObject> retained=new ArrayList<>();
        for(int i=0;i<raw.length();i++){
            JSONObject item=raw.optJSONObject(i);if(item==null)continue;
            boolean pinned=item.optBoolean("pinned",false);
            String thread=item.optString("conversationId",item.optString("id",""));
            Long activity=lastActivity.get(thread);
            if(!pinned&&(activity==null||now-activity>=RETENTION_MS))continue;
            retained.add(item);
        }
        retained.sort(Comparator.comparingLong(AiHistoryRetention::time).reversed());
        // Never silently discard valid conversation turns to satisfy a storage cap.
        JSONArray records=new JSONArray();for(JSONObject item:retained)records.put(item);
        return new JSONObject().put("schema",1).put("items",records);
    }
    static JSONObject upsert(JSONObject doc,JSONObject next,long now)throws Exception {
        String id=next.optString("id","");
        if(!id.matches("[A-Za-z0-9_-]{1,80}"))throw new Exception("Invalid AI history identifier.");
        JSONObject cleaned=prune(doc,now);JSONArray raw=cleaned.getJSONArray("items"),out=new JSONArray();
        boolean pinned=next.optBoolean("pinned",false);
        for(int i=0;i<raw.length();i++){
            JSONObject item=raw.getJSONObject(i);
            if(item.optString("id").equals(id)){pinned=pinned||item.optBoolean("pinned",false);continue;}
            out.put(item);
        }
        next.put("pinned",pinned);
        out.put(next);
        JSONObject bounded=prune(new JSONObject().put("schema",1).put("items",out),now);
        if(bounded.getJSONArray("items").length()>MAX_RECORDS)
            throw new Exception("AI history record limit reached. Delete or export old reports before saving.");
        return bounded;
    }
    static JSONObject setPinned(JSONObject doc,String id,boolean pinned,long now)throws Exception {
        JSONObject clean=prune(doc,now);JSONArray records=clean.getJSONArray("items");
        for(int i=0;i<records.length();i++){
            JSONObject item=records.getJSONObject(i);
            if(item.optString("id").equals(id)){item.put("pinned",pinned);return prune(clean,now);}
        }
        throw new Exception("AI history record not found.");
    }
    static JSONObject remove(JSONObject doc,String id,long now)throws Exception {
        JSONObject clean=prune(doc,now);JSONArray raw=clean.getJSONArray("items"),out=new JSONArray();
        for(int i=0;i<raw.length();i++){JSONObject item=raw.getJSONObject(i);if(!item.optString("id").equals(id))out.put(item);}
        return new JSONObject().put("schema",1).put("items",out);
    }
}
