package in.smkt.haldesk;
import org.junit.Test;import static org.junit.Assert.*;
public class BookValidatorTest{
 private String book(String manual){return "{\"version\":4,\"legs\":[{\"id\":\"f1\",\"type\":\"FUT\",\"expiry\":\"2026-12-29\",\"lots\":2,\"lotSize\":150,\"entry\":4927.35,\"manual\":"+manual+"}],\"journal\":[]}";}
 @Test public void zeroManualMarkAllowed()throws Exception{assertEquals(0,BookValidator.parse(book("0")).getJSONArray("legs").getJSONObject(0).getDouble("manual"),0);}
 @Test public void missingManualMarkRemainsNull()throws Exception{assertTrue(BookValidator.parse(book("null")).getJSONArray("legs").getJSONObject(0).isNull("manual"));}
 @Test public void credentialsRejected()throws Exception{try{BookValidator.parse(book("null").replace("\"journal\":[]","\"journal\":[],\"apiKey\":\"synthetic\""));fail();}catch(Exception e){assertEquals("credentials_forbidden_in_backup",e.getMessage());}}

 private String closeRecord(String type,double exit)throws Exception{
  org.json.JSONObject leg=new org.json.JSONObject()
    .put("id","closed1").put("type",type).put("expiry","2026-12-29")
    .put("lots",1).put("lotSize",150).put("entry",type.equals("FUT")?4900:40);
  if(type.equals("PE"))leg.put("strike",4500);
  org.json.JSONObject record=new org.json.JSONObject()
    .put("id","journal-close1").put("kind","close").put("date","2026-11-10")
    .put("leg",leg).put("exit",exit).put("fees",0);
  org.json.JSONObject b=new org.json.JSONObject(book("null"));
  b.put("journal",new org.json.JSONArray().put(record));
  return b.toString();
 }
 @Test public void legacyShortCannotBeProjectedAsALong() throws Exception {
  for(String raw : new String[]{book("null"), closeRecord("PE",25)}) {
   org.json.JSONObject doc = new org.json.JSONObject(raw);
   org.json.JSONObject leg = doc.getJSONArray("journal").length()==0
     ? doc.getJSONArray("legs").getJSONObject(0)
     : doc.getJSONArray("journal").getJSONObject(0).getJSONObject("leg");
   leg.put("side","SELL");
   assertEquals("invalid_contract",assertThrows(Exception.class,()->BookValidator.parse(doc.toString())).getMessage());
  }
 }
 @Test public void bookedFuturesCloseCannotHaveZeroExitPrice()throws Exception{
  try{BookValidator.parse(closeRecord("FUT",0));fail("zero futures close must fail");}
  catch(Exception e){assertTrue(e.getMessage().contains("invalid_numeric_exit"));}
  assertEquals(4900,BookValidator.parse(closeRecord("FUT",4900))
    .getJSONArray("journal").getJSONObject(0).getDouble("exit"),0);
 }
 @Test public void zeroPricedPutExpiryCloseIsValid()throws Exception{
  assertEquals(0,BookValidator.parse(closeRecord("PE",0))
    .getJSONArray("journal").getJSONObject(0).getDouble("exit"),0);
 }
 @Test public void malformedLotsDateAndVersionRejected()throws Exception{for(String bad:new String[]{book("null").replace("\"lots\":2","\"lots\":1.5"),book("null").replace("2026-12-29","2026-02-31"),book("null").replace("\"version\":4","\"version\":99")}){try{BookValidator.parse(bad);fail();}catch(Exception e){}}}
}