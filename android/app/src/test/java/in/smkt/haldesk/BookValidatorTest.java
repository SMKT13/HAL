package in.smkt.haldesk;
import org.junit.Test;import static org.junit.Assert.*;
public class BookValidatorTest{
 private String book(String manual){return "{\"version\":4,\"legs\":[{\"id\":\"f1\",\"type\":\"FUT\",\"expiry\":\"2026-12-29\",\"lots\":2,\"lotSize\":150,\"entry\":4927.35,\"manual\":"+manual+"}],\"journal\":[]}";}
 @Test public void zeroManualMarkAllowed()throws Exception{assertEquals(0,BookValidator.parse(book("0")).getJSONArray("legs").getJSONObject(0).getDouble("manual"),0);}
 @Test public void missingManualMarkRemainsNull()throws Exception{assertTrue(BookValidator.parse(book("null")).getJSONArray("legs").getJSONObject(0).isNull("manual"));}
 @Test public void credentialsRejected()throws Exception{try{BookValidator.parse(book("null").replace("\"journal\":[]","\"journal\":[],\"apiKey\":\"synthetic\""));fail();}catch(Exception e){assertEquals("credentials_forbidden_in_backup",e.getMessage());}}
 @Test public void malformedLotsDateAndVersionRejected()throws Exception{for(String bad:new String[]{book("null").replace("\"lots\":2","\"lots\":1.5"),book("null").replace("2026-12-29","2026-02-31"),book("null").replace("\"version\":4","\"version\":99")}){try{BookValidator.parse(bad);fail();}catch(Exception e){}}}
}