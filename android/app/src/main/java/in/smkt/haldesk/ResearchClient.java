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
        catch(Exception e){String code=error(e);if(code.equals("token_expired_or_unauthorized")||code.equals("upstox_rate_limited")||code.equals("credential_missing"))throw e;errors.put(name,code);if(code.equals("network_unavailable")&&errors.length()>1)throw e;}
    }
    JSONObject load(String mode,String token,String section,String frame,String type)throws Exception{
        if(!section.matches("candles|patterns|news|fundamentals|filings|status|context|chain|hedges"))throw new MarketClient.Failure("invalid_research_request");
        if(!type.matches("consolidated|standalone"))throw new MarketClient.Failure("invalid_research_request");
        if(section.equals("chain")||section.equals("hedges")){if(!frame.matches("\\d{4}-\\d{2}-\\d{2}"))throw new MarketClient.Failure("invalid_expiry");LocalDate.parse(frame);}
        else if(!frame.matches("D|15m|1h"))throw new MarketClient.Failure("invalid_research_request");
        if(section.equals("patterns")&&!frame.equals("D"))throw new MarketClient.Failure("invalid_research_request");
        if(mode.equals("server"))return market.request(MarketClient.SERVER+"/api/upstox/research?section="+section+"&frame="+enc(frame)+"&type="+type,token,true);
        JSONObject out=new JSONObject(),data=new JSONObject(),errors=new JSONObject();
        out.put("section",section);out.put("frame",frame);out.put("type",type);out.put("source",section.equals("filings")?"NSE corporate RSS":"Upstox official API");
        if(section.equals("filings")){JSONArray items=new JSONArray();for(String file:new String[]{"Online_announcements.xml","Board_Meetings.xml","Financial_Results.xml"}){
            try{JSONArray rss=feed(file);for(int i=0;i<rss.length();i++)items.put(rss.get(i));}catch(Exception e){errors.put(file,"official_feed_unavailable");}
        }data.put("items",items);data.put("coverage","Latest items retained by NSE RSS; absence of an item is not proof that no filing exists.");}
        else if(section.equals("chain")){data=market.load(mode,token,frame);}
        else if(section.equals("hedges")){data=market.hedgeSnapshot(token,frame);}
        else if(section.equals("status")){field(data,errors,"market","/v2/market/status/NSE","",token);}
        else if(section.equals("context")){
            // Fixed, official NSE index keys. No user-controlled destination or token exposure.
            // Each quote retains the provider's last_trade_time and timestamp separately.
            field(data,errors,"indices","/v3/market-quote/quotes",
                    "instrument_key="+enc("NSE_INDEX|Nifty 50,NSE_INDEX|India VIX"),token);
            data.put("coverage","Nifty 50 and India VIX only. Quote time is not retrieval time. Missing index data is not inferred.");
        }
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
                if(!section.equals("patterns"))field(data,errors,"intraday","/v3/historical-candle/intraday/"+enc(key)+"/"+unit+"/"+interval,"",token);
            }
        }
        out.put("data",data);out.put("errors",errors);out.put("fetched_at_iso",OffsetDateTime.now().toString());return out;
    }
    private JSONArray feed(String file)throws Exception{
        URL url=new URL("https://nsearchives.nseindia.com/content/RSS/"+file);
        HttpsURLConnection c=(HttpsURLConnection)url.openConnection();String raw;
        try{c.setRequestMethod("GET");c.setInstanceFollowRedirects(false);c.setConnectTimeout(12000);c.setReadTimeout(18000);c.setRequestProperty("Accept","application/rss+xml, application/xml, text/xml");c.setRequestProperty("User-Agent","HAL-Desk-Personal-Reader/2.1");
            if(c.getResponseCode()!=200)throw new Exception("feed_unavailable");ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream in=c.getInputStream()){byte[] b=new byte[8192];int n;while((n=in.read(b))!=-1){if(bytes.size()+n>4000000)throw new Exception("feed_too_large");bytes.write(b,0,n);}}
            raw=new String(bytes.toByteArray(),StandardCharsets.UTF_8);
        }finally{c.disconnect();}
        if(raw.toUpperCase(Locale.ROOT).contains("<!DOCTYPE"))throw new Exception("unsupported_xml");
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
