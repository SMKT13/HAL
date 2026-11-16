package in.smkt.haldesk;
import android.webkit.WebView;
import android.webkit.WebSettings;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import java.lang.reflect.Field;
import static org.junit.Assert.*;
/** Synthetic lifecycle checks; no provider token or network call is configured. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk={26,35})
public class PlatformSafetyTest {
 @org.robolectric.annotation.Implements(WebView.class)
 public static class UnavailableWebView extends org.robolectric.shadows.ShadowWebView {
  @org.robolectric.annotation.Implementation
  protected void __constructor__(android.content.Context context) {
   throw new android.util.AndroidRuntimeException("No WebView provider installed");
  }
 }

 @Test @Config(shadows=UnavailableWebView.class)
 public void missingWebViewShowsRecoveryAndSurvivesPause() {
  ActivityController<MainActivity> activity=Robolectric.buildActivity(MainActivity.class).create().start().resume();
  android.app.AlertDialog dialog=org.robolectric.shadows.ShadowAlertDialog.getLatestAlertDialog();
  assertNotNull(dialog);
  assertEquals("Retry",dialog.getButton(android.app.AlertDialog.BUTTON_POSITIVE).getText());
  activity.pause().stop().destroy();
 }

 @Test public void trustedOriginAndWebViewRestrictionsSurviveLifecycle() throws Exception {
  ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).create().start().resume();
  Field field=MainActivity.class.getDeclaredField("web");field.setAccessible(true);
  WebView web=(WebView)field.get(controller.get());WebSettings settings=web.getSettings();
  assertEquals("https://appassets.androidplatform.net/index.html",web.getUrl());
  assertFalse(settings.getAllowFileAccess());assertFalse(settings.getAllowContentAccess());
  assertFalse(settings.getJavaScriptCanOpenWindowsAutomatically());
  assertEquals(WebSettings.MIXED_CONTENT_NEVER_ALLOW,settings.getMixedContentMode());
  controller.pause().stop().destroy();
 }

 private Object field(MainActivity a,String name)throws Exception{Field f=MainActivity.class.getDeclaredField(name);f.setAccessible(true);return f.get(a);}
 @Test public void pauseInvalidatesAllOperationTicketsAndResumeClearsThrottle()throws Exception{
  ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).create().start().resume();MainActivity a=c.get();
  String[] names={"generation","aiGeneration","offlineGeneration","streamGeneration"};int[] before=new int[names.length];for(int i=0;i<names.length;i++)before[i]=((java.util.concurrent.atomic.AtomicInteger)field(a,names[i])).get();
  FinbertClassifier f=(FinbertClassifier)field(a,"offlineFinbert");long ticket=f.newOperation();
  ((java.util.Map)field(a,"researchRequests")).put("candles:D:consolidated",123L);
  Field last=MainActivity.class.getDeclaredField("lastRequest");last.setAccessible(true);last.setLong(a,123L);c.pause();
  for(int i=0;i<names.length;i++)assertTrue(names[i],((java.util.concurrent.atomic.AtomicInteger)field(a,names[i])).get()>before[i]);
  try{f.score(new org.json.JSONArray(),ticket);fail("paused operation ran");}catch(java.io.IOException e){assertTrue(e.getMessage().contains("cancelled"));}
  c.resume();assertEquals(0,last.getLong(a));assertTrue(((java.util.Map)field(a,"researchRequests")).isEmpty());c.pause().stop().destroy();
 }
 @Test public void queuedMarketResultIsCheckedAgainAtUiDispatch()throws Exception{
  ActivityController<MainActivity> c=Robolectric.buildActivity(MainActivity.class).create().start().resume();MainActivity a=c.get();Field ready=MainActivity.class.getDeclaredField("pageReady");ready.setAccessible(true);ready.setBoolean(a,true);
  int ticket=((java.util.concurrent.atomic.AtomicInteger)field(a,"generation")).get();java.lang.reflect.Method send=MainActivity.class.getDeclaredMethod("sendMarket",String.class,org.json.JSONObject.class,int.class);send.setAccessible(true);
  java.util.concurrent.atomic.AtomicReference<Throwable> error=new java.util.concurrent.atomic.AtomicReference<>();Thread worker=new Thread(()->{try{send.invoke(a,"snapshot",new org.json.JSONObject().put("marker","SYNTH_STALE"),ticket);}catch(Throwable e){error.set(e);}});worker.start();worker.join();assertNull(error.get());c.pause();org.robolectric.Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();String script=org.robolectric.Shadows.shadowOf((WebView)field(a,"web")).getLastEvaluatedJavascript();assertFalse(script!=null&&script.contains("SYNTH_STALE"));c.stop().destroy();
 }
}
