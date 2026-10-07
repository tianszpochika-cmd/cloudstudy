// Read-only current-source observation. No registration submit, backend writes or acceptance promotion.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const evidence = __dirname;
const origin = 'http://127.0.0.1:18182';
const routes = ['/', '/courses', '/pricing', '/download', '/announcements', '/about', '/compliance', '/status', '/privacy', '/terms', '/minors'];
const result = {kind:'CURRENT_SOURCE_READ_ONLY_OBSERVATION_NOT_ACCEPTANCE', sourceCommit:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), at:new Date().toISOString(), origin, browserAvailability:'Browser plugin not available; existing regular Playwright 1.63.0', runtimeBinding:'PID9008 Nuxt dev in this workspace; no build commit endpoint, source hashes recorded separately', pages:[], interactions:[], registrationDestinations:[], blockedWrites:[], failure:null};
fs.mkdirSync(path.join(evidence,'screenshots'),{recursive:true});
async function observe(page, requested, viewportName, errors, requestedRoute=requested) {
  errors.length=0;
  const response=await page.goto(requested,{waitUntil:'networkidle',timeout:30000});
  const redirects=[];
  let request=response?.request();
  while(request){const res=await request.response();redirects.unshift({url:request.url(),status:res?.status()});request=request.redirectedFrom();}
  const text=await page.locator('body').innerText();
  const name=requestedRoute.replace(/[^a-z0-9]/gi,'_')||'_';
  const screenshot='screenshots/'+viewportName+name+'.png';
  await page.screenshot({path:path.join(evidence,screenshot),fullPage:false});
  const entry={requestedRoute,url:page.url(),title:await page.title(),status:response?.status(),redirects,viewport:page.viewportSize(),h1:await page.locator('h1').allTextContents(),notBlank:text.length>80,frameworkOverlay:await page.locator('vite-error-overlay,#__nuxt_error__').count(),horizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),screenshot,errors:[...errors],bodyText:text,links:await page.locator('a').evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})))};
  return entry;
}
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 result.browserVersion=browser.version();
 try{
  for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
   const context=await browser.newContext({viewport,locale:'zh-CN',reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/*',async route=>{const method=route.request().method();if(!['GET','HEAD','OPTIONS'].includes(method)){result.blockedWrites.push({method,url:route.request().url().split('?')[0]});await route.abort();}else await route.continue();});
   const p=await context.newPage(),errors=[];
   p.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));
   p.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push({type:m.type(),message:m.text()});});
   for(const route of routes){const entry=await observe(p,origin+route,name,errors,route);result.pages.push(entry);console.log(name,route,entry.redirects.map(x=>x.status).join('->'),entry.h1.join(' / '));}
   await p.goto(origin+'/',{waitUntil:'networkidle'});
   const primary=p.locator('.hero-buttons a').first();
   const before={url:p.url(),label:await primary.innerText(),href:await primary.getAttribute('href')};
   await primary.click();await p.waitForURL('**/start');
   const startText=await p.locator('body').innerText();
   await p.screenshot({path:path.join(evidence,'screenshots',name+'_start_interaction.png'),fullPage:false});
   const accountLinks=await p.locator('a').evaluateAll(nodes=>nodes.filter(e=>/register|\/login/.test(e.href)).map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})));
   const sample=p.locator('[data-sample-entry]');
   const sampleHref=await sample.getAttribute('href');await sample.click();await p.waitForURL('**/#practice-example');
   result.interactions.push({viewport:name,flow:'homepage primary -> start -> sample',before,startUrl:origin+'/start',unavailableMessageVisible:startText.includes('学习账号注册与登录暂不可用。'),registrationOrLoginLinks:accountLinks,sampleHref,after:p.url(),sampleVisible:await p.locator('#practice-example').isVisible(),provesRegistrationCTA:false});
   if(name==='desktop'){
    for(const dest of ['http://127.0.0.1:18180/register','http://127.0.0.1:18183/#/pages/register/register']){
     const entry=await observe(p,dest,name,errors,'register_'+new URL(dest).port);
     entry.registerSubmitExercised=false;entry.passwordInputs=await p.locator('input[type=password]').count();entry.formButtons=await p.getByRole('button').allTextContents();result.registrationDestinations.push(entry);
     console.log('destination',dest,entry.status,entry.h1.join(' / '),'passwordInputs',entry.passwordInputs);
    }
   }
   await context.close();
  }
 }catch(e){result.failure=String(e.stack||e);process.exitCode=1;}finally{await browser.close();fs.writeFileSync(path.join(evidence,'browser-observation.json'),JSON.stringify(result,null,2)+'\n');}
})();
