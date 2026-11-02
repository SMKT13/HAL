package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;

/** Independent, sequential role prompts using one Gemini account; AI never alters the saved book. */
final class AgentDesk {
    interface Progress { void announce(int stage, String label); }
    private static final String[] MODES={
        "agent_technical","agent_business","agent_derivatives","agent_bull","agent_bear","agent_risk"
    };
    private static final String[] LABELS={
        "Technical analyst","Business and news analyst","F&O position analyst",
        "Bull researcher","Bear researcher","Risk chair"
    };
    static void validate(String question,JSONObject evidence)throws Exception{
        if(question==null||question.length()>2000)throw new Exception("Enter a question of up to 2,000 characters.");
        if(evidence==null||evidence.toString().length()>24000)throw new Exception("The evidence packet is too large.");
        if(evidence.optJSONObject("risk")==null)throw new Exception("Load position risk data before an agent review.");
    }
    static JSONObject select(JSONObject source,String...keys)throws Exception{
        JSONObject selected=new JSONObject();
        for(String key:keys)if(source.has(key))selected.put(key,source.get(key));
        return selected;
    }
    static JSONArray summaries(JSONArray previous,int limit)throws Exception{
        JSONArray out=new JSONArray();
        for(int i=0;i<Math.min(limit,previous.length());i++){
            JSONObject item=previous.getJSONObject(i);
            String reply=item.optString("reply","");
            out.put(new JSONObject().put("role",item.optString("role",""))
                .put("reply",reply.substring(0,Math.min(1100,reply.length()))));
        }
        return out;
    }
    static JSONObject stageEvidence(String mode,JSONObject source,JSONArray previous)throws Exception{
        JSONObject out;
        switch(mode){
            case "agent_technical":
                out=select(source,"quoteAsOf","quoteFreshness","spot","dataHealth","technical","previousSnapshot");break;
            case "agent_business":
                out=select(source,"quoteAsOf","dataHealth","fundamentals","news","sources","positionContext");break;
            case "agent_derivatives":
                out=select(source,"quoteAsOf","quoteFreshness","positions","risk","positionDesk","positionContext","ledger","funding","hedgeComparisons");break;
            case "agent_bull":case "agent_bear":
                out=select(source,"quoteAsOf","quoteFreshness","spot","technical","risk","positionDesk");
                out.put("analystSummaries",summaries(previous,3));break;
            case "agent_risk":
                out=select(source,"quoteAsOf","quoteFreshness","positions","risk","positionDesk","funding","hedgeComparisons");
                out.put("analystSummaries",summaries(previous,5));break;
            default:throw new Exception("Unknown agent role.");
        }
        return out;
    }
    static JSONObject run(AiClient client,String key,String model,String question,JSONObject evidence,Progress progress)throws Exception{
        validate(question,evidence);
        JSONArray findings=new JSONArray();
        String focus=question.trim().isEmpty()
            ?"Review the saved HAL position, uncertain evidence, hedge and next rollover risks.":question;
        for(int i=0;i<MODES.length;i++){
            progress.announce(i+1,LABELS[i]);
            JSONObject packet=stageEvidence(MODES[i],evidence,findings);
            if(packet.toString().length()>24000)throw new Exception("An agent's evidence exceeds the request limit.");
            JSONObject result;
            try { result=client.generate(key,model,MODES[i],focus,packet); }
            catch(AiClient.Failure error) {
                throw new AiClient.Failure(LABELS[i]+" (stage "+(i+1)+"/6): "+error.getMessage());
            }
            String reply=result.optString("reply","").trim();
            if(reply.isEmpty())throw new Exception("An agent returned no usable analysis.");
            findings.put(new JSONObject().put("role",LABELS[i]).put("reply",reply));
        }
        JSONArray sources=evidence.optJSONArray("sources");
        return new JSONObject().put("success",true).put("direct",true)
            .put("source",model+" · six sequential calls")
            .put("reply",findings.getJSONObject(5).optString("reply"))
            .put("agents",findings).put("grounded",false)
            .put("generatedAt",Instant.now().toString()).put("dataAsOf",evidence.opt("quoteAsOf"))
            .put("sources",sources==null?new JSONArray():sources);
    }
}

