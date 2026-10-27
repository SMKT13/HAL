package in.smkt.haldesk;

import com.upstox.marketdatafeederv3udapi.rpc.proto.MarketDataFeedV3;
import com.google.protobuf.InvalidProtocolBufferException;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Strict, instrument-whitelisted decoder for the pinned official V3 LTPC schema.
 * Returns exchange trade clocks and feed clocks separately. It does not mark portfolio positions.
 */
final class StreamDecoder {
    private StreamDecoder(){}
    private static final int MAX_FRAME_BYTES=2097152;
    private static boolean price(double value){return Double.isFinite(value)&&value>0&&value<100000000;}
    /** Do not let an out-of-order or timestamp-less tick replace a verified trade. */
    static boolean shouldReplace(long previousTradeMs,long incomingTradeMs){
        return previousTradeMs<=0 || (incomingTradeMs>0 && incomingTradeMs>=previousTradeMs);
    }
    static JSONObject decode(byte[] bytes,Set<String> allowed,long now) throws Exception {
        if(bytes==null||bytes.length<1||bytes.length>MAX_FRAME_BYTES)
            throw new InvalidProtocolBufferException("Invalid frame length");
        MarketDataFeedV3.FeedResponse response=MarketDataFeedV3.FeedResponse.parseFrom(bytes);
        JSONObject out=new JSONObject();
        MarketDataFeedV3.Type kind=response.getType();
        if(kind==MarketDataFeedV3.Type.market_info) {
            out.put("type","market_info");out.put("rows",new JSONArray());return out;
        }
        if(kind!=MarketDataFeedV3.Type.live_feed&&kind!=MarketDataFeedV3.Type.initial_feed)
            throw new InvalidProtocolBufferException("Unsupported frame type");
        out.put("type",kind==MarketDataFeedV3.Type.initial_feed?"snapshot":"tick");
        long feedTs=response.getCurrentTs();
        out.put("feed_ts",feedTs>0&&feedTs<=now+86400000L?feedTs:JSONObject.NULL);
        JSONArray rows=new JSONArray();
        for(Map.Entry<String,MarketDataFeedV3.Feed> entry:response.getFeedsMap().entrySet()){
            String key=entry.getKey();
            if(allowed==null||!allowed.contains(key)||!entry.getValue().hasLtpc())continue;
            MarketDataFeedV3.LTPC q=entry.getValue().getLtpc();
            if(!price(q.getLtp()))continue;
            long ltt=q.getLtt();
            JSONObject row=new JSONObject();
            row.put("key",key);
            row.put("price",q.getLtp());
            row.put("prev_close",price(q.getCp())?q.getCp():JSONObject.NULL);
            row.put("last_trade_ts",ltt>0&&ltt<=now+86400000L?ltt:JSONObject.NULL);
            rows.put(row);
            if(rows.length()>=5)break;
        }
        out.put("rows",rows);
        return out;
    }
}
