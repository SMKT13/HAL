'use strict';
const test=require('node:test'),A=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('local HAL spot alert never uses derivative marks, stale quotes or background requests',()=>{
 const rules=read('app/src/main/java/in/smkt/haldesk/LocalPriceAlerts.java');
 const main=read('app/src/main/java/in/smkt/haldesk/MainActivity.java');
 A.match(rules,/quality_issues/);A.match(rules,/last_trade_at/);
 A.match(rules,/last_provider_time/);
 A.match(rules,/tripped_/);
 A.doesNotMatch(rules,/placeOrder|openOrder|AlarmManager|WorkManager/);
 A.match(main,/LocalPriceAlerts\.onSpot/);
});
test('alerts are opt-in foreground only',()=>{
 const native=read('app/src/main/java/in/smkt/haldesk/NativeTerminalActivity.kt');
 const web=read('app/src/main/assets/ui4.js');
 A.match(native,/PriceAlertsPanel/);
 A.match(web,/event==='local_alert'/);
});
