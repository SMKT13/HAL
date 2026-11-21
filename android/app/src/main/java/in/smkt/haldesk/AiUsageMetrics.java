package in.smkt.haldesk;

import org.json.JSONObject;

/** Provider-reported token counts; not a billing estimate or quota guarantee. */
final class AiUsageMetrics {
    static final String[] KEYS={"promptTokenCount","candidatesTokenCount",
        "thoughtsTokenCount","totalTokenCount","cachedContentTokenCount"};
    private AiUsageMetrics(){}

    static JSONObject fromProvider(JSONObject source)throws Exception {
        JSONObject out=new JSONObject();
        if(source==null)return out;
        for(String key:KEYS){
            Object value=source.opt(key);
            if(!(value instanceof Number))continue;
            double numeric=((Number)value).doubleValue();
            if(!Double.isFinite(numeric)||numeric!=Math.rint(numeric))continue;
            long count=((Number)value).longValue();
            if(count>=0&&count<=10000000L)out.put(key,count);
        }
        return out;
    }
    static JSONObject combine(JSONObject aggregate,JSONObject additional)throws Exception {
        JSONObject out=aggregate==null?new JSONObject():new JSONObject(aggregate.toString());
        if(additional==null)return out;
        for(String key:KEYS){
            Object value=additional.opt(key);
            if(!(value instanceof Number))continue;
            double numeric=((Number)value).doubleValue();
            if(!Double.isFinite(numeric)||numeric!=Math.rint(numeric))continue;
            long count=((Number)value).longValue();
            if(count<0||count>10000000L)continue;
            long previous=out.optLong(key,0);
            long total=Math.addExact(previous,count);
            if(total<=60000000L)out.put(key,total);
        }
        return out;
    }
}
