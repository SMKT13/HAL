package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Direct, read-only NSE MCP client. Isolated from Upstox, trading instruments, and
 * all portfolio marks. Uses only NSE's published Streamable HTTP hosts and tools.
 * NSE MCP data is delayed and for personal informational / educational use.
 */
final class NseMcpClient {
    static final String CASH_URL = "https://mcp.nseindia.in/cmmkt/mcp";
    static final String HISTORY_URL = "https://mcp.nseindia.in/bhavcopy/cm/mcp";
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter NSE_CLOCK = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int LIMIT = 900_000;
    static final class Failure extends Exception {
        final String code;
        Failure(String code){super(code);this.code=code;}
    }

    private static JSONObject obj(String key,Object val)throws Exception {
        return new JSONObject().put(key,val);
    }
    private static JSONObject args(Object... pairs)throws Exception {
        JSONObject o=new JSONObject();
        for(int i=0;i<pairs.length;i+=2)o.put((String)pairs[i],pairs[i+1]);
        return o;
    }
    private static boolean finitePositive(double v){return !Double.isNaN(v)&&!Double.isInfinite(v)&&v>0;}
    private static JSONObject asObject(Object value)throws Failure {
        if(value instanceof JSONObject)return (JSONObject)value;
        throw new Failure("nse_schema_mismatch");
    }
    private static Double positiveNumber(Object value) {
        try {
            double d=Double.parseDouble(String.valueOf(value));
            return finitePositive(d)?d:null;
        } catch(Exception ignored){return null;}
    }
    static Instant exchangeTime(String time)throws Failure {
        if(time==null||time.isEmpty())throw new Failure("nse_quote_time_missing");
        try {
            Instant instant=LocalDateTime.parse(time,NSE_CLOCK).atZone(IST).toInstant();
            if(instant.isAfter(Instant.now().plusSeconds(120)))throw new Failure("nse_quote_future");
            return instant;
        } catch(Failure f){throw f;}
        catch(Exception e){throw new Failure("nse_quote_time_invalid");}
    }
    static JSONObject validateStock(JSONObject source)throws Exception {
        JSONObject stock=source.optJSONObject("stock");
        if(stock==null||!"HAL".equals(stock.optString("symbol"))||!"EQ".equals(stock.optString("series")))
            throw new Failure("nse_wrong_instrument");
        Double price=positiveNumber(stock.opt("lastTradedPrice"));
        if(price==null)throw new Failure("nse_quote_invalid");
        Instant asOf=exchangeTime(stock.optString("latestTimestamp"));
        JSONObject out=new JSONObject(stock.toString());
        out.put("exchange_time_ist",stock.getString("latestTimestamp"));
        out.put("exchange_time_iso",asOf.toString());
        out.put("provider_retrieved_at",source.optString("updatedAt",""));
        ZonedDateTime current=ZonedDateTime.now(IST);
        boolean open=current.getDayOfWeek().getValue()<=5 &&
            !current.toLocalTime().isBefore(java.time.LocalTime.of(9,15)) &&
            current.toLocalTime().isBefore(java.time.LocalTime.of(15,30));
        out.put("session_in_progress",open);
        out.put("quote_stale",open&&asOf.isBefore(Instant.now().minusSeconds(600)));
        out.put("source","NSE CM MCP · HAL EQ");
        return out;
    }

    /**
     * Streamable HTTP JSON-RPC session. Never follows redirects, sends credentials,
     * accepts arbitrary hosts, or exposes an open proxy to JavaScript.
     */
    private static final class Session {
        final String url;
        final AtomicInteger requestId=new AtomicInteger();
        String sessionId="";
        String protocol="2025-03-26";
        Session(String target)throws Exception {
            if(!CASH_URL.equals(target)&&!HISTORY_URL.equals(target))throw new Failure("nse_destination_rejected");
            url=target;
            JSONObject result=rpc("initialize",args("protocolVersion",protocol,
                "capabilities",new JSONObject(),
                "clientInfo",args("name","HAL-Desk-Android","version","4.3.0")),false);
            if(result==null)throw new Failure("nse_handshake_failed");
            protocol=result.optString("protocolVersion",protocol);
            if(!protocol.matches("20[0-9]{2}-[0-9]{2}-[0-9]{2}"))throw new Failure("nse_protocol_rejected");
            rpc("notifications/initialized",new JSONObject(),true);
        }
        Object tool(String name,JSONObject parameters)throws Exception {
            if(!name.matches("[a-zA-Z0-9_]{1,60}"))throw new Failure("nse_tool_rejected");
            JSONObject response=rpc("tools/call",args("name",name,"arguments",parameters),false);
            if(response==null||response.optBoolean("isError"))throw new Failure("nse_tool_failed");
            Object structured=response.opt("structuredContent");
            if(structured instanceof JSONObject)return structured;
            JSONArray content=response.optJSONArray("content");
            if(content==null)throw new Failure("nse_content_missing");
            for(int i=0;i<content.length();i++){
                JSONObject part=content.optJSONObject(i);
                if(part==null||!"text".equals(part.optString("type")))continue;
                String text=part.optString("text","").trim();
                try {return new JSONTokener(text).nextValue();}
                catch(Exception ignored){return text;}
            }
            throw new Failure("nse_content_missing");
        }
        private JSONObject rpc(String method,JSONObject params,boolean notification)throws Exception {
            if(Thread.currentThread().isInterrupted())throw new Failure("nse_cancelled");
            int id=requestId.incrementAndGet();
            JSONObject body=args("jsonrpc","2.0","method",method,"params",params);
            if(!notification)body.put("id",id);
            URL parsed=new URL(url);
            if(!"https".equals(parsed.getProtocol())||!"mcp.nseindia.in".equals(parsed.getHost())
                    ||parsed.getPort()!=-1||parsed.getUserInfo()!=null)
                throw new Failure("nse_destination_rejected");
            HttpURLConnection c=null;
            try {
                c=(HttpURLConnection)parsed.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setRequestMethod("POST");c.setDoOutput(true);
                c.setConnectTimeout(12000);c.setReadTimeout(17000);
                c.setRequestProperty("Content-Type","application/json");
                c.setRequestProperty("Accept","application/json, text/event-stream");
                c.setRequestProperty("MCP-Protocol-Version",protocol);
                if(!sessionId.isEmpty())c.setRequestProperty("Mcp-Session-Id",sessionId);
                byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
                c.setFixedLengthStreamingMode(bytes.length);
                try(OutputStream out=c.getOutputStream()){out.write(bytes);}
                int status=c.getResponseCode();
                if(status<200||status>=300)throw new Failure(status==429?"nse_rate_limited":
                    status==401||status==403?"nse_access_denied":"nse_http_error");
                String newSession=c.getHeaderField("Mcp-Session-Id");
                if(newSession!=null&&!newSession.isEmpty()&&newSession.length()<256)sessionId=newSession;
                if(notification)return null;
                String type=String.valueOf(c.getContentType()).toLowerCase(java.util.Locale.ROOT);
                JSONObject envelope;
                try(InputStream in=c.getInputStream()){
                    envelope=readResponse(in,type,id);
                }
                if(envelope==null)throw new Failure("nse_response_missing");
                if(envelope.has("error"))throw new Failure("nse_rpc_error");
                Object result=envelope.opt("result");
                if(!(result instanceof JSONObject))throw new Failure("nse_schema_mismatch");
                return (JSONObject)result;
            } catch(Failure f){throw f;}
            catch(Exception e){if(Thread.currentThread().isInterrupted())throw new Failure("nse_cancelled");throw new Failure("nse_unavailable");}
            finally{if(c!=null)c.disconnect();}
        }
    }

    /** Both JSON and SSE response formats are legal MCP transports. */
    static JSONObject readResponse(InputStream in,String contentType,int requestedId)throws Exception {
        BufferedReader reader=new BufferedReader(new InputStreamReader(in,StandardCharsets.UTF_8));
        StringBuilder data=new StringBuilder();
        String line;int length=0;
        boolean sse=contentType!=null&&contentType.contains("text/event-stream");
        while((line=reader.readLine())!=null){
            length+=line.length()+1;
            if(length>LIMIT)throw new Failure("nse_response_too_large");
            if(Thread.currentThread().isInterrupted())throw new Failure("nse_cancelled");
            if(!sse){data.append(line);continue;}
            if(line.startsWith("data:"))data.append(line.substring(5).trim());
            if(line.isEmpty()&&data.length()>0){
                JSONObject o=matchResponse(data.toString(),requestedId);
                if(o!=null)return o;
                data.setLength(0);
            }
        }
        return matchResponse(data.toString(),requestedId);
    }
    private static JSONObject matchResponse(String raw,int id)throws Exception {
        if(raw==null||raw.trim().isEmpty())return null;
        JSONObject parsed=new JSONObject(raw.trim());
        return parsed.optInt("id",Integer.MIN_VALUE)==id?parsed:null;
    }
    private static void optional(Session server,JSONObject dst,JSONArray issues,
            String key,String tool,JSONObject parameters) {
        try { Object result=server.tool(tool,parameters);dst.put(key,result); }
        catch(Exception e){issues.put(key+":"+(e instanceof Failure?((Failure)e).code:"unavailable"));}
    }
    static JSONObject technicalLevels(JSONObject history)throws Exception {
        JSONArray data=history.optJSONArray("data");
        if(data==null||data.length()<5)throw new Failure("nse_history_incomplete");
        double lo5=Double.POSITIVE_INFINITY,hi5=0,lo20=Double.POSITIVE_INFINITY,hi20=0;
        int count=0;JSONObject last=null;
        for(int i=data.length()-1;i>=0&&count<20;i--){
            JSONObject row=data.optJSONObject(i);
            if(row==null||!"HAL".equals(row.optString("symbol")))continue;
            Double lo=positiveNumber(row.opt("low")),hi=positiveNumber(row.opt("high")),
                   close=positiveNumber(row.opt("close"));
            if(lo==null||hi==null||close==null||lo>hi||close<lo||close>hi)continue;
            if(last==null)last=row;
            lo20=Math.min(lo20,lo);hi20=Math.max(hi20,hi);
            if(count<5){lo5=Math.min(lo5,lo);hi5=Math.max(hi5,hi);}
            count++;
        }
        if(last==null||count<5)throw new Failure("nse_history_incomplete");
        Double h=positiveNumber(last.opt("high")),l=positiveNumber(last.opt("low")),c=positiveNumber(last.opt("close"));
        double pivot=(h+l+c)/3.0;
        return args("as_of",last.optString("date"),"trading_days",count,
            "low_5",lo5,"high_5",hi5,"low_20",lo20,"high_20",hi20,
            "pivot",pivot,"s1",2*pivot-h,"r1",2*pivot-l,
            "calculation","Unadjusted NSE completed daily bars. Zones are observations, not trading signals.");
    }
    JSONObject load()throws Exception {
        JSONObject result=args("source","NSE official MCP (personal research only)",
            "retrieved_at",Instant.now().toString(),
            "live",new JSONObject(),"historical",new JSONObject(),
            "errors",new JSONArray());
        JSONObject live=result.getJSONObject("live"),history=result.getJSONObject("historical");
        JSONArray errors=result.getJSONArray("errors");
        try {
            Session cash=new Session(CASH_URL);
            Object raw=cash.tool("cm_get_stock_quote",obj("symbol","HAL"));
            live.put("stock",validateStock(asObject(raw)));
            optional(cash,live,errors,"nifty50","cm_get_index_quote",obj("indexName","NIFTY 50"));
            optional(cash,live,errors,"india_vix","cm_get_index_quote",obj("indexName","INDIA VIX"));
        }catch(Exception e){errors.put("live:"+(e instanceof Failure?((Failure)e).code:"nse_unavailable"));}
        if(Thread.currentThread().isInterrupted())throw new Failure("nse_cancelled");
        try {
            Session bhav=new Session(HISTORY_URL);
            for(int days:new int[]{20,50,200})
                optional(bhav,history,errors,"sma"+days,"moving_average",args("symbol","HAL","days",days));
            optional(bhav,history,errors,"volume","get_volume_analysis",args("symbol","HAL","days",30));
            try{
                JSONObject candles=asObject(bhav.tool("get_stock_history",
                    args("symbol","HAL","months",3,"endDate","today")));
                history.put("levels",technicalLevels(candles));
                history.put("history_as_of",candles.optString("to_date"));
                history.put("trading_days_available",candles.optInt("trading_days"));
            }catch(Exception e){errors.put("levels:"+(e instanceof Failure?((Failure)e).code:"unavailable"));}
            LocalDate today=LocalDate.now(IST);
            optional(bhav,history,errors,"corporate_actions","get_corporate_actions",
                args("symbol","HAL","fromDate",today.minusYears(1).toString(),"toDate",today.toString()));
            optional(bhav,history,errors,"breadth","get_market_breadth",obj("date",today.toString()));
        }catch(Exception e){errors.put("historical:"+(e instanceof Failure?((Failure)e).code:"nse_unavailable"));}
        if(!live.has("stock")&&!history.has("levels")&&!history.has("sma20"))
            throw new Failure("nse_all_sources_unavailable");
        result.put("retrieved_at",Instant.now().toString());
        return result;
    }
}
