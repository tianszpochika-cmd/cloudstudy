const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {collectFromPage,checkHrefStrict,expectedForViewport}=require('../work/r1-001-sweep-11.cjs');
const out=process.argv[2];assert.ok(out,'Fresh output required');fs.mkdirSync(out,{recursive:true});
const origin='http://127.0.0.1:18182';
const report={startedAt:new Date().toISOString(),browserPath:'Browser plugin not available; regular Playwright',mocked:false,checks:[],pages:[],storage:[],screenshots:[],errors:[]};
async function storage(page,label){
 assert.equal(new URL(page.url()).origin,origin,'Storage origin must be official-site');
 const proof=await page.evaluate(()=>({origin:location.origin,stores:['localStorage','sessionStorage'].map(name=>{const store=window[name],keys=[];for(let n=0;n<store.length;n++)keys.push(store.key(n));return {name,keys};})}));
 assert.equal(proof.origin,origin);const allowed=new Set(['yx.public.locale','yx.public.theme','yx.official.performance']);
 const unknown=proof.stores.flatMap(s=>s.keys.filter(k=>!allowed.has(k)).map(key=>({store:s.name,key})));
 assert.deepEqual(unknown,[],'Unknown storage keys require investigation');
 const cookies=(await page.context().cookies(origin)).map(c=>c.name);
 assert.deepEqual(cookies.filter(k=>!/^(yx\.public\.(locale|theme))$/.test(k)),[],'Unexpected official cookie');
 report.storage.push({label,...proof,cookieNames:cookies,readSucceeded:true,valuesRead:false});
}
(async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 for(const viewport of [{width:375,height:812},{width:1440,height:900}]){
  const label=viewport.width+'x'+viewport.height,context=await browser.newContext({viewport});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const bad=['https://evil.invalid','//evil.invalid','%2F%2Fevil.invalid','javascript:alert(1)'];
  for(const returnTo of bad){
   const res=await page.goto(origin+'/courses?returnTo='+encodeURIComponent(returnTo),{waitUntil:'domcontentloaded'});
   assert.equal(res.status(),200);page.__r1Status=res.status();
   const entry=await collectFromPage(page,label,'/courses');
   const hrefs=await page.locator('[data-learning-entry]').evaluateAll(es=>es.map(e=>({href:e.getAttribute('href'),target:e.getAttribute('data-learning-entry')})));
   for(const item of hrefs)checkHrefStrict(item.href,expectedForViewport(item.target==='mobile'?'375x812':'1440x900'),label);
   report.checks.push({name:label+' reject unsafe returnTo',input:returnTo,result:'PASS',entry});
  }
  await storage(page,label+' before navigation');
  const cta=page.locator('[data-learning-entry="'+(viewport.width<690?'mobile':'web')+'"]:visible').first();
  await cta.scrollIntoViewIfNeeded();assert.equal(await cta.isEnabled(),true);
  await cta.click();await page.waitForURL(url=>url.origin===expectedForViewport(label).origin,{timeout:15000});
  await page.locator('body').waitFor({state:'visible'});await page.waitForTimeout(1200);
  const landed=page.url();checkHrefStrict(landed,expectedForViewport(label),label+' landing');
  assert.ok(await page.locator('input').count()>0,'Registration page must render actual inputs');
  report.pages.push({label,landed,title:await page.title(),registrationSubmitted:false});
  await page.goBack({waitUntil:'domcontentloaded'});assert.equal(new URL(page.url()).origin,origin);
  await page.locator('h1').first().waitFor({state:'visible'});
  await storage(page,label+' after return');
  const detail=await collectFromPage(page,label,'/courses');
  const fast=page.locator('[data-learning-entry="'+(viewport.width<690?'mobile':'web')+'"]:visible').first();
  let navigations=0;page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&new URL(frame.url()).origin===expectedForViewport(label).origin)navigations++;});
  await fast.dblclick({timeout:10000});await page.waitForURL(url=>url.origin===expectedForViewport(label).origin,{timeout:15000});
  await page.waitForTimeout(1000);checkHrefStrict(page.url(),expectedForViewport(label),label+' rapid landing');
  report.checks.push({name:label+' real rapid click and fixed landing',result:'PASS',navigations,entry:detail});
  await page.goBack({waitUntil:'domcontentloaded'});assert.equal(new URL(page.url()).origin,origin);
  await page.locator('h1').first().waitFor({state:'visible'});await storage(page,label+' after rapid return');
  const shot=path.join(out,'returned-'+label+'.png');await page.screenshot({path:shot});report.screenshots.push(shot);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.result='PASS';
}catch(e){report.result='FAIL';report.failure=String(e.message).slice(0,500);process.exitCode=1;}
finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2),{flag:'wx'});console.log(JSON.stringify({result:report.result,checks:report.checks.length,storage:report.storage.length,failure:report.failure}));}})();
