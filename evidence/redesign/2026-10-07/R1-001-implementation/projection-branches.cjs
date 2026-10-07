// Final-source affected-route QA: existing fixed Nuxt only; read-only + browser-local response fixtures.
const {chromium}=require('playwright');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const out=__dirname,origin='http://127.0.0.1:18182';
const empty=JSON.parse(fs.readFileSync(path.join(out,'..','R1-001-current-source','public-projection.json'),'utf8'));
const result={kind:'FINAL_SOURCE_AFFECTED_ROUTE_PROJECTION_BRANCHES_NOT_WORKFLOW_ACCEPTANCE',at:new Date().toISOString(),real:[],simulated:[],unrelatedScope:[],errors:[],blockedWrites:[],failure:null};
const plan={id:'review-plan',skuId:'review-sku',name:'审查用公开方案',price:'¥12.34',unit:'每月',currency:'CNY',billingPeriod:'MONTH',description:'仅为浏览器局部公开投影夹具',features:[],entitlements:[{id:'review-entitlement',code:'review',name:'审查用权益说明',description:'只读，不授予权益',status:'included'}],featured:false,availability:'available',eligibility:'unknown',eligibilityMessage:'资格由服务端判定',maintenanceMessage:''};
const channel={id:'review-channel',name:'审查用公开渠道',platform:'浏览器',description:'仅为浏览器局部公开投影夹具',availability:'available',action:'不应展示的安装动作',href:'https://example.test/runtime.apk'};
const course={id:'review-course',eyebrow:'',title:'审查用公开课程',description:'公开内容',level:'',duration:'',tags:[]};
const copy={loading:'正在加载公开内容',empty:null,error:'公开内容暂时无法加载',permission:'暂时无法访问这项内容',recovery:'正在恢复公开内容',maintenance:'服务正在维护'};
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});result.browserVersion=browser.version();try{
 for(const [viewportName,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,locale:'zh-CN',serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',async route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){result.blockedWrites.push({method:route.request().method(),url:route.request().url()});await route.abort();}else await route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push({viewportName,url:page.url(),type:'pageerror',message:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))result.errors.push({viewportName,url:page.url(),type:m.type(),message:m.text()});});
  for(const scope of ['pricing','download']){
   const response=await page.goto(origin+'/'+scope+'?locale=en-US',{waitUntil:'networkidle'});assert.equal(response.status(),200);assert.equal(response.request().redirectedFrom(),null);
   const title=scope==='pricing'?'收费方案暂未开放':'下载准备中';await page.getByRole('heading',{name:title,exact:true}).waitFor();
   const screenshot='screenshots/final_'+viewportName+'_'+scope+'_real.png';await page.screenshot({path:path.join(out,screenshot)});
   result.real.push({scope,viewport,firstStatus:response.status(),emptyCopy:title,enUsFallback:true,screenshot,horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)});
   for(const scenario of (process.argv.includes('--nonempty-only') ? ['ready-nonempty'] : ['loading','empty','error','permission','recovery','maintenance','ready-nonempty','ready-related-empty','commerce-degraded','missing-response'])){
    const state=scenario.startsWith('ready')||scenario==='commerce-degraded'?'ready':scenario==='missing-response'?'error':scenario;
    const fixture=JSON.parse(JSON.stringify(empty));fixture.state=state;fixture.projection.courses=[course];
    if(['ready-nonempty','recovery'].includes(scenario)){
     if(scope==='pricing')fixture.projection.pricingPlans=[plan];else fixture.projection.downloadChannels=[channel];
    }
    // The unrelated content remains valid when commerce fails. Only pricing must become error.
    if(scenario==='commerce-degraded')fixture.projection.downloadChannels=[channel];
    await context.route('**/api/public-projection?*',r=>r.fulfill({status:200,headers:{'content-type':'application/json','x-public-projection-commerce':scenario==='commerce-degraded'?'degraded':'gateway'},body:JSON.stringify(scenario==='missing-response'?null:fixture)}));
    const response=await page.goto(origin+'/'+scope,{waitUntil:'networkidle'});assert.equal(response.status(),200);
    const expected=scenario==='ready-nonempty'||(scenario==='commerce-degraded'&&scope==='download')?(scope==='pricing'?plan.name:channel.name):scenario==='ready-related-empty'||scenario==='empty'?title:scenario==='commerce-degraded'?copy.error:copy[state];
    await page.getByRole('heading',{name:expected,exact:true}).waitFor();
    const body=await page.locator('body').innerText();const catalog=page.locator('[data-public-catalog]');
    const shouldShowCatalog=['ready-nonempty','recovery'].includes(scenario)||(scenario==='commerce-degraded'&&scope==='download');
    assert.equal(await catalog.count()>0,shouldShowCatalog);
    if(shouldShowCatalog){assert.ok(!body.includes(title));if(scope==='pricing'){assert.ok(body.includes('¥12.34'));assert.ok(body.includes('审查用权益说明'));}}
    if(scenario==='commerce-degraded'&&scope==='pricing')assert.ok(!body.includes(title));
    const retry=page.locator('.public-status button');const expectedRetry=['error','permission','recovery','maintenance','missing-response'].includes(scenario)||(scenario==='commerce-degraded'&&scope==='pricing');
    assert.equal(await retry.count()>0,expectedRetry);if(expectedRetry)await retry.click();
    const unsafe=await page.locator('a').evaluateAll(as=>as.filter(a=>/\.(apk|ipa|exe|dmg)([?#]|$)|checkout|\/orders|\/payments/.test(a.getAttribute('href')||'')).map(a=>a.getAttribute('href')));assert.deepEqual(unsafe,[]);
    const screenshot='screenshots/final_'+viewportName+'_'+scope+'_'+scenario+'.png';await page.screenshot({path:path.join(out,screenshot)});
    result.simulated.push({scope,viewport,scenario,responseState:state,commerceHeader:scenario==='commerce-degraded'?'degraded':'gateway',expectedHeading:expected,catalogShown:shouldShowCatalog,realReadonlyPriceFixtureShown:shouldShowCatalog&&scope==='pricing',retryAvailable:expectedRetry,unsafeActionLinks:unsafe,screenshot});
    await context.unroute('**/api/public-projection?*');
   }
  }
  const fixture=JSON.parse(JSON.stringify(empty));fixture.state='ready';fixture.projection.courses=[course];
  await context.route('**/api/public-projection?*',r=>r.fulfill({status:200,headers:{'content-type':'application/json','x-public-projection-commerce':'degraded'},body:JSON.stringify(fixture)}));
  await page.goto(origin+'/courses',{waitUntil:'networkidle'});await page.getByRole('heading',{name:course.title,exact:true}).waitFor();result.unrelatedScope.push({scope:'courses',viewport,commerceHeader:'degraded',publicCourseStillReadable:true});
  await context.close();
 }
 assert.deepEqual(result.errors,[]);assert.deepEqual(result.blockedWrites,[]);assert.ok(result.real.every(r=>!r.horizontalOverflow));
}catch(e){result.failure=String(e.stack||e);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(out,process.argv.includes('--nonempty-only')?'projection-nonempty-final.json':'projection-branches.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({real:result.real.length,simulated:result.simulated.length,unrelatedScope:result.unrelatedScope.length,errors:result.errors.length,blockedWrites:result.blockedWrites.length,failure:result.failure}));}})();
