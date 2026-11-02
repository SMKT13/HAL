package in.smkt.haldesk;

import java.net.*;
import java.io.*;
import java.security.cert.Certificate;
import javax.net.ssl.HttpsURLConnection;
import org.json.*;

/** Runs the real REST client with an in-memory HTTPS connection. No real keys/network. */
public final class AiClientTest {
    static final String KEY="AQ.SYNTHETIC_"+new String(new char[600]).replace('\0','x')+".suffix";
    static Mock next;static int checks;
    static void check(boolean ok){checks++;if(!ok)throw new AssertionError("REST check "+checks);}
    static class Mock extends HttpsURLConnection {
        int code=200;String response;ByteArrayOutputStream sent=new ByteArrayOutputStream();boolean disconnected,errorBodyRead;Runnable onStatus;
        Mock(String response)throws Exception {super(new URL("https://generativelanguage.googleapis.com/"));this.response=response;}
        public void connect(){}public boolean usingProxy(){return false;}public void disconnect(){disconnected=true;}
        public String getCipherSuite(){return "test";}public Certificate[] getLocalCertificates(){return null;}public Certificate[] getServerCertificates(){return null;}
        public OutputStream getOutputStream(){return sent;}
        public InputStream getInputStream(){return new ByteArrayInputStream(response.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        public InputStream getErrorStream(){errorBodyRead=true;return getInputStream();}
        public int getResponseCode(){if(onStatus!=null)onStatus.run();return code;}
    }
    static JSONObject evidence()throws Exception{return new JSONObject("{\"schemaVersion\":4,\"quoteAsOf\":null,\"portfolioIncluded\":true,\"bookRevision\":\"rev-1234abcd\",\"portfolio\":{\"legs\":[]},\"market\":{\"spot\":null},\"sources\":[],\"valuation\":{\"open\":20000}}");}
    static String answer(String finish,JSONArray parts)throws Exception{return new JSONObject().put("candidates",new JSONArray().put(new JSONObject().put("finishReason",finish).put("content",new JSONObject().put("parts",parts)))).toString();}
    static JSONArray text(String value)throws Exception{return new JSONArray().put(new JSONObject().put("text",value));}
    static JSONObject run(AiClient client)throws Exception{return client.generate(KEY,AiPolicy.DEFAULT_MODEL,"copilot","Explain risk",evidence());}
    static void failure(String response,String expected)throws Exception {
        next=new Mock(response);try{run(new AiClient());throw new AssertionError("Accepted unusable output");}
        catch(AiClient.Failure error){check(error.getMessage().contains(expected));check(!error.getMessage().contains(KEY));check(next.disconnected);}
    }
    public static void main(String[] args)throws Exception {
        URL.setURLStreamHandlerFactory(protocol->"https".equals(protocol)?new URLStreamHandler(){protected URLConnection openConnection(URL url){check(url.toString().equals("https://generativelanguage.googleapis.com/v1beta/models/"+AiPolicy.DEFAULT_MODEL+":generateContent"));check(url.getQuery()==null);return next;}}:null);
        JSONArray parts=new JSONArray().put(new JSONObject().put("thought",true).put("text","PRIVATE THOUGHT"));parts.put(new JSONObject().put("text","App P&L 20000; "+KEY));
        next=new Mock(answer("STOP",parts));JSONObject result=run(new AiClient());
        check(result.getBoolean("direct"));check(result.getString("reply").equals("App P&L 20000; [redacted]"));check(!result.getBoolean("grounded"));check(result.isNull("dataAsOf"));
        check(KEY.equals(next.getRequestProperty("x-goog-api-key")));check(!next.getInstanceFollowRedirects());check("POST".equals(next.getRequestMethod()));check(next.getConnectTimeout()==20000&&next.getReadTimeout()==120000);check(!next.getUseCaches());check(next.disconnected);
        String payload=next.sent.toString("UTF-8");check(!payload.contains(KEY));JSONObject body=new JSONObject(payload);check(body.has("systemInstruction"));
        JSONObject config=body.getJSONObject("generationConfig");
        check(config.getInt("maxOutputTokens")==8192);
        check(config.getJSONObject("thinkingConfig").getString("thinkingLevel").equals("low"));
        next=new Mock(answer("STOP",text("Technical view, evidence limited.")));
        JSONObject agentReply=new AiClient().generate(KEY,AiPolicy.DEFAULT_MODEL,"agent_technical","Review",evidence());
        check(agentReply.getString("reply").startsWith("Technical view"));
        JSONObject agentConfig=new JSONObject(next.sent.toString("UTF-8")).getJSONObject("generationConfig");
        check(agentConfig.getInt("maxOutputTokens")==8192);
        check(agentConfig.getJSONObject("thinkingConfig").getString("thinkingLevel").equals("low"));check(!body.has("tools"));check(payload.contains("20000")&&body.getJSONArray("contents").getJSONObject(0).getJSONArray("parts").getJSONObject(0).getString("text").contains("\"spot\":null"));
        for(int code:new int[]{403,429,302,404,503}){
            next=new Mock("untrusted provider error "+KEY);next.code=code;
            try{run(new AiClient());throw new AssertionError("Accepted HTTP error");}catch(AiClient.Failure error){check(error.getMessage().equals(AiPolicy.httpError(code)));check(!error.getMessage().contains(KEY));check(!next.errorBodyRead);check(next.disconnected);}
        }
        failure(answer("MAX_TOKENS",text("partial reply")),"output tokens");failure(answer("SAFETY",text("unsafe")),"usable answer");
        failure("{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}","declined");failure("{\"candidates\":[]}","no answer");failure("not JSON","Could not read");
        failure(answer("STOP",text(" ")),"no usable text");failure(answer("STOP",new JSONArray().put(new JSONObject().put("thought",true).put("text","hidden"))),"no usable text");
        failure(answer("STOP",text(new String(new char[24001]).replace('\0','x'))),"answer limit");failure(new String(new char[512001]).replace('\0','x'),"too much data");
        AiClient cancelled=new AiClient();next=new Mock(answer("STOP",text("late")));next.onStatus=cancelled::cancel;
        try{run(cancelled);throw new AssertionError("Accepted cancelled answer");}catch(AiClient.Failure error){check(error.getMessage().contains("cancelled"));check(next.disconnected);}
        AiClient preCancelled=new AiClient();preCancelled.cancel();next=new Mock("");
        try{run(preCancelled);throw new AssertionError("Started cancelled request");}catch(AiClient.Failure error){check(next.sent.size()==0);check(error.getMessage().contains("cancelled"));}
        System.out.println("PASS "+checks+" native Gemini transport/response checks (mock HTTPS; no provider call)");
    }
}

