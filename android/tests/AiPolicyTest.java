package in.smkt.haldesk;

public final class AiPolicyTest {
    interface Checked {void run()throws Exception;}
    static int checks;
    static void check(boolean ok){checks++;if(!ok)throw new AssertionError("Check "+checks);}
    static void rejects(Checked action)throws Exception {try{action.run();}catch(Exception expected){checks++;return;}throw new AssertionError("Accepted invalid input");}
    public static void main(String[] args)throws Exception {
        check(AiPolicy.endpoint(AiPolicy.DEFAULT_MODEL).equals("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent"));
        for(String value:new String[]{"https://evil.example/","gemini-test?key=leak","gemini-test/../../other","gemini-test#fragment","gemini-x\r\nHeader:x","models/gemini-test","gemini-","gemini-"+new String(new char[80]).replace('\0','x')})rejects(()->AiPolicy.endpoint(value));
        check(AiPolicy.model("gemini-3.5-flash-lite").equals("gemini-3.5-flash-lite"));
        check(AiPolicy.validKey("SYNTHETIC_KEY_1234567890-TEST"));
        for(String value:new String[]{"","short","Bearer SYNTHETIC_KEY_1234567890","SYNTHETIC_KEY_1234567890\n","SYNTHETIC_KEY_1234567890\u0000","SYNTHETIC_KEY_1234567890\u00e9",new String(new char[8193]).replace('\0','x')})check(!AiPolicy.validKey(value));
        String standard="AIzaSYNTHETIC_KEY_1234567890",auth="AQ.SYNTHETIC_"+new String(new char[600]).replace('\0','x')+".suffix";
        check(AiPolicy.validKey(standard));check(AiPolicy.validKey(auth));
        for(String key:new String[]{standard,auth}){
            check(AiPolicy.pastedKey(key).equals(key));
            check(AiPolicy.pastedKey(" \t\r\n"+key+" \n").equals(key));
            check(AiPolicy.pastedKey("\u00a0\u200b\ufeff"+key+"\u202f\u2060").equals(key));
            check(AiPolicy.pastedKey(key.substring(0,12)+"\r\n \t"+key.substring(12)).equals(key));
            for(String quote:new String[]{"\"","'","`"})check(AiPolicy.pastedKey(quote+key+quote).equals(key));
        }
        check(AiPolicy.pastedKey(" \r\n\u00a0\u200b").equals(""));check(AiPolicy.pastedKey(null).equals(""));
        String max=new String(new char[8192]).replace('\0','x');check(AiPolicy.pastedKey(max).equals(max));
        rejects(()->AiPolicy.pastedKey(max+"x"));rejects(()->AiPolicy.pastedKey(new String(new char[32769]).replace('\0','x')));
        rejects(()->AiPolicy.pastedKey("incomplete"));rejects(()->AiPolicy.pastedKey(standard+"\u0000"));rejects(()->AiPolicy.pastedKey(standard+"\u00e9"));
        for(String mode:new String[]{"copilot","deliberate","research","skills","agent_technical","agent_business","agent_derivatives","agent_bull","agent_bear","agent_risk"}){
            String prompt=AiPolicy.prompt(mode,"Explain the evidence","{\"quoteAsOf\":null,\"quoteFreshness\":\"stale\",\"pnl\":20000}");
            check(prompt.contains("\"quoteAsOf\":null")&&prompt.contains("stale")&&prompt.contains("20000"));
        }
        check(AiPolicy.prompt("deliberate","","{}").contains("six headings"));
        check(AiPolicy.prompt("skills","","{}").contains("MIT-licensed"));
        check(AiPolicy.prompt("skills","","{}").contains("CHECKED"));
        rejects(()->AiPolicy.prompt("unknown-skill","buy","{}"));
        check(AiPolicy.isAgentMode("agent_risk"));check(!AiPolicy.isAgentMode("copilot"));
        check(AiPolicy.preferLowThinking("gemini-3.8-flash"));
        check(!AiPolicy.preferLowThinking("gemini-4-argon"));
        check(!AiPolicy.preferLowThinking("gemini-2.5-flash"));
        check(AiPolicy.outputLimit("agent_risk")==8192);
        check(AiPolicy.prompt("agent_risk","Review","{}").contains("At most 200 words"));
        check(AiPolicy.prompt("agent_business","Review","{}").contains("At most 120 words"));
        check(AiPolicy.prompt("agent_bear","Evaluate risk","{}").contains("BEAR researcher"));
        check(AiPolicy.prompt("research","HAL research","{}").contains("cannot search the web"));
        rejects(()->AiPolicy.prompt("execute","buy","{}"));rejects(()->AiPolicy.prompt("copilot"," ","{}"));
        rejects(()->AiPolicy.prompt("copilot",new String(new char[2001]),"{}"));rejects(()->AiPolicy.prompt("research","news",new String(new char[24001])));
        check(AiPolicy.INSTRUCTIONS.contains("no broker, execution or web-search tools"));
        check(AiPolicy.INSTRUCTIONS.contains("untrusted data"));check(AiPolicy.INSTRUCTIONS.contains("not a guaranteed maximum"));
        check(AiPolicy.httpError(403).contains("API key"));check(AiPolicy.httpError(429).contains("quota"));
        check(AiPolicy.httpError(404).contains("model"));check(AiPolicy.httpError(302).contains("does not follow"));check(AiPolicy.httpError(503).contains("temporarily"));
        System.out.println("PASS "+checks+" direct Gemini request policy checks");
    }
}

