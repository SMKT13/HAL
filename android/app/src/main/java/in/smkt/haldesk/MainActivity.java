package in.smkt.haldesk;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.provider.OpenableColumns;
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
    private final ExecutorService aiExecutor=Executors.newSingleThreadExecutor();
    private final LocalAi localAi=new LocalAi();
    private ModelStore modelStore;
    private final AtomicBoolean modelBusy=new AtomicBoolean(false),modelCancelled=new AtomicBoolean(false);
    private volatile String activeAiId="";
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
        try{modelStore=new ModelStore(getFilesDir());secrets.remove("ai_viewer");prefs.edit().remove("ai_origin").apply();}catch(Exception ignored){}
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
        JSONObject obj=new JSONObject();try{obj.put("mode",mode());obj.put("configured",secrets.has(mode()));obj.put("version","2.3");}catch(Exception ignored){}
        send("connection",obj);
        aiStatus();
    }
    private void aiStatus() {
        JSONObject data=object("configured",modelStore!=null&&modelStore.ready()&&!modelBusy.get());
        try {data.put("offline",true);data.put("model",modelStore!=null&&modelStore.ready()?modelStore.label():"No local model installed");data.put("busy",modelBusy.get());data.put("revision",aiGeneration);}catch(Exception ignored){}
        send("ai_connection",data);
    }
    private void aiRequest(String request, boolean config) {
        if(request==null||request.length()>16000)return;
        final JSONObject args;try{args=new JSONObject(request);}catch(Exception error){return;}
        final String id=args.optString("id");if(!id.matches("[A-Za-z0-9_-]{1,80}"))return;
        try {
            if(config){
                JSONObject info=object("aiEnabled",modelStore!=null&&modelStore.ready()&&!modelBusy.get());
                info.put("model",modelStore!=null&&modelStore.ready()?modelStore.label():"Import a local model");info.put("offline",true);info.put("researchEnabled",true);
                JSONObject event=object("id",id);event.put("data",info);send("ai_config",event);return;
            }
            if(!Boolean.TRUE.equals(args.opt("local")))throw new Exception("Only on-device AI requests are supported.");
            if(modelBusy.get())throw new Exception("Wait for the model transfer to finish.");
            if(modelStore==null||!modelStore.ready())throw new Exception("Download or import a local model first.");
            JSONObject evidence=args.optJSONObject("evidence");if(evidence==null)throw new Exception("Refresh the app evidence before running a review.");
            final String prompt=LocalPrompt.build(args.optString("mode"),args.optString("message"),evidence.toString());
            final String dataAsOf=evidence.optString("quoteAsOf","");
            final JSONArray sources=evidence.optJSONArray("sources");
            final int current=aiGeneration;final Object ticket=new Object();
            if(!aiWorking.compareAndSet(null,ticket))throw new Exception("The previous local review is still finishing. Please wait.");
            activeAiId=id;localAi.prepare();
            aiExecutor.execute(()->{
                try {
                    if(current!=aiGeneration)return;
                    String reply=localAi.generate(modelStore.file(),getCacheDir(),prompt);
                    JSONObject result=object("success",true);result.put("local",true);result.put("source","On-device · "+modelStore.label());
                    result.put("reply",reply);result.put("grounded",false);result.put("generatedAt",java.time.Instant.now().toString());
                    result.put("dataAsOf",dataAsOf);result.put("sources",sources==null?new JSONArray():sources);
                    JSONObject event=object("id",id);event.put("data",result);if(current==aiGeneration)send("ai_result",event);
                } catch(Throwable error) {
                    JSONObject event=object("id",id);
                    String message=error instanceof OutOfMemoryError?"The local model needs more free RAM. Close other apps and try a smaller model.":error instanceof UnsatisfiedLinkError?"The local runtime could not load on this device. A supported 64-bit Android device is required.":"The local model could not finish. Try a shorter question or a compatible CPU .litertlm model.";
                    if(error instanceof Exception&&"Local review cancelled.".equals(error.getMessage()))message="Local review cancelled.";
                    try{event.put("message",message);}catch(Exception ignored){}if(current==aiGeneration)send("ai_error",event);
                } finally {if(aiWorking.compareAndSet(ticket,null))activeAiId="";}
            });
        }catch(Exception error){JSONObject event=object("id",id);try{event.put("message",error.getMessage());}catch(Exception ignored){}send(config?"ai_config_error":"ai_error",event);}
    }
    private boolean modelChangeAllowed(){
        if(modelBusy.get()||aiWorking.get()!=null){send("ai_model_error",object("message","Stop the current local review or model transfer first."));return false;}
        if(modelStore==null){send("ai_model_error",object("message","Local model storage is unavailable. Free storage and restart the app."));return false;}
        return true;
    }
    private void pickModel(){
        if(!modelChangeAllowed())return;
        try{Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("*/*");startActivityForResult(intent,43);}
        catch(Exception error){send("ai_model_error",object("message","A model file picker is unavailable."));}
    }
    private void modelProgress(long bytes,long total){
        JSONObject data=object("bytes",bytes);try{data.put("total",total);}catch(Exception ignored){}send("ai_model_progress",data);
    }
    private void importModel(Uri uri){
        if(!modelChangeAllowed()||!modelBusy.compareAndSet(false,true))return;
        modelCancelled.set(false);aiStatus();
        aiExecutor.execute(()->{
            try {
                String label="Imported model.litertlm";long size=-1;
                try(Cursor cursor=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE},null,null,null)){
                    if(cursor!=null&&cursor.moveToFirst()){
                        int n=cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME),b=cursor.getColumnIndex(OpenableColumns.SIZE);
                        if(n>=0)label=cursor.getString(n);if(b>=0&&!cursor.isNull(b))size=cursor.getLong(b);
                    }
                }
                if(label==null||!label.toLowerCase(java.util.Locale.ROOT).endsWith(".litertlm"))throw new Exception("Choose a .litertlm model file.");
                try(InputStream input=getContentResolver().openInputStream(uri)){
                    if(input==null)throw new Exception("The model file could not be opened.");
                    modelStore.install(input,label,size,null,modelCancelled,this::modelProgress);
                }
                aiGeneration++;send("ai_model_done",object("message","Model imported. All AI reviews run on this phone."));
            }catch(Exception error){send("ai_model_error",object("message",error instanceof java.io.InterruptedIOException?"Model transfer cancelled.":error.getMessage()));}
            finally{modelBusy.set(false);aiStatus();}
        });
    }
    private void downloadModel(){
        if(!modelChangeAllowed())return;
        new AlertDialog.Builder(this).setTitle("Download local AI model?")
            .setMessage("Qwen3 0.6B CPU model: about 345 MB, downloaded once from Hugging Face. Your positions and questions are never sent. Keep at least 550 MB free for the model. You can import a compatible .litertlm file instead.")
            .setNegativeButton("Cancel",null).setPositiveButton("Download",(dialog,which)->{
                if(!modelChangeAllowed()||!modelBusy.compareAndSet(false,true))return;
                modelCancelled.set(false);aiStatus();
                aiExecutor.execute(()->{
                    javax.net.ssl.HttpsURLConnection connection=null;
                    try {
                        String address=ModelPolicy.DOWNLOAD_URL;
                        for(int redirects=0;redirects<6;redirects++){
                            ModelPolicy.downloadDestination(address);
                            connection=(javax.net.ssl.HttpsURLConnection)new java.net.URL(address).openConnection();
                            connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(20000);connection.setReadTimeout(30000);connection.setRequestProperty("Accept-Encoding","identity");
                            int code=connection.getResponseCode();
                            if(code>=300&&code<400){String location=connection.getHeaderField("Location");String next=new java.net.URL(new java.net.URL(address),location).toString();connection.disconnect();connection=null;address=next;continue;}
                            if(code!=200)throw new Exception("The model download is unavailable. Retry later or import a model file.");
                            try(InputStream input=connection.getInputStream()){modelStore.install(input,"Qwen3 0.6B · CPU int4",ModelPolicy.DOWNLOAD_BYTES,ModelPolicy.DOWNLOAD_SHA,modelCancelled,this::modelProgress);}
                            aiGeneration++;send("ai_model_done",object("message","Model downloaded and checksum verified. AI now runs offline on this phone."));return;
                        }
                        throw new Exception("Too many model download redirects. Import a model file instead.");
                    }catch(Exception error){send("ai_model_error",object("message",error instanceof java.io.InterruptedIOException?"Model transfer cancelled.":"The model download could not finish. The previous model is retained; retry or import a .litertlm file."));}
                    finally{if(connection!=null)connection.disconnect();modelBusy.set(false);aiStatus();}
                });
            }).show();
    }
    private void showAiSettings(){
        if(aiSettingsShowing)return;aiSettingsShowing=true;
        String message="AI runs entirely on this phone using LiteRT-LM. No account, API key or AI server is needed. Market feeds still use the existing data connection.\n\n"+
            (modelStore!=null&&modelStore.ready()?"Installed: "+modelStore.label():"No local model is installed.")+"\n\nDownload the small CPU model once, or import a trusted CPU .litertlm model (up to 1.5 GB). Local models can be slower and less capable than cloud AI. Performance depends on your device's RAM. The app never searches the web during AI generation.";
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("On-device AI").setMessage(message)
            .setPositiveButton("Download model",(d,w)->downloadModel()).setNegativeButton("Import model",(d,w)->pickModel())
            .setNeutralButton("Remove model",(d,w)->{
                if(!modelChangeAllowed())return;
                new AlertDialog.Builder(this).setTitle("Remove local model?").setMessage("This frees the model's storage. Positions, notes and market credentials stay on your phone.")
                    .setNegativeButton("Keep",null).setPositiveButton("Remove",(a,b)->{
                        if(!modelChangeAllowed()||!modelBusy.compareAndSet(false,true))return;
                        aiExecutor.execute(()->{try{modelStore.remove();aiGeneration++;}catch(Exception error){send("ai_model_error",object("message","Could not remove the model."));}finally{modelBusy.set(false);aiStatus();}});
                    }).show();
            }).create();
        dialog.setOnDismissListener(d->aiSettingsShowing=false);dialog.setOnShowListener(d->dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE));dialog.show();
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
        if(request==43){importModel(data.getData());return;}
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
        @JavascriptInterface public void aiCancel(String id){if(id!=null&&id.equals(activeAiId))localAi.cancel();}
        @JavascriptInterface public void aiCancelModel(){modelCancelled.set(true);}
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
    @Override protected void onPause(){super.onPause();localAi.cancel();web.onPause();web.pauseTimers();}
    @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.resumeTimers();}}
    @Override protected void onDestroy(){generation++;aiGeneration++;modelCancelled.set(true);localAi.cancel();executor.shutdownNow();researchExecutor.shutdownNow();aiExecutor.shutdownNow();if(web!=null){web.removeJavascriptInterface("HALNative");web.destroy();}super.onDestroy();}
    @Override public void onBackPressed(){if(pageReady)web.evaluateJavascript("window.HALApp.back()",null);else super.onBackPressed();}
}
