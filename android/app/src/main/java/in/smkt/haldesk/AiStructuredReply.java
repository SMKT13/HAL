package in.smkt.haldesk;

import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** A structured interpretation is never an authoritative source of financial numbers. */
final class AiStructuredReply {
    private AiStructuredReply() { }

    static boolean enabled(String mode) {
        return "copilot".equals(mode) || "research".equals(mode);
    }
    private static JSONObject stringField() throws Exception {
        return new JSONObject().put("type","STRING");
    }
    private static JSONObject stringList() throws Exception {
        return new JSONObject().put("type","ARRAY").put("items",stringField());
    }
    static JSONObject schema() throws Exception {
        JSONObject properties=new JSONObject();
        properties.put("conclusion",stringField());
        properties.put("marketBias",stringField().put("enum",
            new JSONArray().put("BULLISH").put("BEARISH").put("NEUTRAL").put("MIXED").put("UNAVAILABLE")));
        properties.put("supportingEvidence",stringList());
        properties.put("contraryEvidence",stringList());
        properties.put("positionImplications",stringField());
        properties.put("riskWarnings",stringList());
        properties.put("nextReview",stringList());
        properties.put("limitations",stringList());
        properties.put("sourceIds",stringList());
        return new JSONObject().put("type","OBJECT").put("properties",properties)
            .put("required",new JSONArray().put("conclusion").put("marketBias")
                .put("supportingEvidence").put("contraryEvidence")
                .put("positionImplications").put("riskWarnings")
                .put("nextReview").put("limitations").put("sourceIds"));
    }
    private static String bounded(JSONObject obj,String name,int limit,boolean required)throws Exception {
        Object value=obj.opt(name);
        if(!(value instanceof String)) {
            if(required)throw new Exception("AI response is missing "+name+".");
            return "";
        }
        String s=((String)value).replaceAll("[\\p{Cntrl}]"," ").trim();
        if(s.length()>limit)throw new Exception("AI response field exceeds "+name+" limit.");
        if(required&&s.isEmpty())throw new Exception("AI response is missing "+name+".");
        return s;
    }
    private static JSONArray list(JSONObject obj,String name,int maxCount,int limit)throws Exception {
        JSONArray raw=obj.optJSONArray(name);
        if(raw==null)throw new Exception("AI response is missing "+name+".");
        if(raw.length()>maxCount)throw new Exception("AI response has too many "+name+" items.");
        JSONArray out=new JSONArray();
        for(int i=0;i<raw.length();i++){
            Object value=raw.opt(i);
            if(!(value instanceof String))throw new Exception("AI response has an invalid "+name+" item.");
            String clean=((String)value).replaceAll("[\\p{Cntrl}]"," ").trim();
            if(clean.length()>limit)throw new Exception("AI response "+name+" item is too long.");
            if(!clean.isEmpty())out.put(clean);
        }
        return out;
    }
    static JSONObject validate(String text,JSONObject evidence)throws Exception {
        if(text==null||text.length()>24000)throw new Exception("AI response exceeds accepted size.");
        JSONObject raw;
        try{raw=new JSONObject(text);}catch(Exception e){throw new Exception("Gemini returned invalid structured JSON.");}
        JSONObject safe=new JSONObject();
        safe.put("conclusion",bounded(raw,"conclusion",1800,true));
        String bias=bounded(raw,"marketBias",20,true);
        if(!new HashSet<String>(java.util.Arrays.asList("BULLISH","BEARISH","NEUTRAL","MIXED","UNAVAILABLE")).contains(bias))
            throw new Exception("Gemini returned an invalid market bias.");
        safe.put("marketBias",bias);
        for(String name:new String[]{"supportingEvidence","contraryEvidence","riskWarnings","nextReview","limitations"})
            safe.put(name,list(raw,name,8,600));
        if(!(raw.opt("positionImplications") instanceof String))
            throw new Exception("AI response is missing positionImplications.");
        safe.put("positionImplications",bounded(raw,"positionImplications",1200,false));
        JSONArray ids=list(raw,"sourceIds",12,2000);
        Set<String> allowed=new HashSet<>();
        JSONArray sources=evidence==null?null:evidence.optJSONArray("sources");
        if(sources!=null)for(int i=0;i<sources.length();i++){
            JSONObject item=sources.optJSONObject(i);
            if(item!=null&&item.opt("url") instanceof String)allowed.add(item.optString("url"));
        }
        JSONArray verified=new JSONArray();
        for(int i=0;i<ids.length();i++){
            String id=ids.getString(i);
            if(!allowed.contains(id))throw new Exception("Gemini cited a source not included in the approved evidence.");
            verified.put(id);
        }
        safe.put("sourceIds",verified);
        AiNumericClaimGuard.validate(safe,evidence);
        return safe;
    }
    static String display(JSONObject valid)throws Exception {
        StringBuilder out=new StringBuilder();
        out.append("CONCLUSION · ").append(valid.getString("marketBias")).append("\n")
            .append(valid.getString("conclusion"));
        for(String key:new String[]{"supportingEvidence","contraryEvidence","riskWarnings","nextReview","limitations"}){
            JSONArray arr=valid.getJSONArray(key);
            if(arr.length()==0)continue;
            String name=key.replaceAll("([a-z])([A-Z])","$1 $2").toUpperCase(java.util.Locale.ROOT);
            out.append("\n\n").append(name);
            for(int i=0;i<arr.length();i++)out.append("\n• ").append(arr.getString(i));
        }
        String position=valid.optString("positionImplications","");
        if(!position.isEmpty())out.append("\n\nPOSITION IMPLICATIONS\n").append(position);
        return out.toString();
    }
}
