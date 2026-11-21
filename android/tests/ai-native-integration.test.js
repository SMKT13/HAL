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
