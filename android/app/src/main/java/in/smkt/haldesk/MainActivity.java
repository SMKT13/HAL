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
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public final class MainActivity extends Activity {
    private WebView web;
    private SecretStore secrets;
    private SharedPreferences prefs;
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private final ExecutorService researchExecutor=Executors.newFixedThreadPool(2);
    private final ConcurrentHashMap<String,Long> researchRequests=new ConcurrentHashMap<>();
    private byte[] pendingExport;
    private final AtomicBoolean working=new AtomicBoolean(false);
    private volatile MarketClient client=new MarketClient();
    private volatile int generation=0;
    private volatile long lastRequest=0;
    private static final String ORIGIN="https://appassets.androidplatform.net/";
    private boolean pageReady=false;
    private boolean settingsShowing=false;
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
        JSONObject obj=new JSONObject();try{obj.put("mode",mode());obj.put("configured",secrets.has(mode()));obj.put("version","2.1");}catch(Exception ignored){}
        send("connection",obj);
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
                new AlertDialog.Builder(this).setTitle("Forget saved credentials?").setMessage("Your manual positions stay on this phone.")
                    .setPositiveButton("Forget",(a,b)->{generation++;secrets.clear();client=new MarketClient();lastRequest=0;dialog.dismiss();status();send("reset",new JSONObject());})
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
    @Override protected void onDestroy(){generation++;executor.shutdownNow();researchExecutor.shutdownNow();if(web!=null){web.removeJavascriptInterface("HALNative");web.destroy();}super.onDestroy();}
    @Override public void onBackPressed(){if(pageReady)web.evaluateJavascript("window.HALApp.back()",null);else super.onBackPressed();}
}
