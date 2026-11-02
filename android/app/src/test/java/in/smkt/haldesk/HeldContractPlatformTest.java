package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

/** Android's JSONObject coerces JSON null differently from the desktop test dependency. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk={26,35},manifest=Config.NONE)
public class HeldContractPlatformTest {
 private void field(MarketClient c,String name,Object value)throws Exception{Field f=MarketClient.class.getDeclaredField(name);f.setAccessible(true);f.set(c,value);}
 @Test public void missingKeyIsNotAContractIdOnAndroid()throws Exception{
  MarketClient c=new MarketClient();field(c,"underlying","NSE_EQ|SYNTHETICKEY");field(c,"metadataTime",System.currentTimeMillis());
  field(c,"options",new JSONArray().put(new JSONObject().put("instrument_type","PE").put("expiry","2099-11-23").put("strike_price",4500).put("underlying_key","NSE_EQ|SYNTHETICKEY").put("instrument_key","NSE_FO|SYNTHETIC").put("lot_size",150)));
  JSONObject h=new JSONObject().put("type","PE").put("expiry","2099-11-23").put("strike",4500).put("lotSize",100).put("instrument_key",JSONObject.NULL);
  assertEquals("null",h.optString("instrument_key"));
  // Deliberately wrong quantity keeps this regression entirely offline, before quote retrieval.
  JSONObject row=c.heldQuotes("not-a-token",new JSONArray().put(h)).getJSONArray("contracts").getJSONObject(0);
  assertEquals("lot_size_mismatch",row.getString("reason"));assertFalse(row.getBoolean("verified"));
 }
 private JSONObject option(int strike,String key)throws Exception{return new JSONObject().put("instrument_type","PE").put("expiry","2099-11-23").put("strike_price",strike).put("underlying_key","NSE_EQ|SYNTHETICKEY").put("instrument_key",key).put("lot_size",150);}
 private JSONObject hint(int strike)throws Exception{return new JSONObject().put("type","PE").put("expiry","2099-11-23").put("strike",strike).put("lotSize",150).put("instrument_key",JSONObject.NULL);}
 private JSONObject match(JSONObject hint,JSONArray contracts)throws Exception{return MarketClient.matchHeldContract(hint,contracts,"NSE_EQ|SYNTHETICKEY",0);}
 @Test public void bothProtectivePutsMatchWithNullOrAbsentKeysWithoutEditingBook()throws Exception{
  JSONArray rows=new JSONArray().put(option(4500,"SYNTH_A")).put(option(4400,"SYNTH_B"));
  for(int strike:new int[]{4500,4400}){JSONObject h=hint(strike);String before=h.toString();JSONObject result=match(h,rows);assertTrue(result.getBoolean("verified"));assertEquals(150,result.getInt("lot_size"));assertTrue(result.isNull("requested_instrument_key"));assertEquals(before,h.toString());h.remove("instrument_key");assertTrue(match(h,rows).getBoolean("verified"));}
 }
 @Test public void realExpiryStrikeKeyAndLotMismatchesRemainBlocked()throws Exception{
  JSONArray rows=new JSONArray().put(option(4500,"SYNTH_A"));
  assertEquals("contract_not_listed",match(hint(4500).put("expiry","2099-11-24"),rows).getString("reason"));
  assertEquals("contract_not_listed",match(hint(4400),rows).getString("reason"));
  assertEquals("instrument_key_mismatch",match(hint(4500).put("instrument_key","SYNTH_WRONG"),rows).getString("reason"));
  assertEquals("lot_size_mismatch",match(hint(4500).put("lotSize",100),rows).getString("reason"));
 }
 @Test public void exactKeySelectsCorrectDuplicateTupleAndUnknownKeyDoesNotGuess()throws Exception{
  JSONArray rows=new JSONArray().put(option(4500,"SYNTH_A")).put(option(4500,"SYNTH_B"));
  assertEquals("ambiguous_contract",match(hint(4500),rows).getString("reason"));
  JSONObject result=match(hint(4500).put("instrument_key","SYNTH_B"),rows);assertTrue(result.getBoolean("verified"));assertEquals("SYNTH_B",result.getString("instrument_key"));
 }
 @Test public void malformedKeyIsRejectedBeforeAnyRequest()throws Exception{
  try{match(hint(4500).put("instrument_key",123),new JSONArray());fail("numeric instrument key accepted");}catch(MarketClient.Failure e){assertEquals("invalid_contract_hints",e.code);}
 }
}
