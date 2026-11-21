package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

/** One cancellable request, directly from Android to Google's fixed HTTPS origin. */
final class AiClient {
    static final class Failure extends Exception { Failure(String message){super(message);} }
    private volatile HttpsURLConnection active;
    private volatile boolean cancelled;
    void cancel(){cancelled=true;HttpsURLConnection connection=active;if(connection!=null)connection.disconnect();}
    private void check()throws Failure {if(cancelled||Thread.currentThread().isInterrupted())throw new Failure("AI request cancelled.");}
    JSONObject generate(String key,String model,String mode,String question,JSONObject evidence)throws Exception {
        check();
        if(!AiPolicy.validKey(key))throw new Failure("Enter a valid Gemini API key in AI settings.");
        evidence=AiPolicy.sanitizeEvidence(evidence,mode);
        String prompt=AiPolicy.prompt(mode,question,evidence.toString());
        JSONObject body=new JSONObject();
        body.put("systemInstruction",new JSONObject().put("parts",new JSONArray().put(new JSONObject().put("text",AiPolicy.INSTRUCTIONS))));
        body.put("contents",new JSONArray().put(new JSONObject().put("role","user").put("parts",new JSONArray().put(new JSONObject().put("text",prompt)))));
        JSONObject generation=new JSONObject().put("maxOutputTokens",AiPolicy.outputLimit(mode));
        if(AiPolicy.preferLowThinking(model))generation.put("thinkingConfig",new JSONObject().put("thinkingLevel","low"));
        if(AiStructuredReply.enabled(mode)){
            generation.put("responseMimeType","application/json");
            generation.put("responseSchema",AiStructuredReply.schema());
        }
        body.put("generationConfig",generation);
        byte[] payload=body.toString().getBytes(StandardCharsets.UTF_8);
        if(payload.length>160000)throw new Failure("The AI request is too large. Shorten the question or saved book.");
        HttpsURLConnection connection=(HttpsURLConnection)new URL(AiPolicy.endpoint(model)).openConnection();
        active=connection;
        try {
            check();connection.setInstanceFollowRedirects(false);connection.setRequestMethod("POST");
            connection.setConnectTimeout(20000);connection.setReadTimeout(AiPolicy.isAgentMode(mode)?50000:120000);connection.setUseCaches(false);
            connection.setRequestProperty("x-goog-api-key",key);connection.setRequestProperty("Content-Type","application/json; charset=utf-8");
            connection.setRequestProperty("Accept","application/json");connection.setDoOutput(true);connection.setFixedLengthStreamingMode(payload.length);
            check();try(OutputStream out=connection.getOutputStream()){check();out.write(payload);}
            check();int code=connection.getResponseCode();check();
            if(code!=200)throw new Failure(AiPolicy.httpError(code));
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=connection.getInputStream()){
                byte[] buffer=new byte[8192];int count;
                while((count=in.read(buffer))!=-1){check();if(bytes.size()+count>512000)throw new Failure("Gemini returned too much data. Try a shorter question.");bytes.write(buffer,0,count);}
            }
            check();JSONObject response=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));
            JSONObject feedback=response.optJSONObject("promptFeedback");
            if(feedback!=null&&!feedback.optString("blockReason").isEmpty())throw new Failure("Gemini declined this request. Rephrase the question and try again.");
            JSONArray candidates=response.optJSONArray("candidates");
            JSONObject candidate=candidates==null?null:candidates.optJSONObject(0);
            if(candidate==null)throw new Failure("Gemini returned no answer. Try a different question.");
            String finish=candidate.optString("finishReason");
            if("MAX_TOKENS".equals(finish))throw new Failure("Gemini ran out of output tokens while reasoning or answering. Its incomplete response was discarded. Try a concise Copilot question or a different Gemini model.");
            if(!"STOP".equals(finish))throw new Failure("Gemini could not finish a usable answer. Rephrase the question and retry.");
            JSONObject content=candidate.optJSONObject("content");JSONArray parts=content==null?null:content.optJSONArray("parts");StringBuilder text=new StringBuilder();
            if(parts!=null)for(int i=0;i<parts.length();i++){
                JSONObject part=parts.optJSONObject(i);
                if(part!=null&&!part.optBoolean("thought",false)&&part.opt("text") instanceof String){if(text.length()>0)text.append('\n');text.append(part.getString("text"));}
            }
            String reply=text.toString().trim().replace(key,"[redacted]");
            if(reply.isEmpty()||reply.length()>24000)throw new Failure("Gemini returned no usable text within the answer limit. Try a shorter question.");
            JSONObject structured=null;
            if(AiStructuredReply.enabled(mode)){
                try{
                    structured=AiStructuredReply.validate(reply,evidence);
                    reply=AiStructuredReply.display(structured);
                }catch(Exception invalid){
                    throw new Failure("Gemini returned an unverifiable structured answer. "+invalid.getMessage());
                }
            }
            JSONObject result=new JSONObject().put("success",true).put("direct",true).put("source",model).put("reply",reply).put("grounded",false);
            if(structured!=null)result.put("structured",structured);
            result.put("generatedAt",java.time.Instant.now().toString());result.put("dataAsOf",evidence.opt("quoteAsOf"));
            result.put("evidenceDigest",AiPolicy.evidenceDigest(evidence));result.put("portfolioIncluded",evidence.optBoolean("portfolioIncluded",false));
            result.put("bookRevision",evidence.opt("bookRevision"));result.put("evidenceGeneratedAt",evidence.opt("generatedAt"));
            JSONArray sources=evidence.optJSONArray("sources");result.put("sources",sources==null?new JSONArray():sources);return result;
        }catch(Failure error){throw error;}
        catch(java.net.SocketTimeoutException error){check();throw new Failure("Gemini timed out. Check your connection and retry a shorter question.");}
        catch(Exception error){check();throw new Failure("Could not read a Gemini response. Check your internet connection and try again.");}
        finally{active=null;connection.disconnect();}
    }
}

