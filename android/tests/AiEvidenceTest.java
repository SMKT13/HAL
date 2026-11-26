package in.smkt.haldesk;
import org.json.JSONArray;
import org.json.JSONObject;
public final class AiEvidenceTest {
    static int checks;static void check(boolean v){checks++;if(!v)throw new AssertionError("Evidence check "+checks);}
    static JSONObject packet()throws Exception{return new JSONObject("{\"schemaVersion\":4,\"portfolioIncluded\":true,\"bookRevision\":\"rev-1234abcd\",\"generatedAt\":\"2026-10-28T10:00:00Z\",\"token\":\"TOP_SECRET\",\"journal\":[\"PRIVATE MEMO\"],\"portfolio\":{\"notes\":\"PRIVATE NOTE\",\"legs\":[{\"id\":\"f\",\"type\":\"FUT\",\"lots\":2,\"lotSize\":150,\"manual\":0,\"password\":\"LEG_SECRET\"}]},\"valuation\":{\"open\":0,\"realized\":200,\"complete\":true},\"market\":{\"spot\":{\"price\":4900,\"token\":\"MARKET_SECRET\"}},\"sources\":[{\"url\":\"https://example.org/filing\"}],\"news\":[{\"title\":\"Synthetic HAL news\",\"url\":\"javascript:alert(1)\",\"memo\":\"PRIVATE NEWS\"}],\"fundamentals\":{\"metrics\":[{\"label\":\"revenue\",\"value\":100,\"kind\":\"provider\",\"period\":\"synthetic period\",\"apiKey\":\"SECRET\"}]},\"funding\":{\"margin\":100000,\"password\":\"SECRET\"}}");}
    public static void main(String[] args)throws Exception {
        JSONObject clean=AiPolicy.sanitizeEvidence(packet(),"copilot");String s=clean.toString();
        check(!s.contains("SECRET"));check(!s.contains("PRIVATE"));check(!s.contains("journal"));check(!s.contains("password"));
        check(clean.getBoolean("portfolioIncluded"));check(clean.getString("bookRevision").equals("rev-1234abcd"));
        check(clean.getJSONObject("valuation").getInt("open")==0);check(clean.getJSONObject("portfolio").getJSONArray("legs").getJSONObject(0).getInt("manual")==0);
        check(clean.getJSONArray("news").getJSONObject(0).isNull("url"));check(clean.getJSONObject("market").getJSONObject("spot").getInt("price")==4900);
        JSONObject privateUrl=packet().put("sources",new JSONArray().put(new JSONObject().put("url","https://example.org/report?access_token=private#secret")));
        check(AiPolicy.sanitizeEvidence(privateUrl,"research").getJSONArray("sources").getJSONObject(0).isNull("url"));
        check(!AiPolicy.sanitizeEvidence(packet(),"agent_business").has("portfolio"));
        check(!AiPolicy.sanitizeEvidence(packet(),"agent_technical").has("funding"));
        check(!AiPolicy.sanitizeEvidence(packet().put("portfolioIncluded","true"),"copilot").has("portfolio"));
        JSONObject recoveryPacket=packet().put("contextNote","untrusted custom instruction");
        JSONObject recoverySafe=AiPolicy.sanitizeEvidence(recoveryPacket,"copilot");
        check(recoverySafe.getString("contextNote").contains("Do not infer it."));
        check(!recoverySafe.toString().contains("untrusted custom instruction"));
        JSONObject partial=packet()
            .put("valuation",new JSONObject().put("complete",false)
                .put("open",-19000.50).put("net",-25000.25)
                .put("rows",new JSONArray().put(new JSONObject().put("pnl",-111111))))
            .put("scenarios",new JSONArray()
                .put(new JSONObject().put("complete",false).put("total",-222222)
                    .put("rows",new JSONArray().put(new JSONObject().put("pnl",-333333)))
                    .put("errors",new JSONArray().put("Missing option mark")))
                .put(new JSONObject().put("complete",true).put("total",-1200)
                    .put("rows",new JSONArray())));
        JSONObject partialSafe=AiPolicy.sanitizeEvidence(partial,"copilot");
        JSONObject valuationSafe=partialSafe.getJSONObject("valuation");
        check(!valuationSafe.getBoolean("complete"));
        check(!valuationSafe.has("net")&&!valuationSafe.has("open"));
        check(valuationSafe.getJSONArray("rows").length()==0);
        JSONObject invalidScenario=partialSafe.getJSONArray("scenarios").getJSONObject(0);
        check(!invalidScenario.has("total")&&invalidScenario.getJSONArray("rows").length()==0);
        check(invalidScenario.getJSONArray("errors").getString(0).contains("Missing option mark"));
        check(partialSafe.getJSONArray("scenarios").getJSONObject(1).getInt("total")==-1200);
        check(!partialSafe.toString().contains("111111")&&!partialSafe.toString().contains("222222")
            &&!partialSafe.toString().contains("333333"));
        check(AiPolicy.evidenceDigest(partialSafe).equals(
            AiPolicy.evidenceDigest(AiPolicy.sanitizeEvidence(partialSafe,"copilot"))));
        String hash=AiPolicy.evidenceDigest(clean);check(hash.matches("[a-f0-9]{64}"));check(hash.equals(AiPolicy.evidenceDigest(AiPolicy.sanitizeEvidence(clean,"copilot"))));
        JSONObject roleWithoutPrivate=AiPolicy.sanitizeEvidence(packet().put("portfolioIncluded",false),"agent_derivatives");
        check(!roleWithoutPrivate.has("portfolio")&&!roleWithoutPrivate.has("risk"));
        check(roleWithoutPrivate.getString("analysisScope").contains("No verified private position"));
        JSONObject research=AiPolicy.sanitizeEvidence(packet(),"research");check(!research.getBoolean("portfolioIncluded"));
        for(String key:new String[]{"portfolio","bookRevision","funding","valuation","risk","scenarios","coach"})check(!research.has(key));
        check(research.has("market")&&research.has("news"));check(research.getJSONObject("fundamentals").getJSONArray("metrics").getJSONObject(0).getString("period").equals("synthetic period"));
        check(!AiPolicy.sanitizeEvidence(packet().put("portfolioIncluded",false),"copilot").has("portfolio"));
        try{AiPolicy.sanitizeEvidence(packet().put("bookRevision",""),"copilot");throw new AssertionError("Unbound portfolio accepted");}catch(Exception expected){checks++;}
        JSONObject a=new JSONObject("{\"b\":1,\"a\":{\"d\":2,\"c\":3}}"),b=new JSONObject("{\"a\":{\"c\":3,\"d\":2},\"b\":1}");check(AiPolicy.evidenceDigest(a).equals(AiPolicy.evidenceDigest(b)));b.getJSONObject("a").put("c",4);check(!AiPolicy.evidenceDigest(a).equals(AiPolicy.evidenceDigest(b)));
        System.out.println("PASS "+checks+" native evidence privacy/revision checks (synthetic fixtures)");
    }
}
