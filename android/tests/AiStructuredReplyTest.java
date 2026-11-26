package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;

public final class AiStructuredReplyTest {
    private static int checks;
    static void check(boolean ok){checks++;if(!ok)throw new AssertionError("Structured response check "+checks);}
    static void rejects(RunnableWithException fn)throws Exception {try{fn.run();}catch(Exception expected){checks++;return;}throw new AssertionError("Invalid AI output accepted");}
    interface RunnableWithException {void run()throws Exception;}
    static JSONObject sample()throws Exception {
        return new JSONObject()
            .put("conclusion","Synthetic data cannot establish a verified outlook.")
            .put("marketBias","UNAVAILABLE")
            .put("supportingEvidence",new JSONArray().put("No verified current cash quote"))
            .put("contraryEvidence",new JSONArray())
            .put("positionImplications","No authorized position evidence")
            .put("riskWarnings",new JSONArray().put("Stale marks"))
            .put("nextReview",new JSONArray().put("Refresh source"))
            .put("limitations",new JSONArray().put("Offline fixture"))
            .put("sourceIds",new JSONArray().put("https://example.org/a"));
    }
    public static void main(String[] args)throws Exception {
        check(AiStructuredReply.enabled("copilot"));
        check(AiStructuredReply.enabled("research"));
        check(!AiStructuredReply.enabled("agent_risk"));
        check(AiStructuredReply.schema().getJSONObject("properties").has("sourceIds"));
        JSONObject evidence=new JSONObject().put("sources",new JSONArray().put(new JSONObject().put("url","https://example.org/a")));
        JSONObject valid=AiStructuredReply.validate(sample().toString(),evidence);
        check(valid.getString("marketBias").equals("UNAVAILABLE"));
        check(AiStructuredReply.display(valid).contains("POSITION IMPLICATIONS"));
        String longApproved="https://example.org/filing/"+new String(new char[290]).replace('\0','x');
        JSONObject longEvidence=new JSONObject().put("sources",new JSONArray()
            .put(new JSONObject().put("url",longApproved)));
        JSONObject longCited=sample().put("sourceIds",new JSONArray().put(longApproved));
        check(AiStructuredReply.validate(longCited.toString(),longEvidence)
            .getJSONArray("sourceIds").getString(0).equals(longApproved));
        JSONObject missing=sample();
        missing.remove("positionImplications");
        rejects(()->AiStructuredReply.validate(missing.toString(),evidence));
        rejects(()->AiStructuredReply.validate("invalid-json",evidence));
        rejects(()->AiStructuredReply.validate(sample().put("sourceIds",new JSONArray().put("https://fake.example")).toString(),evidence));
        rejects(()->AiStructuredReply.validate(sample().put("marketBias","GUARANTEED").toString(),evidence));
        rejects(()->AiStructuredReply.validate(sample().put("riskWarnings",new JSONArray().put(123)).toString(),evidence));
        rejects(()->AiStructuredReply.validate(sample().put("conclusion","").toString(),evidence));
        System.out.println("PASS "+checks+" structured-output validation checks");
    }
}
