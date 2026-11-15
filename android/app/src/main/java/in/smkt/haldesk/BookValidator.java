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
   if(k.equals("close")){JSONObject closedLeg=j.getJSONObject("leg");leg(closedLeg);number(j,"exit",closedLeg.getString("type").equals("FUT")?Double.MIN_VALUE:0,1e7);number(j,"fees",0,1e10);}
   else if(k.equals("fee"))number(j,"amount",0,1e12);
   else if(k.equals("settlement")||k.equals("funding"))number(j,"amount",-1e12,1e12);
   else throw new Exception("invalid_journal_kind");}
  if(!b.isNull("history")) validateHistory(b.getJSONObject("history"),journal);
  rejectCredentials(b,0);return b;
 }
 static void leg(JSONObject l)throws Exception{String t=l.getString("type");if((!t.equals("FUT")&&!t.equals("PE"))||l.optString("id").isEmpty())throw new Exception("invalid_contract");LocalDate.parse(l.getString("expiry"));double lots=number(l,"lots",1,10000),size=number(l,"lotSize",1,100000);if(lots!=Math.rint(lots)||size!=Math.rint(size))throw new Exception("invalid_lot_size");number(l,"entry",t.equals("FUT")?Double.MIN_VALUE:0,1e7);if(t.equals("PE"))number(l,"strike",Double.MIN_VALUE,1e7);if(l.has("manual")&&!l.isNull("manual"))number(l,"manual",0,1e7);}
 static double number(JSONObject o,String k,double min,double max)throws Exception{Object v=o.opt(k);if(!(v instanceof Number))throw new Exception("invalid_numeric_"+k);double n=((Number)v).doubleValue();if(!Double.isFinite(n)||n<min||n>max)throw new Exception("invalid_numeric_"+k);return n;}
 private static final int HISTORY_LIMIT=12000;

 private static void require(boolean valid, String message) throws Exception {
  if (!valid) throw new Exception(message);
 }

 private static String label(JSONObject object, String key, int max) throws Exception {
  Object value=object.opt(key);
  require(value instanceof String,"invalid_history_"+key);
  String s=(String)value;
  require(!s.trim().isEmpty() && s.length()<=max,"invalid_history_"+key);
  return s.trim();
 }

 private static String isoDate(JSONObject object,String name) throws Exception {
  String value=label(object,name,10);
  require(value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}"),"invalid_history_date");
  LocalDate.parse(value);
  return value;
 }

 private static JSONArray historyList(JSONObject h,String key,boolean required) throws Exception {
  if(!required && h.isNull(key)) return new JSONArray();
  JSONArray array=h.optJSONArray(key);
  require(array!=null && array.length()<=HISTORY_LIMIT,"invalid_history_"+key);
  return array;
 }

 private static void integer(JSONObject o,String key,double lo,double hi) throws Exception {
  double value=number(o,key,lo,hi);
  require(value==Math.rint(value),"invalid_history_"+key);
 }

 // Same unreserved characters and UTF-8 bytes as JavaScript encodeURIComponent.
 private static String sourceKey(String value) throws Exception {
  return java.net.URLEncoder.encode(value,"UTF-8").replace("+","%20").replace("%21","!")
    .replace("%27","'").replace("%28","(").replace("%29",")").replace("%7E","~");
 }

 private static String historicalRecord(JSONObject r) throws Exception {
  String type=label(r,"type",3), month=label(r,"contractMonth",7);
  require(Arrays.asList("FUT","CE","PE").contains(type),"invalid_history_type");
  require(month.matches("[0-9]{4}-(0[1-9]|1[0-2])"),"invalid_history_contract_month");
  if(!r.isNull("expiry")) require(isoDate(r,"expiry").startsWith(month+"-"),"invalid_history_expiry");
  if(!r.isNull("date")) isoDate(r,"date");
  integer(r,"units",1,1e9);
  if(type.equals("FUT")) require(r.isNull("strike"),"invalid_history_strike");
  else number(r,"strike",0.000001,1e7);
  for(String key:Arrays.asList("entry","exit")) if(!r.isNull(key)) number(r,key,0,1e7);
  number(r,"gross",-1e12,1e12);
  JSONObject source=r.getJSONObject("source");
  label(source,"name",240);
  String id=sourceKey(label(source,"id",160))+"/"+sourceKey(label(source,"row",100));
  require(id.equals(r.opt("id")),"history_source_identity_mismatch");
  return id;
 }

 private static void historicalCharges(JSONObject c) throws Exception {
  isoDate(c,"asOf");
  label(c,"source",240);
  require(Boolean.TRUE.equals(c.opt("coversExisting")),"invalid_history_charge_coverage");
  number(c,"amount",0,1e12);
 }

 static void validateHistory(JSONObject h,JSONArray journal) throws Exception {
  integer(h,"version",1,1);
  Set<String> recordIds=new HashSet<>(), closeIds=new HashSet<>();
  JSONArray records=historyList(h,"records",true);
  for(int i=0;i<records.length();i++)
   require(recordIds.add(historicalRecord(records.getJSONObject(i))),"duplicate_historical_source_row");
  for(int i=0;i<journal.length();i++){
   JSONObject j=journal.getJSONObject(i);
   if("close".equals(j.getString("kind")))closeIds.add(j.getString("id"));
  }
  JSONArray excluded=historyList(h,"excludedJournalIds",false);
  for(int i=0;i<excluded.length();i++)
   require(excluded.get(i) instanceof String && closeIds.remove(excluded.getString(i)),"invalid_history_journal_reconciliation");
  require(h.isNull("excludeLegacyRealized") || h.opt("excludeLegacyRealized") instanceof Boolean,"invalid_history_legacy_reconciliation");
  if(!h.isNull("charges")) historicalCharges(h.getJSONObject("charges"));
  JSONArray revisions=historyList(h,"revisions",false);
  for(int i=0;i<revisions.length();i++){
   JSONObject a=revisions.getJSONObject(i);
   isoDate(a,"date");label(a,"reason",500);
   require(a.isNull("record")!=a.isNull("charges"),"invalid_history_amendment");
   if(a.isNull("record"))historicalCharges(a.getJSONObject("charges"));
   else historicalRecord(a.getJSONObject("record"));
  }
  JSONArray imports=historyList(h,"imports",false);
  for(int i=0;i<imports.length();i++){
   JSONObject a=imports.getJSONObject(i);
   isoDate(a,"date");label(a,"sourceId",160);label(a,"sourceName",240);
   if(!a.isNull("sourceHash")) require(label(a,"sourceHash",71).matches("sha256:[a-f0-9]{64}"),"invalid_history_source_hash");
   require(Arrays.asList("incremental","cumulative").contains(a.opt("mode")),"invalid_history_import_mode");
   integer(a,"added",0,HISTORY_LIMIT);integer(a,"replaced",0,HISTORY_LIMIT);
  }
 }
 static void rejectCredentials(Object value,int depth)throws Exception{
  if(depth>24)throw new Exception("excessive_json_depth");
  if(value instanceof JSONObject){JSONObject o=(JSONObject)value;Iterator<String> keys=o.keys();while(keys.hasNext()){String k=keys.next(),n=k.toLowerCase(Locale.ROOT).replaceAll("[_-]","");if(Arrays.asList("token","accesstoken","apikey","password","credentials","authorization","geminikey","secret").contains(n))throw new Exception("credentials_forbidden_in_backup");rejectCredentials(o.opt(k),depth+1);}}
  else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)rejectCredentials(a.opt(i),depth+1);}
 }
}
