package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;

public final class AgentDeskTest {
    private static int count=0;
    static void check(boolean ok) { count++; if(!ok)throw new AssertionError("Agent desk check #"+count); }
    interface Checked { void apply()throws Exception; }
    static void rejects(Checked fn)throws Exception {try{fn.apply();}catch(Exception good){count++;return;}throw new AssertionError("Missing validation");}
    public static void main(String[] args)throws Exception {
        JSONObject e=new JSONObject().put("quoteAsOf","2026-10-20T09:30:00Z")
            .put("spot",5120).put("technical",new JSONObject().put("rsi",50))
            .put("risk",new JSONObject().put("futureUnits",200))
            .put("positions",new JSONArray().put(new JSONObject().put("type","FUT")))
            .put("fundamentals",new JSONObject().put("revenue","dated-source"))
            .put("funding",new JSONObject().put("free","unknown"));
        AgentDesk.validate("",e);
        rejects(()->AgentDesk.validate("",new JSONObject()));
        rejects(()->AgentDesk.validate(new String(new char[2001]),e));
        JSONArray past=new JSONArray().put(new JSONObject().put("role","Technical analyst").put("reply","RSI source dated"));
        JSONObject technical=AgentDesk.stageEvidence("agent_technical",e,past);
        check(technical.has("technical")&&!technical.has("positions"));
        JSONObject business=AgentDesk.stageEvidence("agent_business",e,past);
        check(business.has("fundamentals")&&!business.has("funding"));
        JSONObject futures=AgentDesk.stageEvidence("agent_derivatives",e,past);
        check(futures.has("positions")&&!futures.has("technical"));
        JSONObject bull=AgentDesk.stageEvidence("agent_bull",e,past);
        check(bull.getJSONArray("analystSummaries").length()==1);
        JSONObject bear=AgentDesk.stageEvidence("agent_bear",e,past);
        check(bear.has("analystSummaries"));
        JSONObject risk=AgentDesk.stageEvidence("agent_risk",e,past);
        check(risk.has("positions")&&risk.has("analystSummaries"));
        rejects(()->AgentDesk.stageEvidence("agent_execute",e,past));
        check(AgentDesk.summaries(past,5).getJSONObject(0).getString("reply").equals("RSI source dated"));
        check(AiPolicy.prompt("agent_risk","Review",risk.toString()).contains("RISK CHAIR"));
        System.out.println("PASS "+count+" agent role isolation and validation checks");
    }
}

