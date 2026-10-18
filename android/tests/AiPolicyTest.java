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
        for(String value:new String[]{"","short","Bearer SYNTHETIC_KEY_1234567890","SYNTHETIC_KEY_1234567890\n","SYNTHETIC_KEY_1234567890?","x"+new String(new char[256]).replace('\0','x')})check(!AiPolicy.validKey(value));
        for(String mode:new String[]{"copilot","deliberate","research"}){
            String prompt=AiPolicy.prompt(mode,"Explain the evidence","{\"quoteAsOf\":null,\"quoteFreshness\":\"stale\",\"pnl\":20000}");
            check(prompt.contains("\"quoteAsOf\":null")&&prompt.contains("stale")&&prompt.contains("20000"));
        }
        check(AiPolicy.prompt("deliberate","","{}").contains("six headings"));
        check(AiPolicy.prompt("research","HAL research","{}").contains("cannot search the web"));
        rejects(()->AiPolicy.prompt("execute","buy","{}"));rejects(()->AiPolicy.prompt("copilot"," ","{}"));
        rejects(()->AiPolicy.prompt("copilot",new String(new char[2001]),"{}"));rejects(()->AiPolicy.prompt("research","news",new String(new char[8001])));
        check(AiPolicy.INSTRUCTIONS.contains("no broker, execution or web-search tools"));
        check(AiPolicy.INSTRUCTIONS.contains("untrusted data"));check(AiPolicy.INSTRUCTIONS.contains("not a guaranteed maximum"));
        check(AiPolicy.httpError(403).contains("API key"));check(AiPolicy.httpError(429).contains("quota"));
        check(AiPolicy.httpError(404).contains("model"));check(AiPolicy.httpError(302).contains("does not follow"));check(AiPolicy.httpError(503).contains("temporarily"));
        System.out.println("PASS "+checks+" direct Gemini request policy checks");
    }
}
