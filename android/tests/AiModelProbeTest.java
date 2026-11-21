package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;

public final class AiModelProbeTest {
    private static int checks;
    static void check(boolean ok){checks++;if(!ok)throw new AssertionError("Model probe test "+checks);}
    public static void main(String[]args)throws Exception {
        check(AiModelProbe.endpoint("gemini-3.8-flash").equals("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash"));
        JSONObject response=new JSONObject().put("name","models/gemini-3.8-flash")
            .put("supportedGenerationMethods",new JSONArray().put("generateContent").put("countTokens"))
            .put("inputTokenLimit",1000);
        JSONObject parsed=AiModelProbe.parse(response,"gemini-3.8-flash");
        check(parsed.getBoolean("available"));
        check(parsed.getInt("inputTokenLimit")==1000);
        response.put("supportedGenerationMethods",new JSONArray().put("countTokens"));
        check(!AiModelProbe.parse(response,"gemini-3.8-flash").getBoolean("available"));
        try{AiModelProbe.parse(response,"gemini-4-argon");throw new AssertionError("Incorrect model accepted");}
        catch(Exception expected){checks++;}
        try{AiModelProbe.endpoint("https://example.invalid/");throw new AssertionError("Invalid model accepted");}
        catch(Exception expected){checks++;}
        System.out.println("PASS "+checks+" model metadata and endpoint checks");
    }
}
