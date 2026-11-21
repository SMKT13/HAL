'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('native AI Desk remains private, read-only and reachable from native terminal',()=>{
 const manifest=read('app/src/main/AndroidManifest.xml');
 const compose=read('app/src/main/java/in/smkt/haldesk/NativeAiDeskActivity.kt');
 const terminal=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 assert.match(manifest,/<activity android:name="\.NativeAiDeskActivity" android:exported="false"/);
 assert.match(compose,/private fun NativeAiDesk\(/);
 assert.match(compose,/listOf\("Brief", "Ask Atlas", "Deep Research"\)/);
 assert.match(compose,/AiHistoryStore\(applicationContext\)\.list\(\)/);
 assert.doesNotMatch(compose,/AiClient\(|\.generate\(|submitOrder|placeOrder/);
 assert.match(terminal,/Intent\(context, NativeAiDeskActivity::class\.java\)/);
});
test('native-to-WebView navigation remains validated and opt-in',()=>{
 const main=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 const ui=read('app/src/main/assets/ui4.js');
 assert.match(main,/private void openRequestedAiDesk\(\)/);
 assert.match(main,/if\(!"brief"\.equals\(page\)&&!"assistant"\.equals\(page\)&&!"deep"\.equals\(page\)\)return/);
 assert.match(main,/window\.HALApp\.openAiDesk/);
 assert.match(ui,/openAiDesk:page=>\{if\(\['brief','assistant','deep'\]\.includes\(page\)\)navigate\('ai',page\)/);
 assert.match(main,/setPositiveButton\("Send to Gemini"/);
});
test('deep research can explicitly exclude private financial records',()=>{
 const ui=read('app/src/main/assets/ui4.js');
 const agents=read('app/src/main/java/in/smkt/haldesk/AgentDesk.java');
 assert.match(ui,/id="ai-deep-share"/);
 assert.match(ui,/includePortfolio:ui.share/);
 assert.match(agents,/if\(evidence.optBoolean\("portfolioIncluded",false\)\&\&/);
});
test('encrypted conversation transcripts and search are local and revision-aware',()=>{
 const ui=read('app/src/main/assets/ui4.js');
 assert.match(ui,/function aiConversationTranscript\(\)/);
 assert.match(ui,/item\.conversationId\|\|item\.id/);
 assert.match(ui,/item\.id!==ui\.ai\?\.historyId/);
 assert.match(ui,/Historical answer, not a live market observation/);
 assert.match(ui,/ai-history-search/);
 assert.match(ui,/ai-history-reset/);
 assert.match(ui,/function aiHistoryRead\(\)/);
});
test('exporting a saved AI report requires explicit native review and consent',()=>{
 const native=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 const ui=read('app/src/main/assets/ui4.js');
 assert.match(native,/private void shareAiHistory\(String id\)/);
 assert.match(native,/setTitle\("Share this AI report\?"\)/);
 assert.match(native,/setPositiveButton\("Share selected report"/);
 assert.match(native,/new Intent\(Intent\.ACTION_SEND\)/);
 assert.match(native,/setNegativeButton\("Cancel",null\)/);
 assert.match(ui,/'ai-history-share':b=>native\('aiHistoryShare',b\.dataset\.id\)/);
});
test('native AI Brief uses verified read-only Room coverage, not guessed P&L',()=>{
 const ui=read('app/src/main/java/in/smkt/haldesk/NativeAiDeskActivity.kt');
 assert.match(ui,/RoomReadOnlyPreview\.read\(context\)/);
 assert.match(ui,/ledgerReconciled/);
 assert.match(ui,/contractDifferences/);
 assert.match(ui,/legacyOnly/);
 assert.match(ui,/nominalCoverage\(exposure/);
 assert.match(ui,/not a guaranteed loss floor/);
 assert.doesNotMatch(ui,/openOrCreateDatabase\(|writableDatabase|insert\(|UPDATE TradeLedgerEntity/);
});
test('all AI modes preserve bounded monetary evidence and reported token usage',()=>{
 const client=read('app/src/main/java/in/smkt/haldesk/AiClient.java');
 const agents=read('app/src/main/java/in/smkt/haldesk/AgentDesk.java');
 const history=read('app/src/main/java/in/smkt/haldesk/AiHistoryStore.java');
 const ui=read('app/src/main/assets/ui4.js');
 const validator=read('app/src/main/java/in/smkt/haldesk/AiNumericClaimGuard.java');
 assert.match(client,/AiUsageMetrics\.fromProvider\(response\.optJSONObject\("usageMetadata"\)\)/);
 assert.match(agents,/AiUsageMetrics\.combine\(usage,result\.optJSONObject\("usage"\)\)/);
 assert.match(agents,/AiNumericClaimGuard\.validateFreeForm\(reply,packet\)/);
 assert.match(validator,/private static void technicalPrices\(/);
 assert.match(history,/item\.put\("usage",AiUsageMetrics\.fromProvider\(usage\)\)/);
 assert.match(ui,/Google-reported tokens/);
 assert.match(ui,/Not a billing statement/);
});
test('AI WebView bridge cannot load untrusted network pages',()=>{
 const main=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 assert.match(main,/setAllowFileAccess\(false\)/);
 assert.match(main,/setAllowContentAccess\(false\)/);
 assert.match(main,/setAllowUniversalAccessFromFileURLs\(false\)/);
 assert.match(main,/setMixedContentMode\(WebSettings\.MIXED_CONTENT_NEVER_ALLOW\)/);
 assert.match(main,/shouldOverrideUrlLoading\(WebView view,WebResourceRequest request\)\{return true;/);
 assert.match(main,/for\(String name:new String\[\]\{"index\.html","desk4\.js","nse4\.js","style4\.css"\}\)/);
 assert.match(main,/web\.setWebViewClient\(new WebViewClient\(\)/);
});
test('structured answers, privacy and history routing retain safety boundaries',()=>{
 const main=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 const client=read('app/src/main/java/in/smkt/haldesk/AiClient.java');
 const store=read('app/src/main/java/in/smkt/haldesk/AiHistoryStore.java');
 assert.match(client,/AiStructuredReply\.validate\(reply,evidence\)/);
 assert.match(main,/AiPolicy\.evidenceDigest\(new JSONObject\(\)\.put\("items",accepted\)\)/);
 assert.match(main,/includeConversation/);
 assert.match(store,/AiConversationContext\.select\(valid,threadId,currentRevision,allowPortfolio\)/);
 assert.match(store,/Cipher\.getInstance\("AES\/GCM\/NoPadding"\)/);
 assert.doesNotMatch(store,/deleteDatabase\(|clearApplicationUserData\(/);
});
