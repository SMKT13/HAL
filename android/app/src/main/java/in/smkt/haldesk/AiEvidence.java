package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Locale;

/** Native schema allowlist. Unknown keys, journal memos and credentials never leave the device. */
final class AiEvidence {
    private static final String LEG="id type expiry strike lots lotSize entry manual manualAt instrumentKey";
    static JSONObject sanitize(JSONObject source,String mode)throws Exception {
        if(source==null||source.toString().length()>65536)throw new Exception("Evidence is missing or too large.");
        JSONObject out=pick(source,"generatedAt quoteAsOf",300).put("schemaVersion",4);
        boolean portfolio=!"research".equals(mode)&&source.optBoolean("portfolioIncluded",false);
        out.put("portfolioIncluded",portfolio);
        JSONObject market=source.optJSONObject("market"),safeMarket=new JSONObject();
        {
            for(String key:new String[]{"spot","nifty","vix"})safeMarket.put(key,(market==null||market.isNull(key))?JSONObject.NULL:pick(market.optJSONObject(key),"instrumentKey symbol price last_price change changePct prevClose quoteAt tradeAt retrievedAt source status cached lastSuccess lastFailure error",300));
            safeMarket.put("status",pick(market==null?null:market.optJSONObject("status"),"state market exchange source asOf",300));
            copy(safeMarket,market,"lastSuccess lastFailure failureReason",300);
        }
        out.put("market",safeMarket);
        JSONObject tech=source.optJSONObject("technical"),safeTech=pick(tech,"bias frame completedCount vol asOf interval bars ready stale reason trend momentum sma20 sma50 sma200 ema12 ema26 rsi rsi14 atr atr14 mfi mfi14 historicalVolatility hv volume volumeTrend",300);
        if(tech!=null){
            for(String key:new String[]{"macd","bollinger","pivots"})if(tech.optJSONObject(key)!=null)safeTech.put(key,pick(tech.optJSONObject(key),"value macd signal histogram upper middle lower pivot r1 r2 r3 s1 s2 s3",80));
            for(String key:new String[]{"support","resistance"}){
                Object v=tech.opt(key);
                if(v instanceof Number)safeTech.put(key,v);
                else if(v instanceof JSONArray){JSONArray a=(JSONArray)v,b=new JSONArray();for(int i=0;i<Math.min(5,a.length());i++)if(a.opt(i) instanceof Number)b.put(a.opt(i));safeTech.put(key,b);}
            }
        }
        out.put("technical",safeTech);
        JSONArray news=objects(source.optJSONArray("news"),12,"id title source publishedAt retrievedAt official topic summary url",500);
        out.put("news",news);
        out.put("sources",objects(source.optJSONArray("sources"),20,"label publishedAt retrievedAt url",300));
        JSONObject fundamentals=source.optJSONObject("fundamentals");
        if(fundamentals!=null){JSONObject f=new JSONObject();f.put("profile",pick(fundamentals.optJSONObject("profile"),"name symbol sector industry description source url retrievedAt",500));f.put("metrics",objects(fundamentals.optJSONArray("metrics"),30,"label value unit period source url retrievedAt kind",200));out.put("fundamentals",f);}
        if(portfolio){
            String revision=source.optString("bookRevision");if(!revision.matches("rev-[a-f0-9]{8,64}"))throw new Exception("Position evidence needs a valid book revision.");
            out.put("bookRevision",revision);
            JSONObject p=source.optJSONObject("portfolio"),safeP=pick(p,"confirmedAt",100);
            safeP.put("legs",objects(p==null?null:p.optJSONArray("legs"),30,LEG,300));out.put("portfolio",safeP);
            JSONObject val=source.optJSONObject("valuation"),safeV=pick(val,"open realized charges net complete openPutPremium settlements fundingMovements",100);
            safeV.put("rows",rows(val==null?null:val.optJSONArray("rows"),false));out.put("valuation",safeV);
            JSONObject risk=source.optJSONObject("risk"),safeR=pick(risk,"futureUnits putUnits coveredUnits uncoveredUnits coverage delta theta greeksComplete nextExpiry",100);
            JSONArray warnings=new JSONArray(),raw=risk==null?null:risk.optJSONArray("warnings");
            if(raw!=null)for(int i=0;i<Math.min(12,raw.length());i++){Object w=raw.opt(i);if(w instanceof String)warnings.put(clean((String)w,300));else if(w instanceof JSONObject)warnings.put(pick((JSONObject)w,"code title detail",300));}
            safeR.put("warnings",warnings);safeR.put("distribution",objects(risk==null?null:risk.optJSONArray("distribution"),30,"expiry strike units lots type",100));out.put("risk",safeR);
            out.put("funding",pick(source.optJSONObject("funding"),"margin free at source",100));
            JSONArray scenarios=new JSONArray(),rawScenarios=source.optJSONArray("scenarios");
            if(rawScenarios!=null)for(int i=0;i<Math.min(12,rawScenarios.length());i++){
                JSONObject s=rawScenarios.optJSONObject(i);if(s==null)continue;JSONObject safe=pick(s,"total horizon complete spot shock ivShift rate dividend",150);
                safe.put("errors",strings(s.optJSONArray("errors"),5,160));safe.put("assumptions",strings(s.optJSONArray("assumptions"),6,200));safe.put("rows",rows(s.optJSONArray("rows"),true));scenarios.put(safe);
            }
            out.put("scenarios",scenarios);out.put("coach",objects(source.optJSONArray("coach"),24,"code severity title detail",300));
        }
        if(out.toString().length()>24000)throw new Exception("Sanitized evidence exceeds the safe request limit.");
        return out;
    }
    private static JSONArray rows(JSONArray raw,boolean scenario)throws Exception {
        JSONArray out=new JSONArray();if(raw==null)return out;
        for(int i=0;i<Math.min(30,raw.length());i++){JSONObject row=raw.optJSONObject(i);if(row==null)continue;JSONObject safe=pick(row,scenario?"modelPrice pnl iv":"units pnl",100);safe.put("leg",pick(row.optJSONObject("leg"),LEG,300));if(!scenario)safe.put("mark",pick(row.optJSONObject("mark"),"price source quoteAt tradeAt retrievedAt status",200));out.put(safe);}return out;
    }
    private static JSONArray objects(JSONArray raw,int count,String keys,int limit)throws Exception {JSONArray safe=new JSONArray();if(raw!=null)for(int i=0;i<Math.min(count,raw.length());i++)if(raw.optJSONObject(i)!=null)safe.put(pick(raw.optJSONObject(i),keys,limit));return safe;}
    private static JSONArray strings(JSONArray raw,int count,int limit){JSONArray safe=new JSONArray();if(raw!=null)for(int i=0;i<Math.min(count,raw.length());i++)if(raw.opt(i) instanceof String)safe.put(clean(raw.optString(i),limit));return safe;}
    private static JSONObject pick(JSONObject source,String keys,int limit)throws Exception {JSONObject out=new JSONObject();copy(out,source,keys,limit);return out;}
    private static void copy(JSONObject out,JSONObject source,String keys,int limit)throws Exception {
        if(source==null)return;
        for(String key:keys.split(" "))if(source.has(key)){
            Object v=source.opt(key);
            if("url".equals(key)){out.put(key,safeUrl(source.optString(key)));continue;}
            if(v==null||v==JSONObject.NULL)out.put(key,JSONObject.NULL);
            else if(v instanceof Boolean)out.put(key,v);
            else if(v instanceof Number)out.put(key,Double.isFinite(((Number)v).doubleValue())?v:JSONObject.NULL);
            else if(v instanceof String)out.put(key,clean((String)v,limit));
        }
    }
    private static String clean(String s,int limit){String result=s.replaceAll("[\\p{Cntrl}]"," ").trim();return result.length()>limit?result.substring(0,limit):result;}
    private static Object safeUrl(String raw){try{URI u=new URI(raw);return "https".equals(u.getScheme())&&u.getHost()!=null&&u.getUserInfo()==null&&raw.length()<=2000?raw:JSONObject.NULL;}catch(Exception ignored){return JSONObject.NULL;}}
    static String digest(JSONObject evidence)throws Exception {byte[] bytes=MessageDigest.getInstance("SHA-256").digest(canonical(evidence).getBytes(StandardCharsets.UTF_8));StringBuilder s=new StringBuilder();for(byte b:bytes)s.append(String.format(Locale.ROOT,"%02x",b&255));return s.toString();}
    private static String canonical(Object value)throws Exception {
        if(value instanceof JSONObject){JSONObject o=(JSONObject)value;ArrayList<String> keys=new ArrayList<>();Iterator<String> it=o.keys();while(it.hasNext())keys.add(it.next());Collections.sort(keys);StringBuilder s=new StringBuilder("{");for(String key:keys){if(s.length()>1)s.append(',');s.append(JSONObject.quote(key)).append(':').append(canonical(o.opt(key)));}return s.append('}').toString();}
        if(value instanceof JSONArray){JSONArray a=(JSONArray)value;StringBuilder s=new StringBuilder("[");for(int i=0;i<a.length();i++){if(i>0)s.append(',');s.append(canonical(a.opt(i)));}return s.append(']').toString();}
        if(value instanceof String)return JSONObject.quote((String)value);return value==null||value==JSONObject.NULL?"null":String.valueOf(value);
    }
}
