'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

test('installed web assets navigate offline without touching the book', async () => {
 const browser = await chromium.launch({executablePath:process.env.HAL_BROWSER,args:['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://appassets.androidplatform.net/**',route=>{
   const file=path.basename(new URL(route.request().url()).pathname)||'index.html';
   return route.fulfill({path:path.join(__dirname,'../app/src/main/assets',file)});
  });
  await page.goto('https://appassets.androidplatform.net/index.html');
  assert.deepEqual(await page.locator('.bottom-nav button').allTextContents(),['Analysis','Portfolio','Ask Atlas']);
  assert.equal(await page.locator('main h1').first().textContent(),'Analysis');
  for(const [tab,sections] of [['Analysis',['markets','indicators','company','news']],['Portfolio',['book','risk','hedge','stress','break-even','history','journal']]]){
   await page.getByRole('navigation').getByText(tab,{exact:true}).click();
   for(const key of sections){
    await page.locator('[data-section="'+key+'"]').click();
    assert.equal(await page.locator('.atlas-heading[aria-expanded="true"]').count(),1);
   }
  }
  await page.getByRole('navigation').getByText('Ask Atlas').click();
  await page.locator('[data-action="switch-research"]').click();
  await page.locator('[data-action="switch-research"]').click();
  await page.locator('#settings').click();
  assert.equal(await page.locator('#modal-body>details').count(),6);
  await page.locator('#modal-close').click();
  await page.locator('#notifications').click();
  assert.equal(await page.locator('#modal-title').textContent(),'Notifications');
  await page.evaluate(()=>HALApp.back());
  await page.evaluate(()=>HALApp.back());
  assert.equal(await page.locator('main h1').first().textContent(),'Analysis');
  assert.equal(await page.evaluate(()=>localStorage.getItem('hal_desk_v4')),null);
  assert.deepEqual(errors,[]);
 } finally {await browser.close();}
});
