package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import javax.net.ssl.HttpsURLConnection;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.TreeSet;

final class MarketClient {
    static final String SERVER="https://hal-dashboard.onrender.com";
    private static final String API="https://api.upstox.com/v2";
    private String underlying="";
    private JSONArray contracts=new JSONArray(), options=new JSONArray();
    private long metadataTime=0;
    static final class Failure extends Exception {
        final String code;
        Failure(String code) { super(code); this.code=code; }
    }
    private static String enc(String value) throws Exception { return URLEncoder.encode(value,"UTF-8"); }
    private static Object num(JSONObject obj,String key) {
        Object value=obj==null?null:obj.opt(key);
        if(value instanceof Number && Double.isFinite(((Number)value).doubleValue())) return value;
        return JSONObject.NULL;
    }
    private static String date(Object value) {
        if(value instanceof String && ((String)value).matches("\\d{4}-\\d{2}-\\d{2}")) {
            try { return LocalDate.parse((String)value).toString(); } catch(Exception ignored) { return ""; }
        }
        if(value instanceof Number) {
            try { return java.time.Instant.ofEpochMilli(((Number)value).longValue()).atZone(ZoneId.of("Asia/Kolkata")).toLocalDate().toString(); }
            catch(Exception ignored) { return ""; }
        }
        return "";
    }
    private static Object time(Object value) {
        if(value==null || value==JSONObject.NULL) return JSONObject.NULL;
        try {
            String s=String.valueOf(value);
            if(s.matches("\\d{10,16}")) {
                long t=Long.parseLong(s); if(t<100000000000L)t*=1000;
                return java.time.Instant.ofEpochMilli(t).toString();
            }
            return OffsetDateTime.parse(s).toString();
        } catch(Exception ignored) { return JSONObject.NULL; }
    }
    JSONObject request(String target,String secret,boolean server) throws Exception {
        URL url=new URL(target);
        if(!"https".equals(url.getProtocol()) || url.getUserInfo()!=null || url.getPort()!=-1) throw new Failure("invalid_destination");
        if(server) {
            if(!"hal-dashboard.onrender.com".equals(url.getHost()) || !("/api/upstox/hal".equals(url.getPath()) || "/api/upstox/research".equals(url.getPath()))) throw new Failure("invalid_destination");
        } else {
            String path=url.getPath();
            boolean research=path.equals("/v2/news") || path.equals("/v2/market/status/NSE") || path.matches("/v2/fundamentals/[A-Z0-9]{12}/(profile|income-statement|balance-sheet|cash-flow|share-holdings|key-ratios|corporate-actions|competitors)") || path.matches("/v3/historical-candle/(intraday/)?NSE_(EQ|INDEX)[^/]+/(days|minutes|hours)/(1|15)(/\\d{4}-\\d{2}-\\d{2}/\\d{4}-\\d{2}-\\d{2})?");
            if(!"api.upstox.com".equals(url.getHost()) || !(research || path.equals("/v2/instruments/search") || path.equals("/v2/market-quote/quotes") || path.equals("/v3/market-quote/quotes") || path.equals("/v3/market-quote/option-greek") || path.equals("/v3/feed/market-data-feed/authorize") || path.equals("/v2/option/chain") || path.equals("/v2/option/contract"))) throw new Failure("invalid_destination");
        }
        if(secret.isEmpty()) throw new Failure("credential_missing");
        HttpsURLConnection connection=(HttpsURLConnection)url.openConnection();
        try {
            connection.setRequestMethod("GET"); connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(20000); connection.setReadTimeout(server&&url.getPath().equals("/api/upstox/research")?90000:30000); connection.setUseCaches(false);
            connection.setRequestProperty("Accept","application/json");
            connection.setRequestProperty("User-Agent","HAL-Desk-Android/2.1");
            connection.setRequestProperty(server?"X-HAL-Viewer-Key":"Authorization",server?secret:"Bearer "+secret);
            int status=connection.getResponseCode();
            if(status==401) throw new Failure("token_expired_or_unauthorized");
            if(status==403) throw new Failure(server?"viewer_unauthorized":"upstox_permission_denied");
            if(status==429) throw new Failure("upstox_rate_limited");
            if(status>=300 && status<400) throw new Failure("redirect_blocked");
            InputStream input=status>=400?connection.getErrorStream():connection.getInputStream();
            if(input==null) throw new Failure(server?"server_unavailable":"upstox_request_failed");
            ByteArrayOutputStream output=new ByteArrayOutputStream();
            try(InputStream stream=input) {
                byte[] buffer=new byte[8192];int count;
                while((count=stream.read(buffer))!=-1) {
                    if(output.size()+count>4000000) throw new Failure("response_too_large");
                    output.write(buffer,0,count);
                }
            }
            JSONObject body;
            try { body=new JSONObject(new String(output.toByteArray(),StandardCharsets.UTF_8)); }
            catch(Exception error) { throw new Failure(server?"server_unavailable":"bad_response"); }
            if(status>=400) {
                String code=body.optString("error");
                if(server && (code.equals("token_missing") || code.equals("token_expired_or_unauthorized") || code.equals("expiry_not_listed") || code.equals("upstox_permission_denied") || code.equals("upstox_rate_limited"))) throw new Failure(code);
                throw new Failure(server?"server_unavailable":"upstox_request_failed");
            }
            return body;
        } finally { connection.disconnect(); }
    }
    private Object api(String path,String params,String token) throws Exception {
        JSONObject response=request(API+path+"?"+params,token,false);
        if(!"success".equals(response.optString("status"))) throw new Failure("upstox_request_failed");
        return response.opt("data");
    }
    Object apiData(String path,String params,String token) throws Exception {
        JSONObject response=request("https://api.upstox.com"+path+(params.isEmpty()?"":"?"+params),token,false);
        if(!"success".equals(response.optString("status")))throw new Failure("upstox_request_failed");
        return response.opt("data");
    }
    synchronized String equity(String token) throws Exception {
        if(!underlying.isEmpty())return underlying;
        JSONArray list=array(api("/instruments/search","query=HAL&exchanges=NSE&segments=EQ&records=30&page_number=1",token));
        for(int i=0;i<list.length();i++){JSONObject x=list.optJSONObject(i);if(x!=null&&"HAL".equals(x.optString("trading_symbol"))&&"NSE_EQ".equals(x.optString("segment"))&&x.optString("instrument_key").matches("NSE_EQ\\|[A-Z0-9]{12}")){underlying=x.getString("instrument_key");return underlying;}}
        throw new Failure("no_hal_equity_instrument");
    }
    private JSONArray array(Object object) throws Exception {
        if(!(object instanceof JSONArray)) throw new Failure("bad_response");
        return (JSONArray)object;
    }
    private synchronized void discover(String token) throws Exception {
        if(!underlying.isEmpty() && System.currentTimeMillis()-metadataTime<3600000) return;
        JSONArray equities=array(api("/instruments/search","query=HAL&exchanges=NSE&segments=EQ&records=30&page_number=1",token));
        String found="";
        for(int i=0;i<equities.length();i++) {
            JSONObject item=equities.optJSONObject(i);if(item==null)continue;
            if("HAL".equals(item.optString("trading_symbol")) && "NSE_EQ".equals(item.optString("segment")) && item.optString("instrument_key").startsWith("NSE_EQ|")) found=item.getString("instrument_key");
        }
        if(found.isEmpty()) throw new Failure("no_hal_equity_instrument");
        List<JSONObject> futures=new ArrayList<>();TreeSet<String> keys=new TreeSet<>();
        String today=LocalDate.now(ZoneId.of("Asia/Kolkata")).toString();
        for(int page=1;page<=4;page++) {
            JSONArray data=array(api("/instruments/search","query=HAL&exchanges=NSE&segments=FO&instrument_types=FUT&records=30&page_number="+page,token));
            for(int i=0;i<data.length();i++) {
                JSONObject item=data.optJSONObject(i);if(item==null)continue;
                String expiry=date(item.opt("expiry")),key=item.optString("instrument_key");
                if("HAL".equals(item.optString("underlying_symbol")) && "NSE_FO".equals(item.optString("segment")) && "FUT".equals(item.optString("instrument_type")) && key.startsWith("NSE_FO|") && expiry.compareTo(today)>=0 && keys.add(key)) {
                    JSONObject c=new JSONObject();c.put("instrument_key",key);c.put("expiry",expiry);c.put("lot_size",num(item,"lot_size"));c.put("trading_symbol",item.optString("trading_symbol"));futures.add(c);
                }
            }
            if(data.length()<30)break;
        }
        Collections.sort(futures,Comparator.comparing(c->c.optString("expiry")));
        JSONArray next=new JSONArray();for(int i=0;i<Math.min(6,futures.size());i++)next.put(futures.get(i));
        JSONArray optionContracts=array(api("/option/contract","instrument_key="+enc(found),token));
        underlying=found;contracts=next;options=optionContracts;metadataTime=System.currentTimeMillis();
    }
    private static JSONObject quote(JSONObject quotes,String key) throws Exception {
        JSONObject raw=null;
        for(Iterator<String> it=quotes.keys();it.hasNext();) {
            JSONObject item=quotes.optJSONObject(it.next());
            if(item!=null && key.equals(item.optString("instrument_token"))) { raw=item;break; }
        }
        if(raw==null)return null;
        JSONObject q=new JSONObject(),ohlc=raw.optJSONObject("ohlc");
        q.put("last_price",num(raw,"last_price"));q.put("volume",num(raw,"volume"));q.put("open_interest",num(raw,"oi"));
        q.put("prev_close",raw.has("prev_close_price")?num(raw,"prev_close_price"):num(ohlc,"close"));
         q.put("previous_oi",num(raw,"previous_oi"));q.put("year_high",num(raw,"year_high"));q.put("year_low",num(raw,"year_low"));
         q.put("total_buy_quantity",num(raw,"total_buy_quantity"));q.put("total_sell_quantity",num(raw,"total_sell_quantity"));
         for(String f:new String[]{"open","high","low"})q.put(f,num(ohlc,f));
        JSONObject depth=raw.optJSONObject("depth");
        JSONArray buy=depth==null?null:depth.optJSONArray("buy"),sell=depth==null?null:depth.optJSONArray("sell");
        q.put("bid",num(buy==null?null:buy.optJSONObject(0),"price"));q.put("ask",num(sell==null?null:sell.optJSONObject(0),"price"));
        q.put("bid_quantity",num(buy==null?null:buy.optJSONObject(0),"quantity"));q.put("ask_quantity",num(sell==null?null:sell.optJSONObject(0),"quantity"));
        q.put("quote_as_of",time(raw.opt("timestamp")));q.put("last_trade_at",time(raw.opt("last_trade_time")));return q;
    }
    private static JSONObject option(JSONObject raw) throws Exception {
        if(raw==null)return null;
        JSONObject data=raw.optJSONObject("market_data"),greeks=raw.optJSONObject("option_greeks"),o=new JSONObject();
        for(String f:new String[]{"ltp","volume","oi","prev_oi"})o.put(f,num(data,f));
        o.put("bid",num(data,"bid_price"));o.put("ask",num(data,"ask_price"));o.put("instrument_key",raw.optString("instrument_key"));
        for(String f:new String[]{"iv","delta","gamma","theta","vega"})o.put(f,num(greeks,f));
        if(o.isNull("iv"))o.put("iv",num(data,"iv"));return o;
    }
    JSONObject load(String mode,String secret,String expiry) throws Exception {
        if(!expiry.isEmpty()) { try { LocalDate.parse(expiry); }catch(Exception e){throw new Failure("invalid_expiry");} }
        if("server".equals(mode)) {
            JSONObject data=request(SERVER+"/api/upstox/hal"+(expiry.isEmpty()?"":"?expiry="+enc(expiry)),secret,true);
            if(data.optJSONObject("spot")==null || data.optJSONArray("futures")==null)throw new Failure("bad_response");
            data.put("connection_mode","server");return data;
        }
        discover(secret);
        TreeSet<String> dates=new TreeSet<>();String today=LocalDate.now(ZoneId.of("Asia/Kolkata")).toString();
        for(int i=0;i<options.length();i++) {
            JSONObject option=options.optJSONObject(i);if(option==null)continue;
            String d=date(option.opt("expiry"));
            if(d.compareTo(today)>=0 && (underlying.equals(option.optString("underlying_key")) || "HAL".equals(option.optString("underlying_symbol"))))dates.add(d);
        }
        if(dates.isEmpty())throw new Failure("no_hal_option_contracts");
        String selected=expiry.isEmpty()?dates.first():expiry;if(!dates.contains(selected))throw new Failure("expiry_not_listed");
        StringBuilder instrumentKeys=new StringBuilder(underlying);
        for(int i=0;i<contracts.length();i++)instrumentKeys.append(",").append(contracts.getJSONObject(i).getString("instrument_key"));
        Object qData=api("/market-quote/quotes","instrument_key="+enc(instrumentKeys.toString()),secret);
        if(!(qData instanceof JSONObject))throw new Failure("bad_response");
        JSONObject quotes=(JSONObject)qData,spot=quote(quotes,underlying);
        if(spot==null || spot.optDouble("last_price",0)<=0)throw new Failure("no_hal_spot_quote");
        JSONArray futures=new JSONArray();
        for(int i=0;i<contracts.length();i++) {
            JSONObject c=new JSONObject(contracts.getJSONObject(i).toString());c.put("quote",quote(quotes,c.getString("instrument_key")));futures.put(c);
        }
        JSONArray rows=new JSONArray();String chainError="";
        try {
            JSONArray chain=array(api("/option/chain","instrument_key="+enc(underlying)+"&expiry_date="+enc(selected),secret));
            List<JSONObject> sorted=new ArrayList<>();
            for(int i=0;i<chain.length();i++) {
                JSONObject item=chain.optJSONObject(i);if(item==null || !selected.equals(item.optString("expiry")) || item.optDouble("strike_price",0)<=0)continue;
                JSONObject row=new JSONObject();row.put("strike",item.getDouble("strike_price"));row.put("call",option(item.optJSONObject("call_options")));row.put("put",option(item.optJSONObject("put_options")));
                sorted.add(row);
            }
            Collections.sort(sorted,Comparator.comparingDouble(c->c.optDouble("strike")));
            for(JSONObject row:sorted)rows.put(row);
        }catch(Failure error) {
            if(error.code.equals("token_expired_or_unauthorized"))throw error;
            chainError=error.code;
        }
        // Contract-specific option lot sizes are retained; never assume they equal futures lots.
        for(int i=0;i<rows.length();i++) {
            JSONObject row=rows.getJSONObject(i);
            for(String side:new String[]{"call","put"}) {
                JSONObject o=row.optJSONObject(side);if(o==null)continue;
                for(int j=0;j<options.length();j++) {
                    JSONObject c=options.optJSONObject(j);if(c!=null && c.optString("instrument_key").equals(o.optString("instrument_key")) && selected.equals(date(c.opt("expiry"))) && c.optDouble("strike_price",0)==row.optDouble("strike") && (underlying.equals(c.optString("underlying_key")) || "HAL".equals(c.optString("underlying_symbol"))) && (side.equals("put")?"PE":"CE").equals(c.optString("instrument_type"))) {o.put("lot_size",num(c,"lot_size"));break;}
                }
            }
        }
        JSONObject result=new JSONObject();result.put("source","Upstox market data V2");result.put("symbol","HAL");
        result.put("connection_mode","direct");result.put("fetched_at_iso",OffsetDateTime.now().toString());result.put("cache_status","fresh_fetch");
        result.put("spot",spot);result.put("futures",futures);result.put("available_expiries",new JSONArray(dates));
        result.put("option_expiry",selected);result.put("option_rows",rows);result.put("chain_error",chainError);return result;
    }
    /** Fixed read-only WebSocket instruments, resolved from official Upstox metadata.
     * No arbitrary WebView-supplied instrument keys and no user account APIs.
     */
    synchronized JSONArray streamKeys(String token) throws Exception {
        discover(token);
        JSONArray keys=new JSONArray();
        keys.put(underlying);
        for(int i=0;i<Math.min(2,contracts.length());i++){
            JSONObject fut=contracts.optJSONObject(i);
            if(fut!=null && fut.optString("instrument_key").matches("NSE_FO\\|[A-Za-z0-9]+"))
                keys.put(fut.optString("instrument_key"));
        }
        keys.put("NSE_INDEX|Nifty 50");
        keys.put("NSE_INDEX|India VIX");
        return keys;
    }
    synchronized JSONObject streamAuthorize(String token) throws Exception {
        Object data=apiData("/v3/feed/market-data-feed/authorize","",token);
        if(!(data instanceof JSONObject)) throw new Failure("bad_response");
        return (JSONObject)data;
    }
    synchronized JSONObject derivativeParticipation(String token) throws Exception {
        // Additional strictly read-only V3 quote enrichment. This never substitutes for the
        // verified-contract marks used by the existing P&L and hedge engines.
        discover(token);
        JSONArray entries=new JSONArray();
        if(contracts.length()==0)throw new Failure("no_hal_futures_contracts");
        StringBuilder keys=new StringBuilder();
        for(int i=0;i<contracts.length();i++) {
            if(keys.length()>0) keys.append(",");
            keys.append(contracts.getJSONObject(i).getString("instrument_key"));
        }
        Object raw=apiData("/v3/market-quote/quotes","instrument_key="+enc(keys.toString()),token);
        if(!(raw instanceof JSONObject))throw new Failure("bad_response");
        JSONObject source=(JSONObject)raw;
        for(int i=0;i<contracts.length();i++) {
            JSONObject c=contracts.getJSONObject(i),item=new JSONObject();
            item.put("expiry",c.getString("expiry"));
            item.put("instrument_key",c.getString("instrument_key"));
            item.put("trading_symbol",c.optString("trading_symbol"));
            item.put("lot_size",num(c,"lot_size"));
            item.put("quote",quote(source,c.getString("instrument_key")));
            entries.put(item);
        }
        JSONObject result=new JSONObject();
        result.put("futures",entries);
        result.put("coverage","Listed HAL futures; additional V3 quote evidence, not portfolio marks or an order-flow forecast.");
        return result;
    }
    /** Read-only V3 Greeks for at most twelve user-recorded put strikes in one listed expiry.
     * Contract keys come ONLY from Upstox metadata; the UI cannot choose arbitrary keys.
     * V3 returns no individual quote/Greek timestamp, so it is NOT a new P&L mark.
     */
    synchronized JSONObject heldPutGreeks(String token,String expiry,JSONArray strikeHints) throws Exception {
        LocalDate target;
        try { target=LocalDate.parse(expiry); } catch(Exception ex){throw new Failure("invalid_expiry");}
        if(target.isBefore(LocalDate.now(ZoneId.of("Asia/Kolkata"))))throw new Failure("expiry_not_listed");
        if(strikeHints==null || strikeHints.length()<1 || strikeHints.length()>12)throw new Failure("invalid_contract_hints");
        TreeSet<Double> strikes=new TreeSet<>();
        for(int i=0;i<strikeHints.length();i++){
            Object value=strikeHints.opt(i);
            if(!(value instanceof Number))throw new Failure("invalid_contract_hints");
            double strike=((Number)value).doubleValue();
            if(!Double.isFinite(strike)||strike<=0||strike>1000000)throw new Failure("invalid_contract_hints");
            strikes.add(strike);
        }
        discover(token);
        ArrayList<JSONObject> matched=new ArrayList<>();TreeSet<Double> remaining=new TreeSet<>(strikes);
        StringBuilder keys=new StringBuilder();
        for(int i=0;i<options.length();i++){
            JSONObject c=options.optJSONObject(i);
            if(c==null)continue;
            String contractKey=c.optString("instrument_key");
            double strike=c.optDouble("strike_price",Double.NaN);
            if(!target.toString().equals(date(c.opt("expiry"))) || !"PE".equals(c.optString("instrument_type"))
               || !"NSE_FO".equals(c.optString("segment")) || !contractKey.matches("NSE_FO\\|[A-Za-z0-9]+")
               || !(underlying.equals(c.optString("underlying_key")) || "HAL".equals(c.optString("underlying_symbol")))
               || !remaining.contains(strike))continue;
            JSONObject m=new JSONObject();
            m.put("strike",strike);m.put("instrument_key",contractKey);m.put("lot_size",num(c,"lot_size"));
            matched.add(m);remaining.remove(strike);
            if(keys.length()>0)keys.append(",");
            keys.append(contractKey);
        }
        JSONObject response=new JSONObject(),values=new JSONObject();
        if(keys.length()>0){
            Object raw=apiData("/v3/market-quote/option-greek","instrument_key="+enc(keys.toString()),token);
            if(!(raw instanceof JSONObject))throw new Failure("bad_response");
            values=(JSONObject)raw;
        }
        JSONArray greeks=new JSONArray();
        for(JSONObject contract:matched){
            JSONObject row=new JSONObject(contract.toString());
            JSONObject raw=null;
            for(Iterator<String> it=values.keys();it.hasNext();){
                JSONObject q=values.optJSONObject(it.next());
                if(q!=null && contract.getString("instrument_key").equals(q.optString("instrument_token"))) {
                    raw=q;break;
                }
            }
            // Never turn a missing contract response into zero exposure.
            if(raw!=null){
                for(String field:new String[]{"delta","gamma","theta","vega","iv","last_price","oi","volume"})
                    row.put(field,num(raw,field));
                row.put("has_greeks",true);
            } else row.put("has_greeks",false);
            greeks.put(row);
        }
        response.put("expiry",expiry);response.put("contracts",greeks);
        response.put("requested_count",strikes.size());response.put("matched_count",matched.size());
        response.put("returned_count",greeks.length()-countMissingGreeks(greeks));
        response.put("not_found_count",remaining.size());
        response.put("source","Upstox V3 option-greek GET; provider row timestamps unavailable");
        response.put("iv_unit","fraction"); // e.g. 0.335 = 33.5%, unlike chain IV percent.
        return response;
    }
    private static int countMissingGreeks(JSONArray rows){
        int missing=0;
        for(int i=0;i<rows.length();i++) if(!rows.optJSONObject(i).optBoolean("has_greeks"))missing++;
        return missing;
    }
    JSONObject hedgeSnapshot(String token,String expiry) throws Exception {
        JSONObject result=load("direct",token,expiry);
        if(!result.optString("chain_error").isEmpty())throw new Failure(result.optString("chain_error"));
        JSONArray rows=result.getJSONArray("option_rows");List<JSONObject> puts=new ArrayList<>();
        for(int i=0;i<rows.length();i++){
            JSONObject put=rows.getJSONObject(i).optJSONObject("put");
            // Only keys matched to HAL PE contract metadata by load() may be quoted.
            if(put!=null && put.optString("instrument_key").matches("NSE_FO\\|[A-Za-z0-9]+") && put.optInt("lot_size",0)>0)puts.add(put);
        }
        for(int start=0;start<puts.size();start+=100){
            StringBuilder keys=new StringBuilder();int end=Math.min(start+100,puts.size());
            for(int i=start;i<end;i++){if(keys.length()>0)keys.append(',');keys.append(puts.get(i).getString("instrument_key"));}
            Object raw=api("/market-quote/quotes","instrument_key="+enc(keys.toString()),token);
            if(!(raw instanceof JSONObject))throw new Failure("bad_response");
            for(int i=start;i<end;i++)puts.get(i).put("quote",quote((JSONObject)raw,puts.get(i).getString("instrument_key")));
        }
        result.put("quotes_fetched_at",OffsetDateTime.now().toString());
        result.put("source","Upstox HAL option chain + full market quotes (read-only)");return result;
    }
}
