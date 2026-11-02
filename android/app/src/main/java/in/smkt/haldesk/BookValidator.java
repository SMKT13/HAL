package in.smkt.haldesk;
import org.json.*;
import java.time.LocalDate;
import java.util.*;
final class BookValidator {
 static final int MAX_BYTES=2000000;
 static JSONObject parse(String input)throws Exception{
  if(input==null||input.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>MAX_BYTES)throw new Exception("book_too_large");
  JSONObject b=new JSONObject(input);
  if(b.optInt("version",-1)!=4)throw new Exception("unsupported_book_version");
  JSONArray legs=b.optJSONArray("legs"),journal=b.optJSONArray("journal");
  if(legs==null||journal==null||legs.length()>100||journal.length()>50000)throw new Exception("invalid_book_shape");
  Set<String> ids=new HashSet<>();
  for(int i=0;i<legs.length();i++){JSONObject l=legs.getJSONObject(i);leg(l);if(!ids.add(l.getString("id")))throw new Exception("duplicate_leg_id");}
  ids.clear();
  for(int i=0;i<journal.length();i++){JSONObject j=journal.getJSONObject(i);if(j.optString("id").isEmpty()||!ids.add(j.getString("id")))throw new Exception("duplicate_journal_id");LocalDate.parse(j.getString("date"));String k=j.getString("kind");
   if(k.equals("close")){leg(j.getJSONObject("leg"));number(j,"exit",0,1e7);number(j,"fees",0,1e10);}
   else if(k.equals("fee"))number(j,"amount",0,1e12);
   else if(k.equals("settlement")||k.equals("funding"))number(j,"amount",-1e12,1e12);
   else throw new Exception("invalid_journal_kind");}
  rejectCredentials(b,0);return b;
 }
 static void leg(JSONObject l)throws Exception{String t=l.getString("type");if((!t.equals("FUT")&&!t.equals("PE"))||l.optString("id").isEmpty())throw new Exception("invalid_contract");LocalDate.parse(l.getString("expiry"));double lots=number(l,"lots",1,10000),size=number(l,"lotSize",1,100000);if(lots!=Math.rint(lots)||size!=Math.rint(size))throw new Exception("invalid_lot_size");number(l,"entry",t.equals("FUT")?Double.MIN_VALUE:0,1e7);if(t.equals("PE"))number(l,"strike",Double.MIN_VALUE,1e7);if(l.has("manual")&&!l.isNull("manual"))number(l,"manual",0,1e7);}
 static double number(JSONObject o,String k,double min,double max)throws Exception{Object v=o.opt(k);if(!(v instanceof Number))throw new Exception("invalid_numeric_"+k);double n=((Number)v).doubleValue();if(!Double.isFinite(n)||n<min||n>max)throw new Exception("invalid_numeric_"+k);return n;}
 static void rejectCredentials(Object value,int depth)throws Exception{
  if(depth>24)throw new Exception("excessive_json_depth");
  if(value instanceof JSONObject){JSONObject o=(JSONObject)value;Iterator<String> keys=o.keys();while(keys.hasNext()){String k=keys.next(),n=k.toLowerCase(Locale.ROOT).replaceAll("[_-]","");if(Arrays.asList("token","accesstoken","apikey","password","credentials","authorization","geminikey","secret").contains(n))throw new Exception("credentials_forbidden_in_backup");rejectCredentials(o.opt(k),depth+1);}}
  else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)rejectCredentials(a.opt(i),depth+1);}
 }
}
