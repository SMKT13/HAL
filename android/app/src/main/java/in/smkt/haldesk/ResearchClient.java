package in.smkt.haldesk;

import org.json.JSONObject;
import org.json.JSONArray;
import org.xmlpull.v1.XmlPullParser;
import org.xmlpull.v1.XmlPullParserFactory;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.StringReader;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.Locale;
import javax.net.ssl.HttpsURLConnection;

/** Fixed read-only research operations. Broker credentials never reach public feeds. */
final class ResearchClient {
    private final MarketClient market;
    ResearchClient(MarketClient market){this.market=market;}
    private String enc(String s)throws Exception{return URLEncoder.encode(s,"UTF-8");}
    private String error(Exception e){return e instanceof MarketClient.Failure?((MarketClient.Failure)e).code:"network_unavailable";}
    private void field(JSONObject target,JSONObject errors,String name,String path,String params,String token)throws Exception{
        try{Object data=market.apiData(path,params,token);if(data==null||data==JSONObject.NULL)throw new MarketClient.Failure("bad_response");target.put(name,data);}
        catch(Exception e){String code=error(e);if(code.equals("cancelled")||code.equals("token_expired_or_unauthorized")||code.equals("upstox_rate_limited")||code.equals("credential_missing"))throw e;errors.put(name,code);if(code.equals("network_unavailable")&&errors.length()>1)throw e;}
    }
    JSONObject load(String mode,String token,String section,String frame,String type)throws Exception{
        return load(mode,token,section,frame,type,null);
    }
    JSONObject load(String mode,String token,String section,String frame,String type,JSONArray strikes)throws Exception{
        if(!section.matches("candles|patterns|news|fundamentals|filings|status|context|participation|chain|hedges|greeks|contracts"))throw new MarketClient.Failure("invalid_research_request");
        if(!type.matches("consolidated|standalone"))throw new MarketClient.Failure("invalid_research_request");
        if(section.equals("chain")||section.equals("hedges")||section.equals("greeks")){if(!frame.matches("\\d{4}-\\d{2}-\\d{2}"))throw new MarketClient.Failure("invalid_expiry");LocalDate.parse(frame);}
        else if(!frame.matches("D|15m|1h"))throw new MarketClient.Failure("invalid_research_request");
        if(section.equals("patterns")&&!frame.equals("D"))throw new MarketClient.Failure("invalid_research_request");
        if((section.equals("participation")||section.equals("greeks")) && mode.equals("server"))throw new MarketClient.Failure("analytics_direct_only");
        if(!mode.equals("direct"))throw new MarketClient.Failure("direct_analytics_only");
        JSONObject out=new JSONObject(),data=new JSONObject(),errors=new JSONObject();
        out.put("section",section);out.put("frame",frame);out.put("type",type);out.put("source",section.equals("filings")?"NSE corporate RSS":"Upstox official API");
        if(section.equals("filings")){JSONArray items=new JSONArray();for(String file:new String[]{"Online_announcements.xml","Board_Meetings.xml","Financial_Results.xml"}){
            try{JSONArray rss=feed(file);for(int i=0;i<rss.length();i++)items.put(rss.get(i));}catch(Exception e){errors.put(file,"official_feed_unavailable");}
        }data.put("items",items);data.put("coverage","Latest items retained by NSE RSS; absence of an item is not proof that no filing exists.");}
        else if(section.equals("chain")){data=market.load(mode,token,frame);}
        else if(section.equals("hedges")){data=market.hedgeSnapshot(token,frame);}
        else if(section.equals("greeks")){data=market.heldPutGreeks(token,frame,strikes);}
        else if(section.equals("contracts")){data=market.heldQuotes(token,strikes);}
        else if(section.equals("status")){field(data,errors,"market","/v2/market/status/NSE","",token);}
        else if(section.equals("participation")){data=market.derivativeParticipation(token);}
        else if(section.equals("context")){data=market.contextQuotes(token);JSONObject partial=data.optJSONObject("errors");if(partial!=null)for(java.util.Iterator<String> it=partial.keys();it.hasNext();){String k=it.next();errors.put(k,partial.get(k));}}
        else {
            String key=market.equity(token),isin=key.substring(key.indexOf('|')+1),base="/v2/fundamentals/"+isin+"/";
            if(section.equals("news")){field(data,errors,"articles","/v2/news","category=instrument_keys&instrument_keys="+enc(key)+"&page_size=100&page_number=1",token);data.put("window_days",7);}
            if(section.equals("fundamentals")){
                field(data,errors,"income",base+"income-statement","type="+type+"&time_period=quarterly",token);
                field(data,errors,"annual",base+"income-statement","type="+type+"&time_period=yearly&fs=true",token);
                field(data,errors,"ratios",base+"key-ratios","",token);
                field(data,errors,"cash",base+"cash-flow","type="+type+"&fs=true",token);
                field(data,errors,"balance",base+"balance-sheet","type="+type+"&fs=true",token);
                field(data,errors,"shareholding",base+"share-holdings","",token);
                field(data,errors,"actions",base+"corporate-actions","",token);
                field(data,errors,"profile",base+"profile","",token);
                field(data,errors,"peers",base+"competitors","",token);
            }
            if(section.equals("candles")||section.equals("patterns")){
                LocalDate today=LocalDate.now(ZoneId.of("Asia/Kolkata"));String unit=frame.equals("D")?"days":frame.equals("15m")?"minutes":"hours",interval=frame.equals("15m")?"15":"1";
                field(data,errors,"history","/v3/historical-candle/"+enc(key)+"/"+unit+"/"+interval+"/"+today.minusDays(1)+"/"+today.minusDays(section.equals("patterns")?1827:frame.equals("D")?450:frame.equals("15m")?25:80),"",token);
                if(!section.equals("patterns")&&!frame.equals("D"))field(data,errors,"intraday","/v3/historical-candle/intraday/"+enc(key)+"/"+unit+"/"+interval,"",token);
            }
        }
        if(section.equals("candles")||section.equals("patterns")){
            for(String field:new String[]{"history","intraday"}){
                JSONObject raw=data.optJSONObject(field);if(raw==null)continue;
                JSONObject checked=completedCandles(raw,frame,System.currentTimeMillis());data.put(field,checked);
                if(checked.optInt("invalid_rows")>0)errors.put(field+"_validation","Invalid or conflicting candle rows excluded");
            }data.put("completed_bars_only",true);data.put("completion_policy","Today's daily candle conservatively excluded until next IST date. Intraday bars require complete interval.");
        }
        out.put("data",data);out.put("errors",errors);out.put("fetched_at_iso",OffsetDateTime.now().toString());out.put("refresh_status",errors.length()==0?"success":"partial");return out;
    }
    static JSONObject completedCandles(JSONObject raw,String frame,long now)throws Exception{
        JSONArray input=raw.optJSONArray("candles");if(input==null)throw new MarketClient.Failure("bad_response");
        java.util.TreeMap<Long,JSONArray> accepted=new java.util.TreeMap<>();java.util.HashSet<Long> conflicts=new java.util.HashSet<>();int rejected=0,invalid=0,incomplete=0;
        LocalDate today=java.time.Instant.ofEpochMilli(now).atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
        for(int i=0;i<input.length();i++){
            JSONArray row=input.optJSONArray(i);boolean valid=row!=null&&row.length()>=6;long t=valid?MarketClient.epoch(row.opt(0)):0;
            if(valid){double o=row.optDouble(1,Double.NaN),h=row.optDouble(2,Double.NaN),l=row.optDouble(3,Double.NaN),c=row.optDouble(4,Double.NaN),v=row.optDouble(5,Double.NaN);
                valid=t>0&&Double.isFinite(o)&&Double.isFinite(h)&&Double.isFinite(l)&&Double.isFinite(c)&&Double.isFinite(v)&&o>0&&c>0&&l>0&&h>=Math.max(o,c)&&l<=Math.min(o,c)&&h>=l&&v>=0;}
            if(!valid){rejected++;invalid++;continue;}
            if(valid){if(frame.equals("D"))valid=java.time.Instant.ofEpochMilli(t).atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().isBefore(today);else valid=t+(frame.equals("15m")?900000L:3600000L)<=now;}
            if(!valid){rejected++;incomplete++;continue;}
            if(conflicts.contains(t)){rejected++;invalid++;continue;}
            if(accepted.containsKey(t)){if(!accepted.get(t).toString().equals(row.toString())){accepted.remove(t);conflicts.add(t);invalid++;}rejected++;continue;}
            accepted.put(t,row);
        }
        JSONArray rows=new JSONArray();for(JSONArray row:accepted.values())rows.put(row);JSONObject result=new JSONObject();result.put("candles",rows);result.put("rejected_rows",rejected);result.put("invalid_rows",invalid);result.put("incomplete_rows",incomplete);result.put("completed_bars_only",true);result.put("latest_completed_bar_at",accepted.isEmpty()?JSONObject.NULL:java.time.Instant.ofEpochMilli(accepted.lastKey()).toString());return result;
    }
    private JSONArray feed(String file)throws Exception{
        URL url=new URL("https://nsearchives.nseindia.com/content/RSS/"+file);
        HttpsURLConnection c=(HttpsURLConnection)url.openConnection();String raw;
        try{c.setRequestMethod("GET");c.setInstanceFollowRedirects(false);c.setConnectTimeout(12000);c.setReadTimeout(18000);c.setRequestProperty("Accept","application/rss+xml, application/xml, text/xml");c.setRequestProperty("User-Agent","HAL-Desk-Personal-Reader/4.0");
            if(c.getResponseCode()!=200)throw new Exception("feed_unavailable");ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(Thread.currentThread().isInterrupted())throw new MarketClient.Failure("cancelled");if(bytes.size()+n>4000000)throw new Exception("feed_too_large");bytes.write(b,0,n);}}
            raw=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
        }finally{c.disconnect();}
        if(raw.toUpperCase(Locale.ROOT).contains("<!DOCTYPE")||raw.toUpperCase(Locale.ROOT).contains("<!ENTITY"))throw new Exception("unsupported_xml");
        XmlPullParser parser=XmlPullParserFactory.newInstance().newPullParser();parser.setInput(new StringReader(raw));
        JSONArray result=new JSONArray();JSONObject item=null;String field="";StringBuilder text=new StringBuilder();
        for(int event=parser.getEventType();event!=XmlPullParser.END_DOCUMENT;event=parser.next()){
            if(event==XmlPullParser.START_TAG){String tag=parser.getName();if(tag.equalsIgnoreCase("item")){item=new JSONObject();}if(item!=null&&tag.matches("(?i)title|description|link|pubDate")){field=tag.toLowerCase(Locale.ROOT);text.setLength(0);}}
            else if(event==XmlPullParser.TEXT&&item!=null&&!field.isEmpty())text.append(parser.getText());
            else if(event==XmlPullParser.END_TAG&&item!=null){String tag=parser.getName().toLowerCase(Locale.ROOT);if(tag.equals(field)){item.put(field,text.toString().replaceAll("<[^>]*>"," ").trim());field="";}
                if(tag.equals("item")){String hay=item.optString("title")+" "+item.optString("description");if(hay.matches("(?is).*\\bhindustan\\s+aeronautics\\b.*")||hay.matches("(?s).*\\bHAL\\b.*")){JSONObject n=new JSONObject();n.put("title",item.optString("title"));n.put("summary",item.optString("description"));n.put("url",item.optString("link"));n.put("published",item.optString("pubdate"));n.put("source","NSE disclosure");n.put("official",true);n.put("feed",file);result.put(n);}item=null;}
            }
        }return result;
    }
}

