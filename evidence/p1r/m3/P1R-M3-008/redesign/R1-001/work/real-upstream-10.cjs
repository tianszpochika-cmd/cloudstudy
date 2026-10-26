// Real per-page mounted BFF response -> DOM; no pre-navigation snapshot substitution.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const assert=require('node:assert/strict'),chain=require('./real-chain-assert-10.cjs');
const origin=process.env.OFFICIAL_SITE_URL||'http://127.0.0.1:18182';
const scenario=process.env.R1_001_SCENARIO;
assert.ok(['empty','nonempty'].includes(scenario),'Explicit empty/nonempty scenario required');
const out=process.argv[2];assert.ok(out,'Fresh output directory required');
if(fs.existsSync(path.join(out,'result.json')))throw Error('Refuse to overwrite evidence');
fs.mkdirSync(out,{recursive:true});
const log={startedAt:new Date().toISOString(),origin,scenario,mocked:false,checks:[],pages:[],screenshots:[]};
const copySource=fs.readFileSync('packages/i18n/src/official-site.ts','utf8');
function copy(key){const m=copySource.match(new RegExp('\\b'+key+':\\s*"((?:\\\\.|[^"\\\\])*)"'));if(!m)throw Error('Missing canonical text key '+key);return JSON.parse('"'+m[1]+'"');}
function check(name,fn){try{fn();log.checks.push({name,result:'PASS'});}catch(e){log.checks.push({name,result:'FAIL',error:String(e.message).slice(0,300)});throw e;}}
function facts(body,status){return {status,state:body.state,source:body.source,courses:(body.projection?.courses||[]).map(c=>c.id),generatedAt:body.projection?.generatedAt,coursesFacet:body.facets?.courses,pricingFacet:body.facets?.pricing,pricingPlans:(body.projection?.pricingPlans||[]).length,planIds:(body.projection?.pricingPlans||[]).map(p=>p.id),skus:(body.projection?.skus||[]).length};}
async function publicRead(url){const response=await fetch(url);return {url,status:response.status,body:await response.json(),requestId:response.headers.get('x-request-id'),traceId:response.headers.get('x-trace-id')};}
async function navigate(page,route,label){
 const pending=page.waitForResponse(res=>new URL(res.url()).pathname==='/api/public-projection'&&res.request().method()==='GET',{timeout:25000});
 const navigation=await page.goto(origin+route,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(navigation.status(),200,'page navigation status');
 const response=await pending;assert.equal(response.status(),200,'mounted BFF status');
 const body=await response.json();await page.locator('h1').first().waitFor({state:'visible'});
 const entry={label,route,navigationStatus:navigation.status(),mountedResponse:{url:response.url(),status:response.status(),body},checkedAt:new Date().toISOString()};
 log.pages.push(entry);return {body,bff:facts(body,response.status()),entry};
}
(async()=>{
 let browser;
 try{
  log.upstreamReceipt=await publicRead('http://127.0.0.1:18070/api/v1/public/site/projection?uiLocale=zh-CN');
  log.commerceReceipt=await publicRead('http://127.0.0.1:18070/api/v1/public/commerce/catalog');
  const upstream={status:log.upstreamReceipt.status,courseIds:(log.upstreamReceipt.body.data?.courses||[]).map(c=>c.contentCode),generatedAt:log.upstreamReceipt.body.data?.generatedAt};
  const commerce={status:log.commerceReceipt.status};
  const upstreamPlans=(log.commerceReceipt.body.plans||[]).map(p=>p.skuId||p.id);
  browser=await chromium.launch({headless:true});
  for(const viewport of [{width:375,height:812},{width:1440,height:900}]){
   const label=viewport.width+'x'+viewport.height;
   const context=await browser.newContext({viewport});const page=await context.newPage();const errors=[];
   page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200));});
   const course=await navigate(page,'/courses',label);
   check(label+' mounted-course-chain',()=>{const input={upstream,commerce,bff:course.bff};if(scenario==='empty')chain.assertEmptyChain(input,label);else chain.assertNonemptyChain(input,label);});
   const region=page.locator('.published-courses');await region.waitFor({state:'visible'});
   if(scenario==='empty'){
    await region.getByRole('heading',{name:copy('c52c0deec1'),exact:true}).waitFor({state:'visible'});
    const cards=await region.locator('.public-course-card').count();
    const visible=await region.getByRole('heading',{name:copy('c52c0deec1'),exact:true}).isVisible();
    check(label+' empty-course-dom',()=>chain.assertEmptyCoursesDom({cards,emptyCopyVisible:visible},label));
    course.entry.dom={cards,emptyCopyVisible:visible};
   }else{
    await region.locator('.public-course-card').first().waitFor({state:'visible'});
    await page.waitForFunction(expected=>document.querySelectorAll('.public-course-card').length===expected,course.bff.courses.length);
    const titles=await region.locator('.public-course-card h3').allTextContents();
    const expected=(course.body.projection.courses||[]).map(c=>String(c.title).trim());
    check(label+' nonempty-course-dom',()=>chain.assertCourseDomTitles(titles.map(t=>t.trim()),expected,label));
    course.entry.dom={cards:titles.length,titles};
   }
   const date=String(course.bff.coursesFacet?.updatedAt||'').slice(0,10);
   const regionText=await region.innerText();
   check(label+' course-updated-date',()=>{assert.ok(date);assert.ok(regionText.includes(date),'Displayed date differs from mounted BFF response');});
   const shot=path.join(out,'courses-'+scenario+'-'+label+'.png');await page.screenshot({path:shot});
   log.screenshots.push({path:shot,sha256:crypto.createHash('sha256').update(fs.readFileSync(shot)).digest('hex')});
   const price=await navigate(page,'/pricing',label);
   check(label+' mounted-commerce-pricing',()=>chain.assertCommercePricing({upstreamPlans,bffPlans:price.bff.planIds,bffSkus:price.bff.skus},label));
   const priceRegion=page.locator('.page-body .container').first();
   const heading=copy(price.bff.pricingFacet?.state==='ready'?'c7be801719':'c010e9c193');
   const status=priceRegion.locator('.public-status');
   await status.getByRole('heading',{name:heading,exact:true}).waitFor({state:'visible'});
   const priceFacts={priceCards:await priceRegion.locator('.pricing-card,.sku-card,[data-pricing-card]').count(),
    purchaseLinks:await priceRegion.locator('a[href*="checkout"],a[href*="payment"],a[href*="order"]').count(),
    purchaseButtons:await priceRegion.getByRole('button',{name:/购买|下单|支付/}).count(),
    emptyNoteVisible:await status.getByRole('heading',{name:heading,exact:true}).isVisible(),
    recoveryCount:await priceRegion.locator('.facet-recovery').count(),
    errorCount:await status.locator('button').count(),pricingFacet:price.bff.pricingFacet,bffPlans:price.bff.pricingPlans};
   check(label+' visible-authoritative-price-empty',()=>chain.assertPricingEmptyVisible(priceFacts,label));price.entry.dom=priceFacts;
   const names=(await context.cookies()).map(c=>c.name);let cookieProof;
   check(label+' no-business-cookie',()=>{cookieProof=chain.assertNoBusinessCookies(names,label);});
   log.pages.push({label,scope:'anonymous official-site context only',cookieProof,storageChecked:false});
   check(label+' console-clean',()=>assert.deepEqual(errors,[]));
   await context.close();
  }
  log.result='PASS';
 }catch(e){log.result='FAIL';log.failure=String(e.message).slice(0,300);process.exitCode=1;}
 finally{if(browser)await browser.close();log.finishedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(log,null,2),{flag:'wx'});console.log(JSON.stringify({result:log.result,scenario,checks:log.checks.length,failure:log.failure||null}));}
})();
