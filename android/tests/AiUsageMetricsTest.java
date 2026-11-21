package in.smkt.haldesk;
import org.json.JSONObject;

public final class AiUsageMetricsTest {
    private static int checked;
    private static void check(boolean ok){checked++;if(!ok)throw new AssertionError("Usage check "+checked);}
    public static void main(String[] args)throws Exception {
        JSONObject source=new JSONObject().put("promptTokenCount",123)
            .put("candidatesTokenCount",67).put("totalTokenCount",190)
            .put("secret","do-not-forward").put("bad",999);
        JSONObject once=AiUsageMetrics.fromProvider(source);
        check(once.getLong("promptTokenCount")==123);
        check(!once.has("secret"));
        JSONObject next=AiUsageMetrics.fromProvider(new JSONObject()
            .put("promptTokenCount",10).put("totalTokenCount",20));
        JSONObject merged=AiUsageMetrics.combine(once,next);
        check(merged.getLong("promptTokenCount")==133);
        check(merged.getLong("totalTokenCount")==210);
        check(merged.getLong("candidatesTokenCount")==67);
        JSONObject invalid=AiUsageMetrics.fromProvider(new JSONObject()
            .put("promptTokenCount",-2).put("totalTokenCount",11000000)
            .put("candidatesTokenCount","bogus"));
        check(invalid.length()==0);
        System.out.println("PASS "+checked+" provider token metadata checks");
    }
}
