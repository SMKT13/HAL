package in.smkt.haldesk;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONArray;
import org.json.JSONObject;

/** Explicit, read-only model metadata probe. Never generates content or shares portfolio data. */
final class AiModelProbe {
    private AiModelProbe() { }
    static String endpoint(String model)throws Exception {
        return "https://generativelanguage.googleapis.com/v1beta/models/"+AiPolicy.model(model);
    }
    static JSONObject parse(JSONObject raw,String model)throws Exception {
        if(raw==null)throw new Exception("Model metadata is unavailable.");
        String name=raw.optString("name","");
        if(!name.equals("models/"+AiPolicy.model(model)))throw new Exception("Model metadata did not match the requested model.");
        JSONArray methods=raw.optJSONArray("supportedGenerationMethods");
        boolean available=false;
        if(methods!=null)for(int i=0;i<methods.length();i++)
            if("generateContent".equals(methods.optString(i)))available=true;
        return new JSONObject().put("model",model).put("available",available)
            .put("displayName",raw.optString("displayName",model))
            .put("inputTokenLimit",raw.optInt("inputTokenLimit",0))
            .put("outputTokenLimit",raw.optInt("outputTokenLimit",0))
            .put("details",available?"generateContent is supported. JSON schema compatibility is checked during a real authorized request.":
                "This model does not advertise generateContent for the current key.");
    }
    static JSONObject verify(String key,String model)throws Exception {
        if(!AiPolicy.validKey(key))throw new Exception("A saved Gemini API key is required.");
        HttpsURLConnection connection=(HttpsURLConnection)new URL(endpoint(model)).openConnection();
        try{
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(16000);
            connection.setRequestMethod("GET");
            connection.setRequestProperty("x-goog-api-key",key);
            connection.setRequestProperty("Accept","application/json");
            int status=connection.getResponseCode();
            if(status!=200)throw new Exception(AiPolicy.httpError(status));
            ByteArrayOutputStream buffer=new ByteArrayOutputStream();
            try(InputStream in=connection.getInputStream()){
                byte[] chunk=new byte[4096];int n;
                while((n=in.read(chunk))!=-1){
                    if(buffer.size()+n>65536)throw new Exception("Model metadata is too large.");
                    buffer.write(chunk,0,n);
                }
            }
            return parse(new JSONObject(new String(buffer.toByteArray(),StandardCharsets.UTF_8)),model);
        }finally{connection.disconnect();}
    }
}
