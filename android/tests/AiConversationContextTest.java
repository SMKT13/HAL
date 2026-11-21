package in.smkt.haldesk;

import java.time.Instant;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AiConversationContextTest {
    private static int checks;
    static void check(boolean condition) {
        checks++;if(!condition)throw new AssertionError("AI conversation test #"+checks);
    }
    static JSONObject record(String id,String thread, boolean privateRecord,String revision,int minutes) throws Exception {
        return new JSONObject().put("id",id).put("conversationId",thread)
            .put("portfolioIncluded",privateRecord).put("bookRevision",revision)
            .put("question","What changed "+id+"?").put("reply","Synthetic response "+id)
            .put("updatedAt",Instant.parse("2026-11-20T10:00:00Z").plusSeconds(60L*minutes).toString());
    }
    public static void main(String[] args) throws Exception {
        JSONArray records = new JSONArray()
            .put(record("a","alpha",true,"rev-oldold00",0))
            .put(record("b","alpha",true,"rev-newnew00",1))
            .put(record("c","alpha",false,"",2))
            .put(record("d","other",false,"",3));
        JSONObject doc = new JSONObject().put("schema",1).put("items",records);
        JSONObject selected=AiConversationContext.select(doc,"alpha","rev-newnew00",true);
        check(selected.getInt("includedCount")==2);
        check(selected.getInt("excludedCount")==1);
        check(selected.getJSONArray("conversation").getJSONObject(0).getString("question").contains("b"));
        JSONObject publicOnly=AiConversationContext.select(doc,"alpha",null,false);
        check(publicOnly.getInt("includedCount")==1);
        check(publicOnly.getInt("excludedCount")==2);
        check(publicOnly.getJSONArray("conversation").getJSONObject(0).getString("question").contains("c"));
        check(AiConversationContext.select(doc,"other",null,false).getInt("includedCount")==1);
        try {AiConversationContext.select(doc,"bad id",null,false);throw new AssertionError("Bad thread accepted");}
        catch(Exception expected){checks++;}
        JSONArray many=new JSONArray();
        for(int i=0;i<12;i++)many.put(record("id"+i,"alpha",false,"",i));
        JSONObject limited=AiConversationContext.select(new JSONObject().put("schema",1).put("items",many),"alpha",null,false);
        check(limited.getInt("includedCount")==8);
        check(limited.getJSONArray("conversation").getJSONObject(0).getString("question").contains("id4"));
        System.out.println("PASS "+checks+" bounded context and revision privacy checks");
    }
}
