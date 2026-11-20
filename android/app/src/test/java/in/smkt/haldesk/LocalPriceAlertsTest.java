package in.smkt.haldesk;
import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import java.time.Instant;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=28,manifest=Config.NONE)
public class LocalPriceAlertsTest {
 private Context context;private final long now=Instant.parse("2026-11-20T08:30:00Z").toEpochMilli();
 @Before public void reset(){context=RuntimeEnvironment.getApplication();LocalPriceAlerts.prefs(context).edit().clear().commit();}
 private JSONObject quote(double price,long at)throws Exception{return new JSONObject().put("last_price",price)
  .put("quality","recent").put("quality_issues",new JSONArray())
  .put("quote_as_of",Instant.ofEpochMilli(at).toString()).put("last_trade_at",Instant.ofEpochMilli(at).toString());}
 @Test public void firesOnlyOnFreshCrossingAndRearams()throws Exception{
  LocalPriceAlerts.configure(context,"above",5100.0);
  assertNotNull(LocalPriceAlerts.onSpot(context,quote(5150,now-30000),now));
  assertNull(LocalPriceAlerts.onSpot(context,quote(5150,now-30000),now));
  assertNull(LocalPriceAlerts.onSpot(context,quote(5150,now-20000),now));
  assertNull(LocalPriceAlerts.onSpot(context,quote(5000,now-10000),now));
  assertNotNull(LocalPriceAlerts.onSpot(context,quote(5150,now),now));
 }
 @Test public void rejectsStaleFutureAndBadQuality()throws Exception{
  LocalPriceAlerts.configure(context,"below",4900.0);
  assertNull(LocalPriceAlerts.onSpot(context,quote(4800,now-600000),now));
  assertNull(LocalPriceAlerts.onSpot(context,quote(4800,now+90000),now));
  assertNull(LocalPriceAlerts.onSpot(context,quote(4800,now-20000).put("quality","review_required"),now));
 }
 @Test public void supportsDisabledAlerts()throws Exception{
  LocalPriceAlerts.configure(context,"below",4900.0);
  LocalPriceAlerts.configure(context,"below",null);
  assertTrue(Double.isNaN(LocalPriceAlerts.threshold(context,"below")));
  assertNull(LocalPriceAlerts.onSpot(context,quote(4700,now),now));
 }
 @Test public void validatesBothThresholdsWithoutPartialWrites(){
  LocalPriceAlerts.configureBoth(context,5300.0,4800.0);
  assertEquals(5300.0,LocalPriceAlerts.threshold(context,"above"),0.001);
  assertEquals(4800.0,LocalPriceAlerts.threshold(context,"below"),0.001);
  try{LocalPriceAlerts.configureBoth(context,4900.0,5200.0);fail();}
  catch(IllegalArgumentException expected){assertEquals("below_must_be_less_than_above",expected.getMessage());}
  assertEquals(5300.0,LocalPriceAlerts.threshold(context,"above"),0.001);
  assertEquals(4800.0,LocalPriceAlerts.threshold(context,"below"),0.001);
 }
 @Test public void rejectsInvalidThresholds(){
  try{LocalPriceAlerts.configure(context,"above",Double.NaN);fail();}catch(IllegalArgumentException expected){}
  try{LocalPriceAlerts.configure(context,"below",-1.0);fail();}catch(IllegalArgumentException expected){}
 }
}
