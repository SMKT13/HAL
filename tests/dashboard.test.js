'use strict';
// Execute the actual scripts against the IDs in index.html. No browser/network deps.
// This catches missing-element crashes and exercises fallback/storage transitions.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const snapshot = JSON.parse(html.match(/window\.HAL_SNAPSHOT = (.*?);<\/script>/s)[1]);
const tick = () => new Promise(resolve => setImmediate(resolve));

async function boot({fetcher, stored, storageFails=false} = {}) {
  const ids = new Map();
  const canvasCalls = [];
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) {
    assert.ok(!ids.has(id), 'duplicate ID: ' + id);
    const listeners = {};
    let value = '';
    ids.set(id, {get value(){return value;}, set value(next){value=String(next);}, textContent:'', innerHTML:'', style:{}, hidden:false,
      disabled:false, clientWidth:800, listeners,
      addEventListener:(type, cb) => {listeners[type]=cb;},
      getAttribute:() => '120',
      getContext:() => new Proxy({}, {get:(_,name) => (...args) => {
        for (const v of args) if (typeof v === 'number') assert.ok(Number.isFinite(v), 'invalid canvas coordinate');
        canvasCalls.push(name);
      }, set:() => true})});
  }
  const storage = new Map(stored ? [['halpos2',stored]] : []);
  const ctx = vm.createContext({console, AbortController, URL, Blob,
    document:{getElementById:id => ids.get(id) || null, createElement:() => ({click(){}})},
    localStorage:{getItem:k => {if(storageFails) throw Error('blocked');return storage.get(k) || null;},
      setItem:(k,v) => {if(storageFails) throw Error('blocked'); storage.set(k,v);}},
    devicePixelRatio:1, addEventListener(){}, setTimeout:() => 1, clearTimeout(){}, setInterval(){},
    fetch:fetcher || (async () => {throw Error('offline');})});
  ctx.window = ctx;
  ctx.HAL_SNAPSHOT = structuredClone(snapshot);
  for (const file of ['portfolio.js','dashboard.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});
  await tick();
  return {ctx, ids, storage, canvasCalls};
}

test('offline startup renders the embedded snapshot, charts and positions', async () => {
  const {ids,canvasCalls} = await boot();
  assert.match(ids.get('px').textContent, /4,655/);
  assert.equal(ids.get('data-badge').textContent, 'ARCHIVED SNAPSHOT');
  assert.match(ids.get('quality').textContent, /Historical values/);
  assert.ok(canvasCalls.includes('fillRect'));
  assert.ok(ids.get('scenarios').innerHTML.includes('<tbody>'));
});

test('HTTP errors activate fallback; a subsequent success clears stale state', async () => {
  let working = false;
  const fresh = {...structuredClone(snapshot), data_status:'fresh_fetch', snapshot_mode:false, stale:false};
  const {ctx,ids} = await boot({fetcher:async () => working ? {ok:true,json:async()=>fresh} : {ok:false}});
  assert.equal(ids.get('data-badge').textContent,'ARCHIVED SNAPSHOT');
  working = true;
  await vm.runInContext('load(true)',ctx);
  assert.equal(ids.get('data-badge').textContent,'DELAYED FEED');
});

test('subsequent outages preserve the last successful quote', async () => {
  let failed = false;
  const fresh = {...structuredClone(snapshot), quote:{...snapshot.quote,price:4701}, snapshot_mode:false, stale:false};
  const {ctx,ids} = await boot({fetcher:async()=>{if(failed) throw Error('offline');return {ok:true,json:async()=>fresh};}});
  failed = true;
  await vm.runInContext('load(true)',ctx);
  assert.match(ids.get('px').textContent,/4,701/);
  assert.equal(ids.get('data-badge').textContent,'STALE CACHE');
});

test('zero quantity persists and invalid edits leave the last valid book intact', async () => {
  const {ids,storage} = await boot();
  const qty = ids.get('fq');
  qty.value='0'; qty.listeners.change({target:{id:'fq'}});
  assert.equal(JSON.parse(storage.get('halpos3')).fq,0);
  assert.match(ids.get('f-source').textContent,/Closed leg/);
  qty.value='-1'; qty.listeners.change({target:{id:'fq'}});
  assert.equal(JSON.parse(storage.get('halpos3')).fq,0);
  assert.match(ids.get('position-status').textContent,/last valid position/);
});

test('corrupt and blocked local storage do not stop rendering', async () => {
  for (const options of [{stored:'{'},{storageFails:true}]) {
    const {ids} = await boot(options);
    assert.match(ids.get('px').textContent,/4,655/);
    assert.match(ids.get('position-status').textContent,/could not be read/);
  }
});

test('missing indicator history renders unavailable values without a crash', async () => {
  const data = structuredClone(snapshot);
  data.ind.rsi14 = data.ind.mfi14 = data.ind.mfi_rsi_spread = data.ind.atr14 = null;
  data.levels.gate = data.levels.stop = data.ind.sma20 = data.ind.sma50 = data.ind.sma200 = null;
  data.mkt = null;
  data.snapshot_mode = false; data.stale = false;
  const {ids} = await boot({fetcher:async()=>({ok:true,json:async()=>data})});
  assert.match(ids.get('zone').textContent,/insufficient history/);
  assert.equal(ids.get('mktcard').hidden,true);
});

test('an incomplete successful API response still activates the usable snapshot', async () => {
  const data = {...structuredClone(snapshot), series:{}};
  const {ids} = await boot({fetcher:async()=>({ok:true,json:async()=>data})});
  assert.equal(ids.get('data-badge').textContent,'ARCHIVED SNAPSHOT');
  assert.ok(ids.get('scenarios').innerHTML.includes('<tbody>'));
});
