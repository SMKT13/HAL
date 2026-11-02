package in.smkt.haldesk;

import com.upstox.marketdatafeederv3udapi.rpc.proto.MarketDataFeedV3;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import java.util.Collections;
import java.util.HashSet;
import java.util.Arrays;
import static org.junit.Assert.*;

/** Synthetic V3 wire fixtures built using the pinned vendor schema. Never market quotes. */
public final class StreamDecoderTest {
    private static final long NOW=1793077800000L; // stable synthetic QA clock
    private static byte[] packet(double last,long trade,String instrument) {
        MarketDataFeedV3.LTPC p=MarketDataFeedV3.LTPC.newBuilder()
            .setLtp(last).setLtt(trade).setCp(4990.5).build();
        MarketDataFeedV3.Feed f=MarketDataFeedV3.Feed.newBuilder().setLtpc(p).build();
        return MarketDataFeedV3.FeedResponse.newBuilder().setType(MarketDataFeedV3.Type.live_feed)
            .setCurrentTs(NOW-2500).putFeeds(instrument,f).build().toByteArray();
    }
    @Test public void decodesPriceAndKeepsSeparateExchangeClocks() throws Exception {
        JSONObject result=StreamDecoder.decode(packet(5023.25,NOW-45000,"NSE_EQ|INE123456789"),
            Collections.singleton("NSE_EQ|INE123456789"),NOW);
        assertEquals("tick",result.getString("type"));
        assertEquals(NOW-2500,result.getLong("feed_ts"));
        JSONArray rows=result.getJSONArray("rows");
        assertEquals(1,rows.length());
        JSONObject quote=rows.getJSONObject(0);
        assertEquals("NSE_EQ|INE123456789",quote.getString("key"));
        assertEquals(5023.25,quote.getDouble("price"),0.00001);
        assertEquals(NOW-45000,quote.getLong("last_trade_ts"));
        assertEquals(4990.5,quote.getDouble("prev_close"),0.00001);
    }
    @Test public void unapprovedKeysCannotBeDisplayed() throws Exception {
        assertEquals(0,StreamDecoder.decode(packet(5030,NOW-5000,"NSE_FO|99"),
            Collections.singleton("NSE_EQ|INE123456789"),NOW).getJSONArray("rows").length());
    }
    @Test public void noZeroOrInfinitePrices() throws Exception {
        assertEquals(0,StreamDecoder.decode(packet(0,NOW-5000,"NSE_FO|99"),
            Collections.singleton("NSE_FO|99"),NOW).getJSONArray("rows").length());
        assertEquals(0,StreamDecoder.decode(packet(Double.NaN,NOW-5000,"NSE_FO|99"),
            Collections.singleton("NSE_FO|99"),NOW).getJSONArray("rows").length());
    }
    @Test public void outOfRangeClockNeverBecomesRecentTrade() throws Exception {
        JSONObject result=StreamDecoder.decode(packet(3.5,NOW+86400001,"NSE_INDEX|India VIX"),
            Collections.singleton("NSE_INDEX|India VIX"),NOW);
        assertTrue(result.getJSONArray("rows").getJSONObject(0).isNull("last_trade_ts"));
    }
    @Test public void missingOrOlderTickCannotReplaceVerifiedTrade() {
        assertFalse(StreamDecoder.shouldReplace(1793000000000L,0));
        assertFalse(StreamDecoder.shouldReplace(1793000000000L,1793000000000L));
        assertFalse(StreamDecoder.shouldReplace(0,0));
        assertFalse(StreamDecoder.shouldReplace(1793000000000L,1792999999999L));
        assertTrue(StreamDecoder.shouldReplace(1793000000000L,1793000000001L));
        assertTrue(StreamDecoder.shouldReplace(0,1793000000001L));
    }
    @Test public void marketStatusNotAPrice() throws Exception {
        byte[] bytes=MarketDataFeedV3.FeedResponse.newBuilder()
            .setType(MarketDataFeedV3.Type.market_info).setCurrentTs(NOW).build().toByteArray();
        assertEquals(0,StreamDecoder.decode(bytes,Collections.emptySet(),NOW).getJSONArray("rows").length());
    }
    @Test public void refusesInvalidOrOversizedFrames() throws Exception {
        try{StreamDecoder.decode(new byte[0],Collections.emptySet(),NOW);fail("empty frame");}
        catch(com.google.protobuf.InvalidProtocolBufferException expected){}
        try{StreamDecoder.decode(new byte[2097153],Collections.emptySet(),NOW);fail("oversized frame");}
        catch(com.google.protobuf.InvalidProtocolBufferException expected){}
    }
    @Test public void missingFutureAndStaleFeedEnvelopeClocksAreRejected()throws Exception {
        for(long ts:new long[]{0,NOW+60001,NOW-300001}){
            byte[] wire=MarketDataFeedV3.FeedResponse.newBuilder().setType(MarketDataFeedV3.Type.live_feed).setCurrentTs(ts).build().toByteArray();
            try{StreamDecoder.decode(wire,Collections.emptySet(),NOW);fail("bad envelope clock");}catch(com.google.protobuf.InvalidProtocolBufferException expected){}
        }
    }

}

