package in.smkt.haldesk;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Fail-closed monetary claim guard. Does not prove every financial assertion:
 * it only blocks rupee amounts absent from approved deterministic numeric fields.
 * Unsupported derived calculations belong in the app's financial engine.
 */
final class AiNumericClaimGuard {
    private static final Pattern MONEY=Pattern.compile(
        "(?:₹\\s*|\\bINR\\s*|\\bRs\\.?\\s*)([+-]?[0-9][0-9,]*(?:\\.[0-9]{1,4})?)",
        Pattern.CASE_INSENSITIVE);
    private AiNumericClaimGuard(){}

    private static void number(Set<String> values, Object v) {
        if(!(v instanceof Number))return;
        try {
            double n=((Number)v).doubleValue();
            if(Double.isFinite(n))
                values.add(BigDecimal.valueOf(n).abs().stripTrailingZeros().toPlainString());
        }catch(Exception ignored){}
    }
    private static void props(Set<String> values,JSONObject object,String fields) {
        if(object==null)return;
        for(String name:fields.split(" "))number(values,object.opt(name));
    }
    private static void rows(Set<String> values,JSONArray rows) {
        if(rows==null)return;
        for(int i=0;i<Math.min(rows.length(),40);i++) {
            JSONObject row=rows.optJSONObject(i);
            if(row==null)continue;
            props(values,row,"pnl modelPrice price");
            props(values,row.optJSONObject("mark"),"price");
            props(values,row.optJSONObject("leg"),"entry strike");
        }
    }
    static Set<String> approvedMoney(JSONObject evidence) {
        Set<String> out=new HashSet<>();
        if(evidence==null)return out;
        JSONObject market=evidence.optJSONObject("market");
        if(market!=null)for(String key:new String[]{"spot","nifty"})
            props(out,market.optJSONObject(key),"price last_price prevClose");
        if(!evidence.optBoolean("portfolioIncluded",false))return out;
        JSONObject portfolio=evidence.optJSONObject("portfolio");
        JSONArray legs=portfolio==null?null:portfolio.optJSONArray("legs");
        if(legs!=null)for(int i=0;i<Math.min(legs.length(),40);i++)
            props(out,legs.optJSONObject(i),"entry strike manual");
        JSONObject valuation=evidence.optJSONObject("valuation");
        props(out,valuation,"open realized charges net openPutPremium settlements fundingMovements");
        if(valuation!=null)rows(out,valuation.optJSONArray("rows"));
        props(out,evidence.optJSONObject("funding"),"margin free");
        JSONArray scenarios=evidence.optJSONArray("scenarios");
        if(scenarios!=null)for(int i=0;i<Math.min(scenarios.length(),20);i++){
            JSONObject scenario=scenarios.optJSONObject(i);
            if(scenario==null)continue;
            props(out,scenario,"total spot");
            rows(out,scenario.optJSONArray("rows"));
        }
        return out;
    }
    private static void scan(String text,Set<String> allowed)throws Exception {
        Matcher m=MONEY.matcher(text==null?"":text);
        while(m.find()){
            final String numeric=m.group(1).replace(",","");
            try{
                String value=new BigDecimal(numeric).abs().stripTrailingZeros().toPlainString();
                if(!allowed.contains(value))throw new Exception("Gemini introduced an unverified rupee amount. Open the app's authoritative calculation instead.");
            }catch(NumberFormatException invalid){
                throw new Exception("Gemini returned an invalid rupee amount.");
            }
        }
    }
    private static void entries(JSONArray a,Set<String> allowed)throws Exception {
        if(a==null)return;
        for(int i=0;i<a.length();i++)if(a.opt(i) instanceof String)scan(a.optString(i),allowed);
    }
    static void validate(JSONObject output,JSONObject evidence)throws Exception {
        if(output==null)throw new Exception("AI result is unavailable.");
        Set<String> approved=approvedMoney(evidence);
        scan(output.optString("conclusion",""),approved);
        scan(output.optString("positionImplications",""),approved);
        for(String field:new String[]{"supportingEvidence","contraryEvidence","riskWarnings","nextReview","limitations"})
            entries(output.optJSONArray(field),approved);
    }
}
