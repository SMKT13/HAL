package in.smkt.haldesk;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.RadioButton;
import android.widget.RadioGroup;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

public final class MainActivity extends Activity {
    private WebView web;
    private SecretStore secrets;
    private SharedPreferences prefs;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final ExecutorService researchExecutor=Executors.newFixedThreadPool(2);
    private final ExecutorService aiExecutor=Executors.newFixedThreadPool(2);
    private final AtomicReference<Object> aiWorking=new AtomicReference<>();
    private volatile int aiGeneration=0;
    private final ConcurrentHashMap<String,Long> researchRequests=new ConcurrentHashMap<>();
    private byte[] pendingExport;
    private final AtomicBoolean working=new AtomicBoolean(false);
    private volatile MarketClient client=new MarketClient();
    private volatile int generation=0;
    private volatile long lastRequest=0;
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    private boolean pageReady=false;
    private boolean settingsShowing=false;
    private boolean aiSettingsShowing=false;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        secrets=new SecretStore(this);prefs=getSharedPreferences("connection",MODE_PRIVATE);
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(11,16,32));
        root.setOnApplyWindowInsetsListener((view,insets)->{ view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom()); return insets.consumeSystemWindowInsets(); });
        web=new WebView(this);web.setBackgroundColor(Color.rgb(11,16,32));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Bridge(),"HALNative");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                String url=request.getUrl().toString();String asset="";String mime="text/plain";
                if(url.equals(ORIGIN+"index.html")){asset="index.html";mime="text/html";}
                if(url.equals(ORIGIN+"app.js")){asset="app.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"ai-ui.js")){asset="ai-ui.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"core.js")){asset="core.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"analytics.js")){asset="analytics.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"hedge.js")){asset="hedge.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"hedge-ui.js")){asset="hedge-ui.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"charts.js")){asset="charts.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"lightweight-charts.js")){asset="lightweight-charts.js";mime="application/javascript";}
                if(url.equals(ORIGIN+"style.css")){asset="style.css";mime="text/css";}
                try { if(!asset.isEmpty())return new WebResourceResponse(mime,"UTF-8",getAssets().open(asset)); }
                catch(Exception ignored) { }
                return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
            }
        });
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);web.loadUrl(ORIGIN+"index.html");
    }
    private void send(String event,JSONObject data) {
        final String script="window.HALApp && window.HALApp.receive("+JSONObject.quote(event)+","+data.toString().replace("\u2028","\\u2028").replace("\u2029","\\u2029")+");";
        runOnUiThread(()->{if(!isFinishing() && !isDestroyed() && pageReady)web.evaluateJavascript(script,null);});
    }
    private JSONObject object(String key,Object value) {
        JSONObject obj=new JSONObject();try{obj.put(key,value);}catch(Exception ignored){}return obj;
    }
    private String mode(){return prefs.getString("mode","direct");}
    private void status() {
        JSONObject obj=new JSONObject();try{obj.put("mode",mode());obj.put("configured",secrets.has(mode()));obj.put("version","2.2");}catch(Exception ignored){}
        send("connection",obj);
        aiStatus();
    }
    private void aiStatus() {
        JSONObject data=object("configured",secrets.has("ai_viewer"));
        try { data.put("origin",prefs.getString("ai_origin",MarketClient.SERVER)); } catch(Exception ignored) {}
        send("ai_connection",data);
    }
    private void aiRequest(String request, boolean config) {
        if(request==null || request.length()>128000)return;
        final JSONObject args;
        try { args=new JSONObject(request); } catch(Exception error) { return; }
        final String id=args.optString("id"),selectedMode=config?null:args.optString("mode");
        if(!id.matches("[A-Za-z0-9_-]{1,80}"))return;
        final JSONObject payload=new JSONObject();
        try {
            AiEndpoint.target(prefs.getString("ai_origin",MarketClient.SERVER),selectedMode);
            if(!config) {
                if(!Boolean.TRUE.equals(args.opt("consent")))throw new Exception("Confirm sharing this request with Gemini.");
                String message=args.optString("message","").trim();
                if(message.length()>2000 || (!"deliberate".equals(selectedMode)&&message.isEmpty()))throw new Exception("Enter a question of up to 2,000 characters.");
                payload.put("consent",true);payload.put("message",message);
                if(!"research".equals(selectedMode)) {
                    JSONObject source=args.optJSONObject("book");
                    if(source==null || source.optJSONArray("legs")==null || source.getJSONArray("legs").length()>12)throw new Exception("Review the saved position book first.");
                    JSONObject clean=new JSONObject();
                    for(String key:new String[]{"version","legs","journal","funding","hedge","preferences","legacy"})if(source.has(key))clean.put(key,source.get(key));
                    clean.put("notes",new JSONArray());clean.put("bookmarks",new JSONArray());
                    JSONArray journal=clean.optJSONArray("journal");if(journal!=null)for(int i=0;i<journal.length();i++){JSONObject entry=journal.optJSONObject(i);if(entry!=null)entry.remove("note");}
                    JSONObject legacy=clean.optJSONObject("legacy");if(legacy!=null)legacy.put("journal",new JSONArray());
                    payload.put("book",clean);
                }
            }
            // Runs on the UI thread, as do credential updates: capture the host and key together.
            final String origin=prefs.getString("ai_origin",MarketClient.SERVER),credential=secrets.get("ai_viewer");
            if(credential.isEmpty())throw new Exception("Connect your AI server and viewer key first.");
            final int current=aiGeneration;
            final Object ticket=new Object();
            if(!config && !aiWorking.compareAndSet(null,ticket))throw new Exception("An AI request is still finishing. Please wait.");
            aiExecutor.execute(()->{
                try {
                    if(current!=aiGeneration)return;
                    JSONObject result=new AiClient().request(origin,credential,selectedMode,config?null:payload);
                    JSONObject event=object("id",id);event.put("data",result);
                    if(current==aiGeneration)send(config?"ai_config":"ai_result",event);
                } catch(Exception error) {
                    JSONObject event=object("id",id);
                    try {event.put("message",error instanceof java.io.IOException?"Could not reach the AI server. Check your connection and retry.":error.getMessage());}catch(Exception ignored){}
                    if(current==aiGeneration)send(config?"ai_config_error":"ai_error",event);
                } finally {if(!config)aiWorking.compareAndSet(ticket,null);}
            });
        } catch(Exception error) {
            JSONObject event=object("id",id);try{event.put("message",error.getMessage());}catch(Exception ignored){}
            send(config?"ai_config_error":"ai_error",event);
        }
    }
    private void showAiSettings() {
        if(aiSettingsShowing)return;aiSettingsShowing=true;
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(24),dp(8),dp(24),dp(16));
        form.addView(text("Connect your private HAL AI server. Gemini uses its server-side key and market feed. Your phone's Upstox token is never sent to this server. Only requests you approve are shared."));
        form.addView(text("HAL server HTTPS address"));
        EditText address=new EditText(this);address.setSingleLine(true);address.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);address.setText(prefs.getString("ai_origin",MarketClient.SERVER));form.addView(address);
        form.addView(text("Viewer key — HAL_VIEWER_KEY"));
        EditText credential=new EditText(this);credential.setSingleLine(true);credential.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);credential.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);credential.setHint(secrets.has("ai_viewer")?"Saved securely — leave blank to keep":"Enter the server viewer key");form.addView(credential);
        form.addView(text("The server needs GEMINI_API_KEY and the HAL AI routes from this repository. AI works with either market connection mode. Provider quota or charges may apply."));
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("AI connection").setView(scroll).setPositiveButton("Save AI connection",null).setNegativeButton("Cancel",null).setNeutralButton("Disconnect AI",null).create();
        dialog.setOnDismissListener(d->{aiSettingsShowing=false;credential.setText("");});
        dialog.setOnShowListener(d->{
            dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                try {
                    String origin=AiEndpoint.normalize(address.getText().toString()),value=credential.getText().toString().trim();
                    if(value.length()>16384 || value.matches("(?s).*\\p{Cntrl}.*") || value.contains(" "))throw new Exception("Paste only the viewer key, without spaces or line breaks.");
                    if(value.isEmpty()&&(!secrets.has("ai_viewer")||!origin.equals(prefs.getString("ai_origin",MarketClient.SERVER))))throw new Exception("Enter the viewer key for this server address.");
                    // Drop the prior key before changing hosts, so a failed save cannot mix credentials.
                    if(!origin.equals(prefs.getString("ai_origin",MarketClient.SERVER)))secrets.remove("ai_viewer");
                    if(!prefs.edit().putString("ai_origin",origin).commit())throw new Exception("The AI connection could not be saved.");
                    if(!value.isEmpty())secrets.set("ai_viewer",value);
                    aiGeneration++;aiWorking.set(null);dialog.dismiss();aiStatus();
                } catch(Exception error){credential.setError(error.getMessage());}
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v->{
                try{secrets.remove("ai_viewer");aiGeneration++;aiWorking.set(null);dialog.dismiss();aiStatus();}
                catch(Exception error){credential.setError("Could not remove the saved AI credential.");}
            });
        });dialog.show();
    }
    private void refresh(String expiry) {
        if(expiry==null || expiry.length()>10 || (!expiry.isEmpty() && !expiry.matches("\\d{4}-\\d{2}-\\d{2}"))) {send("error",object("code","invalid_expiry"));return;}
        if(!working.compareAndSet(false,true))return;
        if(System.currentTimeMillis()-lastRequest<10000){working.set(false);send("error",object("code","refresh_too_soon"));return;}
        lastRequest=System.currentTimeMillis();final int current=generation;final String selectedMode=mode();final MarketClient activeClient=client;
        send("loading",new JSONObject());
        executor.execute(()->{
            try {
                String secret;
                try{secret=secrets.get(selectedMode);}catch(Exception error){throw new MarketClient.Failure("secure_storage_unavailable");}
                if(secret.isEmpty())throw new MarketClient.Failure("credential_missing");
                JSONObject data=activeClient.load(selectedMode,secret,expiry);
                if(current==generation)send("snapshot",data);
            }catch(Exception error){
                String code=error instanceof MarketClient.Failure?((MarketClient.Failure)error).code:"network_unavailable";
                if(current==generation)send("error",object("code",code));
            }finally{working.set(false);if(current!=generation)send("idle",new JSONObject());}
        });
    }
    private int dp(int size){return Math.round(size*getResources().getDisplayMetrics().density);}
    private void research(String request){
        if(request==null||request.length()>1000)return;
        final JSONObject args;try{args=new JSONObject(request);}catch(Exception e){return;}
        final String section=args.optString("section"),frame=args.optString("frame","D"),type=args.optString("type","consolidated"),id=section+":"+frame+":"+type;
        final int current=generation;final String selectedMode=mode();final MarketClient active=client;
        Long previous=researchRequests.put(id,System.currentTimeMillis());
        if(previous!=null&&System.currentTimeMillis()-previous<15000){JSONObject result=object("key",id);try{result.put("code","refresh_too_soon");}catch(Exception ignored){}send("research_error",result);return;}
        researchExecutor.execute(()->{
            try{String token=secrets.get(selectedMode);JSONObject result=new ResearchClient(active).load(selectedMode,token,section,frame,type);result.put("key",id);if(current==generation)send("research",result);}
            catch(Exception e){JSONObject result=object("key",id);try{result.put("code",e instanceof MarketClient.Failure?((MarketClient.Failure)e).code:"network_unavailable");}catch(Exception ignored){}if(current==generation)send("research_error",result);}
        });
    }
    private void exportDocument(String data,boolean csv){
        if(data==null||data.length()>2000000){send("file_error",object("message","Export is too large."));return;}
        pendingExport=data.getBytes(StandardCharsets.UTF_8);
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType(csv?"text/csv":"application/json");
        intent.putExtra(Intent.EXTRA_TITLE,"HAL-Desk-"+(csv?"Journal":"Backup")+"-"+java.time.LocalDate.now()+ (csv?".csv":".json"));
        try{startActivityForResult(intent,41);}catch(Exception e){pendingExport=null;send("file_error",object("message","A document picker is not available."));}
    }
    private void openLink(String address){
        try{Uri uri=Uri.parse(address);String host=uri.getHost();if(!"https".equals(uri.getScheme())||uri.getUserInfo()!=null||host==null||!host.contains(".")||address.length()>4000)throw new Exception();
            startActivity(new Intent(Intent.ACTION_VIEW,uri));
        }catch(Exception e){send("file_error",object("message","Could not open this HTTPS source link."));}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(result!=RESULT_OK||data==null||data.getData()==null){if(request==41)pendingExport=null;return;}
        if(request==41){try{if(pendingExport==null)throw new Exception();try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new Exception();out.write(pendingExport);}send("file_saved",new JSONObject());}catch(Exception e){send("file_error",object("message","The file could not be saved."));}finally{pendingExport=null;}}
        if(request==42){final Uri uri=data.getData();executor.execute(()->{try{ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new Exception();byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(bytes.size()+n>2000000)throw new Exception();bytes.write(buf,0,n);}}JSONObject imported=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));send("import_preview",imported);}catch(Exception e){send("file_error",object("message","Choose a valid HAL Desk JSON backup under 2 MB."));}});}
    }
    private TextView text(String value){TextView view=new TextView(this);view.setText(value);view.setTextSize(15);view.setPadding(0,dp(8),0,dp(8));return view;}
    private void showSettings(){
        if(settingsShowing)return;settingsShowing=true;
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(24),dp(8),dp(24),dp(16));
        RadioGroup choice=new RadioGroup(this);RadioButton direct=new RadioButton(this),server=new RadioButton(this);
        direct.setId(101);server.setId(102);direct.setText("Direct Upstox token");server.setText("Existing Render server");choice.addView(direct);choice.addView(server);
        choice.check("server".equals(mode())?102:101);form.addView(choice);
        TextView explanation=text("");form.addView(explanation);
        EditText credential=new EditText(this);credential.setSingleLine(false);credential.setMaxLines(4);credential.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        credential.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);form.addView(credential);
        TextView details=text("Credentials are encrypted with Android Keystore. They never enter the page or the APK. Market data only; no orders or broker holdings are accessed.");details.setTextSize(13);form.addView(details);
        Runnable labels=()->{
            boolean isServer=choice.getCheckedRadioButtonId()==102;String selected=isServer?"server":"direct";
            explanation.setText(isServer?"Uses hal-dashboard.onrender.com. Enter HAL_VIEWER_KEY. Your Upstox token remains on Render as UPSTOX_ACCESS_TOKEN.":"Paste an Upstox token here. The read-only Analytics Token is recommended for research and has one-year validity. Standard OAuth tokens expire daily. Your token is sent only to api.upstox.com.");
            credential.setHint(secrets.has(selected)?"Saved securely — leave blank to keep":(isServer?"HAL_VIEWER_KEY":"Upstox access token"));credential.setText("");
        };
        choice.setOnCheckedChangeListener((group,id)->labels.run());labels.run();
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Connect HAL").setView(scroll).setPositiveButton("Save & connect",null).setNegativeButton("Cancel",null).setNeutralButton("Forget credentials",null).create();
        dialog.setOnDismissListener(d->{settingsShowing=false;credential.setText("");});
        dialog.setOnShowListener(d->{
            dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                String selected=choice.getCheckedRadioButtonId()==102?"server":"direct";
                String value=credential.getText().toString().trim();
                if(selected.equals("direct") && value.regionMatches(true,0,"Bearer ",0,7))value=value.substring(7).trim();
                if(value.length()>16384 || value.matches("(?s).*\\p{Cntrl}.*") || value.contains(" ")){credential.setError("Paste only the token or viewer key, without spaces or line breaks.");return;}
                if(value.isEmpty() && !secrets.has(selected)){credential.setError("Enter a credential to connect.");return;}
                try {
                    if(!value.isEmpty())secrets.set(selected,value);
                    prefs.edit().putString("mode",selected).commit();generation++;client=new MarketClient();lastRequest=0;researchRequests.clear();
                    dialog.dismiss();status();send("reset",new JSONObject());
                    if(working.get())send("error",object("code","connection_changed"));else refresh("");
                }catch(Exception error){credential.setError("Secure storage unavailable. Unlock your phone and try again.");}
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v->{
                new AlertDialog.Builder(this).setTitle("Forget market credentials?").setMessage("Remove the Upstox and market-server credentials. Your AI connection and manual positions stay on this phone.")
                    .setPositiveButton("Forget",(a,b)->{try{generation++;secrets.remove("direct");secrets.remove("server");client=new MarketClient();lastRequest=0;dialog.dismiss();status();send("reset",new JSONObject());}catch(Exception error){credential.setError("Could not remove the saved market credentials.");}})
                    .setNegativeButton("Cancel",null).show();
            });
        });dialog.show();
    }
    private final class Bridge {
        @JavascriptInterface public void minimize(){runOnUiThread(()->moveTaskToBack(true));}
        @JavascriptInterface public void ready(){runOnUiThread(()->{pageReady=true;status();});}
        @JavascriptInterface public void settings(){runOnUiThread(()->showSettings());}
        @JavascriptInterface public void refresh(String expiry){MainActivity.this.refresh(expiry);}
        @JavascriptInterface public void research(String request){MainActivity.this.research(request);}
        @JavascriptInterface public void aiConfig(String request){runOnUiThread(()->MainActivity.this.aiRequest(request,true));}
        @JavascriptInterface public void ai(String request){runOnUiThread(()->MainActivity.this.aiRequest(request,false));}
        @JavascriptInterface public void aiSettings(){runOnUiThread(()->showAiSettings());}
        @JavascriptInterface public void openLink(String url){runOnUiThread(()->MainActivity.this.openLink(url));}
        @JavascriptInterface public void exportBackup(String json){runOnUiThread(()->exportDocument(json,false));}
        @JavascriptInterface public void exportCSV(String csv){runOnUiThread(()->exportDocument(csv,true));}
        @JavascriptInterface public void importBackup(){runOnUiThread(()->{try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");startActivityForResult(i,42);}catch(Exception e){send("file_error",object("message","A document picker is not available."));}});}
        @JavascriptInterface public void openResearch(){runOnUiThread(()->{
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(MarketClient.SERVER+"/")));}
            catch(Exception error){send("error",object("code","browser_unavailable"));}
        });}
        @JavascriptInterface public void openTokenPage(){runOnUiThread(()->{
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://account.upstox.com/developer/apps")));}
            catch(Exception error){send("error",object("code","browser_unavailable"));}
        });}
    }
    @Override protected void onPause(){super.onPause();web.onPause();web.pauseTimers();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}}
    @Override protected void onDestroy(){generation++;aiGeneration++;executor.shutdownNow();researchExecutor.shutdownNow();aiExecutor.shutdownNow();if(web!=null){web.removeJavascriptInterface("HALNative");web.destroy();}super.onDestroy();}
    @Override public void onBackPressed(){if(pageReady)web.evaluateJavascript("window.HALApp.back()",null);else super.onBackPressed();}
}
