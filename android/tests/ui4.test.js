'use strict';
const fs=require('fs'),path=require('path'),A=require('assert/strict');let pw;try{pw=require(process.env.HAL_PLAYWRIGHT_MODULE||'playwright')}catch(_){pw=require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')};const E=require('../app/src/main/assets/engine4.js');
const origin='https://appassets.androidplatform.net/',root=path.resolve(__dirname,'../app/src/main/assets'),now=Date.parse('2026-11-01T06:30:00Z'),ts=new Date(now-1000).toISOString();const FUT={id:'f',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:150,entry:4927.35,manual:null,instrumentKey:'SYNTH_F'},PUT={id:'p',type:'PE',expiry:'2026-11-23',strike:4500,lots:1,lotSize:150,entry:38.9,manual:null,instrumentKey:'SYNTH_P'};
const q=p=>({last_price:p,bid:p-.5,ask:p+.5,bid_quantity:900,ask_quantity:900,quote_as_of:ts,last_trade_at:ts,retrieved_at:ts,volume:1000,open_interest:5000});const snap={fetched_at_iso:ts,spot:{...q(4950),prev_close:4900},futures:[{instrument_key:'SYNTH_F',expiry:FUT.expiry,lot_size:150,quote:q(5000)}],option_expiry:PUT.expiry,available_expiries:[PUT.expiry],option_rows:[{strike:4500,put:{instrument_key:'SYNTH_P',lot_size:150,iv:30,delta:-.3,theta:-.2,quote:q(50)}}]};let browser,checks=0;
const click=(p,a)=>p.locator(`[data-action="${a}"]`).first().click(),nav=async(p,a,b)=>{await p.locator(`[data-screen="${a}"]`).click();if(b)await p.locator(`[data-sub="${b}"]`).click()},emit=(p,event,data)=>p.evaluate(({event,data})=>HALApp.receive(event,data),{event,data});
async function save(p){await p.locator('#modal-save').click();A.equal(await p.locator('#modal-error').innerText(),'');A.equal(await p.locator('#modal').isVisible(),false)}async function check(name,fn){await fn();console.log('PASS '+name);checks++}
async function pageFor(seed={}){const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route(origin+'**',r=>{const name=new URL(r.request().url()).pathname.slice(1)||'index.html',file=path.join(root,name);return fs.existsSync(file)?r.fulfill({path:file,contentType:name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript'}):r.abort()});await page.clock.install({time:new Date(now)});await page.addInitScript(seed=>{window.saved=seed.book||null;window.rev=0;window.previous=null;window.calls=[];window.corrupt=seed.corrupt;window.forceSaveFailure=false;window.reviewCache=seed.cache||{};window.forceCacheFailure=false;if(seed.legacy)localStorage.setItem('hal_desk_v2',JSON.stringify(seed.legacy));const log=(n,...a)=>calls.push([n,...a]);window.HALNative={loadBook:()=>JSON.stringify(corrupt?{ok:false,revision:rev,message:'checksum invalid'}:{ok:true,book:saved,revision:rev}),saveBook:(s,r)=>{if(forceSaveFailure)return JSON.stringify({ok:false,message:'synthetic disk failure'});if(r!==rev)return JSON.stringify({ok:false,message:'conflict'});previous=saved;saved=JSON.parse(s);return JSON.stringify({ok:true,revision:++rev})},previousBook:()=>JSON.stringify({ok:true,book:previous}),restorePreviousBook:r=>{if(r!==rev)return JSON.stringify({ok:false,message:'conflict'});saved=previous;corrupt=false;return JSON.stringify({ok:true,book:saved,revision:++rev})},cacheGet:key=>JSON.stringify({ok:true,data:reviewCache[key]||null}),cachePut:(key,value)=>{if(forceCacheFailure)return JSON.stringify({ok:false});reviewCache[key]=JSON.parse(value);return JSON.stringify({ok:true})},ready:()=>{},finbertStatus:()=>{}};for(const n of ['research','refresh','nseRefresh','settings','aiSettings','openTokenPage','exportBackup','exportCSV','importBackup','importHistory','printReview','ai','aiCancel','finbertInstall','finbertCancel','finbertRemove','finbertScore','streamStart','streamStop','openLink','minimize'])HALNative[n]=(...a)=>log(n,...a)},seed);await page.goto(origin);await page.locator('h1').waitFor();return {page,context,errors}}
const launch=()=>pw.chromium.launch({executablePath:process.env.HAL_BROWSER,headless:true,args:['--no-sandbox','--single-process','--no-zygote']});(async()=>{browser=await launch();try{let x=await pageFor(),p=x.page;
await check('fresh empty book and every primary/subsection renders',async()=>{A.match(await p.locator('main').innerText(),/No open book/);A.deepEqual(await p.locator('.bottom-nav button').evaluateAll(nodes=>nodes.map(n=>n.dataset.screen)),['position','history','technicals','research','ai']);for(const [a,bs]of [['position',['overview','book','performance','risk','journal','stress','compare','hedge','break-even']],['history',[]],['technicals',['markets','indicators','insights']],['research',['company','news']],['ai',['assistant','coach']]]){await nav(p,a);for(const b of bs)await nav(p,a,b);}A.deepEqual(x.errors,[]);A.equal((await p.evaluate(()=>calls.filter(c=>['ai','finbertInstall'].includes(c[0])))).length,0)});
await check('HAL Desk 5 risk ladder and mixed-expiry modal preserve real book',async()=>{
 const savedBook={...E.emptyBook(),legs:[FUT,PUT]};
 const {page:rp,context:rc,errors:re}=await pageFor({book:savedBook});
 await nav(rp,'position','risk');
 A.match(await rp.locator('main').innerText(),/Protection by date/);
 A.match(await rp.locator('main').innerText(),/24 Nov 2026/);
 const before=await rp.evaluate(()=>JSON.stringify(saved));
 await click(rp,'v5-settlement');
 await rp.locator('#v5-opt-2026-11-23').fill('4300');
 await rp.locator('#v5-fut-2026-12-29').fill('5000');
 await save(rp);
 A.match(await rp.locator('main').innerText(),/Lifetime net under scenario/);
 A.equal(await rp.evaluate(()=>JSON.stringify(saved)),before);
 A.deepEqual(re,[]);
 await rc.close();
});
await check('HAL Desk 5 Monte Carlo stress does not modify real trade book',async()=>{
 const {page:qp,context:qc,errors:qe}=await pageFor({book:{...E.emptyBook(),legs:[FUT,PUT]}});
 await emit(qp,'snapshot',snap);await nav(qp,'position','stress');
 const before=await qp.evaluate(()=>JSON.stringify(saved));
 await qp.locator('#sc-horizon').fill('2026-11-15');
 await qp.locator('#mc-vol').fill('30');
 await click(qp,'mc-run');
 A.match(await qp.locator('main').innerText(),/Conditional model distribution/);
 A.match(await qp.locator('main').innerText(),/Worst 5% mean/);
 A.equal(await qp.evaluate(()=>JSON.stringify(saved)),before);
 A.deepEqual(qe,[]);
 await qc.close();
});
await check('Options Lab paper chain, payoff and actual-book isolation',async()=>{
 await emit(p,'snapshot',snap);
 await nav(p,'technicals','lab');
 A.match(await p.locator('main').innerText(),/Options chain/i);
 A.ok(await p.locator('[data-action="lab-add"]').count());
 await click(p,'lab-add');
 A.match(await p.locator('main').innerText(),/Hypothetical legs/);
 await click(p,'lab-paper-save');
 const result=await p.evaluate(()=>({paper:reviewCache['research:optionslab_paper'],book:saved}));
 A.equal(result.paper.version,1);A.equal(result.paper.drafts.length,1);A.equal(result.paper.drafts[0].legs[0].type,'PE');
 A.equal(result.book?.legs?.length||0,0);
 await p.locator('[data-action="lab-tab"][data-id="payoff"]').click();
 A.ok(await p.locator('.lab-chart svg').count());
 A.match(await p.locator('main').innerText(),/Exact intrinsic-value payoff/);
 A.deepEqual(x.errors,[]);
});
await check('Options Lab advanced library, local OI history, Greeks, watchlist and manual event',async()=>{
 await emit(p,'snapshot',snap);await nav(p,'technicals','lab');
 A.equal(await p.locator('[data-action="lab6-page"]').count(),5);
 await p.locator('[data-action="lab6-page"][data-id="catalog"]').click();
 A.match(await p.locator('main').innerText(),/38 reference categories/);
 await p.locator('[data-action="lab6-build"][data-id="buy_put"]').click();
 A.match(await p.locator('main').innerText(),/Hypothetical legs/);
 await p.locator('[data-action="lab6-page"][data-id="greeks"]').click();
 A.match(await p.locator('main').innerText(),/MODEL NET DELTA/i);
 await p.locator('[data-action="lab6-page"][data-id="oi"]').click();
 await click(p,'lab6-capture');
 const captured=await p.evaluate(()=>reviewCache['research:optionslab_oi_history']);
 A.equal(captured.samples.length,1);A.equal(captured.samples[0].expiry,PUT.expiry);
 A.match(await p.locator('main').innerText(),/IV percentile/i);
 await p.locator('[data-action="lab6-page"][data-id="journal"]').click();
 await p.locator('[data-action="lab6-watch"]').first().click();
 A.equal((await p.evaluate(()=>reviewCache['research:optionslab_workspace'].watch)).length,1);
 await p.locator('#lab6-event-date').fill('2026-11-20');
 await p.locator('#lab6-event-title').fill('HAL results review');
 await click(p,'lab6-event-add');
 A.match(await p.locator('main').innerText(),/HAL results review/);
 A.equal((await p.evaluate(()=>reviewCache['research:optionslab_workspace'].events)).length,1);
 await p.locator('#lab6-note-text').fill('Stay inside the plan; no automatic order execution.');
 await click(p,'lab6-note-add');
 A.match(await p.locator('main').innerText(),/Stay inside the plan/);
 A.equal(await p.evaluate(()=>saved?.legs?.length||0),0);
 A.deepEqual(x.errors,[]);
});
await check('failed Options Lab cache writes cannot silently replace PAPER records or watchlists',async()=>{
 await nav(p,'technicals','lab');
 await p.locator('[data-action="lab6-page"][data-id="journal"]').click();
 const beforeResearch=await p.evaluate(()=>JSON.stringify(reviewCache['research:optionslab_workspace']));
 await p.evaluate(()=>window.forceCacheFailure=true);
 await p.locator('[data-action="lab6-watch"]').first().click();
 A.equal(await p.evaluate(()=>JSON.stringify(reviewCache['research:optionslab_workspace'])),beforeResearch);
 A.match(await p.locator('main').innerText(),/Native storage rejected changes/);
 await p.evaluate(()=>window.forceCacheFailure=false);
 await p.locator('[data-action="lab6-page"][data-id="core"]').click();
 await p.locator('[data-action="lab-tab"][data-id="paper"]').click();
 const beforePaper=await p.evaluate(()=>JSON.stringify(reviewCache['research:optionslab_paper']));
 await p.evaluate(()=>window.forceCacheFailure=true);
 await p.locator('[data-action="lab-delete"]').first().click();
 A.equal(await p.evaluate(()=>JSON.stringify(reviewCache['research:optionslab_paper'])),beforePaper);
 A.match(await p.locator('main').innerText(),/PAPER snapshot|PAPER write|Previous PAPER/);
 await p.evaluate(()=>window.forceCacheFailure=false);
 A.deepEqual(x.errors,[]);
});
await check('official NSE lens is independent, cacheable, escaped and never a derivatives mark',async()=>{
 await nav(p,'technicals','markets');
 await p.locator('#nse-insights').waitFor();
 A.ok((await p.evaluate(()=>calls.filter(c=>c[0]==='nseRefresh'))).length>=1);
 await emit(p,'nse_snapshot',{
  source:'NSE official MCP (personal research only)',retrieved_at:ts,errors:[],
  live:{stock:{symbol:'HAL',lastTradedPrice:4843.4,change:-105.6,perChange:-2.13,exchange_time_iso:ts,
   preClosePrice:4949,volume:2596682,openPrice:4962,highPrice:5017.9,lowPrice:4736.6},
   nifty50:{index:{last:25299.35,percChange:0.18}},india_vix:{index:{last:16.61,percChange:-5.38}}},
  historical:{sma20:4907.805,sma50:4833.088,sma200:4470.978,volume:{last_volume:2596682,avg_volume:835966},
   levels:{as_of:'2026-11-12',low_5:4736.6,high_5:5119,low_20:4716.3,high_20:5119,
    pivot:4865.97,s1:4714.03,r1:4995.33,recent_closes:[{date:'2026-11-11',close:4949},{date:'2026-11-12',close:4843.4}]},
   relative:{stock:{return_pct:1.75},index:{return_pct:13.13},outperformance_pct_points:-11.38,date:'2026-11-12',base_date:'2026-10-12'},
   breadth:{date:'2026-11-12',advances:1989,declines:1621},
   corporate_actions:{actions:[{exDate:'2026-08-14',actionType:'DIVIDEND',purpose:'<img src=x onerror="window.nsePwned=1">'}]}}
 });
 const panel=p.locator('#nse-insights');
 A.match(await panel.innerText(),/4,843.40/);
 A.match(await panel.innerText(),/200-day SMA/);
 A.match(await panel.innerText(),/Relative outperformance/);
 A.equal(await p.evaluate(()=>window.nsePwned),undefined);
 A.ok((await p.evaluate(()=>Object.keys(reviewCache))).includes('nse_insights_v1'));
 await nav(p,'position','overview');A.match(await p.locator('main').innerText(),/No open book/);
});
await check('empty scenario blocked',async()=>{await nav(p,'position','stress');await click(p,'scenario');A.match(await p.locator('#toast').innerText(),/Record/)});
await check('offline futures editor blocks zero mark and accepts positive manual price',async()=>{await nav(p,'position','book');await click(p,'add');for(const [k,v]of Object.entries({expiry:'2026-12-29',lots:'2',size:'150',entry:'4927.35',manual:'0'}))await p.locator('#leg-'+k).fill(v);await p.locator('#modal-save').click();A.match(await p.locator('#modal-error').innerText(),/greater than zero/);A.equal(await p.locator('#modal').isVisible(),true);await p.locator('#leg-manual').fill('5000');await save(p);A.equal(await p.evaluate(()=>saved.legs[0].manual),5000);A.match(await p.locator('main').innerText(),/21,795/);A.ok(!(await p.locator('main').innerText()).includes('14,78,205'))});
await check('partial close retains realised history and fees',async()=>{await click(p,'close');await p.locator('#close-lots').fill('1');await p.locator('#close-exit').fill('5000');await p.locator('#close-fees').fill('10');await p.locator('#close-note').fill('PRIVATE_MEMO');await save(p);const b=await p.evaluate(()=>saved);A.equal(b.legs[0].lots,1);A.equal(b.journal[0].fees,10)});
await check('explicit book confirmation then edit invalidation',async()=>{await click(p,'confirm');await p.locator('#confirm-check').check();await save(p);A.ok(await p.evaluate(()=>saved.riskProfile.confirmedAt));await click(p,'edit');await p.locator('#leg-manual').fill('4900');await save(p);A.equal(await p.evaluate(()=>saved.riskProfile.confirmedAt),null)});
await check('backup export and previous-book recovery',async()=>{await nav(p,'position','journal');await click(p,'export');const b=await p.evaluate(()=>JSON.parse(calls.find(c=>c[0]==='exportBackup')[1]));A.equal(b.schema,4);A.equal(b.book.journal.length,1);await click(p,'recovery');await save(p);A.equal(await p.evaluate(()=>saved.legs[0].manual),5000)});
await check('import preview requires explicit replacement and rejects corruption',async()=>{await emit(p,'import_preview',{schema:4,book:{...E.emptyBook(),legs:[FUT,PUT]}});await p.locator('#modal-save').click();A.match(await p.locator('#modal-error').innerText(),/Confirm/);await p.locator('#import-confirm').check();await save(p);A.equal(await p.evaluate(()=>saved.legs.length),2);await emit(p,'import_preview',{schema:999,book:{}});A.match(await p.locator('#toast').innerText(),/rejected/)});
await check('REST multi-leg accounting and missing data state',async()=>{await emit(p,'snapshot',snap);await nav(p,'position','overview');A.match(await p.locator('main').innerText(),/23,460/);await emit(p,'snapshot',{...snap,option_rows:[]});A.match(await p.locator('main').innerText(),/Unavailable/);await emit(p,'snapshot',snap)});
await check('mixed-expiry scenario rejects later horizon, zero spot remains zero',async()=>{await nav(p,'position','stress');await p.locator('#sc-horizon').fill('2026-12-01');await p.locator('#scenario-advanced').evaluate(el=>el.open=true);await p.locator('#sc-iv').fill('30');await click(p,'scenario');A.match(await p.locator('main').innerText(),/Scenario unavailable/);await p.locator('#sc-horizon').fill('');await p.locator('#sc-spot').fill('0');await click(p,'scenario');A.ok(!(await p.locator('main').innerText()).includes('23,460.00'))});
await check('failed refresh visibly retains observations',async()=>{await emit(p,'error',{code:'network_unavailable'});A.match(await p.locator('#notice').innerText(),/Network unavailable/)});
await check('completed candles render charts and valid historical pattern dates',async()=>{const candles=Array.from({length:260},(_,i)=>{const c=4000+i*3+Math.sin(i/5)*40;return [new Date(now-(260-i)*E.DAY).toISOString(),c-2,c+15,c-12,c,1000+i]});for(const section of ['candles','patterns'])await emit(p,'research',{section,frame:'D',fetched_at_iso:ts,data:{history:{candles}}});await nav(p,'technicals','markets');A.ok(await p.locator('#market-chart canvas').count());A.ok(!(await p.locator('#toast').innerText()).includes('is not a function'));A.equal(await p.evaluate(()=>document.querySelector('#market-chart').querySelectorAll('canvas').length>=2),true);await nav(p,'technicals','insights');await click(p,'patterns');A.ok(!(await p.locator('main').innerText()).includes('1970'));A.deepEqual(x.errors,[])});
await check('stream display never overwrites REST mark',async()=>{await emit(p,'snapshot',snap);await nav(p,'technicals','markets');await emit(p,'stream',{state:'decoded_quotes',frames:2,feed_ts:now,rows:[{key:'SYNTH_F',price:7777}]});A.match(await p.locator('#stream-view').innerText(),/7,777/);await nav(p,'position','overview');A.match(await p.locator('main').innerText(),/23,460/)});
await check('news HTML remains escaped',async()=>{await emit(p,'research',{section:'news',frame:'D',fetched_at_iso:ts,data:{articles:{articles:{SYNTH:[{heading:'HAL <img src=x onerror="window.pwned=1"> contract',article_link:'https://example.com/hal',published_time:now-1000}]}}}});await nav(p,'research','news');A.match(await p.locator('main').innerText(),/HAL <img/);A.equal(await p.locator('main img').count(),0);A.equal(await p.evaluate(()=>window.pwned),undefined)});
await check('AI exact evidence consent, research exclusion, reply and cancellation',async()=>{await nav(p,'ai','assistant');await p.locator('#ai-mode').selectOption('research');await click(p,'ai-review');const e=JSON.parse(await p.locator('#modal-body pre').innerText());A.equal(e.evidence.portfolioIncluded,false);A.ok(!JSON.stringify(e).includes('PRIVATE_MEMO'));await p.locator('#modal-save').click();A.match(await p.locator('#modal-error').innerText(),/consent/);A.equal((await p.evaluate(()=>calls.filter(c=>c[0]==='ai'))).length,0);await p.locator('#ai-consent').check();await save(p);const req=await p.evaluate(()=>JSON.parse(calls.filter(c=>c[0]==='ai').at(-1)[1]));await emit(p,'ai_result',{id:req.id,data:{reply:'Synthetic answer',portfolioIncluded:false}});A.match(await p.locator('main').innerText(),/Synthetic answer/);await click(p,'ai-review');await p.locator('#ai-consent').check();await save(p);await click(p,'ai-cancel');A.equal((await p.evaluate(()=>calls.filter(c=>c[0]==='aiCancel'))).length,1)});
await check('FinBERT stays opt-in and light/dark responsive layouts fit',async()=>{A.equal((await p.evaluate(()=>calls.filter(c=>c[0]==='finbertInstall'))).length,0);await nav(p,'research','news');await click(p,'model-install');A.equal((await p.evaluate(()=>calls.filter(c=>c[0]==='finbertInstall'))).length,1);await p.locator('#settings').click();await p.locator('#theme').selectOption('light');await save(p);A.ok(await p.locator('body.light').count());for(const width of [320,390,768]){await p.setViewportSize({width,height:844});await nav(p,'position','overview');A.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}const qa=path.resolve(__dirname,'../../qa');fs.mkdirSync(qa,{recursive:true});await p.setViewportSize({width:390,height:844});await p.screenshot({path:qa+'/today-light.png',fullPage:true});await p.locator('#settings').click();await p.locator('#theme').selectOption('dark');await save(p);await p.screenshot({path:qa+'/today-dark.png',fullPage:true});A.deepEqual(x.errors,[])});

await check('hedge assumptions and pattern inputs survive refresh rendering',async()=>{await nav(p,'position','hedge');await p.locator('#hg-budget').fill('12345');await p.locator('#hg-through').fill('2026-11-23');await p.locator('#hg-budget').blur();await emit(p,'research',{section:'status',fetched_at_iso:ts,data:{status:'NORMAL_OPEN'}});A.equal(await p.locator('#hg-budget').inputValue(),'12345');A.equal(await p.locator('#hg-through').inputValue(),'2026-11-23');await nav(p,'technicals','insights');await p.locator('#pattern-window').fill('30');await p.locator('#pattern-forward').fill('5');await p.locator('#pattern-forward').blur();await emit(p,'idle',{});A.equal(await p.locator('#pattern-window').inputValue(),'30');A.equal(await p.locator('#pattern-forward').inputValue(),'5');});
await check('resume clears a cancelled loading state',async()=>{await emit(p,'loading',{});A.equal(await p.locator('#refresh').isDisabled(),true);await emit(p,'lifecycle',{state:'resumed'});A.equal(await p.locator('#refresh').isDisabled(),false)});
await check('option chain displays nested provider volume and OI',async()=>{await emit(p,'snapshot',snap);await nav(p,'technicals','markets');const card=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Option chain',exact:true})});A.match(await card.innerText(),/1,000/);A.match(await card.innerText(),/5,000/);});
await check('new quote invalidates prior computed scenario',async()=>{await nav(p,'position','stress');await p.locator('#sc-spot').fill('4800');await p.locator('#scenario-advanced').evaluate(el=>el.open=true);await p.locator('#sc-iv').fill('30');await click(p,'scenario');A.match(await p.locator('main').innerText(),/Scenario results/);await emit(p,'snapshot',snap);A.match(await p.locator('main').innerText(),/Choose a question to begin/);});
await check('failed persistence keeps saved book intact',async()=>{await nav(p,'position','book');const before=await p.evaluate(()=>JSON.stringify(saved));await click(p,'edit');await p.locator('#leg-entry').fill('4000');await p.evaluate(()=>window.forceSaveFailure=true);await p.locator('#modal-save').click();A.match(await p.locator('#modal-error').innerText(),/synthetic disk failure/);A.equal(await p.evaluate(()=>JSON.stringify(saved)),before);await p.evaluate(()=>window.forceSaveFailure=false);await p.locator('#modal-cancel').click();});
await check('recovery conflicts reject rather than overwrite a newer book',async()=>{await nav(p,'position','journal');await click(p,'recovery');const before=await p.evaluate(()=>{window.rev++;return JSON.stringify(saved)});await p.locator('#modal-save').click();A.match(await p.locator('#modal-error').innerText(),/conflict/);A.equal(await p.evaluate(()=>JSON.stringify(saved)),before);await p.locator('#modal-cancel').click();});
await browser.close();browser=await launch();await check('stale imported confirmation cannot enable hedge ranking',async()=>{const b={...E.emptyBook(),legs:[FUT,PUT],riskProfile:{...E.emptyBook().riskProfile,confirmedAt:ts,confirmedBook:'rev-wrong'}};x=await pageFor({book:b});p=x.page;await nav(p,'position','book');A.match(await p.locator('main').innerText(),/Not confirmed/);await nav(p,'position','hedge');await click(p,'hedge-rank');A.match(await p.locator('#toast').innerText(),/Confirm the current book/);await x.context.close();});
await browser.close();browser=await launch();await check('unlisted saved contract identity survives manual edit',async()=>{x=await pageFor({book:{...E.emptyBook(),legs:[FUT]}});p=x.page;await nav(p,'position','book');await click(p,'edit');A.equal(await p.locator('#leg-listed').inputValue(),'SYNTH_F');await p.locator('#leg-manual').fill('4999');await save(p);A.equal(await p.evaluate(()=>saved.legs[0].instrumentKey),'SYNTH_F');A.deepEqual(x.errors,[]);await x.context.close();});
await browser.close();browser=await launch();await check('v2 migration preserves completed October history and storage keys',async()=>{x=await pageFor({legacy:{...E.emptyBook(),version:2,legs:[FUT,PUT],journal:[{id:'oct',kind:'close',date:'2026-10-27',leg:{...PUT,expiry:'2026-10-27'},exit:.3,fees:12,note:'Closed October'}]}});const b=await x.page.evaluate(()=>saved);A.equal(b.version,4);A.equal(b.journal[0].leg.expiry,'2026-10-27');A.ok(await x.page.evaluate(()=>localStorage.getItem('hal_desk_v2')));A.deepEqual(x.errors,[]);await x.context.close()});
await browser.close();browser=await launch();await check('corrupt saved book withholds misleading zero values',async()=>{x=await pageFor({corrupt:true});A.match(await x.page.locator('main').innerText(),/Financial values withheld/);A.ok(!(await x.page.locator('main').innerText()).includes('₹0.00'));await nav(x.page,'technicals','markets');A.deepEqual(x.errors,[]);await x.context.close()});await browser.close();browser=await launch();await check('both manually recorded puts recover from cached key mismatch without changing holdings',async()=>{const p1={...PUT,instrumentKey:null},p2={...PUT,id:'p2',strike:4400,entry:24.1,instrumentKey:null};x=await pageFor({book:{...E.emptyBook(),legs:[p1,p2]}});p=x.page;await emit(p,'connection',{configured:true});const req=await p.evaluate(()=>calls.filter(c=>c[0]==='research').map(c=>JSON.parse(c[1])).find(r=>r.section==='contracts'));A.equal(req.legs.length,2);A.ok(req.legs.every(l=>!Object.prototype.hasOwnProperty.call(l,'instrument_key')));const before=await p.evaluate(()=>JSON.stringify(saved));await emit(p,'research',{section:'contracts',frame:'D',fetched_at_iso:ts,data:{contracts:[4500,4400].map(strike=>({type:'PE',expiry:PUT.expiry,strike,requested_lot_size:150,lot_size:150,verified:false,reason:'instrument_key_mismatch'}))}});await emit(p,'snapshot',{...snap,option_rows:[...snap.option_rows,{strike:4400,put:{instrument_key:'SYNTH_P2',lot_size:150,quote:q(30)}}]});await nav(p,'position','book');A.ok(!(await p.locator('main').innerText()).includes('Exact listed contract unavailable'));A.match(await p.locator('main').innerText(),/₹50.00/);A.match(await p.locator('main').innerText(),/₹30.00/);A.equal(await p.evaluate(()=>JSON.stringify(saved)),before);A.deepEqual(x.errors,[]);await x.context.close();});
await browser.close();browser=await launch();await check('wrong saved expiry stays unavailable and shows provider dates for review',async()=>{x=await pageFor({book:{...E.emptyBook(),legs:[{...PUT,instrumentKey:null,expiry:'2026-11-24'}]}});p=x.page;await emit(p,'snapshot',snap);await nav(p,'position','book');A.match(await p.locator('main').innerText(),/Exact listed contract unavailable/);A.match(await p.locator('main').innerText(),/Provider lists 23 Nov 2026/);A.equal(await p.evaluate(()=>saved.legs[0].expiry),'2026-11-24');A.deepEqual(x.errors,[]);await x.context.close();});
await browser.close();browser=await launch();await check('obsolete chain selection resets to listed expiry and exposes failure inline',async()=>{x=await pageFor();p=x.page;await emit(p,'snapshot',{...snap,option_expiry:'2026-10-27',available_expiries:['2026-10-27']});await emit(p,'connection',{configured:true});await emit(p,'snapshot',{...snap,option_expiry:'2026-10-27',option_rows:[],chain_error:'expiry_not_listed'});await nav(p,'technicals','markets');A.equal(await p.locator('#chain-expiry').inputValue(),PUT.expiry);const calls=await p.evaluate(()=>window.calls.filter(c=>c[0]==='research').map(c=>JSON.parse(c[1])));A.ok(calls.some(r=>r.section==='hedges'&&r.frame===PUT.expiry));await emit(p,'research_error',{key:'hedges:'+PUT.expiry+':consolidated',code:'upstox_permission_denied'});const card=p.locator('section.card').filter({has:p.getByRole('heading',{name:'Option chain',exact:true})});A.match(await card.innerText(),/cannot access this feed/);A.deepEqual(x.errors,[]);await x.context.close();});

await browser.close();browser=await launch();
await check('daily review saves fresh observations separately and keeps the prior visit fixed',async()=>{
 const I=require('../app/src/main/assets/insights4.js');const b=E.validateBook({...E.emptyBook(),legs:[FUT,PUT]});
 const previous={version:4,savedAt:new Date(now-3600000).toISOString(),quoteAsOf:new Date(now-3601000).toISOString(),bookRevision:I.materialFingerprint(b),spot:4900,open:22000,complete:true,newsURLs:[]};
 x=await pageFor({book:b,cache:{'snapshot:review':{version:1,current:previous}}});p=x.page;
 await emit(p,'connection',{configured:true});await emit(p,'snapshot',snap);
 const state=await p.evaluate(()=>({revision:rev,previous,review:reviewCache['snapshot:review'],book:saved}));
 A.equal(state.revision,0);A.equal(state.previous,null);A.equal(state.book.checkpoints.length,0);A.ok(Math.abs(state.review.current.open-23460)<1e-6);
 A.match(await p.locator('main').innerText(),/1,460.00/);
 const baseline=JSON.stringify(state.review);await emit(p,'snapshot',{...snap,spot:{...snap.spot,last_price:4960}});
 A.equal(await p.evaluate(()=>JSON.stringify(reviewCache['snapshot:review'])),baseline);
 await nav(p,'position','book');await nav(p,'position','overview');A.match(await p.locator('main').innerText(),/1,460.00/);
 await emit(p,'lifecycle',{state:'resumed',awayMs:360000});const changed=await p.locator('section.card').filter({has:p.getByRole('heading',{name:'Since your last visit',exact:true})}).innerText();A.match(changed,/₹0.00/);A.ok(!changed.includes('1,460.00'));await emit(p,'snapshot',snap);A.equal(await p.evaluate(()=>rev),0);
 await x.context.close();
});
await browser.close();browser=await launch();
await check('offline, incomplete and failed refreshes do not advance the review baseline',async()=>{
 x=await pageFor({book:{...E.emptyBook(),legs:[FUT,PUT]}});p=x.page;
 await emit(p,'snapshot',{...snap,option_rows:[]});A.equal(await p.evaluate(()=>reviewCache['snapshot:review']),undefined);
 await emit(p,'error',{code:'network_unavailable'});A.equal(await p.evaluate(()=>reviewCache['snapshot:review']),undefined);
 await p.evaluate(()=>window.forceCacheFailure=true);await emit(p,'snapshot',snap);
 A.equal(await p.evaluate(()=>rev),0);A.equal(await p.evaluate(()=>saved.legs.length),2);
 await x.context.close();
});
await browser.close();browser=await launch();
await check('question shortcuts calculate common scenarios and retain explicit IV assumptions',async()=>{
 x=await pageFor({book:{...E.emptyBook(),legs:[FUT,PUT]}});p=x.page;await emit(p,'snapshot',snap);
 await nav(p,'position','stress');await click(p,'quick-fall');A.equal(await p.locator('#sc-spot').inputValue(),'4702.5');
 A.match(await p.locator('main').innerText(),/Valid put IV unavailable/);
 await p.locator('#sc-iv').fill('30');await click(p,'scenario');A.match(await p.locator('main').innerText(),/Scenario results/);
 await click(p,'quick-expiry');A.equal(await p.locator('#sc-horizon').inputValue(),PUT.expiry);A.equal(await p.locator('#sc-iv').inputValue(),'30');
 A.match(await p.locator('main').innerText(),/Scenario results/);A.equal(await p.evaluate(()=>rev),0);
 await x.context.close();
});
await browser.close();browser=await launch();
await check('exposure comparison preserves holdings and history and clears obsolete results',async()=>{
 x=await pageFor({book:{...E.emptyBook(),legs:[FUT,PUT]}});p=x.page;await emit(p,'snapshot',snap);
 const before=await p.evaluate(()=>JSON.stringify(saved));await nav(p,'position','compare');
 await p.locator('#sc-spot').fill('4455');await p.locator('#scenario-advanced').evaluate(el=>el.open=true);await p.locator('#sc-iv').fill('30');await p.locator('#compare-costs').fill('100');
 await click(p,'compare-reduction');A.match(await p.locator('main').innerText(),/74,150.00/);A.equal(await p.evaluate(()=>JSON.stringify(saved)),before);
 await p.locator('#sc-spot').fill('4600');A.equal(await p.locator('[data-calculation-output]').count(),0);
 await click(p,'compare-reduction');await emit(p,'snapshot',snap);A.equal(await p.locator('[data-calculation-output]').count(),0);
 await x.context.close();
});
await browser.close();browser=await launch();
await check('contextual AI reviews exact evidence before any request and keeps research private',async()=>{
 x=await pageFor({book:{...E.emptyBook(),legs:[FUT,PUT],notes:[{id:'private',title:'PRIVATE TITLE',text:'PRIVATE MEMO',date:'2026-10-31',category:'Other'}]}});p=x.page;
 await emit(p,'snapshot',snap);await click(p,'explain-position');A.equal(await p.locator('#modal').isVisible(),true);
 let packet=JSON.parse(await p.locator('#modal-body pre').innerText());A.equal(packet.evidence.portfolioIncluded,true);
 A.equal((await p.evaluate(()=>calls.filter(c=>c[0]==='ai'))).length,0);await p.locator('#modal-cancel').click();
 await emit(p,'research',{section:'news',frame:'D',fetched_at_iso:ts,data:{articles:[{heading:'HAL engine delivery update',article_link:'https://example.org/filing',published_time:now-1000,source:'Synthetic news'}]}});
 await nav(p,'research','news');await click(p,'explain-news');packet=JSON.parse(await p.locator('#modal-body pre').innerText());
 A.equal(packet.evidence.portfolioIncluded,false);A.equal(packet.evidence.news[0].title,'HAL engine delivery update');A.ok(!JSON.stringify(packet).includes('PRIVATE'));
 await p.locator('#ai-consent').check();await save(p);A.equal((await p.evaluate(()=>calls.filter(c=>c[0]==='ai'))).length,1);
 const req=await p.evaluate(()=>JSON.parse(calls.find(c=>c[0]==='ai')[1]));await emit(p,'ai_result',{id:req.id,data:{reply:'Fixture interpretation',portfolioIncluded:false}});
 A.match(await p.locator('main').innerText(),/Fixture interpretation/);await x.context.close();
});
await browser.close();browser=await launch();
await check('HAL business review shows sourced notes, upcoming events and escaped text',async()=>{
 x=await pageFor({book:{...E.emptyBook(),notes:[{id:'event',title:'Engine delivery review <script>bad()</script>',text:'Source reports a delivery milestone.',category:'Deliveries',date:'2026-10-31',eventDate:'2026-11-10',url:'https://example.org/source'}]}});p=x.page;
 await nav(p,'research','company');const text=await p.locator('main').innerText();
 for(const title of ['Order book','Deliveries & execution','Revenue & margins','Cash conversion','Upcoming events'])A.ok(text.includes(title));
 A.match(text,/10 Nov 2026/);A.match(text,/User-entered/);A.equal(await p.locator('main script').count(),0);A.deepEqual(x.errors,[]);await x.context.close();
});
await browser.close();browser=await launch();
await check('updated daily and planning layouts fit phone widths in both themes',async()=>{
 x=await pageFor({book:{...E.emptyBook(),legs:[FUT,PUT]}});p=x.page;await emit(p,'connection',{configured:true});await emit(p,'snapshot',snap);await emit(p,'research',{section:'news',frame:'D',fetched_at_iso:ts,data:{articles:[{heading:'HAL delivery milestone: evidence to review',article_link:'https://example.org/hal-fixture',published_time:now-1000,source:'Synthetic preview'}]}});
 const qa=path.resolve(__dirname,'../../qa');fs.mkdirSync(qa,{recursive:true});
 for(const theme of ['dark','light']){
  await p.locator('#settings').click();await p.locator('#theme').selectOption(theme);await save(p);
  for(const width of [320,390,768]){await p.setViewportSize({width,height:844});for(const [a,b]of [['position','overview'],['position','book'],['position','stress'],['position','compare'],['research','company']]){
   await nav(p,a,b);A.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${theme} ${width} ${a}/${b}`);
   if(width===390)await p.screenshot({path:qa+`/daily-${theme}-${a}${b?'-'+b:''}.png`,fullPage:true});
  }}
 }
 A.deepEqual(x.errors,[]);await x.context.close();
});

await (async()=>{
  await browser.close();
  browser=await launch();
  const leg={id:'qa-future',type:'FUT',expiry:'2026-12-29',lots:2,lotSize:10,entry:1000,manual:null,instrumentKey:'QA_FUTURE'};
  const packet={format:'HALDeskHistory',payload:{sourceId:'qa-summary',sourceName:'Synthetic contract report',mode:'incremental',
    records:[{sourceRow:'7',type:'FUT',contractMonth:'2025-03',units:10,entry:400,exit:303,gross:-970}]},
    charges:{amount:30,asOf:'2026-10-31',source:'Synthetic charge statement'}};
  const run=await pageFor({book:{...E.emptyBook(),legs:[leg]}});
  const p=run.page;
  const main=p.locator('main');
  try{
    await check('history import previews the reconciled net and preserves open contracts',async()=>{
      await nav(p,'history');
      await click(p,'history-import');
      A.equal(await p.evaluate(()=>calls.filter(x=>x[0]==='importHistory').length),1);
      await emit(p,'history_preview',packet);
      await p.locator('#history-include-charges').check();
      A.match(await p.locator('#history-effect').innerText(),/−₹1,000\.00/);
      await p.locator('#modal-save').click();
      A.match(await p.locator('#modal-error').innerText(),/confirm/i);
      A.equal(await p.evaluate(()=>rev),0);
      await p.locator('#history-reviewed').check();
      await save(p);
      const savedState=await p.evaluate(()=>saved);
      A.deepEqual(savedState.legs.map(l=>[l.id,l.lots,l.lotSize,l.entry]),[['qa-future',2,10,1000]]);
      A.equal(savedState.history.records.length,1);
      A.equal(savedState.history.charges.amount,30);
      A.match(await main.innerText(),/−₹1,000\.00/);
    });
    await check('re-import through the history preview keeps one contract and one fee statement',async()=>{
      await emit(p,'history_preview',packet);
      A.match(await p.locator('#modal-body').innerText(),/Already imported\s+1/);
      await p.locator('#history-include-charges').check();
      await p.locator('#history-reviewed').check();
      await save(p);
      A.equal(await p.evaluate(()=>saved.history.records.length),1);
      A.match(await main.innerText(),/−₹1,000\.00/);
    });
    await check('open and lifetime break-even use separate charge scopes and invalidate after a fee correction',async()=>{
      await nav(p,'position','break-even');
      await p.locator('#be-rate').fill('0');
      await p.locator('#be-enter').fill('20');
      await p.locator('#be-exit').fill('10');
      await p.locator('#be-slippage').fill('0');
      await click(p,'be-calculate');
      const results=p.locator('#be-results');
      const row=label=>results.locator('tbody tr').filter({has:p.getByRole('cell',{name:label,exact:true})}).first();
      A.match(await row('Open gross').innerText(),/₹1,000\.00/);
      A.match(await row('Open after costs').innerText(),/₹1,001\.50/);
      A.match(await row('Lifetime recovery').innerText(),/₹1,050\.50/);
      A.match(await row('Lifetime recovery').innerText(),/Current spot unavailable/);
      A.equal(await results.locator('svg').count(),1);
      await nav(p,'history');
      const card=main.locator('section').filter({has:p.getByRole('heading',{name:'Lifetime recovery break-even',exact:true})});
      A.match(await card.innerText(),/₹1,050\.50/);
      await click(p,'history-charges');
      await p.locator('#history-fee').fill('50');
      await p.locator('#history-covers').check();
      await save(p);
      A.doesNotMatch(await card.innerText(),/₹1,050\.50/);
      await nav(p,'position','break-even');await click(p,'be-calculate');
      A.match(await row('Lifetime recovery').innerText(),/₹1,051\.50/);
    });
    await check('calendar reviews show observation gaps and invoke Android printing only on demand',async()=>{
      await click(p,'period-review');
      await p.locator('#review-period').selectOption('week');
      A.match(await main.innerText(),/Comparison unavailable/);
      A.match(await main.innerText(),/two distinct saved observations/i);
      A.equal(await p.evaluate(()=>calls.filter(x=>x[0]==='printReview').length),0);
      await click(p,'print-review');
      A.equal(await p.evaluate(()=>calls.filter(x=>x[0]==='printReview').length),1);
      A.deepEqual(run.errors,[]);
    });
  }finally{await run.context.close();}
})();
// Isolate this regression in a fresh browser after legacy page contexts are closed.
// Chromium's single-process CI mode can terminate if a second active context
// is created beside the long-running portfolio UI session.
await browser.close();browser=await launch();
await check('4.6 PAPER immutable opening, clone and explicit close preserve original trade',async()=>{
 const fresh=await pageFor();const screen=fresh.page;
 try{
  await emit(screen,'snapshot',snap);
  await nav(screen,'technicals','lab');
  await click(screen,'lab-add');
  await click(screen,'lab-paper-save');
  await click(screen,'lab-open');
  const savedOpen=await screen.evaluate(()=>structuredClone(reviewCache['research:optionslab_paper'].drafts[0]));
  A.equal(savedOpen.status,'open');A.ok(savedOpen.openedAt);
  A.deepEqual(savedOpen.openedLegs,savedOpen.legs);
  A.equal(await screen.locator('[data-action="lab-delete"]').count(),0);
  await screen.locator('[data-action="lab-load"]').click();
  A.match(await screen.locator('main').innerText(),/Locked PAPER trade loaded as a new/i);
  await click(screen,'lab-paper-save');
  const cloned=await screen.evaluate(()=>reviewCache['research:optionslab_paper']);
  A.equal(cloned.drafts.length,2);A.equal(new Set(cloned.drafts.map(d=>d.id)).size,2);
  A.deepEqual(cloned.drafts.find(d=>d.status==='open'),savedOpen);
  await click(screen,'lab-close-start');
  await screen.locator('#lab-exit-0').fill('70');
  await screen.locator('#lab-exit-fees').fill('12');
  await click(screen,'lab-close-confirm');
  const closed=await screen.evaluate(()=>reviewCache['research:optionslab_paper'].drafts.find(d=>d.status==='closed'));
  A.deepEqual(closed.legs,savedOpen.legs);A.deepEqual(closed.openedLegs,savedOpen.openedLegs);
  A.equal(closed.fees,12);A.equal(closed.exits[0],70);
  A.equal(await screen.locator('[data-action="lab-delete"]').count(),1); // only the unsent draft
  A.deepEqual(fresh.errors,[]);
 }finally{await fresh.context.close();}
});

console.log(`${checks} UI integration checks passed (synthetic bridge, not Android device tests).`)
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
