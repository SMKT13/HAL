package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/** NSE MCP tests are synthetic. No internet, NSE credentials or Upstox login. */
public final class NseMcpClientTest {
    private static final String TIME="2026-11-12 16:00:28";
    private static JSONObject equity()throws Exception {
        return new JSONObject().put("stock",new JSONObject()
            .put("symbol","HAL").put("series","EQ")
            .put("lastTradedPrice",4843.40).put("preClosePrice",4949.0)
            .put("latestTimestamp",TIME))
            .put("updatedAt","2026-11-13T02:08:28Z");
    }
    @Test public void stockQuoteProvenanceIsSeparateFromHttpFetch()throws Exception {
        JSONObject q=NseMcpClient.validateStock(equity());
        Instant expected=LocalDateTime.parse(TIME,DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
            .atZone(ZoneId.of("Asia/Kolkata")).toInstant();
        assertEquals(expected.toString(),q.getString("exchange_time_iso"));
        assertEquals("2026-11-13T02:08:28Z",q.getString("provider_retrieved_at"));
        assertEquals(4843.40,q.getDouble("lastTradedPrice"),0.001);
        assertEquals("NSE CM MCP · HAL EQ",q.getString("source"));
    }
    @Test public void rejectWrongInstrumentsMissingPricesAndFutureExchangeClocks()throws Exception {
        JSONObject q=equity();q.getJSONObject("stock").put("symbol","HINDALCO");
        try{NseMcpClient.validateStock(q);fail("wrong symbol");}
        catch(NseMcpClient.Failure expected){assertEquals("nse_wrong_instrument",expected.code);}
        q=equity();q.getJSONObject("stock").put("series","FUT");
        try{NseMcpClient.validateStock(q);fail("wrong series");}
        catch(NseMcpClient.Failure expected){assertEquals("nse_wrong_instrument",expected.code);}
        q=equity();q.getJSONObject("stock").put("lastTradedPrice",0);
        try{NseMcpClient.validateStock(q);fail("zero quote");}
        catch(NseMcpClient.Failure expected){assertEquals("nse_quote_invalid",expected.code);}
        String future=LocalDateTime.now(ZoneId.of("Asia/Kolkata")).plusHours(2)
            .format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
        try{NseMcpClient.exchangeTime(future);fail("future quote");}
        catch(NseMcpClient.Failure expected){assertEquals("nse_quote_future",expected.code);}
    }
    @Test public void parseStrictJsonRpcAndSseNotUnrelatedMessages()throws Exception {
        String json="{\"jsonrpc\":\"2.0\",\"id\":7,\"result\":{\"ok\":true}}";
        JSONObject direct=NseMcpClient.readResponse(
            new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)),"application/json",7);
        assertTrue(direct.getJSONObject("result").getBoolean("ok"));
        String sse="event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":6,\"result\":{}}\n\n"+
            "event: message\ndata: "+json+"\n\n";
        JSONObject actual=NseMcpClient.readResponse(
            new ByteArrayInputStream(sse.getBytes(StandardCharsets.UTF_8)),"text/event-stream",7);
        assertEquals(7,actual.getInt("id"));
        assertNull(NseMcpClient.readResponse(
            new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8)),"application/json",8));
    }
    @Test public void historicalLevelsUseOnlyValidHalCompletedBars()throws Exception {
        JSONArray a=new JSONArray();
        for(int i=0;i<6;i++){
            double high=5000+i*10,low=4800+i*5,close=4900+i*5;
            a.put(new JSONObject().put("symbol","HAL").put("date","2026-11-"+String.format("%02d",i+1))
                .put("low",low).put("high",high).put("close",close));
        }
        JSONObject levels=NseMcpClient.technicalLevels(new JSONObject().put("data",a));
        assertEquals(6,levels.getInt("trading_days"));
        assertEquals(4825.0,levels.getDouble("low_5"),0.001); // last five of six
        assertEquals(5050.0,levels.getDouble("high_5"),0.001);
        assertEquals(4800.0,levels.getDouble("low_20"),0.001);
        assertEquals(6,levels.getJSONArray("recent_closes").length());
        assertEquals("2026-11-06",levels.getString("as_of"));
    }
    @Test public void doesNotTreatMalformedHistoryAsPriceLevels()throws Exception {
        JSONArray rows=new JSONArray().put(new JSONObject().put("symbol","HAL").put("low",0).put("high",100).put("close",50));
        try{NseMcpClient.technicalLevels(new JSONObject().put("data",rows));fail("bad rows accepted");}
        catch(NseMcpClient.Failure expected){assertEquals("nse_history_incomplete",expected.code);}
    }
}
