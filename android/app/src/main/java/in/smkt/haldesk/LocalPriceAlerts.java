package in.smkt.haldesk;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.Instant;

/** Opt-in foreground HAL cash alerts; never substitutes derivative marks. */
public final class LocalPriceAlerts {
 private static final String PREFS="hal-atlas-local-price-alerts";
 private LocalPriceAlerts(){}
 static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);}
 private static boolean valid(double n){return Double.isFinite(n)&&n>0&&n<100000000;}
 public static double threshold(Context c,String side){
  if(!side.equals("above")&&!side.equals("below"))return Double.NaN;
  String stored=prefs(c).getString("price_"+side,"");
  try{double n=Double.parseDouble(stored);return valid(n)?n:Double.NaN;}
  catch(Exception ignored){return Double.NaN;}
 }
 public static void configure(Context c,String side,Double price){
  if(!side.equals("above")&&!side.equals("below"))throw new IllegalArgumentException("invalid_alert_side");
  if(price!=null&&!valid(price))throw new IllegalArgumentException("invalid_alert_price");
  SharedPreferences.Editor e=prefs(c).edit();
  if(price==null)e.remove("price_"+side);
  else e.putString("price_"+side,Double.toString(price));
  e.putBoolean("tripped_"+side,false).apply();
 }
 private static long timestamp(String v){try{return Instant.parse(v).toEpochMilli();}catch(Exception ignored){return -1;}}
 /** Supply a quote received from an already-completed read-only Upstox refresh. */
 public static synchronized JSONObject onSpot(Context c,JSONObject spot,long now){
  if(spot==null||!"recent".equals(spot.optString("quality")))return null;
  JSONArray errors=spot.optJSONArray("quality_issues");
  if(errors==null||errors.length()!=0)return null;
  double price=spot.optDouble("last_price",Double.NaN);
  if(!valid(price))return null;
  long provider=timestamp(spot.optString("quote_as_of")),trade=timestamp(spot.optString("last_trade_at"));
  if(provider<=0||trade<=0||provider>now+60000||trade>now+60000
   ||now-provider>180000||now-trade>300000||trade>provider+60000)return null;
  SharedPreferences state=prefs(c);
  if(provider<=state.getLong("last_provider_time",0))return null;
  SharedPreferences.Editor e=state.edit().putLong("last_provider_time",provider);
  JSONObject event=null;
  for(String side:new String[]{"above","below"}){
   double limit=threshold(c,side);
   if(!valid(limit))continue;
   boolean hit=side.equals("above")?price>=limit:price<=limit;
   boolean old=state.getBoolean("tripped_"+side,false);
   e.putBoolean("tripped_"+side,hit);
   if(hit&&!old&&event==null){
    event=new JSONObject();
    try{event.put("symbol","NSE:HAL").put("kind",side).put("threshold",limit)
      .put("price",price).put("providerAt",spot.optString("quote_as_of"))
      .put("message","HAL cash price "+(side.equals("above")?"at or above ":"at or below ")
       +"₹"+limit+" · observed ₹"+price);}
    catch(Exception invalid){return null;}
   }
  }
  e.apply();
  return event;
 }
}
