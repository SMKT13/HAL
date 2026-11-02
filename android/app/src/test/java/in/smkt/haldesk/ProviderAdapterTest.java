package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.Instant;
import java.lang.reflect.Field;

/** Synthetic provider packets only: these tests never open a connection. */
public final class ProviderAdapterTest {
    private static final long NOW=Instant.parse("2026-10-28T10:30:00Z").toEpochMilli();
    private static JSONObject raw() throws Exception {
        return new JSONObject().put("instrument_token","NSE_FO|SYNTHETIC")
            .put("last_price",50.0).put("prev_close_price",49.0)
            .put("timestamp",Instant.ofEpochMilli(NOW-1000).toString())
            .put("last_trade_time",String.valueOf(NOW-2000))
            .put("depth",new JSONObject().put("buy",new JSONArray().put(new JSONObject().put("price",49).put("quantity",150)))
              .put("sell",new JSONArray().put(new JSONObject().put("price",51).put("quantity",300))));
    }
    private static JSONObject quote(JSONObject raw)throws Exception {
        return MarketClient.quote(new JSONObject().put("AN_UNRELATED_DISPLAY_KEY",raw),"NSE_FO|SYNTHETIC",NOW);
    }
    @Test public void matchesExactInstrumentNotMapDisplayKey()throws Exception {
        assertEquals(50,quote(raw()).getDouble("last_price"),0);
        assertNull(MarketClient.quote(new JSONObject().put("NSE_FO|OTHER",raw()),"NSE_FO|OTHER",NOW));
    }
    @Test public void separateProviderTradeAndRetrievalClocks()throws Exception {
        JSONObject q=quote(raw());assertEquals(Instant.ofEpochMilli(NOW-1000).toString(),q.getString("provider_generated_at"));
        assertEquals(Instant.ofEpochMilli(NOW-2000).toString(),q.getString("last_trade_at"));
        assertEquals(Instant.ofEpochMilli(NOW).toString(),q.getString("retrievedAt"));assertEquals("recent",q.getString("quality"));
    }
    @Test public void freshResponseDoesNotMakeOldTradeFresh()throws Exception {
        JSONObject q=quote(raw().put("last_trade_time",String.valueOf(NOW-3600000)));
        assertTrue(q.getJSONArray("quality_issues").toString().contains("last_trade_stale"));assertEquals("review_required",q.getString("quality"));
    }
    @Test public void missingAndFutureClocksAreExplicit()throws Exception {
        JSONObject r=raw();r.remove("timestamp");JSONObject q=quote(r);assertTrue(q.isNull("quote_as_of"));assertTrue(q.getJSONArray("quality_issues").toString().contains("provider_timestamp_missing"));
        q=quote(raw().put("timestamp",Instant.ofEpochMilli(NOW+61000).toString()));assertTrue(q.getJSONArray("quality_issues").toString().contains("provider_clock_future"));
    }
    @Test public void unavailableAndZeroAreDistinct()throws Exception {
        JSONObject r=raw().put("oi",0);JSONObject q=quote(r);assertEquals(0,q.getDouble("open_interest"),0);assertTrue(q.isNull("previous_oi"));
        r.getJSONObject("depth").getJSONArray("buy").getJSONObject(0).put("quantity",0);q=quote(r);assertTrue(q.isNull("bid"));assertTrue(q.isNull("bidQty"));
    }
    @Test public void providerPreviousCloseCannotFallBackToSessionClose()throws Exception {
        JSONObject r=raw();r.remove("prev_close_price");r.put("ohlc",new JSONObject().put("close",123));assertTrue(quote(r).isNull("prev_close"));
    }
    private static JSONArray candle(long time,double close)throws Exception {
        return new JSONArray().put(Instant.ofEpochMilli(time).toString()).put(100).put(110).put(90).put(close).put(1000).put(0);
    }
    @Test public void excludesIncompleteInvalidAndConflictingCandles()throws Exception {
        JSONArray rows=new JSONArray().put(candle(NOW-1800000,101)).put(candle(NOW-600000,101))
            .put(candle(NOW-3600000,120)).put(candle(NOW-5400000,101)).put(candle(NOW-5400000,102));
        JSONObject result=ResearchClient.completedCandles(new JSONObject().put("candles",rows),"15m",NOW);
        assertEquals(1,result.getJSONArray("candles").length());assertEquals(3,result.getInt("rejected_rows"));
    }
    @Test public void todaysDailyCandleIsExcluded()throws Exception {
        JSONArray rows=new JSONArray().put(candle(NOW,101)).put(candle(NOW-86400000L,101));
        assertEquals(1,ResearchClient.completedCandles(new JSONObject().put("candles",rows),"D",NOW).getJSONArray("candles").length());
    }
    private static void field(MarketClient c,String name,Object value)throws Exception {Field f=MarketClient.class.getDeclaredField(name);f.setAccessible(true);f.set(c,value);}
    @Test public void exactContractMismatchIsReturnedWithoutNetwork()throws Exception {
        MarketClient c=new MarketClient();field(c,"underlying","NSE_EQ|SYNTHETICKEY");field(c,"metadataTime",System.currentTimeMillis());
        field(c,"contracts",new JSONArray().put(new JSONObject().put("expiry","2099-12-29").put("instrument_key","NSE_FO|SYNTHETIC").put("lot_size",150)));
        JSONArray hints=new JSONArray().put(new JSONObject().put("type","FUT").put("expiry","2099-12-29").put("lotSize",100));
        JSONObject result=c.heldQuotes("not-a-token",hints).getJSONArray("contracts").getJSONObject(0);
        assertFalse(result.getBoolean("verified"));assertEquals("lot_size_mismatch",result.getString("reason"));assertTrue(result.isNull("quote"));
        hints.getJSONObject(0).put("lotSize",150).put("instrument_key","NSE_FO|DIFFERENT");
        assertEquals("instrument_key_mismatch",c.heldQuotes("not-a-token",hints).getJSONArray("contracts").getJSONObject(0).getString("reason"));
    }
    @Test public void nonDirectModeRejectedBeforeNetwork()throws Exception {
        try{new MarketClient().load("server","not-a-token","");fail("server rejected");}catch(MarketClient.Failure expected){assertEquals("direct_analytics_only",expected.code);}
    }

    @Test public void incompleteBarsAreNotSchemaFailures()throws Exception{JSONObject r=ResearchClient.completedCandles(new JSONObject().put("candles",new JSONArray().put(candle(NOW-600000,101))),"15m",NOW);assertEquals(1,r.getInt("incomplete_rows"));assertEquals(0,r.getInt("invalid_rows"));}
    @Test public void malformedAndConflictingBarsAreSchemaFailures()throws Exception{JSONObject r=ResearchClient.completedCandles(new JSONObject().put("candles",new JSONArray().put("broken").put(candle(NOW-1800000,101)).put(candle(NOW-1800000,102))),"15m",NOW);assertEquals(2,r.getInt("invalid_rows"));assertEquals(0,r.getJSONArray("candles").length());}
    @Test public void contextNormalizationRetainsExactQuoteClocks()throws Exception{java.util.Map<String,String> keys=new java.util.HashMap<>();keys.put("Nifty 50","NSE_INDEX|Nifty 50");JSONObject value=raw().put("instrument_token","NSE_INDEX|Nifty 50");JSONObject r=MarketClient.normalizedContext(new JSONObject().put("DISPLAY",value),keys,NOW).getJSONObject("NSE_INDEX|Nifty 50");assertEquals("Nifty 50",r.getString("symbol"));assertEquals(Instant.ofEpochMilli(NOW).toString(),r.getString("retrievedAt"));assertEquals(Instant.ofEpochMilli(NOW-1000).toString(),r.getString("quote_as_of"));}
}
