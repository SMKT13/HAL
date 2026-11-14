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
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;

public final class MainActivity extends Activity {
    private WebView web;
    private SecretStore secrets;
    private BookStore books;
    private volatile boolean foreground;
    private long backgroundAt=-1;
    private AlertDialog consentDialog;
    private SharedPreferences prefs;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final ExecutorService researchExecutor=Executors.newFixedThreadPool(2);
    private final ExecutorService nseExecutor=Executors.newSingleThreadExecutor();
    private final AtomicBoolean nseWorking=new AtomicBoolean(false);
    private volatile long lastNseRequest=0;
    private final ExecutorService aiExecutor=Executors.newSingleThreadExecutor();
    private final ExecutorService offlineExecutor=Executors.newSingleThreadExecutor();
    private FinbertClassifier offlineFinbert;
    private volatile AiClient activeAi;
    private volatile String activeAiId="";
    private final AtomicReference<Object> aiWorking=new AtomicReference<>();
    private final AtomicInteger aiGeneration=new AtomicInteger();
    private final AtomicInteger streamGeneration=new AtomicInteger();
    private final AtomicInteger offlineGeneration=new AtomicInteger();
    private final ConcurrentHashMap<String,Long> researchRequests=new ConcurrentHashMap<>();
    private byte[] pendingExport;
    private final AtomicBoolean working=new AtomicBoolean(false);
    private volatile MarketClient client=new MarketClient();
    private MarketStream stream;
    private final AtomicInteger generation=new AtomicInteger();
    private volatile long lastRequest=0;
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    private boolean pageReady=false;
    private boolean settingsShowing=false;
    private boolean aiSettingsShowing=false;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        books=new BookStore(this);secrets=new SecretStore(this);prefs=getSharedPreferences("connection",MODE_PRIVATE);
        offlineFinbert=new FinbertClassifier(getNoBackupFilesDir());
        stream=new MarketStream(data->{final int ticket=streamGeneration.get();sendIf("stream",data,()->ticket==streamGeneration.get()&&(foreground||"stopped".equals(data.optString("state"))));});
        FrameLayout root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(11,16,32));
        root.setOnApplyWindowInsetsListener((view,insets)->{ view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom()); return insets.consumeSystemWindowInsets(); });
        web=new WebView(this);web.setBackgroundColor(Color.rgb(11,16,32));
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setAllowFileAccessFromFileURLs(false);settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);
        settings.setSafeBrowsingEnabled(true);settings.setSaveFormData(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setMediaPlaybackRequiresUserGesture(true);
        web.addJavascriptInterface(new Bridge(),"HALNative");
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return true;}
            @Override public boolean shouldOverrideUrlLoading(WebView view,String url){return true;}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                String url=request.getUrl().toString();String asset="";String mime="text/plain";
                for(String name:new String[]{"index.html","desk4.js","nse4.js","style4.css"})if(url.equals(ORIGIN+name)){asset=name;mime=name.endsWith(".html")?"text/html":name.endsWith(".css")?"text/css":"application/javascript";break;}
                try { if(!asset.isEmpty())return new WebResourceResponse(mime,"UTF-8",getAssets().open(asset)); }
                catch(Exception ignored) { }
                return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
            }
        });
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));setContentView(root);web.loadUrl(ORIGIN+"index.html");
    }
    private void send(String event,JSONObject data) { sendIf(event,data,()->true); }
    private void sendMarket(String event,JSONObject data,int expected){sendIf(event,data,()->foreground&&expected==generation.get());}
    private void sendAi(String event,JSONObject data,int expected){sendIf(event,data,()->foreground&&expected==aiGeneration.get());}
    private void sendIf(String event,JSONObject data,BooleanSupplier allowed) {
        final String script="window.HALApp && window.HALApp.receive("+JSONObject.quote(event)+","+data.toString().replace("\u2028","\\u2028").replace("\u2029","\\u2029")+");";
        runOnUiThread(()->{if(!isFinishing() && !isDestroyed() && pageReady && allowed.getAsBoolean())web.evaluateJavascript(script,null);});
    }
    private JSONObject object(String key,Object value) {
        JSONObject obj=new JSONObject();try{obj.put(key,value);}catch(Exception ignored){}return obj;
    }
    private String mode(){return "direct";}
    private void status() {
        JSONObject obj=new JSONObject();try{obj.put("mode",mode());obj.put("configured",secrets.has(mode()));obj.put("version","4.6.0");}catch(Exception ignored){}
        send("connection",obj);
        aiStatus();
    }
    private void aiStatus() {
        JSONObject data=object("configured",secrets.has("gemini"));
        try{data.put("direct",true);data.put("model",prefs.getString("ai_model",AiPolicy.DEFAULT_MODEL));data.put("revision",aiGeneration.get());}catch(Exception ignored){}
        send("ai_connection",data);
    }
    private void aiRequest(String request,boolean config){
        if(request==null||request.length()>65536)return;final JSONObject args;try{args=new JSONObject(request);}catch(Exception e){return;}
        final String id=args.optString("id");if(!id.matches("[A-Za-z0-9_-]{1,80}"))return;
        try{final String model=AiPolicy.model(prefs.getString("ai_model",AiPolicy.DEFAULT_MODEL));
            if(config){JSONObject info=object("aiEnabled",secrets.has("gemini"));info.put("model",model);info.put("direct",true);info.put("researchEnabled",true);send("ai_config",withId(id,"data",info));return;}
            if(!foreground)throw new Exception("Open HAL Desk before requesting an AI review.");
            if(!Boolean.TRUE.equals(args.opt("consent")))throw new Exception("Confirm sharing the selected evidence with Gemini.");
            if(!secrets.has("gemini"))throw new Exception("Enter your Gemini API key in AI settings first.");
            final String mode=args.optString("mode"),question=args.optString("message");final JSONObject evidence=AiPolicy.sanitizeEvidence(args.optJSONObject("evidence"),mode);AiPolicy.prompt(mode,question,evidence.toString());final int current=aiGeneration.get();
            if(aiWorking.get()!=null)throw new Exception("The previous API request is still finishing.");
            if(consentDialog!=null&&consentDialog.isShowing())throw new Exception("Review or cancel the open sharing request first.");
            ScrollView scroll=new ScrollView(this);TextView contents=text("Model: "+model+"\nQuestion: "+question+"\n\nExact evidence sent to Google:\n"+evidence.toString(2));contents.setTextIsSelectable(true);contents.setPadding(dp(20),dp(8),dp(20),dp(16));scroll.addView(contents);
            activeAiId=id;consentDialog=new AlertDialog.Builder(this).setTitle("Send this evidence to Gemini?").setView(scroll).setPositiveButton("Send to Gemini",(d,w)->runAi(id,model,mode,question,evidence,current)).setNegativeButton("Cancel",(d,w)->send("ai_error",withId(id,"message","Review cancelled before any API call."))).setOnCancelListener(d->send("ai_error",withId(id,"message","Review cancelled before any API call."))).create();consentDialog.show();consentDialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        }catch(Exception e){send(config?"ai_config_error":"ai_error",withId(id,"message",e.getMessage()));}
    }
    private JSONObject withId(String id,String key,Object value){JSONObject out=object("id",id);try{out.put(key,value);}catch(Exception ignored){}return out;}
    private void runAi(String id,String model,String mode,String question,JSONObject evidence,int current){
        try{if(current!=aiGeneration.get()||!foreground)throw new Exception("Evidence changed or the app paused. Review the current book and retry.");
            final String key;try{key=secrets.get("gemini");}catch(Exception e){throw new Exception("Secure key storage unavailable. Unlock the phone and retry.");}if(!AiPolicy.validKey(key))throw new Exception("Enter a valid Gemini API key in AI settings.");
            final Object ticket=new Object();if(!aiWorking.compareAndSet(null,ticket))throw new Exception("The previous API request is still finishing.");final AiClient client=new AiClient();activeAi=client;activeAiId=id;
            aiExecutor.execute(()->{try{if(current!=aiGeneration.get()||!foreground)return;JSONObject result=client.generate(key,model,mode,question,evidence);if(current==aiGeneration.get()&&foreground)sendAi("ai_result",withId(id,"data",result),current);}catch(Exception e){if(current==aiGeneration.get())sendAi("ai_error",withId(id,"message",e instanceof AiClient.Failure?e.getMessage():"The Gemini request could not finish. Check quota or connectivity and retry."),current);}finally{if(aiWorking.compareAndSet(ticket,null)){activeAiId="";activeAi=null;}}});
        }catch(Exception e){send("ai_error",withId(id,"message",e.getMessage()));}
    }
    private void cancelAi(){AiClient client=activeAi;if(client!=null)client.cancel();}
    private void invalidateAi(String reason){
        aiGeneration.incrementAndGet();final String id=activeAiId;activeAiId="";cancelAi();
        if(!id.isEmpty())send("ai_error",withId(id,"message",reason));
        runOnUiThread(()->{if(consentDialog!=null&&consentDialog.isShowing())consentDialog.dismiss();});
    }
    private void stopStream(){streamGeneration.incrementAndGet();if(stream!=null)stream.stop();}
    private void cancelOffline(){offlineGeneration.incrementAndGet();if(offlineFinbert!=null)offlineFinbert.cancel();}
    private void showAiSettings(){
        if(aiSettingsShowing)return;aiSettingsShowing=true;
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(24),dp(8),dp(24),dp(16));
        form.addView(text("Android calls Google's Gemini API directly. No HAL server or website is needed. Internet and your Google AI quota are required."));
        form.addView(text("Gemini API key"));
        EditText credential=new EditText(this);credential.setSingleLine(true);credential.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);
        credential.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        // Do not silently truncate long authorization keys when pasting.
        credential.setHint(secrets.has("gemini")?"Saved securely — leave blank to keep":"Paste your Gemini API key");form.addView(credential);
        form.addView(text("Paste the complete key from Google AI Studio. Pasted whitespace is removed automatically. Key formats containing dots and long authorization keys are supported; Google verifies the key when you run a review."));
        form.addView(text("Model ID"));EditText model=new EditText(this);model.setSingleLine(true);model.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        model.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(81)});model.setText(prefs.getString("ai_model",AiPolicy.DEFAULT_MODEL));form.addView(model);
        form.addView(text("The key is encrypted with Android Keystore and is never sent to the web page or included in backups. Selected questions and evidence go to Google only when you run a review. Broker tokens and private notes are excluded. API usage may incur Google charges. Research uses news and indicators already fetched by this app; no AI web search."));
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Gemini API settings").setView(scroll).setPositiveButton("Save",null).setNegativeButton("Cancel",null).setNeutralButton("Forget API key",null).create();
        dialog.setOnDismissListener(d->{aiSettingsShowing=false;credential.setText("");});
        dialog.setOnShowListener(d->{
            dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{
                final String value;String selected=model.getText().toString().trim();
                try{value=AiPolicy.pastedKey(credential.getText().toString());}catch(Exception error){credential.setError(error.getMessage());return;}
                try{AiPolicy.model(selected);}catch(Exception error){model.setError(error.getMessage());return;}
                if(value.isEmpty()&&!secrets.has("gemini")){credential.setError("Enter your Gemini API key.");return;}
                try {
                    if(!value.isEmpty())secrets.set("gemini",value);
                    if(!prefs.edit().putString("ai_model",selected).commit())throw new Exception();
                    invalidateAi("AI settings or the saved book changed. Review updated evidence before retrying.");dialog.dismiss();aiStatus();
                }catch(Exception error){credential.setError("Could not save securely. Unlock your phone and try again.");}
            });
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v->{
                try{secrets.remove("gemini");invalidateAi("AI settings or the saved book changed. Review updated evidence before retrying.");dialog.dismiss();aiStatus();}
                catch(Exception error){credential.setError("Could not remove the saved API key.");}
            });
        });dialog.show();
    }
    private void startStream() {
        if(!foreground||!secrets.has("direct")){
            send("stream",object("state","direct_connection_required"));return;
        }
        if(stream.isEnabled())return;
        final MarketClient active=client;final int ticket=streamGeneration.incrementAndGet();
        executor.execute(()->{
            try{if(!foreground||ticket!=streamGeneration.get())return;String token=secrets.get("direct");stream.start(active,token,()->foreground&&ticket==streamGeneration.get());}
            catch(Exception error){sendIf("stream",object("state","stream_connection_failed"),()->foreground&&ticket==streamGeneration.get());}
        });
    }
    private void refresh(String expiry) {
        if(!foreground)return;
        if(expiry==null || expiry.length()>10 || (!expiry.isEmpty() && !expiry.matches("\\d{4}-\\d{2}-\\d{2}"))) {send("error",object("code","invalid_expiry"));return;}
        if(!working.compareAndSet(false,true))return;
        if(System.currentTimeMillis()-lastRequest<10000){working.set(false);send("error",object("code","refresh_too_soon"));return;}
        lastRequest=System.currentTimeMillis();final int current=generation.get();final String selectedMode=mode();final MarketClient activeClient=client;
        sendMarket("loading",new JSONObject(),current);
        executor.execute(()->{
            try {
                if(current!=generation.get()||!foreground)return;String secret;
                try{secret=secrets.get(selectedMode);}catch(Exception error){throw new MarketClient.Failure("secure_storage_unavailable");}
                if(secret.isEmpty())throw new MarketClient.Failure("credential_missing");
                JSONObject data=activeClient.load(selectedMode,secret,expiry);
                sendMarket("snapshot",data,current);
            }catch(Exception error){
                String code=error instanceof MarketClient.Failure?((MarketClient.Failure)error).code:"network_unavailable";
                sendMarket("error",object("code",code),current);
            }finally{working.set(false);sendMarket("idle",new JSONObject(),current);}
        });
    }
    // NSE cash-market research is independent of the Upstox token and never
    // enters the holdings, Greeks, mark-to-market or order-flow calculations.
    private void refreshNse(){
        if(!foreground)return;
        if(!nseWorking.compareAndSet(false,true)){send("nse_error",object("code","nse_busy"));return;}
        long now=android.os.SystemClock.elapsedRealtime();
        if(now-lastNseRequest<60000&&lastNseRequest!=0){
            nseWorking.set(false);send("nse_error",object("code","refresh_too_soon"));return;
        }
        lastNseRequest=now;
        final int ticket=generation.get();
        sendMarket("nse_loading",new JSONObject(),ticket);
        nseExecutor.execute(()->{
            try{
                if(!foreground||ticket!=generation.get())return;
                JSONObject result=new NseMcpClient().load();
                sendMarket("nse_snapshot",result,ticket);
            }catch(Exception e){
                String code=e instanceof NseMcpClient.Failure?((NseMcpClient.Failure)e).code:"nse_unavailable";
                sendMarket("nse_error",object("code",code),ticket);
            }finally{nseWorking.set(false);}
        });
    }
    private int dp(int size){return Math.round(size*getResources().getDisplayMetrics().density);}
    private void research(String request){
        if(!foreground)return;
        if(request==null||request.length()>20000)return;
        final JSONObject args;try{args=new JSONObject(request);}catch(Exception e){return;}
        final String section=args.optString("section"),frame=args.optString("frame","D"),type=args.optString("type","consolidated"),id=section+":"+frame+":"+type;
        final JSONArray strikeHints=args.optJSONArray("contracts".equals(section)?"legs":"strikes");
        final int current=generation.get();final String selectedMode=mode();final MarketClient active=client;
        Long previous=researchRequests.put(id,System.currentTimeMillis());
        if(previous!=null&&System.currentTimeMillis()-previous<15000){JSONObject result=object("key",id);try{result.put("code","refresh_too_soon");}catch(Exception ignored){}send("research_error",result);return;}
        researchExecutor.execute(()->{
            try{if(current!=generation.get()||!foreground)return;String token=secrets.get(selectedMode);JSONObject result=new ResearchClient(active).load(selectedMode,token,section,frame,type,strikeHints);result.put("key",id);sendMarket("research",result,current);}
            catch(Exception e){JSONObject result=object("key",id);try{result.put("code",e instanceof MarketClient.Failure?((MarketClient.Failure)e).code:"network_unavailable");}catch(Exception ignored){}sendMarket("research_error",result,current);}
        });
    }
    private void exportDocument(String data,boolean csv){
        if(data==null||data.length()>2000000){send("file_error",object("message","Export is too large."));return;}
        try{if(!csv)BookValidator.rejectCredentials(new JSONObject(data),0);}catch(Exception e){send("file_error",object("message","Backup contains invalid or credential fields."));return;}
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
        if (request == 43) {
            final Uri uri = data.getData();
            executor.execute(() -> previewHistory(uri));
            return;
        }
        if(request==42){final Uri uri=data.getData();executor.execute(()->{try{ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream in=getContentResolver().openInputStream(uri)){if(in==null)throw new Exception();byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(bytes.size()+n>2000000)throw new Exception();bytes.write(buf,0,n);}}JSONObject imported=new JSONObject(new String(bytes.toByteArray(),StandardCharsets.UTF_8));BookValidator.rejectCredentials(imported,0);send("import_preview",imported);}catch(Exception e){send("file_error",object("message","Choose a valid HAL Desk JSON backup under 2 MB."));}});}
    }
    private void previewHistory(Uri uri) {
        if (!"content".equals(uri.getScheme())) {
            send("file_error", object("message", "Choose a document from the Android file picker."));
            return;
        }
        String name = "HAL statement";
        try (android.database.Cursor c = getContentResolver().query(uri,
                new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) name = c.getString(0);
        } catch (RuntimeException ignored) { /* Display name is optional. */ }
        try (InputStream in = getContentResolver().openInputStream(uri)) {
            send("history_preview", HistoryDocument.read(in, name));
        } catch (java.io.IOException e) {
            send("file_error", object("message", "History import failed. " +
                    (e.getMessage() != null && e.getMessage().length() < 160 ? e.getMessage() : "Check document access and size.")));
        } catch (Exception e) {
            send("file_error", object("message", "Choose a valid single-sheet HAL XLSX, UTF-8 CSV or HAL history JSON under 2 MB."));
        }
    }
    private TextView text(String value){TextView view=new TextView(this);view.setText(value);view.setTextSize(15);view.setPadding(0,dp(8),0,dp(8));return view;}
    private void showSettings(){
        if(settingsShowing)return;settingsShowing=true;
        LinearLayout form=new LinearLayout(this);form.setOrientation(LinearLayout.VERTICAL);form.setPadding(dp(24),dp(8),dp(24),dp(16));
        form.addView(text("Use a read-only Upstox Analytics Token. Market requests go directly to api.upstox.com over HTTPS. No HAL server is required. Permissions and quotas determine feed availability."));
        EditText credential=new EditText(this);credential.setSingleLine(false);credential.setMaxLines(4);credential.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);credential.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);credential.setHint(secrets.has("direct")?"Saved securely — leave blank to keep":"Paste Upstox Analytics Token");form.addView(credential);
        form.addView(text("Encrypted with Android Keystore. Credentials never enter the page, backups or APK. No broker holdings, funds, orders or trade history are accessed."));
        ScrollView scroll=new ScrollView(this);scroll.addView(form);
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Read-only Upstox connection").setView(scroll).setPositiveButton("Save",null).setNegativeButton("Cancel",null).setNeutralButton("Forget token",null).create();
        dialog.setOnDismissListener(d->{settingsShowing=false;credential.setText("");});
        dialog.setOnShowListener(d->{dialog.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(v->{String value=credential.getText().toString().trim();if(value.regionMatches(true,0,"Bearer ",0,7))value=value.substring(7).trim();
                if(value.length()>16384||value.matches("(?s).*\\p{Cntrl}.*")||value.contains(" ")){credential.setError("Paste only the token without spaces or line breaks.");return;}
                if(value.isEmpty()&&!secrets.has("direct")){credential.setError("Enter a token to connect.");return;}
                try{if(!value.isEmpty())secrets.set("direct",value);generation.incrementAndGet();client.cancel();client=new MarketClient();lastRequest=0;researchRequests.clear();stopStream();dialog.dismiss();status();send("reset",new JSONObject());}catch(Exception error){credential.setError("Secure storage unavailable. Unlock the phone and retry.");}});
            dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener(v->{try{generation.incrementAndGet();client.cancel();secrets.remove("direct");client=new MarketClient();lastRequest=0;stopStream();dialog.dismiss();status();send("reset",new JSONObject());}catch(Exception error){credential.setError("Could not remove the saved token.");}});
        });dialog.show();
    }
    private void offlineStatus() {
        JSONObject info = new JSONObject();
        try { info.put("state", offlineFinbert.ready() ? "ready" : offlineFinbert.isInstalling() ? "downloading" : "not_installed");
              info.put("model", FinbertClassifier.MODEL_NAME);info.put("downloadBytes",FinbertClassifier.MODEL_BYTES+FinbertClassifier.VOCAB_BYTES);info.put("license",FinbertClassifier.LICENSE); } catch (Exception ignored) {}
        send("finbert_status", info);
    }
    private void installOfflineFinbert() {
        if(!foreground)return;
        if (offlineFinbert.ready()) { offlineStatus(); return; }
        final int uiTicket=offlineGeneration.incrementAndGet();final long operation=offlineFinbert.newOperation();
        offlineExecutor.execute(() -> {
            try {
                if(!foreground||uiTicket!=offlineGeneration.get())return;
                offlineFinbert.install(percent -> {
                    JSONObject data = object("progress", percent);
                    try { data.put("state", "downloading"); } catch (Exception ignored) {}
                    sendIf("finbert_status", data,()->foreground&&uiTicket==offlineGeneration.get());
                },operation);
                if(foreground&&uiTicket==offlineGeneration.get())offlineStatus();
            } catch (Exception error) {
                sendIf("finbert_status", object("state", "error"),()->foreground&&uiTicket==offlineGeneration.get());
                sendIf("finbert_error", object("message", "Model download failed: " + error.getMessage()),()->foreground&&uiTicket==offlineGeneration.get());
            }
        });
    }
    private void classifyOffline(String json) {
        if (!foreground||json == null || json.length() > 15000) return;
        final int uiTicket=offlineGeneration.incrementAndGet();final long operation=offlineFinbert.newOperation();
        offlineExecutor.execute(() -> {
            try {
                if(!foreground||uiTicket!=offlineGeneration.get())return;
                if (!offlineFinbert.ready()) { offlineStatus(); return; }
                JSONArray items = new JSONArray(json);
                JSONArray results = offlineFinbert.score(items,operation);
                sendIf("finbert_results", object("items", results),()->foreground&&uiTicket==offlineGeneration.get());
            } catch (Exception error) {
                sendIf("finbert_error", object("message", "Offline classification unavailable: " + error.getMessage()),()->foreground&&uiTicket==offlineGeneration.get());
            }
        });
    }
    private String storeFailure(Exception e){JSONObject out=object("ok",false);try{String code=e.getMessage();if(code==null||!code.matches("[a-z_]+"))code="storage_unavailable";out.put("code",code);out.put("revision",books.currentRevision());out.put("message","Records were not replaced. Reload the book or review recovery.");}catch(Exception ignored){}return out.toString();}
    private final class Bridge {
        @JavascriptInterface public String loadBook(){try{return books.load(false).toString();}catch(Exception e){return storeFailure(e);}}
        @JavascriptInterface public String restorePreviousBook(long revision){try{JSONObject out=books.restorePrevious(revision);invalidateAi("AI settings or the saved book changed. Review updated evidence before retrying.");return out.toString();}catch(Exception e){return storeFailure(e);}}
        @JavascriptInterface public String previousBook(){try{return books.load(true).toString();}catch(Exception e){return storeFailure(e);}}
        @JavascriptInterface public String saveBook(String json,long revision){try{JSONObject out=books.save(json,revision);invalidateAi("AI settings or the saved book changed. Review updated evidence before retrying.");return out.toString();}catch(Exception e){return storeFailure(e);}}
        @JavascriptInterface public String cacheGet(String key){try{return books.cacheGet(key).toString();}catch(Exception e){return storeFailure(e);}}
        @JavascriptInterface public String cachePut(String key,String json){try{books.cachePut(key,json);return object("ok",true).toString();}catch(Exception e){return storeFailure(e);}}

        @JavascriptInterface public void streamStart(){MainActivity.this.startStream();}
        @JavascriptInterface public void streamStop(){stopStream();}
        @JavascriptInterface public void minimize(){runOnUiThread(()->moveTaskToBack(true));}
        @JavascriptInterface public void ready(){runOnUiThread(()->{pageReady=true;status();});}
        @JavascriptInterface public void settings(){runOnUiThread(()->showSettings());}
        @JavascriptInterface public void refresh(String expiry){MainActivity.this.refresh(expiry);}
        @JavascriptInterface public void nseRefresh(){MainActivity.this.refreshNse();}
        @JavascriptInterface public void research(String request){MainActivity.this.research(request);}
        @JavascriptInterface public void aiConfig(String request){runOnUiThread(()->MainActivity.this.aiRequest(request,true));}
        @JavascriptInterface public void ai(String request){runOnUiThread(()->MainActivity.this.aiRequest(request,false));}
        @JavascriptInterface public void aiSettings(){runOnUiThread(()->showAiSettings());}
        @JavascriptInterface public void finbertStatus(){offlineStatus();}
        @JavascriptInterface public void finbertInstall(){runOnUiThread(()->{if(!foreground)return;if(offlineFinbert.ready()){offlineStatus();return;}new AlertDialog.Builder(MainActivity.this).setTitle("Download offline FinBERT?").setMessage("Download approximately 111 MB of model/tokenizer data. Mobile-data charges may apply. Pinned files are checksum verified. English headline classification runs locally and does not predict prices. Models are excluded from backups. Model license: CC BY-NC-SA 4.0 for personal noncommercial use.").setPositiveButton("Download",(d,w)->installOfflineFinbert()).setNegativeButton("Cancel",null).show();});}
        @JavascriptInterface public void finbertScore(String json){classifyOffline(json);}
        @JavascriptInterface public void finbertCancel(){cancelOffline();offlineStatus();}
        @JavascriptInterface public void finbertRemove(){cancelOffline();offlineExecutor.execute(()->{try{offlineFinbert.remove();offlineStatus();}catch(Exception e){send("finbert_error",object("message","Could not remove offline model."));}});}
        @JavascriptInterface public void aiCancel(String id){runOnUiThread(()->{if(id!=null&&id.equals(activeAiId)){invalidateAi("AI settings or the saved book changed. Review updated evidence before retrying.");if(consentDialog!=null)consentDialog.dismiss();activeAiId="";}});}
        @JavascriptInterface public void openLink(String url){runOnUiThread(()->MainActivity.this.openLink(url));}
        @JavascriptInterface public void exportBackup(String json){runOnUiThread(()->exportDocument(json,false));}
        @JavascriptInterface public void printReview() {
            runOnUiThread(() -> {
                if (!foreground || isFinishing() || web == null) return;
                try {
                    android.print.PrintManager printer = (android.print.PrintManager) getSystemService(PRINT_SERVICE);
                    String name = "HAL Desk review " + java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
                    printer.print(name, web.createPrintDocumentAdapter(name), null);
                } catch (RuntimeException error) {
                    send("file_error", object("message", "Android printing is unavailable."));
                }
            });
        }
        @JavascriptInterface public void exportCSV(String csv){runOnUiThread(()->exportDocument(csv,true));}
        @JavascriptInterface public void importHistory() {
            runOnUiThread(() -> {
                if (!foreground) return;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                pick.setType("*/*");
                pick.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/csv",
                        "text/comma-separated-values", "application/vnd.ms-excel", "text/plain",
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
                try { startActivityForResult(pick, 43); } catch (RuntimeException e) {
                    send("file_error", object("message", "The Android document picker is unavailable."));
                }
            });
        }
        @JavascriptInterface public void importBackup(){runOnUiThread(()->{try{Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("application/json");startActivityForResult(i,42);}catch(Exception e){send("file_error",object("message","A document picker is not available."));}});}
        @JavascriptInterface public void openTokenPage(){runOnUiThread(()->{
            try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse("https://account.upstox.com/developer/apps")));}
            catch(Exception error){send("error",object("code","browser_unavailable"));}
        });}
    }
    @Override protected void onPause(){backgroundAt=android.os.SystemClock.elapsedRealtime();foreground=false;generation.incrementAndGet();invalidateAi("AI review cancelled when the app left the foreground.");client.cancel();cancelOffline();stopStream();super.onPause();web.onPause();web.pauseTimers();}
    @Override protected void onResume(){super.onResume();long awayMs=backgroundAt<0?0:Math.max(0,android.os.SystemClock.elapsedRealtime()-backgroundAt);backgroundAt=-1;foreground=true;lastRequest=0;lastNseRequest=0;researchRequests.clear();if(web!=null){web.onResume();web.resumeTimers();if(pageReady){JSONObject resumed=object("state","resumed");try{resumed.put("awayMs",awayMs);}catch(Exception ignored){}send("lifecycle",resumed);offlineStatus();}}}
    @Override protected void onDestroy(){foreground=false;client.cancel();cancelOffline();streamGeneration.incrementAndGet();stream.shutdown();generation.incrementAndGet();invalidateAi("AI settings or the saved book changed. Review updated evidence before retrying.");executor.shutdownNow();researchExecutor.shutdownNow();nseExecutor.shutdownNow();aiExecutor.shutdownNow();offlineExecutor.shutdownNow();if (offlineFinbert!=null)offlineFinbert.close();if(web!=null){web.removeJavascriptInterface("HALNative");web.destroy();}if(books!=null)books.close();super.onDestroy();}
    @Override public void onBackPressed(){if(pageReady)web.evaluateJavascript("window.HALApp && window.HALApp.back()",null);else super.onBackPressed();}
}


