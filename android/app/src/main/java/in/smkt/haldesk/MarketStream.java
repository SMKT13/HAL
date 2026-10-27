package in.smkt.haldesk;

import org.json.JSONArray;
import org.json.JSONObject;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

/**
 * Upstox WebSocket V3 **transport** only; intentionally does NOT interpret Protobuf
 * frames as quote or Greeks values until the official V3 proto decoder is bundled.
 * One user-initiated foreground connection; no retries or background subscriptions.
 */
final class MarketStream {
    interface Sink { void publish(JSONObject status); }
    private final OkHttpClient client=new OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS).pingInterval(25,TimeUnit.SECONDS).build();
    private final Sink sink;
    private WebSocket socket;
    private long generation=0, messages=0, lastStatus=0;
    private boolean enabled=false;
    MarketStream(Sink sink){this.sink=sink;}
    private static JSONObject status(String state,long frames,int keys) {
        JSONObject s=new JSONObject();
        try {s.put("state",state);s.put("frames",frames);s.put("instruments",keys);
             s.put("at",System.currentTimeMillis());s.put("decoded",false);}
        catch(Exception ignored){}
        return s;
    }
    private static String safeFailure(Exception error) {
        // Never emit full URI (single-use auth code), token, network error message or stacktrace.
        return "stream_connection_failed";
    }
    private void announce(String state,int count){
        sink.publish(status(state,messages,count));
    }
    private static URI validateEndpoint(String raw) throws Exception {
        if(raw==null||raw.length()>2048)throw new MarketClient.Failure("stream_authorization_failed");
        URI uri=new URI(raw);
        String host=uri.getHost(),path=uri.getPath();
        if(!"wss".equals(uri.getScheme()) || uri.getUserInfo()!=null ||
           (uri.getPort()!=-1&&uri.getPort()!=443) || host==null ||
           !host.endsWith(".upstox.com") || path==null ||
           !path.startsWith("/market-data-feeder/v3/") || uri.getFragment()!=null)
            throw new MarketClient.Failure("stream_authorization_failed");
        return uri;
    }
    synchronized boolean isEnabled(){return enabled;}
    void start(MarketClient market,String token) {
        final long id;
        synchronized(this){
            if(enabled)return;
            enabled=true;id=++generation;messages=0;lastStatus=0;
        }
        sink.publish(status("authorizing",0,0));
        try {
            JSONArray keys=market.streamKeys(token);
            if(keys.length()==0||keys.length()>5)throw new MarketClient.Failure("invalid_stream_keys");
            JSONObject auth=market.streamAuthorize(token);
            URI endpoint=validateEndpoint(auth.optString("authorized_redirect_uri"));
            synchronized(this){if(!enabled||id!=generation)return;}
            JSONObject subscribe=new JSONObject(),data=new JSONObject();
            data.put("mode","ltpc");
            data.put("instrumentKeys",keys);
            subscribe.put("guid","hal-"+id+"-"+System.currentTimeMillis());
            subscribe.put("method","sub");subscribe.put("data",data);
            final ByteString wire=ByteString.of(subscribe.toString().getBytes(StandardCharsets.UTF_8));
            Request req=new Request.Builder().url(endpoint.toString())
                .header("Accept","*/*").build();
            WebSocket connection=client.newWebSocket(req,new WebSocketListener(){
                @Override public void onOpen(WebSocket ws,Response response){
                    synchronized(MarketStream.this){
                        if(!enabled||id!=generation){ws.close(1000,"Stopped");return;}
                        socket=ws;
                    }
                    if(!ws.send(wire)){
                        ws.close(1001,"Unable to subscribe");
                        synchronized(MarketStream.this){if(id==generation){enabled=false;announce("subscription_failed",keys.length());}}
                        return;
                    }
                    synchronized(MarketStream.this){if(id==generation)announce("subscribed_transport_only",keys.length());}
                }
                @Override public void onMessage(WebSocket ws,ByteString bytes){
                    synchronized(MarketStream.this){
                        if(!enabled||id!=generation)return;
                        messages++;
                        // Binary Protobuf must NOT be passed to JavaScript or used as JSON.
                        // Throttle UI so fast ticks cannot saturate WebView.
                        long now=System.currentTimeMillis();
                        if(now-lastStatus>=2000){lastStatus=now;announce("binary_frames_received",keys.length());}
                    }
                }
                @Override public void onMessage(WebSocket ws,String text){
                    // V3 market-data feed specifies binary Protobuf. Text is never a price.
                    synchronized(MarketStream.this){
                        if(enabled&&id==generation)announce("unexpected_text_frame",keys.length());
                    }
                }
                @Override public void onFailure(WebSocket ws,Throwable error,Response response){
                    synchronized(MarketStream.this){
                        if(id!=generation)return;
                        enabled=false;socket=null;announce("connection_failed",keys.length());
                    }
                }
                @Override public void onClosed(WebSocket ws,int code,String reason){
                    synchronized(MarketStream.this){
                        if(id!=generation)return;
                        enabled=false;socket=null;announce("stopped",keys.length());
                    }
                }
            });
            synchronized(this){
                if(enabled&&id==generation)socket=connection;
                else connection.close(1000,"Stopped");
            }
        }catch(Exception error){
            synchronized(this){
                if(id==generation){enabled=false;announce(error instanceof MarketClient.Failure?
                    ((MarketClient.Failure)error).code:safeFailure(error),0);}
            }
        }
    }
    synchronized void stop(){
        generation++;enabled=false;
        WebSocket old=socket;socket=null;messages=0;
        if(old!=null)old.close(1000,"Stopped");
        sink.publish(status("stopped",0,0));
    }
    synchronized void shutdown(){
        stop();
        client.dispatcher().executorService().shutdown();
        client.connectionPool().evictAll();
    }
}
