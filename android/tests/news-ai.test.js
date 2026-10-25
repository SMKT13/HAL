const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/news-ai.js'),'utf8');
const status={textContent:''},button={hidden:false,disabled:true,textContent:'',onclick:null};
const nativeCalls=[],ctx={
  document:{getElementById(id){return {'finbert-status':status,'finbert-install':button}[id]||null;}},
  HALNative:{finbertInstall(){nativeCalls.push(['install']);},finbertScore(s){nativeCalls.push(['score',JSON.parse(s)]);}},
  allNews:[{url:'https://nseindia.com/1',title:'HAL reports a large contract win'}],
  renderNews(){ctx.renderCount=(ctx.renderCount||0)+1;},
  console
};
vm.createContext(ctx);vm.runInContext(source,ctx);const ai=vm.runInContext('HALNewsAI',ctx);
ai.bind();assert.equal(button.disabled,true,'No button action before native check');
ai.receive('finbert_status',{state:'not_installed'});assert.equal(button.disabled,false);
assert.equal(nativeCalls.length,0,'No model download without user action');
button.onclick();assert.deepEqual(nativeCalls[0],['install']);assert.equal(button.disabled,true);
ai.receive('finbert_status',{state:'ready'});
assert.equal(button.hidden,true);assert.equal(nativeCalls.length,2,'Only explicit download then offline scoring');
assert.equal(nativeCalls[1][0],'score');
assert.deepEqual(JSON.parse(JSON.stringify(nativeCalls[1][1])),[{id:'https://nseindia.com/1',title:'HAL reports a large contract win'}]);
assert.ok(!JSON.stringify(nativeCalls).includes('position') && !JSON.stringify(nativeCalls).includes('token'));
ai.maybeScore(ctx.allNews);assert.equal(nativeCalls.length,2,'No duplicate scoring for same news');
assert.equal(ai.decorate(ctx.allNews[0]),'','No fabricated score before model result');
ai.receive('finbert_results',{items:[{id:'https://nseindia.com/1',label:'positive',confidence:.89}]});
assert.match(ai.decorate(ctx.allNews[0]),/Positive \(89% confidence\)/);assert.equal(ctx.renderCount,1);
ai.receive('finbert_results',{items:[{id:'https://nseindia.com/1',label:'javascript:<img>',confidence:1.0}]});
assert.match(ai.decorate(ctx.allNews[0]),/Positive/,'Invalid label must never reach HTML');
ctx.allNews=[{url:'https://nseindia.com/1',title:'Updated report'}];ai.maybeScore(ctx.allNews);
assert.equal(nativeCalls.length,3,'Updated headline must be classified again');
ai.receive('finbert_error',{message:'Mock native error'});assert.match(status.textContent,/Mock native error/);
assert.ok(!button.hidden,'Retry should be possible after failure');
console.log('offline news classifier UI tests passed');
